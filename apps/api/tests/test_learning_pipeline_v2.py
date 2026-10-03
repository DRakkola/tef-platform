"""Deterministic test suite for Learning Intelligence Pipeline V2.

Verifies:
1. Multi-skill evidence generation and attribution
2. Weighted evidence scaling
3. Parent/container competency roll-up rules
4. Recency decay (45-day half-life)
5. Confidence calibration and insufficient data states
6. Insufficient evidence handling in recommendations (no aggressive recommendations)
7. CEFR estimation and skill-level descriptors
8. Prerequisite-based recommendation analysis (skill gap -> prerequisite -> targeted content)
9. Historical evidence immutability across taxonomy changes
10. Explicit mastery algorithm versioning (v1 vs v2)
11. Reasoning vs Language dimension separation
12. Comprehensive student skill tracking (attempts, accuracy, mastery, confidence, recency, evidence count, level, time)
"""

import datetime
import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.admin.enums import (
    CEFRBand,
    SkillDimension,
    SkillRelationType,
    TaxonomyLifecycleStatus,
)
from app.modules.admin.models import (
    SkillLevelDescriptor,
    SkillRelation,
    TaxonomyVersion,
)
from app.modules.assessments.enums import QuestionType
from app.modules.assessments.models import (
    Skill,
)
from app.modules.learning.engine import SkillEngine
from app.modules.learning.enums import SkillCategory
from app.modules.learning.models import (
    Exercise,
    ExerciseSkill,
    StudentSkill,
)
from app.modules.learning.readiness_engine import ReadinessEngine
from app.modules.learning.readiness_models import SkillEvidence
from app.modules.learning.recommendations_v2 import RecommendationEngineV2
from app.modules.learning.service import LearningService
from app.modules.users.models import User

# ---------------------------------------------------------------------------
# Fixtures / Helpers
# ---------------------------------------------------------------------------


async def _create_test_taxonomy(db: AsyncSession) -> TaxonomyVersion:
    tv = TaxonomyVersion(
        version=f"v2-test-{uuid.uuid4().hex[:6]}",
        name="Taxonomy V2 Test",
        status=TaxonomyLifecycleStatus.ACTIVE,
    )
    db.add(tv)
    await db.flush()
    return tv


async def _create_test_skill(
    db: AsyncSession,
    tv_id: uuid.UUID,
    code: str,
    name: str,
    dimension: SkillDimension = SkillDimension.REASONING,
    domain: str = "reading",
    parent_id: uuid.UUID | None = None,
) -> Skill:
    skill = Skill(
        taxonomy_version_id=tv_id,
        code=code,
        name=name,
        dimension=dimension,
        domain=domain,
        category=SkillCategory.READING,
        parent_id=parent_id,
        is_active=True,
    )
    db.add(skill)
    await db.flush()
    return skill


# ---------------------------------------------------------------------------
# 1. Multi-skill evidence generation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_multi_skill_evidence_generation(
    db_session: AsyncSession,
    test_student: User,
):
    """A question tagged with reasoning and language skills generates distinct evidence rows."""
    tv = await _create_test_taxonomy(db_session)
    reasoning_skill = await _create_test_skill(
        db_session, tv.id, f"rea-{uuid.uuid4().hex[:4]}", "Inférence", SkillDimension.REASONING
    )
    lang_skill = await _create_test_skill(
        db_session, tv.id, f"lng-{uuid.uuid4().hex[:4]}", "Connecteurs", SkillDimension.LANGUAGE
    )

    now = datetime.datetime.now(datetime.UTC)
    source_id = uuid.uuid4()

    # Ingest evidence for both skills simulating an evaluated item
    await ReadinessEngine.ingest_evidence(
        db=db_session,
        student_id=test_student.id,
        skill_id=reasoning_skill.id,
        source_type="assessment_item",
        source_id=source_id,
        raw_score=2.0,
        normalized_score=100.0,
        confidence=0.85,
        weight=1.0,
        observed_at=now,
        metadata_payload={"role": "primary"},
    )
    await ReadinessEngine.ingest_evidence(
        db=db_session,
        student_id=test_student.id,
        skill_id=lang_skill.id,
        source_type="assessment_item",
        source_id=source_id,
        raw_score=1.0,
        normalized_score=50.0,
        confidence=0.85,
        weight=0.5,
        observed_at=now,
        metadata_payload={"role": "secondary"},
    )
    await db_session.commit()

    evs = (
        await db_session.execute(
            select(SkillEvidence).where(SkillEvidence.student_id == test_student.id)
        )
    ).scalars().all()

    assert len(evs) == 2
    skill_ids_in_ev = {e.skill_id for e in evs}
    assert reasoning_skill.id in skill_ids_in_ev
    assert lang_skill.id in skill_ids_in_ev


