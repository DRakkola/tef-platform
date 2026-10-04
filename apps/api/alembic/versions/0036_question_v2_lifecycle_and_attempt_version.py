"""Question System V2 lifecycle: attempt delivered question version and section question version pinning.

Revision ID: 0036_question_v2_lifecycle_and_attempt_version
Revises: 0035_question_system_v2_foundation
Create Date: 2026-10-04 06:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0036_question_v2_lifecycle_and_attempt_version"
down_revision: str | None = "0035_question_system_v2_foundation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    # -------------------------------------------------------------------------
    # 1. Add question_version_id to assessment_section_questions
    # -------------------------------------------------------------------------
    if is_postgres:
        op.add_column(
            "assessment_section_questions",
            sa.Column(
                "question_version_id",
                sa.UUID(as_uuid=True),
                sa.ForeignKey("question_versions.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
        op.create_index(
            "ix_asq_question_version_id",
            "assessment_section_questions",
            ["question_version_id"],
        )
    else:
        with op.batch_alter_table("assessment_section_questions") as batch_op:
            batch_op.add_column(
                sa.Column(
                    "question_version_id",
                    sa.UUID(as_uuid=True),
                    sa.ForeignKey("question_versions.id", ondelete="SET NULL"),
                    nullable=True,
                )
            )
            batch_op.create_index("ix_asq_question_version_id", ["question_version_id"])

    # -------------------------------------------------------------------------
    # 2. Add question_version_id to attempt_answers
    # -------------------------------------------------------------------------
    if is_postgres:
        op.add_column(
            "attempt_answers",
            sa.Column(
                "question_version_id",
                sa.UUID(as_uuid=True),
                sa.ForeignKey("question_versions.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
        op.create_index(
            "ix_attempt_answers_question_version_id",
            "attempt_answers",
            ["question_version_id"],
        )
    else:
        with op.batch_alter_table("attempt_answers") as batch_op:
            batch_op.add_column(
                sa.Column(
                    "question_version_id",
                    sa.UUID(as_uuid=True),
                    sa.ForeignKey("question_versions.id", ondelete="SET NULL"),
                    nullable=True,
                )
            )
            batch_op.create_index("ix_attempt_answers_question_version_id", ["question_version_id"])

    # -------------------------------------------------------------------------
    # 3. Deterministic Historical Backfill
    # Link historical attempts and sections to QuestionVersion v1 where it exists
    # -------------------------------------------------------------------------
    if is_postgres:
        op.execute("""
            UPDATE attempt_answers aa
            SET question_version_id = qv.id
            FROM question_versions qv
            WHERE aa.question_id = qv.question_id AND qv.version = 1
              AND aa.question_version_id IS NULL;
        """)
        op.execute("""
            UPDATE assessment_section_questions asq
            SET question_version_id = qv.id
            FROM question_versions qv
            WHERE asq.question_id = qv.question_id AND qv.version = 1
              AND asq.question_version_id IS NULL;
        """)
    else:
        op.execute("""
            UPDATE attempt_answers
            SET question_version_id = (
                SELECT qv.id FROM question_versions qv
                WHERE qv.question_id = attempt_answers.question_id AND qv.version = 1
                LIMIT 1
            )
            WHERE question_version_id IS NULL
              AND EXISTS (
                SELECT 1 FROM question_versions qv
                WHERE qv.question_id = attempt_answers.question_id AND qv.version = 1
              );
        """)
        op.execute("""
            UPDATE assessment_section_questions
            SET question_version_id = (
                SELECT qv.id FROM question_versions qv
                WHERE qv.question_id = assessment_section_questions.question_id AND qv.version = 1
                LIMIT 1
            )
            WHERE question_version_id IS NULL
              AND EXISTS (
                SELECT 1 FROM question_versions qv
                WHERE qv.question_id = assessment_section_questions.question_id AND qv.version = 1
              );
        """)


def downgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    # Drop attempt_answers.question_version_id
    if is_postgres:
        op.drop_index("ix_attempt_answers_question_version_id", table_name="attempt_answers")
        op.drop_column("attempt_answers", "question_version_id")
    else:
        with op.batch_alter_table("attempt_answers") as batch_op:
            batch_op.drop_index("ix_attempt_answers_question_version_id")
            batch_op.drop_column("question_version_id")

    # Drop assessment_section_questions.question_version_id
    if is_postgres:
        op.drop_index("ix_asq_question_version_id", table_name="assessment_section_questions")
        op.drop_column("assessment_section_questions", "question_version_id")
    else:
        with op.batch_alter_table("assessment_section_questions") as batch_op:
            batch_op.drop_index("ix_asq_question_version_id")
            batch_op.drop_column("question_version_id")
