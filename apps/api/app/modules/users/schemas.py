"""Pydantic response schemas for users and profiles."""

import datetime
import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr

from app.modules.users.models import TeacherVerificationStatus, UserRole


class StudentProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    target_exam: str
    target_level: str
    timezone: str
    native_language: str | None = None
    learning_preferences: dict[str, Any] = {}
    created_at: datetime.datetime
    updated_at: datetime.datetime


class TeacherProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    display_name: str
    bio: str | None = None
    expertise: list[str] = []
    teaching_levels: list[str] = []
    hourly_price: int
    verification_status: TeacherVerificationStatus
    timezone: str = "UTC"
    created_at: datetime.datetime
    updated_at: datetime.datetime


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    role: UserRole
    is_active: bool
    is_verified: bool
    is_beta_user: bool = False
    created_at: datetime.datetime
    updated_at: datetime.datetime
    last_login_at: datetime.datetime | None = None
    student_profile: StudentProfileResponse | None = None
    teacher_profile: TeacherProfileResponse | None = None
