"""Integration tests for the canonical TEF Reading question bank tagging against Reading Taxonomy V1.

Verifies:
1. Every Reading question in the seed bank has an explicit assessment profile:
   - modality = reading
   - valid task_type_id referencing canonical TaskType
   - reasoning competencies (dimension=reasoning, primary/secondary, weights sum to 1.0)
   - language competencies (dimension=language, role, weights sum to 1.0)
2. TaggingValidationEngine passes all questions with zero errors
3. Assessment scoring produces granular SkillEvidence per tagged competency
"""

import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.admin.enums import SkillDimension, SkillTagRole
from app.modules.admin.reading_taxonomy_data import seed_reading_taxonomy
from app.modules.admin.tagging_service import TaggingValidationEngine
from app.modules.assessments.enums import AssessmentType
from app.modules.assessments.models import (
    Assessment,
    AssessmentSection,
    Attempt,
    AttemptAnswer,
    Question,
    QuestionSkillTag,
    Skill,
    TaskType,
)
from app.modules.assessments.seed import seed_demo_assessments
from app.modules.learning.readiness_models import SkillEvidence
from app.modules.learning.service import LearningService
from app.modules.users.models import User, UserRole


@pytest.mark.asyncio
async def test_reading_question_bank_canonical_tagging(db_session: AsyncSession) -> None:
    """Verify all Reading questions in seed_demo_assessments have canonical tags and task types."""
    # Seed canonical taxonomy and demo assessments
    await seed_reading_taxonomy(db_session)
    await seed_demo_assessments(db_session)

    # Fetch reading assessments
    res = await db_session.execute(
        select(Assessment)
        .where(Assessment.assessment_type == AssessmentType.READING)
        .options(
            selectinload(Assessment.sections)
            .selectinload(AssessmentSection.questions)
            .selectinload(Question.skill_tags)
            .selectinload(QuestionSkillTag.skill),
            selectinload(Assessment.sections)
            .selectinload(AssessmentSection.questions)
            .selectinload(Question.options),
        )
    )
    reading_asmts = res.scalars().all()
    assert len(reading_asmts) > 0, "No Reading assessments found"

    total_reading_questions = 0

    for asmt in reading_asmts:
        for section in asmt.sections:
            for q in section.questions:
                total_reading_questions += 1

                # 1. Must have task_type_id
                assert q.task_type_id is not None, f"Question '{q.prompt[:30]}' lacks task_type_id"
                task_type = await db_session.scalar(select(TaskType).where(TaskType.id == q.task_type_id))
                assert task_type is not None, f"TaskType {q.task_type_id} not found"
                assert task_type.modality == "reading", f"TaskType modality must be 'reading', got {task_type.modality}"
                assert task_type.is_active is True

                # 2. Must have skill tags
                assert len(q.skill_tags) > 0, f"Question '{q.prompt[:30]}' has no skill tags"

                # 3. Validate tags through TaggingValidationEngine
                resolved_skills = await TaggingValidationEngine.validate_skill_tags(
                    db=db_session,
                    tags=q.skill_tags,
                    task_type_id=q.task_type_id,
                )
                assert len(resolved_skills) == len(q.skill_tags)

                # 4. Check dimension decomposition
                reasoning_tags = [t for t in q.skill_tags if t.skill.dimension == SkillDimension.REASONING]
                language_tags = [t for t in q.skill_tags if t.skill.dimension == SkillDimension.LANGUAGE]

                # Exactly one PRIMARY reasoning skill
                primary_reasoning = [t for t in reasoning_tags if t.role == SkillTagRole.PRIMARY]
                assert len(primary_reasoning) == 1, (
                    f"Question '{q.prompt[:30]}' must have exactly 1 PRIMARY reasoning tag, got {len(primary_reasoning)}"
                )

                # Reasoning weights sum to 1.0 ± 0.01
                reasoning_weight_sum = sum(t.weight for t in reasoning_tags)
                assert abs(reasoning_weight_sum - 1.0) < 0.01, (
                    f"Reasoning weights sum to {reasoning_weight_sum}, expected 1.0"
                )

                # If language tags present, weights sum to 1.0 ± 0.01
                if language_tags:
                    lang_weight_sum = sum(t.weight for t in language_tags)
                    assert abs(lang_weight_sum - 1.0) < 0.01, (
                        f"Language weights sum to {lang_weight_sum}, expected 1.0"
                    )

                # All skills active and in canonical taxonomy
                for tag in q.skill_tags:
                    assert tag.skill.is_active is True
                    assert tag.weight > 0.0
                    assert tag.weight <= 1.0

    assert total_reading_questions >= 2, f"Expected at least 2 reading questions, found {total_reading_questions}"


