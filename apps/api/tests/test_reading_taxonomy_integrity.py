"""Taxonomy integrity tests for TEF Reading (Compréhension Écrite) Taxonomy V1.

Validates:
- Spec-level consistency (uniqueness, parent validity, CEFR bands, relation endpoints)
- Database emission of all 8 standard TEF Reading task types
- Strict dimension segregation (reasoning vs language)
- Hierarchical tree validity and acyclicity
- CEFR descriptors coverage and can-do statements
- Directed learning graph dependencies and legacy bridge edges
- Seeder idempotency
"""

import uuid

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.admin.enums import CEFRBand, SkillDimension, SkillRelationType
from app.modules.admin.models import (
    SkillLevelDescriptor,
    SkillModality,
    SkillRelation,
    TaskTypeSkill,
)
from app.modules.admin.reading_taxonomy_data import (
    LANGUAGE_COMPETENCIES,
    REASONING_COMPETENCIES,
    SKILL_RELATIONS,
    seed_reading_taxonomy,
    validate_reading_taxonomy_spec,
)
from app.modules.assessments.models import Skill, TaskType


def test_taxonomy_spec_validation_passes():
    """Taxonomy specification validation engine must find zero errors."""
    errors = validate_reading_taxonomy_spec()
    assert errors == [], f"Taxonomy specification has validation errors: {errors}"


@pytest.mark.asyncio
async def test_seed_reading_taxonomy_and_idempotency(db_session: AsyncSession):
    """Seeding the reading taxonomy must populate all entities and be strictly idempotent."""
    # First seed run
    result1 = await seed_reading_taxonomy(db_session)
    assert result1["skills"] > 0
    assert result1["descriptors"] > 0
    assert result1["relations"] > 0

    # Capture counts after first run
    skills_count_1 = await db_session.scalar(select(func.count(Skill.id)))
    desc_count_1 = await db_session.scalar(select(func.count(SkillLevelDescriptor.id)))
    rel_count_1 = await db_session.scalar(select(func.count(SkillRelation.id)))

    # Second seed run (must be idempotent without unique constraint violations)
    result2 = await seed_reading_taxonomy(db_session)
    assert result2["task_types"] == 0  # No new task types created on second run
    assert result2["skills"] == 0  # No new skills created on second run

    skills_count_2 = await db_session.scalar(select(func.count(Skill.id)))
    desc_count_2 = await db_session.scalar(select(func.count(SkillLevelDescriptor.id)))
    rel_count_2 = await db_session.scalar(select(func.count(SkillRelation.id)))

    assert skills_count_1 == skills_count_2
    assert desc_count_1 == desc_count_2
    assert rel_count_1 == rel_count_2


@pytest.mark.asyncio
async def test_reading_task_types_coverage(db_session: AsyncSession):
    """All 8 standard TEF reading task types must be present, active, and mapped to 'reading'."""
    await seed_reading_taxonomy(db_session)

    expected_codes = {
        "daily_document",
        "sentence_gap",
        "text_gap",
        "document_matching",
        "graph_matching",
        "administrative_document",
        "professional_document",
        "press_article",
    }

    stmt = select(TaskType).where(TaskType.code.in_(expected_codes))
    task_types = list((await db_session.execute(stmt)).scalars().all())

    found_codes = {t.code for t in task_types}
    assert found_codes == expected_codes, f"Missing task types: {expected_codes - found_codes}"

    for tt in task_types:
        assert tt.modality == "reading"
        assert tt.is_active is True
        assert len(tt.name) > 5
        assert len(tt.description or "") > 15


