"""Deprecate legacy sub_skills table and enforce canonical skills hierarchy.

Revision ID: 0032_deprecate_legacy_subskills
Revises: 0031_canonical_skill_tagging
Create Date: 2026-10-03 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0032_deprecate_legacy_subskills"
down_revision: str | None = "0031_canonical_skill_tagging"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    # 1. Parity Sweep: Ensure any row in sub_skills is present in canonical skills table
    # preserving the exact UUID and mapping skill_id to parent_id.
    op.execute("""
    INSERT INTO skills (
        id, code, name, description, category, domain, parent_id, is_active, created_at, updated_at
    )
    SELECT
        sub.id,
        sub.code,
        sub.name,
        sub.description,
        COALESCE(p.category, 'reading'),
        p.domain,
        sub.skill_id,
        true,
        sub.created_at,
        sub.updated_at
    FROM sub_skills sub
    LEFT JOIN skills p ON p.id = sub.skill_id
    WHERE NOT EXISTS (
        SELECT 1 FROM skills s WHERE s.id = sub.id
    )
    ON CONFLICT (code) DO NOTHING;
    """)

    # 2. Add deprecation comment to sub_skills table
    if is_postgres:
        op.execute("""
        COMMENT ON TABLE sub_skills IS 
        'DEPRECATED (Taxonomy V2): Replaced by self-referencing hierarchy in skills table (parent_id). Table is read-only during transitional deprecation period.';
        """)

        # 3. Add trigger blocking any direct INSERT on sub_skills table
        op.execute("""
        CREATE OR REPLACE FUNCTION prevent_sub_skills_insert() RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'Direct insertion into sub_skills is deprecated and forbidden by Taxonomy V2 architecture. Use canonical skills hierarchy instead.';
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_prevent_sub_skills_insert ON sub_skills;

        CREATE TRIGGER trg_prevent_sub_skills_insert
        BEFORE INSERT ON sub_skills
        FOR EACH ROW EXECUTE FUNCTION prevent_sub_skills_insert();
        """)


def downgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    if is_postgres:
        op.execute("""
        DROP TRIGGER IF EXISTS trg_prevent_sub_skills_insert ON sub_skills;
        DROP FUNCTION IF EXISTS prevent_sub_skills_insert();
        COMMENT ON TABLE sub_skills IS NULL;
        """)
