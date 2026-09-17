"""Create practice pool tables: practice_queue_entries, practice_requests, practice_matches, practice_sessions, practice_reports, and practice_blocks.

Revision ID: 0008_practice_pool
Revises: 0007_speaking_sessions
Create Date: 2026-09-17 20:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0008_practice_pool"
down_revision: str | None = "0007_speaking_sessions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. practice_queue_entries
    op.create_table(
        "practice_queue_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("language", sa.String(length=10), nullable=False, server_default="fr"),
        sa.Column("level", sa.String(length=10), nullable=False, server_default="B2"),
        sa.Column(
            "practice_type",
            sa.String(length=50),
            nullable=False,
            server_default="free_conversation",
        ),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="waiting"),
        sa.Column("anonymous_alias", sa.String(length=100), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("left_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_practice_queue_entries_id", "practice_queue_entries", ["id"])
    op.create_index("ix_practice_queue_entries_user_id", "practice_queue_entries", ["user_id"])
    op.create_index("ix_practice_queue_entries_language", "practice_queue_entries", ["language"])
    op.create_index("ix_practice_queue_entries_level", "practice_queue_entries", ["level"])
    op.create_index(
        "ix_practice_queue_entries_practice_type", "practice_queue_entries", ["practice_type"]
    )
    op.create_index("ix_practice_queue_entries_status", "practice_queue_entries", ["status"])
    op.create_index("ix_practice_queue_entries_joined_at", "practice_queue_entries", ["joined_at"])
    op.create_index(
        "ix_practice_queue_status_lang_level",
        "practice_queue_entries",
        ["status", "language", "level"],
    )

    # 2. practice_requests
    op.create_table(
        "practice_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "sender_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "receiver_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("sender_alias", sa.String(length=100), nullable=False),
        sa.Column("receiver_alias", sa.String(length=100), nullable=False),
        sa.Column("language", sa.String(length=10), nullable=False, server_default="fr"),
        sa.Column("level", sa.String(length=10), nullable=False, server_default="B2"),
        sa.Column(
            "practice_type",
            sa.String(length=50),
            nullable=False,
            server_default="free_conversation",
        ),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_practice_requests_id", "practice_requests", ["id"])
    op.create_index("ix_practice_requests_sender_id", "practice_requests", ["sender_id"])
    op.create_index("ix_practice_requests_receiver_id", "practice_requests", ["receiver_id"])
    op.create_index("ix_practice_requests_status", "practice_requests", ["status"])
    op.create_index("ix_practice_requests_expires_at", "practice_requests", ["expires_at"])
    op.create_index(
        "ix_practice_requests_receiver_status", "practice_requests", ["receiver_id", "status"]
    )
    op.create_index(
        "ix_practice_requests_sender_status", "practice_requests", ["sender_id", "status"]
    )

    # 3. practice_matches
    op.create_table(
        "practice_matches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "request_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("practice_requests.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "student_a_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "student_b_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("student_a_alias", sa.String(length=100), nullable=False),
        sa.Column("student_b_alias", sa.String(length=100), nullable=False),
        sa.Column("language", sa.String(length=10), nullable=False, server_default="fr"),
        sa.Column("level", sa.String(length=10), nullable=False, server_default="B2"),
        sa.Column(
            "practice_type",
            sa.String(length=50),
            nullable=False,
            server_default="free_conversation",
        ),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="matched"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_practice_matches_id", "practice_matches", ["id"])
    op.create_index("ix_practice_matches_request_id", "practice_matches", ["request_id"])
    op.create_index("ix_practice_matches_student_a_id", "practice_matches", ["student_a_id"])
    op.create_index("ix_practice_matches_student_b_id", "practice_matches", ["student_b_id"])
    op.create_index("ix_practice_matches_status", "practice_matches", ["status"])

    # 4. practice_sessions
    op.create_table(
        "practice_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "match_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("practice_matches.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("room_id", sa.String(length=64), nullable=False),
        sa.Column(
            "student_a_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "student_b_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("student_a_alias", sa.String(length=100), nullable=False),
        sa.Column("student_b_alias", sa.String(length=100), nullable=False),
        sa.Column(
            "student_a_connected", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
        sa.Column(
            "student_b_connected", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
        sa.Column("language", sa.String(length=10), nullable=False, server_default="fr"),
        sa.Column("level", sa.String(length=10), nullable=False, server_default="B2"),
        sa.Column(
            "practice_type",
            sa.String(length=50),
            nullable=False,
            server_default="free_conversation",
        ),
        sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default="15"),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="active"),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("audio_only", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_practice_sessions_id", "practice_sessions", ["id"])
    op.create_index("ix_practice_sessions_match_id", "practice_sessions", ["match_id"], unique=True)
    op.create_index("ix_practice_sessions_room_id", "practice_sessions", ["room_id"], unique=True)
    op.create_index("ix_practice_sessions_student_a_id", "practice_sessions", ["student_a_id"])
    op.create_index("ix_practice_sessions_student_b_id", "practice_sessions", ["student_b_id"])
    op.create_index("ix_practice_sessions_status", "practice_sessions", ["status"])
    op.create_index("ix_practice_sessions_starts_at", "practice_sessions", ["starts_at"])
    op.create_index("ix_practice_sessions_expires_at", "practice_sessions", ["expires_at"])
    op.create_index(
        "ix_practice_sessions_status_expires", "practice_sessions", ["status", "expires_at"]
    )
    op.create_index(
        "ix_practice_sessions_student_a_status", "practice_sessions", ["student_a_id", "status"]
    )
    op.create_index(
        "ix_practice_sessions_student_b_status", "practice_sessions", ["student_b_id", "status"]
    )

    # 5. practice_reports
    op.create_table(
        "practice_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "reporter_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "reported_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("practice_sessions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("reason", sa.String(length=50), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_practice_reports_id", "practice_reports", ["id"])
    op.create_index("ix_practice_reports_reporter_id", "practice_reports", ["reporter_id"])
    op.create_index(
        "ix_practice_reports_reported_user_id", "practice_reports", ["reported_user_id"]
    )
    op.create_index("ix_practice_reports_session_id", "practice_reports", ["session_id"])
    op.create_index("ix_practice_reports_reason", "practice_reports", ["reason"])

    # 6. practice_blocks
    op.create_table(
        "practice_blocks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "blocked_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "blocked_user_id", name="uq_practice_blocks_user_blocked"),
    )
    op.create_index("ix_practice_blocks_id", "practice_blocks", ["id"])
    op.create_index("ix_practice_blocks_user_id", "practice_blocks", ["user_id"])
    op.create_index("ix_practice_blocks_blocked_user_id", "practice_blocks", ["blocked_user_id"])
    op.create_index(
        "ix_practice_blocks_user_blocked", "practice_blocks", ["user_id", "blocked_user_id"]
    )


def downgrade() -> None:
    op.drop_table("practice_blocks")
    op.drop_table("practice_reports")
    op.drop_table("practice_sessions")
    op.drop_table("practice_matches")
    op.drop_table("practice_requests")
    op.drop_table("practice_queue_entries")