@pytest.mark.asyncio
async def test_reasoning_competencies_dimension_and_hierarchy(db_session: AsyncSession):
    """Reasoning competencies must have dimension=reasoning and form a valid hierarchical tree."""
    await seed_reading_taxonomy(db_session)

    reasoning_codes = [sk["code"] for sk in REASONING_COMPETENCIES]
    stmt = select(Skill).where(Skill.code.in_(reasoning_codes))
    skills = list((await db_session.execute(stmt)).scalars().all())
    skill_map = {s.code: s for s in skills}

    assert len(skills) == len(reasoning_codes)

    # All must have dimension == REASONING
    for s in skills:
        assert s.dimension == SkillDimension.REASONING, (
            f"Skill {s.code} has unexpected dimension {s.dimension}"
        )
        assert s.domain == "reading"

    # Root container has parent_id == None
    root = skill_map["reasoning_reading_root"]
    assert root.parent_id is None

    # Sub-containers point to root
    containers = [
        "reasoning_info_extraction",
        "reasoning_global_comprehension",
        "reasoning_relational_synthesis",
        "reasoning_inference_and_evaluation",
    ]
    for c_code in containers:
        c = skill_map[c_code]
        assert c.parent_id == root.id, f"Container {c_code} does not point to root"

    # Assessable leaf competencies point to their respective sub-containers
    assessable_reasoning = [
        ("reasoning_locate_information", "reasoning_info_extraction"),
        ("reasoning_identify_specific_detail", "reasoning_info_extraction"),
        ("reasoning_identify_main_idea", "reasoning_global_comprehension"),
        ("reasoning_understand_context", "reasoning_global_comprehension"),
        ("reasoning_understand_sequence", "reasoning_global_comprehension"),
        ("reasoning_identify_cause_effect", "reasoning_relational_synthesis"),
        ("reasoning_compare_and_match", "reasoning_relational_synthesis"),
        ("reasoning_interpret_data", "reasoning_relational_synthesis"),
        ("reasoning_infer_implicit_meaning", "reasoning_inference_and_evaluation"),
        ("reasoning_identify_author_position", "reasoning_inference_and_evaluation"),
        ("reasoning_identify_tone_and_intent", "reasoning_inference_and_evaluation"),
    ]
    for leaf_code, parent_code in assessable_reasoning:
        leaf = skill_map[leaf_code]
        expected_parent = skill_map[parent_code]
        assert leaf.parent_id == expected_parent.id, f"Leaf {leaf_code} parent mismatch"


@pytest.mark.asyncio
async def test_transversal_language_competencies_dimension_and_domains(db_session: AsyncSession):
    """Language competencies must have dimension=language and span vocabulary, grammar, verbs, syntax, discourse, semantics."""
    await seed_reading_taxonomy(db_session)

    language_codes = [sk["code"] for sk in LANGUAGE_COMPETENCIES]
    stmt = select(Skill).where(Skill.code.in_(language_codes))
    skills = list((await db_session.execute(stmt)).scalars().all())
    skill_map = {s.code: s for s in skills}

    assert len(skills) == len(language_codes)

    # All must have dimension == LANGUAGE
    for s in skills:
        assert s.dimension == SkillDimension.LANGUAGE, (
            f"Skill {s.code} has unexpected dimension {s.dimension}"
        )

    # Verify domain coverage
    expected_domain_containers = {
        "language_vocabulary_domain": "vocabulary",
        "language_grammar_domain": "grammar",
        "language_verb_system_domain": "conjugation",
        "language_syntax_domain": "syntax",
        "language_discourse_domain": "discourse",
        "language_semantics_domain": "semantics",
    }
    for c_code, expected_domain in expected_domain_containers.items():
        assert c_code in skill_map
        assert skill_map[c_code].domain == expected_domain
        assert skill_map[c_code].parent_id is None

    # Check key assessable leaf skills are children of their domain container
    assessable_leaves = [
        ("lang_vocab_in_context", "language_vocabulary_domain"),
        ("lang_paraphrase_and_synonyms", "language_vocabulary_domain"),
        ("lang_collocations_and_idioms", "language_vocabulary_domain"),
        ("lang_register_and_style", "language_vocabulary_domain"),
        ("lang_grammatical_agreement", "language_grammar_domain"),
        ("lang_pronouns_and_anaphora", "language_grammar_domain"),
        ("lang_prepositions_and_governance", "language_grammar_domain"),
        ("lang_negation_and_restriction", "language_grammar_domain"),
        ("lang_tense_selection_and_aspect", "language_verb_system_domain"),
        ("lang_verbal_moods", "language_verb_system_domain"),
        ("lang_subordination_and_clauses", "language_syntax_domain"),
        ("lang_hypothetical_systems", "language_syntax_domain"),
        ("lang_logical_connectors", "language_discourse_domain"),
        ("lang_cohesion_and_progression", "language_discourse_domain"),
        ("lang_semantic_nuance", "language_semantics_domain"),
    ]
    for leaf_code, parent_code in assessable_leaves:
        leaf = skill_map[leaf_code]
        expected_parent = skill_map[parent_code]
        assert leaf.parent_id == expected_parent.id, f"Leaf {leaf_code} parent mismatch"


