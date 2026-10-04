"""Tests for Audit Safety Remediations:
- F-01: Disable dangerous hard delete & safe archival
- F-02: Accurate skill usage aggregation (including subskill_id)
- F-04: Scope readiness calculation to active taxonomy
- F-05: Unify CEFR cutoffs between assessment scoring and learning estimation
"""

import datetime
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException
from app.modules.admin.enums import SkillDimension, TaxonomyLifecycleStatus
from app.modules.admin.models import SubSkill, TaxonomyVersion
from app.modules.admin.service import SubSkillService
from app.modules.admin.taxonomy_service import TaxonomyService
from app.modules.assessments.enums import AssessmentType, NavigationPolicy, QuestionType, ScoringPolicy
from app.modules.assessments.models import (
    Assessment,
    AssessmentSection,
    Question,
    QuestionOption,
    QuestionSkillTag,
    Skill,
)
from app.modules.assessments.scoring import ScoringEngine
from app.modules.learning.enums import SkillCategory
from app.modules.learning.levels import CEFR_LEVEL_THRESHOLDS, LevelEstimationService
from app.modules.learning.models import (
    Exercise,
    ExerciseSkill,
    ReadinessProfile,
    SkillAssessment,
    SkillEvidence,
    StudentSkill,
)
from app.modules.learning.readiness_engine import ReadinessEngine
from app.modules.users.models import User


# ===========================================================================
# F-05: CEFR Boundary and Unification Tests
# ===========================================================================


def test_cefr_cutoffs_boundaries():
    """Verify exact boundaries across LevelEstimationService and ScoringEngine:
    0, 29/30, 34/35, 44/45, 49/50, 59/60, 64/65, 74/75, 79/80, 89/90, 100.
    """
    test_cases = [
        # (score, expected_cefr)
        (0.0, "A1"),
        (15.5, "A1"),
        (29.0, "A1"),
        (30.0, "A1"),
        (34.0, "A1"),
        (34.9, "A1"),
        (35.0, "A2"),
        (35.1, "A2"),
        (44.0, "A2"),
        (45.0, "A2"),
        (49.0, "A2"),
        (49.9, "A2"),
        (50.0, "B1"),
        (50.1, "B1"),
        (59.0, "B1"),
        (60.0, "B1"),
        (64.0, "B1"),
        (64.9, "B1"),
        (65.0, "B2"),
        (65.1, "B2"),
        (74.0, "B2"),
        (75.0, "B2"),
        (79.0, "B2"),
        (79.9, "B2"),
        (80.0, "C1"),
        (80.1, "C1"),
        (89.0, "C1"),
        (89.9, "C1"),
        (90.0, "C2"),
        (95.0, "C2"),
        (100.0, "C2"),
    ]

    for score, expected in test_cases:
        learning_cefr = LevelEstimationService.estimate_cefr(score)
        scoring_cefr = ScoringEngine.estimate_cefr_level(score)

        # Both must match the expected canonical benchmark
        assert learning_cefr == expected, f"Learning estimate failed for score={score}: got {learning_cefr}, expected {expected}"
        assert scoring_cefr == expected, f"Scoring estimate failed for score={score}: got {scoring_cefr}, expected {expected}"
        # Both engines must be 100% synchronized
        assert learning_cefr == scoring_cefr, f"Discrepancy at score={score}: learning={learning_cefr} vs scoring={scoring_cefr}"


def test_cefr_thresholds_mapping_consistency():
    """Verify that CEFR_LEVEL_THRESHOLDS values match get_level_threshold."""
    for level, threshold in CEFR_LEVEL_THRESHOLDS.items():
        assert LevelEstimationService.get_level_threshold(level) == threshold


# ===========================================================================
# F-02: Usage Aggregation Tests
# ===========================================================================


