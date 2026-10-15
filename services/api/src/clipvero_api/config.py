from functools import lru_cache
from urllib.parse import urlparse

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", hide_input_in_errors=True)

    environment: str = "development"
    app_url: str = "http://localhost:3000"
    database_url: str = "postgresql+psycopg://localhost/clipvero"
    database_password: SecretStr = SecretStr("")
    redis_url: str = "redis://localhost:6379/0"
    session_secret: str = ""
    session_days: int = 14
    registration_limit: int = Field(default=100, ge=1, le=10000)
    s3_endpoint_url: str = ""
    s3_bucket: str = ""
    s3_region: str = "auto"
    s3_access_key_id: SecretStr = SecretStr("")
    s3_secret_access_key: SecretStr = SecretStr("")

    @model_validator(mode="after")
    def validate_runtime(self) -> "Settings":
        if not self.database_url.startswith("postgresql+psycopg://"):
            raise ValueError("DATABASE_URL must use PostgreSQL with psycopg.")
        if password := self.database_password.get_secret_value():
            self.database_url = (
                make_url(self.database_url)
                .set(password=password)
                .render_as_string(hide_password=False)
            )
        parsed = urlparse(self.app_url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("APP_URL must be an absolute HTTP(S) URL.")
        if parsed.path not in {"", "/"} or parsed.query or parsed.fragment or parsed.username:
            raise ValueError("APP_URL must contain only the application origin.")
        if self.environment not in {"development", "test", "production"}:
            raise ValueError("Unknown ENVIRONMENT.")
        if not 1 <= self.session_days <= 30:
            raise ValueError("SESSION_DAYS must be between 1 and 30.")
        if self.environment == "production":
            if parsed.scheme != "https" or len(self.session_secret) < 32:
                raise ValueError("Production requires HTTPS APP_URL and a strong SESSION_SECRET.")
        if self.s3_endpoint_url:
            storage = urlparse(self.s3_endpoint_url)
            if (
                storage.scheme not in {"http", "https"}
                or not storage.netloc
                or storage.username
                or storage.password
                or storage.query
                or storage.fragment
                or storage.path not in {"", "/"}
            ):
                raise ValueError("S3_ENDPOINT_URL must be an HTTP(S) origin without credentials.")
            if self.environment == "production" and storage.scheme != "https":
                raise ValueError("Production object storage requires HTTPS.")
        return self


@lru_cache
def settings() -> Settings:
    return Settings()
