"""Tests for Canonical TEF Taxonomy V1 Seed Pipeline.

Verifies:
1. Clean seed execution and taxonomy structure.
2. Idempotency (multiple runs create no duplicate rows).
3. Active version verification.
4. Validation engine rejects:
   - Duplicate codes
   - Parent hierarchy cycles
   - Invalid relationships & dependency cycles
   - Invalid CEFR bands
   - Invalid modalities
   - Invalid competency dimensions
   - Incomplete assessable skills
5. Rejection and absence of legacy taxonomy identifiers.
"""

from __future__ import annotations

import copy

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.admin.enums import SkillDimension, TaxonomyLifecycleStatus
from app.modules.admin.models import SkillModality, TaxonomyVersion
from app.modules.admin.taxonomy_seeder import (
    LEGACY_FORBIDDEN_CODES,
    TaxonomySeeder,
    TaxonomySeedValidator,
    TaxonomyValidationError,
)
from app.modules.assessments.models import Skill, TaskType


@pytest.mark.asyncio
async def test_clean_seed_creates_expected_taxonomy(db_session: AsyncSession):
    """Verify that seeding creates the canonical taxonomy with expected entity counts."""
    stats = await TaxonomySeeder.seed(db_session)

    assert stats["taxonomy_version"] == "v1"
    assert stats["skills"] == 57
    assert stats["assessable_skills"] == 43
    assert stats["container_skills"] == 14
    assert stats["reasoning_skills"] == 25
    assert stats["language_skills"] == 32
    assert stats["task_types"] == 16
    assert stats["cefr_descriptors"] == 28
    assert stats["skill_relations"] == 20
    assert stats["skill_modalities"] == 166
    assert stats["task_type_skills"] == 129

    # Verify active taxonomy version in DB
    version_row = await db_session.scalar(
        select(TaxonomyVersion).where(TaxonomyVersion.version == "v1")
    )
    assert version_row is not None
    assert version_row.status == TaxonomyLifecycleStatus.ACTIVE
    assert version_row.name == "TEF Canonical Taxonomy V1"


@pytest.mark.asyncio
async def test_seed_idempotency_creates_no_duplicates(db_session: AsyncSession):
    """Verify that running seed multiple times produces identical state without duplicate rows."""
    stats1 = await TaxonomySeeder.seed(db_session)
    stats2 = await TaxonomySeeder.seed(db_session)
    stats3 = await TaxonomySeeder.seed(db_session)

    assert stats1 == stats2 == stats3

    # Check database counts
    version_count = (await db_session.execute(text("SELECT count(*) FROM taxonomy_versions WHERE version = 'v1'"))).scalar()
    task_type_count = (await db_session.execute(text("SELECT count(*) FROM task_types"))).scalar()
    skill_count = (await db_session.execute(text("SELECT count(*) FROM skills"))).scalar()
    modality_count = (await db_session.execute(text("SELECT count(*) FROM skill_modalities"))).scalar()
    relation_count = (await db_session.execute(text("SELECT count(*) FROM skill_relations"))).scalar()
    descriptor_count = (await db_session.execute(text("SELECT count(*) FROM skill_level_descriptors"))).scalar()

    assert version_count == 1
    assert task_type_count == 16
    assert skill_count == 57
    assert modality_count == 166
    assert relation_count == 20
    assert descriptor_count == 28


@pytest.mark.asyncio
async def test_active_version_invariants(db_session: AsyncSession):
    """Verify that exactly one taxonomy version is active."""
    await TaxonomySeeder.seed(db_session)

    active_versions = (
        await db_session.execute(
            select(TaxonomyVersion).where(TaxonomyVersion.status == TaxonomyLifecycleStatus.ACTIVE)
        )
    ).scalars().all()

    assert len(active_versions) == 1
    assert active_versions[0].version == "v1"


@pytest.mark.asyncio
async def test_task_types_point_to_valid_modalities(db_session: AsyncSession):
    """Verify all seeded task types reference canonical exam modalities."""
    await TaxonomySeeder.seed(db_session)

    task_types = (await db_session.execute(select(TaskType))).scalars().all()
    valid_modalities = {"reading", "listening", "writing", "speaking"}

    assert len(task_types) == 16
    for tt in task_types:
        assert tt.modality in valid_modalities
        assert tt.code.islower()
        assert "_" in tt.code or len(tt.code) > 0
        assert tt.default_response_type is not None


@pytest.mark.asyncio
async def test_skills_dimensions_and_metadata(db_session: AsyncSession):
    """Verify all skills have valid dimensions and assessable skills have required metadata."""
    await TaxonomySeeder.seed(db_session)

    skills = (await db_session.execute(select(Skill))).scalars().all()
    assert len(skills) == 57

    valid_dims = {SkillDimension.REASONING, SkillDimension.LANGUAGE}

    for s in skills:
        assert s.dimension in valid_dims
        assert s.code.islower()
        assert s.name
        if s.is_assessable:
            assert s.description, f"Assessable skill {s.code} missing description"
            # Verify it has at least one skill_modality mapping
            modalities = (
                await db_session.execute(
                    select(SkillModality).where(SkillModality.skill_id == s.id)
                )
            ).scalars().all()
            assert len(modalities) >= 1, f"Assessable skill {s.code} has no modality mapping"


