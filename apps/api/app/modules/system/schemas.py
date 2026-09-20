"""Schemas for system metadata, feature flags, and support feedback."""

import datetime
import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class FeatureFlagsResponse(BaseModel):
    """Current state of system feature flags."""

    flags: dict[str, bool]


class UpdateFeatureFlagRequest(BaseModel):
    """Payload to toggle a system feature flag."""

    flag_name: str = Field(..., description="Name of the feature flag to update")
    enabled: bool = Field(..., description="Target boolean state")
    reason: str | None = Field(None, max_length=255, description="Administrative justification")


class SupportTicketRequest(BaseModel):
    """Support or bug report payload submitted during private beta."""

    category: str = Field(..., max_length=50, description="Category: bug, audio_issue, billing, general_feedback")
    subject: str = Field(..., max_length=150, description="Brief summary of the issue")
    description: str = Field(..., max_length=3000, description="Detailed description of the issue or feedback")
    client_metadata: dict[str, Any] = Field(default_factory=dict, description="Browser, OS, viewport, network diagnostics")


class SupportTicketResponse(BaseModel):
    """Confirmation returned when a support report is successfully recorded."""

    ticket_id: uuid.UUID
    status: str = "received"
    created_at: datetime.datetime
    message: str = "Thank you for your report. Our engineering team has been notified."
