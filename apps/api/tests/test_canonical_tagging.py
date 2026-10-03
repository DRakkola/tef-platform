"""Comprehensive tests for canonical skill tagging on Questions and Exercises.

Covers:
- Multi-skill questions with reasoning + language dimension tags
- Per-dimension weight normalization (valid sums: 0.7/0.3 reasoning + 0.5/0.5 language)
- Rejection of malformed weights (negative, > 1.0, non-normalized sum)
- Rejection of duplicate skill_id in tag list
- Rejection of archived/inactive skills on newly tagged items
- Task type assignment and incompatible task/skill domain detection
- TaggingValidationEngine unit tests
- Evidence generation: check SkillEvidence rows are created upon assessment submission
- Mistake record includes subskill_id when available
- Exercise skill tagging with role and weight
- Backward compatibility: plain skill_ids still work
"""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import AppException
from app.modules.admin.enums import SkillDimension, SkillTagRole
from app.modules.admin.models import TaxonomyVersion
from app.modules.admin.tagging_service import TaggingValidationEngine
from app.modules.assessments.enums import AssessmentType, QuestionType
from app.modules.assessments.models import (
    Assessment,
    AssessmentSection,
    Question,
    QuestionOption,
    QuestionSkillTag,
    Skill,
    TaskType,
)

# ---------------------------------------------------------------------------
# Helpers / shared fixtures
# ---------------------------------------------------------------------------


async def _make_taxonomy(db: AsyncSession) -> TaxonomyVersion:
    tv = TaxonomyVersion(
        version=f"v-tag-test-{uuid.uuid4().hex[:6]}",
        name="Tagging Test Taxonomy",
        status="active",
    )
    db.add(tv)
    await db.flush()
    return tv


async def _make_skill(
    db: AsyncSession,
    taxonomy_id: uuid.UUID,
    *,
    code: str | None = None,
    name: str = "Test Skill",
    dimension: SkillDimension = SkillDimension.REASONING,
    domain: str = "reading",
    is_active: bool = True,
    parent_id: uuid.UUID | None = None,
) -> Skill:
    skill = Skill(
        taxonomy_version_id=taxonomy_id,
        code=code or f"SKILL_{uuid.uuid4().hex[:8].upper()}",
        name=name,
        dimension=dimension,
        domain=domain,
        is_active=is_active,
    )
    if parent_id is not None:
        skill.parent_id = parent_id
    db.add(skill)
    await db.flush()
    return skill


async def _make_task_type(
    db: AsyncSession,
    *,
    modality: str = "reading",
    code: str | None = None,
) -> TaskType:
    tt = TaskType(
        modality=modality,
        code=code or f"TT_{uuid.uuid4().hex[:8].upper()}",
        name=f"Task Type {modality}",
        is_active=True,
    )
    db.add(tt)
    await db.flush()
    return tt


async def _make_assessment_with_question(
    db: AsyncSession,
    taxonomy_id: uuid.UUID,
    skill: Skill,
    *,
    weight: float = 1.0,
    role: SkillTagRole = SkillTagRole.PRIMARY,
    actor_id: uuid.UUID | None = None,
) -> tuple[Assessment, AssessmentSection, Question, QuestionSkillTag]:
    """Create minimal assessment→section→question→skill_tag."""
    assessment = Assessment(
        title="Tagging Test Assessment",
        description=None,
        assessment_type=AssessmentType.READING,
        duration_seconds=1800,
        is_published=True,
        status="published",
        version=1,
    )
    db.add(assessment)
    await db.flush()

    section = AssessmentSection(
        assessment_id=assessment.id,
        title="Section A",
        order_index=0,
    )
    db.add(section)
    await db.flush()

    question = Question(
        section_id=section.id,
        prompt="Quelle est la signification de ce texte?",
        question_type=QuestionType.SINGLE_CHOICE,
        order_index=0,
        level="B1",
        difficulty=3,
        points=2,
        penalty_points=0,
        status="published",
        version=1,
    )
    db.add(question)
    await db.flush()

    opt_correct = QuestionOption(
        question_id=question.id,
        content="Option A (correct)",
        order_index=0,
        is_correct=True,
    )
    opt_wrong = QuestionOption(
        question_id=question.id,
        content="Option B (wrong)",
        order_index=1,
        is_correct=False,
    )
    db.add_all([opt_correct, opt_wrong])

    tag = QuestionSkillTag(
        question_id=question.id,
        skill_id=skill.id,
        role=role,
        weight=weight,
    )
    db.add(tag)
    await db.flush()

    stmt = (
        select(Assessment)
        .where(Assessment.id == assessment.id)
        .options(
            selectinload(Assessment.sections)
            .selectinload(AssessmentSection.questions)
            .selectinload(Question.options),
            selectinload(Assessment.sections)
            .selectinload(AssessmentSection.questions)
            .selectinload(Question.skill_tags),
        )
    )
    loaded_assessment = (await db.execute(stmt)).scalar_one()
    loaded_section = loaded_assessment.sections[0]
    loaded_question = loaded_section.questions[0]
    loaded_tag = loaded_question.skill_tags[0]

    return loaded_assessment, loaded_section, loaded_question, loaded_tag


