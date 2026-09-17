"""Speech recognition and synthesis integration interfaces."""

from abc import ABC, abstractmethod


class SpeechProvider(ABC):
    """Abstract interface for speech transcription and pronunciation analysis."""

    @abstractmethod
    async def transcribe_audio(self, audio_bytes: bytes, language: str = "fr") -> dict:
        """Transcribe audio recording to text with confidence and timing."""


class MockSpeechProvider(SpeechProvider):
    """Deterministic mock speech provider for testing and development."""

    async def transcribe_audio(self, audio_bytes: bytes, language: str = "fr") -> dict:
        return {
            "transcript": "Bonjour, je m'appelle Jean et je prépare le test TEF Canada.",
            "confidence": 0.96,
            "language": language,
            "duration_seconds": 4.5,
            "word_count": 11,
        }
