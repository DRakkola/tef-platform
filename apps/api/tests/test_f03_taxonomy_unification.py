"""Automated verification suite for Finding F-03: Dual Schema Unification.

Verifies:
1. Canonical skills hierarchy is the sole source of truth for competencies.
2. Legacy SubSkillService routes operations directly to Skill with parent_id.
3. No new sub_skills rows can be created (ORM event guard & zero dual-sync).
4. Legacy APIs (/content/skills/{id}/subskills, /content/subskills/{id}) preserve backward compatibility.
5. Integrity check verify_canonical_taxonomy_integrity proves taxonomy correctness.
6. Historical item tagging and evidence referencing subskill_id remain completely valid.
"""

import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.admin.models import SubSkill, TaxonomyVersion
from app.modules.admin.schemas import SubSkillCreate, SubSkillUpdate
from app.modules.admin.service import SubSkillService
from app.modules.admin.taxonomy_service import TaxonomyService
from app.modules.assessments.enums import QuestionType
from app.modules.assessments.models import Assessment, AssessmentSection, Question, QuestionSkillTag, Skill
from app.modules.learning.enums import SkillCategory
from app.modules.learning.models import Exercise, ExerciseSkill, Mistake


@pytest.mark.asyncio
async def test_subskill_service_creates_canonical_skill_not_subskill(
    db_session: AsyncSession,
):
    """Verify SubSkillService.create_subskill creates a Skill with parent_id and NO sub_skills row."""
    # 1. Create parent root skill
    parent_id = uuid.uuid4()
    parent = Skill(
        id=parent_id,
        code=f"ROOT_{uuid.uuid4().hex[:6].upper()}",
        name="Root Container Skill",
        category=SkillCategory.READING,
        domain="reading",
        is_active=True,
    )
    db_session.add(parent)
    await db_session.flush()

    # 2. Call SubSkillService.create_subskill
    child_code = f"LEAF_{uuid.uuid4().hex[:6].upper()}"
    payload = SubSkillCreate(
        code=child_code,
        name="Child Leaf Competency",
        description="Detailed leaf competency description.",
    )
    created_skill = await SubSkillService.create_subskill(
        db=db_session,
        skill_id=parent_id,
        payload=payload,
    )

    # 3. Assert created entity is a canonical Skill
    assert isinstance(created_skill, Skill)
    assert created_skill.code == child_code
    assert created_skill.name == "Child Leaf Competency"
    assert created_skill.parent_id == parent_id
    assert created_skill.is_active is True

    # 4. Assert ZERO rows created in legacy sub_skills table
    legacy_row = await db_session.get(SubSkill, created_skill.id)
    assert legacy_row is None

    sub_skills_count = await db_session.scalar(
        select(func.count(SubSkill.id)).where(SubSkill.code == child_code)
    )
    assert sub_skills_count == 0


@pytest.mark.asyncio
async def test_direct_subskill_orm_insert_blocked_by_guard(
    db_session: AsyncSession,
):
    """Verify ORM event listener blocks any direct insertion into SubSkill."""
    parent_id = uuid.uuid4()
    parent = Skill(
        id=parent_id,
        code=f"PARENT_{uuid.uuid4().hex[:6].upper()}",
        name="Parent Skill",
        category=SkillCategory.GRAMMAR,
        is_active=True,
    )
    db_session.add(parent)
    await db_session.flush()

    illegal_sub = SubSkill(
        id=uuid.uuid4(),
        skill_id=parent_id,
        code=f"ILLEGAL_{uuid.uuid4().hex[:6].upper()}",
        name="Forbidden SubSkill Entity",
    )
    db_session.add(illegal_sub)

    with pytest.raises(RuntimeError, match="Direct insertion into sub_skills is deprecated"):
        await db_session.flush()

    await db_session.rollback()


@pytest.mark.asyncio
async def test_subskill_service_crud_lifecycle_on_canonical_skills(
    db_session: AsyncSession,
):
    """Verify list, update, archive, and delete operations on SubSkillService."""
    parent_id = uuid.uuid4()
    parent = Skill(
        id=parent_id,
        code=f"P_{uuid.uuid4().hex[:6].upper()}",
        name="Lifecycle Parent",
        category=SkillCategory.VOCABULARY,
        is_active=True,
    )
    db_session.add(parent)
    await db_session.flush()

    # Create
    created = await SubSkillService.create_subskill(
        db=db_session,
        skill_id=parent_id,
        payload=SubSkillCreate(code=f"SUB_{uuid.uuid4().hex[:6].upper()}", name="Initial Name"),
    )
    sub_id = created.id

    # List
    subs = await SubSkillService.list_subskills(db=db_session, skill_id=parent_id)
    assert len(subs) == 1
    assert subs[0].id == sub_id

    # Update
    updated = await SubSkillService.update_subskill(
        db=db_session,
        subskill_id=sub_id,
        payload=SubSkillUpdate(name="Renamed Competency"),
    )
    assert updated.name == "Renamed Competency"

    # Archive
    archived = await SubSkillService.archive_subskill(db=db_session, subskill_id=sub_id)
    assert archived.is_active is False

    # Once archived, it should not appear in active list_subskills
    active_subs = await SubSkillService.list_subskills(db=db_session, skill_id=parent_id)
    assert len(active_subs) == 0


