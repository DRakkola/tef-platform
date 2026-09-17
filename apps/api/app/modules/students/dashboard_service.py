"""Service aggregating student dashboard metrics, learning loop progress, and timeline analytics."""

import datetime
import uuid

from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.assessments.enums import AttemptStatus
from app.modules.assessments.models import Attempt
from app.modules.learning.enums import RecommendationStatus
from app.modules.learning.models import Exercise, Recommendation, SkillAssessment, StudentSkill
from app.modules.practice_pool.enums import PracticeSessionStatus
from app.modules.practice_pool.models import PracticeSession
from app.modules.speaking.enums import SpeakingSessionState
from app.modules.speaking.models import SpeakingEvaluation, SpeakingSession
from app.modules.students.dashboard_schemas import (
    ProgressDataPoint,
    RecentAssessmentSummary,
    RecentSpeakingSummary,
    RecentWritingSummary,
    RecommendedExerciseSummary,
    SkillSummaryMetric,
    StudentDashboardResponse,
    StudentProgressResponse,
    UpcomingBookingSummary,
    WeakestSkillSummary,
)
from app.modules.teachers.models import TeacherBooking
from app.modules.users.models import StudentProfile, User
from app.modules.writing.enums import WritingSubmissionStatus
from app.modules.writing.models import WritingCorrection, WritingSubmission


def _determine_confidence_label(confidence: float, attempts_count: int) -> tuple[str, bool]:
    """Determine confidence label and whether there is insufficient data.

    Avoids misleading percentages when attempts < 2 or confidence < 0.25.
    """
    if attempts_count < 2 or confidence < 0.25:
        return "Calibration", True
    if confidence >= 0.75:
        return "High", False
    if confidence >= 0.50:
        return "Medium", False
    return "Low", False


