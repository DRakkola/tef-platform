"""Database-backed service layer for persistent user notifications and domain event notifications."""

import datetime
import uuid
from typing import Any

import structlog
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notifications.models import Notification
from app.modules.notifications.schemas import (
    NotificationListResponse,
    NotificationResponse,
    NotificationType,
)

logger = structlog.get_logger("tef-api.notifications")


class NotificationService:
    """PostgreSQL-backed notification query and delivery service."""

    @staticmethod
    async def get_user_notifications(
        db: AsyncSession, user_id: uuid.UUID, limit: int = 50
    ) -> NotificationListResponse:
        """Fetch user's notifications sorted newest first."""
        stmt = (
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .limit(limit)
        )
        result = await db.execute(stmt)
        items = list(result.scalars().all())

        unread_stmt = (
            select(func.count(Notification.id))
            .where(Notification.user_id == user_id, Notification.is_read.is_(False))
        )
        unread_count = (await db.execute(unread_stmt)).scalar() or 0

        responses = [
            NotificationResponse(
                id=n.id,
                user_id=n.user_id,
                title=n.title,
                message=n.message,
                type=NotificationType(n.notification_type)
                if n.notification_type in NotificationType._value2member_map_
                else NotificationType.SYSTEM_ANNOUNCEMENT,
                is_read=n.is_read,
                data=n.data or {},
                created_at=n.created_at,
            )
            for n in items
        ]

        return NotificationListResponse(
            items=responses,
            total=len(responses),
            unread_count=unread_count,
        )

    @staticmethod
    async def mark_as_read(
        db: AsyncSession, user_id: uuid.UUID, notification_id: uuid.UUID
    ) -> NotificationResponse | None:
        """Mark a single notification as read."""
        stmt = select(Notification).where(
            Notification.id == notification_id, Notification.user_id == user_id
        )
        notification = (await db.execute(stmt)).scalar_one_or_none()
        if not notification:
            return None

        now = datetime.datetime.now(datetime.UTC)
        notification.is_read = True
        notification.read_at = now
        await db.flush()

        return NotificationResponse(
            id=notification.id,
            user_id=notification.user_id,
            title=notification.title,
            message=notification.message,
            type=NotificationType(notification.notification_type)
            if notification.notification_type in NotificationType._value2member_map_
            else NotificationType.SYSTEM_ANNOUNCEMENT,
            is_read=notification.is_read,
            data=notification.data or {},
            created_at=notification.created_at,
        )

    @staticmethod
    async def mark_all_as_read(db: AsyncSession, user_id: uuid.UUID) -> int:
        """Mark all unread notifications for a user as read."""
        now = datetime.datetime.now(datetime.UTC)
        stmt = (
            update(Notification)
            .where(Notification.user_id == user_id, Notification.is_read.is_(False))
            .values(is_read=True, read_at=now)
        )
        result = await db.execute(stmt)
        await db.flush()
        return result.rowcount

    @staticmethod
    async def create_notification(
        db: AsyncSession,
        user_id: uuid.UUID,
        title: str,
        message: str,
        notification_type: NotificationType | str = NotificationType.SYSTEM_ANNOUNCEMENT,
        data: dict[str, Any] | None = None,
    ) -> Notification:
        """Persist a notification to PostgreSQL."""
        type_str = notification_type.value if isinstance(notification_type, NotificationType) else str(notification_type)
        notif = Notification(
            user_id=user_id,
            title=title,
            message=message,
            notification_type=type_str,
            is_read=False,
            data=data or {},
            created_at=datetime.datetime.now(datetime.UTC),
        )
        db.add(notif)
        await db.flush()
        logger.info(
            "notification_created",
            user_id=str(user_id),
            notification_type=type_str,
            title=title,
        )
        return notif

    # -----------------------------------------------------------------------
    # Domain Event Helper Abstractions
    # -----------------------------------------------------------------------

    @classmethod
    async def notify_writing_correction_ready(
        cls,
        db: AsyncSession,
        student_id: uuid.UUID,
        submission_id: uuid.UUID,
        score: float,
        estimated_level: str | None,
    ) -> Notification:
        """Domain event: Writing correction completed and returned."""
        lvl_str = f" (Niveau estimé: {estimated_level})" if estimated_level else ""
        return await cls.create_notification(
            db=db,
            user_id=student_id,
            title="Correction d'expression écrite disponible",
            message=f"Votre texte a été corrigé. Note obtenue: {score:.1f}/20{lvl_str}.",
            notification_type=NotificationType.WRITING_CORRECTION_READY,
            data={"submission_id": str(submission_id), "score": score, "level": estimated_level},
        )

    @classmethod
    async def notify_booking_confirmed(
        cls,
        db: AsyncSession,
        student_id: uuid.UUID,
        teacher_id: uuid.UUID,
        booking_id: uuid.UUID,
        start_time: datetime.datetime,
    ) -> tuple[Notification, Notification]:
        """Domain event: Teacher confirmed booking session."""
        time_str = start_time.strftime("%d/%m/%Y à %H:%M UTC")
        n1 = await cls.create_notification(
            db=db,
            user_id=student_id,
            title="Session de cours confirmée",
            message=f"Votre cours de préparation TEF du {time_str} est confirmé par votre enseignant.",
            notification_type=NotificationType.BOOKING_CONFIRMED,
            data={"booking_id": str(booking_id), "start_time": start_time.isoformat()},
        )
        n2 = await cls.create_notification(
            db=db,
            user_id=teacher_id,
            title="Session confirmée",
            message=f"Vous avez confirmé le cours du {time_str}.",
            notification_type=NotificationType.BOOKING_CONFIRMED,
            data={"booking_id": str(booking_id), "start_time": start_time.isoformat()},
        )
        return n1, n2

    @classmethod
    async def notify_booking_cancelled(
        cls,
        db: AsyncSession,
        notify_user_id: uuid.UUID,
        booking_id: uuid.UUID,
        cancelled_by_name: str,
        reason: str | None,
    ) -> Notification:
        """Domain event: Booking session cancelled."""
        reason_str = f" Motif: {reason}" if reason else ""
        return await cls.create_notification(
            db=db,
            user_id=notify_user_id,
            title="Session de cours annulée",
            message=f"La réservation #{str(booking_id)[:8]} a été annulée par {cancelled_by_name}.{reason_str}",
            notification_type=NotificationType.BOOKING_CANCELLED,
            data={"booking_id": str(booking_id), "reason": reason},
        )

    @classmethod
    async def notify_speaking_evaluated(
        cls,
        db: AsyncSession,
        student_id: uuid.UUID,
        session_id: uuid.UUID,
        estimated_level: str | None,
    ) -> Notification:
        """Domain event: Speaking session evaluated."""
        lvl_str = f" (Niveau estimé: {estimated_level})" if estimated_level else ""
        return await cls.create_notification(
            db=db,
            user_id=student_id,
            title="Évaluation d'expression orale prête",
            message=f"Le bilan de votre session orale est disponible{lvl_str}.",
            notification_type=NotificationType.EVALUATION_READY,
            data={"session_id": str(session_id), "level": estimated_level},
        )
