"""Clean V1 schema reset: drop legacy sub_skills, drop question.section_id, and enforce canonical skill tags.

Revision ID: 0038_clean_v1_schema_reset
Revises: 0037_scoring_v2_and_response_payload
Create Date: 2026-10-04 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0038_clean_v1_schema_reset"
down_revision: str | None = "0037_scoring_v2_and_response_payload"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    # 1. Drop sub_skills trigger, function, and table permanently
    if is_postgres:
        op.execute("DROP TRIGGER IF EXISTS trg_prevent_sub_skills_insert ON sub_skills;")
        op.execute("DROP FUNCTION IF EXISTS prevent_sub_skills_insert();")

    op.execute("DROP TABLE IF EXISTS sub_skills CASCADE;")

    # 2. Drop section_id from questions table (questions are fully decoupled from sections)
    if is_postgres:
        # Check and drop FK constraint if exists
        op.execute("""
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN (
                SELECT constraint_name 
                FROM information_schema.table_constraints 
                WHERE table_name = 'questions' 
                  AND constraint_type = 'FOREIGN KEY'
                  AND constraint_name LIKE '%section_id%'
            ) LOOP
                EXECUTE 'ALTER TABLE questions DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
            END LOOP;
        END $$;
        """)
        op.execute("DROP INDEX IF EXISTS ix_questions_section_id;")
        op.drop_column("questions", "section_id")
    else:
        with op.batch_alter_table("questions") as batch_op:
            batch_op.drop_column("section_id")

    # 3. Clean question_skill_tags: drop subskill and subskill_id, add unique (question_id, skill_id)
    if is_postgres:
        op.execute("""
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN (
                SELECT constraint_name 
                FROM information_schema.table_constraints 
                WHERE table_name = 'question_skill_tags' 
                  AND constraint_type = 'FOREIGN KEY'
                  AND constraint_name LIKE '%subskill_id%'
            ) LOOP
                EXECUTE 'ALTER TABLE question_skill_tags DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
            END LOOP;
        END $$;
        """)
        op.execute("DROP INDEX IF EXISTS ix_question_skill_tags_subskill_id;")
        op.drop_column("question_skill_tags", "subskill_id")
        op.drop_column("question_skill_tags", "subskill")
        op.create_unique_constraint(
            "uq_question_skill_tag",
            "question_skill_tags",
            ["question_id", "skill_id"],
        )
    else:
        with op.batch_alter_table("question_skill_tags") as batch_op:
            batch_op.drop_column("subskill_id")
            batch_op.drop_column("subskill")
            batch_op.create_unique_constraint("uq_question_skill_tag", ["question_id", "skill_id"])

    # 4. Clean exercise_skills: drop subskill and subskill_id, add unique (exercise_id, skill_id)
    if is_postgres:
        op.execute("""
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN (
                SELECT constraint_name 
                FROM information_schema.table_constraints 
                WHERE table_name = 'exercise_skills' 
                  AND constraint_type = 'FOREIGN KEY'
                  AND constraint_name LIKE '%subskill_id%'
            ) LOOP
                EXECUTE 'ALTER TABLE exercise_skills DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
            END LOOP;
        END $$;
        """)
        op.execute("DROP INDEX IF EXISTS ix_exercise_skills_subskill_id;")
        op.drop_column("exercise_skills", "subskill_id")
        op.drop_column("exercise_skills", "subskill")
        op.create_unique_constraint(
            "uq_exercise_skill_tag",
            "exercise_skills",
            ["exercise_id", "skill_id"],
        )
    else:
        with op.batch_alter_table("exercise_skills") as batch_op:
            batch_op.drop_column("subskill_id")
            batch_op.drop_column("subskill")
            batch_op.create_unique_constraint("uq_exercise_skill_tag", ["exercise_id", "skill_id"])

    # 5. Clean mistakes: drop subskill and subskill_id
    if is_postgres:
        op.execute("""
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN (
                SELECT constraint_name 
                FROM information_schema.table_constraints 
                WHERE table_name = 'mistakes' 
                  AND constraint_type = 'FOREIGN KEY'
                  AND constraint_name LIKE '%subskill_id%'
            ) LOOP
                EXECUTE 'ALTER TABLE mistakes DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
            END LOOP;
        END $$;
        """)
        op.execute("DROP INDEX IF EXISTS ix_mistakes_subskill_id;")
        op.drop_column("mistakes", "subskill_id")
        op.drop_column("mistakes", "subskill")
    else:
        with op.batch_alter_table("mistakes") as batch_op:
            batch_op.drop_column("subskill_id")
            batch_op.drop_column("subskill")


def downgrade() -> None:
    # Destructive reset is forward-only
    pass
