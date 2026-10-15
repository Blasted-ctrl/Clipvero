from datetime import timedelta
from uuid import uuid4

import pytest
from clipvero_api import security
from clipvero_api.models import (
    CreditAccount,
    CreditTransaction,
    UserSession,
    Workspace,
    WorkspaceMember,
    now,
)
from clipvero_api.security import COOKIE, hash_password
from fastapi.testclient import TestClient
from redis.exceptions import ConnectionError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

BODY = {"name": "Alex Morgan", "email": "alex@example.com", "password": "a long test password"}


def signup(client: TestClient) -> dict:
    assert client.post("/api/v1/auth/register", json=BODY).status_code == 201
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 200
    return response.json()


def test_registration_login_logout_and_trial_once(client: TestClient, db: Session) -> None:
    assert client.get("/api/v1/auth/me").status_code == 401
    me = signup(client)
    assert me["credits"] == 120 and me["role"] == "owner"
    token = client.cookies.get(COOKIE)
    assert token and db.get(UserSession, token) is None
    assert client.post("/api/v1/auth/register", json=BODY).status_code == 409
    assert client.post("/api/v1/auth/logout", json={}).status_code == 200
    assert client.get("/api/v1/auth/me").status_code == 401
    assert (
        client.post(
            "/api/v1/auth/login",
            json={
                "email": "ALEX@example.com",
                "password": BODY["password"],
            },
        ).status_code
        == 200
    )
    assert client.get("/api/v1/auth/me").json()["workspaceId"] == me["workspaceId"]
    assert db.scalar(select(func.count()).select_from(CreditTransaction)) == 1
    assert db.scalar(select(CreditAccount.balance)) == 120


def test_logout_revokes_copied_cookie(client: TestClient) -> None:
    signup(client)
    token = client.cookies.get(COOKIE)
    client.post("/api/v1/auth/logout", json={})
    response = client.get("/api/v1/auth/me", headers={"cookie": f"{COOKIE}={token}"})
    assert response.status_code == 401


def test_names_persist_and_workspace_scope(client: TestClient, db: Session) -> None:
    me = signup(client)
    other = Workspace(name="Another tenant")
    db.add(other)
    db.commit()
    assert client.get(f"/api/v1/workspaces/{other.id}").status_code == 404
    assert (
        client.patch(f"/api/v1/workspaces/{other.id}", json={"name": "stolen"}).status_code == 404
    )
    assert client.get("/api/v1/workspaces").json()["items"] == [
        {
            "id": me["workspaceId"],
            "name": me["workspaceName"],
            "role": "owner",
        }
    ]
    assert (
        client.patch(
            f"/api/v1/workspaces/{me['workspaceId']}", json={"name": "New studio"}
        ).status_code
        == 200
    )
    assert client.patch("/api/v1/settings/profile", json={"name": "Jordan"}).status_code == 200
    refreshed = client.get("/api/v1/auth/me").json()
    assert refreshed["workspaceName"] == "New studio" and refreshed["name"] == "Jordan"


@pytest.mark.parametrize("role,expected", [("admin", 200), ("editor", 403), ("viewer", 403)])
def test_role_controls_are_server_enforced(
    client: TestClient, db: Session, role: str, expected: int
) -> None:
    me = signup(client)
    member = db.scalar(select(WorkspaceMember))
    assert member
    member.role = role
    db.commit()
    response = client.patch(f"/api/v1/workspaces/{me['workspaceId']}", json={"name": "Changed"})
    assert response.status_code == expected


def test_removed_membership_and_expired_session_revoke_access(
    client: TestClient, db: Session
) -> None:
    signup(client)
    session = db.scalar(select(UserSession))
    assert session
    session.expires_at = now() - timedelta(seconds=1)
    db.commit()
    assert client.get("/api/v1/auth/me").status_code == 401
    session.expires_at = now() + timedelta(days=1)
    db.delete(db.scalar(select(WorkspaceMember)))
    db.commit()
    assert client.get("/api/v1/auth/me").status_code == 401


def test_validation_origins_and_safe_errors(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register", json=BODY, headers={"origin": "https://elsewhere.example"}
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "ORIGIN_REJECTED"
    assert response.json()["requestId"] == response.headers["x-request-id"]
    assert client.post("/api/v1/auth/register", json={**BODY, "name": "  "}).status_code == 422
    assert client.post("/api/v1/auth/register", json={**BODY, "role": "owner"}).status_code == 422
    assert (
        client.post("/api/v1/auth/register", json={**BODY, "password": "short"}).status_code == 422
    )
    response = client.post("/api/v1/auth/register", content="x" * (1024 * 1024 + 1))
    assert response.status_code == 413 and "password" not in response.text


def test_rate_limit_and_redis_failure_are_not_bypassed(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    for _ in range(10):
        assert client.post("/api/v1/auth/login", json=BODY | {"name": None}).status_code == 422
    credentials = {"email": BODY["email"], "password": BODY["password"]}
    for _ in range(10):
        assert client.post("/api/v1/auth/login", json=credentials).status_code == 401
    assert client.post("/api/v1/auth/login", json=credentials).status_code == 429

    def unavailable() -> None:
        raise ConnectionError("private redis connection string")

    monkeypatch.setattr(security, "broker", unavailable)
    response = client.post("/api/v1/auth/login", json=credentials)
    assert response.status_code == 503 and "private" not in response.text
    response = client.post("/api/v1/auth/register", json=BODY)
    assert response.status_code == 503 and "private" not in response.text


def test_readiness_and_unknown_workspace(client: TestClient) -> None:
    assert client.get("/api/v1/health/live").status_code == 200
    signup(client)
    assert client.get(f"/api/v1/workspaces/{uuid4()}").status_code == 404


def test_password_storage_is_salted_and_not_plaintext() -> None:
    first, second = hash_password(BODY["password"]), hash_password(BODY["password"])
    assert first != second and BODY["password"] not in first
    assert security.verify_password(BODY["password"], first)
    assert not security.verify_password("wrong password", first)


def test_registration_limit_covers_distinct_emails(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from clipvero_api.config import settings

    monkeypatch.setattr(settings(), "registration_limit", 2)
    for index in range(2):
        response = client.post(
            "/api/v1/auth/register",
            json={
                **BODY,
                "email": f"registration-{index}@example.com",
            },
        )
        assert response.status_code == 201
    response = client.post(
        "/api/v1/auth/register",
        json={
            **BODY,
            "email": "fresh-address@example.com",
        },
    )
    assert response.status_code == 429
