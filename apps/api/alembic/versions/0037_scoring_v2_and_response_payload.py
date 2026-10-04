"""Question System V2 scoring: response payload, scoring status, and scoring algorithm version.

Revision ID: 0037_scoring_v2_and_response_payload
Revises: 0036_question_v2_lifecycle_and_attempt_version
Create Date: 2026-10-04 11:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0037_scoring_v2_and_response_payload"
down_revision: str | None = "0036_question_v2_lifecycle_and_attempt_version"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    # 1. Add response_payload and scoring_status to attempt_answers
    if is_postgres:
        op.add_column(
            "attempt_answers",
            sa.Column("response_payload", sa.JSON(), nullable=True),
        )
        op.add_column(
            "attempt_answers",
            sa.Column("scoring_status", sa.String(length=30), nullable=True),
        )
    else:
        with op.batch_alter_table("attempt_answers") as batch_op:
            batch_op.add_column(sa.Column("response_payload", sa.JSON(), nullable=True))
            batch_op.add_column(sa.Column("scoring_status", sa.String(length=30), nullable=True))

    # 2. Add scoring_algorithm_version to attempt_scores
    if is_postgres:
        op.add_column(
            "attempt_scores",
            sa.Column("scoring_algorithm_version", sa.String(length=20), server_default="v2", nullable=False),
        )
    else:
        with op.batch_alter_table("attempt_scores") as batch_op:
            batch_op.add_column(
                sa.Column("scoring_algorithm_version", sa.String(length=20), server_default="v2", nullable=False)
            )


def downgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    if is_postgres:
        op.drop_column("attempt_scores", "scoring_algorithm_version")
        op.drop_column("attempt_answers", "scoring_status")
        op.drop_column("attempt_answers", "response_payload")
    else:
        with op.batch_alter_table("attempt_scores") as batch_op:
            batch_op.drop_column("scoring_algorithm_version")
        with op.batch_alter_table("attempt_answers") as batch_op:
            batch_op.drop_column("scoring_status")
            batch_op.drop_column("response_payload")
