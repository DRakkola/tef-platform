"""Create assessment engine tables: skills, assessments, sections, questions, options, tags, attempts, answers, and scores.

Revision ID: 0003_assessment_engine
Revises: 0002_auth_and_users
Create Date: 2026-09-17 15:35:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003_assessment_engine"
down_revision: str | None = "0002_auth_and_users"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. skills table
    op.create_table(
        "skills",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "parent_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("skills.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_skills_id", "skills", ["id"])
    op.create_index("ix_skills_code", "skills", ["code"], unique=True)
    op.create_index("ix_skills_parent_id", "skills", ["parent_id"])

    # 2. assessments table
    op.create_table(
        "assessments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("assessment_type", sa.String(length=50), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=False),
        sa.Column("navigation_policy", sa.String(length=50), nullable=False, server_default="free"),
        sa.Column(
            "scoring_policy", sa.String(length=50), nullable=False, server_default="standard_points"
        ),
        sa.Column("max_attempts", sa.Integer(), nullable=True),
        sa.Column("pass_percentage", sa.Float(), nullable=True),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_assessments_id", "assessments", ["id"])
    op.create_index("ix_assessments_assessment_type", "assessments", ["assessment_type"])
    op.create_index("ix_assessments_is_published", "assessments", ["is_published"])

    # 3. assessment_sections table
    op.create_table(
        "assessment_sections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "assessment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("assessments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("media_url", sa.String(length=512), nullable=True),
        sa.Column("passage_text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_assessment_sections_id", "assessment_sections", ["id"])
    op.create_index(
        "ix_assessment_sections_assessment_id", "assessment_sections", ["assessment_id"]
    )

    # 4. questions table
    op.create_table(
        "questions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "section_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("assessment_sections.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column(
            "question_type", sa.String(length=50), nullable=False, server_default="single_choice"
        ),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("level", sa.String(length=10), nullable=False, server_default="B1"),
        sa.Column("difficulty", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("points", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("penalty_points", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("media_url", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_questions_id", "questions", ["id"])
    op.create_index("ix_questions_section_id", "questions", ["section_id"])

    # 5. question_options table
    op.create_table(
        "question_options",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "question_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("questions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_correct", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_question_options_id", "question_options", ["id"])
    op.create_index("ix_question_options_question_id", "question_options", ["question_id"])

    # 6. question_skill_tags table
    op.create_table(
        "question_skill_tags",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "question_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("questions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "skill_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("skills.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("subskill", sa.String(length=100), nullable=True),
        sa.Column("weight", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_question_skill_tags_id", "question_skill_tags", ["id"])
    op.create_index("ix_question_skill_tags_question_id", "question_skill_tags", ["question_id"])
    op.create_index("ix_question_skill_tags_skill_id", "question_skill_tags", ["skill_id"])

    # 7. attempts table
    op.create_table(
        "attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "assessment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("assessments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="created"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_attempts_id", "attempts", ["id"])
    op.create_index("ix_attempts_assessment_id", "attempts", ["assessment_id"])
    op.create_index("ix_attempts_user_id", "attempts", ["user_id"])
    op.create_index("ix_attempts_status", "attempts", ["status"])
    op.create_index("ix_attempts_expires_at", "attempts", ["expires_at"])

    # 8. attempt_answers table
    op.create_table(
        "attempt_answers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "attempt_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("attempts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "question_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("questions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "selected_option_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("question_options.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("selected_option_ids", sa.JSON(), nullable=False),
        sa.Column("text_response", sa.Text(), nullable=True),
        sa.Column("is_correct", sa.Boolean(), nullable=True),
        sa.Column("points_awarded", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("answered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("attempt_id", "question_id", name="uq_attempt_question_answer"),
    )
    op.create_index("ix_attempt_answers_id", "attempt_answers", ["id"])
    op.create_index("ix_attempt_answers_attempt_id", "attempt_answers", ["attempt_id"])
    op.create_index("ix_attempt_answers_question_id", "attempt_answers", ["question_id"])

    # 9. attempt_scores table
    op.create_table(
        "attempt_scores",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "attempt_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("attempts.id", ondelete="CASCADE"),
            unique=True,
            nullable=False,
        ),
        sa.Column("total_points", sa.Float(), nullable=False),
        sa.Column("max_points", sa.Float(), nullable=False),
        sa.Column("percentage", sa.Float(), nullable=False),
        sa.Column("is_passed", sa.Boolean(), nullable=True),
        sa.Column("estimated_level", sa.String(length=10), nullable=True),
        sa.Column("skill_scores", sa.JSON(), nullable=False),
        sa.Column("scored_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_attempt_scores_id", "attempt_scores", ["id"])
    op.create_index("ix_attempt_scores_attempt_id", "attempt_scores", ["attempt_id"], unique=True)


def downgrade() -> None:
    op.drop_table("attempt_scores")
    op.drop_table("attempt_answers")
    op.drop_table("attempts")
    op.drop_table("question_skill_tags")
    op.drop_table("question_options")
    op.drop_table("questions")
    op.drop_table("assessment_sections")
    op.drop_table("assessments")
    op.drop_table("skills")
