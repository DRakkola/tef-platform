import asyncio
from logging.config import fileConfig

from sqlalchemy import pool, text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

import app.modules.admin.ai_sandbox_models
import app.modules.admin.beta_models

# Ensure all application models are loaded into Base.metadata
import app.modules.admin.models
import app.modules.admin.speaking_config_models
import app.modules.admin.speaking_scenario_models
import app.modules.analytics.models
import app.modules.assessments.models
import app.modules.billing.models
import app.modules.learning.models
import app.modules.practice_pool.models
import app.modules.speaking.models
import app.modules.teachers.models
import app.modules.users.models
import app.modules.writing.models  # noqa: F401
from alembic import context
from app.core.config import settings
from app.core.database import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Support rendering JSON literals in offline migration mode (--sql)
import json

from sqlalchemy.dialects.postgresql.base import PGCompiler
from sqlalchemy.types import JSON

_orig_render_literal_value = PGCompiler.render_literal_value


def _patched_render_literal_value(self, value, type_):
    if isinstance(type_, JSON):
        return "'" + json.dumps(value).replace("'", "''") + "'::json"
    return _orig_render_literal_value(self, value, type_)


PGCompiler.render_literal_value = _patched_render_literal_value


def include_object(object, name, type_, reflected, compare_to):
    """Ensure Alembic only manages public application schema, ignoring Supabase system schemas."""
    return not (type_ == "table" and getattr(object, "schema", None) not in (None, "public"))


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = settings.DIRECT_DATABASE_URL or settings.DATABASE_URL
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    if connection.dialect.name == "postgresql":
        try:
            connection.execute(
                text("ALTER TABLE IF EXISTS alembic_version ALTER COLUMN version_num TYPE VARCHAR(255)")
            )
            connection.commit()
        except Exception:  # noqa: BLE001, S110
            pass

    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_object=include_object,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode with async engine."""
    migration_url = settings.DIRECT_DATABASE_URL or settings.DATABASE_URL
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = migration_url

    connect_args = {}
    if "pooler.supabase.com" in migration_url or ":6543" in migration_url:
        connect_args["statement_cache_size"] = 0
        connect_args["prepared_statement_cache_size"] = 0
    if "supabase.com" in migration_url or "supabase.co" in migration_url:
        connect_args["ssl"] = "require"

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
