"""Add ai_generation_jobs table for asynchronous AI question generation.

Revision ID: 0040_ai_generation_jobs
Revises: 0039_taxonomy_v1_canonical_schema
Create Date: 2026-10-05 18:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0040_ai_generation_jobs"
down_revision: str | None = "0039_taxonomy_v1_canonical_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"
    json_type = sa.JSON().with_variant(postgresql.JSONB, "postgresql")

    # AI generation is slow and billable, so it runs in a Celery worker rather
    # than inside the HTTP request. This row is the hand-off and polling point.
    op.create_table(
        "ai_generation_jobs",
        sa.Column(
            "id",
            sa.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()") if is_postgres else None,
        ),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="queued",
        ),
        sa.Column("task_type_code", sa.String(length=50), nullable=True),
        sa.Column("modality", sa.String(length=32), nullable=False),
        sa.Column("target_cefr", sa.String(length=4), nullable=False),
        sa.Column("requested_count", sa.Integer(), nullable=False),
        sa.Column("request_payload", json_type, nullable=False),
        sa.Column("result_payload", json_type, nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("celery_task_id", sa.String(length=128), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_by_user_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_index("ix_ai_generation_jobs_status", "ai_generation_jobs", ["status"])
    op.create_index(
        "ix_ai_generation_jobs_task_type_code", "ai_generation_jobs", ["task_type_code"]
    )
    op.create_index(
        "ix_ai_generation_jobs_celery_task_id", "ai_generation_jobs", ["celery_task_id"]
    )
    op.create_index(
        "ix_ai_generation_jobs_created_by_user_id",
        "ai_generation_jobs",
        ["created_by_user_id"],
    )
    # Admin dashboards list recent jobs per status; created_at breaks the tie.
    op.create_index(
        "ix_ai_generation_jobs_status_created",
        "ai_generation_jobs",
        ["status", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_ai_generation_jobs_status_created", table_name="ai_generation_jobs")
    op.drop_index("ix_ai_generation_jobs_created_by_user_id", table_name="ai_generation_jobs")
    op.drop_index("ix_ai_generation_jobs_celery_task_id", table_name="ai_generation_jobs")
    op.drop_index("ix_ai_generation_jobs_task_type_code", table_name="ai_generation_jobs")
    op.drop_index("ix_ai_generation_jobs_status", table_name="ai_generation_jobs")
    op.drop_table("ai_generation_jobs")