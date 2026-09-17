"""Tests proving database session and connection functionality."""

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_db_session_executes_query(db_session: AsyncSession):
    """Verify that an async database session executes queries properly."""
    result = await db_session.execute(text("SELECT 1 AS alive"))
    scalar = result.scalar()
    assert scalar == 1
