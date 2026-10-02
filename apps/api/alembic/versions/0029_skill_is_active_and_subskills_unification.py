"""Add is_active to skills and unify legacy subskills.

Revision ID: 0029_skill_is_active_and_subskills_unification
Revises: 0028_fix_trigger_teacher_status_case
Create Date: 2026-10-02 18:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0029_skill_is_active_and_subskills_unification"
down_revision: str | None = "0028_fix_trigger_teacher_status_case"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Add is_active column to skills table
    op.add_column(
        "skills",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_skills_is_active", "skills", ["is_active"])

    # 2. Unify legacy child skills into sub_skills table
    # For any row in `skills` with parent_id IS NOT NULL that does not already exist in `sub_skills`
    sync_subskills_sql = """
    INSERT INTO sub_skills (id, skill_id, code, name, description, created_at, updated_at)
    SELECT
        s.id,
        s.parent_id,
        s.code,
        s.name,
        s.description,
        s.created_at,
        s.updated_at
    FROM skills s
    WHERE s.parent_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM sub_skills sub WHERE sub.code = s.code OR sub.id = s.id
      )
    ON CONFLICT (code) DO NOTHING;
    """
    op.execute(sync_subskills_sql)


def downgrade() -> None:
    op.drop_index("ix_skills_is_active", table_name="skills")
    op.drop_column("skills", "is_active")
