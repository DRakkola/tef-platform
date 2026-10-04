"""Tests for Taxonomy V2 relational metadata, dynamic task applicability, and legacy aliases.

Verifies:
1. Valid modality/skill combinations work via SkillModality.
2. Invalid modality/skill combinations are rejected dynamically.
3. Removing a taxonomy relationship (TaskTypeSkill) changes behavior without editing Python.
4. Legacy code aliases resolve correctly to canonical competencies.
5. Canonical code conventions (lowercase, snake_case) are strictly enforced on mutations.
"""

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException
from app.modules.admin.enums import SkillDimension, SkillTagRole
from app.modules.admin.models import (
    TaxonomyVersion,
)
from app.modules.admin.tagging_service import TaggingValidationEngine
from app.modules.admin.taxonomy_schemas import (
    TaxonomySkillCreate,
)
from app.modules.admin.taxonomy_service import TaxonomyService
from app.modules.assessments.models import Skill, TaskType

# ---------------------------------------------------------------------------
# Test Helpers
# ---------------------------------------------------------------------------


class MockTag:
    def __init__(
        self,
        skill_id: uuid.UUID,
        role: SkillTagRole = SkillTagRole.PRIMARY,
        weight: float = 1.0,
        subskill_id: uuid.UUID | None = None,
    ):
        self.skill_id = skill_id
        self.role = role
        self.weight = weight
        self.subskill_id = subskill_id


async def _create_test_taxonomy(db: AsyncSession) -> TaxonomyVersion:
    tv = TaxonomyVersion(
        version=f"v2-meta-{uuid.uuid4().hex[:6]}",
        name="Metadata Test Taxonomy",
        status="active",
    )
    db.add(tv)
    await db.flush()
    return tv


async def _create_test_skill(
    db: AsyncSession,
    tax_id: uuid.UUID,
    code: str,
    name: str,
    dimension: SkillDimension = SkillDimension.REASONING,
    domain: str = "reading",
) -> Skill:
    skill = Skill(
        taxonomy_version_id=tax_id,
        code=code,
        name=name,
        dimension=dimension,
        domain=domain,
        is_active=True,
    )
    db.add(skill)
    await db.flush()
    return skill


async def _create_test_task_type(
    db: AsyncSession,
    code: str,
    name: str,
    modality: str,
) -> TaskType:
    tt = TaskType(
        code=code,
        name=name,
        modality=modality,
        is_active=True,
    )
    db.add(tt)
    await db.flush()
    return tt


# ---------------------------------------------------------------------------
# Requirement 1 & 2: Valid and Invalid Modality/Skill Combinations
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_valid_modality_skill_combinations(db_session: AsyncSession) -> None:
    """Prove that competencies configured with matching modalities in SkillModality pass validation."""
    tax = await _create_test_taxonomy(db_session)
    reading_skill = await _create_test_skill(
        db_session, tax.id, "reasoning_reading_test", "Reading Skill", SkillDimension.REASONING, "reading"
    )
    reading_task = await _create_test_task_type(
        db_session, "tt_reading_doc", "Reading Task", "reading"
    )

    # Associate reading modality
    await TaxonomyService.set_skill_modalities(db_session, reading_skill.id, ["reading"])

    tags = [MockTag(skill_id=reading_skill.id, role=SkillTagRole.PRIMARY, weight=1.0)]
    resolved = await TaggingValidationEngine.validate_skill_tags(
        db=db_session, tags=tags, task_type_id=reading_task.id
    )
    assert len(resolved) == 1
    assert resolved[0].id == reading_skill.id


@pytest.mark.asyncio
async def test_transversal_language_modality_combinations(db_session: AsyncSession) -> None:
    """Prove that transversal language skills mapped to multiple modalities pass on all of them."""
    tax = await _create_test_taxonomy(db_session)
    lang_skill = await _create_test_skill(
        db_session, tax.id, "lang_grammar_test", "Grammar Competency", SkillDimension.LANGUAGE, "grammar"
    )
    reading_task = await _create_test_task_type(
        db_session, "tt_reading_lang", "Reading Task", "reading"
    )
    speaking_task = await _create_test_task_type(
        db_session, "tt_speaking_lang", "Speaking Task", "speaking"
    )

    # Transversal competency applies to reading and speaking
    await TaxonomyService.set_skill_modalities(db_session, lang_skill.id, ["reading", "speaking"])

    # Valid on reading
    tags = [MockTag(skill_id=lang_skill.id, role=SkillTagRole.PRIMARY, weight=1.0)]
    res_reading = await TaggingValidationEngine.validate_skill_tags(
        db=db_session, tags=tags, task_type_id=reading_task.id
    )
    assert len(res_reading) == 1

    # Valid on speaking
    res_speaking = await TaggingValidationEngine.validate_skill_tags(
        db=db_session, tags=tags, task_type_id=speaking_task.id
    )
    assert len(res_speaking) == 1


