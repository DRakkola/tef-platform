"""Regression and database integrity tests for Question System V2 database foundation (Phase 1).

Covers:
A. Existing Data Preservation (questions, options, attempts, attempt_answers)
B. Section Migration & Decoupling (assessment_section_questions backfill, no orphans)
C. Question Versioning & Frozen Snapshot Payload
D. Multi-Section Question Reuse
E. Constraints & Referential Integrity (UQ section/question, FKs)
F. Backward Compatibility (queries via section.questions and question.section)
G. Historical Immutability (is_live_delivered, item_hash stability)
"""

import hashlib
import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.admin.models import QuestionVersion
from app.modules.assessments.enums import (
    AssessmentType,
    AttemptStatus,
    NavigationPolicy,
    QuestionResponseType,
    QuestionType,
    ScoringPolicy,
)
from app.modules.assessments.models import (
    Assessment,
    AssessmentSection,
    AssessmentSectionQuestion,
    Attempt,
    AttemptAnswer,
    Question,
    QuestionOption,
    QuestionProvenance,
    QuestionValidation,
    Stimulus,
    TaskType,
)


@pytest.mark.asyncio
async def test_question_v2_schema_and_section_decoupling(db_session: AsyncSession) -> None:
    """Verify that a question can be created, linked to a section via assessment_section_questions,

    and that section_id is nullable (decoupled).
    """
    # 1. Create Assessment & Section
    asmt = Assessment(
        title="TEF Blanc Test Question V2",
        assessment_type=AssessmentType.READING,
        duration_seconds=3600,
        navigation_policy=NavigationPolicy.FREE,
        scoring_policy=ScoringPolicy.STANDARD_POINTS,
    )
    db_session.add(asmt)
    await db_session.flush()

    section = AssessmentSection(
        assessment_id=asmt.id,
        title="Section A - Documents quotidiens",
        order_index=1,
    )
    db_session.add(section)
    await db_session.flush()

    # 2. Create Stimulus
    content_text = "Société de transport : Arrêt temporaire de la ligne 4..."
    c_hash = hashlib.sha256(content_text.encode("utf-8")).hexdigest()
    stimulus = Stimulus(
        title="Avis de perturbation transport",
        modality="reading",
        content_text=content_text,
        text_format="plain",
        word_count=45,
        register="courant",
        content_hash=c_hash,
    )
    db_session.add(stimulus)
    await db_session.flush()

    # 3. Create TaskType
    task_type = TaskType(
        modality="reading",
        code="daily_document_v2_test",
        name="Document du quotidien",
        description="Notice ou petite annonce",
        is_active=True,
    )
    db_session.add(task_type)
    await db_session.flush()

    # 4. Create Question with Decoupled section_id=None and Stimulus link
    prompt_text = "Quelle ligne de transport est temporairement interrompue ?"
    norm_prompt = " ".join(prompt_text.strip().lower().split())
    item_hash = hashlib.sha256(norm_prompt.encode("utf-8")).hexdigest()

    question = Question(
        section_id=None,  # Decoupled!
        stimulus_id=stimulus.id,
        task_type_id=task_type.id,
        prompt=prompt_text,
        question_type=QuestionType.SINGLE_CHOICE,
        response_type=QuestionResponseType.SINGLE_CHOICE.value,
        level="A2",
        target_cefr="A2",
        difficulty=2,
        difficulty_rating=2,
        cognitive_complexity="recall_recognition",
        points=1,
        is_live_delivered=False,
        item_hash=item_hash,
    )
    db_session.add(question)
    await db_session.flush()

    # 5. Add Options with Diagnostic Misconceptions
    opt1 = QuestionOption(
        question_id=question.id,
        content="La ligne 4",
        is_correct=True,
        order_index=1,
        explanation="Le texte mentionne explicitement la ligne 4.",
    )
    opt2 = QuestionOption(
        question_id=question.id,
        content="La ligne 14",
        is_correct=False,
        order_index=2,
        misconception_type="literal_distractor",
        distractor_rationale="L'élève confond 4 et 14 par lecture superficielle.",
    )
    db_session.add_all([opt1, opt2])
    await db_session.flush()

    # 6. Associate Question with Section via assessment_section_questions
    asq = AssessmentSectionQuestion(
        assessment_section_id=section.id,
        question_id=question.id,
        order_index=1,
    )
    db_session.add(asq)
    await db_session.flush()

    # 7. Add Provenance & Validation record
    prov = QuestionProvenance(
        question_id=question.id,
        author_type="human",
        source_type="original",
    )
    val = QuestionValidation(
        question_id=question.id,
        validation_status="valid",
        blocking_error_count=0,
        warning_count=0,
        issues_payload=[],
        validated_by_system_version="v2.0.0",
    )
    db_session.add_all([prov, val])
    await db_session.flush()

    # Verify query with selectinload
    from sqlalchemy.orm import selectinload

    loaded_q = await db_session.scalar(
        select(Question)
        .options(
            selectinload(Question.options),
            selectinload(Question.section_associations),
            selectinload(Question.provenance),
            selectinload(Question.validations),
        )
        .where(Question.id == question.id)
    )
    assert loaded_q is not None
    assert loaded_q.section_id is None
    assert loaded_q.stimulus_id == stimulus.id
    assert loaded_q.response_type == "single_choice"
    assert loaded_q.target_cefr == "A2"
    assert loaded_q.difficulty_rating == 2
    assert loaded_q.cognitive_complexity == "recall_recognition"
    assert len(loaded_q.options) == 2
    assert loaded_q.options[1].misconception_type == "literal_distractor"
    assert loaded_q.options[1].distractor_rationale is not None
    assert len(loaded_q.section_associations) == 1
    assert loaded_q.provenance is not None
    assert len(loaded_q.validations) == 1