@pytest.mark.asyncio
async def test_usage_aggregation_container_and_leaf(db_session: AsyncSession):
    """Test usage counting for:
    - container-only usage
    - leaf-only usage
    - container + leaf usage
    - multiple occurrences
    - zero usage
    """
    now = datetime.datetime.now(datetime.UTC)
    version = await TaxonomyService.get_active_version(db_session)

    # 1. Create container skill and leaf skill
    container = Skill(
        id=uuid.uuid4(),
        code=f"REAS_CONT_{uuid.uuid4().hex[:6]}",
        name="Container Reasoning",
        dimension=SkillDimension.REASONING,
        domain="reading",
        taxonomy_version_id=version.id,
        is_active=True,
    )
    leaf = Skill(
        id=uuid.uuid4(),
        code=f"REAS_LEAF_{uuid.uuid4().hex[:6]}",
        name="Leaf Competency",
        dimension=SkillDimension.REASONING,
        domain="reading",
        parent_id=container.id,
        taxonomy_version_id=version.id,
        is_active=True,
    )
    zero_usage_skill = Skill(
        id=uuid.uuid4(),
        code=f"ZERO_USE_{uuid.uuid4().hex[:6]}",
        name="Zero Usage Skill",
        dimension=SkillDimension.LANGUAGE,
        domain="grammar",
        taxonomy_version_id=version.id,
        is_active=True,
    )
    db_session.add_all([container, leaf, zero_usage_skill])
    await db_session.flush()

    # Zero usage check
    usage_map = await TaxonomyService.batch_get_skill_usage(
        db_session, [container.id, leaf.id, zero_usage_skill.id]
    )
    assert usage_map[zero_usage_skill.id].total_dependencies == 0
    assert usage_map[container.id].total_dependencies == 0
    assert usage_map[leaf.id].total_dependencies == 0

    # 2. Create Assessment, Section, Question tagged with container as skill_id and leaf as subskill_id
    asmt = Assessment(
        id=uuid.uuid4(),
        title="Diagnostic Assessment",
        assessment_type=AssessmentType.READING,
        duration_seconds=1800,
        navigation_policy=NavigationPolicy.FREE,
        scoring_policy=ScoringPolicy.STANDARD_POINTS,
        version=1,
    )
    db_session.add(asmt)
    await db_session.flush()

    sec = AssessmentSection(
        id=uuid.uuid4(),
        assessment_id=asmt.id,
        title="Reading Section",
        order_index=1,
        duration_seconds=300,
    )
    db_session.add(sec)
    await db_session.flush()

    q1 = Question(
        id=uuid.uuid4(),
        section_id=sec.id,
        question_type=QuestionType.SINGLE_CHOICE,
        prompt="Sample Reading Question",
        order_index=1,
        difficulty=3,
        level="B2",
        points=1,
    )
    db_session.add(q1)
    await db_session.flush()

    # Tag q1 with container as skill_id AND leaf as subskill_id
    tag1 = QuestionSkillTag(
        id=uuid.uuid4(),
        question_id=q1.id,
        skill_id=container.id,
        subskill_id=leaf.id,
        weight=1.0,
    )
    db_session.add(tag1)
    await db_session.flush()

    # Create Exercise tagged with leaf as subskill_id
    ex1 = Exercise(
        id=uuid.uuid4(),
        title="Reading Exercise",
        prompt="Exercise Prompt",
        category=SkillCategory.READING,
        level="B2",
        difficulty=3,
        question_type=QuestionType.SINGLE_CHOICE,
        points=5,
    )
    db_session.add(ex1)
    await db_session.flush()

    ex_tag1 = ExerciseSkill(
        id=uuid.uuid4(),
        exercise_id=ex1.id,
        skill_id=container.id,
        subskill_id=leaf.id,
        weight=1.0,
    )
    db_session.add(ex_tag1)
    await db_session.flush()

    # Query usage
    usage_map = await TaxonomyService.batch_get_skill_usage(
        db_session, [container.id, leaf.id, zero_usage_skill.id]
    )

    # Both container and leaf must show usage!
    assert usage_map[container.id].questions == 1
    assert usage_map[container.id].exercises == 1
    assert usage_map[container.id].assessments == 1

    # LEAF usage must be accurately counted even though it was passed in subskill_id!
    assert usage_map[leaf.id].questions == 1
    assert usage_map[leaf.id].exercises == 1
    assert usage_map[leaf.id].assessments == 1
    assert usage_map[leaf.id].total_dependencies >= 2

    # Attempting to delete leaf skill MUST be rejected because it is in use
    with pytest.raises(AppException) as exc_info:
        await TaxonomyService.delete_skill_safe(db_session, leaf.id)
    assert exc_info.value.status_code in (400, 409)
    assert "dependencies" in exc_info.value.message.lower() or "active dependencies" in exc_info.value.message.lower()