@pytest.mark.asyncio
async def test_cefr_descriptors_coverage(db_session: AsyncSession):
    """All assessable competencies must have calibrated CEFR descriptors with observable evidence guidance."""
    await seed_reading_taxonomy(db_session)

    all_specs = REASONING_COMPETENCIES + LANGUAGE_COMPETENCIES
    assessable_specs = [s for s in all_specs if s["assessable"]]

    for spec in assessable_specs:
        code = spec["code"]
        skill = await db_session.scalar(select(Skill).where(Skill.code == code))
        assert skill is not None, f"Skill {code} not found in DB"

        stmt_desc = select(SkillLevelDescriptor).where(SkillLevelDescriptor.skill_id == skill.id)
        descriptors = list((await db_session.execute(stmt_desc)).scalars().all())
        assert len(descriptors) >= 2, f"Competency {code} has fewer than 2 CEFR descriptors"

        for desc in descriptors:
            assert isinstance(desc.level, CEFRBand)
            assert len(desc.descriptor) >= 20, f"Descriptor too brief for {code} {desc.level}"
            assert desc.evidence_guidance is not None, (
                f"Missing evidence guidance for {code} {desc.level}"
            )
            assert len(desc.evidence_guidance) >= 15


@pytest.mark.asyncio
async def test_learning_graph_relations_and_acyclicity(db_session: AsyncSession):
    """Dependency relations must link existing skills, forbid self-relations, and maintain acyclic prerequisites."""
    await seed_reading_taxonomy(db_session)
    stmt = select(SkillRelation)
    relations = list((await db_session.execute(stmt)).scalars().all())

    internal_relations = [
        (f, t, r)
        for f, t, r in SKILL_RELATIONS
        if f in {s["code"] for s in REASONING_COMPETENCIES + LANGUAGE_COMPETENCIES}
        and t in {s["code"] for s in REASONING_COMPETENCIES + LANGUAGE_COMPETENCIES}
    ]
    assert len(relations) >= len(internal_relations)

    # 1. No self relations
    for rel in relations:
        assert rel.from_skill_id != rel.to_skill_id, (
            f"Self-relation found on skill {rel.from_skill_id}"
        )
        assert rel.relation_type in [
            SkillRelationType.PREREQUISITE,
            SkillRelationType.SUPPORTS,
            SkillRelationType.RELATED,
            SkillRelationType.DEPENDS_ON,
        ]

    # 2. Prerequisite graph acyclicity check (DFS)
    prereq_edges: dict[uuid.UUID, list[uuid.UUID]] = {}
    for rel in relations:
        if rel.relation_type == SkillRelationType.PREREQUISITE:
            prereq_edges.setdefault(rel.from_skill_id, []).append(rel.to_skill_id)

    visited: set[uuid.UUID] = set()
    rec_stack: set[uuid.UUID] = set()

    def has_cycle(node: uuid.UUID) -> bool:
        visited.add(node)
        rec_stack.add(node)
        for neighbor in prereq_edges.get(node, []):
            if neighbor not in visited:
                if has_cycle(neighbor):
                    return True
            elif neighbor in rec_stack:
                return True
        rec_stack.remove(node)
        return False

    for node in prereq_edges:
        if node not in visited:
            assert not has_cycle(node), "Cycle detected in prerequisite graph!"


