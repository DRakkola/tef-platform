import asyncio
from logging.config import fileConfig

from sqlalchemy import pool, text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

# Ensure all application models are loaded into Base.metadata
import app.modules.admin.models
import app.modules.admin.beta_models  # noqa: F401
import app.modules.admin.ai_sandbox_models  # noqa: F401
import app.modules.admin.speaking_config_models  # noqa: F401
import app.modules.admin.speaking_scenario_models  # noqa: F401
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


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = settings.DATABASE_URL
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
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
        except Exception:
            pass

    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode with async engine."""
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = settings.DATABASE_URL

    connect_args = {}
    if "pooler.supabase.com" in settings.DATABASE_URL or ":6543" in settings.DATABASE_URL:
        connect_args["statement_cache_size"] = 0
        connect_args["prepared_statement_cache_size"] = 0

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
