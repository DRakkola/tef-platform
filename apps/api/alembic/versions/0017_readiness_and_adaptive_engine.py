"""Create readiness profiles, skill evidences, readiness snapshots, exercise effectiveness, spaced review items.

Revision ID: 0017_readiness_and_adaptive_engine
Revises: 0016_billing_and_monetization
Create Date: 2026-09-18 19:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0017_readiness_and_adaptive_engine"
down_revision: str | None = "0016_billing_and_monetization"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Add daily_minutes_available to student_profiles
    op.add_column(
        "student_profiles",
        sa.Column("daily_minutes_available", sa.Integer(), server_default="30", nullable=False),
    )

    # 2. readiness_profiles
    op.create_table(
        "readiness_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "student_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            unique=True,
            nullable=False,
        ),
        sa.Column("target_exam", sa.String(length=100), server_default="TEF Canada", nullable=False),
        sa.Column("target_level", sa.String(length=20), server_default="B2", nullable=False),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("overall_estimate", sa.Float(), nullable=True),
        sa.Column("estimated_level", sa.String(length=10), nullable=True),
        sa.Column("confidence", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("confidence_label", sa.String(length=50), server_default="insufficient_data", nullable=False),
        sa.Column("readiness_band", sa.String(length=50), server_default="insufficient_data", nullable=False),
        sa.Column("summary_skills", postgresql.JSON(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("summary_gaps", postgresql.JSON(astext_type=sa.Text()), server_default="[]", nullable=False),
        sa.Column("summary_blockers", postgresql.JSON(astext_type=sa.Text()), server_default="[]", nullable=False),
        sa.Column("last_calculated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("calculation_version", sa.String(length=50), server_default="v1.0.0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_readiness_profiles_student_id", "readiness_profiles", ["student_id"])
    op.create_index("ix_readiness_profiles_readiness_band", "readiness_profiles", ["readiness_band"])
    op.create_index("ix_readiness_profiles_version", "readiness_profiles", ["calculation_version"])

    # 3. skill_evidences
    op.create_table(
        "skill_evidences",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "student_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "skill_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("skills.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source_type", sa.String(length=50), nullable=False),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("raw_score", sa.Float(), nullable=False),
        sa.Column("normalized_score", sa.Float(), nullable=False),
        sa.Column("confidence", sa.Float(), server_default="1.0", nullable=False),
        sa.Column("weight", sa.Float(), server_default="1.0", nullable=False),
        sa.Column("observed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("calculation_version", sa.String(length=50), server_default="v1.0.0", nullable=False),
        sa.Column("metadata_payload", postgresql.JSON(astext_type=sa.Text()), server_default="{}", nullable=False),
    )
    op.create_index("ix_skill_evidences_student_observed", "skill_evidences", ["student_id", "observed_at"])
    op.create_index("ix_skill_evidences_student_skill", "skill_evidences", ["student_id", "skill_id"])
    op.create_index("ix_skill_evidences_source_type", "skill_evidences", ["source_type"])
    op.create_index("ix_skill_evidences_source_id", "skill_evidences", ["source_id"])
    op.create_unique_constraint(
        "uq_skill_evidence_student_source_skill",
        "skill_evidences",
        ["student_id", "skill_id", "source_type", "source_id"],
    )

    # 4. readiness_snapshots
    op.create_table(
        "readiness_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "student_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("overall_estimate", sa.Float(), nullable=True),
        sa.Column("estimated_level", sa.String(length=10), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("confidence_label", sa.String(length=50), nullable=False),
        sa.Column("readiness_band", sa.String(length=50), nullable=False),
        sa.Column("skills", postgresql.JSON(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("gaps", postgresql.JSON(astext_type=sa.Text()), server_default="[]", nullable=False),
        sa.Column("blockers", postgresql.JSON(astext_type=sa.Text()), server_default="[]", nullable=False),
        sa.Column("recommendations", postgresql.JSON(astext_type=sa.Text()), server_default="[]", nullable=False),
        sa.Column("calculation_version", sa.String(length=50), server_default="v1.0.0", nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_readiness_snapshots_student_gen", "readiness_snapshots", ["student_id", "generated_at"])

    # 5. exercise_effectiveness
    op.create_table(
        "exercise_effectiveness",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "exercise_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("exercises.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "skill_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("skills.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("completion_rate", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("average_pre_score", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("average_post_score", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("observed_improvement", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("calculation_version", sa.String(length=50), server_default="v1.0.0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_exercise_effectiveness_exercise_id", "exercise_effectiveness", ["exercise_id"])
    op.create_index("ix_exercise_effectiveness_skill_id", "exercise_effectiveness", ["skill_id"])
    op.create_unique_constraint(
        "uq_exercise_effectiveness_exercise_skill",
        "exercise_effectiveness",
        ["exercise_id", "skill_id"],
    )

    # 6. spaced_review_items
    op.create_table(
        "spaced_review_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("entity_type", sa.String(length=50), server_default="exercise", nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "skill_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("skills.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("next_review_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_interval_days", sa.Integer(), server_default="1", nullable=False),
        sa.Column("review_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("mastery", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("last_reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_spaced_review_user_next", "spaced_review_items", ["user_id", "next_review_at"])
    op.create_unique_constraint(
        "uq_spaced_review_user_entity",
        "spaced_review_items",
        ["user_id", "entity_type", "entity_id"],
    )


def downgrade() -> None:
    op.drop_table("spaced_review_items")
    op.drop_table("exercise_effectiveness")
    op.drop_table("readiness_snapshots")
    op.drop_table("skill_evidences")
    op.drop_table("readiness_profiles")
    op.drop_column("student_profiles", "daily_minutes_available")