@pytest.mark.asyncio
async def test_reading_taxonomy_uniqueness(db_session: AsyncSession):
    """Enforce absolute uniqueness of skill codes and (taxonomy_version_id, code) pairs."""
    await seed_reading_taxonomy(db_session)

    all_specs = REASONING_COMPETENCIES + LANGUAGE_COMPETENCIES
    codes = [s["code"] for s in all_specs]
    assert len(codes) == len(set(codes)), "Duplicate skill codes in specification!"

    # Database check: no duplicate (taxonomy_version_id, code)
    dup_stmt = (
        select(Skill.taxonomy_version_id, Skill.code, func.count(Skill.id).label("cnt"))
        .group_by(Skill.taxonomy_version_id, Skill.code)
        .having(func.count(Skill.id) > 1)
    )
    duplicates = (await db_session.execute(dup_stmt)).all()
    assert duplicates == [], f"Duplicate skill codes in database: {duplicates}"


@pytest.mark.asyncio
async def test_reading_taxonomy_hierarchy(db_session: AsyncSession):
    """Validate hierarchy integrity: container-leaf relationships, parent resolution, and acyclicity."""
    await seed_reading_taxonomy(db_session)

    skills = (await db_session.execute(select(Skill))).scalars().all()
    skill_map = {s.id: s for s in skills}
    code_map = {s.code: s for s in skills}

    all_specs = {s["code"]: s for s in REASONING_COMPETENCIES + LANGUAGE_COMPETENCIES}

    for code, spec in all_specs.items():
        assert code in code_map, f"Skill {code} missing from database"
        db_skill = code_map[code]

        if spec["parent_code"] is None:
            assert db_skill.parent_id is None, f"Root skill {code} should have parent_id=None"
        else:
            parent_code = spec["parent_code"]
            assert parent_code in code_map, f"Parent {parent_code} for {code} missing from DB"
            expected_parent = code_map[parent_code]
            assert db_skill.parent_id == expected_parent.id, f"Parent ID mismatch for {code}"

    # Verify no parent hierarchy cycles
    for s in skills:
        visited = set()
        curr = s
        while curr.parent_id is not None:
            assert curr.parent_id not in visited, f"Cycle detected in parent hierarchy involving skill {curr.code}"
            visited.add(curr.parent_id)
            curr = skill_map[curr.parent_id]


@pytest.mark.asyncio
async def test_reading_taxonomy_modality_and_task_applicability(db_session: AsyncSession):
    """Verify that every reading skill has SkillModality=reading and TaskTypeSkill associations exist."""
    await seed_reading_taxonomy(db_session)

    all_specs = REASONING_COMPETENCIES + LANGUAGE_COMPETENCIES
    codes = [s["code"] for s in all_specs]

    # Check SkillModality in DB
    stmt = (
        select(Skill.code, SkillModality.modality)
        .join(SkillModality, SkillModality.skill_id == Skill.id)
        .where(Skill.code.in_(codes), SkillModality.modality == "reading")
    )
    results = (await db_session.execute(stmt)).all()
    skills_with_reading_mod = {r[0] for r in results}

    for s in all_specs:
        if "reading" in s.get("applicable_modalities", []):
            assert s["code"] in skills_with_reading_mod, f"Skill {s['code']} missing SkillModality for 'reading'"

    # Check TaskTypeSkill in DB for all 8 task types
    tt_stmt = select(TaskType).where(TaskType.modality == "reading")
    reading_task_types = (await db_session.execute(tt_stmt)).scalars().all()
    assert len(reading_task_types) == 8

    for tt in reading_task_types:
        tts_stmt = select(TaskTypeSkill).where(TaskTypeSkill.task_type_id == tt.id)
        linked_skills = (await db_session.execute(tts_stmt)).scalars().all()
        assert len(linked_skills) > 0, f"Task type {tt.code} has no associated skills in TaskTypeSkill table"


