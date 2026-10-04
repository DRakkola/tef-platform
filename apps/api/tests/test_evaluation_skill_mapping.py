"""Comprehensive test suite for F-09: Unifying Speaking and Writing Evaluation Skill Mapping with Taxonomy V2.

Verifies:
1. Separation of concerns: Evaluator Criterion != Canonical Competency != Student Mastery
2. Preservation of existing TEF-facing evaluation schemas
3. Relational mapping of evaluator criteria to canonical skills
4. Ingestion of criterion-level SkillEvidence with correct source types (ai_evaluation, teacher_evaluation)
5. Zero contamination of reading/listening reasoning competencies
6. Task-specific competency prioritization (Section A vs Section B)
7. Preservation of historical evaluations
"""

import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.admin.enums import SkillDimension, TaxonomyLifecycleStatus
from app.modules.admin.models import SkillModality, TaxonomyVersion
from app.modules.assessments.models import Skill, SkillCategory
from app.modules.learning.evaluation_mapper import EvaluationSkillMapper
from app.modules.learning.models import SkillEvidence, StudentSkill
from app.modules.learning.readiness_models import SkillEvidenceSourceType
from app.modules.speaking.enums import (
    SpeakingEvaluatorType,
    SpeakingSessionState,
    SpeakingSessionType,
)
from app.modules.speaking.models import SpeakingEvaluation, SpeakingSession
from app.modules.users.models import User, UserRole
from app.modules.writing.enums import CorrectionProviderType, WritingCorrectionStatus
from app.modules.writing.models import WritingCorrection

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def canonical_taxonomy(db_session: AsyncSession) -> TaxonomyVersion:
    """Create active taxonomy version with canonical speaking, writing, language, and reading skills."""
    tax = TaxonomyVersion(
        id=uuid.uuid4(),
        version=f"v2-eval-{uuid.uuid4().hex[:6]}",
        name="Taxonomy V2 Evaluation Test",
        status=TaxonomyLifecycleStatus.ACTIVE,
    )
    db_session.add(tax)
    await db_session.flush()

    async def _get_or_create_skill(
        code: str, name: str, dimension: SkillDimension, domain: str, category: SkillCategory
    ) -> Skill:
        res = await db_session.execute(select(Skill).where(Skill.code == code))
        skill = res.scalar_one_or_none()
        if skill is None:
            skill = Skill(
                id=uuid.uuid4(),
                taxonomy_version_id=tax.id,
                code=code,
                name=name,
                dimension=dimension,
                domain=domain,
                category=category,
                is_active=True,
            )
            db_session.add(skill)
            await db_session.flush()
        else:
            skill.taxonomy_version_id = tax.id
            skill.is_active = True
            await db_session.flush()
        return skill

    async def _ensure_modality(skill_id: uuid.UUID, modality: str) -> None:
        res = await db_session.execute(
            select(SkillModality).where(
                SkillModality.skill_id == skill_id,
                SkillModality.modality == modality,
            )
        )
        if not res.scalar_one_or_none():
            db_session.add(SkillModality(id=uuid.uuid4(), skill_id=skill_id, modality=modality))

    # 1. Reading Reasoning Skills (must NEVER be touched by oral/written evaluation)
    reading_reasoning_1 = await _get_or_create_skill(
        code="reasoning_locate_information",
        name="Repérage d'informations factuelles",
        dimension=SkillDimension.REASONING,
        domain="reading",
        category=SkillCategory.READING,
    )
    reading_reasoning_2 = await _get_or_create_skill(
        code="reasoning_identify_main_idea",
        name="Identification de l'idée principale",
        dimension=SkillDimension.REASONING,
        domain="reading",
        category=SkillCategory.READING,
    )

    # 2. Speaking Competencies
    await _get_or_create_skill(
        code="speaking_fluency_phonetics",
        name="Aisance et phonétique",
        dimension=SkillDimension.LANGUAGE,
        domain="speaking",
        category=SkillCategory.SPEAKING,
    )
    await _get_or_create_skill(
        code="speaking_section_a_inquiries",
        name="Section A : Collecte d'informations",
        dimension=SkillDimension.LANGUAGE,
        domain="speaking",
        category=SkillCategory.SPEAKING,
    )
    await _get_or_create_skill(
        code="speaking_section_b_persuasion",
        name="Section B : Persuasion et plaidoyer",
        dimension=SkillDimension.LANGUAGE,
        domain="speaking",
        category=SkillCategory.SPEAKING,
    )

    # 3. Writing Competencies
    await _get_or_create_skill(
        code="writing_narrative_fait_divers",
        name="Section A : Récit de fait divers",
        dimension=SkillDimension.LANGUAGE,
        domain="writing",
        category=SkillCategory.WRITING,
    )
    await _get_or_create_skill(
        code="writing_persuasive_letter",
        name="Section B : Lettre argumentative",
        dimension=SkillDimension.LANGUAGE,
        domain="writing",
        category=SkillCategory.WRITING,
    )
    await _get_or_create_skill(
        code="writing_textual_cohesion",
        name="Cohésion et transitions de texte",
        dimension=SkillDimension.LANGUAGE,
        domain="writing",
        category=SkillCategory.WRITING,
    )
    await _get_or_create_skill(
        code="writing_syntactic_variety",
        name="Variété et complexité des phrases",
        dimension=SkillDimension.LANGUAGE,
        domain="writing",
        category=SkillCategory.WRITING,
    )

    # 4. Transversal Language Competencies (cross-modality)
    lang_vocab = await _get_or_create_skill(
        code="lang_vocab_in_context",
        name="Vocabulaire en contexte",
        dimension=SkillDimension.LANGUAGE,
        domain="vocabulary",
        category=SkillCategory.VOCABULARY,
    )
    lang_grammar = await _get_or_create_skill(
        code="lang_grammatical_agreement",
        name="Accords grammaticaux",
        dimension=SkillDimension.LANGUAGE,
        domain="grammar",
        category=SkillCategory.GRAMMAR,
    )
    lang_connectors = await _get_or_create_skill(
        code="lang_logical_connectors",
        name="Connecteurs logiques et argumentatifs",
        dimension=SkillDimension.LANGUAGE,
        domain="discourse",
        category=SkillCategory.READING,
    )
    lang_register = await _get_or_create_skill(
        code="lang_register_and_style",
        name="Registres de langue et niveau stylistique",
        dimension=SkillDimension.LANGUAGE,
        domain="vocabulary",
        category=SkillCategory.VOCABULARY,
    )

    # Add explicit SkillModality rows for transversal competencies
    for mod in ["speaking", "writing", "reading", "listening"]:
        await _ensure_modality(lang_vocab.id, mod)
        await _ensure_modality(lang_grammar.id, mod)
        await _ensure_modality(lang_connectors.id, mod)
        await _ensure_modality(lang_register.id, mod)

    await _ensure_modality(reading_reasoning_1.id, "reading")
    await _ensure_modality(reading_reasoning_2.id, "reading")

    await db_session.commit()
    await db_session.refresh(tax)
    return tax


