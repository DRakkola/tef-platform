"""Add writing draft revisions, correction items, skills, assignments, and teacher availability overrides.

Revision ID: 0014_writing_and_booking_workflows
Revises: 0013_student_progress_and_skill_intelligence
Create Date: 2026-09-18 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0014_writing_and_booking_workflows"
down_revision: str | None = "0013_student_progress_and_skill_intelligence"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. writing_attempts alterations
    op.add_column(
        "writing_attempts",
        sa.Column(
            "writing_task_version_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("writing_task_versions.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_writing_attempts_task_version_id",
        "writing_attempts",
        ["writing_task_version_id"],
    )
    op.add_column(
        "writing_attempts",
        sa.Column("current_revision", sa.Integer(), nullable=False, server_default="0"),
    )

    # 2. writing_submissions alterations
    op.add_column(
        "writing_submissions",
        sa.Column(
            "writing_task_version_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("writing_task_versions.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_writing_submissions_task_version_id",
        "writing_submissions",
        ["writing_task_version_id"],
    )

    # 3. writing_corrections alterations
    op.add_column(
        "writing_corrections",
        sa.Column("status", sa.String(length=20), nullable=False, server_default="submitted"),
    )
    op.create_index("ix_writing_corrections_status", "writing_corrections", ["status"])
    op.add_column("writing_corrections", sa.Column("task_completion", sa.Float(), nullable=True))
    op.add_column("writing_corrections", sa.Column("coherence", sa.Float(), nullable=True))
    op.add_column("writing_corrections", sa.Column("vocabulary", sa.Float(), nullable=True))
    op.add_column("writing_corrections", sa.Column("grammar", sa.Float(), nullable=True))
    op.add_column("writing_corrections", sa.Column("syntax", sa.Float(), nullable=True))
    op.add_column("writing_corrections", sa.Column("spelling", sa.Float(), nullable=True))
    op.add_column("writing_corrections", sa.Column("register", sa.Float(), nullable=True))

    # 4. writing_draft_revisions table
    op.create_table(
        "writing_draft_revisions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "attempt_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("writing_attempts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("revision_number", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("word_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("attempt_id", "revision_number", name="uq_draft_revision_attempt_number"),
    )
    op.create_index(
        "ix_writing_draft_revisions_attempt_id",
        "writing_draft_revisions",
        ["attempt_id"],
    )

    # 5. writing_correction_items table
    op.create_table(
        "writing_correction_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "correction_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("writing_corrections.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("original_text", sa.Text(), nullable=False),
        sa.Column("corrected_text", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column(
            "skill_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("skills.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_writing_correction_items_correction_id",
        "writing_correction_items",
        ["correction_id"],
    )
    op.create_index(
        "ix_writing_correction_items_category",
        "writing_correction_items",
        ["category"],
    )
    op.create_index(
        "ix_writing_correction_items_skill_id",
        "writing_correction_items",
        ["skill_id"],
    )

    # 6. writing_correction_skills table
    op.create_table(
        "writing_correction_skills",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "correction_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("writing_corrections.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "skill_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("skills.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("level", sa.String(length=20), nullable=False),
        sa.Column("feedback", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_writing_correction_skills_correction_id",
        "writing_correction_skills",
        ["correction_id"],
    )
    op.create_index(
        "ix_writing_correction_skills_skill_id",
        "writing_correction_skills",
        ["skill_id"],
    )

    # 7. writing_assignments table
    op.create_table(
        "writing_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "submission_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("writing_submissions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "teacher_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="assigned"),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_writing_assignments_submission_id",
        "writing_assignments",
        ["submission_id"],
    )
    op.create_index(
        "ix_writing_assignments_teacher_id",
        "writing_assignments",
        ["teacher_id"],
    )
    op.create_index(
        "ix_writing_assignments_status",
        "writing_assignments",
        ["status"],
    )

    # 8. teacher_availability_overrides table
    op.create_table(
        "teacher_availability_overrides",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "teacher_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("teacher_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("override_date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("timezone", sa.String(length=50), nullable=False, server_default="UTC"),
        sa.Column("is_available", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("notes", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_teacher_availability_overrides_teacher_id",
        "teacher_availability_overrides",
        ["teacher_id"],
    )
    op.create_index(
        "ix_teacher_availability_overrides_date",
        "teacher_availability_overrides",
        ["override_date"],
    )
    op.create_index(
        "ix_teacher_override_date",
        "teacher_availability_overrides",
        ["teacher_id", "override_date"],
    )

    # 9. teacher_bookings alterations
    op.add_column(
        "teacher_bookings",
        sa.Column("timezone", sa.String(length=50), nullable=False, server_default="UTC"),
    )
    op.add_column(
        "teacher_bookings",
        sa.Column("payment_status", sa.String(length=20), nullable=False, server_default="unpaid"),
    )
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TABLE teacher_bookings DROP CONSTRAINT IF EXISTS exclude_overlapping_teacher_bookings")
        op.execute("""
            ALTER TABLE teacher_bookings
            ADD CONSTRAINT exclude_overlapping_teacher_bookings
            EXCLUDE USING gist (
                teacher_id WITH =,
                tstzrange(start_time, end_time) WITH &&
            ) WHERE (status NOT IN ('cancelled', 'cancelled_by_student', 'cancelled_by_teacher', 'no_show'));
        """)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TABLE teacher_bookings DROP CONSTRAINT IF EXISTS exclude_overlapping_teacher_bookings")
        op.execute("""
            ALTER TABLE teacher_bookings
            ADD CONSTRAINT exclude_overlapping_teacher_bookings
            EXCLUDE USING gist (
                teacher_id WITH =,
                tstzrange(start_time, end_time) WITH &&
            ) WHERE (status NOT IN ('cancelled', 'no_show'));
        """)
    op.drop_column("teacher_bookings", "payment_status")
    op.drop_column("teacher_bookings", "timezone")

    op.drop_table("teacher_availability_overrides")
    op.drop_table("writing_assignments")
    op.drop_table("writing_correction_skills")
    op.drop_table("writing_correction_items")
    op.drop_table("writing_draft_revisions")

    op.drop_index("ix_writing_corrections_status", table_name="writing_corrections")
    op.drop_column("writing_corrections", "register")
    op.drop_column("writing_corrections", "spelling")
    op.drop_column("writing_corrections", "syntax")
    op.drop_column("writing_corrections", "grammar")
    op.drop_column("writing_corrections", "vocabulary")
    op.drop_column("writing_corrections", "coherence")
    op.drop_column("writing_corrections", "task_completion")
    op.drop_column("writing_corrections", "status")

    op.drop_index("ix_writing_submissions_task_version_id", table_name="writing_submissions")
    op.drop_column("writing_submissions", "writing_task_version_id")

    op.drop_column("writing_attempts", "current_revision")
    op.drop_index("ix_writing_attempts_task_version_id", table_name="writing_attempts")
    op.drop_column("writing_attempts", "writing_task_version_id")
