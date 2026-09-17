"""Base abstraction for writing correction providers."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from app.modules.writing.enums import CorrectionProviderType
from app.modules.writing.models import WritingSubmission, WritingTask


@dataclass
class CorrectionResult:
    """Standardized output structure produced by any correction provider."""

    provider: CorrectionProviderType
    score: float
    estimated_level: str
    strengths: list[str] = field(default_factory=list)
    weaknesses: list[str] = field(default_factory=list)
    comments: str = ""
    corrected_content: str | None = None
    recommendations: list[str] = field(default_factory=list)


class CorrectionProvider(ABC):
    """Abstract interface for automated and human correction mechanisms."""

    @abstractmethod
    async def evaluate(
        self,
        submission: WritingSubmission,
        text_content: str,
        task: WritingTask,
    ) -> CorrectionResult:
        """Evaluate submission and generate feedback."""
