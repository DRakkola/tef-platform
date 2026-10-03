"""Canonical multi-competency skill tagging and item task types.

Revision ID: 0031_canonical_skill_tagging
Revises: 0030_taxonomy_v2_normalization
Create Date: 2026-10-02 21:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0031_canonical_skill_tagging"
down_revision: str | None = "0030_taxonomy_v2_normalization"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # -------------------------------------------------------------------------
    # 1. Add task_type_id to questions & exercises
    # -------------------------------------------------------------------------
    op.add_column(
        "questions",
        sa.Column(
            "task_type_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("task_types.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_questions_task_type_id", "questions", ["task_type_id"])

    op.add_column(
        "exercises",
        sa.Column(
            "task_type_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("task_types.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_exercises_task_type_id", "exercises", ["task_type_id"])

    # -------------------------------------------------------------------------
    # 2. Add context and timestamps to tagging tables
    # -------------------------------------------------------------------------
    op.add_column(
        "question_skill_tags",
        sa.Column(
            "context",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )

    op.add_column(
        "exercise_skills",
        sa.Column(
            "context",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.add_column(
        "exercise_skills",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.add_column(
        "exercise_skills",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # -------------------------------------------------------------------------
    # 3. Add Unique Constraints on Item-Skill Pairs (No Duplicate Tags)
    # -------------------------------------------------------------------------
    op.create_unique_constraint(
        "uq_question_skill_tags_question_skill",
        "question_skill_tags",
        ["question_id", "skill_id"],
    )

    op.create_unique_constraint(
        "uq_exercise_skills_exercise_skill",
        "exercise_skills",
        ["exercise_id", "skill_id"],
    )

    # -------------------------------------------------------------------------
    # 4. Migrate Remaining String-Based Subskills to Canonical Foreign Keys
    # -------------------------------------------------------------------------
    op.execute("""
    UPDATE question_skill_tags qst
    SET subskill_id = s.id
    FROM skills s
    WHERE qst.subskill = s.code AND qst.subskill_id IS NULL;
    """)

    op.execute("""
    UPDATE exercise_skills es
    SET subskill_id = s.id
    FROM skills s
    WHERE es.subskill = s.code AND es.subskill_id IS NULL;
    """)

    op.execute("""
    UPDATE mistakes m
    SET subskill_id = s.id
    FROM skills s
    WHERE m.subskill = s.code AND m.subskill_id IS NULL;
    """)

    # -------------------------------------------------------------------------
    # 5. Backfill Default task_type_id for Existing Questions
    # -------------------------------------------------------------------------
    op.execute("""
    UPDATE questions q
    SET task_type_id = tt.id
    FROM assessment_sections sec
    JOIN assessments a ON a.id = sec.assessment_id
    CROSS JOIN (
        SELECT id, modality FROM task_types WHERE code IN ('press_article', 'radio_broadcast')
    ) tt
    WHERE q.section_id = sec.id
      AND q.task_type_id IS NULL
      AND (
          (a.assessment_type ILIKE '%reading%' AND tt.modality = 'reading') OR
          (a.assessment_type ILIKE '%listening%' AND tt.modality = 'listening')
      );
    """)


def downgrade() -> None:
    op.drop_constraint("uq_exercise_skills_exercise_skill", "exercise_skills", type_="unique")
    op.drop_constraint("uq_question_skill_tags_question_skill", "question_skill_tags", type_="unique")

    op.drop_column("exercise_skills", "updated_at")
    op.drop_column("exercise_skills", "created_at")
    op.drop_column("exercise_skills", "context")

    op.drop_column("question_skill_tags", "context")

    op.drop_index("ix_exercises_task_type_id", table_name="exercises")
    op.drop_column("exercises", "task_type_id")

    op.drop_index("ix_questions_task_type_id", table_name="questions")
    op.drop_column("questions", "task_type_id")
