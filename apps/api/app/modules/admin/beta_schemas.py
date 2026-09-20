"""Pydantic schemas for the Admin Beta Control Panel."""

import datetime
import uuid
from typing import Any

from pydantic import BaseModel, Field

from app.modules.users.models import UserRole


class BetaOverviewResponse(BaseModel):
    """Real-time operational overview for the Private Beta cockpit."""

    total_beta_users: int
    active_users_7d: int
    recent_registrations_24h: int
    assessment_completions: int
    writing_submissions: int
    speaking_sessions: int
    practice_sessions: int
    teacher_bookings: int
    total_revenue_cents: int
    ai_total_cost_usd: float
    open_support_tickets: int
    unresolved_incidents_count: int
    feature_flags: dict[str, bool]
    server_timestamp: str


class BetaCohortCreate(BaseModel):
    """Payload to create a new beta cohort."""

    name: str = Field(..., min_length=2, max_length=100)
    description: str | None = None
    max_students: int = Field(default=50, ge=1, le=1000)
    max_teachers: int = Field(default=15, ge=1, le=200)
    feature_overrides: dict[str, Any] = Field(default_factory=dict)


class BetaCohortResponse(BaseModel):
    """Beta cohort details."""

    id: uuid.UUID
    name: str
    description: str | None
    max_students: int
    max_teachers: int
    is_active: bool
    feature_overrides: dict[str, Any]
    students_count: int = 0
    teachers_count: int = 0
    created_at: datetime.datetime


class BetaInvitationCreate(BaseModel):
    """Payload to generate a new cryptographic beta invitation."""

    cohort_id: uuid.UUID | None = None
    role: UserRole = UserRole.STUDENT
    max_uses: int = Field(default=1, ge=1, le=500)
    valid_days: int = Field(default=30, ge=1, le=180)
    environment: str = "production"


class BetaInvitationResponse(BaseModel):
    """Invitation details with masked token prefix."""

    id: uuid.UUID
    token_prefix: str
    cohort_id: uuid.UUID | None
    cohort_name: str | None = None
    role: UserRole
    max_uses: int
    used_count: int
    expires_at: datetime.datetime
    environment: str
    is_revoked: bool
    created_at: datetime.datetime
    # Only populated immediately upon creation
    plaintext_token: str | None = None


class BetaToggleFeatureRequest(BaseModel):
    """Emergency kill-switch toggle payload."""

    feature_name: str
    enabled: bool


class BetaSuspendUserRequest(BaseModel):
    """Payload to suspend or reactivate a beta user."""

    user_id: uuid.UUID
    suspended: bool
    reason: str | None = None
