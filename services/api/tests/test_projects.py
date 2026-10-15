from uuid import uuid4

import pytest
from clipvero_api.models import WorkspaceMember
from clipvero_api.project_models import ProjectVersion
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session


def timeline() -> dict:
    return {
        "schemaVersion": 1,
        "fps": 30,
        "aspect": "9:16",
        "fontSize": 52,
        "captionColor": "#F5F5F7",
        "accentColor": "#8B5CF6",
        "captionPosition": "center",
        "musicAssetId": None,
        "musicVolume": 0.15,
        "scenes": [
            {
                "id": str(uuid4()),
                "script": "The supplied original script.",
                "caption": "The supplied original script.",
                "durationFrames": 150,
                "background": "#151125",
                "assetId": None,
                "narrationId": None,
                "sourceVolume": 0,
                "captions": [],
                "mediaStart": 0,
                "transition": "cut",
                "fit": "cover",
            }
        ],
    }


def account(client: TestClient, email: str | None = None) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email or f"{uuid4().hex}@example.com",
            "name": "Project creator",
            "password": "a secure project password",
        },
    )
    assert response.status_code == 201


def create(client: TestClient) -> dict:
    account(client)
    response = client.post(
        "/api/v1/projects",
        json={
            "title": "Original project",
            "timeline": timeline(),
            "creationKey": str(uuid4()),
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_persistent_versions_conflicts_and_deletion(client: TestClient, db: Session) -> None:
    project = create(client)
    path = f"/api/v1/projects/{project['id']}"
    body = {"title": "Edited title", "timeline": project["timeline"], "revision": 1}
    body["timeline"]["scenes"][0]["caption"] = "The saved caption."
    response = client.patch(path, json=body)
    assert response.status_code == 200 and response.json()["revision"] == 2
    assert client.patch(path, json=body).status_code == 409
    assert client.get(path).json()["timeline"]["scenes"][0]["caption"] == "The saved caption."
    history = client.get(path + "/versions").json()
    assert [v["revision"] for v in history] == [2, 1]
    assert history[1]["timeline"]["scenes"][0]["caption"] == "The supplied original script."
    assert db.scalar(select(func.count()).select_from(ProjectVersion)) == 2
    assert client.get("/api/v1/state").json()["projects"][0]["title"] == "Edited title"
    assert client.delete(path).status_code == 200
    assert client.delete(path).status_code == 200
    assert client.get(path).status_code == 404
    assert client.get(path + "/versions").status_code == 404
    assert client.get("/api/v1/projects").json()["items"] == []


def test_creation_idempotency_and_tenant_isolation(client: TestClient) -> None:
    account(client)
    body = {"title": "One intent", "timeline": timeline(), "creationKey": str(uuid4())}
    first = client.post("/api/v1/projects", json=body).json()
    assert client.post("/api/v1/projects", json=body).json()["id"] == first["id"]
    assert (
        client.post("/api/v1/projects", json={**body, "title": "Other intent"}).status_code == 409
    )
    client.cookies.clear()
    account(client)
    path = f"/api/v1/projects/{first['id']}"
    assert client.get(path).status_code == 404
    assert client.get(path + "/versions").status_code == 404
    assert client.delete(path).status_code == 404
    assert (
        client.patch(
            path, json={"title": "stolen", "timeline": timeline(), "revision": 1}
        ).status_code
        == 404
    )
    assert client.get("/api/v1/projects").json()["items"] == []


def test_viewer_cannot_mutate_projects(client: TestClient, db: Session) -> None:
    project = create(client)
    member = db.scalar(select(WorkspaceMember))
    assert member
    member.role = "viewer"
    db.commit()
    path = f"/api/v1/projects/{project['id']}"
    assert client.get(path).status_code == 200
    assert client.delete(path).status_code == 403
    assert (
        client.patch(
            path, json={"title": "blocked", "timeline": timeline(), "revision": 1}
        ).status_code
        == 403
    )


def test_multibyte_script_fits_the_supported_json_budget(client: TestClient) -> None:
    account(client)
    document = timeline()
    original = document["scenes"][0]
    document["scenes"] = [
        {**original, "id": str(uuid4()), "script": "あ" * 1000, "caption": "あ" * 1000}
        for _ in range(12)
    ]
    response = client.post(
        "/api/v1/projects",
        json={
            "title": "Original Japanese script",
            "timeline": document,
            "creationKey": str(uuid4()),
        },
    )
    assert len(response.request.content) > 65536
    assert response.status_code == 201, response.text
    assert response.json()["timeline"]["scenes"][11]["script"] == "あ" * 1000


@pytest.mark.parametrize(
    "kind", ["duplicate-id", "bad-cue", "long", "unowned-media", "unknown-operation"]
)
def test_timeline_validation_at_the_api_boundary(client: TestClient, kind: str) -> None:
    account(client)
    document = timeline()
    if kind == "duplicate-id":
        document["scenes"].append(document["scenes"][0])
    elif kind == "bad-cue":
        document["scenes"][0]["captions"] = [
            {"id": str(uuid4()), "from": 0, "to": 999, "text": "bad"}
        ]
    elif kind == "long":
        document["scenes"][0]["durationFrames"] = 5401
    elif kind == "unowned-media":
        document["scenes"][0]["assetId"] = str(uuid4())
    else:
        document["scenes"][0]["shell"] = "arbitrary code"
    response = client.post(
        "/api/v1/projects",
        json={
            "title": "Invalid",
            "timeline": document,
            "creationKey": str(uuid4()),
        },
    )
    assert response.status_code == (404 if kind == "unowned-media" else 422)
    assert client.get("/api/v1/projects").json()["items"] == []


def test_save_response_stays_on_its_revision_when_another_writer_commits(
    migrated_engine,
    redis_client,
) -> None:
    if migrated_engine.dialect.name != "postgresql":
        pytest.skip("Requires PostgreSQL transaction interleaving")
    from clipvero_api.db import database
    from clipvero_api.main import create_app
    from sqlalchemy import event

    app = create_app()
    interleave = [False]
    second_result = []
    path = ""
    second_body = {}
    session_cookie = ""

    def second_writer(session):
        with TestClient(
            app,
            base_url="http://localhost:3000",
            headers={
                "origin": "http://localhost:3000",
                "cookie": session_cookie,
            },
        ) as other:
            response = other.patch(path, json=second_body)
            assert response.status_code == 200, response.text
            second_result.append(response.json())

    def sessions():
        with Session(migrated_engine) as db:
            if interleave[0]:
                interleave[0] = False
                event.listen(db, "after_commit", second_writer, once=True)
            yield db

    app.dependency_overrides[database] = sessions
    with TestClient(
        app, base_url="http://localhost:3000", headers={"origin": "http://localhost:3000"}
    ) as browser:
        project = create(browser)
        session_cookie = "; ".join(f"{key}={value}" for key, value in browser.cookies.items())
        path = f"/api/v1/projects/{project['id']}"
        first_document = timeline()
        second_document = timeline()
        first_document["scenes"][0]["caption"] = "First writer"
        second_document["scenes"][0]["caption"] = "Second writer"
        second_body = {"title": "Second title", "timeline": second_document, "revision": 2}
        interleave[0] = True
        first = browser.patch(
            path,
            json={
                "title": "First title",
                "timeline": first_document,
                "revision": 1,
            },
        )
        assert first.status_code == 200, first.text
        assert first.json()["revision"] == 2
        assert first.json()["timeline"]["scenes"][0]["caption"] == "First writer"
        assert second_result[0]["revision"] == 3
        current = browser.get(path).json()
        assert current["revision"] == 3 and current["title"] == "Second title"
        assert current["timeline"]["scenes"][0]["caption"] == "Second writer"