@pytest.mark.asyncio
async def test_invalid_modality_skill_combination_rejected(db_session: AsyncSession) -> None:
    """Prove that tagging a skill onto an incompatible exam modality is rejected via taxonomy metadata."""
    tax = await _create_test_taxonomy(db_session)
    speaking_skill = await _create_test_skill(
        db_session, tax.id, "reasoning_speaking_fluency", "Oral Expression", SkillDimension.REASONING, "speaking"
    )
    reading_task = await _create_test_task_type(
        db_session, "tt_reading_reject", "Reading Task", "reading"
    )

    # Associate speaking only
    await TaxonomyService.set_skill_modalities(db_session, speaking_skill.id, ["speaking"])

    tags = [MockTag(skill_id=speaking_skill.id, role=SkillTagRole.PRIMARY, weight=1.0)]
    with pytest.raises(AppException) as exc_info:
        await TaggingValidationEngine.validate_skill_tags(
            db=db_session, tags=tags, task_type_id=reading_task.id
        )

    assert exc_info.value.status_code == 422
    assert exc_info.value.code == "INCOMPATIBLE_SKILL_TASK_TYPE"
    assert "speaking" in str(exc_info.value.message)


# ---------------------------------------------------------------------------
# Requirement 3: Dynamic Relational Behavior (TaskTypeSkill removal)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_removing_taxonomy_relationship_changes_behavior_dynamically(db_session: AsyncSession) -> None:
    """Prove that removing a TaskTypeSkill relational row dynamically alters validation WITHOUT Python code changes."""
    tax = await _create_test_taxonomy(db_session)
    skill_a = await _create_test_skill(
        db_session, tax.id, "reasoning_skill_allowed", "Allowed Skill", SkillDimension.REASONING, "reading"
    )
    skill_b = await _create_test_skill(
        db_session, tax.id, "reasoning_skill_revoked", "Revoked Skill", SkillDimension.REASONING, "reading"
    )
    task_type = await _create_test_task_type(
        db_session, "tt_dynamic_test", "Dynamic Task", "reading"
    )

    # Ensure both skills support reading modality
    await TaxonomyService.set_skill_modalities(db_session, skill_a.id, ["reading"])
    await TaxonomyService.set_skill_modalities(db_session, skill_b.id, ["reading"])

    # Explicitly link BOTH skills to this task type in the database
    await TaxonomyService.add_task_type_skill(db_session, task_type.id, skill_a.id)
    await TaxonomyService.add_task_type_skill(db_session, task_type.id, skill_b.id)

    # Both skills should be accepted
    tag_a = [MockTag(skill_id=skill_a.id, role=SkillTagRole.PRIMARY, weight=1.0)]
    tag_b = [MockTag(skill_id=skill_b.id, role=SkillTagRole.PRIMARY, weight=1.0)]

    res_a = await TaggingValidationEngine.validate_skill_tags(db=db_session, tags=tag_a, task_type_id=task_type.id)
    res_b = await TaggingValidationEngine.validate_skill_tags(db=db_session, tags=tag_b, task_type_id=task_type.id)
    assert len(res_a) == 1
    assert len(res_b) == 1

    # DYNAMIC REMOVAL: Remove skill_b from task_type_skills in the database
    removed = await TaxonomyService.remove_task_type_skill(db_session, task_type.id, skill_b.id)
    assert removed is True

    # Now, validating skill_a still succeeds
    res_a_after = await TaggingValidationEngine.validate_skill_tags(db=db_session, tags=tag_a, task_type_id=task_type.id)
    assert len(res_a_after) == 1

    # But validating skill_b MUST BE REJECTED purely because the DB relationship was deleted!
    with pytest.raises(AppException) as exc_info:
        await TaggingValidationEngine.validate_skill_tags(db=db_session, tags=tag_b, task_type_id=task_type.id)

    assert exc_info.value.status_code == 422
    assert exc_info.value.code == "INCOMPATIBLE_SKILL_TASK_TYPE"
    assert "reasoning_skill_revoked" in str(exc_info.value.message)