class StudentDashboardService:
    """Core domain aggregation service for student dashboard and progress."""

    @staticmethod
    async def get_dashboard(
        db: AsyncSession,
        user: User,
    ) -> StudentDashboardResponse:
        """Aggregate complete student dashboard payload optimized for single-call loading."""
        now_utc = datetime.datetime.now(datetime.UTC)

        # 1. Student Profile
        profile_stmt = select(StudentProfile).where(StudentProfile.user_id == user.id)
        profile = (await db.execute(profile_stmt)).scalar_one_or_none()
        target_exam = profile.target_exam if profile else "TEF Canada"
        target_level = profile.target_level if profile else "B2"
        native_lang = profile.native_language if profile else None

        # 2. Student Skills & Change
        skills_stmt = (
            select(StudentSkill)
            .where(StudentSkill.user_id == user.id)
            .options(selectinload(StudentSkill.skill))
            .order_by(StudentSkill.mastery_score.asc())
        )
        student_skills = (await db.execute(skills_stmt)).scalars().all()

        skill_metrics: list[SkillSummaryMetric] = []
        scores_for_readiness: list[float] = []

        for ss in student_skills:
            conf_label, is_insufficient = _determine_confidence_label(
                ss.confidence, ss.attempts_count
            )

            # Query previous assessment score from SkillAssessment audit log
            prev_stmt = (
                select(SkillAssessment)
                .where(
                    SkillAssessment.user_id == user.id,
                    SkillAssessment.skill_id == ss.skill_id,
                )
                .order_by(desc(SkillAssessment.assessed_at))
                .offset(1)
                .limit(1)
            )
            prev_assessment = (await db.execute(prev_stmt)).scalar_one_or_none()
            previous_score = round(prev_assessment.score, 1) if prev_assessment else None
            change = (
                round(ss.mastery_score - previous_score, 1) if previous_score is not None else None
            )

            skill_name = ss.skill.name if ss.skill else "Compétence"
            category = ss.skill.category.value if ss.skill and ss.skill.category else "general"

            if not is_insufficient:
                scores_for_readiness.append(ss.mastery_score)

            skill_metrics.append(
                SkillSummaryMetric(
                    skill_id=ss.skill_id,
                    skill_name=skill_name,
                    category=category,
                    current_score=round(ss.mastery_score, 1),
                    previous_score=previous_score,
                    change=change,
                    confidence=round(ss.confidence, 2),
                    confidence_label=conf_label,
                    insufficient_data=is_insufficient,
                    attempts_count=ss.attempts_count,
                    last_assessed_at=ss.last_assessed_at,
                )
            )

        overall_readiness = (
            round(sum(scores_for_readiness) / len(scores_for_readiness), 1)
            if scores_for_readiness
            else (
                round(sum(ss.mastery_score for ss in student_skills) / len(student_skills), 1)
                if student_skills
                else None
            )
        )

        # 3. Weakest Skills
        weakest_skills: list[WeakestSkillSummary] = []
        for ss in student_skills:
            if ss.mastery_score < 75.0 or ss.attempts_count >= 1:
                skill_name = ss.skill.name if ss.skill else "Compétence"
                category = ss.skill.category.value if ss.skill and ss.skill.category else "general"
                weakest_skills.append(
                    WeakestSkillSummary(
                        skill_id=ss.skill_id,
                        skill_name=skill_name,
                        category=category,
                        mastery_score=round(ss.mastery_score, 1),
                        reason=f"Score sous le seuil B2 ({round(ss.mastery_score, 1)}%)",
                        recommended_exercise_id=None,
                    )
                )
            if len(weakest_skills) >= 3:
                break

        # 4. Recommended Exercises from Learning Intelligence
        recs_stmt = (
            select(Recommendation)
            .where(
                Recommendation.user_id == user.id,
                Recommendation.status == RecommendationStatus.ACTIVE,
            )
            .options(
                selectinload(Recommendation.skill),
            )
            .order_by(Recommendation.priority.desc(), desc(Recommendation.generated_at))
            .limit(4)
        )
        recommendations = (await db.execute(recs_stmt)).scalars().all()
        recommended_exercises: list[RecommendedExerciseSummary] = []
        for r in recommendations:
            ex = await db.get(Exercise, r.entity_id) if r.entity_type == "exercise" else None
            ex_title = ex.title if ex else "Exercice de perfectionnement"
            ex_level = ex.level if ex else "B2"
            ex_diff = ex.difficulty if ex else 3
            skill_name = r.skill.name if r.skill else "Compétence cible"
            cat = r.skill.category.value if r.skill and r.skill.category else "general"
            priority_label = (
                "critical" if r.priority >= 80 else "high" if r.priority >= 60 else "medium"
            )

            recommended_exercises.append(
                RecommendedExerciseSummary(
                    id=r.id,
                    title=ex_title,
                    category=cat,
                    difficulty=ex_diff,
                    level=ex_level,
                    target_skill_name=skill_name,
                    reason=r.reason,
                    priority=priority_label,
                )
            )

        # 5. Recent Completed Assessments (Reading & Listening)
        attempts_stmt = (
            select(Attempt)
            .where(
                Attempt.user_id == user.id,
                Attempt.status == AttemptStatus.SUBMITTED,
            )
            .options(
                selectinload(Attempt.assessment),
                selectinload(Attempt.score),
            )
            .order_by(desc(Attempt.submitted_at))
            .limit(5)
        )
        recent_attempts = (await db.execute(attempts_stmt)).scalars().all()
        recent_assessments: list[RecentAssessmentSummary] = []
        for a in recent_attempts:
            if a.score and a.submitted_at:
                title = a.assessment.title if a.assessment else "Épreuve TEF"
                a_type = a.assessment.assessment_type.value if a.assessment else "mixed"
                recent_assessments.append(
                    RecentAssessmentSummary(
                        id=a.id,
                        title=title,
                        assessment_type=a_type,
                        score_percentage=round(a.score.percentage, 1),
                        passed=bool(a.score.is_passed),
                        estimated_level=a.score.estimated_level,
                        submitted_at=a.submitted_at,
                    )
                )

        # 6. Recent Writing Submissions & Corrections
        writing_stmt = (
            select(WritingSubmission)
            .where(
                WritingSubmission.user_id == user.id,
                WritingSubmission.status.in_(
                    [
                        WritingSubmissionStatus.SUBMITTED,
                        WritingSubmissionStatus.CORRECTED,
                        WritingSubmissionStatus.QUEUED,
                        WritingSubmissionStatus.PROCESSING,
                    ]
                ),
            )
            .options(
                selectinload(WritingSubmission.task),
                selectinload(WritingSubmission.correction),
            )
            .order_by(desc(WritingSubmission.submitted_at))
            .limit(3)
        )
        recent_writings = (await db.execute(writing_stmt)).scalars().all()
        recent_writing_summaries: list[RecentWritingSummary] = []
        for w in recent_writings:
            task_title = w.task.title if w.task else "Expression Écrite"
            score = round(w.correction.score, 1) if w.correction else None
            level = w.correction.estimated_level if w.correction else None
            c_at = w.correction.created_at if w.correction else None
            sub_at = w.submitted_at

            recent_writing_summaries.append(
                RecentWritingSummary(
                    id=w.id,
                    task_title=task_title,
                    overall_score=score,
                    estimated_level=level,
                    submitted_at=sub_at,
                    status=w.status.value,
                    corrected_at=c_at,
                )
            )

        # 7. Upcoming Teacher Bookings
        booking_stmt = (
            select(TeacherBooking)
            .where(
                TeacherBooking.student_id == user.id,
                TeacherBooking.start_time >= now_utc,
                TeacherBooking.status.in_(["confirmed", "requested"]),
            )
            .options(selectinload(TeacherBooking.teacher))
            .order_by(TeacherBooking.start_time.asc())
            .limit(3)
        )
        bookings = (await db.execute(booking_stmt)).scalars().all()
        upcoming_bookings: list[UpcomingBookingSummary] = []
        for b in bookings:
            t_name = b.teacher.display_name if b.teacher else "Enseignant certifié"
            upcoming_bookings.append(
                UpcomingBookingSummary(
                    id=b.id,
                    teacher_name=t_name,
                    start_time=b.start_time,
                    end_time=b.end_time,
                    status=b.status,
                    meeting_link=b.meeting_link,
                )
            )

        # 8. Recent Speaking Sessions (AI, Teacher, Peer Practice)
        speaking_stmt = (
            select(SpeakingSession)
            .where(
                or_(
                    SpeakingSession.created_by_user_id == user.id,
                    SpeakingSession.participants.any(user_id=user.id),
                )
            )
            .options(selectinload(SpeakingSession.evaluation))
            .order_by(desc(SpeakingSession.created_at))
            .limit(3)
        )
        speaking_sessions = (await db.execute(speaking_stmt)).scalars().unique().all()
        recent_speaking_summaries: list[RecentSpeakingSummary] = []

        total_practice_mins = 0

        for sp in speaking_sessions:
            score = round(sp.evaluation.overall_score, 1) if sp.evaluation else None
            level = sp.evaluation.estimated_level if sp.evaluation else None
            if sp.status == SpeakingSessionState.COMPLETED:
                total_practice_mins += sp.duration_minutes

            recent_speaking_summaries.append(
                RecentSpeakingSummary(
                    id=sp.id,
                    session_type=sp.session_type.value,
                    topic=sp.topic,
                    status=sp.status.value,
                    duration_minutes=sp.duration_minutes,
                    starts_at=sp.starts_at or sp.created_at,
                    overall_score=score,
                    estimated_level=level,
                )
            )

        # Peer practice sessions
        practice_stmt = (
            select(PracticeSession)
            .where(
                or_(
                    PracticeSession.student_a_id == user.id,
                    PracticeSession.student_b_id == user.id,
                )
            )
            .order_by(desc(PracticeSession.starts_at))
            .limit(3)
        )
        practice_sessions = (await db.execute(practice_stmt)).scalars().all()
        for ps in practice_sessions:
            if ps.status == PracticeSessionStatus.COMPLETED:
                total_practice_mins += ps.duration_minutes

            recent_speaking_summaries.append(
                RecentSpeakingSummary(
                    id=ps.id,
                    session_type="peer_practice",
                    topic=f"Échange 1-à-1 ({ps.practice_type.value})",
                    status=ps.status.value,
                    duration_minutes=ps.duration_minutes,
                    starts_at=ps.starts_at,
                    overall_score=None,
                    estimated_level=ps.level,
                )
            )

        # 9. Historical Progress Timeline
        history_points = await StudentDashboardService._get_historical_timeline(db, user.id)

        # Total assessments taken
        count_stmt = select(func.count(Attempt.id)).where(
            Attempt.user_id == user.id, Attempt.status == AttemptStatus.SUBMITTED
        )
        total_assessments = (await db.execute(count_stmt)).scalar() or len(recent_assessments)

        return StudentDashboardResponse(
            target_exam=target_exam,
            target_level=target_level,
            native_language=native_lang,
            overall_readiness=overall_readiness,
            total_assessments_taken=total_assessments,
            total_practice_minutes=total_practice_mins,
            skills=skill_metrics,
            progress_history=history_points,
            weakest_skills=weakest_skills,
            recommended_exercises=recommended_exercises,
            recent_assessments=recent_assessments,
            recent_writing_corrections=recent_writing_summaries,
            upcoming_bookings=upcoming_bookings,
            recent_speaking_sessions=recent_speaking_summaries,
        )

    @staticmethod
    async def get_progress(
        db: AsyncSession,
        user: User,
    ) -> StudentProgressResponse:
        """Retrieve historical measurement timeline and skill trajectories."""
        timeline = await StudentDashboardService._get_historical_timeline(db, user.id)
        dashboard = await StudentDashboardService.get_dashboard(db, user)
        return StudentProgressResponse(timeline=timeline, skills=dashboard.skills)

    @staticmethod
    async def _get_historical_timeline(
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> list[ProgressDataPoint]:
        """Aggregate immutable historical measurement events over time (never overwriting)."""
        timeline: list[ProgressDataPoint] = []

        # 1. Assessment attempts with scores
        attempts_stmt = (
            select(Attempt)
            .where(
                Attempt.user_id == user_id,
                Attempt.status == AttemptStatus.SUBMITTED,
            )
            .options(
                selectinload(Attempt.score),
                selectinload(Attempt.assessment),
            )
            .order_by(Attempt.submitted_at.asc())
            .limit(20)
        )
        attempts = (await db.execute(attempts_stmt)).scalars().all()
        for a in attempts:
            if a.score and a.submitted_at:
                title = a.assessment.title if a.assessment else "Épreuve standard"
                timeline.append(
                    ProgressDataPoint(
                        timestamp=a.submitted_at,
                        overall_score=round(a.score.percentage, 1),
                        assessment_title=title,
                        source_type="assessment",
                        category=a.assessment.assessment_type.value if a.assessment else None,
                    )
                )

        # 2. Writing corrections
        writing_stmt = (
            select(WritingCorrection)
            .join(WritingSubmission, WritingCorrection.submission_id == WritingSubmission.id)
            .where(WritingSubmission.user_id == user_id)
            .options(
                selectinload(WritingCorrection.submission).selectinload(WritingSubmission.task)
            )
            .order_by(WritingCorrection.created_at.asc())
            .limit(10)
        )
        corrections = (await db.execute(writing_stmt)).scalars().all()
        for c in corrections:
            task_title = (
                c.submission.task.title
                if c.submission and c.submission.task
                else "Expression Écrite"
            )
            timeline.append(
                ProgressDataPoint(
                    timestamp=c.created_at,
                    overall_score=round(c.score, 1),
                    assessment_title=task_title,
                    source_type="writing",
                    category="writing",
                )
            )

        # 3. Speaking evaluations
        speaking_stmt = (
            select(SpeakingEvaluation)
            .where(SpeakingEvaluation.student_id == user_id)
            .options(selectinload(SpeakingEvaluation.session))
            .order_by(SpeakingEvaluation.created_at.asc())
            .limit(10)
        )
        evaluations = (await db.execute(speaking_stmt)).scalars().all()
        for ev in evaluations:
            topic = ev.session.topic if ev.session else "Expression Orale"
            timeline.append(
                ProgressDataPoint(
                    timestamp=ev.created_at,
                    overall_score=round(ev.overall_score, 1),
                    assessment_title=topic,
                    source_type="speaking",
                    category="speaking",
                )
            )

        # Sort timeline chronologically
        timeline.sort(key=lambda x: x.timestamp)
        return timeline