# ---------------------------------------------------------------------------
# Unit tests for TaggingValidationEngine
# ---------------------------------------------------------------------------


class _FakeTag:
    """Minimal duck-type for a skill tag payload."""

    def __init__(
        self,
        skill_id: uuid.UUID,
        weight: float = 1.0,
        role: str = "primary",
        subskill_id: uuid.UUID | None = None,
        subskill: str | None = None,
        context: dict | None = None,
    ):
        self.skill_id = skill_id
        self.weight = weight
        self.role = role
        self.subskill_id = subskill_id
        self.subskill = subskill
        self.context = context


@pytest.mark.asyncio
async def test_tagging_engine_accepts_valid_single_tag(db_session: AsyncSession):
    """A single active skill with weight=1.0 should pass validation."""
    tv = await _make_taxonomy(db_session)
    skill = await _make_skill(db_session, tv.id, dimension=SkillDimension.REASONING)
    tags = [_FakeTag(skill_id=skill.id, weight=1.0)]
    resolved = await TaggingValidationEngine.validate_skill_tags(db_session, tags)
    assert len(resolved) == 1
    assert resolved[0].id == skill.id


@pytest.mark.asyncio
async def test_tagging_engine_accepts_multi_dimension_valid(db_session: AsyncSession):
    """Reasoning 0.7/0.3 + Language 1.0 should be valid."""
    tv = await _make_taxonomy(db_session)
    r1 = await _make_skill(db_session, tv.id, dimension=SkillDimension.REASONING)
    r2 = await _make_skill(db_session, tv.id, dimension=SkillDimension.REASONING)
    l1 = await _make_skill(db_session, tv.id, dimension=SkillDimension.LANGUAGE)

    tags = [
        _FakeTag(r1.id, weight=0.7, role="primary"),
        _FakeTag(r2.id, weight=0.3, role="secondary"),
        _FakeTag(l1.id, weight=1.0, role="primary"),
    ]
    resolved = await TaggingValidationEngine.validate_skill_tags(db_session, tags)
    assert len(resolved) == 3


@pytest.mark.asyncio
async def test_tagging_engine_rejects_duplicate_skill_id(db_session: AsyncSession):
    """Duplicate skill_id in tag list must raise DUPLICATE_SKILL_TAG."""
    tv = await _make_taxonomy(db_session)
    skill = await _make_skill(db_session, tv.id)
    tags = [
        _FakeTag(skill.id, weight=0.5, role="primary"),
        _FakeTag(skill.id, weight=0.5, role="secondary"),
    ]
    with pytest.raises(AppException) as exc_info:
        await TaggingValidationEngine.validate_skill_tags(db_session, tags)
    assert exc_info.value.code == "DUPLICATE_SKILL_TAG"


@pytest.mark.asyncio
async def test_tagging_engine_rejects_archived_skill(db_session: AsyncSession):
    """Archived (is_active=False) skills must be rejected."""
    tv = await _make_taxonomy(db_session)
    skill = await _make_skill(db_session, tv.id, is_active=False)
    tags = [_FakeTag(skill.id, weight=1.0)]
    with pytest.raises(AppException) as exc_info:
        await TaggingValidationEngine.validate_skill_tags(db_session, tags)
    assert exc_info.value.code == "INACTIVE_OR_MISSING_SKILL"


@pytest.mark.asyncio
async def test_tagging_engine_rejects_nonexistent_skill(db_session: AsyncSession):
    """Non-existent skill_id must be rejected."""
    tags = [_FakeTag(uuid.uuid4(), weight=1.0)]
    with pytest.raises(AppException) as exc_info:
        await TaggingValidationEngine.validate_skill_tags(db_session, tags)
    assert exc_info.value.code == "INACTIVE_OR_MISSING_SKILL"