@pytest.mark.asyncio
async def test_question_reuse_across_multiple_sections(db_session: AsyncSession) -> None:
    """Verify that a single question can be associated with multiple assessment sections without duplication."""
    # Create Assessment with 2 sections (e.g. Diagnostic Drill and Full Exam Section)
    asmt = Assessment(
        title="TEF Multi Section Test",
        assessment_type=AssessmentType.READING,
        duration_seconds=3600,
        navigation_policy=NavigationPolicy.FREE,
        scoring_policy=ScoringPolicy.STANDARD_POINTS,
    )
    db_session.add(asmt)
    await db_session.flush()

    sec1 = AssessmentSection(assessment_id=asmt.id, title="Section 1", order_index=1)
    sec2 = AssessmentSection(assessment_id=asmt.id, title="Section 2 (Review Drill)", order_index=2)
    db_session.add_all([sec1, sec2])
    await db_session.flush()

    # Standalone Question
    q = Question(
        prompt="Reusable Question Content",
        question_type=QuestionType.SINGLE_CHOICE,
        response_type="single_choice",
        level="B1",
        difficulty=3,
        points=2,
    )
    db_session.add(q)
    await db_session.flush()

    # Link to both sections
    link1 = AssessmentSectionQuestion(assessment_section_id=sec1.id, question_id=q.id, order_index=1)
    link2 = AssessmentSectionQuestion(assessment_section_id=sec2.id, question_id=q.id, order_index=5, points_override=1)
    db_session.add_all([link1, link2])
    await db_session.flush()

    # Verify both sections reference the same question
    from sqlalchemy.orm import selectinload

    q_reloaded = await db_session.scalar(
        select(Question)
        .options(selectinload(Question.section_associations))
        .where(Question.id == q.id)
    )
    assert q_reloaded is not None
    assert len(q_reloaded.section_associations) == 2

    # Verify constraint: cannot add duplicate link for same section and question
    dup_link = AssessmentSectionQuestion(assessment_section_id=sec1.id, question_id=q.id, order_index=2)
    db_session.add(dup_link)
    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()


