"""Add student progress, skill intelligence, target date, and activity tracking.

Revision ID: 0013_student_progress_and_skill_intelligence
Revises: 0012_attempt_versioning_and_lifecycle
Create Date: 2026-09-18 10:50:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0013_student_progress_and_skill_intelligence"
down_revision: str | None = "0012_attempt_versioning_and_lifecycle"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Update student_skills
    op.add_column("student_skills", sa.Column("estimated_level", sa.String(length=10), nullable=True))
    op.add_column(
        "student_skills",
        sa.Column("successful_attempts", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index(
        "ix_student_skills_user_last_assessed",
        "student_skills",
        ["user_id", "last_assessed_at"],
    )

    # 2. Update skill_assessments
    op.add_column("skill_assessments", sa.Column("estimated_level", sa.String(length=10), nullable=True))
    op.add_column(
        "skill_assessments",
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0.0"),
    )
    op.create_index(
        "ix_skill_assessments_user_skill_assessed",
        "skill_assessments",
        ["user_id", "skill_id", "assessed_at"],
    )

    # 3. Update recommendations
    op.add_column("recommendations", sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(
        "ix_recommendations_user_status",
        "recommendations",
        ["user_id", "status"],
    )

    # 4. Update student_profiles
    op.add_column("student_profiles", sa.Column("target_cefr_level", sa.String(length=10), nullable=True))
    op.add_column("student_profiles", sa.Column("target_nclc_level", sa.String(length=20), nullable=True))
    op.add_column("student_profiles", sa.Column("target_date", sa.Date(), nullable=True))

    # 5. Create student_activity_events
    op.create_table(
        "student_activity_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("event_type", sa.String(length=50), nullable=False, index=True),
        sa.Column("entity_type", sa.String(length=50), nullable=True),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("metadata_payload", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_student_activity_events_user_created",
        "student_activity_events",
        ["user_id", "created_at"],
    )
    op.create_index(
        "ix_student_activity_events_user_type",
        "student_activity_events",
        ["user_id", "event_type"],
    )


def downgrade() -> None:
    op.drop_index("ix_student_activity_events_user_type", table_name="student_activity_events")
    op.drop_index("ix_student_activity_events_user_created", table_name="student_activity_events")
    op.drop_table("student_activity_events")

    op.drop_column("student_profiles", "target_date")
    op.drop_column("student_profiles", "target_nclc_level")
    op.drop_column("student_profiles", "target_cefr_level")

    op.drop_index("ix_recommendations_user_status", table_name="recommendations")
    op.drop_column("recommendations", "expires_at")

    op.drop_index("ix_skill_assessments_user_skill_assessed", table_name="skill_assessments")
    op.drop_column("skill_assessments", "confidence")
    op.drop_column("skill_assessments", "estimated_level")

    op.drop_index("ix_student_skills_user_last_assessed", table_name="student_skills")
    op.drop_column("student_skills", "successful_attempts")
    op.drop_column("student_skills", "estimated_level")
