import pytest
from clipvero_api.config import Settings
from pydantic import SecretStr, ValidationError
from sqlalchemy.engine import make_url


def test_container_password_preserves_reserved_characters() -> None:
    password = "a#b@c%"
    config = Settings(
        _env_file=None,
        database_url="postgresql+psycopg://clipvero@postgres:5432/clipvero",
        database_password=SecretStr(password),
    )
    url = make_url(config.database_url)
    assert url.password == password
    assert url.host == "postgres" and url.database == "clipvero"


def test_complete_database_url_is_preserved_without_password_override() -> None:
    url = "postgresql+psycopg://owner:private%40value@db.example.com/app?sslmode=require"
    config = Settings(_env_file=None, database_url=url)
    assert config.database_url == url


def test_production_validation_does_not_expose_database_credentials() -> None:
    password = "private#password@value"
    with pytest.raises(ValidationError) as error:
        Settings(
            _env_file=None,
            environment="production",
            app_url="http://localhost:3000",
            database_url="postgresql+psycopg://clipvero@postgres:5432/clipvero",
            database_password=SecretStr(password),
        )
    assert "Production requires HTTPS" in str(error.value)
    assert password not in str(error.value)
