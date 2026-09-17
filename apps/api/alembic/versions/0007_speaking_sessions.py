"""Create speaking session tables: speaking_sessions, speaking_participants, speaking_evaluations, and speaking_evaluation_skills.

Revision ID: 0007_speaking_sessions
Revises: 0006_teacher_booking
Create Date: 2026-09-17 19:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0007_speaking_sessions"
down_revision: str | None = "0006_teacher_booking"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. speaking_sessions table
    op.create_table(
        "speaking_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("session_type", sa.String(length=50), nullable=False, server_default="ai"),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="scheduled"),
        sa.Column("topic", sa.String(length=255), nullable=False),
        sa.Column("level", sa.String(length=10), nullable=False, server_default="B2"),
        sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default="25"),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("room_id", sa.String(length=64), nullable=False),
        sa.Column(
            "booking_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("teacher_bookings.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_speaking_sessions_id", "speaking_sessions", ["id"])
    op.create_index("ix_speaking_sessions_session_type", "speaking_sessions", ["session_type"])
    op.create_index("ix_speaking_sessions_status", "speaking_sessions", ["status"])
    op.create_index("ix_speaking_sessions_starts_at", "speaking_sessions", ["starts_at"])
    op.create_index("ix_speaking_sessions_expires_at", "speaking_sessions", ["expires_at"])
    op.create_index("ix_speaking_sessions_room_id", "speaking_sessions", ["room_id"], unique=True)
    op.create_index("ix_speaking_sessions_booking_id", "speaking_sessions", ["booking_id"])
    op.create_index(
        "ix_speaking_sessions_created_by_user_id", "speaking_sessions", ["created_by_user_id"]
    )
    op.create_index(
        "ix_speaking_sessions_status_expires", "speaking_sessions", ["status", "expires_at"]
    )

    # 2. speaking_participants table
    op.create_table(
        "speaking_participants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("speaking_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column("display_name", sa.String(length=100), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("left_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_connected", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("connection_id", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_speaking_participants_id", "speaking_participants", ["id"])
    op.create_index("ix_speaking_participants_session_id", "speaking_participants", ["session_id"])
    op.create_index("ix_speaking_participants_user_id", "speaking_participants", ["user_id"])
    op.create_index("ix_speaking_participants_role", "speaking_participants", ["role"])
    op.create_index(
        "ix_speaking_participants_session_user",
        "speaking_participants",
        ["session_id", "user_id"],
    )

    # 3. speaking_evaluations table
    op.create_table(
        "speaking_evaluations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("speaking_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "student_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "evaluator_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("evaluator_type", sa.String(length=50), nullable=False, server_default="mock"),
        sa.Column("estimated_level", sa.String(length=10), nullable=False, server_default="B2"),
        sa.Column("fluency", sa.Float(), nullable=False),
        sa.Column("vocabulary", sa.Float(), nullable=False),
        sa.Column("grammar", sa.Float(), nullable=False),
        sa.Column("coherence", sa.Float(), nullable=False),
        sa.Column("pronunciation", sa.Float(), nullable=False),
        sa.Column("overall_score", sa.Float(), nullable=False),
        sa.Column("strengths", sa.JSON(), nullable=False),
        sa.Column("weaknesses", sa.JSON(), nullable=False),
        sa.Column("recommendations", sa.JSON(), nullable=False),
        sa.Column("detailed_feedback", sa.Text(), nullable=True),
        sa.Column("is_official_tef", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_speaking_evaluations_id", "speaking_evaluations", ["id"])
    op.create_index(
        "ix_speaking_evaluations_session_id", "speaking_evaluations", ["session_id"], unique=True
    )
    op.create_index("ix_speaking_evaluations_student_id", "speaking_evaluations", ["student_id"])
    op.create_index(
        "ix_speaking_evaluations_evaluator_user_id",
        "speaking_evaluations",
        ["evaluator_user_id"],
    )

    # 4. speaking_evaluation_skills table
    op.create_table(
        "speaking_evaluation_skills",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "evaluation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("speaking_evaluations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "skill_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("skills.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_speaking_evaluation_skills_id", "speaking_evaluation_skills", ["id"])
    op.create_index(
        "ix_speaking_evaluation_skills_evaluation_id",
        "speaking_evaluation_skills",
        ["evaluation_id"],
    )
    op.create_index(
        "ix_speaking_evaluation_skills_skill_id",
        "speaking_evaluation_skills",
        ["skill_id"],
    )
    op.create_index(
        "ix_speaking_eval_skills_eval_skill",
        "speaking_evaluation_skills",
        ["evaluation_id", "skill_id"],
    )


def downgrade() -> None:
    op.drop_table("speaking_evaluation_skills")
    op.drop_table("speaking_evaluations")
    op.drop_table("speaking_participants")
    op.drop_table("speaking_sessions")
