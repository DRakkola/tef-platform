"""Deterministic Student Behavioral Segmentation and Engagement Health Service.

Evaluates objective platform activity vectors without personal or psychological judgments.
All calculations are deterministic, transparent, and auditable.
"""

import datetime
import uuid
from typing import Any

from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.assessments.models import Attempt, AttemptStatus
from app.modules.billing.models import AIUsageRecord, Order, OrderStatus, Subscription
from app.modules.learning.models import ExerciseAttempt, Recommendation
from app.modules.learning.enums import RecommendationStatus
from app.modules.learning.readiness_models import ReadinessProfile
from app.modules.practice_pool.models import PracticeParticipant
from app.modules.teachers.models import TeacherBooking
from app.modules.users.models import StudentProfile, User
from app.modules.writing.models import WritingSubmission
from app.modules.writing.enums import WritingSubmissionStatus


class StudentSegmentationService:
    """Service to classify students into deterministic behavioral segments

    and compute objective engagement risk statuses.
    """

    SEGMENTS = [
        "premium_student",
        "teacher_engaged_student",
        "ai_heavy_user",
        "practice_pool_user",
        "returning_student",
        "activated_student",
        "at_risk_student",
        "new_student",
    ]

    @classmethod
    async def evaluate_student_segment(
        cls,
        db: AsyncSession,
        student_id: uuid.UUID,
    ) -> str:
        """Determines the primary behavioral segment for a student based on verified activity."""
        now = datetime.datetime.now(datetime.UTC)
        user = await db.scalar(select(User).where(User.id == student_id))
        if not user:
            return "new_student"

        # 1. Premium Student Check (Active Subscription or Paid Order)
        has_sub = await db.scalar(
            select(Subscription.id).where(
                Subscription.user_id == student_id,
                Subscription.status == "active",
            ).limit(1)
        )
        if has_sub:
            return "premium_student"

        has_paid_order = await db.scalar(
            select(Order.id).where(
                Order.user_id == student_id,
                Order.status == OrderStatus.PAID,
            ).limit(1)
        )
        if has_paid_order:
            return "premium_student"

        # 2. Teacher-Engaged Student (Has booked or attended teacher lessons)
        has_teacher_booking = await db.scalar(
            select(TeacherBooking.id).where(
                TeacherBooking.student_id == student_id
            ).limit(1)
        )
        if has_teacher_booking:
            return "teacher_engaged_student"

        # 3. AI-Heavy User (>= 5 AI oral or writing evaluations)
        ai_records_count = await db.scalar(
            select(func.count(AIUsageRecord.id)).where(
                AIUsageRecord.user_id == student_id
            )
        ) or 0
        if ai_records_count >= 5:
            return "ai_heavy_user"

        # 4. Practice Pool User (>= 2 peer practice sessions)
        practice_matches_count = await db.scalar(
            select(func.count(PracticeParticipant.id)).where(
                PracticeParticipant.user_id == student_id
            )
        ) or 0
        if practice_matches_count >= 2:
            return "practice_pool_user"

        # 5. Activity Dates in Last 14 Days
        cutoff_14d = now - datetime.timedelta(days=14)
        ex_dates = (
            await db.execute(
                select(func.date(ExerciseAttempt.attempted_at)).where(
                    ExerciseAttempt.user_id == student_id,
                    ExerciseAttempt.attempted_at >= cutoff_14d,
                ).distinct()
            )
        ).scalars().all()

        attempt_dates = (
            await db.execute(
                select(func.date(Attempt.created_at)).where(
                    Attempt.user_id == student_id,
                    Attempt.created_at >= cutoff_14d,
                ).distinct()
            )
        ).scalars().all()

        all_distinct_dates = set(ex_dates) | set(attempt_dates)
        if len(all_distinct_dates) >= 2:
            return "returning_student"

        # 6. Activated Student (Onboarding completed + >= 1 assessment completed)
        profile = await db.scalar(
            select(StudentProfile).where(StudentProfile.user_id == student_id)
        )
        onboarding_done = profile and profile.onboarding_status == "completed"

        completed_assessments = await db.scalar(
            select(func.count(Attempt.id)).where(
                Attempt.user_id == student_id,
                Attempt.status == AttemptStatus.SUBMITTED,
            )
        ) or 0

        if onboarding_done and completed_assessments >= 1:
            return "activated_student"

        # 7. At-Risk Student (Inactive >= 5 days with pending recommendations)
        cutoff_5d = now - datetime.timedelta(days=5)
        last_activity = user.last_login_at or user.created_at
        if last_activity:
            if last_activity.tzinfo is None:
                last_activity = last_activity.replace(tzinfo=datetime.UTC)
            if last_activity < cutoff_5d:
                pending_recs = await db.scalar(
                    select(func.count(Recommendation.id)).where(
                        Recommendation.user_id == student_id,
                        Recommendation.status == RecommendationStatus.ACTIVE,
                    )
                ) or 0
                if pending_recs > 0:
                    return "at_risk_student"

        # Default fallback
        return "new_student"

    @classmethod
    async def compute_engagement_status(
        cls,
        db: AsyncSession,
        student_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Calculates a deterministic engagement health report for the student.

        Terminology is non-judgmental and strictly based on observable signals.
        """
        now = datetime.datetime.now(datetime.UTC)
        user = await db.scalar(select(User).where(User.id == student_id))
        if not user:
            return {
                "status": "new",
                "label_fr": "Nouvel inscrit",
                "days_inactive": 0,
                "pending_writing_corrections": 0,
                "incomplete_recommendations": 0,
                "unresolved_blockers": 0,
                "risk_factors": [],
            }

        last_active = user.last_login_at or user.created_at
        if last_active.tzinfo is None:
            last_active = last_active.replace(tzinfo=datetime.UTC)
        days_inactive = max(0, (now - last_active).days)

        # Count pending writing submissions in processing
        pending_writing = await db.scalar(
            select(func.count(WritingSubmission.id)).where(
                WritingSubmission.user_id == student_id,
                WritingSubmission.status.in_([
                    WritingSubmissionStatus.SUBMITTED,
                    WritingSubmissionStatus.QUEUED,
                    WritingSubmissionStatus.PROCESSING,
                    WritingSubmissionStatus.IN_REVIEW,
                ]),
            )
        ) or 0

        # Incomplete recommendations
        incomplete_recs = await db.scalar(
            select(func.count(Recommendation.id)).where(
                Recommendation.user_id == student_id,
                Recommendation.status == RecommendationStatus.ACTIVE,
            )
        ) or 0

        # Unresolved blocking competencies from readiness profile
        readiness = await db.scalar(
            select(ReadinessProfile).where(ReadinessProfile.student_id == student_id)
        )
        unresolved_blockers = len(readiness.summary_blockers) if readiness and readiness.summary_blockers else 0

        # Objective risk factors
        risk_factors: list[str] = []
        if days_inactive >= 7:
            risk_factors.append(f"Aucune activité observée depuis {days_inactive} jours.")
        elif days_inactive >= 4:
            risk_factors.append(f"Inactivité constatée depuis {days_inactive} jours.")

        if unresolved_blockers > 0:
            risk_factors.append(f"{unresolved_blockers} compétence(s) bloquante(s) identifiée(s) pour votre objectif.")

        if incomplete_recs >= 3:
            risk_factors.append(f"{incomplete_recs} recommandations pédagogiques en attente d'entraînement.")

        if pending_writing > 0:
            risk_factors.append(f"{pending_writing} tâche(s) d'expression écrite non finalisée(s).")

        # Classify status
        if days_inactive >= 14:
            status = "dormant"
            label_fr = "Inactif"
        elif days_inactive >= 5 or len(risk_factors) >= 3:
            status = "at_risk"
            label_fr = "Risque d'inactivité"
        elif days_inactive >= 3 or len(risk_factors) >= 1:
            status = "needs_reengagement"
            label_fr = "Reconnexion conseillée"
        elif (now - (user.created_at if user.created_at.tzinfo else user.created_at.replace(tzinfo=datetime.UTC))).days <= 3 and days_inactive <= 2:
            status = "new"
            label_fr = "Nouvel inscrit"
        else:
            status = "on_track"
            label_fr = "En progression régulière"

        return {
            "status": status,
            "label_fr": label_fr,
            "days_inactive": days_inactive,
            "pending_writing_corrections": pending_writing,
            "incomplete_recommendations": incomplete_recs,
            "unresolved_blockers": unresolved_blockers,
            "risk_factors": risk_factors,
        }