# ---------------------------------------------------------------------------
# 2. Weighted evidence scaling
# ---------------------------------------------------------------------------


def test_weighted_evidence_calculation():
    """Item weight scales evidence contribution in estimate calculation."""
    now = datetime.datetime.now(datetime.UTC)

    # ev1: score=100, weight=1.0
    ev1 = SkillEvidence(
        student_id=uuid.uuid4(),
        skill_id=uuid.uuid4(),
        source_type="assessment",
        source_id=uuid.uuid4(),
        raw_score=10.0,
        normalized_score=100.0,
        confidence=0.9,
        weight=1.0,
        observed_at=now,
        calculation_version="v2.0.0",
    )
    # ev2: score=0, weight=0.25 (minor secondary item)
    ev2 = SkillEvidence(
        student_id=uuid.uuid4(),
        skill_id=uuid.uuid4(),
        source_type="assessment",
        source_id=uuid.uuid4(),
        raw_score=0.0,
        normalized_score=0.0,
        confidence=0.9,
        weight=0.25,
        observed_at=now,
        calculation_version="v2.0.0",
    )

    res = ReadinessEngine.calculate_skill_estimate([ev1, ev2], now=now)
    assert res["estimate"] is not None
    # Weighted average: 100 * 1.0 + 0 * 0.25 / 1.25 = 80.0
    assert res["estimate"] == pytest.approx(80.0, abs=1.0)


# ---------------------------------------------------------------------------
# 3. Explicit parent competency roll-up
# ---------------------------------------------------------------------------


def test_parent_rollup_explicit_rules():
    """Parent container competency scores aggregate proportionally across all assessed children."""
    # Child 1: 8/10 points (80%), mastery 80%, conf 0.8
    # Child 2: 2/10 points (20%), mastery 20%, conf 0.8
    children = [
        {"pts_earned": 8.0, "pts_max": 10.0, "mastery_score": 80.0, "confidence": 0.8},
        {"pts_earned": 2.0, "pts_max": 10.0, "mastery_score": 20.0, "confidence": 0.8},
    ]
    # Total children under parent = 4 (only 2 assessed, so coverage = 50%)
    rollup = SkillEngine.calculate_parent_rollup(children, total_children_count=4)

    # Total points: 10/20 = 50.0%
    assert rollup["pts_earned"] == 10.0
    assert rollup["pts_max"] == 20.0
    assert rollup["score_pct"] == 50.0

    # Mastery: (80*0.8 + 20*0.8) / 1.6 = 50.0%
    assert rollup["mastery_score"] == pytest.approx(50.0, abs=0.1)

    # Confidence: avg(0.8) * coverage(2/4 = 0.5) = 0.40
    assert rollup["confidence"] == pytest.approx(0.40, abs=0.05)
    assert rollup["coverage_ratio"] == 0.5


# ---------------------------------------------------------------------------
# 4. Recency decay (45-day half-life)
# ---------------------------------------------------------------------------


def test_recency_decay_half_life():
    """Recency weight decays by exactly half after 45 days."""
    w_today = SkillEngine.calculate_recency_weight(0.0)
    w_45d = SkillEngine.calculate_recency_weight(45.0)
    w_90d = SkillEngine.calculate_recency_weight(90.0)

    assert w_today == pytest.approx(1.0, abs=0.001)
    assert w_45d == pytest.approx(0.5, abs=0.01)
    assert w_90d == pytest.approx(0.25, abs=0.01)


# ---------------------------------------------------------------------------
# 5. Confidence calibration and insufficient data
# ---------------------------------------------------------------------------


