"""Add assessment_version_id to attempts and lifecycle index.

Revision ID: 0012_attempt_versioning_and_lifecycle
Revises: 0011_content_studio_versioning
Create Date: 2026-09-18 08:45:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0012_attempt_versioning_and_lifecycle"
down_revision: str | None = "0011_content_studio_versioning"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 0. Ensure alembic_version column is wide enough to store longer revision strings
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TABLE alembic_version ALTER COLUMN version_num TYPE VARCHAR(255)")

    # 1. Add assessment_version_id column to attempts
    op.add_column(
        "attempts",
        sa.Column(
            "assessment_version_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("assessment_versions.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_attempts_assessment_version_id", "attempts", ["assessment_version_id"])
    op.create_index("ix_attempts_user_status", "attempts", ["user_id", "status"])


def downgrade() -> None:
    op.drop_index("ix_attempts_user_status", table_name="attempts")
    op.drop_index("ix_attempts_assessment_version_id", table_name="attempts")
    op.drop_column("attempts", "assessment_version_id")
