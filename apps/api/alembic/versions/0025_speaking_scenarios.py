"""Create speaking_scenarios catalog table for authentic oral exam preparation.

Revision ID: 0025_speaking_scenarios
Revises: 0024_speaking_evidence_and_audio
Create Date: 2026-09-27 02:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0025_speaking_scenarios"
down_revision: str | None = "0024_speaking_evidence_and_audio"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "speaking_scenarios",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("section", sa.String(length=50), nullable=False),
        sa.Column("target_level", sa.String(length=10), server_default="B2", nullable=False),
        sa.Column("difficulty", sa.String(length=50), server_default="standard", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("document_title", sa.String(length=255), nullable=False),
        sa.Column("document_content", sa.Text(), nullable=False),
        sa.Column("document_image_url", sa.String(length=500), nullable=True),
        sa.Column("role_title", sa.String(length=100), nullable=False),
        sa.Column("persona_name", sa.String(length=100), nullable=False),
        sa.Column("voice_persona", sa.String(length=50), server_default="Aoede", nullable=False),
        sa.Column("register", sa.String(length=20), server_default="formal", nullable=False),
        sa.Column("temperament", sa.Text(), nullable=True),
        sa.Column("scepticism_level", sa.Float(), server_default="0.5", nullable=False),
        sa.Column("known_facts", postgresql.JSON(astext_type=sa.Text()), server_default="[]", nullable=False),
        sa.Column("omitted_facts", postgresql.JSON(astext_type=sa.Text()), server_default="[]", nullable=False),
        sa.Column("objection_cards", postgresql.JSON(astext_type=sa.Text()), server_default="[]", nullable=False),
        sa.Column("scope_description", sa.Text(), nullable=True),
        sa.Column("forbidden_topics", postgresql.JSON(astext_type=sa.Text()), server_default="[]", nullable=False),
        sa.Column("redirection_phrases", postgresql.JSON(astext_type=sa.Text()), server_default="[]", nullable=False),
        sa.Column("custom_instructions", sa.Text(), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index(op.f("ix_speaking_scenarios_code"), "speaking_scenarios", ["code"], unique=True)
    op.create_index(op.f("ix_speaking_scenarios_section"), "speaking_scenarios", ["section"], unique=False)
    op.create_index(op.f("ix_speaking_scenarios_is_active"), "speaking_scenarios", ["is_active"], unique=False)
    op.create_index(
        "ix_speaking_scenarios_section_level",
        "speaking_scenarios",
        ["section", "target_level"],
        unique=False,
    )
    op.create_index(
        "ix_speaking_scenarios_active_section",
        "speaking_scenarios",
        ["is_active", "section"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_speaking_scenarios_active_section", table_name="speaking_scenarios")
    op.drop_index("ix_speaking_scenarios_section_level", table_name="speaking_scenarios")
    op.drop_index(op.f("ix_speaking_scenarios_is_active"), table_name="speaking_scenarios")
    op.drop_index(op.f("ix_speaking_scenarios_section"), table_name="speaking_scenarios")
    op.drop_index(op.f("ix_speaking_scenarios_code"), table_name="speaking_scenarios")
    op.drop_table("speaking_scenarios")
