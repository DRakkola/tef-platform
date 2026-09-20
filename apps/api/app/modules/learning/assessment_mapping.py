"""Content and methodology separation abstraction for assessment score mappings."""

from abc import ABC, abstractmethod
from typing import Any

from app.modules.learning.levels import LevelEstimationService


class AssessmentMappingProvider(ABC):
    """Abstract mapping provider decoupling internal readiness from official certification data."""

    @abstractmethod
    def map_score_to_estimate(self, normalized_score: float) -> dict[str, Any]:
        """Convert a normalized percentage score (0-100) to an estimated grade profile."""
        pass

    @abstractmethod
    def get_target_threshold(self, target_level: str) -> float:
        """Return the target threshold score for a requested level."""
        pass

    @abstractmethod
    def get_disclaimer(self) -> str:
        """Return the pedagogical and legal disclaimer."""
        pass


class InternalNormalizedMappingProvider(AssessmentMappingProvider):
    """Default internal estimation methodology based on normalized CEFR scale.

    Strictly does not claim to be an official CCI Paris TEF certification.
    """

    def map_score_to_estimate(self, normalized_score: float) -> dict[str, Any]:
        score = max(0.0, min(100.0, float(normalized_score)))
        cefr = LevelEstimationService.estimate_cefr(score)
        nclc = LevelEstimationService.estimate_nclc(score, cefr)
        return {
            "score": round(score, 1),
            "estimated_cefr": cefr,
            "estimated_nclc": nclc,
            "is_official": False,
            "disclaimer": self.get_disclaimer(),
        }

    def get_target_threshold(self, target_level: str) -> float:
        return LevelEstimationService.get_level_threshold(target_level)

    def get_disclaimer(self) -> str:
        return LevelEstimationService.DISCLAIMER


# Global singleton instance
default_mapping_provider: AssessmentMappingProvider = InternalNormalizedMappingProvider()
