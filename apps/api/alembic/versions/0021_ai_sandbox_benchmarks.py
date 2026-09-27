"""Create AI Prompt Templates and AI Sandbox Runs tables for Admin Studio.

Revision ID: 0021_ai_sandbox_benchmarks
Revises: 0020_beta_rate_limits
Create Date: 2026-09-25 19:50:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0021_ai_sandbox_benchmarks"
down_revision: str | None = "0020_beta_rate_limits"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Create ai_prompt_templates table
    op.create_table(
        "ai_prompt_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("feature_type", sa.String(length=30), nullable=False),  # 'writing', 'speaking', 'raw'
        sa.Column("system_prompt", sa.Text(), nullable=False),
        sa.Column("user_prompt_template", sa.Text(), nullable=True),
        sa.Column("default_model", sa.String(length=50), server_default="models/gemini-3.5-flash", nullable=False),
        sa.Column("default_temperature", sa.Float(), server_default="0.7", nullable=False),
        sa.Column("is_system_preset", sa.Boolean(), server_default="false", nullable=False),
        sa.Column(
            "created_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ai_prompt_templates_name", "ai_prompt_templates", ["name"])
    op.create_index("ix_ai_prompt_templates_feature_type", "ai_prompt_templates", ["feature_type"])
    op.create_index("ix_ai_prompt_templates_is_system_preset", "ai_prompt_templates", ["is_system_preset"])
    op.create_index("ix_ai_prompt_templates_created_by_id", "ai_prompt_templates", ["created_by_id"])

    # 2. Create ai_sandbox_runs table
    op.create_table(
        "ai_sandbox_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("feature_type", sa.String(length=30), nullable=False),  # 'writing', 'speaking', 'raw'
        sa.Column(
            "template_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("ai_prompt_templates.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("model", sa.String(length=50), nullable=False),
        sa.Column("temperature", sa.Float(), server_default="0.7", nullable=False),
        sa.Column("system_prompt", sa.Text(), nullable=False),
        sa.Column("user_prompt", sa.Text(), nullable=False),
        sa.Column("input_context", sa.JSON(), nullable=False),
        sa.Column("raw_output", sa.Text(), nullable=False),
        sa.Column("parsed_result", sa.JSON(), nullable=True),
        sa.Column("latency_ms", sa.Integer(), server_default="0", nullable=False),
        sa.Column("prompt_tokens", sa.Integer(), server_default="0", nullable=False),
        sa.Column("completion_tokens", sa.Integer(), server_default="0", nullable=False),
        sa.Column("total_tokens", sa.Integer(), server_default="0", nullable=False),
        sa.Column("estimated_cost_usd", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("is_simulation", sa.Boolean(), server_default="false", nullable=False),
        sa.Column(
            "created_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ai_sandbox_runs_feature_type", "ai_sandbox_runs", ["feature_type"])
    op.create_index("ix_ai_sandbox_runs_template_id", "ai_sandbox_runs", ["template_id"])
    op.create_index("ix_ai_sandbox_runs_is_simulation", "ai_sandbox_runs", ["is_simulation"])
    op.create_index("ix_ai_sandbox_runs_created_by_id", "ai_sandbox_runs", ["created_by_id"])
    op.create_index("ix_ai_sandbox_runs_created_at_desc", "ai_sandbox_runs", [sa.text("created_at DESC")])
    op.create_index("ix_ai_sandbox_runs_feature_created_at", "ai_sandbox_runs", ["feature_type", sa.text("created_at DESC")])


def downgrade() -> None:
    op.drop_index("ix_ai_sandbox_runs_feature_created_at", table_name="ai_sandbox_runs")
    op.drop_index("ix_ai_sandbox_runs_created_at_desc", table_name="ai_sandbox_runs")
    op.drop_index("ix_ai_sandbox_runs_created_by_id", table_name="ai_sandbox_runs")
    op.drop_index("ix_ai_sandbox_runs_is_simulation", table_name="ai_sandbox_runs")
    op.drop_index("ix_ai_sandbox_runs_template_id", table_name="ai_sandbox_runs")
    op.drop_index("ix_ai_sandbox_runs_feature_type", table_name="ai_sandbox_runs")
    op.drop_table("ai_sandbox_runs")

    op.drop_index("ix_ai_prompt_templates_created_by_id", table_name="ai_prompt_templates")
    op.drop_index("ix_ai_prompt_templates_is_system_preset", table_name="ai_prompt_templates")
    op.drop_index("ix_ai_prompt_templates_feature_type", table_name="ai_prompt_templates")
    op.drop_index("ix_ai_prompt_templates_name", table_name="ai_prompt_templates")
    op.drop_table("ai_prompt_templates")
