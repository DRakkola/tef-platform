"""Create Content Studio versioning, subskills, and content review tables.

Revision ID: 0011_content_studio_versioning
Revises: 0010_exercise_skill_weight
Create Date: 2026-09-18 01:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0011_content_studio_versioning"
down_revision: str | None = "0010_exercise_skill_weight"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. sub_skills table
    op.create_table(
        "sub_skills",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("skill_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("skills.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("code", sa.String(100), nullable=False, unique=True, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_sub_skills_id", "sub_skills", ["id"])

    # 2. Add author & versioning columns to publishable tables if not present
    # assessments
    op.add_column("assessments", sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True))
    op.add_column("assessments", sa.Column("updated_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True))

    # questions
    op.add_column("questions", sa.Column("status", sa.String(20), nullable=False, server_default="published"))
    op.add_column("questions", sa.Column("version", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("questions", sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True))
    op.add_column("questions", sa.Column("updated_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True))

    # exercises
    op.add_column("exercises", sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True))
    op.add_column("exercises", sa.Column("updated_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True))

    # writing_tasks
    op.add_column("writing_tasks", sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True))
    op.add_column("writing_tasks", sa.Column("updated_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True))

    # media_assets
    op.add_column("media_assets", sa.Column("bucket", sa.String(100), nullable=False, server_default="tef-private"))
    op.add_column("media_assets", sa.Column("checksum", sa.String(64), nullable=True))
    op.add_column("media_assets", sa.Column("duration_seconds", sa.Float(), nullable=True))

    # 3. assessment_versions table
    op.create_table(
        "assessment_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("assessment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("assessment_type", sa.String(50), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=False),
        sa.Column("navigation_policy", sa.String(50), nullable=False),
        sa.Column("scoring_policy", sa.String(50), nullable=False),
        sa.Column("pass_percentage", sa.Float(), nullable=True),
        sa.Column("sections_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("assessment_id", "version", name="uq_assessment_version"),
    )
    op.create_index("ix_assessment_versions_id", "assessment_versions", ["id"])

    # 4. question_versions table
    op.create_table(
        "question_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("question_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("question_type", sa.String(50), nullable=False),
        sa.Column("difficulty", sa.Integer(), nullable=False),
        sa.Column("level", sa.String(10), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("options_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("media_asset_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("question_id", "version", name="uq_question_version"),
    )
    op.create_index("ix_question_versions_id", "question_versions", ["id"])

    # 5. exercise_versions table
    op.create_table(
        "exercise_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("exercise_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("level", sa.String(10), nullable=False),
        sa.Column("difficulty", sa.Integer(), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("options_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("exercise_id", "version", name="uq_exercise_version"),
    )
    op.create_index("ix_exercise_versions_id", "exercise_versions", ["id"])

    # 6. writing_task_versions table
    op.create_table(
        "writing_task_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("writing_task_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("writing_tasks.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("task_type", sa.String(50), nullable=False),
        sa.Column("level", sa.String(10), nullable=False),
        sa.Column("min_words", sa.Integer(), nullable=False),
        sa.Column("max_words", sa.Integer(), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("evaluation_criteria", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("writing_task_id", "version", name="uq_writing_task_version"),
    )
    op.create_index("ix_writing_task_versions_id", "writing_task_versions", ["id"])

    # 7. content_reviews table
    op.create_table(
        "content_reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("entity_type", sa.String(50), nullable=False, index=True),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("reviewer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending", index=True),
        sa.Column("comments", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_content_reviews_id", "content_reviews", ["id"])


def downgrade() -> None:
    op.drop_table("content_reviews")
    op.drop_table("writing_task_versions")
    op.drop_table("exercise_versions")
    op.drop_table("question_versions")
    op.drop_table("assessment_versions")

    op.drop_column("media_assets", "duration_seconds")
    op.drop_column("media_assets", "checksum")
    op.drop_column("media_assets", "bucket")

    op.drop_column("writing_tasks", "updated_by_user_id")
    op.drop_column("writing_tasks", "created_by_user_id")

    op.drop_column("exercises", "updated_by_user_id")
    op.drop_column("exercises", "created_by_user_id")

    op.drop_column("questions", "updated_by_user_id")
    op.drop_column("questions", "created_by_user_id")
    op.drop_column("questions", "version")
    op.drop_column("questions", "status")

    op.drop_column("assessments", "updated_by_user_id")
    op.drop_column("assessments", "created_by_user_id")

    op.drop_table("sub_skills")
