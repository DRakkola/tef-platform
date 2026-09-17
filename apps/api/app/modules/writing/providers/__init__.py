"""Writing correction providers package."""

from app.modules.writing.providers.ai import AICorrectionProvider
from app.modules.writing.providers.base import CorrectionProvider, CorrectionResult
from app.modules.writing.providers.mock import MockCorrectionProvider
from app.modules.writing.providers.teacher import HumanTeacherCorrectionProvider

__all__ = [
    "AICorrectionProvider",
    "CorrectionProvider",
    "CorrectionResult",
    "HumanTeacherCorrectionProvider",
    "MockCorrectionProvider",
]
