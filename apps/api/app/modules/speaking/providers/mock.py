"""Mock providers for WebRTC Media Room, Speech Transcription, and Speaking Evaluation."""

import uuid

from app.modules.speaking.abstractions import (
    EvaluationResult,
    ICEServerConfig,
    MediaRoomDescriptor,
    MediaRoomProvider,
    SpeakingEvaluationProvider,
    SpeechTranscriptionProvider,
)


class MockMediaRoomProvider(MediaRoomProvider):
    """Media room provider using standard STUN servers for peer-to-peer WebRTC connections."""

    def __init__(self) -> None:
        self._rooms: dict[str, MediaRoomDescriptor] = {}

    def get_ice_servers(self) -> list[ICEServerConfig]:
        """Return public Google STUN servers for WebRTC NAT traversal."""
        return [
            ICEServerConfig(urls=["stun:stun.l.google.com:19302"]),
            ICEServerConfig(urls=["stun:stun1.l.google.com:19302"]),
            ICEServerConfig(urls=["stun:stun2.l.google.com:19302"]),
        ]

    def create_room(self, room_id: str, session_id: uuid.UUID) -> MediaRoomDescriptor:
        """Create or register room descriptor."""
        descriptor = MediaRoomDescriptor(
            room_id=room_id,
            session_id=session_id,
            ice_servers=self.get_ice_servers(),
            is_active=True,
        )
        self._rooms[room_id] = descriptor
        return descriptor

    def close_room(self, room_id: str) -> None:
        """Deactivate room."""
        if room_id in self._rooms:
            self._rooms[room_id].is_active = False


class MockTranscriptionProvider(SpeechTranscriptionProvider):
    """Mock speech-to-text provider simulating French oral transcription."""

    async def transcribe_audio_chunk(self, audio_data: bytes) -> str:
        """Return simulated French transcription."""
        return "Bonjour, je souhaite me renseigner au sujet de l'annonce publiée récemment."


class MockSpeakingProvider(SpeakingEvaluationProvider):
    """Deterministic speaking evaluator for testing and development.

    Strictly sets is_official_tef=False according to platform compliance guidelines.
    """

    async def evaluate_session(
        self,
        topic: str,
        level: str = "B2",
        duration_seconds: int = 1500,
        transcript: str | None = None,
    ) -> EvaluationResult:
        """Generate structured diagnostic feedback across French oral competencies."""
        return EvaluationResult(
            estimated_level=level if level in ("A1", "A2", "B1", "B2", "C1", "C2") else "B2",
            fluency=74.5,
            vocabulary=78.0,
            grammar=72.0,
            coherence=76.0,
            pronunciation=75.0,
            overall_score=75.1,
            tef_points=475,
            strengths=[
                "Bonne aisance communicative globale et débit de parole naturel.",
                "Utilisation pertinente des articulateurs logiques (en effet, néanmoins, par conséquent).",
                "Capacité avérée à reformuler lors de questions imprévues.",
            ],
            weaknesses=[
                "Quelques imprécisions sur l'usage du subjonctif après certaines locutions concessives.",
                "Légère hésitation sur l'accent tonique des polysyllabes en fin de groupe rythmique.",
            ],
            recommendations=[
                "Consolider les verbes nécessitant le subjonctif en contexte argumentatif.",
                "S'entraîner à la distinction phonétique fine entre [y] et [u].",
                "Participer à une séance de simulation chronométrée TEF Section B.",
            ],
            detailed_feedback=(
                "Performance solide démontrant une compétence communicative opérationnelle de niveau B2. "
                "L'interaction est fluide et les idées sont organisées avec clarté."
            ),
            is_official_tef=False,
            skill_breakdowns={
                "speaking_fluency": 74.5,
                "speaking_vocabulary": 78.0,
                "speaking_grammar": 72.0,
                "speaking_coherence": 76.0,
                "speaking_pronunciation": 75.0,
            },
        )
