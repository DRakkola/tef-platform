"""Create writing assessment tables: writing_tasks, writing_attempts, writing_submissions, and writing_corrections.

Revision ID: 0005_writing_assessment
Revises: 0004_learning_intelligence
Create Date: 2026-09-17 17:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0005_writing_assessment"
down_revision: str | None = "0004_learning_intelligence"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. writing_tasks table
    op.create_table(
        "writing_tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("task_type", sa.String(length=50), nullable=False, server_default="section_a"),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("stimulus_text", sa.Text(), nullable=True),
        sa.Column("min_words", sa.Integer(), nullable=False, server_default="80"),
        sa.Column("max_words", sa.Integer(), nullable=False, server_default="120"),
        sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("target_level", sa.String(length=20), nullable=False, server_default="B2"),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_writing_tasks_id", "writing_tasks", ["id"])
    op.create_index("ix_writing_tasks_task_type", "writing_tasks", ["task_type"])
    op.create_index("ix_writing_tasks_is_published", "writing_tasks", ["is_published"])

    # 2. writing_attempts table
    op.create_table(
        "writing_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "task_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("writing_tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="draft"),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("word_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_writing_attempts_id", "writing_attempts", ["id"])
    op.create_index("ix_writing_attempts_task_id", "writing_attempts", ["task_id"])
    op.create_index("ix_writing_attempts_user_id", "writing_attempts", ["user_id"])
    op.create_index("ix_writing_attempts_status", "writing_attempts", ["status"])

    # 3. writing_submissions table
    op.create_table(
        "writing_submissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "attempt_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("writing_attempts.id", ondelete="CASCADE"),
            unique=True,
            nullable=False,
        ),
        sa.Column(
            "task_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("writing_tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "assigned_teacher_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="submitted"),
        sa.Column("word_count", sa.Integer(), nullable=False),
        sa.Column("storage_object_key", sa.String(length=500), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_writing_submissions_id", "writing_submissions", ["id"])
    op.create_index("ix_writing_submissions_attempt_id", "writing_submissions", ["attempt_id"])
    op.create_index("ix_writing_submissions_task_id", "writing_submissions", ["task_id"])
    op.create_index("ix_writing_submissions_user_id", "writing_submissions", ["user_id"])
    op.create_index(
        "ix_writing_submissions_assigned_teacher_id",
        "writing_submissions",
        ["assigned_teacher_id"],
    )
    op.create_index("ix_writing_submissions_status", "writing_submissions", ["status"])
    op.create_index("ix_writing_submissions_submitted_at", "writing_submissions", ["submitted_at"])

    # 4. writing_corrections table
    op.create_table(
        "writing_corrections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "submission_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("writing_submissions.id", ondelete="CASCADE"),
            unique=True,
            nullable=False,
        ),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column(
            "corrected_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("estimated_level", sa.String(length=20), nullable=False),
        sa.Column(
            "strengths",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "weaknesses",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("comments", sa.Text(), nullable=False),
        sa.Column("corrected_content", sa.Text(), nullable=True),
        sa.Column(
            "recommendations",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_writing_corrections_id", "writing_corrections", ["id"])
    op.create_index(
        "ix_writing_corrections_submission_id", "writing_corrections", ["submission_id"]
    )
    op.create_index("ix_writing_corrections_provider", "writing_corrections", ["provider"])
    op.create_index(
        "ix_writing_corrections_corrected_by_user_id",
        "writing_corrections",
        ["corrected_by_user_id"],
    )


def downgrade() -> None:
    op.drop_table("writing_corrections")
    op.drop_table("writing_submissions")
    op.drop_table("writing_attempts")
    op.drop_table("writing_tasks")