def test_confidence_calibration():
    """Fewer than 2 attempts triggers insufficient_data / Calibration."""
    _, label_0, is_insufficient_0 = SkillEngine.calculate_confidence(0)
    assert is_insufficient_0 is True
    assert label_0 == "Calibration"

    _, label_1, is_insufficient_1 = SkillEngine.calculate_confidence(1)
    assert is_insufficient_1 is True
    assert label_1 == "Calibration"

    conf_5, label_5, is_insufficient_5 = SkillEngine.calculate_confidence(
        attempts_count=5, source_types={"assessment", "exercise"}
    )
    assert is_insufficient_5 is False
    assert conf_5 >= 0.70
    assert label_5 in ("Medium", "High")


# ---------------------------------------------------------------------------
# 6. Insufficient evidence handling in recommendations
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_insufficient_evidence_recommendations(
    db_session: AsyncSession,
    test_student: User,
):
    """Low sample size / confidence generates diagnostic recommendations with non-aggressive priority."""
    tv = await _create_test_taxonomy(db_session)
    skill = await _create_test_skill(db_session, tv.id, f"diag-{uuid.uuid4().hex[:4]}", "Grammaire test")

    # Student with only 1 attempt and low confidence (0.15)
    ss = StudentSkill(
        user_id=test_student.id,
        skill_id=skill.id,
        mastery_score=20.0,  # Low score, but low confidence
        confidence=0.15,
        attempts_count=1,
    )
    db_session.add(ss)

    ex = Exercise(
        title="Exercice Diagnostic",
        prompt="Test",
        category=SkillCategory.READING,
        level="B1",
        difficulty=2,
        question_type=QuestionType.SINGLE_CHOICE,
        is_published=True,
    )
    db_session.add(ex)
    await db_session.flush()

    es = ExerciseSkill(exercise_id=ex.id, skill_id=skill.id, weight=1.0)
    db_session.add(es)
    await db_session.commit()

    recs = await RecommendationEngineV2.generate_recommendations(db_session, test_student.id)
    assert len(recs) >= 1
    rec = recs[0]
    # Priority should be scaled down for low confidence (not aggressive 80+)
    assert rec.priority < 60
    assert "diagnostic" in rec.reason.lower() or "calibration" in rec.reason.lower()


# ---------------------------------------------------------------------------
# 7. CEFR estimation and skill-level descriptors
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_cefr_estimation_and_descriptors(
    db_session: AsyncSession,
    test_student: User,
):
    """CEFR level estimation correctly matches SkillLevelDescriptor can-do statements."""
    tv = await _create_test_taxonomy(db_session)
    skill = await _create_test_skill(db_session, tv.id, f"desc-{uuid.uuid4().hex[:4]}", "Compréhension B2")

    desc = SkillLevelDescriptor(
        skill_id=skill.id,
        level=CEFRBand.B2,
        descriptor="Peut comprendre les articles d'opinion complexes et identifier le point de vue.",
        evidence_guidance="Réussite aux questions d'analyse argumentative avec temps limité.",
    )
    db_session.add(desc)

    # 70% score -> B2 level
    ss = StudentSkill(
        user_id=test_student.id,
        skill_id=skill.id,
        mastery_score=72.0,
        confidence=0.8,
        attempts_count=4,
        successful_attempts=3,
        estimated_level="B2",
    )
    db_session.add(ss)
    await db_session.commit()

    skills_data = await LearningService.get_student_skills(db_session, test_student.id)
    matching = next((s for s in skills_data if s["skill_id"] == skill.id), None)
    assert matching is not None
    assert matching["estimated_level"] == "B2"
    assert matching["descriptor"] == desc.descriptor


