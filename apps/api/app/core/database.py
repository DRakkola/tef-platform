"""SQLAlchemy 2 async database engine, session management, and base models."""

import datetime
import uuid
from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy import DateTime, text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import (
    AsyncAttrs,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


@compiles(UUID, "sqlite")
def _compile_uuid_sqlite(type_: Any, compiler: Any, **kw: Any) -> str:
    """Compile PostgreSQL UUID to CHAR(36) in SQLite to guarantee TEXT affinity."""
    return "CHAR(36)"


import structlog

from app.core.config import settings

logger = structlog.get_logger("tef-api.database")


class SQLEnumValues(SQLEnum):
    """SQLAlchemy Enum that serializes/deserializes using Python enum values (.value)
    and supports case-insensitive string lookups when mapping database records.
    """

    def __init__(self, *enums: Any, **kwargs: Any) -> None:
        kwargs.setdefault("values_callable", lambda obj: [e.value for e in obj])
        super().__init__(*enums, **kwargs)

    def _object_value_for_elem(self, elem: Any) -> Any:
        if elem is None:
            return None
        if elem in self._object_lookup:
            return self._object_lookup[elem]
        if isinstance(elem, str):
            if elem.lower() in self._object_lookup:
                return self._object_lookup[elem.lower()]
            if elem.upper() in self._object_lookup:
                return self._object_lookup[elem.upper()]
        return super()._object_value_for_elem(elem)


connect_args: dict[str, Any] = {}
if "pooler.supabase.com" in settings.DATABASE_URL or ":6543" in settings.DATABASE_URL:
    connect_args["statement_cache_size"] = 0
    connect_args["prepared_statement_cache_size"] = 0

if "supabase.com" in settings.DATABASE_URL or "supabase.co" in settings.DATABASE_URL:
    connect_args["ssl"] = "require"

# Async engine configured for PostgreSQL 18
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    connect_args=connect_args,
)

# Async sessionmaker
async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(AsyncAttrs, DeclarativeBase):
    """Base model class with standard UUID primary key and timestamps."""


class UUIDModel(Base):
    """Abstract model providing UUID primary key only (e.g. for append-only logs)."""

    __abstract__ = True

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )


class TimeStampedUUIDModel(Base):
    """Abstract model providing UUID primary keys and timezone-aware timestamps."""

    __abstract__ = True

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.UTC),
        onupdate=lambda: datetime.datetime.now(datetime.UTC),
        nullable=False,
    )


async def get_db() -> AsyncGenerator[AsyncSession]:
    """FastAPI dependency that yields an async database session."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def check_db_health() -> bool:
    """Verify database connectivity for readiness checks."""
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            return bool(result.scalar() == 1)
    except Exception as exc:  # noqa: BLE001
        logger.warning("database_health_check_failed", error=str(exc))
        return False
