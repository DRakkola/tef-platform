"""Controlled Re-Engagement Notification Service.

Delivers actionable, high-value learning return notifications with strict cooldown limits
to prevent user fatigue or spam.
"""

import datetime
import uuid
from typing import Any

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.learning.models import Recommendation, RecommendationStatus
from app.modules.notifications.models import Notification
from app.modules.writing.models import WritingCorrection, WritingSubmission, WritingSubmissionStatus

logger = structlog.get_logger("tef-api.reengagement")


class ReengagementService:
    """Service governing controlled student re-engagement nudges with cooldowns."""

    # Minimum cooldown between re-engagement notifications for a single student (48 hours)
    REENGAGEMENT_COOLDOWN_HOURS = 48

    @classmethod
    async def can_send_reengagement(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> bool:
        """Verifies if the student is eligible for a re-engagement notification under the cooldown rule."""
        now = datetime.datetime.now(datetime.UTC)
        cutoff = now - datetime.timedelta(hours=cls.REENGAGEMENT_COOLDOWN_HOURS)

        recent_nudge = await db.scalar(
            select(Notification.id).where(
                Notification.user_id == user_id,
                Notification.notification_type == "reengagement_nudge",
                Notification.created_at >= cutoff,
            ).limit(1)
        )
        return recent_nudge is None

    @classmethod
    async def trigger_reengagement_nudge(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
        trigger_reason: str | None = None,
    ) -> Notification | None:
        """Evaluates student learning state and delivers a contextual re-engagement notification

        if eligible under the cooldown policy.
        """
        # 1. Check cooldown
        if not await cls.can_send_reengagement(db, user_id):
            logger.info("reengagement_suppressed_by_cooldown", user_id=str(user_id))
            return None

        now = datetime.datetime.now(datetime.UTC)
        title = "Votre plan d'entraînement TEF"
        message = "Reprenez votre entraînement personnalisé pour atteindre votre objectif NCLC 7."
        nudge_payload: dict[str, Any] = {"trigger": trigger_reason or "generic"}

        # 2. Check for completed writing correction ready for review
        recent_correction = await db.scalar(
            select(WritingSubmission).where(
                WritingSubmission.user_id == user_id,
                WritingSubmission.status == WritingSubmissionStatus.COMPLETED,
            ).order_by(WritingSubmission.updated_at.desc()).limit(1)
        )
        if recent_correction and (now - (recent_correction.updated_at if recent_correction.updated_at.tzinfo else recent_correction.updated_at.replace(tzinfo=datetime.UTC))).days <= 3:
            title = "Votre correction de rédaction est prête"
            message = "Votre évaluation détaillée d'expression écrite est disponible. Consultez les conseils du barème TEF."
            nudge_payload = {
                "trigger": "writing_correction_ready",
                "submission_id": str(recent_correction.id),
            }
        else:
            # 3. Check for pending active recommendations
            pending_recs = (
                await db.execute(
                    select(Recommendation).where(
                        Recommendation.user_id == user_id,
                        Recommendation.status == RecommendationStatus.ACTIVE,
                    ).limit(3)
                )
            ).scalars().all()

            if pending_recs:
                count = len(pending_recs)
                title = f"Vous avez {count} exercice(s) recommandé(s)"
                message = f"Des exercices ciblés sur vos compétences clés sont prêts pour consolider votre niveau."
                nudge_payload = {
                    "trigger": "pending_recommendations",
                    "recommendations_count": count,
                }
            else:
                title = "Point d'étape TEF Canada"
                message = "Mesurez vos progrès en réalisant une courte série d'entraînement aujourd'hui."
                nudge_payload = {"trigger": "periodic_progress_check"}

        # 4. Create Notification
        notification = Notification(
            user_id=user_id,
            title=title,
            message=message,
            notification_type="reengagement_nudge",
            is_read=False,
            data=nudge_payload,
            created_at=now,
        )
        db.add(notification)
        await db.commit()
        await db.refresh(notification)

        logger.info(
            "reengagement_nudge_dispatched",
            user_id=str(user_id),
            trigger=nudge_payload.get("trigger"),
        )
        return notification