# ===========================================================================
# F-01: Disable Dangerous Hard Delete Tests
# ===========================================================================


@pytest.mark.asyncio
async def test_subskill_delete_safeguards_and_archival(db_session: AsyncSession, test_student: User):
    """Prove that:
    1. Unused competency can be archived
    2. Used competency cannot be physically destroyed
    3. Student mastery survives
    4. Skill evidence survives
    5. Historical assessments survive
    6. Repeated archive operations are idempotent
    """
    version = await TaxonomyService.get_active_version(db_session)
    now = datetime.datetime.now(datetime.UTC)

    # 1. Create parent skill and child subskill
    parent_skill = Skill(
        id=uuid.uuid4(),
        code=f"PARENT_{uuid.uuid4().hex[:6]}",
        name="Parent Competency",
        dimension=SkillDimension.LANGUAGE,
        domain="vocabulary",
        taxonomy_version_id=version.id,
        is_active=True,
    )
    child_skill = Skill(
        id=uuid.uuid4(),
        code=f"CHILD_{uuid.uuid4().hex[:6]}",
        name="Child Competency",
        dimension=SkillDimension.LANGUAGE,
        domain="vocabulary",
        parent_id=parent_skill.id,
        taxonomy_version_id=version.id,
        is_active=True,
    )
    db_session.add_all([parent_skill, child_skill])
    await db_session.flush()

    # 2. Attach student mastery, evidence, and historical assessment to child_skill
    student_skill = StudentSkill(
        id=uuid.uuid4(),
        user_id=test_student.id,
        skill_id=child_skill.id,
        mastery_score=72.5,
        confidence=0.8,
        attempts_count=3,
        successful_attempts=2,
    )
    evidence = SkillEvidence(
        id=uuid.uuid4(),
        student_id=test_student.id,
        skill_id=child_skill.id,
        source_type="assessment",
        source_id=uuid.uuid4(),
        raw_score=1.0,
        normalized_score=100.0,
        confidence=0.85,
        weight=1.0,
        observed_at=now,
    )
    assessment_record = SkillAssessment(
        id=uuid.uuid4(),
        user_id=test_student.id,
        skill_id=child_skill.id,
        source_type="assessment_attempt",
        source_id=uuid.uuid4(),
        score=72.5,
        points_earned=1.0,
        points_possible=1.0,
        estimated_level="B2",
        confidence=0.8,
        assessed_at=now,
    )
    db_session.add_all([student_skill, evidence, assessment_record])
    await db_session.flush()

    # 3. Attempt to hard-delete subskill via SubSkillService -> MUST FAIL with 409
    with pytest.raises(AppException) as exc_info:
        await SubSkillService.delete_subskill(db_session, child_skill.id)
    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "SUBSKILL_IN_USE"

    # Verify that child_skill STILL exists physically in DB
    refetched_skill = await db_session.get(Skill, child_skill.id)
    assert refetched_skill is not None

    # 4. Verify student mastery, evidence, and assessments survived intact
    refetched_mastery = await db_session.scalar(
        select(StudentSkill).where(StudentSkill.id == student_skill.id)
    )
    refetched_evidence = await db_session.scalar(
        select(SkillEvidence).where(SkillEvidence.id == evidence.id)
    )
    refetched_assessment = await db_session.scalar(
        select(SkillAssessment).where(SkillAssessment.id == assessment_record.id)
    )
    assert refetched_mastery is not None
    assert refetched_evidence is not None
    assert refetched_assessment is not None

    # 5. Archive subskill safely
    archived = await SubSkillService.archive_subskill(db_session, child_skill.id)
    assert archived.is_active is False

    refetched_skill = await db_session.get(Skill, child_skill.id)
    assert refetched_skill.is_active is False

    # 6. Idempotence: calling archive again succeeds without error and remains False
    archived_again = await SubSkillService.archive_subskill(db_session, child_skill.id)
    assert archived_again.is_active is False
    assert (await db_session.get(Skill, child_skill.id)).is_active is False

    # Also test TaxonomyService.archive_skill idempotency
    detail = await TaxonomyService.archive_skill(db_session, child_skill.id)
    assert detail.is_active is False


