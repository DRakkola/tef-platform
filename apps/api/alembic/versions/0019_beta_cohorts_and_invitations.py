"""Create beta cohorts, beta invitations, and update users table.

Revision ID: 0019_beta_cohorts_and_invitations
Revises: 0018_analytics_experiments_and_feedback
Create Date: 2026-09-18 21:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0019_beta_cohorts_and_invitations"
down_revision: str | None = "0018_analytics_experiments_and_feedback"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. beta_cohorts
    op.create_table(
        "beta_cohorts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(length=100), unique=True, nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("max_students", sa.Integer(), server_default="50", nullable=False),
        sa.Column("max_teachers", sa.Integer(), server_default="15", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("feature_overrides", postgresql.JSON(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_beta_cohorts_name", "beta_cohorts", ["name"])
    op.create_index("ix_beta_cohorts_is_active", "beta_cohorts", ["is_active"])

    # 2. Add columns to users
    op.add_column(
        "users",
        sa.Column("is_beta_user", sa.Boolean(), server_default="false", nullable=False),
    )
    op.add_column(
        "users",
        sa.Column(
            "beta_cohort_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("beta_cohorts.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_users_is_beta_user", "users", ["is_beta_user"])
    op.create_index("ix_users_beta_cohort_id", "users", ["beta_cohort_id"])

    # 3. beta_invitations
    op.create_table(
        "beta_invitations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("token_hash", sa.String(length=64), unique=True, nullable=False),
        sa.Column("token_prefix", sa.String(length=16), nullable=False),
        sa.Column("cohort_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("beta_cohorts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("role", sa.String(length=20), server_default="student", nullable=False),
        sa.Column("max_uses", sa.Integer(), server_default="1", nullable=False),
        sa.Column("used_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("environment", sa.String(length=20), server_default="production", nullable=False),
        sa.Column("is_revoked", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_beta_invitations_token_hash", "beta_invitations", ["token_hash"])
    op.create_index("ix_beta_invitations_cohort_id", "beta_invitations", ["cohort_id"])
    op.create_index("ix_beta_invitations_expires_at", "beta_invitations", ["expires_at"])
    op.create_index("ix_beta_invitations_is_revoked", "beta_invitations", ["is_revoked"])
    op.create_index("ix_beta_invitations_token_active", "beta_invitations", ["token_hash", "is_revoked", "expires_at"])


def downgrade() -> None:
    op.drop_table("beta_invitations")
    op.drop_index("ix_users_beta_cohort_id", table_name="users")
    op.drop_index("ix_users_is_beta_user", table_name="users")
    op.drop_column("users", "beta_cohort_id")
    op.drop_column("users", "is_beta_user")
    op.drop_table("beta_cohorts")