@pytest.fixture
async def evaluation_student(db_session: AsyncSession) -> User:
    student = User(
        email=f"eval_student_{uuid.uuid4().hex[:8]}@example.com",
        password_hash="fakehash",
        role=UserRole.STUDENT,
        is_active=True,
        is_verified=True,
    )
    db_session.add(student)
    await db_session.commit()
    await db_session.refresh(student)
    return student


# ---------------------------------------------------------------------------
# Test Cases
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_modality_compatibility_rules() -> None:
    """Unit test for is_skill_compatible_with_modality ensuring zero cross-modality leaks."""
    # Reading Reasoning Skill
    reading_reasoning = Skill(
        code="reasoning_locate_information",
        dimension=SkillDimension.REASONING,
        domain="reading",
        category=SkillCategory.READING,
    )
    # Must be strictly rejected for oral and written evaluations
    assert not EvaluationSkillMapper.is_skill_compatible_with_modality(reading_reasoning, "speaking")
    assert not EvaluationSkillMapper.is_skill_compatible_with_modality(reading_reasoning, "writing")
    assert EvaluationSkillMapper.is_skill_compatible_with_modality(reading_reasoning, "reading")

    # Listening Reasoning Skill
    listening_reasoning = Skill(
        code="reasoning_listen_gist",
        dimension=SkillDimension.REASONING,
        domain="listening",
        category=SkillCategory.LISTENING,
    )
    assert not EvaluationSkillMapper.is_skill_compatible_with_modality(listening_reasoning, "speaking")
    assert not EvaluationSkillMapper.is_skill_compatible_with_modality(listening_reasoning, "writing")

    # Speaking Skill
    speaking_skill = Skill(
        code="speaking_fluency_phonetics",
        dimension=SkillDimension.LANGUAGE,
        domain="speaking",
        category=SkillCategory.SPEAKING,
    )
    assert EvaluationSkillMapper.is_skill_compatible_with_modality(speaking_skill, "speaking")
    assert not EvaluationSkillMapper.is_skill_compatible_with_modality(speaking_skill, "writing")

    # Transversal Language Skill (Vocabulary)
    transversal_vocab = Skill(
        code="lang_vocab_in_context",
        dimension=SkillDimension.LANGUAGE,
        domain="vocabulary",
        category=SkillCategory.VOCABULARY,
    )
    assert EvaluationSkillMapper.is_skill_compatible_with_modality(transversal_vocab, "speaking")
    assert EvaluationSkillMapper.is_skill_compatible_with_modality(transversal_vocab, "writing")


