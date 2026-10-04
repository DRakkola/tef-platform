"""Question System V2 foundation: stimuli, section decoupling, validations, provenance, and version snapshots.

Revision ID: 0035_question_system_v2_foundation
Revises: 0034_taxonomy_versioning_and_historical_integrity
Create Date: 2026-10-04 05:00:00.000000
"""

import hashlib
import json
import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0035_question_system_v2_foundation"
down_revision: str | None = "0034_taxonomy_versioning_and_historical_integrity"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    json_type = sa.JSON().with_variant(postgresql.JSONB, "postgresql")

    # -------------------------------------------------------------------------
    # 1. Create stimuli table
    # -------------------------------------------------------------------------
    op.create_table(
        "stimuli",
        sa.Column(
            "id",
            sa.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()") if is_postgres else None,
        ),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("modality", sa.String(length=30), nullable=False),
        sa.Column("content_text", sa.Text(), nullable=True),
        sa.Column("text_format", sa.String(length=20), nullable=False, server_default="plain"),
        sa.Column("word_count", sa.Integer(), nullable=True),
        sa.Column("register", sa.String(length=50), nullable=True),
        sa.Column(
            "media_asset_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("media_assets.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("media_url", sa.String(length=512), nullable=True),
        sa.Column("source_citation", sa.Text(), nullable=True),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
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
        sa.UniqueConstraint("content_hash", name="uq_stimuli_content_hash"),
    )
    op.create_index("ix_stimuli_modality", "stimuli", ["modality"])
    op.create_index("ix_stimuli_content_hash", "stimuli", ["content_hash"])

    # -------------------------------------------------------------------------
    # 2. Create assessment_section_questions (Decoupled junction)
    # -------------------------------------------------------------------------
    op.create_table(
        "assessment_section_questions",
        sa.Column(
            "id",
            sa.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()") if is_postgres else None,
        ),
        sa.Column(
            "assessment_section_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("assessment_sections.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "question_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("questions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("points_override", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("assessment_section_id", "question_id", name="uq_section_question"),
    )
    op.create_index(
        "ix_asq_section_order",
        "assessment_section_questions",
        ["assessment_section_id", "order_index"],
    )

    # -------------------------------------------------------------------------
    # 3. Create question_validations (Persistent validation audit)
    # -------------------------------------------------------------------------
    op.create_table(
        "question_validations",
        sa.Column(
            "id",
            sa.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()") if is_postgres else None,
        ),
        sa.Column(
            "question_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("questions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("validation_status", sa.String(length=30), nullable=False),
        sa.Column("blocking_error_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("warning_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("issues_payload", json_type, nullable=False),
        sa.Column(
            "checked_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("validated_by_system_version", sa.String(length=50), nullable=False, server_default="v2.0.0"),
    )
    op.create_index("ix_question_validations_question_id", "question_validations", ["question_id"])

    # -------------------------------------------------------------------------
    # 4. Create question_provenance (Author, AI generator, review audit)
    # -------------------------------------------------------------------------
    op.create_table(
        "question_provenance",
        sa.Column(
            "id",
            sa.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()") if is_postgres else None,
        ),
        sa.Column(
            "question_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("questions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("author_type", sa.String(length=30), nullable=False, server_default="human"),
        sa.Column("source_type", sa.String(length=50), nullable=False, server_default="original"),
        sa.Column("source_reference", sa.Text(), nullable=True),
        sa.Column("generator_model", sa.String(length=100), nullable=True),
        sa.Column("generator_prompt_version", sa.String(length=100), nullable=True),
        sa.Column("generator_parameters", json_type, nullable=True),
        sa.Column(
            "taxonomy_version_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("taxonomy_versions.id", ondelete="RESTRICT"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "created_by_user_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "reviewed_by_user_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("question_id", name="uq_question_provenance_question"),
    )
    op.create_index("ix_question_provenance_question_id", "question_provenance", ["question_id"])

    # -------------------------------------------------------------------------
    # 5. Alter question_options (Diagnostic Distractors)
    # -------------------------------------------------------------------------
    if is_postgres:
        op.add_column("question_options", sa.Column("misconception_type", sa.String(length=50), nullable=True))
        op.add_column("question_options", sa.Column("distractor_rationale", sa.Text(), nullable=True))
    else:
        with op.batch_alter_table("question_options") as batch_op:
            batch_op.add_column(sa.Column("misconception_type", sa.String(length=50), nullable=True))
            batch_op.add_column(sa.Column("distractor_rationale", sa.Text(), nullable=True))

    # -------------------------------------------------------------------------
    # 6. Alter question_versions (Full Snapshot Upgrade)
    # -------------------------------------------------------------------------
    if is_postgres:
        op.add_column("question_versions", sa.Column("snapshot_payload", json_type, nullable=True))
        op.add_column("question_versions", sa.Column("changelog", sa.Text(), nullable=True))
    else:
        with op.batch_alter_table("question_versions") as batch_op:
            batch_op.add_column(sa.Column("snapshot_payload", json_type, nullable=True))
            batch_op.add_column(sa.Column("changelog", sa.Text(), nullable=True))

    # -------------------------------------------------------------------------
    # 7. Alter questions (V2 Attributes)
    # -------------------------------------------------------------------------
    if is_postgres:
        op.add_column(
            "questions",
            sa.Column(
                "stimulus_id",
                sa.UUID(as_uuid=True),
                sa.ForeignKey("stimuli.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
        op.create_index("ix_questions_stimulus_id", "questions", ["stimulus_id"])

        op.add_column(
            "questions",
            sa.Column("response_type", sa.String(length=50), nullable=False, server_default="single_choice"),
        )
        op.create_index("ix_questions_response_type", "questions", ["response_type"])

        op.add_column("questions", sa.Column("target_cefr", sa.String(length=10), nullable=True))
        op.create_index("ix_questions_target_cefr", "questions", ["target_cefr"])

        op.add_column("questions", sa.Column("difficulty_rating", sa.Integer(), nullable=True))
        op.add_column("questions", sa.Column("cognitive_complexity", sa.String(length=50), nullable=True))

        op.add_column(
            "questions",
            sa.Column("is_live_delivered", sa.Boolean(), nullable=False, server_default=sa.false()),
        )
        op.create_index("ix_questions_is_live_delivered", "questions", ["is_live_delivered"])

        op.add_column("questions", sa.Column("item_hash", sa.String(length=64), nullable=True))
        op.create_index("ix_questions_item_hash", "questions", ["item_hash"])

        op.add_column("questions", sa.Column("instructions", sa.Text(), nullable=True))
        op.add_column("questions", sa.Column("scoring_payload", json_type, nullable=True))

        # Make section_id nullable (decoupling)
        op.alter_column("questions", "section_id", existing_type=sa.UUID(as_uuid=True), nullable=True)
    else:
        with op.batch_alter_table("questions") as batch_op:
            batch_op.add_column(
                sa.Column(
                    "stimulus_id",
                    sa.UUID(as_uuid=True),
                    sa.ForeignKey("stimuli.id", ondelete="SET NULL"),
                    nullable=True,
                )
            )
            batch_op.add_column(
                sa.Column("response_type", sa.String(length=50), nullable=False, server_default="single_choice")
            )
            batch_op.add_column(sa.Column("target_cefr", sa.String(length=10), nullable=True))
            batch_op.add_column(sa.Column("difficulty_rating", sa.Integer(), nullable=True))
            batch_op.add_column(sa.Column("cognitive_complexity", sa.String(length=50), nullable=True))
            batch_op.add_column(
                sa.Column("is_live_delivered", sa.Boolean(), nullable=False, server_default=sa.false())
            )
            batch_op.add_column(sa.Column("item_hash", sa.String(length=64), nullable=True))
            batch_op.add_column(sa.Column("instructions", sa.Text(), nullable=True))
            batch_op.add_column(sa.Column("scoring_payload", json_type, nullable=True))
            batch_op.alter_column("section_id", existing_type=sa.UUID(as_uuid=True), nullable=True)

    # -------------------------------------------------------------------------
    # 8. Data Backfill & Section Association Decoupling
    # -------------------------------------------------------------------------
    # 8.1 Backfill assessment_section_questions from questions
    # Using portable Python connection execution
    questions_data = bind.execute(
        sa.text("SELECT id, section_id, order_index FROM questions WHERE section_id IS NOT NULL")
    ).fetchall()

    for q_id, s_id, ord_idx in questions_data:
        # Check if already present
        existing = bind.execute(
            sa.text(
                "SELECT 1 FROM assessment_section_questions "
                "WHERE assessment_section_id = :s_id AND question_id = :q_id"
            ),
            {"s_id": s_id, "q_id": q_id},
        ).scalar()
        if not existing:
            bind.execute(
                sa.text(
                    "INSERT INTO assessment_section_questions "
                    "(id, assessment_section_id, question_id, order_index, created_at) "
                    "VALUES (:id, :s_id, :q_id, :order_index, :now)"
                ),
                {
                    "id": str(uuid.uuid4()) if not is_postgres else uuid.uuid4(),
                    "s_id": s_id,
                    "q_id": q_id,
                    "order_index": ord_idx or 0,
                    "now": sa.func.now(),
                },
            )

    # 8.2 Backfill target_cefr, difficulty_rating, response_type, and item_hash
    all_questions = bind.execute(
        sa.text("SELECT id, prompt, question_type, level, difficulty, created_by_user_id, created_at FROM questions")
    ).fetchall()

    for row in all_questions:
        q_id = row[0]
        prompt = row[1] or ""
        q_type = str(row[2] or "single_choice")
        lvl = row[3] or "B1"
        diff = row[4] or 3
        creator_id = row[5]
        created_at = row[6]

        # Map response_type
        resp_type = "short_text" if "text_input" in q_type.lower() else "single_choice"
        if "multiple_choice" in q_type.lower():
            resp_type = "multiple_choice"

        # Calculate deterministic item_hash: sha256(normalized prompt)
        norm_prompt = " ".join(prompt.strip().lower().split())
        item_hash = hashlib.sha256(norm_prompt.encode("utf-8")).hexdigest()

        # Check if question has live attempts
        delivered_count = bind.execute(
            sa.text("SELECT COUNT(1) FROM attempt_answers WHERE question_id = :q_id"),
            {"q_id": q_id},
        ).scalar() or 0
        is_live = delivered_count > 0

        bind.execute(
            sa.text(
                "UPDATE questions SET "
                "response_type = :resp_type, "
                "target_cefr = :target_cefr, "
                "difficulty_rating = :diff, "
                "item_hash = :item_hash, "
                "is_live_delivered = :is_live "
                "WHERE id = :q_id"
            ),
            {
                "resp_type": resp_type,
                "target_cefr": lvl,
                "diff": diff,
                "item_hash": item_hash,
                "is_live": is_live,
                "q_id": q_id,
            },
        )

        # 8.3 Populate baseline question_provenance if not present
        has_prov = bind.execute(
            sa.text("SELECT 1 FROM question_provenance WHERE question_id = :q_id"),
            {"q_id": q_id},
        ).scalar()
        if not has_prov:
            bind.execute(
                sa.text(
                    "INSERT INTO question_provenance "
                    "(id, question_id, author_type, source_type, created_by_user_id, created_at) "
                    "VALUES (:id, :q_id, 'human', 'original', :creator_id, :created_at)"
                ),
                {
                    "id": str(uuid.uuid4()) if not is_postgres else uuid.uuid4(),
                    "q_id": q_id,
                    "creator_id": creator_id,
                    "created_at": created_at or sa.func.now(),
                },
            )

    # 8.4 Backfill snapshot_payload in question_versions if present
    existing_versions = bind.execute(
        sa.text(
            "SELECT id, prompt, explanation, question_type, difficulty, level, points, options_snapshot "
            "FROM question_versions WHERE snapshot_payload IS NULL"
        )
    ).fetchall()

    for v_row in existing_versions:
        v_id = v_row[0]
        v_prompt = v_row[1]
        v_expl = v_row[2]
        v_type = v_row[3]
        v_diff = v_row[4]
        v_level = v_row[5]
        v_pts = v_row[6]
        v_opts = v_row[7]

        payload = {
            "prompt": v_prompt,
            "explanation": v_expl,
            "question_type": v_type,
            "difficulty": v_diff,
            "level": v_level,
            "points": v_pts,
            "options": v_opts if isinstance(v_opts, list) else json.loads(v_opts or "[]"),
        }

        bind.execute(
            sa.text(
                "UPDATE question_versions SET "
                "snapshot_payload = :payload, "
                "changelog = 'Synthesized from legacy v1 version record' "
                "WHERE id = :v_id"
            ),
            {
                "payload": payload if not is_postgres else json.dumps(payload),
                "v_id": v_id,
            },
        )


def downgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    # 1. Drop added columns on questions
    if is_postgres:
        op.drop_index("ix_questions_item_hash", table_name="questions")
        op.drop_column("questions", "scoring_payload")
        op.drop_column("questions", "instructions")
        op.drop_column("questions", "item_hash")
        op.drop_index("ix_questions_is_live_delivered", table_name="questions")
        op.drop_column("questions", "is_live_delivered")
        op.drop_column("questions", "cognitive_complexity")
        op.drop_column("questions", "difficulty_rating")
        op.drop_index("ix_questions_target_cefr", table_name="questions")
        op.drop_column("questions", "target_cefr")
        op.drop_index("ix_questions_response_type", table_name="questions")
        op.drop_column("questions", "response_type")
        op.drop_index("ix_questions_stimulus_id", table_name="questions")
        op.drop_column("questions", "stimulus_id")
        op.alter_column("questions", "section_id", existing_type=sa.UUID(as_uuid=True), nullable=False)
    else:
        with op.batch_alter_table("questions") as batch_op:
            batch_op.drop_column("scoring_payload")
            batch_op.drop_column("instructions")
            batch_op.drop_column("item_hash")
            batch_op.drop_column("is_live_delivered")
            batch_op.drop_column("cognitive_complexity")
            batch_op.drop_column("difficulty_rating")
            batch_op.drop_column("target_cefr")
            batch_op.drop_column("response_type")
            batch_op.drop_column("stimulus_id")
            batch_op.alter_column("section_id", existing_type=sa.UUID(as_uuid=True), nullable=False)

    # 2. Drop added columns on question_versions
    if is_postgres:
        op.drop_column("question_versions", "changelog")
        op.drop_column("question_versions", "snapshot_payload")
    else:
        with op.batch_alter_table("question_versions") as batch_op:
            batch_op.drop_column("changelog")
            batch_op.drop_column("snapshot_payload")

    # 3. Drop added columns on question_options
    if is_postgres:
        op.drop_column("question_options", "distractor_rationale")
        op.drop_column("question_options", "misconception_type")
    else:
        with op.batch_alter_table("question_options") as batch_op:
            batch_op.drop_column("distractor_rationale")
            batch_op.drop_column("misconception_type")

    # 4. Drop tables in reverse order
    op.drop_index("ix_question_provenance_question_id", table_name="question_provenance")
    op.drop_table("question_provenance")

    op.drop_index("ix_question_validations_question_id", table_name="question_validations")
    op.drop_table("question_validations")

    op.drop_index("ix_asq_section_order", table_name="assessment_section_questions")
    op.drop_table("assessment_section_questions")

    op.drop_index("ix_stimuli_content_hash", table_name="stimuli")
    op.drop_index("ix_stimuli_modality", table_name="stimuli")
    op.drop_table("stimuli")
