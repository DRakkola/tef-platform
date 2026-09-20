"""Schemas for student privacy, account deletion, and GDPR data export."""

import datetime
import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class StudentDeleteRequest(BaseModel):
    """Payload for student self-service account deletion (GDPR Right to be Forgotten)."""

    password: str = Field(..., min_length=1, description="Student's current password for re-authentication")
    reason: str | None = Field(None, max_length=500, description="Optional self-reported reason for account deletion")


class StudentDeleteResponse(BaseModel):
    """Response returned upon successful account deletion and anonymization."""

    model_config = ConfigDict(from_attributes=True)

    status: str = "success"
    message: str = "Student account has been anonymized and deleted according to GDPR Right to be Forgotten."
    anonymized_email: str
    deleted_at: datetime.datetime


class StudentDataExportResponse(BaseModel):
    """Structured portable archive of student data (GDPR Right to Data Portability)."""

    user_id: uuid.UUID
    exported_at: datetime.datetime
    profile: dict[str, Any]
    learning_activities: list[dict[str, Any]]
    assessments: list[dict[str, Any]]
    writing_submissions: list[dict[str, Any]]
    speaking_sessions: list[dict[str, Any]]
    teacher_bookings: list[dict[str, Any]]
    billing_summary: dict[str, Any]
