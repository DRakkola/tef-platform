"""Add speaking turns evidence fields, unique constraints, and exam evaluation fields.

Revision ID: 0024_speaking_evidence_and_audio
Revises: 0023_speaking_exam_hierarchy
Create Date: 2026-09-26 12:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0024_speaking_evidence_and_audio"
down_revision: str | None = "0023_speaking_exam_hierarchy"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Enhance speaking_turns with audio evidence and metadata
    op.add_column(
        "speaking_turns",
        sa.Column(
            "transcript_status",
            sa.String(length=32),
            server_default="completed",
            nullable=False,
        ),
    )
    op.create_index("ix_speaking_turns_transcript_status", "speaking_turns", ["transcript_status"])

    op.add_column(
        "speaking_turns",
        sa.Column("audio_storage_key", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "speaking_turns",
        sa.Column("audio_duration_seconds", sa.Float(), nullable=True),
    )
    op.add_column(
        "speaking_turns",
        sa.Column("interrupted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.add_column(
        "speaking_turns",
        sa.Column("interruption_reason", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "speaking_turns",
        sa.Column("transcription_confidence", sa.Float(), nullable=True),
    )
    op.add_column(
        "speaking_turns",
        sa.Column("turn_metadata", sa.JSON(), nullable=True),
    )

    # Copy existing audio_key and duration_seconds data if any exists
    op.execute(
        "UPDATE speaking_turns SET audio_storage_key = audio_key WHERE audio_key IS NOT NULL"
    )
    op.execute(
        "UPDATE speaking_turns SET audio_duration_seconds = duration_seconds WHERE duration_seconds IS NOT NULL"
    )

    # Add unique constraints for race-safe turn ordering & client turn idempotency
    op.create_unique_constraint(
        "uq_speaking_turns_section_turn",
        "speaking_turns",
        ["section_id", "turn_number"],
    )
    op.create_unique_constraint(
        "uq_speaking_turns_section_client_turn_id",
        "speaking_turns",
        ["section_id", "client_turn_id"],
    )

    # 2. Enhance speaking_evaluations with exam link, evaluator model, and evidence snapshot
    op.add_column(
        "speaking_evaluations",
        sa.Column(
            "exam_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("speaking_exams.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    op.create_index("ix_speaking_evaluations_exam_id", "speaking_evaluations", ["exam_id"])

    op.add_column(
        "speaking_evaluations",
        sa.Column("evaluator_model", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "speaking_evaluations",
        sa.Column("evaluation_version", sa.String(length=32), server_default="v1", nullable=True),
    )
    op.add_column(
        "speaking_evaluations",
        sa.Column("evaluation_prompt", sa.Text(), nullable=True),
    )
    op.add_column(
        "speaking_evaluations",
        sa.Column("evidence_snapshot", sa.JSON(), nullable=True),
    )

    # Make session_id nullable so evaluations can be tied directly to exams
    op.alter_column(
        "speaking_evaluations",
        "session_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True,
    )


def downgrade() -> None:
    # speaking_evaluations
    op.alter_column(
        "speaking_evaluations",
        "session_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
    )
    op.drop_column("speaking_evaluations", "evidence_snapshot")
    op.drop_column("speaking_evaluations", "evaluation_prompt")
    op.drop_column("speaking_evaluations", "evaluation_version")
    op.drop_column("speaking_evaluations", "evaluator_model")
    op.drop_index("ix_speaking_evaluations_exam_id", table_name="speaking_evaluations")
    op.drop_column("speaking_evaluations", "exam_id")

    # speaking_turns
    op.drop_constraint("uq_speaking_turns_section_client_turn_id", "speaking_turns", type_="unique")
    op.drop_constraint("uq_speaking_turns_section_turn", "speaking_turns", type_="unique")
    op.drop_column("speaking_turns", "turn_metadata")
    op.drop_column("speaking_turns", "transcription_confidence")
    op.drop_column("speaking_turns", "interruption_reason")
    op.drop_column("speaking_turns", "interrupted")
    op.drop_column("speaking_turns", "audio_duration_seconds")
    op.drop_column("speaking_turns", "audio_storage_key")
    op.drop_index("ix_speaking_turns_transcript_status", table_name="speaking_turns")
    op.drop_column("speaking_turns", "transcript_status")