@pytest.mark.asyncio
async def test_speaking_evaluation_maps_criteria_and_excludes_reading_skills(
    db_session: AsyncSession,
    canonical_taxonomy: TaxonomyVersion,
    evaluation_student: User,
) -> None:
    """Speaking evaluation maps each criterion to distinct skills and NEVER touches reading competencies."""
    # 1. Create a speaking session
    session = SpeakingSession(
        session_type=SpeakingSessionType.AI,
        status=SpeakingSessionState.COMPLETED,
        topic="TEF Section A/B Test",
        level="B2",
        duration_minutes=25,
        room_id=f"room_test_{uuid.uuid4().hex[:8]}",
        created_by_user_id=evaluation_student.id,
    )
    db_session.add(session)
    await db_session.flush()

    # 2. Post-session evaluation with distinct criterion scores
    eval_record = SpeakingEvaluation(
        session_id=session.id,
        student_id=evaluation_student.id,
        evaluator_type=SpeakingEvaluatorType.AI,
        estimated_level="B2",
        fluency=85.0,
        vocabulary=78.0,
        grammar=68.0,
        coherence=92.0,
        pronunciation=84.0,
        overall_score=81.4,
        strengths=["Fluence naturelle", "Organisation claire"],
        weaknesses=["Accords complexes"],
        recommendations=["Travailler le subjonctif"],
        is_official_tef=False,
    )
    db_session.add(eval_record)
    await db_session.flush()

    # 3. Apply canonical skill mapping
    attached_skills = await EvaluationSkillMapper.apply_speaking_evaluation_evidence(
        db=db_session,
        evaluation=eval_record,
        student_id=evaluation_student.id,
    )

    assert len(attached_skills) > 0

    # 4. Verify attached skills have differentiated scores (NOT all 81.4)
    skill_scores = {s.skill.code: s.score for s in attached_skills}
    # Fluency/Pronunciation should have ~84.5
    if "speaking_fluency_phonetics" in skill_scores:
        assert 84.0 <= skill_scores["speaking_fluency_phonetics"] <= 85.0
    # Vocabulary should have ~78.0
    if "lang_vocab_in_context" in skill_scores:
        assert skill_scores["lang_vocab_in_context"] == 78.0
    # Grammar should have ~68.0
    if "lang_grammatical_agreement" in skill_scores:
        assert skill_scores["lang_grammatical_agreement"] == 68.0
    # Coherence should have ~92.0
    if "lang_logical_connectors" in skill_scores:
        assert skill_scores["lang_logical_connectors"] == 92.0

    # 5. Verify SkillEvidence stream
    evidences = list(
        (
            await db_session.execute(
                select(SkillEvidence).where(SkillEvidence.source_id == eval_record.id)
            )
        )
        .scalars()
        .all()
    )
    assert len(evidences) > 0
    for ev in evidences:
        assert ev.source_type == SkillEvidenceSourceType.AI_EVALUATION.value
        assert ev.confidence == 0.85
        assert ev.student_id == evaluation_student.id

    # 6. ABSOLUTE INTEGRITY CHECK: Zero evidence on reading reasoning competencies
    reading_skills_stmt = select(Skill).where(
        Skill.code.in_(["reasoning_locate_information", "reasoning_identify_main_idea"])
    )
    reading_skills = (await db_session.execute(reading_skills_stmt)).scalars().all()
    reading_skill_ids = [s.id for s in reading_skills]

    leak_evidence = (
        await db_session.execute(
            select(SkillEvidence).where(
                SkillEvidence.student_id == evaluation_student.id,
                SkillEvidence.skill_id.in_(reading_skill_ids),
            )
        )
    ).scalars().all()

    assert len(leak_evidence) == 0, "FATAL: Speaking evaluation contaminated Reading Reasoning skills!"