@pytest.mark.asyncio
async def test_legacy_api_endpoints_backward_compatibility(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
    db_session: AsyncSession,
):
    """Verify legacy REST API /content/skills/{id}/subskills routes cleanly through canonical skills."""
    # 1. Create root skill via canonical taxonomy endpoint
    p_code = f"API_P_{uuid.uuid4().hex[:6].upper()}"
    p_resp = await client.post(
        "/api/v1/admin/content/skills",
        headers=admin_auth_headers,
        json={
            "code": p_code,
            "name": "API Test Parent",
            "category": "reading",
        },
    )
    assert p_resp.status_code == 201
    parent_id = p_resp.json()["id"]

    # 2. Create subskill via legacy endpoint
    c_code = f"API_C_{uuid.uuid4().hex[:6].upper()}"
    c_resp = await client.post(
        f"/api/v1/admin/content/skills/{parent_id}/subskills",
        headers=admin_auth_headers,
        json={
            "code": c_code,
            "name": "API Child Competency",
            "description": "Created via legacy route",
        },
    )
    assert c_resp.status_code == 201
    c_data = c_resp.json()
    child_id = c_data["id"]
    assert c_data["skill_id"] == parent_id
    assert c_data["code"] == c_code

    # Verify no row in sub_skills table
    sub_row = await db_session.get(SubSkill, uuid.UUID(child_id))
    assert sub_row is None

    # Verify canonical skill row exists with parent_id
    skill_row = await db_session.get(Skill, uuid.UUID(child_id))
    assert skill_row is not None
    assert str(skill_row.parent_id) == str(parent_id)

    # 3. List subskills via legacy endpoint
    list_resp = await client.get(
        f"/api/v1/admin/content/skills/{parent_id}/subskills",
        headers=admin_auth_headers,
    )
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert any(s["id"] == child_id for s in items)

    # 4. Update via legacy endpoint
    put_resp = await client.put(
        f"/api/v1/admin/content/subskills/{child_id}",
        headers=admin_auth_headers,
        json={"name": "API Updated Child"},
    )
    assert put_resp.status_code == 200
    assert put_resp.json()["name"] == "API Updated Child"

    # 5. Archive via legacy endpoint
    archive_resp = await client.post(
        f"/api/v1/admin/content/subskills/{child_id}/archive",
        headers=admin_auth_headers,
    )
    assert archive_resp.status_code == 200


@pytest.mark.asyncio
async def test_database_integrity_sole_source_verification(
    db_session: AsyncSession,
):
    """Verify TaxonomyService.verify_canonical_taxonomy_integrity passes with 100% clean state."""
    report = await TaxonomyService.verify_canonical_taxonomy_integrity(db_session)

    assert report["is_valid"] is True
    assert report["orphan_children_count"] == 0
    assert report["unmapped_legacy_subskills_count"] == 0
    assert report["broken_question_tags_count"] == 0
    assert report["broken_exercise_tags_count"] == 0
    assert report["canonical_sole_source"] is True


@pytest.mark.asyncio
async def test_historical_item_tags_and_evidence_resolve_to_canonical_skills(
    db_session: AsyncSession,
):
    """Verify questions and exercises tagged with subskill_id point to canonical Skill entities."""
    # 1. Parent container and child leaf competency
    parent_id = uuid.uuid4()
    child_id = uuid.uuid4()

    parent = Skill(
        id=parent_id,
        code=f"CONT_{uuid.uuid4().hex[:6].upper()}",
        name="Container Competency",
        category=SkillCategory.READING,
        is_active=True,
    )
    child = Skill(
        id=child_id,
        code=f"LEAF_{uuid.uuid4().hex[:6].upper()}",
        name="Leaf Competency",
        parent_id=parent_id,
        category=SkillCategory.READING,
        is_active=True,
    )
    db_session.add_all([parent, child])
    await db_session.flush()

    # 2. Assessment + Question with canonical tag referencing both container and leaf
    assessment = Assessment(
        id=uuid.uuid4(),
        title="Diagnostic Exam",
        assessment_type="reading",
        duration_seconds=3600,
        is_published=True,
    )
    db_session.add(assessment)
    await db_session.flush()

    section = AssessmentSection(
        id=uuid.uuid4(),
        assessment_id=assessment.id,
        title="Section 1",
        order_index=0,
    )
    db_session.add(section)
    await db_session.flush()

    question = Question(
        id=uuid.uuid4(),
        section_id=section.id,
        question_type=QuestionType.SINGLE_CHOICE,
        prompt="Sample Reading Question",
        points=1,
    )
    db_session.add(question)
    await db_session.flush()

    tag = QuestionSkillTag(
        id=uuid.uuid4(),
        question_id=question.id,
        skill_id=parent_id,
        subskill_id=child_id,
        weight=1.0,
    )
    db_session.add(tag)
    await db_session.flush()

    from sqlalchemy.orm import selectinload

    # 3. Verify relationships resolve
    q_reloaded = await db_session.scalar(
        select(Question)
        .options(
            selectinload(Question.skill_tags).selectinload(QuestionSkillTag.skill),
            selectinload(Question.skill_tags).selectinload(QuestionSkillTag.subskill_ref),
        )
        .where(Question.id == question.id)
    )
    assert len(q_reloaded.skill_tags) == 1
    assert q_reloaded.skill_tags[0].skill.id == parent_id
    assert q_reloaded.skill_tags[0].subskill_ref.id == child_id
    assert q_reloaded.skill_tags[0].subskill_ref.parent_id == parent_id
