"""Reassessment engine determining when simulated exams are beneficial."""

import datetime
import uuid
from typing import Any

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.assessments.enums import AssessmentType
from app.modules.assessments.models import Assessment, Attempt
from app.modules.learning.models import (
    ExerciseAttempt,
    ReadinessProfile,
    SkillEvidence,
)
from app.modules.users.models import StudentProfile


class ReassessmentEngine:
    """Evaluates readiness indicators and generates timely, non-spammy reassessment recommendations."""

    COOLDOWN_DAYS = 7  # Do not recommend reassessment more frequently than once every 7 days
    MIN_NEW_EXERCISES = 5  # At least 5 exercises completed since last formal attempt

    @classmethod
    async def evaluate_reassessment_need(
        cls,
        db: AsyncSession,
        student_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Check whether the student has accumulated enough evidence or milestone progress to justify reassessment."""
        now = datetime.datetime.now(datetime.UTC)

        # 1. Fetch latest completed assessment attempt
        latest_attempt = await db.scalar(
            select(Attempt)
            .where(
                Attempt.user_id == student_id,
                Attempt.submitted_at.is_not(None),
            )
            .order_by(desc(Attempt.submitted_at))
            .limit(1)
        )

        # Check cooldown
        if latest_attempt and latest_attempt.submitted_at:
            last_sub = (
                latest_attempt.submitted_at
                if latest_attempt.submitted_at.tzinfo
                else latest_attempt.submitted_at.replace(tzinfo=datetime.UTC)
            )
            days_since = (now - last_sub).total_seconds() / 86400.0
            if days_since < cls.COOLDOWN_DAYS:
                return {
                    "should_reassess": False,
                    "reason": f"Dernière épreuve passée il y a {int(days_since)} jour(s). Période de consolidation recommandée.",
                    "skill_id": None,
                    "skill_name": None,
                    "suggested_assessment_id": None,
                    "suggested_assessment_title": None,
                    "generated_at": now,
                }

        # 2. Count exercises completed since last attempt
        last_attempt_date = (
            latest_attempt.submitted_at
            if latest_attempt and latest_attempt.submitted_at
            else now - datetime.timedelta(days=90)
        )
        exercises_since_count = (
            await db.scalar(
                select(func.count(ExerciseAttempt.id)).where(
                    ExerciseAttempt.user_id == student_id,
                    ExerciseAttempt.attempted_at > last_attempt_date,
                )
            )
        ) or 0

        # 3. Check target date proximity
        profile = await db.scalar(select(StudentProfile).where(StudentProfile.user_id == student_id))
        target_date = profile.target_date if profile else None
        days_to_exam = (target_date - now.date()).days if target_date else None

        # 4. Check readiness profile blockers
        readiness_profile = await db.scalar(
            select(ReadinessProfile).where(ReadinessProfile.student_id == student_id)
        )
        blockers = readiness_profile.summary_blockers if readiness_profile else []

        should_reassess = False
        reason = None
        focus_type = AssessmentType.READING

        if latest_attempt is None:
            should_reassess = True
            reason = "Test de positionnement initial recommandé pour calibrer votre profil d'apprentissage."
        elif exercises_since_count >= cls.MIN_NEW_EXERCISES:
            should_reassess = True
            reason = (
                f"Vous avez complété {exercises_since_count} exercices de perfectionnement. "
                "Une réévaluation formative mesurera vos progrès récents."
            )
        elif days_to_exam is not None and 0 <= days_to_exam <= 14:
            should_reassess = True
            reason = f"Échéance d'examen proche ({days_to_exam} jours). Simulation chronométrée recommandée."

        if not should_reassess:
            return {
                "should_reassess": False,
                "reason": (
                    f"Continuez votre pratique ciblée ({exercises_since_count}/{cls.MIN_NEW_EXERCISES} exercices "
                    "recommandés avant la prochaine réévaluation)."
                ),
                "skill_id": None,
                "skill_name": None,
                "suggested_assessment_id": None,
                "suggested_assessment_title": None,
                "generated_at": now,
            }

        # 5. Suggest an assessment
        suggested = await db.scalar(
            select(Assessment)
            .where(
                Assessment.is_published.is_(True),
                Assessment.status == "published",
            )
            .order_by(Assessment.created_at.asc())
            .limit(1)
        )

        return {
            "should_reassess": True,
            "reason": reason,
            "skill_id": None,
            "skill_name": "Évaluation globale",
            "suggested_assessment_id": suggested.id if suggested else None,
            "suggested_assessment_title": suggested.title if suggested else "Épreuve d'entraînement TEF",
            "generated_at": now,
        }