# ===========================================================================
# F-04: Scope Readiness to Active Taxonomy Tests
# ===========================================================================


@pytest.mark.asyncio
async def test_readiness_scoped_to_active_taxonomy(db_session: AsyncSession, test_student: User):
    """Test that:
    1. Active taxonomy skills are calculated in readiness
    2. Archived skills do NOT create artificial readiness gaps
    3. Skills from a retired taxonomy version do NOT contaminate current readiness
    4. Historical evidence remains readable
    """
    now = datetime.datetime.now(datetime.UTC)

    # 1. Create Active Taxonomy Version and Retired Version
    active_version = await TaxonomyService.get_active_version(db_session)
    retired_version = TaxonomyVersion(
        id=uuid.uuid4(),
        version="v1.0.0-retired",
        name="Legacy TEF Framework",
        status=TaxonomyLifecycleStatus.ARCHIVED,
        description="Retired framework",
    )
    db_session.add(retired_version)
    await db_session.flush()

    # Active Skill
    active_skill = Skill(
        id=uuid.uuid4(),
        code=f"ACTIVE_SKILL_{uuid.uuid4().hex[:6]}",
        name="Active Reading Skill",
        category=SkillCategory.READING,
        dimension=SkillDimension.REASONING,
        domain="reading",
        taxonomy_version_id=active_version.id,
        is_active=True,
    )
    # Archived Skill (in active version)
    archived_skill = Skill(
        id=uuid.uuid4(),
        code=f"ARCHIVED_SKILL_{uuid.uuid4().hex[:6]}",
        name="Deprecated Reading Skill",
        category=SkillCategory.READING,
        dimension=SkillDimension.REASONING,
        domain="reading",
        taxonomy_version_id=active_version.id,
        is_active=False,
    )
    # Retired Version Skill
    retired_skill = Skill(
        id=uuid.uuid4(),
        code=f"RETIRED_SKILL_{uuid.uuid4().hex[:6]}",
        name="Old Framework Skill",
        category=SkillCategory.READING,
        dimension=SkillDimension.REASONING,
        domain="reading",
        taxonomy_version_id=retired_version.id,
        is_active=True,
    )
    db_session.add_all([active_skill, archived_skill, retired_skill])
    await db_session.flush()

    # Add historical evidence for active skill and archived skill
    ev_active = SkillEvidence(
        id=uuid.uuid4(),
        student_id=test_student.id,
        skill_id=active_skill.id,
        source_type="assessment",
        source_id=uuid.uuid4(),
        raw_score=1.0,
        normalized_score=85.0,
        confidence=0.85,
        weight=1.0,
        observed_at=now,
    )
    ev_archived = SkillEvidence(
        id=uuid.uuid4(),
        student_id=test_student.id,
        skill_id=archived_skill.id,
        source_type="assessment",
        source_id=uuid.uuid4(),
        raw_score=1.0,
        normalized_score=40.0,
        confidence=0.85,
        weight=1.0,
        observed_at=now - datetime.timedelta(days=10),
    )
    db_session.add_all([ev_active, ev_archived])
    await db_session.flush()

    # Recalculate readiness
    profile = await ReadinessEngine.recalculate_student_readiness(db_session, test_student.id)

    # 1. Historical evidence for archived skill is still readable in database!
    ev_check = await db_session.scalar(
        select(SkillEvidence).where(SkillEvidence.id == ev_archived.id)
    )
    assert ev_check is not None
    assert ev_check.normalized_score == 40.0

    # 2. Active skill IS present in readiness summary_skills
    active_id_str = str(active_skill.id)
    archived_id_str = str(archived_skill.id)
    retired_id_str = str(retired_skill.id)

    assert active_id_str in profile.summary_skills

    # 3. Archived skill and Retired skill are NOT present in active readiness summary_skills!
    assert archived_id_str not in profile.summary_skills
    assert retired_id_str not in profile.summary_skills

    # 4. Gaps should only contain active skills, never archived or retired skills
    gap_skill_ids = [g["skill_id"] for g in profile.summary_gaps]
    assert archived_id_str not in gap_skill_ids
    assert retired_id_str not in gap_skill_ids