# ---------------------------------------------------------------------------
# Requirement 4: Legacy Code Aliases Resolution
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_legacy_code_aliases_resolve_correctly(db_session: AsyncSession) -> None:
    """Prove that legacy machine identifiers ('EO', 'EE', 'speaking_b2', etc.) resolve to canonical skills."""
    tax = await _create_test_taxonomy(db_session)
    speak_code = f"speaking_expression_{uuid.uuid4().hex[:6]}"
    write_code = f"writing_argumentation_{uuid.uuid4().hex[:6]}"
    alias_eo = f"EO_{uuid.uuid4().hex[:4].upper()}"
    alias_orale = f"expression_orale_{uuid.uuid4().hex[:4]}"
    alias_b2 = f"speaking_b2_{uuid.uuid4().hex[:4]}"
    alias_ee = f"EE_{uuid.uuid4().hex[:4].upper()}"
    alias_ecrite = f"expression_ecrite_{uuid.uuid4().hex[:4]}"

    speaking_canonical = await _create_test_skill(
        db_session, tax.id, speak_code, "Expression Orale", SkillDimension.LANGUAGE, "speaking"
    )
    writing_canonical = await _create_test_skill(
        db_session, tax.id, write_code, "Expression Écrite", SkillDimension.LANGUAGE, "writing"
    )

    # Register legacy aliases
    await TaxonomyService.register_skill_alias(db_session, speaking_canonical.id, alias_eo)
    await TaxonomyService.register_skill_alias(db_session, speaking_canonical.id, alias_orale)
    await TaxonomyService.register_skill_alias(db_session, speaking_canonical.id, alias_b2)

    await TaxonomyService.register_skill_alias(db_session, writing_canonical.id, alias_ee)
    await TaxonomyService.register_skill_alias(db_session, writing_canonical.id, alias_ecrite)

    # 1. Resolve canonical directly
    res1 = await TaxonomyService.resolve_skill_by_code_or_alias(db_session, speak_code)
    assert res1 is not None and res1.id == speaking_canonical.id

    # 2. Resolve via legacy aliases
    res_eo = await TaxonomyService.resolve_skill_by_code_or_alias(db_session, alias_eo)
    assert res_eo is not None and res_eo.id == speaking_canonical.id

    res_orale = await TaxonomyService.resolve_skill_by_code_or_alias(db_session, alias_orale)
    assert res_orale is not None and res_orale.id == speaking_canonical.id

    res_ee = await TaxonomyService.resolve_skill_by_code_or_alias(db_session, alias_ee)
    assert res_ee is not None and res_ee.id == writing_canonical.id

    res_ecrite = await TaxonomyService.resolve_skill_by_code_or_alias(db_session, alias_ecrite)
    assert res_ecrite is not None and res_ecrite.id == writing_canonical.id

    # Case insensitivity test
    res_case = await TaxonomyService.resolve_skill_by_code_or_alias(db_session, alias_eo.lower())
    assert res_case is not None and res_case.id == speaking_canonical.id

    # Non-existent returns None
    res_none = await TaxonomyService.resolve_skill_by_code_or_alias(db_session, "non_existent_code_xyz")
    assert res_none is None


# ---------------------------------------------------------------------------
# Canonical Code Convention Enforcement
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_canonical_code_convention_enforcement(db_session: AsyncSession) -> None:
    """Prove that skill creation enforces lowercase snake_case and rejects non-conforming formats."""
    tax = await _create_test_taxonomy(db_session)

    # Valid code works
    valid_create = TaxonomySkillCreate(
        code="reasoning_test_canonical",
        name="Valid Canonical Skill",
        dimension=SkillDimension.REASONING,
        domain="reading",
        taxonomy_version_id=tax.id,
    )
    detail = await TaxonomyService.create_skill(db_session, valid_create)
    assert detail.code == "reasoning_test_canonical"

    # Non-canonical codes are rejected:
    invalid_codes = [
        "UPPERCASE_CODE",
        "kebab-case-code",
        "has space",
        "special@char",
        "épreuve_accent",
    ]

    for inv_code in invalid_codes:
        # Either Pydantic schema validation or service validation must reject
        with pytest.raises((AppException, ValueError)):
            payload = TaxonomySkillCreate(
                code=inv_code,
                name="Invalid Skill",
                dimension=SkillDimension.REASONING,
                domain="reading",
                taxonomy_version_id=tax.id,
            )
            await TaxonomyService.create_skill(db_session, payload)
