"""Protocols and interfaces for media rooms, WebRTC signaling, speech transcription, and evaluation."""

import abc
import uuid
from typing import Any

from pydantic import BaseModel, Field


class ICEServerConfig(BaseModel):
    """STUN / TURN server configuration for WebRTC peer connections."""

    urls: list[str] = Field(default_factory=list)
    username: str | None = None
    credential: str | None = None


class MediaRoomDescriptor(BaseModel):
    """Representation of an active WebRTC media room."""

    room_id: str
    session_id: uuid.UUID
    ice_servers: list[ICEServerConfig] = Field(default_factory=list)
    is_active: bool = True


class SignalingPayload(BaseModel):
    """Envelope for WebRTC signaling exchanged over WebSocket."""

    action: str = Field(
        ..., description="offer | answer | ice_candidate | join | leave | timer_sync"
    )
    sender_id: str
    target_id: str | None = None
    data: dict[str, Any] = Field(default_factory=dict)


class EvaluationResult(BaseModel):
    """Standardized result produced by speaking evaluation providers."""

    estimated_level: str
    fluency: float
    vocabulary: float
    grammar: float
    coherence: float
    pronunciation: float
    overall_score: float
    strengths: list[str]
    weaknesses: list[str]
    recommendations: list[str]
    detailed_feedback: str | None = None
    is_official_tef: bool = False
    skill_breakdowns: dict[str, float] = Field(default_factory=dict)


class MediaRoomProvider(abc.ABC):
    """Abstract interface managing WebRTC media rooms and ICE servers."""

    @abc.abstractmethod
    def create_room(self, room_id: str, session_id: uuid.UUID) -> MediaRoomDescriptor:
        """Initialize or register a WebRTC media room."""

    @abc.abstractmethod
    def get_ice_servers(self) -> list[ICEServerConfig]:
        """Provide standard STUN/TURN server candidates for peer-to-peer WebRTC transport."""

    @abc.abstractmethod
    def close_room(self, room_id: str) -> None:
        """Close an active media room."""


class SpeechTranscriptionProvider(abc.ABC):
    """Abstract interface for speech transcription."""

    @abc.abstractmethod
    async def transcribe_audio_chunk(self, audio_data: bytes) -> str:
        """Transcribe an audio chunk into text."""


class SpeakingEvaluationProvider(abc.ABC):
    """Abstract interface for speaking session evaluations."""

    @abc.abstractmethod
    async def evaluate_session(
        self,
        topic: str,
        level: str,
        duration_seconds: int,
        transcript: str | None = None,
    ) -> EvaluationResult:
        """Evaluate oral expression performance according to CEFR/TEF competencies."""
