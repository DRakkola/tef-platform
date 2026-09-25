"""Create beta rate limits table for dynamic student quotas.

Revision ID: 0020_beta_rate_limits
Revises: 0019_beta_cohorts_and_invitations
Create Date: 2026-09-24 11:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0020_beta_rate_limits"
down_revision: str | None = "0019_beta_cohorts_and_invitations"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "beta_rate_limits",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("scope", sa.String(length=20), nullable=False),  # 'global', 'cohort', 'user'
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("limit_value", sa.Integer(), nullable=False),
        sa.Column("window", sa.String(length=20), server_default="daily", nullable=False),
        sa.Column(
            "cohort_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("beta_cohorts.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_index("ix_beta_rate_limits_scope", "beta_rate_limits", ["scope"])
    op.create_index("ix_beta_rate_limits_action", "beta_rate_limits", ["action"])
    op.create_index("ix_beta_rate_limits_cohort_id", "beta_rate_limits", ["cohort_id"])
    op.create_index("ix_beta_rate_limits_user_id", "beta_rate_limits", ["user_id"])

    # Partial unique indexes for scope constraints
    op.create_index(
        "uq_beta_rate_limits_global",
        "beta_rate_limits",
        ["action"],
        unique=True,
        postgresql_where=sa.text("scope = 'global'"),
    )
    op.create_index(
        "uq_beta_rate_limits_cohort",
        "beta_rate_limits",
        ["cohort_id", "action"],
        unique=True,
        postgresql_where=sa.text("scope = 'cohort'"),
    )
    op.create_index(
        "uq_beta_rate_limits_user",
        "beta_rate_limits",
        ["user_id", "action"],
        unique=True,
        postgresql_where=sa.text("scope = 'user'"),
    )


def downgrade() -> None:
    op.drop_index("uq_beta_rate_limits_user", table_name="beta_rate_limits")
    op.drop_index("uq_beta_rate_limits_cohort", table_name="beta_rate_limits")
    op.drop_index("uq_beta_rate_limits_global", table_name="beta_rate_limits")
    op.drop_index("ix_beta_rate_limits_user_id", table_name="beta_rate_limits")
    op.drop_index("ix_beta_rate_limits_cohort_id", table_name="beta_rate_limits")
    op.drop_index("ix_beta_rate_limits_action", table_name="beta_rate_limits")
    op.drop_index("ix_beta_rate_limits_scope", table_name="beta_rate_limits")
    op.drop_table("beta_rate_limits")
