"""Deterministic learning engines: SkillEngine (Time-Decay Weighted Bayesian Moving Average) and RecommendationEngine."""

import datetime
import math
from typing import Any, ClassVar

from app.modules.learning.levels import LevelEstimationService


class SkillEngine:
    """Calculates student skill mastery estimates and confidence levels using

    a deterministic Time-Decay Weighted Bayesian Moving Average.
    """

    # Half-life of 45 days for recency weighting
    HALF_LIFE_DAYS = 45.0
    DECAY_LAMBDA = math.log(2.0) / HALF_LIFE_DAYS

    # Prior settings (Bayesian prior equivalent to 2 prior attempts at 50% baseline)
    PRIOR_MEAN = 50.0
    PRIOR_WEIGHT = 2.0

    # Source evaluation weights
    SOURCE_WEIGHTS: ClassVar[dict[str, float]] = {
        "assessment": 1.0,
        "assessment_attempt": 1.0,
        "teacher_review": 0.95,
        "ai_evaluation": 0.85,
        "exercise": 0.70,
        "exercise_attempt": 0.70,
    }

    @classmethod
    def get_source_weight(cls, source_type: str) -> float:
        """Resolve weight for a given evaluation source type."""
        norm_type = source_type.strip().lower()
        return cls.SOURCE_WEIGHTS.get(norm_type, 0.75)

    @classmethod
    def calculate_recency_weight(cls, days_ago: float) -> float:
        """Calculate exponential recency decay weight based on 45-day half-life."""
        delta = max(0.0, days_ago)
        return math.exp(-cls.DECAY_LAMBDA * delta)

    @classmethod
    def calculate_confidence(
        cls,
        attempts_count: int,
        source_types: set[str] | None = None,
        days_since_last: float = 0.0,
        base_confidence: float | None = None,
    ) -> tuple[float, str, bool]:
        """Compute calibrated confidence score, human label, and insufficient_data flag.

        Returns (confidence [0.0 - 1.0], confidence_label, insufficient_data).
        """
        if attempts_count == 0 and base_confidence is None:
            return 0.0, "Calibration", True

        if base_confidence is not None:
            total_conf = base_confidence
        else:
            # 1. Base sample count confidence (caps at 0.70 after 5 observations)
            sample_conf = min(0.70, attempts_count * 0.14)

            # 2. Source diversity bonus (+0.15 if evaluated via multiple distinct sources)
            diversity_bonus = 0.0
            if source_types and len(source_types) > 1:
                diversity_bonus = 0.15

            # 3. Inactivity decay (-0.01 per week beyond 30 days inactive, max 0.30)
            inactivity_decay = 0.0
            if days_since_last > 30.0:
                weeks_inactive = (days_since_last - 30.0) / 7.0
                inactivity_decay = min(0.30, weeks_inactive * 0.01)

            total_conf = sample_conf + diversity_bonus - inactivity_decay

        confidence = round(max(0.0, min(1.0, total_conf)), 2)

        # Calibration rule: If fewer than 2 attempts or confidence < 0.25, mark as insufficient_data
        insufficient_data = attempts_count < 2 or confidence < 0.25
        if insufficient_data:
            label = "Calibration"
        elif confidence >= 0.75:
            label = "High"
        elif confidence >= 0.50:
            label = "Medium"
        else:
            label = "Low"

        return confidence, label, insufficient_data

    @classmethod
    def update_mastery(
        cls,
        current_mastery: float,
        attempts_count: int,
        new_score: float,
        source_type: str = "assessment",
        days_since_last: float = 0.0,
    ) -> tuple[float, float]:
        """Compute updated mastery score and confidence using an exponential moving average.

        Returns (new_mastery, confidence).
        """
        attempts = attempts_count + 1

        if attempts_count == 0:
            new_mastery = round(new_score, 2)
        else:
            # 60% historical weight + 40% latest assessment score
            new_mastery = round(0.6 * current_mastery + 0.4 * new_score, 2)

        new_mastery = max(0.0, min(100.0, new_mastery))
        confidence = round(min(1.0, attempts * 0.25), 2)

        return new_mastery, confidence

    @classmethod
    def calculate_from_history(
        cls,
        assessments: list[dict[str, Any]],
        now: datetime.datetime | None = None,
    ) -> dict[str, Any]:
        """Recalculate mastery from full immutable historical SkillAssessment logs.

        assessments: list of dicts with keys 'score', 'source_type', 'assessed_at'.
        """
        now = now or datetime.datetime.now(datetime.UTC)
        if not assessments:
            return {
                "mastery_score": cls.PRIOR_MEAN,
                "confidence": 0.0,
                "confidence_label": "Calibration",
                "insufficient_data": True,
                "attempts_count": 0,
                "estimated_level": LevelEstimationService.estimate_cefr(cls.PRIOR_MEAN),
                "last_assessed_at": None,
            }

        weighted_score_sum = cls.PRIOR_WEIGHT * cls.PRIOR_MEAN
        total_weight = cls.PRIOR_WEIGHT
        source_types: set[str] = set()
        latest_assessed_at = assessments[0]["assessed_at"]

        for item in assessments:
            score = float(item["score"])
            src = str(item.get("source_type", "assessment"))
            source_types.add(src)
            assessed_at: datetime.datetime = item["assessed_at"]
            latest_assessed_at = max(latest_assessed_at, assessed_at)

            # Calculate days ago
            delta_days = max(0.0, (now - assessed_at).total_seconds() / 86400.0)
            src_weight = cls.get_source_weight(src)
            rec_weight = cls.calculate_recency_weight(delta_days)
            eff_weight = src_weight * rec_weight

            weighted_score_sum += eff_weight * score
            total_weight += eff_weight

        mastery_score = round(max(0.0, min(100.0, weighted_score_sum / total_weight)), 2)
        days_since_last = max(0.0, (now - latest_assessed_at).total_seconds() / 86400.0)

        confidence, label, insufficient = cls.calculate_confidence(
            attempts_count=len(assessments),
            source_types=source_types,
            days_since_last=days_since_last,
        )

        estimated_level = LevelEstimationService.estimate_cefr(mastery_score)

        return {
            "mastery_score": mastery_score,
            "confidence": confidence,
            "confidence_label": label,
            "insufficient_data": insufficient,
            "attempts_count": len(assessments),
            "estimated_level": estimated_level,
            "last_assessed_at": latest_assessed_at,
        }