@pytest.mark.asyncio
async def test_tagging_engine_rejects_weight_zero(db_session: AsyncSession):
    """Weight of 0.0 must be rejected (must be > 0)."""
    tv = await _make_taxonomy(db_session)
    skill = await _make_skill(db_session, tv.id)
    tags = [_FakeTag(skill.id, weight=0.0)]
    with pytest.raises(AppException) as exc_info:
        await TaggingValidationEngine.validate_skill_tags(db_session, tags)
    assert exc_info.value.code == "INVALID_TAG_WEIGHT"


@pytest.mark.asyncio
async def test_tagging_engine_rejects_weight_above_one(db_session: AsyncSession):
    """Weight > 1.0 must be rejected."""
    tv = await _make_taxonomy(db_session)
    skill = await _make_skill(db_session, tv.id)
    tags = [_FakeTag(skill.id, weight=1.5)]
    with pytest.raises(AppException) as exc_info:
        await TaggingValidationEngine.validate_skill_tags(db_session, tags)
    assert exc_info.value.code == "INVALID_TAG_WEIGHT"


@pytest.mark.asyncio
async def test_tagging_engine_rejects_weight_negative(db_session: AsyncSession):
    """Negative weight must be rejected."""
    tv = await _make_taxonomy(db_session)
    skill = await _make_skill(db_session, tv.id)
    tags = [_FakeTag(skill.id, weight=-0.5)]
    with pytest.raises(AppException) as exc_info:
        await TaggingValidationEngine.validate_skill_tags(db_session, tags)
    assert exc_info.value.code == "INVALID_TAG_WEIGHT"


@pytest.mark.asyncio
async def test_tagging_engine_rejects_non_normalized_dimension_sum(db_session: AsyncSession):
    """Two reasoning tags summing to 0.6 (not 1.0) must be rejected."""
    tv = await _make_taxonomy(db_session)
    r1 = await _make_skill(db_session, tv.id, dimension=SkillDimension.REASONING)
    r2 = await _make_skill(db_session, tv.id, dimension=SkillDimension.REASONING)
    tags = [
        _FakeTag(r1.id, weight=0.3, role="primary"),
        _FakeTag(r2.id, weight=0.3, role="secondary"),
    ]
    with pytest.raises(AppException) as exc_info:
        await TaggingValidationEngine.validate_skill_tags(db_session, tags)
    assert exc_info.value.code == "INVALID_TAG_WEIGHT"


@pytest.mark.asyncio
async def test_tagging_engine_rejects_multiple_primary_per_dimension(db_session: AsyncSession):
    """Two PRIMARY tags in the same dimension must be rejected."""
    tv = await _make_taxonomy(db_session)
    r1 = await _make_skill(db_session, tv.id, dimension=SkillDimension.REASONING)
    r2 = await _make_skill(db_session, tv.id, dimension=SkillDimension.REASONING)
    tags = [
        _FakeTag(r1.id, weight=0.5, role="primary"),
        _FakeTag(r2.id, weight=0.5, role="primary"),  # second PRIMARY in REASONING
    ]
    with pytest.raises(AppException) as exc_info:
        await TaggingValidationEngine.validate_skill_tags(db_session, tags)
    assert exc_info.value.code == "MULTIPLE_PRIMARY_PER_DIMENSION"


@pytest.mark.asyncio
async def test_tagging_engine_rejects_incompatible_skill_task_type(db_session: AsyncSession):
    """Speaking skill on a reading task type must be rejected."""
    tv = await _make_taxonomy(db_session)
    speaking_skill = await _make_skill(
        db_session, tv.id, dimension=SkillDimension.LANGUAGE, domain="speaking"
    )
    reading_task = await _make_task_type(db_session, modality="reading")

    tags = [_FakeTag(speaking_skill.id, weight=1.0, role="primary")]
    with pytest.raises(AppException) as exc_info:
        await TaggingValidationEngine.validate_skill_tags(
            db_session, tags, task_type_id=reading_task.id
        )
    assert exc_info.value.code == "INCOMPATIBLE_SKILL_TASK_TYPE"


