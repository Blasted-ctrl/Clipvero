import os
import time
from datetime import timedelta
from uuid import uuid4

import pytest
from celery.contrib.testing.worker import start_worker
from clipvero_api.models import User, UserSession, Workspace, now
from clipvero_workers import maintenance
from clipvero_workers.app import app
from sqlalchemy import create_engine, delete, select
from sqlalchemy.orm import Session


@pytest.mark.skipif(not os.environ.get("CLIPVERO_TEST_REDIS_URL"), reason="Requires real Redis")
def test_real_broker_dispatches_session_cleanup(monkeypatch) -> None:
    engine = create_engine(os.environ["CLIPVERO_TEST_DATABASE_URL"])
    token = "test-" + uuid4().hex
    with Session(engine) as db:
        user = User(email=f"{uuid4().hex}@example.com", name="Broker test", password_hash="unused")
        workspace = Workspace(name="Broker test")
        db.add_all([user, workspace])
        db.flush()
        user_id, workspace_id = user.id, workspace.id
        db.add(
            UserSession(
                token_hash=token,
                user_id=user_id,
                workspace_id=workspace_id,
                expires_at=now() - timedelta(days=1),
            )
        )
        db.commit()
    monkeypatch.setattr(maintenance, "engine", lambda: engine)
    try:
        with start_worker(app, pool="solo", queues=["maintenance"], perform_ping_check=False):
            maintenance.expire_sessions.apply_async(queue="maintenance")
            deadline = time.monotonic() + 15
            while time.monotonic() < deadline:
                with Session(engine) as db:
                    if (
                        db.scalar(select(UserSession).where(UserSession.token_hash == token))
                        is None
                    ):
                        break
                time.sleep(0.1)
            else:
                pytest.fail("Celery did not process the cleanup task through Redis.")
    finally:
        with Session(engine) as db:
            db.execute(delete(User).where(User.id == user_id))
            db.execute(delete(Workspace).where(Workspace.id == workspace_id))
            db.commit()
        engine.dispose()
