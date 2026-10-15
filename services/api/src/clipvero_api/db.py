from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from clipvero_api.config import settings


@lru_cache
def engine() -> Engine:
    return create_engine(settings().database_url, pool_pre_ping=True, pool_size=5, max_overflow=5)


def database() -> Iterator[Session]:
    with Session(engine()) as session:
        yield session
