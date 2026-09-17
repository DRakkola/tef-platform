"""Service layer for user notifications."""

import uuid
from datetime import UTC, datetime
from typing import Any, ClassVar

from app.modules.notifications.schemas import (
    NotificationListResponse,
    NotificationResponse,
    NotificationType,
)


class NotificationService:
    """In-memory notification query and delivery service."""

    _notifications: ClassVar[dict[uuid.UUID, list[NotificationResponse]]] = {}

    @classmethod
    async def get_user_notifications(
        cls, user_id: uuid.UUID, limit: int = 50
    ) -> NotificationListResponse:
        user_items = cls._notifications.get(user_id, [])
        unread = sum(1 for n in user_items if not n.is_read)
        return NotificationListResponse(
            items=user_items[:limit],
            total=len(user_items),
            unread_count=unread,
        )

    @classmethod
    async def mark_as_read(
        cls, user_id: uuid.UUID, notification_id: uuid.UUID
    ) -> NotificationResponse | None:
        user_items = cls._notifications.get(user_id, [])
        for item in user_items:
            if item.id == notification_id:
                item.is_read = True
                return item
        return None

    @classmethod
    async def create_notification(
        cls,
        user_id: uuid.UUID,
        title: str,
        message: str,
        notification_type: NotificationType = NotificationType.SYSTEM_ANNOUNCEMENT,
        data: dict[str, Any] | None = None,
    ) -> NotificationResponse:
        if user_id not in cls._notifications:
            cls._notifications[user_id] = []

        notif = NotificationResponse(
            id=uuid.uuid4(),
            user_id=user_id,
            title=title,
            message=message,
            type=notification_type,
            is_read=False,
            data=data or {},
            created_at=datetime.now(UTC),
        )
        cls._notifications[user_id].insert(0, notif)
        return notif
