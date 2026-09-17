"""Create teacher marketplace tables: teacher_availability_rules, teacher_availability_exceptions, and teacher_bookings.

Revision ID: 0006_teacher_booking
Revises: 0005_writing_assessment
Create Date: 2026-09-17 18:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0006_teacher_booking"
down_revision: str | None = "0005_writing_assessment"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Add timezone column to teacher_profiles
    op.add_column(
        "teacher_profiles",
        sa.Column("timezone", sa.String(length=50), nullable=False, server_default="UTC"),
    )

    # 2. teacher_availability_rules table
    op.create_table(
        "teacher_availability_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "teacher_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("teacher_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("weekday", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("timezone", sa.String(length=50), nullable=False, server_default="UTC"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_teacher_availability_rules_id", "teacher_availability_rules", ["id"])
    op.create_index(
        "ix_teacher_availability_rules_teacher_id", "teacher_availability_rules", ["teacher_id"]
    )
    op.create_index(
        "ix_teacher_availability_rules_weekday", "teacher_availability_rules", ["weekday"]
    )
    op.create_index(
        "ix_teacher_availability_rules_is_active", "teacher_availability_rules", ["is_active"]
    )
    op.create_index(
        "ix_teacher_rules_weekday_active",
        "teacher_availability_rules",
        ["teacher_id", "weekday", "is_active"],
    )

    # 3. teacher_availability_exceptions table
    op.create_table(
        "teacher_availability_exceptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "teacher_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("teacher_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("exception_date", sa.Date(), nullable=False),
        sa.Column("is_unavailable", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("start_time", sa.Time(), nullable=True),
        sa.Column("end_time", sa.Time(), nullable=True),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_teacher_availability_exceptions_id", "teacher_availability_exceptions", ["id"]
    )
    op.create_index(
        "ix_teacher_availability_exceptions_teacher_id",
        "teacher_availability_exceptions",
        ["teacher_id"],
    )
    op.create_index(
        "ix_teacher_availability_exceptions_exception_date",
        "teacher_availability_exceptions",
        ["exception_date"],
    )
    op.create_index(
        "ix_teacher_exception_date",
        "teacher_availability_exceptions",
        ["teacher_id", "exception_date"],
    )

    # 4. teacher_bookings table
    op.create_table(
        "teacher_bookings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "teacher_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("teacher_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "student_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="confirmed"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("cancellation_reason", sa.String(length=500), nullable=True),
        sa.Column(
            "cancelled_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("meeting_link", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_teacher_bookings_id", "teacher_bookings", ["id"])
    op.create_index("ix_teacher_bookings_teacher_id", "teacher_bookings", ["teacher_id"])
    op.create_index("ix_teacher_bookings_student_id", "teacher_bookings", ["student_id"])
    op.create_index("ix_teacher_bookings_start_time", "teacher_bookings", ["start_time"])
    op.create_index("ix_teacher_bookings_end_time", "teacher_bookings", ["end_time"])
    op.create_index("ix_teacher_bookings_status", "teacher_bookings", ["status"])
    op.create_index(
        "ix_bookings_teacher_times",
        "teacher_bookings",
        ["teacher_id", "start_time", "end_time"],
    )
    op.create_index(
        "ix_bookings_student_times",
        "teacher_bookings",
        ["student_id", "start_time", "end_time"],
    )
    op.create_index(
        "ix_bookings_teacher_status",
        "teacher_bookings",
        ["teacher_id", "status"],
    )

    # 5. PostgreSQL-specific Exclusion Constraint using btree_gist for overlap prevention
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
        op.execute("""
            ALTER TABLE teacher_bookings
            ADD CONSTRAINT exclude_overlapping_teacher_bookings
            EXCLUDE USING gist (
                teacher_id WITH =,
                tstzrange(start_time, end_time) WITH &&
            ) WHERE (status NOT IN ('cancelled', 'no_show'));
        """)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            "ALTER TABLE teacher_bookings DROP CONSTRAINT IF EXISTS exclude_overlapping_teacher_bookings"
        )

    op.drop_table("teacher_bookings")
    op.drop_table("teacher_availability_exceptions")
    op.drop_table("teacher_availability_rules")
    op.drop_column("teacher_profiles", "timezone")
