"""FastAPI router for notifications endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.modules.auth.dependencies import get_current_user
from app.modules.notifications.schemas import (
    NotificationListResponse,
    NotificationResponse,
)
from app.modules.notifications.service import NotificationService
from app.modules.users.models import User

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get(
    "",
    response_model=NotificationListResponse,
    summary="List notifications for the current authenticated user",
)
async def get_notifications(
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
) -> NotificationListResponse:
    """Retrieve notifications for the authenticated user."""
    return await NotificationService.get_user_notifications(user_id=current_user.id, limit=limit)


@router.post(
    "/{notification_id}/read",
    response_model=NotificationResponse,
    summary="Mark a specific notification as read",
)
async def mark_notification_as_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
) -> NotificationResponse:
    """Mark a notification as read."""
    updated = await NotificationService.mark_as_read(
        user_id=current_user.id, notification_id=notification_id
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return updated
