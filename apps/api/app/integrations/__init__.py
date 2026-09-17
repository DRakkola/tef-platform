"""External service integrations."""

from app.integrations.email import EmailProvider, MockEmailProvider
from app.integrations.speech import MockSpeechProvider, SpeechProvider

__all__ = [
    "EmailProvider",
    "MockEmailProvider",
    "MockSpeechProvider",
    "SpeechProvider",
]
