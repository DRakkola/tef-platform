"""Create analytics events, user feedback, support tickets, experiments, variants, and assignments.

Revision ID: 0018_analytics_experiments_and_feedback
Revises: 0017_readiness_and_adaptive_engine
Create Date: 2026-09-18 20:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0018_analytics_experiments_and_feedback"
down_revision: str | None = "0017_readiness_and_adaptive_engine"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Add onboarding columns to student_profiles
    op.add_column(
        "student_profiles",
        sa.Column("onboarding_status", sa.String(length=20), server_default="incomplete", nullable=False),
    )
    op.add_column(
        "student_profiles",
        sa.Column("onboarding_step", sa.Integer(), server_default="1", nullable=False),
    )

    # 2. analytics_events
    op.create_table(
        "analytics_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("session_id", sa.String(length=64), nullable=True),
        sa.Column("entity_type", sa.String(length=64), nullable=True),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("metadata_payload", postgresql.JSON(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("schema_version", sa.String(length=16), server_default="v1.0.0", nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_analytics_events_event_type", "analytics_events", ["event_type"])
    op.create_index("ix_analytics_events_actor_id", "analytics_events", ["actor_id"])
    op.create_index("ix_analytics_events_session_id", "analytics_events", ["session_id"])
    op.create_index("ix_analytics_events_occurred_at", "analytics_events", ["occurred_at"])
    op.create_index(
        "ix_analytics_event_type_occurred",
        "analytics_events",
        ["event_type", "occurred_at"],
    )
    op.create_index(
        "ix_analytics_actor_occurred",
        "analytics_events",
        ["actor_id", "occurred_at"],
    )

    # 3. user_feedback
    op.create_table(
        "user_feedback",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category", sa.String(length=32), server_default="general", nullable=False),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("context_url", sa.String(length=255), nullable=True),
        sa.Column("metadata_payload", postgresql.JSON(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_user_feedback_user_id", "user_feedback", ["user_id"])
    op.create_index("ix_user_feedback_category", "user_feedback", ["category"])

    # 4. support_tickets
    op.create_table(
        "support_tickets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("category", sa.String(length=32), server_default="general", nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), server_default="open", nullable=False),
        sa.Column("priority", sa.String(length=16), server_default="medium", nullable=False),
        sa.Column("context_payload", postgresql.JSON(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("internal_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_support_tickets_user_id", "support_tickets", ["user_id"])
    op.create_index("ix_support_tickets_category", "support_tickets", ["category"])
    op.create_index("ix_support_tickets_status", "support_tickets", ["status"])
    op.create_index("ix_support_tickets_priority", "support_tickets", ["priority"])

    # 5. experiments
    op.create_table(
        "experiments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("key", sa.String(length=64), unique=True, nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), server_default="draft", nullable=False),
        sa.Column("target_audience", postgresql.JSON(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_experiments_key", "experiments", ["key"])
    op.create_index("ix_experiments_status", "experiments", ["status"])

    # 6. experiment_variants
    op.create_table(
        "experiment_variants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("experiment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("experiments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("key", sa.String(length=32), nullable=False),
        sa.Column("weight", sa.Integer(), server_default="50", nullable=False),
        sa.Column("config_payload", postgresql.JSON(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("experiment_id", "key", name="uq_experiment_variant_key"),
    )
    op.create_index("ix_experiment_variants_experiment_id", "experiment_variants", ["experiment_id"])

    # 7. experiment_assignments
    op.create_table(
        "experiment_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("experiment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("experiments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("variant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("experiment_variants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("experiment_id", "user_id", name="uq_experiment_user_assignment"),
    )
    op.create_index("ix_experiment_assignments_experiment_id", "experiment_assignments", ["experiment_id"])
    op.create_index("ix_experiment_assignments_user_id", "experiment_assignments", ["user_id"])


def downgrade() -> None:
    op.drop_table("experiment_assignments")
    op.drop_table("experiment_variants")
    op.drop_table("experiments")
    op.drop_table("support_tickets")
    op.drop_table("user_feedback")
    op.drop_table("analytics_events")
    op.drop_column("student_profiles", "onboarding_step")
    op.drop_column("student_profiles", "onboarding_status")
