"""Create speaking_examiner_configs table for active oral examiner model configurations.

Revision ID: 0022_speaking_examiner_configs
Revises: 0021_ai_sandbox_benchmarks
Create Date: 2026-09-25 20:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0022_speaking_examiner_configs"
down_revision: str | None = "0021_ai_sandbox_benchmarks"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "speaking_examiner_configs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("section", sa.String(length=50), nullable=False, unique=True),
        sa.Column("model", sa.String(length=100), server_default="models/gemini-3.8-live", nullable=False),
        sa.Column("voice_persona", sa.String(length=50), server_default="Aoede", nullable=False),
        sa.Column("system_prompt", sa.Text(), nullable=False),
        sa.Column("scepticism_level", sa.Float(), server_default="0.5", nullable=False),
        sa.Column("temperature", sa.Float(), server_default="0.7", nullable=False),
        sa.Column("top_p", sa.Float(), server_default="0.95", nullable=False),
        sa.Column(
            "updated_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    op.create_index(
        "ix_speaking_examiner_configs_section",
        "speaking_examiner_configs",
        ["section"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_speaking_examiner_configs_section", table_name="speaking_examiner_configs")
    op.drop_table("speaking_examiner_configs")
