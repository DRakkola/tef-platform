"""Comprehensive tests for canonical RecommendationEngineV2.

Validates:
- Evidence-based recommendations backed by SkillEvidence
- Recency and confidence scaling
- Distinguishing insufficient_evidence vs emerging_weakness vs confirmed_weakness
- Prerequisite recommendations
- Archived skills exclusion (is_active=False)
- Taxonomy version filtering (scoping to taxonomy_version_id)
- Multi-skill evidence aggregation
- Direct skill/subskill/parent targeting when exercises are absent
- API contract preservation with dynamic taxonomy metadata (no hardcoded category fallbacks)
"""

import datetime
import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.admin.enums import SkillDimension, SkillRelationType, TaxonomyLifecycleStatus
from app.modules.admin.models import (
    SkillLevelDescriptor,
    SkillModality,
    SkillRelation,
    TaxonomyVersion,
)
from app.modules.assessments.models import Skill
from app.modules.learning.enums import (
    RecommendationStatus,
    RecommendationType,
    SkillCategory,
)
from app.modules.learning.models import (
    Exercise,
    ExerciseAttempt,
    ExerciseSkill,
    Mistake,
    SkillEvidence,
    StudentSkill,
)
from app.modules.learning.recommendations_v2 import RecommendationEngineV2
from app.modules.users.models import User

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_test_taxonomy(db: AsyncSession, name: str = "Test Taxonomy V2") -> TaxonomyVersion:
    tv = TaxonomyVersion(
        id=uuid.uuid4(),
        version=f"v2-{uuid.uuid4().hex[:6]}",
        name=name,
        status=TaxonomyLifecycleStatus.ACTIVE,
    )
    db.add(tv)
    await db.flush()
    return tv


async def _create_skill(
    db: AsyncSession,
    version_id: uuid.UUID,
    code: str,
    name: str,
    dimension: SkillDimension = SkillDimension.REASONING,
    domain: str = "reading",
    is_active: bool = True,
    parent_id: uuid.UUID | None = None,
    modalities: list[str] | None = None,
) -> Skill:
    sk = Skill(
        id=uuid.uuid4(),
        taxonomy_version_id=version_id,
        code=code,
        name=name,
        dimension=dimension,
        domain=domain,
        category=SkillCategory.READING,
        is_active=is_active,
        parent_id=parent_id,
    )
    db.add(sk)
    await db.flush()

    for mod in modalities or ["reading"]:
        sm = SkillModality(
            id=uuid.uuid4(),
            skill_id=sk.id,
            modality=mod,
            is_primary=(mod == (modalities or ["reading"])[0]),
        )
        db.add(sm)
    await db.flush()
    return sk


# ---------------------------------------------------------------------------
# 1. Evidence-based explanation and confirmed weakness
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_evidence_based_recommendations_explanation(
    db_session: AsyncSession,
    test_student: User,
):
    """Reason cites specific skill code, observation count, question evidence, and mastery."""
    tv = await _create_test_taxonomy(db_session)
    skill = await _create_skill(
        db_session,
        tv.id,
        code=f"ref_res_{uuid.uuid4().hex[:4]}",
        name="Résolution de références anaphoriques",
        modalities=["reading"],
    )

    now = datetime.datetime.now(datetime.UTC)
    # Record 8 SkillEvidence items from assessment items
    for i in range(8):
        ev = SkillEvidence(
            id=uuid.uuid4(),
            student_id=test_student.id,
            skill_id=skill.id,
            source_type="assessment_item",
            source_id=uuid.uuid4(),
            raw_score=0.45,
            normalized_score=45.0,
            confidence=0.85,
            weight=1.0,
            observed_at=now - datetime.timedelta(days=i),
            metadata_payload={"question_id": str(uuid.uuid4()), "role": "primary"},
        )
        db_session.add(ev)

    # StudentSkill reflecting rolling mastery
    ss = StudentSkill(
        user_id=test_student.id,
        skill_id=skill.id,
        mastery_score=45.0,
        confidence=0.85,
        attempts_count=8,
        last_assessed_at=now,
    )
    db_session.add(ss)

    # Also log 2 mistakes
    mistake = Mistake(
        id=uuid.uuid4(),
        user_id=test_student.id,
        skill_id=skill.id,
        source_type="assessment",
        source_id=uuid.uuid4(),
        error_count=2,
    )
    db_session.add(mistake)
    await db_session.commit()

    recs = await RecommendationEngineV2.generate_recommendations(db_session, test_student.id)
    assert len(recs) >= 1
    rec = recs[0]

    # Must be confirmed weakness (8 observations, confidence 0.85)
    assert rec.priority >= 70
    assert skill.code in rec.reason
    assert "8 observation(s)" in rec.reason or "8 question(s)" in rec.reason
    assert "45%" in rec.reason
    assert "faiblesse confirmée" in rec.reason.lower()


