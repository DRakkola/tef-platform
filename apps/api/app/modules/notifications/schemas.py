"""Pydantic schemas for the in-app notifications domain."""

import uuid
from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class NotificationType(str, Enum):
    SESSION_REMINDER = "session_reminder"
    BOOKING_CONFIRMED = "booking_confirmed"
    BOOKING_CANCELLED = "booking_cancelled"
    EVALUATION_READY = "evaluation_ready"
    WRITING_CORRECTION_READY = "writing_correction_ready"
    PRACTICE_MATCHED = "practice_matched"
    SYSTEM_ANNOUNCEMENT = "system_announcement"


class NotificationResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    message: str
    type: NotificationType
    is_read: bool = False
    data: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    total: int
    unread_count: int
