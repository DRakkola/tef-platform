"""Taxonomy versioning, historical evidence integrity, and migration records.

Revision ID: 0034_taxonomy_versioning_and_historical_integrity
Revises: 0033_taxonomy_v2_metadata_relationships
Create Date: 2026-10-04 03:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0034_taxonomy_versioning_and_historical_integrity"
down_revision: str | None = "0033_taxonomy_v2_metadata_relationships"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    # 1. Enforce unique skill codes within a taxonomy version: (taxonomy_version_id, code) UNIQUE
    if is_postgres:
        op.execute("ALTER TABLE skills DROP CONSTRAINT IF EXISTS skills_code_key;")
        op.execute("ALTER TABLE skills DROP CONSTRAINT IF EXISTS uq_skills_code;")
        op.execute("DROP INDEX IF EXISTS ix_skills_code;")
        op.create_unique_constraint(
            "uq_skills_taxonomy_version_code",
            "skills",
            ["taxonomy_version_id", "code"],
        )
        op.create_index("ix_skills_code", "skills", ["code"])
    else:
        with op.batch_alter_table("skills") as batch_op:
            batch_op.create_unique_constraint(
                "uq_skills_taxonomy_version_code",
                ["taxonomy_version_id", "code"],
            )

    # 2. Add taxonomy_version_id to skill_evidences for immutable historical provenance
    if is_postgres:
        op.add_column(
            "skill_evidences",
            sa.Column(
                "taxonomy_version_id",
                sa.UUID(as_uuid=True),
                sa.ForeignKey("taxonomy_versions.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
        op.create_index(
            "ix_skill_evidences_taxonomy_version_id",
            "skill_evidences",
            ["taxonomy_version_id"],
        )
    else:
        with op.batch_alter_table("skill_evidences") as batch_op:
            batch_op.add_column(
                sa.Column(
                    "taxonomy_version_id",
                    sa.UUID(as_uuid=True),
                    sa.ForeignKey("taxonomy_versions.id", ondelete="SET NULL"),
                    nullable=True,
                )
            )
            batch_op.create_index(
                "ix_skill_evidences_taxonomy_version_id",
                ["taxonomy_version_id"],
            )

    # Backfill taxonomy_version_id from skills table for existing skill_evidences
    op.execute("""
    UPDATE skill_evidences
    SET taxonomy_version_id = (
        SELECT s.taxonomy_version_id FROM skills s WHERE s.id = skill_evidences.skill_id
    )
    WHERE taxonomy_version_id IS NULL;
    """)

    # 3. Add composite indexes (F-17) on question_skill_tags and exercise_skills
    op.create_index(
        "ix_question_skill_tags_skill_role",
        "question_skill_tags",
        ["skill_id", "role"],
    )
    op.create_index(
        "ix_exercise_skills_skill_role",
        "exercise_skills",
        ["skill_id", "role"],
    )

    # 4. Create taxonomy_migration_records table for explicit, zero-silent-orphaning tracking
    op.create_table(
        "taxonomy_migration_records",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("source_table", sa.String(length=50), nullable=False),
        sa.Column("source_id", sa.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("source_code", sa.String(length=100), nullable=False, index=True),
        sa.Column("source_name", sa.String(length=255), nullable=False),
        sa.Column(
            "target_skill_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("skills.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "status",
            sa.String(length=50),
            nullable=False,
            server_default="unresolved",
            index=True,
        ),
        sa.Column("migration_type", sa.String(length=50), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("source_table", "source_id", name="uq_tax_mig_source"),
    )


def downgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    op.drop_table("taxonomy_migration_records")
    op.drop_index("ix_exercise_skills_skill_role", table_name="exercise_skills")
    op.drop_index("ix_question_skill_tags_skill_role", table_name="question_skill_tags")

    if is_postgres:
        op.drop_index("ix_skill_evidences_taxonomy_version_id", table_name="skill_evidences")
        op.drop_column("skill_evidences", "taxonomy_version_id")
        op.drop_constraint("uq_skills_taxonomy_version_code", "skills", type_="unique")
        op.create_unique_constraint("skills_code_key", "skills", ["code"])
    else:
        with op.batch_alter_table("skill_evidences") as batch_op:
            batch_op.drop_index("ix_skill_evidences_taxonomy_version_id")
            batch_op.drop_column("taxonomy_version_id")
        with op.batch_alter_table("skills") as batch_op:
            batch_op.drop_constraint("uq_skills_taxonomy_version_code", type_="unique")
            batch_op.create_unique_constraint("skills_code_key", ["code"])