# ---------------------------------------------------------------------------
# 2. Distinction: insufficient evidence vs emerging vs confirmed
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_insufficient_vs_emerging_vs_confirmed(
    db_session: AsyncSession,
    test_student: User,
):
    """Engine classifies weak skills into 3 distinct tiers with appropriate reasons and priorities."""
    tv = await _create_test_taxonomy(db_session)

    # 1. Insufficient evidence skill: 1 attempt, confidence 0.15
    sk_insuf = await _create_skill(db_session, tv.id, f"insuf_{uuid.uuid4().hex[:4]}", "Vocabulaire rare")
    ss_insuf = StudentSkill(
        user_id=test_student.id,
        skill_id=sk_insuf.id,
        mastery_score=30.0,
        confidence=0.15,
        attempts_count=1,
    )

    # 2. Emerging weakness skill: 3 attempts, confidence 0.45
    sk_emerg = await _create_skill(db_session, tv.id, f"emerg_{uuid.uuid4().hex[:4]}", "Concordance des temps")
    ss_emerg = StudentSkill(
        user_id=test_student.id,
        skill_id=sk_emerg.id,
        mastery_score=40.0,
        confidence=0.45,
        attempts_count=3,
    )

    # 3. Confirmed weakness skill: 7 attempts, confidence 0.80
    sk_conf = await _create_skill(db_session, tv.id, f"conf_{uuid.uuid4().hex[:4]}", "Inférence implicite")
    ss_conf = StudentSkill(
        user_id=test_student.id,
        skill_id=sk_conf.id,
        mastery_score=35.0,
        confidence=0.80,
        attempts_count=7,
    )

    db_session.add_all([ss_insuf, ss_emerg, ss_conf])
    await db_session.commit()

    recs = await RecommendationEngineV2.generate_recommendations(db_session, test_student.id)
    recs_by_skill = {r.skill_id: r for r in recs}

    assert sk_insuf.id in recs_by_skill
    assert sk_emerg.id in recs_by_skill
    assert sk_conf.id in recs_by_skill

    # Insufficient: priority <= 45, reason mentions diagnostic
    rec_insuf = recs_by_skill[sk_insuf.id]
    assert rec_insuf.priority <= 45
    assert "diagnostic" in rec_insuf.reason.lower()

    # Emerging: priority 45..70, reason mentions émergente
    rec_emerg = recs_by_skill[sk_emerg.id]
    assert 45 <= rec_emerg.priority <= 70
    assert "émergente" in rec_emerg.reason.lower()

    # Confirmed: priority >= 70, reason mentions confirmée
    rec_conf = recs_by_skill[sk_conf.id]
    assert rec_conf.priority >= 70
    assert "confirmée" in rec_conf.reason.lower()


# ---------------------------------------------------------------------------
# 3. Prerequisite recommendations take precedence
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_prerequisite_recommendations(
    db_session: AsyncSession,
    test_student: User,
):
    """Unmet prerequisite is prioritized before the dependent weak skill."""
    tv = await _create_test_taxonomy(db_session)
    prereq_skill = await _create_skill(db_session, tv.id, f"syntax_{uuid.uuid4().hex[:4]}", "Syntaxe de base")
    target_skill = await _create_skill(db_session, tv.id, f"argum_{uuid.uuid4().hex[:4]}", "Argumentation complexe")

    # Link prerequisite
    rel = SkillRelation(
        id=uuid.uuid4(),
        from_skill_id=prereq_skill.id,
        to_skill_id=target_skill.id,
        relation_type=SkillRelationType.PREREQUISITE,
    )
    db_session.add(rel)

    # Student has weak target skill and no mastery in prereq
    ss_target = StudentSkill(
        user_id=test_student.id,
        skill_id=target_skill.id,
        mastery_score=40.0,
        confidence=0.75,
        attempts_count=6,
    )
    db_session.add(ss_target)
    await db_session.commit()

    recs = await RecommendationEngineV2.generate_recommendations(db_session, test_student.id)

    # Prerequisite must be recommended with high priority
    prereq_rec = next((r for r in recs if r.skill_id == prereq_skill.id), None)
    assert prereq_rec is not None
    assert prereq_rec.priority >= 85
    assert "prérequis" in prereq_rec.reason.lower()
    assert prereq_skill.code in prereq_rec.reason