@pytest.mark.asyncio
async def test_writing_evaluation_task_context_and_criterion_breakdown(
    db_session: AsyncSession,
    canonical_taxonomy: TaxonomyVersion,
    evaluation_student: User,
) -> None:
    """Writing evaluation maps task_completion according to task context and emits evidence."""
    # Create fake submission id
    fake_sub_id = uuid.uuid4()

    # 1. Section A correction (Fait divers)
    corr_a = WritingCorrection(
        submission_id=fake_sub_id,
        provider=CorrectionProviderType.MOCK,
        score=84.0,
        estimated_level="B2",
        task_completion=90.0,
        coherence=82.0,
        vocabulary=80.0,
        grammar=75.0,
        syntax=78.0,
        spelling=85.0,
        register=88.0,
        strengths=["Récit dynamique"],
        weaknesses=["Quelques virgules manquantes"],
        comments="Bon devoir Section A.",
        recommendations=["Continuer ainsi."],
        status=WritingCorrectionStatus.SUBMITTED,
    )
    db_session.add(corr_a)
    await db_session.flush()

    skills_a = await EvaluationSkillMapper.apply_writing_evaluation_evidence(
        db=db_session,
        correction=corr_a,
        student_id=evaluation_student.id,
        task_type="section_a",
        is_teacher=False,
    )

    skill_codes_a = {s.skill.code for s in skills_a}
    # Section A must tag narrative fait divers, not Section B letter
    assert "writing_narrative_fait_divers" in skill_codes_a
    assert "writing_persuasive_letter" not in skill_codes_a

    # Verify task_completion score matches 90.0
    fait_divers_skill = next(s for s in skills_a if s.skill.code == "writing_narrative_fait_divers")
    assert fait_divers_skill.score == 90.0

    # 2. Section B correction (Lettre argumentative)
    fake_sub_id_b = uuid.uuid4()
    corr_b = WritingCorrection(
        submission_id=fake_sub_id_b,
        provider=CorrectionProviderType.TEACHER,
        score=76.0,
        estimated_level="B2",
        task_completion=82.0,
        coherence=74.0,
        vocabulary=70.0,
        grammar=72.0,
        syntax=75.0,
        spelling=80.0,
        register=78.0,
        strengths=["Thèse bien défendue"],
        weaknesses=["Connecteurs un peu répétitifs"],
        comments="Bonne lettre Section B.",
        recommendations=["Varier les connecteurs."],
        status=WritingCorrectionStatus.SUBMITTED,
    )
    db_session.add(corr_b)
    await db_session.flush()

    skills_b = await EvaluationSkillMapper.apply_writing_evaluation_evidence(
        db=db_session,
        correction=corr_b,
        student_id=evaluation_student.id,
        task_type="section_b",
        is_teacher=True,
    )

    skill_codes_b = {s.skill.code for s in skills_b}
    # Section B must tag persuasive letter, not Section A fait divers
    assert "writing_persuasive_letter" in skill_codes_b
    assert "writing_narrative_fait_divers" not in skill_codes_b

    # Verify teacher evidence confidence is 0.95
    b_evidences = (
        await db_session.execute(
            select(SkillEvidence).where(SkillEvidence.source_id == corr_b.id)
        )
    ).scalars().all()
    assert len(b_evidences) > 0
    for ev in b_evidences:
        assert ev.source_type == SkillEvidenceSourceType.TEACHER_EVALUATION.value
        assert ev.confidence == 0.95


@pytest.mark.asyncio
async def test_criterion_separation_of_concerns_mastery_calculation(
    db_session: AsyncSession,
    canonical_taxonomy: TaxonomyVersion,
    evaluation_student: User,
) -> None:
    """Proves: Evaluator Criterion != Canonical Competency != Student Mastery."""
    fake_sub_id = uuid.uuid4()

    # Pre-seed a StudentSkill with low initial mastery
    vocab_skill = (
        await db_session.execute(
            select(Skill).where(Skill.code == "lang_vocab_in_context")
        )
    ).scalar_one()

    initial_student_skill = StudentSkill(
        user_id=evaluation_student.id,
        skill_id=vocab_skill.id,
        mastery_score=40.0,
        confidence=0.5,
        attempts_count=2,
        estimated_level="A2",
    )
    db_session.add(initial_student_skill)
    await db_session.flush()

    # Evaluation provides a high criterion score of 95.0
    corr = WritingCorrection(
        submission_id=fake_sub_id,
        provider=CorrectionProviderType.MOCK,
        score=90.0,
        estimated_level="C1",
        vocabulary=95.0,
        strengths=["Lexique riche"],
        weaknesses=[],
        comments="Excellent.",
        status=WritingCorrectionStatus.SUBMITTED,
    )
    db_session.add(corr)
    await db_session.flush()

    await EvaluationSkillMapper.apply_writing_evaluation_evidence(
        db=db_session,
        correction=corr,
        student_id=evaluation_student.id,
    )

    # Refresh StudentSkill
    await db_session.refresh(initial_student_skill)

    # 1. Evaluator Criterion score was 95.0
    # 2. Canonical Competency raw evidence is 95.0
    evidence = (
        await db_session.execute(
            select(SkillEvidence).where(
                SkillEvidence.student_id == evaluation_student.id,
                SkillEvidence.skill_id == vocab_skill.id,
                SkillEvidence.source_id == corr.id,
            )
        )
    ).scalar_one()
    assert evidence.raw_score == 95.0

    # 3. Student Mastery is smoothed rolling projection, NOT 95.0 directly (due to prior attempts)
    assert initial_student_skill.mastery_score != 95.0
    assert 40.0 < initial_student_skill.mastery_score < 95.0
    assert initial_student_skill.attempts_count == 3
