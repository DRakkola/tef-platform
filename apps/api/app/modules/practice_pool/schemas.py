"""Pydantic schemas for Practice Pool: queue, requests, sessions, reports, and blocks.

Enforces zero leakage of user personal information (names, emails, user IDs).
"""

import datetime
import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.modules.practice_pool.enums import (
    PracticeQueueStatus,
    PracticeReportReason,
    PracticeRequestStatus,
    PracticeSessionStatus,
    PracticeType,
)


class PracticeTopicResponse(BaseModel):
    """Conversation starter scenario or TEF speaking roleplay prompt."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str
    level: str
    category: str
    prompts: list[str] = Field(default_factory=list)


class PracticeQueueJoin(BaseModel):
    """Payload to enter practice pool queue."""

    language: str = Field(
        default="fr", max_length=10, description="Target language code (default 'fr')"
    )
    level: str = Field(default="B2", max_length=10, description="Approximate CEFR level (A1-C2)")
    practice_type: PracticeType = Field(
        default=PracticeType.FREE_CONVERSATION,
        description="Type of speaking practice requested",
    )
    topic_id: uuid.UUID | None = Field(
        default=None,
        description="Optional preferred practice topic identifier",
    )


class PracticeHeartbeatResponse(BaseModel):
    """Heartbeat response confirming queue presence renewal."""

    in_queue: bool
    status: str
    ttl_seconds: int = 60


class PracticeCandidate(BaseModel):
    """Anonymous candidate representation in the queue."""

    queue_id: uuid.UUID
    anonymous_alias: str
    language: str
    level: str
    practice_type: PracticeType
    joined_at: datetime.datetime
    score: float | None = None


class PracticeQueueStatusResponse(BaseModel):
    """Current user queue status and discovered compatible candidates."""

    in_queue: bool
    queue_id: uuid.UUID | None = None
    anonymous_alias: str | None = None
    status: PracticeQueueStatus | None = None
    language: str | None = None
    level: str | None = None
    practice_type: PracticeType | None = None
    topic_id: uuid.UUID | None = None
    joined_at: datetime.datetime | None = None
    candidates: list[PracticeCandidate] = Field(default_factory=list)


class PracticeRequestCreate(BaseModel):
    """Payload to send a 1-to-1 practice request to a queue candidate."""

    candidate_queue_id: uuid.UUID = Field(
        ..., description="Queue identifier of the selected anonymous candidate"
    )
    topic_id: uuid.UUID | None = Field(
        None, description="Optional chosen topic for the practice session"
    )


class PracticeRequestResponse(BaseModel):
    """Representation of an outgoing or incoming practice invitation."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sender_alias: str
    receiver_alias: str
    language: str
    level: str
    practice_type: PracticeType
    status: PracticeRequestStatus
    expires_at: datetime.datetime
    created_at: datetime.datetime
    is_incoming: bool = False


class PracticeSessionResponse(BaseModel):
    """Authoritative practice session overview with anonymous peer identities."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    match_id: uuid.UUID
    room_id: str
    my_alias: str
    peer_alias: str
    language: str
    level: str
    practice_type: PracticeType
    duration_minutes: int = 25
    status: PracticeSessionStatus
    starts_at: datetime.datetime
    expires_at: datetime.datetime
    remaining_seconds: int | None = None
    audio_only: bool = True
    topic: PracticeTopicResponse | None = None
    created_at: datetime.datetime


class PracticeSessionDetailResponse(PracticeSessionResponse):
    """Full practice session details including WebRTC ICE configuration."""

    ice_servers: list[dict[str, Any]] = Field(default_factory=list)


class PracticeReportCreate(BaseModel):
    """Payload to report an unruly peer."""

    reason: PracticeReportReason
    details: str | None = Field(None, max_length=1000)


class PracticeReportResponse(BaseModel):
    """Confirmation of submitted peer report."""

    id: uuid.UUID
    reason: PracticeReportReason
    status: str
    created_at: datetime.datetime


class PracticeBlockCreate(BaseModel):
    """Payload to block a peer."""

    reason: str | None = Field(None, max_length=255)


class PracticeBlockResponse(BaseModel):
    """Blocked peer confirmation."""

    id: uuid.UUID
    blocked_user_id: uuid.UUID
    reason: str | None = None
    created_at: datetime.datetime


class PracticeReportDirectCreate(BaseModel):
    """Payload to report a peer by session ID."""

    session_id: uuid.UUID
    reason: PracticeReportReason
    details: str | None = Field(None, max_length=1000)


class PracticeBlockDirectCreate(BaseModel):
    """Payload to block a peer by user ID."""

    blocked_user_id: uuid.UUID
    reason: str | None = Field(None, max_length=255)


class PracticeSignalingEnvelope(BaseModel):
    """Strict schema for WebRTC signaling messages."""

    action: str = Field(..., description="Signaling action (e.g. ready, offer, answer, ice-candidate)")
    sender_id: str | None = None
    sender_alias: str | None = None
    target_id: str | None = None
    audio_only: bool = True
    data: dict[str, Any] = Field(default_factory=dict)