# ---------------------------------------------------------------------------
# 4. Archived skills (is_active=False) are ignored
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_archived_skills_ignored(
    db_session: AsyncSession,
    test_student: User,
):
    """Archived / deactivated skills must NOT generate recommendations."""
    tv = await _create_test_taxonomy(db_session)
    archived_skill = await _create_skill(
        db_session,
        tv.id,
        code=f"arch_{uuid.uuid4().hex[:4]}",
        name="Compétence obsolète",
        is_active=False,
    )

    ss = StudentSkill(
        user_id=test_student.id,
        skill_id=archived_skill.id,
        mastery_score=15.0,
        confidence=0.9,
        attempts_count=10,
    )
    db_session.add(ss)
    await db_session.commit()

    recs = await RecommendationEngineV2.generate_recommendations(db_session, test_student.id)
    arch_rec = next((r for r in recs if r.skill_id == archived_skill.id), None)
    assert arch_rec is None


# ---------------------------------------------------------------------------
# 5. Taxonomy version filtering
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_taxonomy_version_filtering(
    db_session: AsyncSession,
    test_student: User,
):
    """Filtering by taxonomy_version_id isolates recommendations to that specific version."""
    v1 = await _create_test_taxonomy(db_session, name="Taxonomy V1")
    v2 = await _create_test_taxonomy(db_session, name="Taxonomy V2")

    skill_v1 = await _create_skill(db_session, v1.id, f"v1_sk_{uuid.uuid4().hex[:4]}", "Skill V1")
    skill_v2 = await _create_skill(db_session, v2.id, f"v2_sk_{uuid.uuid4().hex[:4]}", "Skill V2")

    ss1 = StudentSkill(user_id=test_student.id, skill_id=skill_v1.id, mastery_score=30.0, confidence=0.7, attempts_count=5)
    ss2 = StudentSkill(user_id=test_student.id, skill_id=skill_v2.id, mastery_score=30.0, confidence=0.7, attempts_count=5)
    db_session.add_all([ss1, ss2])
    await db_session.commit()

    # Request recommendations scoped specifically to V2
    recs_v2 = await RecommendationEngineV2.generate_recommendations(
        db=db_session,
        user_id=test_student.id,
        taxonomy_version_id=v2.id,
    )
    rec_skill_ids = {r.skill_id for r in recs_v2}
    assert skill_v2.id in rec_skill_ids
    assert skill_v1.id not in rec_skill_ids


# ---------------------------------------------------------------------------
# 6. Direct competency targeting when no exercises are mapped
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_direct_competency_targeting_without_exercises(
    db_session: AsyncSession,
    test_student: User,
):
    """If no exercise exists, recommendation targets the subskill / skill directly."""
    tv = await _create_test_taxonomy(db_session)
    root = await _create_skill(db_session, tv.id, f"root_{uuid.uuid4().hex[:4]}", "Racine Compréhension")
    subskill = await _create_skill(
        db_session,
        tv.id,
        code=f"sub_{uuid.uuid4().hex[:4]}",
        name="Repérage d'indices temporels",
        parent_id=root.id,
    )

    ss = StudentSkill(
        user_id=test_student.id,
        skill_id=subskill.id,
        mastery_score=50.0,
        confidence=0.6,
        attempts_count=3,
    )
    db_session.add(ss)
    await db_session.commit()

    recs = await RecommendationEngineV2.generate_recommendations(db_session, test_student.id)
    assert len(recs) >= 1
    rec = next(r for r in recs if r.skill_id == subskill.id)
    assert rec.entity_type == "subskill"
    assert rec.entity_id == subskill.id
    assert rec.recommendation_type == RecommendationType.REVIEW


# ---------------------------------------------------------------------------
# 7. Hierarchical exercise resolution (subskill inherits parent exercises)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_hierarchical_exercise_targeting(
    db_session: AsyncSession,
    test_student: User,
):
    """Subskill finds exercises tagged on its parent competency."""
    tv = await _create_test_taxonomy(db_session)
    parent_skill = await _create_skill(db_session, tv.id, f"par_{uuid.uuid4().hex[:4]}", "Stratégies globales")
    child_skill = await _create_skill(
        db_session,
        tv.id,
        code=f"chi_{uuid.uuid4().hex[:4]}",
        name="Survol rapide",
        parent_id=parent_skill.id,
    )

    # Exercise tagged with parent competency
    ex = Exercise(
        title="Exercice de stratégie globale",
        prompt="Lisez rapidement...",
        category=SkillCategory.READING,
        level="B2",
        difficulty=3,
        is_published=True,
    )
    db_session.add(ex)
    await db_session.flush()

    es = ExerciseSkill(exercise_id=ex.id, skill_id=parent_skill.id, weight=1.0)
    db_session.add(es)

    ss = StudentSkill(
        user_id=test_student.id,
        skill_id=child_skill.id,
        mastery_score=40.0,
        confidence=0.7,
        attempts_count=4,
    )
    db_session.add(ss)
    await db_session.commit()

    recs = await RecommendationEngineV2.generate_recommendations(db_session, test_student.id)
    rec = next((r for r in recs if r.skill_id == child_skill.id), None)
    assert rec is not None
    assert rec.entity_type == "exercise"
    assert rec.entity_id == ex.id


