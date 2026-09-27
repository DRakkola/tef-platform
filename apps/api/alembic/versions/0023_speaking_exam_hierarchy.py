"""Create speaking_exams, speaking_sections, and speaking_turns tables.

Revision ID: 0023_speaking_exam_hierarchy
Revises: 0022_speaking_examiner_configs
Create Date: 2026-09-26 11:35:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0023_speaking_exam_hierarchy"
down_revision: str | None = "0022_speaking_examiner_configs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Create speaking_exams table
    op.create_table(
        "speaking_exams",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "student_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("speaking_sessions.id", ondelete="SET NULL"),
            nullable=True,
            unique=True,
            index=True,
        ),
        sa.Column("status", sa.String(length=32), server_default="created", nullable=False, index=True),
        sa.Column("current_section_type", sa.String(length=32), server_default="section_a", nullable=True, index=True),
        sa.Column("topic", sa.String(length=255), server_default="TEF Expression Orale — Épreuve Officielle Simulée", nullable=False),
        sa.Column("target_level", sa.String(length=10), server_default="B2", nullable=False),
        sa.Column("total_duration_minutes", sa.Integer(), server_default="25", nullable=False),
        sa.Column("config_version", sa.String(length=32), server_default="v1", nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True, index=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "evaluation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("speaking_evaluations.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index(
        "ix_speaking_exams_student_status",
        "speaking_exams",
        ["student_id", "status"],
    )

    # 2. Create speaking_sections table
    op.create_table(
        "speaking_sections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "exam_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("speaking_exams.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("section_type", sa.String(length=32), nullable=False, index=True),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("prompt_topic", sa.String(length=255), nullable=False),
        sa.Column("prompt_context", sa.Text(), nullable=True),
        sa.Column("examiner_persona", sa.String(length=64), server_default="Aoede", nullable=False),
        sa.Column("system_prompt", sa.Text(), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), server_default="600", nullable=False),
        sa.Column("status", sa.String(length=32), server_default="pending", nullable=False, index=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True, index=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True, index=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("exam_id", "sequence", name="uq_speaking_sections_exam_sequence"),
        sa.UniqueConstraint("exam_id", "section_type", name="uq_speaking_sections_exam_type"),
    )
    op.create_index(
        "ix_speaking_sections_status_expires",
        "speaking_sections",
        ["status", "expires_at"],
    )

    # 3. Create speaking_turns table
    op.create_table(
        "speaking_turns",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "section_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("speaking_sections.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("turn_number", sa.Integer(), nullable=False),
        sa.Column("speaker", sa.String(length=32), nullable=False, index=True),
        sa.Column("state", sa.String(length=32), server_default="completed", nullable=False),
        sa.Column("content_text", sa.Text(), nullable=True),
        sa.Column("audio_key", sa.String(length=255), nullable=True),
        sa.Column("duration_seconds", sa.Float(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("client_turn_id", sa.String(length=64), nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index(
        "ix_speaking_turns_section_order",
        "speaking_turns",
        ["section_id", "turn_number"],
    )


def downgrade() -> None:
    op.drop_table("speaking_turns")
    op.drop_table("speaking_sections")
    op.drop_table("speaking_exams")