class RecommendationEngine:
    """Deterministic recommendation engine mapping skill gaps to targeted practice."""

    MASTERY_THRESHOLD = 70.0  # Skills below 70% mastery trigger recommendations

    @staticmethod
    def calculate_priority(
        mastery_score: float,
        mistake_count: int,
        target_gap: float = 0.0,
        days_to_target: int | None = None,
    ) -> int:
        """Calculate recommendation priority (1 to 100). Higher is more urgent.

        - Base priority is inversely proportional to mastery (100 - mastery)
        - Repeated mistakes increase urgency (+10 per mistake)
        - Target gap adds urgency (+0.5 per gap point)
        - Approaching target date (<30 days) adds +15 boost
        """
        base_priority = 100.0 - mastery_score
        mistake_boost = mistake_count * 10.0
        gap_boost = target_gap * 0.5
        urgency_boost = 15.0 if (days_to_target is not None and 0 <= days_to_target <= 30) else 0.0

        total = int(base_priority + mistake_boost + gap_boost + urgency_boost)
        return max(1, min(100, total))

    @staticmethod
    def build_recommendation_reason(
        skill_name: str,
        mastery_score: float,
        mistake_count: int,
        target_level: str = "B2",
    ) -> str:
        """Build clear, deterministic explanation for why the exercise is recommended."""
        if mistake_count > 0:
            return (
                f"Score de {mastery_score:.0f}% en {skill_name} avec {mistake_count} "
                "erreur(s) identifiée(s). Exercice de renforcement recommandé."
            )
        return (
            f"Maîtrise estimée à {mastery_score:.0f}% en {skill_name} (seuil cible {target_level} : 65-70%). "
            "Entraînez-vous pour combler l'écart."
        )