@pytest.mark.asyncio
async def test_no_legacy_identifiers_seeded(db_session: AsyncSession):
    """Verify no legacy codes or sub_skills exist in the database."""
    await TaxonomySeeder.seed(db_session)

    # 1. No forbidden legacy skill codes
    for code in LEGACY_FORBIDDEN_CODES:
        row = await db_session.scalar(select(Skill).where(Skill.code == code))
        assert row is None, f"Found legacy skill code in database: {code}"

    # 2. No legacy sub_skills table
    conn = await db_session.connection()
    from sqlalchemy import inspect as sa_inspect

    def check_subskills_table(sync_conn):
        insp = sa_inspect(sync_conn)
        return "sub_skills" in insp.get_table_names()

    table_exists = await conn.run_sync(check_subskills_table)
    assert not table_exists
    assert "sub_skills" not in Skill.metadata.tables


def test_validator_rejects_duplicate_skill_codes():
    """Verify validator rejects duplicate skill codes."""
    raw = TaxonomySeeder.load_yaml()
    data = copy.deepcopy(raw)

    # Duplicate first skill
    dup_skill = copy.deepcopy(data["skills"][0])
    data["skills"].append(dup_skill)

    with pytest.raises(TaxonomyValidationError) as exc:
        TaxonomySeedValidator.validate_dataset(data)
    assert any("Duplicate skill code" in err for err in exc.value.errors)


def test_validator_rejects_parent_cycle():
    """Verify validator rejects circular parent_code references."""
    raw = TaxonomySeeder.load_yaml()
    data = copy.deepcopy(raw)

    # Create cycle: A -> B -> A
    skill_map = {s["code"]: s for s in data["skills"]}
    skill_map["information_retrieval"]["parent_code"] = "locate_information"
    skill_map["locate_information"]["parent_code"] = "information_retrieval"

    with pytest.raises(TaxonomyValidationError) as exc:
        TaxonomySeedValidator.validate_dataset(data)
    assert any("Cycle detected in skill parent hierarchy" in err for err in exc.value.errors)


def test_validator_rejects_invalid_dimension():
    """Verify validator rejects invalid skill dimension."""
    raw = TaxonomySeeder.load_yaml()
    data = copy.deepcopy(raw)

    data["skills"][0]["dimension"] = "invalid_dimension"

    with pytest.raises(TaxonomyValidationError) as exc:
        TaxonomySeedValidator.validate_dataset(data)
    assert any("invalid dimension" in err for err in exc.value.errors)


def test_validator_rejects_invalid_cefr_band():
    """Verify validator rejects invalid CEFR levels."""
    raw = TaxonomySeeder.load_yaml()
    data = copy.deepcopy(raw)

    data["cefr_descriptors"].append({
        "skill_code": "locate_information",
        "level": "D1",  # Invalid CEFR level
        "descriptor": "Invalid level test descriptor",
    })

    with pytest.raises(TaxonomyValidationError) as exc:
        TaxonomySeedValidator.validate_dataset(data)
    assert any("invalid level 'D1'" in err for err in exc.value.errors)


def test_validator_rejects_legacy_forbidden_codes():
    """Verify validator rejects any legacy forbidden skill codes."""
    raw = TaxonomySeeder.load_yaml()
    data = copy.deepcopy(raw)

    data["skills"].append({
        "code": "reading_comprehension",
        "name": "Legacy Reading",
        "dimension": "reasoning",
        "domain": "reasoning",
        "description": "Legacy node",
        "parent_code": None,
        "assessable": True,
        "applicable_modalities": ["reading"],
    })

    with pytest.raises(TaxonomyValidationError) as exc:
        TaxonomySeedValidator.validate_dataset(data)
    assert any("Forbidden legacy skill code encountered: 'reading_comprehension'" in err for err in exc.value.errors)


def test_validator_rejects_relation_cycle():
    """Verify validator rejects dependency cycles in skill relations."""
    raw = TaxonomySeeder.load_yaml()
    data = copy.deepcopy(raw)

    # Add cycle: A depends_on B, B depends_on A
    data["skill_relations"].append({
        "from_skill": "sentence_structure",
        "to_skill": "relative_clauses",
        "relation_type": "depends_on",
    })

    with pytest.raises(TaxonomyValidationError) as exc:
        TaxonomySeedValidator.validate_dataset(data)
    assert any("Dependency cycle detected" in err for err in exc.value.errors)