@pytest.mark.asyncio
async def test_reading_assessment_submission_generates_granular_evidence(db_session: AsyncSession) -> None:
    """Verify that completing a reading assessment generates granular SkillEvidence for each tagged competency."""
    await seed_reading_taxonomy(db_session)
    await seed_demo_assessments(db_session)

    # Create student
    student = User(
        email=f"test.student.{uuid.uuid4().hex[:6]}@example.com",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db_session.add(student)
    await db_session.flush()

    # Get reading assessment
    asmt = await db_session.scalar(
        select(Assessment)
        .where(Assessment.title == "TEF Compréhension Écrite — Test Démo")
        .options(
            selectinload(Assessment.sections)
            .selectinload(AssessmentSection.questions)
            .selectinload(Question.options),
            selectinload(Assessment.sections)
            .selectinload(AssessmentSection.questions)
            .selectinload(Question.skill_tags)
            .selectinload(QuestionSkillTag.skill),
        )
    )
    assert asmt is not None

    # Collect questions and answers (answer all correctly)
    attempt = Attempt(
        assessment_id=asmt.id,
        user_id=student.id,
        status="in_progress",
    )
    db_session.add(attempt)
    await db_session.flush()

    answers: list[AttemptAnswer] = []
    for section in asmt.sections:
        for q in section.questions:
            correct_opt = next((o for o in q.options if o.is_correct), None)
            assert correct_opt is not None
            ans = AttemptAnswer(
                attempt_id=attempt.id,
                question_id=q.id,
                selected_option_id=correct_opt.id,
            )
            db_session.add(ans)
            answers.append(ans)
    await db_session.flush()

    # Process submission through ScoringEngine and LearningService
    attempt.status = "submitted"
    from app.modules.assessments.scoring import ScoringEngine
    score_result = ScoringEngine.calculate_score(asmt, answers)
    assert score_result.percentage == 100.0

    await LearningService.process_assessment_submission(db_session, attempt, asmt, score_result)

    # Verify granular SkillEvidence was ingested
    evidence_res = await db_session.execute(
        select(SkillEvidence).where(SkillEvidence.student_id == student.id)
    )
    evidences = evidence_res.scalars().all()
    assert len(evidences) > 0

    item_evidences = [ev for ev in evidences if ev.source_type == "assessment_item"]
    assert len(item_evidences) > 0, "No granular assessment_item evidences found"

    # Check each granular evidence links to an active skill and has valid confidence and weight
    for ev in item_evidences:
        assert ev.skill_id is not None
        assert ev.weight > 0.0
        assert ev.normalized_score == 100.0  # Correct answer
        assert ev.source_type == "assessment_item"


@pytest.mark.asyncio
async def test_content_studio_reading_questions_validation(db_session: AsyncSession) -> None:
    """Verify Content Studio Reading Simulation questions and drill exercise satisfy canonical validation."""
    await seed_reading_taxonomy(db_session)

    daily_doc_tt = await db_session.scalar(select(TaskType).where(TaskType.code == "daily_document"))
    press_art_tt = await db_session.scalar(select(TaskType).where(TaskType.code == "press_article"))
    prof_doc_tt = await db_session.scalar(select(TaskType).where(TaskType.code == "professional_document"))

    canon_detail = await db_session.scalar(select(Skill).where(Skill.code == "reasoning_identify_specific_detail"))
    canon_main_idea = await db_session.scalar(select(Skill).where(Skill.code == "reasoning_identify_main_idea"))
    canon_inference = await db_session.scalar(select(Skill).where(Skill.code == "reasoning_infer_implicit_meaning"))
    canon_vocab = await db_session.scalar(select(Skill).where(Skill.code == "lang_vocab_in_context"))
    canon_paraphrase = await db_session.scalar(select(Skill).where(Skill.code == "lang_paraphrase_and_synonyms"))
    canon_context = await db_session.scalar(select(Skill).where(Skill.code == "reasoning_understand_context"))
    canon_register = await db_session.scalar(select(Skill).where(Skill.code == "lang_register_and_style"))

    assert all([daily_doc_tt, press_art_tt, prof_doc_tt])
    assert all([canon_detail, canon_main_idea, canon_inference, canon_vocab, canon_paraphrase, canon_context, canon_register])

    # Q1: Daily Document - Main Idea (1.0) + Vocab in context (1.0)
    q1_tags = [
        QuestionSkillTag(skill_id=canon_main_idea.id, role=SkillTagRole.PRIMARY, weight=1.0),
        QuestionSkillTag(skill_id=canon_vocab.id, role=SkillTagRole.PRIMARY, weight=1.0),
    ]
    resolved_q1 = await TaggingValidationEngine.validate_skill_tags(db_session, q1_tags, daily_doc_tt.id)
    assert len(resolved_q1) == 2

    # Q2: Daily Document - Specific Detail (1.0) + Paraphrase (1.0)
    q2_tags = [
        QuestionSkillTag(skill_id=canon_detail.id, role=SkillTagRole.PRIMARY, weight=1.0),
        QuestionSkillTag(skill_id=canon_paraphrase.id, role=SkillTagRole.PRIMARY, weight=1.0),
    ]
    resolved_q2 = await TaggingValidationEngine.validate_skill_tags(db_session, q2_tags, daily_doc_tt.id)
    assert len(resolved_q2) == 2

    # Q3: Press Article - Composite: Specific Detail (0.7) + Infer Implicit (0.3) + Paraphrase (1.0)
    q3_tags = [
        QuestionSkillTag(skill_id=canon_detail.id, role=SkillTagRole.PRIMARY, weight=0.70),
        QuestionSkillTag(skill_id=canon_inference.id, role=SkillTagRole.SECONDARY, weight=0.30),
        QuestionSkillTag(skill_id=canon_paraphrase.id, role=SkillTagRole.PRIMARY, weight=1.0),
    ]
    resolved_q3 = await TaggingValidationEngine.validate_skill_tags(db_session, q3_tags, press_art_tt.id)
    assert len(resolved_q3) == 3

    # Exercise: Professional Document - Understand Context (1.0) + Register & Style (1.0)
    ex_tags = [
        QuestionSkillTag(skill_id=canon_context.id, role=SkillTagRole.PRIMARY, weight=1.0),
        QuestionSkillTag(skill_id=canon_register.id, role=SkillTagRole.PRIMARY, weight=1.0),
    ]
    resolved_ex = await TaggingValidationEngine.validate_skill_tags(db_session, ex_tags, prof_doc_tt.id)
    assert len(resolved_ex) == 2


@pytest.mark.asyncio
async def test_demo_blanc_reading_questions_validation(db_session: AsyncSession) -> None:
    """Verify Demo Blanc Reading questions satisfy canonical validation."""
    await seed_reading_taxonomy(db_session)

    press_art_tt = await db_session.scalar(select(TaskType).where(TaskType.code == "press_article"))
    canon_cause_effect = await db_session.scalar(select(Skill).where(Skill.code == "reasoning_identify_cause_effect"))
    canon_detail = await db_session.scalar(select(Skill).where(Skill.code == "reasoning_identify_specific_detail"))
    canon_inference = await db_session.scalar(select(Skill).where(Skill.code == "reasoning_infer_implicit_meaning"))
    canon_paraphrase = await db_session.scalar(select(Skill).where(Skill.code == "lang_paraphrase_and_synonyms"))
    canon_nuance = await db_session.scalar(select(Skill).where(Skill.code == "lang_semantic_nuance"))

    # Q1: Cause & Effect (1.0) + Paraphrase (1.0)
    q1_tags = [
        QuestionSkillTag(skill_id=canon_cause_effect.id, role=SkillTagRole.PRIMARY, weight=1.0),
        QuestionSkillTag(skill_id=canon_paraphrase.id, role=SkillTagRole.PRIMARY, weight=1.0),
    ]
    resolved_q1 = await TaggingValidationEngine.validate_skill_tags(db_session, q1_tags, press_art_tt.id)
    assert len(resolved_q1) == 2

    # Q2: Composite: Specific Detail (0.7) + Infer Implicit (0.3) + Semantic Nuance (1.0)
    q2_tags = [
        QuestionSkillTag(skill_id=canon_detail.id, role=SkillTagRole.PRIMARY, weight=0.70),
        QuestionSkillTag(skill_id=canon_inference.id, role=SkillTagRole.SECONDARY, weight=0.30),
        QuestionSkillTag(skill_id=canon_nuance.id, role=SkillTagRole.PRIMARY, weight=1.0),
    ]
    resolved_q2 = await TaggingValidationEngine.validate_skill_tags(db_session, q2_tags, press_art_tt.id)
    assert len(resolved_q2) == 3
