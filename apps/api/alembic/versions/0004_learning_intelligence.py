"""Create learning intelligence tables: student_skills, skill_assessments, mistakes, exercises, exercise_skills, exercise_attempts, and recommendations.

Revision ID: 0004_learning_intelligence
Revises: 0003_assessment_engine
Create Date: 2026-09-17 16:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004_learning_intelligence"
down_revision: str | None = "0003_assessment_engine"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Add category to skills table
    op.add_column("skills", sa.Column("category", sa.String(length=50), nullable=True))
    op.create_index("ix_skills_category", "skills", ["category"])

    # 2. student_skills table
    op.create_table(
        "student_skills",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
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
        sa.Column("mastery_score", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("attempts_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_assessed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "skill_id", name="uq_student_skill"),
    )
    op.create_index("ix_student_skills_id", "student_skills", ["id"])
    op.create_index("ix_student_skills_user_id", "student_skills", ["user_id"])
    op.create_index("ix_student_skills_skill_id", "student_skills", ["skill_id"])

    # 3. skill_assessments table (immutable snapshots)
    op.create_table(
        "skill_assessments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
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
        sa.Column(
            "source_type", sa.String(length=50), nullable=False, server_default="assessment_attempt"
        ),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("points_earned", sa.Float(), nullable=False),
        sa.Column("points_possible", sa.Float(), nullable=False),
        sa.Column("assessed_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_skill_assessments_id", "skill_assessments", ["id"])
    op.create_index("ix_skill_assessments_user_id", "skill_assessments", ["user_id"])
    op.create_index("ix_skill_assessments_skill_id", "skill_assessments", ["skill_id"])
    op.create_index("ix_skill_assessments_source_id", "skill_assessments", ["source_id"])
    op.create_index("ix_skill_assessments_assessed_at", "skill_assessments", ["assessed_at"])

    # 4. mistakes table
    op.create_table(
        "mistakes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
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
        sa.Column("subskill", sa.String(length=100), nullable=True),
        sa.Column("source_type", sa.String(length=50), nullable=False),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "question_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("questions.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("exercise_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("user_answer", sa.Text(), nullable=True),
        sa.Column("correct_answer", sa.Text(), nullable=True),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("error_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("last_occurred_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_mistakes_id", "mistakes", ["id"])
    op.create_index("ix_mistakes_user_id", "mistakes", ["user_id"])
    op.create_index("ix_mistakes_skill_id", "mistakes", ["skill_id"])
    op.create_index("ix_mistakes_question_id", "mistakes", ["question_id"])
    op.create_index("ix_mistakes_exercise_id", "mistakes", ["exercise_id"])
    op.create_index("ix_mistakes_last_occurred_at", "mistakes", ["last_occurred_at"])

    # 5. exercises table
    op.create_table(
        "exercises",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("level", sa.String(length=20), nullable=False, server_default="B1"),
        sa.Column("difficulty", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "question_type", sa.String(length=50), nullable=False, server_default="single_choice"
        ),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("points", sa.Integer(), nullable=False, server_default="10"),
        sa.Column(
            "options_payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_exercises_id", "exercises", ["id"])
    op.create_index("ix_exercises_category", "exercises", ["category"])
    op.create_index("ix_exercises_level", "exercises", ["level"])
    op.create_index("ix_exercises_is_published", "exercises", ["is_published"])

    # 6. exercise_skills table
    op.create_table(
        "exercise_skills",
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
        sa.Column("subskill", sa.String(length=100), nullable=True),
        sa.UniqueConstraint("exercise_id", "skill_id", name="uq_exercise_skill"),
    )
    op.create_index("ix_exercise_skills_id", "exercise_skills", ["id"])
    op.create_index("ix_exercise_skills_exercise_id", "exercise_skills", ["exercise_id"])
    op.create_index("ix_exercise_skills_skill_id", "exercise_skills", ["skill_id"])

    # 7. exercise_attempts table
    op.create_table(
        "exercise_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "exercise_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("exercises.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("is_correct", sa.Boolean(), nullable=False),
        sa.Column("points_awarded", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("user_response", sa.Text(), nullable=True),
        sa.Column("attempted_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_exercise_attempts_id", "exercise_attempts", ["id"])
    op.create_index("ix_exercise_attempts_user_id", "exercise_attempts", ["user_id"])
    op.create_index("ix_exercise_attempts_exercise_id", "exercise_attempts", ["exercise_id"])
    op.create_index("ix_exercise_attempts_attempted_at", "exercise_attempts", ["attempted_at"])

    # 8. recommendations table
    op.create_table(
        "recommendations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
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
        sa.Column(
            "recommendation_type", sa.String(length=50), nullable=False, server_default="exercise"
        ),
        sa.Column("entity_type", sa.String(length=50), nullable=False, server_default="exercise"),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="50"),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="active"),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_recommendations_id", "recommendations", ["id"])
    op.create_index("ix_recommendations_user_id", "recommendations", ["user_id"])
    op.create_index("ix_recommendations_skill_id", "recommendations", ["skill_id"])
    op.create_index("ix_recommendations_status", "recommendations", ["status"])
    op.create_index("ix_recommendations_priority", "recommendations", ["priority"])
    op.create_index("ix_recommendations_generated_at", "recommendations", ["generated_at"])


def downgrade() -> None:
    op.drop_table("recommendations")
    op.drop_table("exercise_attempts")
    op.drop_table("exercise_skills")
    op.drop_table("exercises")
    op.drop_table("mistakes")
    op.drop_table("skill_assessments")
    op.drop_table("student_skills")
    op.drop_index("ix_skills_category", table_name="skills")
    op.drop_column("skills", "category")
