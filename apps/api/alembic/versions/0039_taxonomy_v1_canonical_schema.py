"""Add is_assessable and order_index to skills, and default_response_type to task_types.

Revision ID: 0039_taxonomy_v1_canonical_schema
Revises: 0038_clean_v1_schema_reset
Create Date: 2026-10-04 14:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0039_taxonomy_v1_canonical_schema"
down_revision: str | None = "0038_clean_v1_schema_reset"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    # 1. Add is_assessable and order_index to skills table
    if is_postgres:
        op.execute("ALTER TABLE skills ADD COLUMN IF NOT EXISTS is_assessable BOOLEAN NOT NULL DEFAULT TRUE;")
        op.execute("ALTER TABLE skills ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0;")
        op.execute("CREATE INDEX IF NOT EXISTS ix_skills_is_assessable ON skills(is_assessable);")
        op.execute("CREATE INDEX IF NOT EXISTS ix_skills_order_index ON skills(order_index);")
    else:
        with op.batch_alter_table("skills") as batch_op:
            batch_op.add_column(sa.Column("is_assessable", sa.Boolean(), nullable=False, server_default=sa.text("true")))
            batch_op.add_column(sa.Column("order_index", sa.Integer(), nullable=False, server_default=sa.text("0")))
            batch_op.create_index("ix_skills_is_assessable", ["is_assessable"])
            batch_op.create_index("ix_skills_order_index", ["order_index"])

    # 2. Add default_response_type to task_types table
    if is_postgres:
        op.execute("ALTER TABLE task_types ADD COLUMN IF NOT EXISTS default_response_type VARCHAR(50) NOT NULL DEFAULT 'single_choice';")
        op.execute("CREATE INDEX IF NOT EXISTS ix_task_types_default_response_type ON task_types(default_response_type);")
    else:
        with op.batch_alter_table("task_types") as batch_op:
            batch_op.add_column(sa.Column("default_response_type", sa.String(50), nullable=False, server_default=sa.text("'single_choice'")))
            batch_op.create_index("ix_task_types_default_response_type", ["default_response_type"])


def downgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    if is_postgres:
        op.execute("DROP INDEX IF EXISTS ix_task_types_default_response_type;")
        op.execute("ALTER TABLE task_types DROP COLUMN IF EXISTS default_response_type;")
        op.execute("DROP INDEX IF EXISTS ix_skills_order_index;")
        op.execute("DROP INDEX IF EXISTS ix_skills_is_assessable;")
        op.execute("ALTER TABLE skills DROP COLUMN IF EXISTS order_index;")
        op.execute("ALTER TABLE skills DROP COLUMN IF EXISTS is_assessable;")
    else:
        with op.batch_alter_table("task_types") as batch_op:
            batch_op.drop_column("default_response_type")
        with op.batch_alter_table("skills") as batch_op:
            batch_op.drop_column("order_index")
            batch_op.drop_column("is_assessable")