# ---------------------------------------------------------------------------
# 8. API Contract & Metadata without hardcoded category fallback
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_recommendations_contract_and_metadata(
    db_session: AsyncSession,
    test_student: User,
):
    """get_recommendations returns full schema without hardcoded fallbacks."""
    tv = await _create_test_taxonomy(db_session)
    skill = await _create_skill(
        db_session,
        tv.id,
        code=f"contract_{uuid.uuid4().hex[:4]}",
        name="Structure syntaxique complexe",
        dimension=SkillDimension.LANGUAGE,
        domain="syntax",
        modalities=["reading", "writing"],
    )

    # Add CEFR descriptor
    desc = SkillLevelDescriptor(
        id=uuid.uuid4(),
        skill_id=skill.id,
        level="B2",
        descriptor="Comprend les propositions subordonnées complexes",
        evidence_guidance="Observer le repérage correct des marqueurs temporels",
    )
    db_session.add(desc)

    ss = StudentSkill(
        user_id=test_student.id,
        skill_id=skill.id,
        mastery_score=45.0,
        confidence=0.8,
        attempts_count=6,
    )
    db_session.add(ss)
    await db_session.commit()

    await RecommendationEngineV2.generate_recommendations(db_session, test_student.id)
    results = await RecommendationEngineV2.get_recommendations(db_session, test_student.id)

    assert len(results) >= 1
    item = next(i for i in results if i["skill_id"] == skill.id)

    # Check preserved contracts
    assert item["skill_code"] == skill.code
    assert item["skill_name"] == skill.name
    assert item["dimension"] == "language"
    assert item["domain"] == "syntax"
    assert "reading" in item["applicable_modalities"]
    assert "writing" in item["applicable_modalities"]
    assert item["descriptor"] == "Comprend les propositions subordonnées complexes"
    assert item["evidence_guidance"] == "Observer le repérage correct des marqueurs temporels"
    assert item["priority"] >= 60
    assert item["status"] == RecommendationStatus.ACTIVE


# ---------------------------------------------------------------------------
# 9. Cooldown and Deduplication
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_cooldown_and_deduplication(
    db_session: AsyncSession,
    test_student: User,
):
    """Completed exercise in last 48h is not recommended, and multiple runs deduplicate."""
    tv = await _create_test_taxonomy(db_session)
    skill = await _create_skill(db_session, tv.id, f"cool_{uuid.uuid4().hex[:4]}", "Accords du participe")

    ex1 = Exercise(title="Exercice Récent", prompt="P1", category=SkillCategory.GRAMMAR, level="B1", difficulty=2, is_published=True)
    ex2 = Exercise(title="Exercice Dispo", prompt="P2", category=SkillCategory.GRAMMAR, level="B1", difficulty=2, is_published=True)
    db_session.add_all([ex1, ex2])
    await db_session.flush()

    db_session.add(ExerciseSkill(exercise_id=ex1.id, skill_id=skill.id, weight=1.0))
    db_session.add(ExerciseSkill(exercise_id=ex2.id, skill_id=skill.id, weight=1.0))

    # Mark ex1 as successfully attempted 2 hours ago (within 48h cooldown)
    att = ExerciseAttempt(
        user_id=test_student.id,
        exercise_id=ex1.id,
        is_correct=True,
        points_awarded=10.0,
        attempted_at=datetime.datetime.now(datetime.UTC) - datetime.timedelta(hours=2),
    )
    db_session.add(att)

    ss = StudentSkill(
        user_id=test_student.id,
        skill_id=skill.id,
        mastery_score=50.0,
        confidence=0.7,
        attempts_count=5,
    )
    db_session.add(ss)
    await db_session.commit()

    recs_1 = await RecommendationEngineV2.generate_recommendations(db_session, test_student.id)
    # ex1 must be excluded by cooldown, ex2 recommended
    recommended_ex_ids = {r.entity_id for r in recs_1 if r.entity_type == "exercise"}
    assert ex1.id not in recommended_ex_ids
    assert ex2.id in recommended_ex_ids

    # Second run should deduplicate and return exact same count
    recs_2 = await RecommendationEngineV2.generate_recommendations(db_session, test_student.id)
    assert len(recs_2) == len(recs_1)