# ---------------------------------------------------------------------------
# 8. Prerequisite-based recommendations
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_prerequisite_based_recommendations(
    db_session: AsyncSession,
    test_student: User,
):
    """When skill B depends on prerequisite A, and both are weak, A is prioritized first."""
    tv = await _create_test_taxonomy(db_session)

    # Prerequisite: Résolution de référence (Prerequisite for Inférence)
    prereq_skill = await _create_test_skill(
        db_session, tv.id, f"prq-{uuid.uuid4().hex[:4]}", "Résolution de référence", SkillDimension.LANGUAGE
    )
    target_skill = await _create_test_skill(
        db_session, tv.id, f"tgt-{uuid.uuid4().hex[:4]}", "Inférence pragmatique", SkillDimension.REASONING
    )

    # Set relation: prereq_skill -> target_skill (PREREQUISITE)
    rel = SkillRelation(
        from_skill_id=prereq_skill.id,
        to_skill_id=target_skill.id,
        relation_type=SkillRelationType.PREREQUISITE,
    )
    db_session.add(rel)

    # Student is weak in target skill (40% mastery, confident)
    ss_target = StudentSkill(
        user_id=test_student.id,
        skill_id=target_skill.id,
        mastery_score=40.0,
        confidence=0.8,
        attempts_count=5,
    )
    db_session.add(ss_target)

    # Create exercise for the prerequisite skill
    ex_prereq = Exercise(
        title="Exercice Pronoms et Références",
        prompt="Identifiez l'antécédent du pronom.",
        category=SkillCategory.READING,
        level="B1",
        difficulty=2,
        question_type=QuestionType.SINGLE_CHOICE,
        is_published=True,
    )
    db_session.add(ex_prereq)
    await db_session.flush()

    db_session.add(ExerciseSkill(exercise_id=ex_prereq.id, skill_id=prereq_skill.id, weight=1.0))
    await db_session.commit()

    recs = await RecommendationEngineV2.generate_recommendations(db_session, test_student.id)
    # The prerequisite exercise must be recommended with high priority and explanation
    prereq_rec = next((r for r in recs if r.skill_id == prereq_skill.id), None)
    assert prereq_rec is not None
    assert prereq_rec.priority >= 85
    assert "prérequis prioritaire" in prereq_rec.reason.lower()
    assert prereq_skill.name in prereq_rec.reason


# ---------------------------------------------------------------------------
# 9. Historical evidence immutability
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_historical_evidence_immutability(
    db_session: AsyncSession,
    test_student: User,
):
    """Historical evidence records are never overwritten or deleted when skills are updated."""
    tv = await _create_test_taxonomy(db_session)
    skill = await _create_test_skill(db_session, tv.id, f"imm-{uuid.uuid4().hex[:4]}", "Compétence Imm")

    source_id = uuid.uuid4()
    now = datetime.datetime.now(datetime.UTC)

    # Ingest historical evidence
    await ReadinessEngine.ingest_evidence(
        db=db_session,
        student_id=test_student.id,
        skill_id=skill.id,
        source_type="assessment_item",
        source_id=source_id,
        raw_score=1.0,
        normalized_score=100.0,
        confidence=0.85,
        weight=1.0,
        observed_at=now,
    )
    await db_session.commit()

    # Mutate skill code, name, and archive it
    skill.code = "MUTATED_CODE"
    skill.name = "Mutated Skill Name"
    skill.is_active = False
    await db_session.commit()

    # Evidence must remain untouched
    ev = await db_session.scalar(
        select(SkillEvidence).where(
            SkillEvidence.student_id == test_student.id,
            SkillEvidence.skill_id == skill.id,
        )
    )
    assert ev is not None
    assert ev.raw_score == 1.0
    assert ev.normalized_score == 100.0
    assert ev.calculation_version == "v2.0.0"


# ---------------------------------------------------------------------------
# 10. Explicit mastery algorithm versioning
# ---------------------------------------------------------------------------


def test_mastery_algorithm_versioning():
    """SkillEngine isolates calculation versions behind explicit strategy flag."""
    assert SkillEngine.MASTERY_ALGORITHM_VERSION == "v1"

    # Strategy v1: 0.6 * prior + 0.4 * new
    m1, _ = SkillEngine.update_mastery(
        current_mastery=50.0,
        attempts_count=1,
        new_score=100.0,
        strategy="v1",
    )
    # 0.6 * 50 + 0.4 * 100 = 70.0
    assert m1 == 70.0

    # Strategy v2: Weighted Bayesian update
    m2, _ = SkillEngine.update_mastery(
        current_mastery=50.0,
        attempts_count=1,
        new_score=100.0,
        source_type="assessment",
        days_since_last=0.0,
        weight=1.0,
        strategy="v2",
    )
    assert isinstance(m2, float)
    assert 50.0 <= m2 <= 100.0


