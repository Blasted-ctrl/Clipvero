from urllib.parse import parse_qs, urlparse
from uuid import uuid4

import pytest
from botocore.stub import Stubber
from clipvero_api.config import Settings
from clipvero_api.security import APIError
from clipvero_api.storage import ObjectStorage
from fastapi.testclient import TestClient
from pydantic import SecretStr


def storage() -> ObjectStorage:
    return ObjectStorage(
        Settings(
            s3_endpoint_url="https://storage.example.com",
            s3_bucket="private-fixture-bucket",
            s3_access_key_id=SecretStr("fixture-access"),
            s3_secret_access_key=SecretStr("fixture-secret"),
        )
    )


def test_signed_operations_have_workspace_paths_and_bounded_scope() -> None:
    adapter = storage()
    workspace, asset = uuid4(), uuid4()
    upload = urlparse(adapter.upload_url(workspace, asset, "image/png", 100))
    assert upload.path.endswith(f"/quarantine/{workspace}/{asset}")
    query = parse_qs(upload.query)
    assert query["X-Amz-Expires"] == ["300"]
    assert query["X-Amz-SignedHeaders"] == ["content-length;content-type;host"]
    assert "fixture-secret" not in upload.query
    download = urlparse(adapter.download_url(workspace, asset))
    assert download.path.endswith(f"/media/{workspace}/{asset}")
    assert parse_qs(download.query)["X-Amz-Expires"] == ["300"]
    with pytest.raises(APIError):
        adapter.upload_url(workspace, asset, "text/html", 100)
    with pytest.raises(APIError):
        adapter.upload_url(workspace, asset, "image/png", 101 * 1024 * 1024)


def test_storage_connection_requires_real_provider_success() -> None:
    adapter = storage()
    with Stubber(adapter.client) as stub:
        stub.add_client_error(
            "head_bucket",
            service_error_code="AccessDenied",
            service_message="sensitive provider detail",
            expected_params={"Bucket": "private-fixture-bucket"},
        )
        with pytest.raises(APIError) as failure:
            adapter.check_connection()
        assert failure.value.code == "STORAGE_UNAVAILABLE"
        assert "sensitive" not in failure.value.message
    with Stubber(adapter.client) as stub:
        stub.add_response("head_bucket", {}, {"Bucket": "private-fixture-bucket"})
        adapter.check_connection()


def test_unconfigured_storage_fails_actionably(client: TestClient) -> None:
    assert client.post("/api/v1/integrations/storage/check", json={}).status_code == 401
    client.post(
        "/api/v1/auth/register",
        json={
            "name": "Storage owner",
            "email": "storage@example.com",
            "password": "storage fixture password",
        },
    )
    response = client.post("/api/v1/integrations/storage/check", json={})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "STORAGE_NOT_CONFIGURED"