@pytest.mark.asyncio
async def test_reading_taxonomy_prerequisite_validity(db_session: AsyncSession):
    """Validate that all prerequisite relations connect valid skills and form an acyclic graph."""
    await seed_reading_taxonomy(db_session)

    stmt = select(SkillRelation).where(SkillRelation.relation_type == SkillRelationType.PREREQUISITE)
    prereqs = (await db_session.execute(stmt)).scalars().all()
    assert len(prereqs) > 0, "No prerequisite relations found in DB"

    skill_ids = set((await db_session.execute(select(Skill.id))).scalars().all())

    # Build adjacency list
    adj: dict[uuid.UUID, list[uuid.UUID]] = {}
    for p in prereqs:
        assert p.from_skill_id in skill_ids, f"Prerequisite from_skill {p.from_skill_id} missing"
        assert p.to_skill_id in skill_ids, f"Prerequisite to_skill {p.to_skill_id} missing"
        assert p.from_skill_id != p.to_skill_id, f"Self-referential prerequisite on {p.from_skill_id}"
        adj.setdefault(p.from_skill_id, []).append(p.to_skill_id)

    # Cycle detection via 3-color DFS
    color: dict[uuid.UUID, int] = {}  # 0=unvisited, 1=visiting, 2=visited

    def dfs(node: uuid.UUID) -> bool:
        color[node] = 1
        for nxt in adj.get(node, []):
            if color.get(nxt, 0) == 1:
                return True
            if color.get(nxt, 0) == 0 and dfs(nxt):
                return True
        color[node] = 2
        return False

    for node in adj:
        if color.get(node, 0) == 0:
            assert not dfs(node), f"Prerequisite cycle detected involving skill {node}"


@pytest.mark.asyncio
async def test_reading_taxonomy_cefr_descriptor_validity(db_session: AsyncSession):
    """Ensure every assessable leaf has valid CEFR descriptors with observable evidence guidance."""
    await seed_reading_taxonomy(db_session)

    all_specs = [s for s in REASONING_COMPETENCIES + LANGUAGE_COMPETENCIES if s["assessable"]]
    skills = (await db_session.execute(select(Skill).where(Skill.code.in_([s["code"] for s in all_specs])))).scalars().all()
    skill_map = {s.code: s for s in skills}

    for spec in all_specs:
        skill = skill_map[spec["code"]]
        desc_stmt = select(SkillLevelDescriptor).where(SkillLevelDescriptor.skill_id == skill.id)
        descriptors = (await db_session.execute(desc_stmt)).scalars().all()

        assert len(descriptors) >= 2, f"Skill {spec['code']} has fewer than 2 CEFR descriptors"
        for d in descriptors:
            assert d.descriptor and len(d.descriptor.strip()) >= 20
            assert d.evidence_guidance and len(d.evidence_guidance.strip()) >= 15


@pytest.mark.asyncio
async def test_reading_taxonomy_no_duplicates(db_session: AsyncSession):
    """Verify that there are no duplicate French names within the same dimension or duplicate codes."""
    await seed_reading_taxonomy(db_session)

    # 1. Check reasoning names
    reasoning_skills = (
        await db_session.execute(
            select(Skill.name).where(Skill.dimension == SkillDimension.REASONING)
        )
    ).scalars().all()
    assert len(reasoning_skills) == len(set(reasoning_skills)), "Duplicate skill name found in reasoning dimension"

    # 2. Check language names
    language_skills = (
        await db_session.execute(
            select(Skill.name).where(Skill.dimension == SkillDimension.LANGUAGE)
        )
    ).scalars().all()
    assert len(language_skills) == len(set(language_skills)), "Duplicate skill name found in language dimension"


@pytest.mark.asyncio
async def test_reading_taxonomy_checker_full_audit(db_session: AsyncSession):
    """Run TaxonomyIntegrityChecker on seeded reading taxonomy to verify clean audit report."""
    from app.modules.admin.taxonomy_integrity import TaxonomyIntegrityChecker

    await seed_reading_taxonomy(db_session)
    report = await TaxonomyIntegrityChecker.run_integrity_check(db_session)

    assert report.is_clean is True
    assert report.error_count == 0


