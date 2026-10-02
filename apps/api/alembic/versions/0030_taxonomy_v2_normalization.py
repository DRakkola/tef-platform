"""Taxonomy V2 database normalization and canonical competency unification.

Revision ID: 0030_taxonomy_v2_normalization
Revises: 0029_skill_is_active_and_subskills_unification
Create Date: 2026-10-02 19:30:00.000000
"""

from collections.abc import Sequence
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0030_taxonomy_v2_normalization"
down_revision: str | None = "0029_skill_is_active_and_subskills_unification"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # -------------------------------------------------------------------------
    # 1. Enums (Idempotent Creation)
    # -------------------------------------------------------------------------
    op.execute("""
    DO $$ BEGIN
        CREATE TYPE skill_dimension AS ENUM ('reasoning', 'language');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
    """)

    op.execute("""
    DO $$ BEGIN
        CREATE TYPE skill_tag_role AS ENUM ('primary', 'secondary');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
    """)

    op.execute("""
    DO $$ BEGIN
        CREATE TYPE skill_relation_type AS ENUM ('prerequisite', 'depends_on', 'supports', 'related');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
    """)

    op.execute("""
    DO $$ BEGIN
        CREATE TYPE taxonomy_lifecycle_status AS ENUM ('draft', 'active', 'deprecated', 'archived');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
    """)

    op.execute("""
    DO $$ BEGIN
        CREATE TYPE cefr_band AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
    """)

    # -------------------------------------------------------------------------
    # 2. Create Core Tables
    # -------------------------------------------------------------------------
    # 2.1 taxonomy_versions
    op.create_table(
        "taxonomy_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("version", sa.String(length=32), nullable=False, unique=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "status",
            postgresql.ENUM("draft", "active", "deprecated", "archived", name="taxonomy_lifecycle_status", create_type=False),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_taxonomy_versions_status", "taxonomy_versions", ["status"])

    # 2.2 task_types
    op.create_table(
        "task_types",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("modality", sa.String(length=30), nullable=False),
        sa.Column("code", sa.String(length=100), nullable=False, unique=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_task_types_modality", "task_types", ["modality"])
    op.create_index("ix_task_types_is_active", "task_types", ["is_active"])

    # 2.3 skill_relations
    op.create_table(
        "skill_relations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("from_skill_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("skills.id", ondelete="CASCADE"), nullable=False),
        sa.Column("to_skill_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("skills.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "relation_type",
            postgresql.ENUM("prerequisite", "depends_on", "supports", "related", name="skill_relation_type", create_type=False),
            nullable=False,
            server_default="prerequisite",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("from_skill_id", "to_skill_id", "relation_type", name="uq_skill_relation"),
        sa.CheckConstraint("from_skill_id <> to_skill_id", name="ck_no_self_relation"),
    )
    op.create_index("ix_skill_relations_from", "skill_relations", ["from_skill_id"])
    op.create_index("ix_skill_relations_to", "skill_relations", ["to_skill_id"])

    # 2.4 skill_level_descriptors
    op.create_table(
        "skill_level_descriptors",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("skill_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("skills.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "level",
            postgresql.ENUM("A1", "A2", "B1", "B2", "C1", "C2", name="cefr_band", create_type=False),
            nullable=False,
        ),
        sa.Column("descriptor", sa.Text(), nullable=False),
        sa.Column("evidence_guidance", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("skill_id", "level", name="uq_skill_cefr_level"),
    )
    op.create_index("ix_skill_descriptors_skill_level", "skill_level_descriptors", ["skill_id", "level"])

    # -------------------------------------------------------------------------
    # 3. Add V2 Columns to Existing Tables (Nullable First)
    # -------------------------------------------------------------------------
    # 3.1 skills
    op.add_column(
        "skills",
        sa.Column("taxonomy_version_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("taxonomy_versions.id", ondelete="RESTRICT"), nullable=True),
    )
    op.add_column(
        "skills",
        sa.Column(
            "dimension",
            postgresql.ENUM("reasoning", "language", name="skill_dimension", create_type=False),
            nullable=True,
        ),
    )
    op.add_column(
        "skills",
        sa.Column("domain", sa.String(length=50), nullable=True),
    )
    op.create_index("ix_skills_taxonomy_version_id", "skills", ["taxonomy_version_id"])
    op.create_index("ix_skills_dimension", "skills", ["dimension"])
    op.create_index("ix_skills_domain", "skills", ["domain"])

    # 3.2 question_skill_tags
    op.add_column(
        "question_skill_tags",
        sa.Column("subskill_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("skills.id", ondelete="RESTRICT"), nullable=True),
    )
    op.add_column(
        "question_skill_tags",
        sa.Column(
            "role",
            postgresql.ENUM("primary", "secondary", name="skill_tag_role", create_type=False),
            nullable=False,
            server_default="primary",
        ),
    )
    op.create_index("ix_question_skill_tags_subskill_id", "question_skill_tags", ["subskill_id"])
    op.create_index("ix_question_skill_tags_role", "question_skill_tags", ["role"])

    # 3.3 exercise_skills
    op.add_column(
        "exercise_skills",
        sa.Column("subskill_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("skills.id", ondelete="RESTRICT"), nullable=True),
    )
    op.add_column(
        "exercise_skills",
        sa.Column(
            "role",
            postgresql.ENUM("primary", "secondary", name="skill_tag_role", create_type=False),
            nullable=False,
            server_default="primary",
        ),
    )
    op.create_index("ix_exercise_skills_subskill_id", "exercise_skills", ["subskill_id"])
    op.create_index("ix_exercise_skills_role", "exercise_skills", ["role"])

    # 3.4 mistakes
    op.add_column(
        "mistakes",
        sa.Column("subskill_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("skills.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_mistakes_subskill_id", "mistakes", ["subskill_id"])

    # -------------------------------------------------------------------------
    # 4. Insert Baseline Taxonomy Versions
    # -------------------------------------------------------------------------
    op.execute("""
    INSERT INTO taxonomy_versions (id, version, name, status, description, activated_at, created_at, updated_at)
    VALUES
        ('00000000-0000-0000-0000-000000000001', 'v1.0.0-legacy', 'TEF Legacy Taxonomy V1', 'deprecated', 'Historical taxonomy baseline for pre-V2 data.', NOW(), NOW(), NOW()),
        ('00000000-0000-0000-0000-000000000002', 'v2.0.0-canonical', 'TEF Canada Standard Taxonomy 2026', 'active', 'Authoritative competency catalog decoupling exam task formats from reasoning and language competencies.', NOW(), NOW(), NOW())
    ON CONFLICT (version) DO NOTHING;
    """)

    # -------------------------------------------------------------------------
    # 5. Insert All SubSkills into Canonical Skills Table
    # -------------------------------------------------------------------------
    # Insert any subskill from sub_skills that is not yet in skills table (preserving exact UUID!)
    op.execute("""
    INSERT INTO skills (id, parent_id, code, name, description, is_active, created_at, updated_at)
    SELECT
        sub.id,
        sub.skill_id,
        sub.code,
        sub.name,
        sub.description,
        TRUE,
        sub.created_at,
        sub.updated_at
    FROM sub_skills sub
    WHERE NOT EXISTS (
        SELECT 1 FROM skills s WHERE s.id = sub.id OR s.code = sub.code
    )
    ON CONFLICT (code) DO NOTHING;
    """)

    # -------------------------------------------------------------------------
    # 6. Re-parent Orphaned Skills
    # -------------------------------------------------------------------------
    op.execute("""
    UPDATE skills
    SET parent_id = (SELECT id FROM skills WHERE code = 'reading_comprehension' LIMIT 1)
    WHERE code IN ('reading_detail', 'reading_gist', 'reading_inference')
      AND parent_id IS NULL;
    """)

    # Also ensure READ_FAITS is parented to reading_comprehension
    op.execute("""
    UPDATE skills
    SET parent_id = (SELECT id FROM skills WHERE code = 'reading_comprehension' LIMIT 1)
    WHERE code = 'READ_FAITS' AND parent_id IS NULL;
    """)

    # Ensure LIST_RADIO is parented to listening_comprehension
    op.execute("""
    UPDATE skills
    SET parent_id = (SELECT id FROM skills WHERE code = 'listening_comprehension' LIMIT 1)
    WHERE code = 'LIST_RADIO' AND parent_id IS NULL;
    """)

    # Ensure GRAM_SUBJ is parented to grammar
    op.execute("""
    UPDATE skills
    SET parent_id = (SELECT id FROM skills WHERE code = 'grammar' LIMIT 1)
    WHERE code = 'GRAM_SUBJ' AND parent_id IS NULL;
    """)

    # Ensure WRIT_SECTB is parented to writing_expression
    op.execute("""
    UPDATE skills
    SET parent_id = (SELECT id FROM skills WHERE code = 'writing_expression' LIMIT 1)
    WHERE code = 'WRIT_SECTB' AND parent_id IS NULL;
    """)

    # -------------------------------------------------------------------------
    # 7. Backfill dimension, domain, and taxonomy_version_id on Skills
    # -------------------------------------------------------------------------
    # Assign default active taxonomy version
    op.execute("""
    UPDATE skills
    SET taxonomy_version_id = '00000000-0000-0000-0000-000000000002'
    WHERE taxonomy_version_id IS NULL;
    """)

    # Reading Domain -> Dimension: reasoning
    op.execute("""
    UPDATE skills
    SET dimension = 'reasoning', domain = 'reading'
    WHERE code IN (
        'reading_comprehension', 'reading_comp', 'READ_FAITS',
        'reading_detail', 'reading_gist', 'reading_inference',
        'reading_factual_info', 'reading_main_theme', 'reading_implicit_inference', 'reading_author_stance'
    ) OR parent_id IN (SELECT id FROM skills WHERE code IN ('reading_comprehension', 'reading_comp'));
    """)

    # Listening Domain -> Dimension: reasoning
    op.execute("""
    UPDATE skills
    SET dimension = 'reasoning', domain = 'listening'
    WHERE code IN (
        'listening_comprehension', 'listening_comp', 'LIST_RADIO',
        'listening_announcement', 'listening_interview',
        'listening_short_announcements', 'listening_conversation_details', 'listening_formal_debates', 'listening_speaker_attitudes'
    ) OR parent_id IN (SELECT id FROM skills WHERE code IN ('listening_comprehension', 'listening_comp'));
    """)

    # Grammar Domain -> Dimension: language
    op.execute("""
    UPDATE skills
    SET dimension = 'language', domain = 'grammar'
    WHERE code IN (
        'grammar', 'grammar_mastery', 'GRAM_SUBJ',
        'relative_pronouns', 'subjunctive',
        'grammar_subjunctive_mood', 'grammar_logical_connectors', 'grammar_relative_pronouns', 'grammar_hypothetical_systems'
    ) OR parent_id IN (SELECT id FROM skills WHERE code IN ('grammar', 'grammar_mastery'));
    """)

    # Vocabulary Domain -> Dimension: language
    op.execute("""
    UPDATE skills
    SET dimension = 'language', domain = 'vocabulary'
    WHERE code IN (
        'vocabulary', 'vocabulary_lexicon',
        'connectors', 'collocations',
        'vocab_environment_climate', 'vocab_tech_workplace', 'vocab_abstract_argumentation', 'vocab_society_media'
    ) OR parent_id IN (SELECT id FROM skills WHERE code IN ('vocabulary', 'vocabulary_lexicon'));
    """)

    # Conjugation Domain -> Dimension: language
    op.execute("""
    UPDATE skills
    SET dimension = 'language', domain = 'conjugation'
    WHERE code IN (
        'conjugation', 'conjugation_tenses',
        'past_tenses', 'conditional',
        'conjug_pc_vs_imparfait', 'conjug_conditional_modes', 'conjug_irregular_verbs', 'conjug_past_participle_agreement'
    ) OR parent_id IN (SELECT id FROM skills WHERE code IN ('conjugation', 'conjugation_tenses'));
    """)

    # Writing Domain -> Dimension: language
    op.execute("""
    UPDATE skills
    SET dimension = 'language', domain = 'writing'
    WHERE code IN (
        'writing_expression', 'writing_production', 'WRIT_SECTB',
        'writing_narrative_fait_divers', 'writing_persuasive_letter', 'writing_syntactic_variety', 'writing_textual_cohesion'
    ) OR parent_id IN (SELECT id FROM skills WHERE code IN ('writing_expression', 'writing_production'));
    """)

    # Speaking Domain -> Dimension: language
    op.execute("""
    UPDATE skills
    SET dimension = 'language', domain = 'speaking'
    WHERE code IN (
        'speaking_expression', 'speaking_interaction',
        'speaking_fluency_phonetics', 'speaking_rebuttal_objections', 'speaking_section_a_inquiries', 'speaking_section_b_persuasion'
    ) OR parent_id IN (SELECT id FROM skills WHERE code IN ('speaking_expression', 'speaking_interaction'));
    """)

    # Fallback for any unmapped skills
    op.execute("""
    UPDATE skills
    SET dimension = 'language', domain = 'general'
    WHERE dimension IS NULL OR domain IS NULL;
    """)

    # Enforce NOT NULL constraints on newly backfilled columns
    op.alter_column("skills", "taxonomy_version_id", nullable=False)
    op.alter_column("skills", "dimension", nullable=False)
    op.alter_column("skills", "domain", nullable=False)

    # -------------------------------------------------------------------------
    # 8. Backfill subskill_id in question_skill_tags, exercise_skills, mistakes
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
    # 9. Seed Standard TEF Task Types
    # -------------------------------------------------------------------------
    op.execute("""
    INSERT INTO task_types (modality, code, name, description, is_active)
    VALUES
        ('reading', 'fait_divers', 'Fait divers / Article court', 'Article journalistique ou compte-rendu d''événement.', TRUE),
        ('reading', 'press_article', 'Article de presse / Éditorial', 'Article d''opinion ou analyse de fond.', TRUE),
        ('reading', 'daily_document', 'Document du quotidien / Pratique', 'Note d''information, courrier administratif, petite annonce.', TRUE),
        ('listening', 'public_announcement', 'Annonce publique', 'Message ou consigne diffusé dans un lieu public.', TRUE),
        ('listening', 'radio_broadcast', 'Chronique / Émission radio', 'Chronique, reportage ou extrait radiophonique.', TRUE),
        ('listening', 'interview', 'Entretien / Débat', 'Interview thématique ou échange contradictoire.', TRUE),
        ('writing', 'narrative_fait_divers', 'Section A : Récit de fait divers', 'Rédaction d''un récit cohérent à partir d''un extrait.', TRUE),
        ('writing', 'argumentative_letter', 'Section B : Lettre argumentative', 'Plaidoyer structuré pour convaincre un destinataire.', TRUE),
        ('speaking', 'oral_inquiry', 'Section A : Collecte d''informations', 'Obtenir des renseignements en posant des questions adaptées.', TRUE),
        ('speaking', 'oral_persuasion', 'Section B : Plaidoyer et persuasion', 'Convaincre un interlocuteur d''accepter une proposition.', TRUE)
    ON CONFLICT (code) DO NOTHING;
    """)

    # -------------------------------------------------------------------------
    # 10. Populate Canonical Skill Relations (Equivalence Graph)
    # -------------------------------------------------------------------------
    skill_relations_sql = """
    INSERT INTO skill_relations (from_skill_id, to_skill_id, relation_type)
    SELECT s1.id, s2.id, 'related'::skill_relation_type
    FROM skills s1, skills s2
    WHERE (
        (s1.code = 'grammar_mastery' AND s2.code = 'grammar') OR
        (s1.code = 'vocabulary_lexicon' AND s2.code = 'vocabulary') OR
        (s1.code = 'conjugation_tenses' AND s2.code = 'conjugation') OR
        (s1.code = 'writing_production' AND s2.code = 'writing_expression') OR
        (s1.code = 'speaking_interaction' AND s2.code = 'speaking_expression') OR
        (s1.code = 'reading_comp' AND s2.code = 'reading_comprehension') OR
        (s1.code = 'listening_comp' AND s2.code = 'listening_comprehension') OR
        (s1.code = 'grammar_relative_pronouns' AND s2.code = 'relative_pronouns') OR
        (s1.code = 'grammar_subjunctive_mood' AND s2.code = 'subjunctive') OR
        (s1.code = 'grammar_logical_connectors' AND s2.code = 'connectors')
    )
    ON CONFLICT ON CONSTRAINT uq_skill_relation DO NOTHING;
    """
    op.execute(skill_relations_sql)

    # -------------------------------------------------------------------------
    # 11. Seed Canonical CEFR Level Descriptors
    # -------------------------------------------------------------------------
    op.execute("""
    INSERT INTO skill_level_descriptors (skill_id, level, descriptor, evidence_guidance)
    SELECT
        s.id,
        d.level::cefr_band,
        d.descriptor,
        d.guidance
    FROM skills s
    CROSS JOIN (
        VALUES
            ('A2', 'Peut comprendre des informations factuelles isolées et des expressions prévisibles.', 'Questions simples avec amorce directe.'),
            ('B1', 'Peut identifier le thème principal et repérer les points significatifs.', 'Documents usuels ou textes narratifs sans métaphores complexes.'),
            ('B2', 'Peut saisir des nuances argumentatives, l''ironie et l''intention implicite de l''auteur.', 'Articles de presse d''opinion ou entretiens à locuteurs multiples.'),
            ('C1', 'Peut appréhender sans effort des textes longs, complexes et subtils aux registres variés.', 'Éditoriaux denses, sous-entendus culturels et allusions pragmatiques.')
    ) AS d(level, descriptor, guidance)
    WHERE s.code = 'reading_comprehension'
    ON CONFLICT ON CONSTRAINT uq_skill_cefr_level DO NOTHING;
    """)

    op.execute("""
    INSERT INTO skill_level_descriptors (skill_id, level, descriptor, evidence_guidance)
    SELECT
        s.id,
        d.level::cefr_band,
        d.descriptor,
        d.guidance
    FROM skills s
    CROSS JOIN (
        VALUES
            ('A2', 'Peut saisir des mots isolés et des formules très simples dans un débit lent.', 'Annonces courtes et messages téléphoniques basiques.'),
            ('B1', 'Peut comprendre l''essentiel de messages clairs en langue standard.', 'Émissions de radio et consignes de transport usuelles.'),
            ('B2', 'Peut suivre des débats animés, reconnaître les attitudes et le ton des interlocuteurs.', 'Émissions polémiques, registres familiers modérés.'),
            ('C1', 'Peut comprendre une grande variété de locuteurs rapides avec accents régionaux.', 'Débats sociologiques et conférences non structurées.')
    ) AS d(level, descriptor, guidance)
    WHERE s.code = 'listening_comprehension'
    ON CONFLICT ON CONSTRAINT uq_skill_cefr_level DO NOTHING;
    """)

    # -------------------------------------------------------------------------
    # 12. Non-Destructive Protection: Switch FKs to RESTRICT
    # -------------------------------------------------------------------------
    # Protect student_skills
    op.drop_constraint("student_skills_skill_id_fkey", "student_skills", type_="foreignkey")
    op.create_foreign_key(
        "student_skills_skill_id_fkey",
        "student_skills",
        "skills",
        ["skill_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    # Protect skill_evidences
    op.drop_constraint("skill_evidences_skill_id_fkey", "skill_evidences", type_="foreignkey")
    op.create_foreign_key(
        "skill_evidences_skill_id_fkey",
        "skill_evidences",
        "skills",
        ["skill_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    # Protect skill_assessments
    op.drop_constraint("skill_assessments_skill_id_fkey", "skill_assessments", type_="foreignkey")
    op.create_foreign_key(
        "skill_assessments_skill_id_fkey",
        "skill_assessments",
        "skills",
        ["skill_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    # Protect question_skill_tags
    op.drop_constraint("question_skill_tags_skill_id_fkey", "question_skill_tags", type_="foreignkey")
    op.create_foreign_key(
        "question_skill_tags_skill_id_fkey",
        "question_skill_tags",
        "skills",
        ["skill_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    # Protect exercise_skills
    op.drop_constraint("exercise_skills_skill_id_fkey", "exercise_skills", type_="foreignkey")
    op.create_foreign_key(
        "exercise_skills_skill_id_fkey",
        "exercise_skills",
        "skills",
        ["skill_id"],
        ["id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    # 1. Revert FK delete actions back to CASCADE
    op.drop_constraint("exercise_skills_skill_id_fkey", "exercise_skills", type_="foreignkey")
    op.create_foreign_key(
        "exercise_skills_skill_id_fkey",
        "exercise_skills",
        "skills",
        ["skill_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.drop_constraint("question_skill_tags_skill_id_fkey", "question_skill_tags", type_="foreignkey")
    op.create_foreign_key(
        "question_skill_tags_skill_id_fkey",
        "question_skill_tags",
        "skills",
        ["skill_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.drop_constraint("skill_assessments_skill_id_fkey", "skill_assessments", type_="foreignkey")
    op.create_foreign_key(
        "skill_assessments_skill_id_fkey",
        "skill_assessments",
        "skills",
        ["skill_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.drop_constraint("skill_evidences_skill_id_fkey", "skill_evidences", type_="foreignkey")
    op.create_foreign_key(
        "skill_evidences_skill_id_fkey",
        "skill_evidences",
        "skills",
        ["skill_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.drop_constraint("student_skills_skill_id_fkey", "student_skills", type_="foreignkey")
    op.create_foreign_key(
        "student_skills_skill_id_fkey",
        "student_skills",
        "skills",
        ["skill_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # 2. Drop columns from mistakes
    op.drop_index("ix_mistakes_subskill_id", table_name="mistakes")
    op.drop_column("mistakes", "subskill_id")

    # 3. Drop columns from exercise_skills
    op.drop_index("ix_exercise_skills_role", table_name="exercise_skills")
    op.drop_index("ix_exercise_skills_subskill_id", table_name="exercise_skills")
    op.drop_column("exercise_skills", "role")
    op.drop_column("exercise_skills", "subskill_id")

    # 4. Drop columns from question_skill_tags
    op.drop_index("ix_question_skill_tags_role", table_name="question_skill_tags")
    op.drop_index("ix_question_skill_tags_subskill_id", table_name="question_skill_tags")
    op.drop_column("question_skill_tags", "role")
    op.drop_column("question_skill_tags", "subskill_id")

    # 5. Drop columns from skills
    op.drop_index("ix_skills_domain", table_name="skills")
    op.drop_index("ix_skills_dimension", table_name="skills")
    op.drop_index("ix_skills_taxonomy_version_id", table_name="skills")
    op.drop_column("skills", "domain")
    op.drop_column("skills", "dimension")
    op.drop_column("skills", "taxonomy_version_id")

    # 6. Drop V2 tables
    op.drop_table("skill_level_descriptors")
    op.drop_table("skill_relations")
    op.drop_table("task_types")
    op.drop_table("taxonomy_versions")

    # 7. Drop enums
    op.execute("DROP TYPE IF EXISTS cefr_band CASCADE;")
    op.execute("DROP TYPE IF EXISTS taxonomy_lifecycle_status CASCADE;")
    op.execute("DROP TYPE IF EXISTS skill_relation_type CASCADE;")
    op.execute("DROP TYPE IF EXISTS skill_tag_role CASCADE;")
    op.execute("DROP TYPE IF EXISTS skill_dimension CASCADE;")
