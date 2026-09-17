"""Comprehensive tests for student dashboard and learning loop progress analytics."""

import datetime
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.modules.assessments.enums import AssessmentType, AttemptStatus
from app.modules.assessments.models import Assessment, Attempt, AttemptScore, Skill, SkillCategory
from app.modules.learning.enums import RecommendationStatus, RecommendationType
from app.modules.learning.models import Exercise, Recommendation, SkillAssessment, StudentSkill
from app.modules.speaking.enums import (
    SpeakingEvaluatorType,
    SpeakingSessionState,
    SpeakingSessionType,
)
from app.modules.speaking.models import SpeakingEvaluation, SpeakingSession
from app.modules.teachers.models import TeacherBooking
from app.modules.users.models import (
    StudentProfile,
    TeacherProfile,
    TeacherVerificationStatus,
    User,
    UserRole,
)
from app.modules.writing.enums import (
    CorrectionProviderType,
    WritingAttemptStatus,
    WritingSubmissionStatus,
    WritingTaskType,
)
from app.modules.writing.models import (
    WritingAttempt,
    WritingCorrection,
    WritingSubmission,
    WritingTask,
)


@pytest.fixture
async def populated_student(db_session: AsyncSession) -> tuple[User, dict[str, uuid.UUID]]:
    """Create a student with rich learning history across all modalities."""
    student = User(
        id=uuid.uuid4(),
        email=f"dashboard_student_{uuid.uuid4().hex[:6]}@example.com",
        password_hash=hash_password("ValidPassword123!"),
        role=UserRole.STUDENT,
        is_active=True,
        is_verified=True,
    )
    db_session.add(student)
    await db_session.flush()

    profile = StudentProfile(
        id=uuid.uuid4(),
        user_id=student.id,
        target_exam="TEF Canada",
        target_level="B2",
        timezone="America/Toronto",
        native_language="English",
    )
    db_session.add(profile)

    # 1. Skills
    skill_grammar = Skill(
        id=uuid.uuid4(),
        name="Subjonctif et connecteurs",
        code=f"GRAM_SUBJ_{uuid.uuid4().hex[:4]}",
        category=SkillCategory.GRAMMAR,
    )
    skill_listening = Skill(
        id=uuid.uuid4(),
        name="Compréhension orale détaillée",
        code=f"LIST_DET_{uuid.uuid4().hex[:4]}",
        category=SkillCategory.LISTENING,
    )
    db_session.add_all([skill_grammar, skill_listening])
    await db_session.flush()

    # 2. StudentSkills
    ss_grammar = StudentSkill(
        id=uuid.uuid4(),
        user_id=student.id,
        skill_id=skill_grammar.id,
        mastery_score=62.5,
        confidence=0.80,
        attempts_count=5,
    )
    # Calibrating skill (insufficient attempts)
    ss_listening = StudentSkill(
        id=uuid.uuid4(),
        user_id=student.id,
        skill_id=skill_listening.id,
        mastery_score=80.0,
        confidence=0.15,
        attempts_count=1,
    )
    db_session.add_all([ss_grammar, ss_listening])

    # 3. Previous SkillAssessment logs for ss_grammar (to calculate delta change)
    now = datetime.datetime.now(datetime.UTC)
    t_minus_2 = now - datetime.timedelta(days=7)
    t_minus_1 = now - datetime.timedelta(days=2)

    sa1 = SkillAssessment(
        id=uuid.uuid4(),
        user_id=student.id,
        skill_id=skill_grammar.id,
        source_type="assessment",
        source_id=uuid.uuid4(),
        score=55.0,
        points_earned=11.0,
        points_possible=20.0,
        assessed_at=t_minus_2,
    )
    sa2 = SkillAssessment(
        id=uuid.uuid4(),
        user_id=student.id,
        skill_id=skill_grammar.id,
        source_type="assessment",
        source_id=uuid.uuid4(),
        score=62.5,
        points_earned=12.5,
        points_possible=20.0,
        assessed_at=t_minus_1,
    )
    db_session.add_all([sa1, sa2])

    # 4. Assessment Attempt
    assessment = Assessment(
        id=uuid.uuid4(),
        title="TEF Compréhension Écrite — Test Blanc 1",
        assessment_type=AssessmentType.READING,
        duration_seconds=3600,
        is_published=True,
    )
    db_session.add(assessment)
    await db_session.flush()

    attempt = Attempt(
        id=uuid.uuid4(),
        assessment_id=assessment.id,
        user_id=student.id,
        status=AttemptStatus.SUBMITTED,
        started_at=t_minus_1,
        expires_at=t_minus_1 + datetime.timedelta(hours=1),
        submitted_at=t_minus_1 + datetime.timedelta(minutes=45),
    )
    db_session.add(attempt)
    await db_session.flush()

    score = AttemptScore(
        id=uuid.uuid4(),
        attempt_id=attempt.id,
        total_points=42.0,
        max_points=50.0,
        percentage=84.0,
        is_passed=True,
        estimated_level="B2",
    )
    db_session.add(score)

    # 5. Recommendation & Exercise
    exercise = Exercise(
        id=uuid.uuid4(),
        title="Exercice ciblé — Le subjonctif après les locutions de concession",
        instructions="Complétez les phrases avec la forme correcte du subjonctif.",
        category=SkillCategory.GRAMMAR,
        prompt="Complétez avec le mode convenable.",
        difficulty=3,
        level="B2",
        is_published=True,
    )
    db_session.add(exercise)
    await db_session.flush()

    rec = Recommendation(
        id=uuid.uuid4(),
        user_id=student.id,
        skill_id=skill_grammar.id,
        entity_type="exercise",
        entity_id=exercise.id,
        recommendation_type=RecommendationType.EXERCISE,
        priority=75,
        status=RecommendationStatus.ACTIVE,
        reason="Difficultés récurrentes identifiées sur les subordonnées concessives.",
    )
    db_session.add(rec)

    # 6. Writing Attempt & Correction
    writing_task = WritingTask(
        id=uuid.uuid4(),
        task_type=WritingTaskType.SECTION_B,
        title="TEF Section B — Lettre au rédacteur en chef",
        prompt="Donnez votre avis sur le travail à distance...",
        min_words=200,
        max_words=250,
        duration_minutes=35,
        is_published=True,
    )
    db_session.add(writing_task)
    await db_session.flush()

    writing_attempt = WritingAttempt(
        id=uuid.uuid4(),
        task_id=writing_task.id,
        user_id=student.id,
        status=WritingAttemptStatus.SUBMITTED,
        content="Monsieur le rédacteur, je vous écris...",
        word_count=215,
        started_at=t_minus_2,
        expires_at=t_minus_2 + datetime.timedelta(minutes=35),
        submitted_at=t_minus_2 + datetime.timedelta(minutes=30),
    )
    db_session.add(writing_attempt)
    await db_session.flush()

    writing_submission = WritingSubmission(
        id=uuid.uuid4(),
        attempt_id=writing_attempt.id,
        task_id=writing_task.id,
        user_id=student.id,
        status=WritingSubmissionStatus.CORRECTED,
        word_count=215,
        storage_object_key=f"submissions/{writing_attempt.id}.txt",
        submitted_at=t_minus_2 + datetime.timedelta(minutes=30),
    )
    db_session.add(writing_submission)
    await db_session.flush()

    correction = WritingCorrection(
        id=uuid.uuid4(),
        submission_id=writing_submission.id,
        provider=CorrectionProviderType.AI,
        score=78.5,
        estimated_level="B2",
        strengths=["Organisation logique des paragraphes"],
        weaknesses=["Quelques répétitions lexicales"],
        comments="Très bonne maîtrise de l'argumentation.",
    )
    db_session.add(correction)

    # 7. Upcoming Teacher Booking
    teacher_user = User(
        id=uuid.uuid4(),
        email=f"teacher_dash_{uuid.uuid4().hex[:6]}@example.com",
        password_hash=hash_password("TeacherValidPass123!"),
        role=UserRole.TEACHER,
        is_active=True,
        is_verified=True,
    )
    db_session.add(teacher_user)
    await db_session.flush()

    teacher_profile = TeacherProfile(
        id=uuid.uuid4(),
        user_id=teacher_user.id,
        display_name="Professeur Henri",
        verification_status=TeacherVerificationStatus.APPROVED,
        hourly_price=4000,
        timezone="Europe/Paris",
    )
    db_session.add(teacher_profile)
    await db_session.flush()

    booking = TeacherBooking(
        id=uuid.uuid4(),
        teacher_id=teacher_profile.id,
        student_id=student.id,
        start_time=now + datetime.timedelta(days=1),
        end_time=now + datetime.timedelta(days=1, minutes=30),
        status="confirmed",
        meeting_link="https://meet.tefplatform.local/ Henri-session",
    )
    db_session.add(booking)

    # 8. Speaking Session
    spk_session = SpeakingSession(
        id=uuid.uuid4(),
        session_type=SpeakingSessionType.AI,
        status=SpeakingSessionState.COMPLETED,
        topic="TEF Section A — Demande de renseignements",
        level="B2",
        duration_minutes=25,
        room_id=f"room_dash_{uuid.uuid4().hex[:8]}",
        created_by_user_id=student.id,
        starts_at=t_minus_1,
        expires_at=t_minus_1 + datetime.timedelta(minutes=25),
        ended_at=t_minus_1 + datetime.timedelta(minutes=25),
    )
    db_session.add(spk_session)
    await db_session.flush()

    spk_eval = SpeakingEvaluation(
        id=uuid.uuid4(),
        session_id=spk_session.id,
        student_id=student.id,
        evaluator_type=SpeakingEvaluatorType.MOCK,
        estimated_level="B2",
        fluency=75.0,
        vocabulary=78.0,
        grammar=70.0,
        coherence=76.0,
        pronunciation=74.0,
        overall_score=74.6,
        strengths=["Clarté"],
        weaknesses=["Hésitations"],
        recommendations=["Pratiquer"],
        is_official_tef=False,
    )
    db_session.add(spk_eval)

    await db_session.flush()
    await db_session.refresh(student)

    ids = {
        "student_id": student.id,
        "skill_grammar_id": skill_grammar.id,
        "skill_listening_id": skill_listening.id,
    }
    return student, ids


