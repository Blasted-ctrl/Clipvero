from functools import lru_cache
from urllib.parse import urlparse

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"
    app_url: str = "http://localhost:3000"
    database_url: str = "postgresql+psycopg://localhost/clipvero"
    redis_url: str = "redis://localhost:6379/0"
    session_secret: str = ""
    session_days: int = 14
    registration_limit: int = Field(default=100, ge=1, le=10000)

    @model_validator(mode="after")
    def validate_runtime(self) -> "Settings":
        if not self.database_url.startswith("postgresql+psycopg://"):
            raise ValueError("DATABASE_URL must use PostgreSQL with psycopg.")
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
        return self


@lru_cache
def settings() -> Settings:
    return Settings()
