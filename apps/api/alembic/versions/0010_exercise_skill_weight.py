"""Add weight column to exercise_skills table.

Revision ID: 0010_exercise_skill_weight
Revises: 0009_admin_content_audit
Create Date: 2026-09-18 00:06:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0010_exercise_skill_weight"
down_revision: str | None = "0009_admin_content_audit"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "exercise_skills",
        sa.Column("weight", sa.Float(), nullable=False, server_default="1.0"),
    )


def downgrade() -> None:
    op.drop_column("exercise_skills", "weight")
