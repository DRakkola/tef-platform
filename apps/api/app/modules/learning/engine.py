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

    MASTERY_ALGORITHM_VERSION: str = "v1"

    @classmethod
    def update_mastery(
        cls,
        current_mastery: float,
        attempts_count: int,
        new_score: float,
        source_type: str = "assessment",
        days_since_last: float = 0.0,
        weight: float = 1.0,
        strategy: str = "v1",
    ) -> tuple[float, float]:
        """Compute updated mastery score and confidence.

        Isolates calculation strategy behind an explicit version contract.
        strategy='v1': Exponential moving average (0.6 * prior + 0.4 * new)
        strategy='v2': Weighted Bayesian moving average taking source and item weight into account
        Returns (new_mastery, confidence).
        """
        attempts = attempts_count + 1

        if strategy == "v1":
            if attempts_count == 0:
                new_mastery = round(new_score, 2)
            else:
                # 60% historical weight + 40% latest assessment score
                new_mastery = round(0.6 * current_mastery + 0.4 * new_score, 2)

            new_mastery = max(0.0, min(100.0, new_mastery))
            confidence = round(min(1.0, attempts * 0.25), 2)
            return new_mastery, confidence

        # strategy == "v2"
        src_weight = cls.get_source_weight(source_type)
        rec_weight = cls.calculate_recency_weight(days_since_last)
        eff_weight = src_weight * rec_weight * max(0.1, min(1.0, weight))

        if attempts_count == 0:
            prior_weight = cls.PRIOR_WEIGHT
            new_mastery = round(
                (cls.PRIOR_MEAN * prior_weight + new_score * eff_weight) / (prior_weight + eff_weight),
                2,
            )
        else:
            alpha = max(0.1, min(0.9, 0.4 * eff_weight))
            new_mastery = round((1.0 - alpha) * current_mastery + alpha * new_score, 2)

        new_mastery = max(0.0, min(100.0, new_mastery))
        confidence, _, _ = cls.calculate_confidence(
            attempts_count=attempts,
            source_types={source_type},
            days_since_last=days_since_last,
        )
        return new_mastery, confidence

    @classmethod
    def calculate_parent_rollup(
        cls,
        children_metrics: list[dict[str, Any]],
        total_children_count: int | None = None,
    ) -> dict[str, Any]:
        """Generate container/parent competency score according to explicit roll-up rules.

        children_metrics: list of dicts with:
            - 'pts_earned': float (points earned in child skill)
            - 'pts_max': float (max points possible for child skill)
            - 'mastery_score': float (child mastery score 0-100)
            - 'confidence': float (child confidence 0-1)
            - 'weight': float (optional child weight, default 1.0)
        """
        if not children_metrics:
            return {
                "pts_earned": 0.0,
                "pts_max": 0.0,
                "score_pct": 0.0,
                "mastery_score": 0.0,
                "confidence": 0.0,
                "confidence_label": "Calibration",
                "insufficient_data": True,
                "assessed_children_count": 0,
                "total_children_count": total_children_count or 0,
                "coverage_ratio": 0.0,
                "estimated_level": "A1",
            }

        total_earned = sum(float(c.get("pts_earned", 0.0)) for c in children_metrics)
        total_max = sum(float(c.get("pts_max", 0.0)) for c in children_metrics)
        score_pct = round((total_earned / total_max * 100.0), 2) if total_max > 0.0 else 0.0

        # Weighted mastery roll-up across children
        weighted_mastery_sum = 0.0
        mastery_weight_sum = 0.0
        conf_sum = 0.0

        for c in children_metrics:
            c_mastery = float(c.get("mastery_score", 0.0))
            c_conf = float(c.get("confidence", 0.5))
            c_weight = float(c.get("weight", 1.0))
            weight_factor = max(0.05, c_conf) * max(0.1, c_weight)

            weighted_mastery_sum += c_mastery * weight_factor
            mastery_weight_sum += weight_factor
            conf_sum += c_conf

        rollup_mastery = (
            round(weighted_mastery_sum / mastery_weight_sum, 2)
            if mastery_weight_sum > 0
            else 0.0
        )
        rollup_mastery = max(0.0, min(100.0, rollup_mastery))

        # Coverage factor: proportion of the parent competency tree assessed
        assessed_count = len(children_metrics)
        total_count = total_children_count or assessed_count
        coverage_ratio = round(min(1.0, assessed_count / max(1, total_count)), 2)

        # Parent confidence = average child confidence scaled by coverage ratio
        avg_child_conf = conf_sum / assessed_count if assessed_count > 0 else 0.0
        rollup_confidence = round(avg_child_conf * coverage_ratio, 2)

        insufficient_data = rollup_confidence < 0.25 or assessed_count < 1
        if insufficient_data:
            label = "Calibration"
        elif rollup_confidence >= 0.75:
            label = "High"
        elif rollup_confidence >= 0.50:
            label = "Medium"
        else:
            label = "Low"

        estimated_level = LevelEstimationService.estimate_cefr(rollup_mastery)

        return {
            "pts_earned": round(total_earned, 2),
            "pts_max": round(total_max, 2),
            "score_pct": score_pct,
            "mastery_score": rollup_mastery,
            "confidence": rollup_confidence,
            "confidence_label": label,
            "insufficient_data": insufficient_data,
            "assessed_children_count": assessed_count,
            "total_children_count": total_count,
            "coverage_ratio": coverage_ratio,
            "estimated_level": estimated_level,
        }

    @classmethod
    def project_mastery_from_evidence(
        cls,
        evidences: list[Any],
        now: datetime.datetime | None = None,
        strategy: str = "v1",
    ) -> dict[str, Any]:
        """Derive student skill metrics from historical immutable evidence stream.

        Implements full tracking:
        - attempts
        - accuracy
        - mastery
        - confidence
        - recency
        - evidence count
        - estimated level
        - last assessed time
        """
        now = now or datetime.datetime.now(datetime.UTC)
        if not evidences:
            return {
                "mastery_score": 0.0,
                "confidence": 0.0,
                "confidence_label": "Calibration",
                "insufficient_data": True,
                "attempts_count": 0,
                "successful_attempts": 0,
                "accuracy": 0.0,
                "recency_days": None,
                "evidence_count": 0,
                "estimated_level": "A1",
                "last_assessed_at": None,
                "strategy": strategy,
            }

        def _to_utc(dt: datetime.datetime) -> datetime.datetime:
            return dt if dt.tzinfo else dt.replace(tzinfo=datetime.UTC)

        now_dt = _to_utc(now)
        sorted_evs = sorted(evidences, key=lambda e: _to_utc(e.observed_at))

        successful_count = sum(1 for e in sorted_evs if float(e.normalized_score) >= 65.0)
        attempts_count = len(sorted_evs)
        accuracy = round(successful_count / attempts_count, 2) if attempts_count > 0 else 0.0

        latest_dt = _to_utc(sorted_evs[-1].observed_at)
        recency_days = round(max(0.0, (now_dt - latest_dt).total_seconds() / 86400.0), 1)

        if strategy == "v1":
            # Apply rolling V1 formula chronologically across evidence
            mastery = 0.0
            for i, ev in enumerate(sorted_evs):
                score = float(ev.normalized_score)
                if i == 0:
                    mastery = score
                else:
                    mastery = 0.6 * mastery + 0.4 * score
            mastery = round(max(0.0, min(100.0, mastery)), 2)
            confidence = round(min(1.0, attempts_count * 0.25), 2)
            insufficient = attempts_count < 2 or confidence < 0.25
            label = (
                "Calibration"
                if insufficient
                else ("High" if confidence >= 0.75 else "Medium" if confidence >= 0.50 else "Low")
            )
        else:
            # V2 Bayesian time-decay
            history_payload = [
                {
                    "score": float(e.normalized_score),
                    "source_type": e.source_type,
                    "assessed_at": e.observed_at,
                }
                for e in sorted_evs
            ]
            hist_res = cls.calculate_from_history(history_payload, now=now)
            mastery = hist_res["mastery_score"]
            confidence = hist_res["confidence"]
            label = hist_res["confidence_label"]
            insufficient = hist_res["insufficient_data"]

        estimated_level = LevelEstimationService.estimate_cefr(mastery)

        return {
            "mastery_score": mastery,
            "confidence": confidence,
            "confidence_label": label,
            "insufficient_data": insufficient,
            "attempts_count": attempts_count,
            "successful_attempts": successful_count,
            "accuracy": accuracy,
            "recency_days": recency_days,
            "evidence_count": len(sorted_evs),
            "estimated_level": estimated_level,
            "last_assessed_at": sorted_evs[-1].observed_at,
            "strategy": strategy,
        }

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