# --- 1. Empty State Tests ---


@pytest.mark.asyncio
async def test_dashboard_empty_state_for_new_student(
    client: AsyncClient,
    test_student: User,
    student_auth_headers: dict[str, str],
) -> None:
    """New student with no history receives clean empty state response with profile defaults."""
    res = await client.get("/api/v1/students/me/dashboard", headers=student_auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["target_exam"] == "TEF Canada"
    assert data["target_level"] == "B2"
    assert data["overall_readiness"] is None
    assert data["total_assessments_taken"] == 0
    assert data["skills"] == []
    assert data["progress_history"] == []
    assert data["weakest_skills"] == []
    assert data["recommended_exercises"] == []
    assert data["recent_assessments"] == []
    assert data["recent_writing_corrections"] == []
    assert data["upcoming_bookings"] == []
    assert data["recent_speaking_sessions"] == []


# --- 2. Populated Dashboard Tests ---


@pytest.mark.asyncio
async def test_dashboard_populated_metrics_and_learning_loop(
    client: AsyncClient,
    populated_student: tuple[User, dict[str, uuid.UUID]],
) -> None:
    """Populated student receives aggregated metrics across all learning loop modules."""
    student, ids = populated_student
    token = create_access_token(student.id, student.role.value)
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.get("/api/v1/students/me/dashboard", headers=headers)
    assert res.status_code == 200
    data = res.json()

    # Profile & overview
    assert data["target_exam"] == "TEF Canada"
    assert data["target_level"] == "B2"
    assert data["overall_readiness"] is not None
    assert data["total_assessments_taken"] >= 1
    assert data["total_practice_minutes"] >= 25

    # Skills check
    assert len(data["skills"]) == 2
    grammar_metric = next(
        s for s in data["skills"] if s["skill_id"] == str(ids["skill_grammar_id"])
    )
    assert grammar_metric["current_score"] == 62.5
    assert grammar_metric["previous_score"] == 55.0
    # Delta change = 62.5 - 55.0 = +7.5
    assert grammar_metric["change"] == 7.5
    assert grammar_metric["confidence_label"] == "High"
    assert grammar_metric["insufficient_data"] is False

    # Weakest skills
    assert len(data["weakest_skills"]) >= 1
    assert data["weakest_skills"][0]["skill_id"] == str(ids["skill_grammar_id"])

    # Recommendations
    assert len(data["recommended_exercises"]) >= 1
    rec = data["recommended_exercises"][0]
    assert "subjonctif" in rec["title"].lower()
    assert rec["priority"] == "high"

    # Recent assessments
    assert len(data["recent_assessments"]) >= 1
    assert data["recent_assessments"][0]["score_percentage"] == 84.0
    assert data["recent_assessments"][0]["passed"] is True

    # Recent writing
    assert len(data["recent_writing_corrections"]) >= 1
    assert data["recent_writing_corrections"][0]["overall_score"] == 78.5

    # Upcoming bookings
    assert len(data["upcoming_bookings"]) >= 1
    assert data["upcoming_bookings"][0]["teacher_name"] == "Professeur Henri"
    assert data["upcoming_bookings"][0]["status"] == "confirmed"

    # Recent speaking
    assert len(data["recent_speaking_sessions"]) >= 1
    assert data["recent_speaking_sessions"][0]["overall_score"] == 74.6


# --- 3. Insufficient Data & Misleading Percentages Prevention Tests ---


@pytest.mark.asyncio
async def test_insufficient_data_flag_avoids_misleading_metrics(
    client: AsyncClient,
    populated_student: tuple[User, dict[str, uuid.UUID]],
) -> None:
    """Skills with low attempts/confidence are marked insufficient_data=True with Calibration label."""
    student, ids = populated_student
    token = create_access_token(student.id, student.role.value)
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.get("/api/v1/students/me/dashboard", headers=headers)
    assert res.status_code == 200
    data = res.json()

    listening_metric = next(
        s for s in data["skills"] if s["skill_id"] == str(ids["skill_listening_id"])
    )
    # Attempts count = 1, confidence = 0.15
    assert listening_metric["insufficient_data"] is True
    assert listening_metric["confidence_label"] == "Calibration"


# --- 4. Historical Progress Timeline Tests ---


@pytest.mark.asyncio
async def test_historical_progress_timeline_never_overwrites(
    client: AsyncClient,
    populated_student: tuple[User, dict[str, uuid.UUID]],
) -> None:
    """Historical timeline reflects individual chronological events over time."""
    student, _ = populated_student
    token = create_access_token(student.id, student.role.value)
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.get("/api/v1/students/me/progress", headers=headers)
    assert res.status_code == 200
    data = res.json()

    timeline = data["timeline"]
    assert len(timeline) >= 2
    # Verify chronological ordering
    timestamps = [t["timestamp"] for t in timeline]
    assert timestamps == sorted(timestamps)
    # Different sources captured
    sources = {t["source_type"] for t in timeline}
    assert "assessment" in sources


# --- 5. Authorization Tests ---


@pytest.mark.asyncio
async def test_dashboard_unauthorized_access_rejected(client: AsyncClient) -> None:
    """Unauthenticated request to student dashboard is rejected with 401."""
    res = await client.get("/api/v1/students/me/dashboard")
    assert res.status_code == 401