# ---------------------------------------------------------------------------
# 11. Reasoning vs Language dimension separation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_reasoning_vs_language_dimension_separation(
    db_session: AsyncSession,
    test_student: User,
):
    """ReadinessEngine computes separate summaries for Reasoning and Language dimensions."""
    tv = await _create_test_taxonomy(db_session)
    r_skill = await _create_test_skill(
        db_session, tv.id, f"rdim-{uuid.uuid4().hex[:4]}", "Raisonnement", SkillDimension.REASONING
    )
    l_skill = await _create_test_skill(
        db_session, tv.id, f"ldim-{uuid.uuid4().hex[:4]}", "Langue", SkillDimension.LANGUAGE
    )

    now = datetime.datetime.now(datetime.UTC)
    # 2 observations for each to exit insufficient data
    for _ in range(2):
        await ReadinessEngine.ingest_evidence(
            db=db_session,
            student_id=test_student.id,
            skill_id=r_skill.id,
            source_type="assessment",
            source_id=uuid.uuid4(),
            raw_score=8.0,
            normalized_score=80.0,
            confidence=0.85,
            weight=1.0,
            observed_at=now,
        )
        await ReadinessEngine.ingest_evidence(
            db=db_session,
            student_id=test_student.id,
            skill_id=l_skill.id,
            source_type="assessment",
            source_id=uuid.uuid4(),
            raw_score=5.0,
            normalized_score=50.0,
            confidence=0.85,
            weight=1.0,
            observed_at=now,
        )
    await db_session.commit()

    profile = await ReadinessEngine.recalculate_student_readiness(db_session, test_student.id)
    assert profile is not None
    dim_summary = profile.summary_skills.get("_dimension_summary")
    assert dim_summary is not None
    assert "reasoning" in dim_summary
    assert "language" in dim_summary
    assert dim_summary["reasoning"]["estimate"] == pytest.approx(80.0, abs=1.0)
    assert dim_summary["language"]["estimate"] == pytest.approx(50.0, abs=1.0)


# ---------------------------------------------------------------------------
# 12. Complete student skill tracking fields
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_complete_student_skill_tracking_fields(
    db_session: AsyncSession,
    test_student: User,
):
    """StudentSkill tracks all 8 required fields: attempts, accuracy, mastery, confidence, recency, evidence count, level, time."""
    tv = await _create_test_taxonomy(db_session)
    skill = await _create_test_skill(
        db_session, tv.id, f"trk-{uuid.uuid4().hex[:4]}", "Tracking Skill", SkillDimension.REASONING
    )

    now = datetime.datetime.now(datetime.UTC)
    ss = StudentSkill(
        user_id=test_student.id,
        skill_id=skill.id,
        mastery_score=68.5,
        confidence=0.75,
        attempts_count=4,
        successful_attempts=3,
        estimated_level="B1",
        last_assessed_at=now,
    )
    db_session.add(ss)

    # Ingest 2 evidences
    for _ in range(2):
        await ReadinessEngine.ingest_evidence(
            db=db_session,
            student_id=test_student.id,
            skill_id=skill.id,
            source_type="assessment",
            source_id=uuid.uuid4(),
            raw_score=7.0,
            normalized_score=70.0,
            confidence=0.8,
            weight=1.0,
            observed_at=now,
        )
    await db_session.commit()

    skills_data = await LearningService.get_student_skills(db_session, test_student.id)
    matching = next((s for s in skills_data if s["skill_id"] == skill.id), None)
    assert matching is not None

    # Verify all 8 tracked fields
    assert matching["attempts_count"] == 4
    assert matching["accuracy"] == pytest.approx(0.75, abs=0.01)
    assert matching["mastery_score"] == 68.5
    assert matching["confidence"] == 0.75
    assert matching["confidence_label"] == "High"
    assert matching["recency_days"] is not None
    assert matching["evidence_count"] == 2
    assert matching["estimated_level"] == "B1"
    assert matching["last_assessed_at"] is not None
    assert matching["dimension"] == "reasoning"
