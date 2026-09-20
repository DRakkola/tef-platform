"""Service aggregating student dashboard metrics, learning loop progress, and timeline analytics."""

import datetime
import uuid

from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.assessments.enums import AttemptStatus
from app.modules.assessments.models import Attempt
from app.modules.learning.activity import ActivityTracker
from app.modules.learning.daily_plan import DailyPlanService
from app.modules.learning.enums import RecommendationStatus
from app.modules.learning.levels import LevelEstimationService
from app.modules.learning.models import Exercise, Recommendation
from app.modules.learning.strengths_weaknesses import StrengthsWeaknessesService
from app.modules.learning.targets import TargetGapService
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


class StudentDashboardService:
    """Core domain aggregation service for student dashboard and progress."""

    @staticmethod
    async def get_dashboard(
        db: AsyncSession,
        user: User,
    ) -> StudentDashboardResponse:
        """Aggregate complete student dashboard payload optimized for single-call loading."""
        now_utc = datetime.datetime.now(datetime.UTC)

        # 1. Target Gap and Readiness Analysis
        target_gap = await TargetGapService.get_target_gap(db, user.id)

        # 2. Student Skills and Trajectory Analysis
        analysis = await StrengthsWeaknessesService.analyze_skills(db, user.id)

        skill_metrics: list[SkillSummaryMetric] = [
            SkillSummaryMetric(
                skill_id=s["skill_id"],
                skill_name=s["skill_name"],
                category=s["category"],
                current_score=s["mastery_score"],
                previous_score=s["previous_score"],
                change=s["change"],
                confidence=s["confidence"],
                confidence_label=s["confidence_label"],
                insufficient_data=s["insufficient_data"],
                trend=s["trend"],
                estimated_level=LevelEstimationService.estimate_cefr(s["mastery_score"]),
                attempts_count=s["attempts_count"],
                last_assessed_at=s["last_assessed_at"],
            )
            for s in analysis["all_skills"]
        ]

        # 3. Weakest and Strongest Skills Summaries
        weakest_skills: list[WeakestSkillSummary] = [
            WeakestSkillSummary(
                skill_id=w["skill_id"],
                skill_name=w["skill_name"],
                category=w["category"],
                mastery_score=w["mastery_score"],
                reason=f"Maîtrise estimée à {w['mastery_score']:.0f}% (seuil cible {target_gap['target_cefr_level']} : {target_gap['target_threshold_score']:.0f}%)",
                recommended_exercise_id=None,
            )
            for w in analysis["weakest_skills"][:3]
        ]

        strongest_skills: list[WeakestSkillSummary] = [
            WeakestSkillSummary(
                skill_id=s["skill_id"],
                skill_name=s["skill_name"],
                category=s["category"],
                mastery_score=s["mastery_score"],
                reason=f"Compétence solide ({s['mastery_score']:.0f}%)",
                recommended_exercise_id=None,
            )
            for s in analysis["strongest_skills"][:3]
        ]

        # 4. Daily Practice Plan
        daily_plan = await DailyPlanService.get_daily_plan(db, user.id)

        # 5. Recommended Exercises from Learning Intelligence
        recs_stmt = (
            select(Recommendation)
            .where(
                Recommendation.user_id == user.id,
                Recommendation.status.in_(
                    [
                        RecommendationStatus.ACTIVE,
                        RecommendationStatus.STARTED,
                        RecommendationStatus.PENDING,
                    ]
                ),
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

        # 6. Recent Completed Assessments (Reading & Listening)
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

        # 7. Recent Writing Submissions & Corrections
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

        # 8. Upcoming Teacher Bookings
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

        # 9. Recent Speaking Sessions
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

        # 10. Historical Progress Timeline
        history_points = await StudentDashboardService._get_historical_timeline(db, user.id)

        # 11. Recent Activity Events
        activity_data = await ActivityTracker.get_student_activities(db, user.id, limit=5)

        # Total assessments taken
        count_stmt = select(func.count(Attempt.id)).where(
            Attempt.user_id == user.id, Attempt.status == AttemptStatus.SUBMITTED
        )
        total_assessments = (await db.execute(count_stmt)).scalar() or len(recent_assessments)

        profile = await db.scalar(select(StudentProfile).where(StudentProfile.user_id == user.id))
        native_lang = profile.native_language if profile else None
        has_skills = len(skill_metrics) > 0
        overall_readiness = target_gap["current_score"] if has_skills else None
        curr_cefr = target_gap["current_cefr_level"] if has_skills else None
        curr_nclc = target_gap["current_nclc_level"] if has_skills else None
        # 12. Deterministic Behavioral Segment & Engagement Health Status
        from app.modules.students.segmentation_service import StudentSegmentationService

        segment = await StudentSegmentationService.evaluate_student_segment(db, user.id)
        engagement_status = await StudentSegmentationService.compute_engagement_status(db, user.id)

        return StudentDashboardResponse(
            target_exam=target_gap["target_exam"],
            target_level=target_gap["target_cefr_level"],
            target_cefr_level=target_gap["target_cefr_level"],
            target_nclc_level=target_gap["target_nclc_level"],
            target_date=target_gap["target_date"],
            days_remaining=target_gap["days_remaining"],
            target_urgency=target_gap["urgency"],
            score_gap=target_gap["score_gap"],
            level_distance=target_gap["level_distance"],
            is_target_met=target_gap["is_target_met"],
            target_disclaimer=target_gap["disclaimer"],
            native_language=native_lang,
            overall_readiness=overall_readiness,
            current_cefr_level=curr_cefr,
            current_nclc_level=curr_nclc,
            total_assessments_taken=total_assessments,
            total_practice_minutes=total_practice_mins,
            skills=skill_metrics,
            progress_history=history_points,
            weakest_skills=weakest_skills if has_skills else [],
            strongest_skills=strongest_skills if has_skills else [],
            daily_plan=daily_plan,
            recommended_exercises=recommended_exercises,
            recent_assessments=recent_assessments,
            recent_writing_corrections=recent_writing_summaries,
            upcoming_bookings=upcoming_bookings,
            recent_speaking_sessions=recent_speaking_summaries,
            recent_activity=activity_data["items"],
            segment=segment,
            engagement_status=engagement_status,
        )

    @staticmethod
    async def get_progress(
        db: AsyncSession,
        user: User,
        time_range: str = "all",
    ) -> StudentProgressResponse:
        """Retrieve historical measurement timeline and skill trajectories filtered by time range."""
        timeline = await StudentDashboardService._get_historical_timeline(
            db, user.id, time_range=time_range
        )
        dashboard = await StudentDashboardService.get_dashboard(db, user)

        return StudentProgressResponse(
            timeline=timeline,
            skills=dashboard.skills,
            overall_score=dashboard.overall_readiness,
            estimated_cefr_level=dashboard.current_cefr_level,
            estimated_nclc_level=dashboard.current_nclc_level,
            disclaimer=LevelEstimationService.DISCLAIMER,
        )

    @staticmethod
    async def _get_historical_timeline(
        db: AsyncSession,
        user_id: uuid.UUID,
        time_range: str = "all",
    ) -> list[ProgressDataPoint]:
        """Aggregate immutable historical measurement events over time (never overwriting)."""
        cutoff: datetime.datetime | None = None
        now = datetime.datetime.now(datetime.UTC)
        if time_range == "7d":
            cutoff = now - datetime.timedelta(days=7)
        elif time_range == "30d":
            cutoff = now - datetime.timedelta(days=30)
        elif time_range == "90d":
            cutoff = now - datetime.timedelta(days=90)

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
        )
        if cutoff:
            attempts_stmt = attempts_stmt.where(Attempt.submitted_at >= cutoff)
        attempts_stmt = attempts_stmt.order_by(Attempt.submitted_at.asc()).limit(50)

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
        )
        if cutoff:
            writing_stmt = writing_stmt.where(WritingCorrection.created_at >= cutoff)
        writing_stmt = writing_stmt.order_by(WritingCorrection.created_at.asc()).limit(30)

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
        )
        if cutoff:
            speaking_stmt = speaking_stmt.where(SpeakingEvaluation.created_at >= cutoff)
        speaking_stmt = speaking_stmt.order_by(SpeakingEvaluation.created_at.asc()).limit(30)

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
