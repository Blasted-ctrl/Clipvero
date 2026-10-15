from datetime import timedelta

from clipvero_api.models import Base, User, UserSession, Workspace, now
from clipvero_workers import maintenance
from clipvero_workers.app import QUEUES, app
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session


def test_session_cleanup_preserves_current_sessions(tmp_path, monkeypatch) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'maintenance.db'}")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        user, workspace = (
            User(email="worker@example.com", name="Worker", password_hash="unused"),
            Workspace(name="Test"),
        )
        db.add_all([user, workspace])
        db.flush()
        for token, days in [("expired", -1), ("current", 1)]:
            db.add(
                UserSession(
                    token_hash=token,
                    user_id=user.id,
                    workspace_id=workspace.id,
                    expires_at=now() + timedelta(days=days),
                )
            )
        db.commit()
    monkeypatch.setattr(maintenance, "engine", lambda: engine)
    assert maintenance.expire_sessions.run() == 1
    assert maintenance.expire_sessions.run() == 0
    with Session(engine) as db:
        assert db.scalars(select(UserSession.token_hash)).all() == ["current"]
    assert app.conf.task_routes["clipvero.expire_sessions"]["queue"] == "maintenance"
    assert set(QUEUES) == {q.name for q in app.conf.task_queues}
    engine.dispose()
