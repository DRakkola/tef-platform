"""Taxonomy V2 metadata relationships: skill_modalities, task_type_skills, and skill_aliases.

Revision ID: 0033_taxonomy_v2_metadata_relationships
Revises: 0032_deprecate_legacy_subskills
Create Date: 2026-10-03 14:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0033_taxonomy_v2_metadata_relationships"
down_revision: str | None = "0032_deprecate_legacy_subskills"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    # 1. Create skill_modalities table
    op.create_table(
        "skill_modalities",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "skill_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("skills.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("modality", sa.String(length=30), nullable=False, index=True),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("skill_id", "modality", name="uq_skill_modality"),
    )

    # 2. Create task_type_skills table
    op.create_table(
        "task_type_skills",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "task_type_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("task_types.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "skill_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("skills.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("task_type_id", "skill_id", name="uq_task_type_skill"),
    )

    # 3. Create skill_aliases table
    op.create_table(
        "skill_aliases",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "skill_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("skills.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("alias_code", sa.String(length=100), nullable=False, unique=True, index=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # 4. Data Backfill: Populate skill_modalities from existing skills
    # Modality-specific skills
    if is_postgres:
        op.execute("""
        INSERT INTO skill_modalities (id, skill_id, modality, is_primary, created_at)
        SELECT
            gen_random_uuid(),
            s.id,
            LOWER(CAST(s.category AS text)),
            true,
            NOW()
        FROM skills s
        WHERE LOWER(CAST(s.category AS text)) IN ('reading', 'listening', 'writing', 'speaking')
        ON CONFLICT (skill_id, modality) DO NOTHING;
        """)

        op.execute("""
        INSERT INTO skill_modalities (id, skill_id, modality, is_primary, created_at)
        SELECT
            gen_random_uuid(),
            s.id,
            LOWER(s.domain),
            true,
            NOW()
        FROM skills s
        WHERE s.domain IS NOT NULL
          AND LOWER(s.domain) IN ('reading', 'listening', 'writing', 'speaking')
        ON CONFLICT (skill_id, modality) DO NOTHING;
        """)

        # Transversal language skills apply to all 4 modalities
        for mod in ('reading', 'listening', 'writing', 'speaking'):
            op.execute(f"""
            INSERT INTO skill_modalities (id, skill_id, modality, is_primary, created_at)
            SELECT
                gen_random_uuid(),
                s.id,
                '{mod}',
                false,
                NOW()
            FROM skills s
            WHERE (LOWER(CAST(s.category AS text)) IN ('grammar', 'vocabulary', 'conjugation')
                OR LOWER(COALESCE(s.domain, '')) IN ('grammar', 'vocabulary', 'conjugation')
                OR s.dimension = 'language')
            ON CONFLICT (skill_id, modality) DO NOTHING;
            """)

        # 5. Data Backfill: Register legacy aliases for core modalities
        legacy_alias_map = [
            ("speaking", ["EO", "expression_orale", "speaking_b2"]),
            ("speaking_expression", ["EO", "expression_orale", "speaking_b2", "speaking"]),
            ("writing", ["EE", "expression_ecrite", "writing_b2"]),
            ("writing_argumentation", ["EE", "expression_ecrite", "writing_b2", "writing"]),
            ("reading", ["CE", "comprehension_ecrite", "reading_b2"]),
            ("reasoning_reading_root", ["CE", "comprehension_ecrite", "reading_b2", "reading"]),
            ("listening", ["CO", "comprehension_orale", "listening_b2"]),
        ]

        for target_code, aliases in legacy_alias_map:
            for alias in aliases:
                op.execute(f"""
                INSERT INTO skill_aliases (id, skill_id, alias_code, notes, created_at)
                SELECT
                    gen_random_uuid(),
                    s.id,
                    '{alias}',
                    'Legacy alias for code {target_code}',
                    NOW()
                FROM skills s
                WHERE s.code = '{target_code}'
                ON CONFLICT (alias_code) DO NOTHING;
                """)


def downgrade() -> None:
    op.drop_table("skill_aliases")
    op.drop_table("task_type_skills")
    op.drop_table("skill_modalities")