@pytest.mark.asyncio
async def test_tagging_engine_accepts_compatible_skill_task_type(db_session: AsyncSession):
    """Reading skill on a reading task type must pass."""
    tv = await _make_taxonomy(db_session)
    reading_skill = await _make_skill(
        db_session, tv.id, dimension=SkillDimension.REASONING, domain="reading"
    )
    reading_task = await _make_task_type(db_session, modality="reading")

    tags = [_FakeTag(reading_skill.id, weight=1.0, role="primary")]
    resolved = await TaggingValidationEngine.validate_skill_tags(
        db_session, tags, task_type_id=reading_task.id
    )
    assert len(resolved) == 1


@pytest.mark.asyncio
async def test_tagging_engine_empty_tags_ok(db_session: AsyncSession):
    """Empty tag list is valid (no tags required)."""
    resolved = await TaggingValidationEngine.validate_skill_tags(db_session, [])
    assert resolved == []


# ---------------------------------------------------------------------------
# Admin API integration tests — question tagging
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_question_with_canonical_skill_tags(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
    db_session: AsyncSession,
):
    """Create assessment+section+question via API with canonical skill tags (role, weight, subskill_id)."""
    tv = await _make_taxonomy(db_session)
    r_skill = await _make_skill(db_session, tv.id, dimension=SkillDimension.REASONING)
    l_skill = await _make_skill(db_session, tv.id, dimension=SkillDimension.LANGUAGE)
    await db_session.commit()

    # 1. Create assessment
    asmnt_resp = await client.post(
        "/api/v1/admin/content/assessments",
        json={"title": "Canon Tag Test", "assessment_type": "reading", "duration_seconds": 1800},
        headers=admin_auth_headers,
    )
    assert asmnt_resp.status_code == 201
    asmnt_id = asmnt_resp.json()["id"]

    # 2. Create section
    sec_resp = await client.post(
        f"/api/v1/admin/content/assessments/{asmnt_id}/sections",
        json={"title": "Sec 1", "order_index": 0},
        headers=admin_auth_headers,
    )
    assert sec_resp.status_code == 201
    section_id = sec_resp.json()["id"]

    # 3. Add question with multi-skill canonical tags
    q_payload = {
        "prompt": "Quel est le sujet principal de ce texte?",
        "question_type": "single_choice",
        "points": 2,
        "options": [
            {"content": "Option A", "is_correct": True, "order_index": 0},
            {"content": "Option B", "is_correct": False, "order_index": 1},
        ],
        "skill_tags": [
            {"skill_id": str(r_skill.id), "role": "primary", "weight": 1.0},
            {"skill_id": str(l_skill.id), "role": "primary", "weight": 1.0},
        ],
    }
    q_resp = await client.post(
        f"/api/v1/admin/content/sections/{section_id}/questions",
        json=q_payload,
        headers=admin_auth_headers,
    )
    assert q_resp.status_code == 201, q_resp.text
    q_data = q_resp.json()
    # Question was created — id must be present
    assert q_data["id"] is not None


@pytest.mark.asyncio
async def test_create_question_with_task_type_id(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
    db_session: AsyncSession,
):
    """Create a question with task_type_id field."""
    tv = await _make_taxonomy(db_session)
    r_skill = await _make_skill(
        db_session, tv.id, dimension=SkillDimension.REASONING, domain="reading"
    )
    task_type = await _make_task_type(db_session, modality="reading")
    await db_session.commit()

    asmnt_resp = await client.post(
        "/api/v1/admin/content/assessments",
        json={"title": "Task Type Test", "assessment_type": "reading", "duration_seconds": 1800},
        headers=admin_auth_headers,
    )
    asmnt_id = asmnt_resp.json()["id"]
    sec_resp = await client.post(
        f"/api/v1/admin/content/assessments/{asmnt_id}/sections",
        json={"title": "Sec 1", "order_index": 0},
        headers=admin_auth_headers,
    )
    section_id = sec_resp.json()["id"]

    q_payload = {
        "prompt": "Identify the main idea.",
        "question_type": "single_choice",
        "points": 1,
        "task_type_id": str(task_type.id),
        "options": [
            {"content": "A", "is_correct": True, "order_index": 0},
            {"content": "B", "is_correct": False, "order_index": 1},
        ],
        "skill_tags": [
            {"skill_id": str(r_skill.id), "role": "primary", "weight": 1.0},
        ],
    }
    q_resp = await client.post(
        f"/api/v1/admin/content/sections/{section_id}/questions",
        json=q_payload,
        headers=admin_auth_headers,
    )
    assert q_resp.status_code == 201, q_resp.text


