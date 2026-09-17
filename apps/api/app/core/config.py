"""Application configuration using Pydantic Settings."""

from functools import lru_cache
from typing import Any, Literal, Self

from pydantic import Field, computed_field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # General
    ENVIRONMENT: Literal["development", "staging", "production", "testing"] = "development"
    PROJECT_NAME: str = "TEF Platform API"
    API_V1_PREFIX: str = "/api/v1"
    SECRET_KEY: str = Field(
        default="dev-secret-key-change-in-production-must-be-32-chars-long",
        description="Secret key for signing tokens and sessions",
    )

    # Authentication & Security
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    COOKIE_SAMESITE: Literal["lax", "strict", "none"] = "lax"
    COOKIE_DOMAIN: str | None = None
    RATE_LIMIT_AUTH_PER_MINUTE: int = 10

    # Server
    HOST: str = "0.0.0.0"  # nosec B104
    PORT: int = 8000
    CORS_ORIGINS: list[str] | str = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            v_stripped = v.strip()
            if v_stripped.startswith("[") and v_stripped.endswith("]"):
                import json
                try:
                    return json.loads(v_stripped)
                except Exception:
                    pass
            return [i.strip() for i in v_stripped.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return []

    # Database (PostgreSQL 18 system of record)
    POSTGRES_USER: str = "tef_app"
    POSTGRES_PASSWORD: str = "tef_app_password"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "tef_platform"
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://tef_app:tef_app_password@localhost:5432/tef_platform",
        description="Async SQLAlchemy database connection string",
    )

    # Redis (Ephemeral cache and queue broker)
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = "tef_redis_password"
    REDIS_DB: int = 0
    REDIS_URL: str = Field(
        default="redis://:tef_redis_password@localhost:6379/0",
        description="Redis connection URL",
    )

    # Celery
    CELERY_BROKER_URL: str = "redis://:tef_redis_password@localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://:tef_redis_password@localhost:6379/2"

    # Storage (MinIO / S3 compatible)
    STORAGE_ENDPOINT: str = "localhost:9000"
    STORAGE_ACCESS_KEY: str = "minioadmin"
    STORAGE_SECRET_KEY: str = "minioadmin"
    STORAGE_BUCKET_NAME: str = "tef-private"
    STORAGE_USE_SSL: bool = False
    STORAGE_REGION: str = "us-east-1"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def cookie_secure(self) -> bool:
        return self.is_production

    @model_validator(mode="after")
    def validate_production_settings(self) -> Self:
        if self.ENVIRONMENT == "production":
            insecure_defaults = [
                "dev-secret-key-change-in-production-must-be-32-chars-long",
                "secret",
                "changeme",
            ]
            if self.SECRET_KEY in insecure_defaults or len(self.SECRET_KEY) < 32:
                raise ValueError(
                    "Insecure or too short SECRET_KEY configured for production environment. "
                    "Must be a high-entropy secret of at least 32 characters."
                )
            if self.POSTGRES_PASSWORD == "tef_app_password":  # nosec B105
                raise ValueError("Default POSTGRES_PASSWORD must not be used in production.")
            if self.REDIS_PASSWORD == "tef_redis_password":  # nosec B105
                raise ValueError("Default REDIS_PASSWORD must not be used in production.")
            if "minioadmin" in (self.STORAGE_ACCESS_KEY, self.STORAGE_SECRET_KEY):
                raise ValueError("Default MinIO credentials must not be used in production.")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
