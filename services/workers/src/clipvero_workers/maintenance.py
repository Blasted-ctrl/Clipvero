import json
import logging

from clipvero_api.db import engine
from clipvero_api.models import UserSession, now
from sqlalchemy import delete
from sqlalchemy.orm import Session

from clipvero_workers.app import app


@app.task(name="clipvero.expire_sessions", autoretry_for=(), max_retries=0)  # type: ignore[untyped-decorator]
def expire_sessions() -> int:
    with Session(engine()) as db:
        rows = db.execute(
            delete(UserSession)
            .where(UserSession.expires_at <= now())
            .returning(UserSession.token_hash)
        ).all()
        db.commit()
    logging.getLogger("clipvero.worker").info(
        json.dumps(
            {
                "event": "sessions.expired",
                "count": len(rows),
            }
        )
    )
    return len(rows)
