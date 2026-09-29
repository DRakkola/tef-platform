"""Application configuration using Pydantic Settings."""

from functools import lru_cache
from typing import Any, Literal, Self

from pydantic import AliasChoices, Field, computed_field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
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

    # Supabase Auth
    SUPABASE_URL: str = Field(
        default="https://lisekikckvvjshculasd.supabase.co",
        description="Base URL for the Supabase project",
        validation_alias=AliasChoices("SUPABASE_URL", "VITE_SUPABASE_URL"),
    )
    SUPABASE_JWKS_URL: str | None = Field(
        default=None,
        description="JWKS endpoint URL for Supabase asymmetric JWT verification",
    )
    SUPABASE_JWT_SECRET: str | None = Field(
        default=None,
        description="Symmetric secret for Supabase JWT verification if HS256 is used",
    )
    SUPABASE_ANON_KEY: str | None = Field(
        default=None,
        description="Supabase anonymous public API key",
        validation_alias=AliasChoices("SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"),
    )
    SUPABASE_SERVICE_ROLE_KEY: str | None = Field(
        default=None,
        description="Supabase service role secret API key for administrative tasks",
    )

    @property
    def supabase_jwks_endpoint(self) -> str:
        """Computed JWKS URL for Supabase Auth."""
        if self.SUPABASE_JWKS_URL:
            return self.SUPABASE_JWKS_URL
        base = self.SUPABASE_URL.rstrip("/")
        return f"{base}/auth/v1/.well-known/jwks.json"

    # Server
    HOST: str = "0.0.0.0"  # nosec B104
    PORT: int = 8000
    CORS_ORIGINS: list[str] | str = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "https://tef-platform.vercel.app",
        "https://tef-platform-web-ksr4.vercel.app",
    ]
    CORS_ORIGIN_REGEX: str | None = Field(
        default=r"^https?://(localhost|127\.0\.0\.1|.*\.vercel\.app|.*\.onrender\.com)(:\d+)?$",
        description="Regular expression to match allowed origins for CORS",
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            v_stripped = v.strip()
            if v_stripped.startswith("[") and v_stripped.endswith("]"):
                import json
                try:
                    return json.loads(v_stripped)
                except (ValueError, TypeError):
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
        validation_alias=AliasChoices(
            "DATABASE_URL",
            "POSTGRES_URL",
            "SUPABASE_DATABASE_URL",
            "SUPABASE_DB_URL",
            "DB_URL",
            "DB_URI",
            "DATABASE_URI",
            "POSTGRESQL_URL",
            "POSTGRES_URI",
            "POSTGRES_PRISMA_URL",
        ),
    )

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_database_url(cls, v: Any) -> str:
        if isinstance(v, str):
            if v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+asyncpg://", 1)
            elif v.startswith("postgresql://") and not v.startswith("postgresql+asyncpg://"):
                return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return str(v)

    DIRECT_DATABASE_URL: str | None = Field(
        default=None,
        description="Direct or session pooler database connection string (Port 5432) for Alembic migrations",
        validation_alias=AliasChoices(
            "DIRECT_DATABASE_URL",
            "DIRECT_URL",
            "MIGRATION_DATABASE_URL",
            "SUPABASE_DIRECT_URL",
            "POSTGRES_URL_NON_POOLING",
        ),
    )

    @field_validator("DIRECT_DATABASE_URL", mode="before")
    @classmethod
    def assemble_direct_database_url(cls, v: Any) -> str | None:
        if v is None:
            return None
        if isinstance(v, str):
            v_str = v.strip()
            if not v_str:
                return None
            if v_str.startswith("postgres://"):
                return v_str.replace("postgres://", "postgresql+asyncpg://", 1)
            elif v_str.startswith("postgresql://") and not v_str.startswith("postgresql+asyncpg://"):
                return v_str.replace("postgresql://", "postgresql+asyncpg://", 1)
            return v_str
        return str(v)

    # Redis (Ephemeral cache and queue broker)
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = "tef_redis_password"
    REDIS_DB: int = 0
    REDIS_URL: str = Field(
        default="redis://:tef_redis_password@localhost:6379/0",
        description="Redis connection URL",
        validation_alias=AliasChoices(
            "REDIS_URL",
            "UPSTASH_REDIS_URL",
            "REDIS_URI",
        ),
    )

    # Celery
    CELERY_BROKER_URL: str = "redis://:tef_redis_password@localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://:tef_redis_password@localhost:6379/2"

    # Database Connection Pool & Performance
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30
    DB_STATEMENT_TIMEOUT_MS: int = 30000

    # Storage (MinIO / S3 compatible)
    STORAGE_ENDPOINT: str = Field(
        default="localhost:9000",
        description="Object storage endpoint URL or host:port",
        validation_alias=AliasChoices(
            "STORAGE_ENDPOINT",
            "S3_ENDPOINT",
            "SUPABASE_STORAGE_ENDPOINT",
            "SUPABASE_S3_ENDPOINT",
        ),
    )
    STORAGE_ACCESS_KEY: str = Field(
        default="minioadmin",
        description="Object storage access key ID",
        validation_alias=AliasChoices(
            "STORAGE_ACCESS_KEY",
            "AWS_ACCESS_KEY_ID",
            "S3_ACCESS_KEY",
            "SUPABASE_S3_ACCESS_KEY",
        ),
    )
    STORAGE_SECRET_KEY: str = Field(
        default="minioadmin",
        description="Object storage secret key",
        validation_alias=AliasChoices(
            "STORAGE_SECRET_KEY",
            "AWS_SECRET_ACCESS_KEY",
            "S3_SECRET_KEY",
            "SUPABASE_S3_SECRET_KEY",
        ),
    )
    STORAGE_BUCKET_NAME: str = Field(
        default="tef-private",
        description="Object storage bucket name",
        validation_alias=AliasChoices(
            "STORAGE_BUCKET_NAME",
            "S3_BUCKET_NAME",
            "BUCKET_NAME",
        ),
    )
    STORAGE_USE_SSL: bool = Field(
        default=False,
        description="Whether to use SSL for object storage",
        validation_alias=AliasChoices(
            "STORAGE_USE_SSL",
            "S3_USE_SSL",
        ),
    )
    STORAGE_REGION: str = Field(
        default="us-east-1",
        description="Object storage AWS/S3 region",
        validation_alias=AliasChoices(
            "STORAGE_REGION",
            "AWS_REGION",
            "AWS_DEFAULT_REGION",
            "S3_REGION",
        ),
    )

    # Payment Provider Integration
    PAYMENT_PROVIDER: str = "mock"
    STRIPE_SECRET_KEY: str | None = None
    STRIPE_PUBLISHABLE_KEY: str | None = None
    STRIPE_WEBHOOK_SECRET: str | None = None

    # AI Provider Integration
    AI_PROVIDER: str = "mock"
    DEEPSEEK_API_KEY: str | None = None
    OPENAI_API_KEY: str | None = None

    # Server-Side Feature Flags & Emergency Safety Switches
    BETA_ENABLED: bool = True
    PRACTICE_POOL_ENABLED: bool = True
    AI_SPEAKING_ENABLED: bool = True
    AI_WRITING_ENABLED: bool = True
    BOOKINGS_ENABLED: bool = True
    CHECKOUT_ENABLED: bool = True
    MAINTENANCE_MODE: bool = False
    BILLING_PRODUCTION_ENABLED: bool = False

    # Private Beta Operational Limits (Server-enforced quotas)
    BETA_MAX_AI_SESSIONS_PER_DAY: int = 5
    BETA_MAX_AI_WRITING_PER_DAY: int = 3
    BETA_MAX_PRACTICE_POOL_PER_DAY: int = 4
    BETA_MAX_TEACHER_BOOKINGS_PER_WEEK: int = 2
    BETA_MAX_UPLOADS_PER_DAY: int = 10

    # Feature Flags & Emergency Kill Switches
    FEATURE_FLAG_AI_SPEAKING: bool = True
    FEATURE_FLAG_AI_WRITING: bool = True
    FEATURE_FLAG_PRACTICE_POOL: bool = True
    FEATURE_FLAG_TEACHER_BOOKINGS: bool = True
    FEATURE_FLAG_CHECKOUT: bool = True

    # Gemini AI / Virtual Examiner
    GEMINI_API_KEY: str | None = None
    GEMINI_LIVE_MODEL: str = "models/gemini-3.8-live"
    GEMINI_EVAL_MODEL: str = "models/gemini-3.5-flash"

    # System Release Metadata
    APP_VERSION: str = "0.1.0-beta.1"
    GIT_COMMIT: str = "HEAD"
    BUILD_TIMESTAMP: str = "2026-09-18T17:00:00Z"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_staging(self) -> bool:
        return self.ENVIRONMENT == "staging"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def cookie_secure(self) -> bool:
        return self.is_production or self.is_staging

    @model_validator(mode="after")
    def validate_production_settings(self) -> Self:
        # If CELERY URLs are left at local/default redis but a custom REDIS_URL was supplied, reuse REDIS_URL
        default_redis = "redis://:tef_redis_password@localhost:6379/0"
        is_dev_broker = any(dev in self.CELERY_BROKER_URL for dev in ("tef_redis_password", "localhost:6379", "@redis:6379"))
        is_dev_backend = any(dev in self.CELERY_RESULT_BACKEND for dev in ("tef_redis_password", "localhost:6379", "@redis:6379"))
        if is_dev_broker and self.REDIS_URL != default_redis:
            self.CELERY_BROKER_URL = self.REDIS_URL
        if is_dev_backend and self.REDIS_URL != default_redis:
            self.CELERY_RESULT_BACKEND = self.REDIS_URL

        if self.ENVIRONMENT in ("production", "staging"):
            insecure_defaults = [
                "dev-secret-key-change-in-production-must-be-32-chars-long",
                "secret",
                "changeme",
                "test",
                "password",
            ]
            if self.SECRET_KEY in insecure_defaults or len(self.SECRET_KEY) < 32:
                raise ValueError(
                    "Insecure or too short SECRET_KEY configured for production environment. "
                    "Must be a high-entropy secret of at least 32 characters."
                )
            default_db_url = "postgresql+asyncpg://tef_app:tef_app_password@localhost:5432/tef_platform"
            if self.POSTGRES_HOST not in ("localhost", "127.0.0.1", "::1"):
                if self.DATABASE_URL == default_db_url or "localhost:5432" in self.DATABASE_URL or "localhost:5433" in self.DATABASE_URL:
                    self.DATABASE_URL = f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
            elif (
                self.POSTGRES_PASSWORD not in ("tef_app_password", "password", "postgres", "admin")
                and self.DATABASE_URL == default_db_url
            ):
                self.DATABASE_URL = f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

            import urllib.parse
            clean_db = self.DATABASE_URL.replace("postgresql+asyncpg://", "http://", 1).replace("postgresql://", "http://", 1).replace("postgres://", "http://", 1)
            db_host = urllib.parse.urlparse(clean_db).hostname or ""

            if (
                db_host in ("localhost", "127.0.0.1", "::1", "")
                or "tef_app_password@localhost" in self.DATABASE_URL
                or (self.POSTGRES_PASSWORD in ("tef_app_password", "password", "postgres", "admin") and db_host in ("localhost", "127.0.0.1", "::1"))
            ):
                raise ValueError(
                    "Default POSTGRES_PASSWORD must not be used in production. "
                    f"Production database host cannot be '{db_host or 'localhost'}'. "
                    "In Koyeb, go to Service Settings -> Environment Variables, and set DATABASE_URL (or POSTGRES_URL) "
                    "to your Supabase connection string: postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres, "
                    "then click 'Save and deploy'."
                )

            default_redis_url = "redis://:tef_redis_password@localhost:6379/0"
            if self.REDIS_HOST not in ("localhost", "127.0.0.1", "::1"):
                if self.REDIS_URL == default_redis_url or "localhost:6379" in self.REDIS_URL or "localhost:6380" in self.REDIS_URL:
                    self.REDIS_URL = f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
            elif (
                self.REDIS_PASSWORD not in ("tef_redis_password", "password", "redis")
                and self.REDIS_URL == default_redis_url
            ):
                self.REDIS_URL = f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

            clean_redis = self.REDIS_URL.replace("rediss://", "http://", 1).replace("redis://", "http://", 1)
            redis_host = urllib.parse.urlparse(clean_redis).hostname or ""

            if (
                redis_host in ("localhost", "127.0.0.1", "::1", "")
                or "tef_redis_password@localhost" in self.REDIS_URL
                or (self.REDIS_PASSWORD in ("tef_redis_password", "password", "redis") and redis_host in ("localhost", "127.0.0.1", "::1"))
            ):
                raise ValueError(
                    "Default REDIS_PASSWORD must not be used in production. "
                    f"Production Redis host cannot be '{redis_host or 'localhost'}'. "
                    "In Koyeb, set REDIS_URL to your Upstash connection string: "
                    "rediss://default:[TOKEN]@[ENDPOINT].upstash.io:6379, then click 'Save and deploy'."
                )
            if self.STORAGE_ENDPOINT == "localhost:9000" and any(
                default in (self.STORAGE_ACCESS_KEY, self.STORAGE_SECRET_KEY)
                for default in ("minioadmin", "minioadmin_dev_secret", "minio")
            ):
                raise ValueError("Default MinIO credentials must not be used in production.")

            if self.ENVIRONMENT == "production":
                # Ensure CORS does not allow localhost or wildcard in production
                origins = self.CORS_ORIGINS if isinstance(self.CORS_ORIGINS, list) else [self.CORS_ORIGINS]
                for origin in origins:
                    if "localhost" in origin or "127.0.0.1" in origin or origin == "*":
                        raise ValueError(
                            f"Insecure CORS origin '{origin}' configured for production environment. "
                            "Wildcards and localhost origins are strictly forbidden."
                        )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
