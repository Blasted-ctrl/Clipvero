import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import timedelta
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Request, Response
from redis import Redis
from redis.exceptions import RedisError
from sqlalchemy import select
from sqlalchemy.orm import Session

from clipvero_api.config import settings
from clipvero_api.db import database
from clipvero_api.models import User, UserSession, WorkspaceMember, now

COOKIE = "clipvero_api_session"
DB = Annotated[Session, Depends(database)]


class APIError(Exception):
    def __init__(self, status: int, code: str, message: str) -> None:
        self.status, self.code, self.message = status, code, message


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    return (
        salt
        + ":"
        + hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1, dklen=64).hex()
    )


def verify_password(password: str, stored: str) -> bool:
    salt, expected = stored.split(":")
    actual = hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1, dklen=64)
    return hmac.compare_digest(actual.hex(), expected)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def broker() -> Redis:
    return Redis.from_url(settings().redis_url, socket_connect_timeout=2, socket_timeout=2)


def mutation_origin(request: Request) -> None:
    if request.headers.get("origin") != settings().app_url.rstrip("/"):
        raise APIError(403, "ORIGIN_REJECTED", "Use your Clipvero application to make changes.")


def rate_limit(key: str, limit: int) -> None:
    try:
        with broker() as redis:
            attempts = redis.eval(
                "local n=redis.call('INCR',KEYS[1]); "
                "if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
                1,
                key,
                900,
            )
            if int(attempts) > limit:
                raise APIError(429, "RATE_LIMITED", "Too many attempts. Try again in 15 minutes.")
    except RedisError as exc:
        raise APIError(
            503, "RATE_LIMIT_UNAVAILABLE", "Sign-in is temporarily unavailable."
        ) from exc


def auth_limit(email: str) -> None:
    digest = hmac.new(settings().session_secret.encode(), email.encode(), "sha256").hexdigest()
    rate_limit(f"auth:{digest}", 10)


def registration_limit() -> None:
    rate_limit("auth:register:aggregate", settings().registration_limit)


def create_session(db: Session, response: Response, user_id: UUID, workspace_id: UUID) -> None:
    token = secrets.token_hex(32)
    expires = now() + timedelta(days=settings().session_days)
    db.add(
        UserSession(
            token_hash=token_hash(token),
            user_id=user_id,
            workspace_id=workspace_id,
            expires_at=expires,
        )
    )
    response.set_cookie(
        COOKIE,
        token,
        expires=expires,
        httponly=True,
        samesite="lax",
        path="/",
        secure=settings().app_url.startswith("https://"),
    )


@dataclass
class Principal:
    user: User
    member: WorkspaceMember
    session: UserSession


def principal(request: Request, db: DB) -> Principal:
    token = request.cookies.get(COOKIE, "")
    if len(token) != 64:
        raise APIError(401, "UNAUTHENTICATED", "Sign in to continue.")
    row = db.execute(
        select(User, WorkspaceMember, UserSession)
        .join(UserSession, UserSession.user_id == User.id)
        .join(
            WorkspaceMember,
            (WorkspaceMember.user_id == User.id)
            & (WorkspaceMember.workspace_id == UserSession.workspace_id),
        )
        .where(UserSession.token_hash == token_hash(token), UserSession.expires_at > now())
    ).one_or_none()
    if row is None:
        raise APIError(401, "UNAUTHENTICATED", "Sign in to continue.")
    return Principal(row[0], row[1], row[2])


Me = Annotated[Principal, Depends(principal)]
