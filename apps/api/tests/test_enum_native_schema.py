"""Schema guards for ORM enum columns.

The Alembic schema stores enum columns as ``VARCHAR`` (or as enum types that
exist independently of the migration), so the ORM must always bind plain
string parameters. A native enum binding emits ``::some_type`` casts that
fail against any migration-built database -- exactly what broke
``ai_generation_jobs.status`` in production::

    asyncpg.exceptions.UndefinedObjectError:
        type "aigenerationjobstatus" does not exist

These tests enforce the repository-wide convention: every enum column declared
on ``Base.metadata`` is non-native.
"""

from __future__ import annotations

import importlib
import pkgutil
from typing import cast

from sqlalchemy import Table
from sqlalchemy import types as sa_types
from sqlalchemy.dialects.postgresql import asyncpg
from sqlalchemy.schema import CreateTable

import app.modules
from app.core.database import Base
from app.modules.admin.models import AIGenerationJob


def _import_all_model_modules() -> None:
    """Register every ``*models*`` module on ``Base.metadata`` (see alembic/env.py)."""
    for module in pkgutil.walk_packages(app.modules.__path__, app.modules.__name__ + "."):
        if "models" in module.name:
            importlib.import_module(module.name)


_import_all_model_modules()


def _enum_columns() -> list[tuple[str, str, sa_types.Enum]]:
    found: list[tuple[str, str, sa_types.Enum]] = []
    for table in Base.metadata.tables.values():
        for column in table.columns:
            if isinstance(column.type, sa_types.Enum):
                found.append((table.name, column.name, column.type))
    return found


def test_every_orm_enum_column_is_non_native() -> None:
    """No model may bind a native Postgres enum type.

    Alembic migrations create these columns as VARCHAR (or reference types
    created outside the migration tree), so a native binding produces
    ``::enum_type`` casts that raise UndefinedObjectError at runtime.
    """
    columns = _enum_columns()
    assert columns, "expected Base.metadata to declare enum columns"

    offenders = [
        f"{table}.{column} (type name: {enum_type.name})"
        for table, column, enum_type in columns
        if enum_type.native_enum
    ]
    assert offenders == [], (
        "Enum columns must use native_enum=False so the ORM binding matches "
        f"the VARCHAR columns produced by Alembic; offenders: {offenders}"
    )


def test_ai_generation_job_status_binds_as_string() -> None:
    """Regression test for the production failure of POST .../generation/jobs.

    Compiled against the asyncpg dialect (the production driver), the status
    parameter must never be cast to ``aigenerationjobstatus``.
    """
    job_table = cast(Table, AIGenerationJob.__table__)

    insert_sql = str(job_table.insert().values(status="queued").compile(dialect=asyncpg.dialect()))
    assert "aigenerationjobstatus" not in insert_sql
    assert "ai_generation_job_status" not in insert_sql

    create_sql = str(CreateTable(job_table).compile(dialect=asyncpg.dialect()))
    assert "status VARCHAR" in create_sql
    assert "aigenerationjobstatus" not in create_sql
