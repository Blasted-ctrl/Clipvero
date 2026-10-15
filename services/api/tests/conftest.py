import os
from collections.abc import Iterator
from pathlib import Path
from uuid import uuid4

import fakeredis
import pytest
from alembic import command
from alembic.config import Config
from clipvero_api import (
    project_models,  # noqa: F401
    routes,
    security,
)
from clipvero_api.db import database
from clipvero_api.main import create_app
from clipvero_api.models import Base
from fastapi.testclient import TestClient
from redis import Redis
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from sqlalchemy.schema import CreateSchema, DropSchema


@pytest.fixture(scope="session")
def migrated_engine() -> Iterator[Engine]:
    url = os.environ.get("CLIPVERO_TEST_DATABASE_URL")
    if url:
        assert url.startswith("postgresql+psycopg://")
        admin = create_engine(url)
        schema = f"test_{uuid4().hex}"
        with admin.begin() as connection:
            connection.execute(CreateSchema(schema))
        engine = create_engine(url, connect_args={"options": f"-csearch_path={schema}"})
        config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
        with engine.begin() as connection:
            config.attributes["connection"] = connection
            command.upgrade(config, "head")
            command.downgrade(config, "base")
            command.upgrade(config, "head")
        try:
            yield engine
        finally:
            engine.dispose()
            with admin.begin() as connection:
                connection.execute(DropSchema(schema, cascade=True))
            admin.dispose()
    else:
        engine = create_engine(
            "sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
        )
        Base.metadata.create_all(engine)
        yield engine
        engine.dispose()


@pytest.fixture
def db(migrated_engine: Engine) -> Iterator[Session]:
    with migrated_engine.connect() as connection:
        transaction = connection.begin()
        if migrated_engine.dialect.name == "sqlite":
            connection.exec_driver_sql("BEGIN")
        with Session(connection, join_transaction_mode="create_savepoint") as session:
            yield session
        transaction.rollback()


@pytest.fixture
def redis_client(monkeypatch: pytest.MonkeyPatch) -> Redis:
    url = os.environ.get("CLIPVERO_TEST_REDIS_URL")
    redis = Redis.from_url(url) if url else fakeredis.FakeRedis()
    prefix = f"test:{uuid4().hex}:"

    class ScopedRedis:
        def __enter__(self) -> "ScopedRedis":
            return self

        def __exit__(self, *args: object) -> None:
            pass

        def eval(self, script: str, count: int, key: str, ttl: int) -> object:
            return redis.eval(script, count, prefix + key, ttl)

        def ping(self) -> object:
            return redis.ping()

    monkeypatch.setattr(security, "broker", ScopedRedis)
    monkeypatch.setattr(routes, "broker", ScopedRedis)
    return redis


@pytest.fixture
def client(db: Session, redis_client: Redis) -> Iterator[TestClient]:
    app = create_app()

    def request_database():
        try:
            yield db
        finally:
            db.rollback()

    app.dependency_overrides[database] = request_database
    with TestClient(
        app, base_url="http://localhost:3000", headers={"origin": "http://localhost:3000"}
    ) as client:
        yield client