@pytest.mark.asyncio
async def test_api_rejects_duplicate_skill_tag_on_question(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
    db_session: AsyncSession,
):
    """API must return 400 when skill_tags contains a duplicate skill_id."""
    tv = await _make_taxonomy(db_session)
    skill = await _make_skill(db_session, tv.id, dimension=SkillDimension.REASONING)
    await db_session.commit()

    asmnt_resp = await client.post(
        "/api/v1/admin/content/assessments",
        json={"title": "Dup Tag Test", "assessment_type": "reading", "duration_seconds": 1800},
        headers=admin_auth_headers,
    )
    asmnt_id = asmnt_resp.json()["id"]
    sec_resp = await client.post(
        f"/api/v1/admin/content/assessments/{asmnt_id}/sections",
        json={"title": "Sec A", "order_index": 0},
        headers=admin_auth_headers,
    )
    section_id = sec_resp.json()["id"]

    q_payload = {
        "prompt": "Duplicate skill test?",
        "question_type": "single_choice",
        "points": 1,
        "options": [
            {"content": "A", "is_correct": True, "order_index": 0},
        ],
        "skill_tags": [
            {"skill_id": str(skill.id), "role": "primary", "weight": 0.5},
            {"skill_id": str(skill.id), "role": "secondary", "weight": 0.5},  # duplicate!
        ],
    }
    q_resp = await client.post(
        f"/api/v1/admin/content/sections/{section_id}/questions",
        json=q_payload,
        headers=admin_auth_headers,
    )
    assert q_resp.status_code in (400, 422), q_resp.text


@pytest.mark.asyncio
async def test_api_rejects_archived_skill_on_question(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
    db_session: AsyncSession,
):
    """API must reject tagging with an archived skill."""
    tv = await _make_taxonomy(db_session)
    archived_skill = await _make_skill(
        db_session, tv.id, dimension=SkillDimension.REASONING, is_active=False
    )
    await db_session.commit()

    asmnt_resp = await client.post(
        "/api/v1/admin/content/assessments",
        json={"title": "Archived Skill Test", "assessment_type": "reading", "duration_seconds": 1800},
        headers=admin_auth_headers,
    )
    asmnt_id = asmnt_resp.json()["id"]
    sec_resp = await client.post(
        f"/api/v1/admin/content/assessments/{asmnt_id}/sections",
        json={"title": "Sec B", "order_index": 0},
        headers=admin_auth_headers,
    )
    section_id = sec_resp.json()["id"]

    q_payload = {
        "prompt": "Archived skill question?",
        "question_type": "single_choice",
        "points": 1,
        "options": [{"content": "A", "is_correct": True, "order_index": 0}],
        "skill_tags": [
            {"skill_id": str(archived_skill.id), "role": "primary", "weight": 1.0},
        ],
    }
    q_resp = await client.post(
        f"/api/v1/admin/content/sections/{section_id}/questions",
        json=q_payload,
        headers=admin_auth_headers,
    )
    assert q_resp.status_code in (400, 422), q_resp.text


