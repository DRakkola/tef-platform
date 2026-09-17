"""AI correction provider interface for future LLM integration."""

from app.core.exceptions import AppException
from app.modules.writing.enums import CorrectionProviderType
from app.modules.writing.models import WritingSubmission, WritingTask
from app.modules.writing.providers.base import CorrectionProvider, CorrectionResult


class AICorrectionProvider(CorrectionProvider):
    """Interface for autonomous AI correction without requiring active paid vendor dependencies."""

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key

    async def evaluate(
        self,
        submission: WritingSubmission,
        text_content: str,
        task: WritingTask,
    ) -> CorrectionResult:
        """Evaluate submission via AI.

        Currently unconfigured in local baseline until AI vendor credentials are provided.
        """
        if not self.api_key:
            raise AppException(
                message="AI correction provider is not currently configured with an active API provider key.",
                code="AI_PROVIDER_NOT_CONFIGURED",
                status_code=503,
            )

        # Placeholder structure for when external AI vendor is configured
        return CorrectionResult(
            provider=CorrectionProviderType.AI,
            score=70.0,
            estimated_level="B2",
            strengths=["Texte cohérent et compréhensible"],
            weaknesses=["Vocabulaire à diversifier"],
            comments="Correction générée par modèle d'intelligence artificielle.",
            corrected_content=text_content,
            recommendations=["Pratiquez l'utilisation de connecteurs logiques complexes."],
        )
