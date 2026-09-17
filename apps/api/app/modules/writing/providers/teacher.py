"""Human teacher correction provider implementation."""

from app.modules.writing.enums import CorrectionProviderType
from app.modules.writing.providers.base import CorrectionResult
from app.modules.writing.schemas import TeacherCorrectionRequest


class HumanTeacherCorrectionProvider:
    """Handles teacher-authored evaluations with expert pedagogical provenance."""

    @staticmethod
    def create_result(req: TeacherCorrectionRequest) -> CorrectionResult:
        """Translate verified teacher submission payload into standardized CorrectionResult."""
        return CorrectionResult(
            provider=CorrectionProviderType.TEACHER,
            score=req.score,
            estimated_level=req.estimated_level,
            strengths=req.strengths,
            weaknesses=req.weaknesses,
            comments=req.comments,
            corrected_content=req.corrected_content,
            recommendations=req.recommendations,
        )