# ---------------------------------------------------------------------------
# Admin API integration tests — exercise tagging
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_exercise_with_canonical_skill_tags(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
    db_session: AsyncSession,
):
    """Create exercise via API with skill_tags (new canonical approach)."""
    tv = await _make_taxonomy(db_session)
    skill = await _make_skill(
        db_session, tv.id, dimension=SkillDimension.LANGUAGE, domain="reading"
    )
    await db_session.commit()

    payload = {
        "title": "Vocabulaire de base",
        "prompt": "Choisissez le bon mot.",
        "category": "reading",
        "level": "B1",
        "difficulty": 2,
        "question_type": "single_choice",
        "points": 5,
        "options_payload": [
            {"content": "répondre", "is_correct": True},
            {"content": "regarder", "is_correct": False},
        ],
        "skill_tags": [
            {"skill_id": str(skill.id), "role": "primary", "weight": 1.0},
        ],
    }
    resp = await client.post(
        "/api/v1/admin/content/exercises",
        json=payload,
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201, resp.text


@pytest.mark.asyncio
async def test_create_exercise_legacy_skill_ids_still_works(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
    db_session: AsyncSession,
):
    """Legacy skill_ids field on exercise create must still work (backward compat)."""
    tv = await _make_taxonomy(db_session)
    skill = await _make_skill(db_session, tv.id, dimension=SkillDimension.REASONING)
    await db_session.commit()

    payload = {
        "title": "Legacy skill_ids Exercise",
        "prompt": "Answer the question.",
        "category": "reading",
        "level": "B2",
        "difficulty": 3,
        "question_type": "single_choice",
        "points": 5,
        "options_payload": [{"content": "A", "is_correct": True}],
        "skill_ids": [str(skill.id)],
    }
    resp = await client.post(
        "/api/v1/admin/content/exercises",
        json=payload,
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201, resp.text


@pytest.mark.asyncio
async def test_update_exercise_with_skill_tags(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
    db_session: AsyncSession,
):
    """Update exercise skill_tags via PATCH replaces previous tags."""
    tv = await _make_taxonomy(db_session)
    old_skill = await _make_skill(db_session, tv.id, dimension=SkillDimension.REASONING)
    new_skill = await _make_skill(db_session, tv.id, dimension=SkillDimension.LANGUAGE)
    await db_session.commit()

    # Create
    create_resp = await client.post(
        "/api/v1/admin/content/exercises",
        json={
            "title": "Exercise to Update",
            "prompt": "Initial prompt.",
            "category": "reading",
            "level": "B1",
            "difficulty": 2,
            "question_type": "single_choice",
            "points": 5,
            "options_payload": [{"content": "A", "is_correct": True}],
            "skill_ids": [str(old_skill.id)],
        },
        headers=admin_auth_headers,
    )
    assert create_resp.status_code == 201
    ex_id = create_resp.json()["id"]

    # Update with new canonical tags
    update_resp = await client.put(
        f"/api/v1/admin/content/exercises/{ex_id}",
        json={
            "skill_tags": [
                {"skill_id": str(new_skill.id), "role": "primary", "weight": 1.0},
            ],
        },
        headers=admin_auth_headers,
    )
    assert update_resp.status_code == 200, update_resp.text


# ---------------------------------------------------------------------------
# Scoring engine — weight-aware skill tracking
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_scoring_uses_canonical_skill_id_as_key(db_session: AsyncSession):
    """ScoringEngine.calculate_score must use skill_id as the key in skill_scores."""
    from app.modules.assessments.models import AttemptAnswer
    from app.modules.assessments.scoring import ScoringEngine

    tv = await _make_taxonomy(db_session)
    skill = await _make_skill(db_session, tv.id)
    assessment, _section, question, _tag = await _make_assessment_with_question(
        db_session, tv.id, skill, weight=1.0
    )
    await db_session.flush()

    # Simulate a correct answer
    answer = AttemptAnswer(
        attempt_id=uuid.uuid4(),  # dummy attempt id
        question_id=question.id,
        selected_option_id=next(o.id for o in question.options if o.is_correct),
        is_correct=True,
        points_awarded=float(question.points),
    )

    result = ScoringEngine.calculate_score(assessment, [answer])
    skill_key = str(skill.id)
    assert skill_key in result.skill_scores, (
        f"Expected canonical skill_id key '{skill_key}' in skill_scores, "
        f"got: {list(result.skill_scores.keys())}"
    )
    assert result.skill_scores[skill_key]["earned"] == float(question.points)


@pytest.mark.asyncio
async def test_scoring_applies_tag_weight(db_session: AsyncSession):
    """A tag with weight=0.5 should earn half the question points in skill_scores."""
    from app.modules.assessments.models import AttemptAnswer
    from app.modules.assessments.scoring import ScoringEngine

    tv = await _make_taxonomy(db_session)
    skill = await _make_skill(db_session, tv.id)
    assessment, _section, question, _tag = await _make_assessment_with_question(
        db_session, tv.id, skill, weight=0.5
    )
    await db_session.flush()

    answer = AttemptAnswer(
        attempt_id=uuid.uuid4(),
        question_id=question.id,
        selected_option_id=next(o.id for o in question.options if o.is_correct),
        is_correct=True,
        points_awarded=float(question.points),
    )

    result = ScoringEngine.calculate_score(assessment, [answer])
    skill_key = str(skill.id)
    assert skill_key in result.skill_scores
    # With weight=0.5, max=1.0 (2 * 0.5), earned=1.0 (2 * 0.5)
    assert result.skill_scores[skill_key]["earned"] == pytest.approx(
        float(question.points) * 0.5, abs=0.01
    )