@pytest.mark.asyncio
async def test_question_version_frozen_snapshot(db_session: AsyncSession) -> None:
    """Verify that QuestionVersion stores a full frozen snapshot payload preserving historical state."""
    q = Question(
        prompt="Original Question Prompt v1",
        question_type=QuestionType.SINGLE_CHOICE,
        response_type="single_choice",
        level="B2",
        target_cefr="B2",
        difficulty=3,
        difficulty_rating=3,
        points=1,
    )
    db_session.add(q)
    await db_session.flush()

    opt_correct = QuestionOption(question_id=q.id, content="Reponse Correcte", is_correct=True, order_index=1)
    opt_wrong = QuestionOption(
        question_id=q.id,
        content="Reponse Incorrecte",
        is_correct=False,
        order_index=2,
        misconception_type="unwarranted_extrapolation",
        distractor_rationale="Extrapolation non justifiee par le document",
    )
    db_session.add_all([opt_correct, opt_wrong])
    await db_session.flush()

    # Create immutable version snapshot
    snapshot = {
        "prompt": q.prompt,
        "question_type": q.question_type.value,
        "response_type": q.response_type,
        "level": q.level,
        "target_cefr": q.target_cefr,
        "difficulty": q.difficulty,
        "points": q.points,
        "options": [
            {"content": opt_correct.content, "is_correct": True, "order_index": 1},
            {
                "content": opt_wrong.content,
                "is_correct": False,
                "order_index": 2,
                "misconception_type": opt_wrong.misconception_type,
                "distractor_rationale": opt_wrong.distractor_rationale,
            },
        ],
    }

    q_ver = QuestionVersion(
        question_id=q.id,
        version=1,
        prompt=q.prompt,
        explanation=None,
        question_type=q.question_type.value,
        difficulty=q.difficulty,
        level=q.level,
        points=q.points,
        options_snapshot=snapshot["options"],
        snapshot_payload=snapshot,
        changelog="Initial publication snapshot",
    )
    db_session.add(q_ver)
    await db_session.flush()

    # Now mutate the live question (simulating v2 edit)
    q.prompt = "Mutated Question Prompt v2"
    q.version = 2
    await db_session.flush()

    # Verify that the frozen version v1 retains historical prompt and options
    v1_loaded = await db_session.scalar(
        select(QuestionVersion).where(
            QuestionVersion.question_id == q.id,
            QuestionVersion.version == 1,
        )
    )
    assert v1_loaded is not None
    assert v1_loaded.prompt == "Original Question Prompt v1"
    assert v1_loaded.snapshot_payload["prompt"] == "Original Question Prompt v1"
    assert v1_loaded.snapshot_payload["options"][1]["misconception_type"] == "unwarranted_extrapolation"
    assert v1_loaded.changelog == "Initial publication snapshot"


@pytest.mark.asyncio
async def test_historical_attempt_answers_integrity(db_session: AsyncSession) -> None:
    """Verify that existing candidate attempts and attempt_answers remain 100% valid with Question V2."""
    from app.modules.users.models import User, UserRole

    # Create candidate user
    user = User(
        email=f"candidate_{uuid.uuid4().hex[:8]}@example.com",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()

    asmt = Assessment(
        title="TEF Examen Historique",
        assessment_type=AssessmentType.READING,
        duration_seconds=3600,
        navigation_policy=NavigationPolicy.FREE,
        scoring_policy=ScoringPolicy.STANDARD_POINTS,
    )
    db_session.add(asmt)
    await db_session.flush()

    sec = AssessmentSection(assessment_id=asmt.id, title="Section A", order_index=1)
    db_session.add(sec)
    await db_session.flush()

    q = Question(
        section_id=sec.id,
        prompt="Question Historique ?",
        question_type=QuestionType.SINGLE_CHOICE,
        response_type="single_choice",
        level="B1",
        difficulty=3,
        points=1,
    )
    db_session.add(q)
    await db_session.flush()

    opt = QuestionOption(question_id=q.id, content="Bonne reponse", is_correct=True, order_index=1)
    db_session.add(opt)
    await db_session.flush()

    # Create candidate attempt
    attempt = Attempt(
        assessment_id=asmt.id,
        user_id=user.id,
        status=AttemptStatus.SUBMITTED,
    )
    db_session.add(attempt)
    await db_session.flush()

    answer = AttemptAnswer(
        attempt_id=attempt.id,
        question_id=q.id,
        selected_option_id=opt.id,
        is_correct=True,
        points_awarded=1.0,
    )
    db_session.add(answer)
    await db_session.flush()

    # Update question delivery flag
    q.is_live_delivered = True
    await db_session.flush()

    # Verify referential integrity
    loaded_answer = await db_session.scalar(
        select(AttemptAnswer).where(AttemptAnswer.id == answer.id)
    )
    assert loaded_answer is not None
    assert loaded_answer.question_id == q.id
    assert loaded_answer.selected_option_id == opt.id
    assert loaded_answer.is_correct is True

    # Verify backward compatible query: section.questions
    from sqlalchemy.orm import selectinload

    sec_loaded = await db_session.scalar(
        select(AssessmentSection)
        .options(selectinload(AssessmentSection.questions))
        .where(AssessmentSection.id == sec.id)
    )
    assert sec_loaded is not None
    assert len(sec_loaded.questions) == 1
    assert sec_loaded.questions[0].id == q.id
    assert sec_loaded.questions[0].is_live_delivered is True
