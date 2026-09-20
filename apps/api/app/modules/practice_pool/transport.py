"""Media transport abstractions for audio-only WebRTC practice pool sessions."""

import uuid
from typing import Any, Protocol

import structlog

logger = structlog.get_logger("tef-api.practice_pool.transport")


class PracticeMediaTransport(Protocol):
    """Protocol for WebRTC room orchestration and ICE configuration."""

    def create_room(self, room_id: str, session_id: uuid.UUID) -> dict[str, Any]: ...
    def close_room(self, room_id: str) -> None: ...
    def get_ice_servers(self) -> list[dict[str, Any]]: ...


class MockPracticeMediaTransport:
    """Deterministic media transport implementation for automated tests, CI, and local development."""

    def __init__(self) -> None:
        self.active_rooms: dict[str, dict[str, Any]] = {}

    def create_room(self, room_id: str, session_id: uuid.UUID) -> dict[str, Any]:
        descriptor = {
            "room_id": room_id,
            "session_id": str(session_id),
            "audio_only": True,
            "status": "open",
        }
        self.active_rooms[room_id] = descriptor
        logger.info("mock_practice_room_created", room_id=room_id, session_id=str(session_id))
        return descriptor

    def close_room(self, room_id: str) -> None:
        if room_id in self.active_rooms:
            self.active_rooms[room_id]["status"] = "closed"
            del self.active_rooms[room_id]
            logger.info("mock_practice_room_closed", room_id=room_id)

    def get_ice_servers(self) -> list[dict[str, Any]]:
        """Return standardized public STUN servers for peer connectivity."""
        return [
            {"urls": ["stun:stun.l.google.com:19302"]},
            {"urls": ["stun:stun1.l.google.com:19302"]},
        ]


class WebRTCPracticeMediaTransport:
    """Production WebRTC transport with configurable STUN/TURN traversal."""

    def __init__(self, stun_urls: list[str] | None = None, turn_server: dict[str, Any] | None = None) -> None:
        self.stun_urls = stun_urls or ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]
        self.turn_server = turn_server
        self.active_rooms: dict[str, dict[str, Any]] = {}

    def create_room(self, room_id: str, session_id: uuid.UUID) -> dict[str, Any]:
        descriptor = {
            "room_id": room_id,
            "session_id": str(session_id),
            "audio_only": True,
            "status": "open",
        }
        self.active_rooms[room_id] = descriptor
        logger.info("webrtc_practice_room_created", room_id=room_id, session_id=str(session_id))
        return descriptor

    def close_room(self, room_id: str) -> None:
        self.active_rooms.pop(room_id, None)
        logger.info("webrtc_practice_room_closed", room_id=room_id)

    def get_ice_servers(self) -> list[dict[str, Any]]:
        servers: list[dict[str, Any]] = [{"urls": self.stun_urls}]
        if self.turn_server:
            servers.append(self.turn_server)
        return servers


# Default singleton instance
practice_media_transport: PracticeMediaTransport = MockPracticeMediaTransport()


def get_practice_media_transport() -> PracticeMediaTransport:
    """Return active practice pool media transport."""
    return practice_media_transport


def set_practice_media_transport(transport: PracticeMediaTransport) -> None:
    """Override media transport (e.g. for testing)."""
    global practice_media_transport
    practice_media_transport = transport
