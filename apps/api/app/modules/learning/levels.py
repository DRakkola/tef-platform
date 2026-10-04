"""CEFR and NCLC level estimation service with official simulation disclaimer."""

from typing import Any

OFFICIAL_SIMULATION_DISCLAIMER = (
    "Ce niveau est une estimation indicative basée sur notre modèle d'apprentissage interne "
    "et ne constitue pas un résultat officiel TEF délivré par la CCI Paris Île-de-France."
)

CEFR_LEVEL_ORDER = {
    "A1": 1,
    "A2": 2,
    "B1": 3,
    "B2": 4,
    "C1": 5,
    "C2": 6,
}

CEFR_LEVEL_THRESHOLDS = {
    "A1": 0.0,
    "A2": 35.0,
    "B1": 50.0,
    "B2": 65.0,
    "C1": 80.0,
    "C2": 90.0,
}

NCLC_LEVEL_ORDER = {
    "NCLC 3": 1,
    "NCLC 4": 2,
    "NCLC 5": 3,
    "NCLC 6": 4,
    "NCLC 7": 5,
    "NCLC 8": 6,
    "NCLC 9": 7,
    "NCLC 10+": 8,
}


class LevelEstimationService:
    """Deterministic, rule-based level estimation service for CEFR and NCLC mappings."""

    DISCLAIMER = OFFICIAL_SIMULATION_DISCLAIMER

    @classmethod
    def estimate_cefr(cls, score: float) -> str:
        """Map percentage score (0-100) to canonical CEFR level."""
        score = max(0.0, min(100.0, float(score)))
        for level in ("C2", "C1", "B2", "B1", "A2"):
            if score >= CEFR_LEVEL_THRESHOLDS[level]:
                return level
        return "A1"

    @classmethod
    def estimate_nclc(cls, score: float, cefr: str | None = None) -> str:
        """Map percentage score and CEFR level to Canadian NCLC level."""
        score = max(0.0, min(100.0, score))
        cefr = cefr or cls.estimate_cefr(score)
        if cefr == "A1":
            return "NCLC 3"
        if cefr == "A2":
            return "NCLC 4"
        if cefr == "B1":
            return "NCLC 6" if score >= 58.0 else "NCLC 5"
        if cefr == "B2":
            return "NCLC 8" if score >= 72.0 else "NCLC 7"
        if cefr == "C1":
            return "NCLC 9"
        return "NCLC 10+"

    @classmethod
    def get_level_threshold(cls, level: str) -> float:
        """Return minimum mastery score percentage required for a given CEFR level."""
        norm_level = level.strip().upper()
        return CEFR_LEVEL_THRESHOLDS.get(norm_level, 65.0)

    @classmethod
    def calculate_level_distance(cls, current_level: str, target_level: str) -> int:
        """Compute integer level step distance between current and target CEFR level."""
        curr_order = CEFR_LEVEL_ORDER.get(current_level.strip().upper(), 1)
        target_order = CEFR_LEVEL_ORDER.get(target_level.strip().upper(), 4)
        return max(0, target_order - curr_order)

    @classmethod
    def estimate_full_profile(cls, score: float) -> dict[str, Any]:
        """Produce complete level payload with CEFR, NCLC, and mandatory disclaimer."""
        cefr = cls.estimate_cefr(score)
        nclc = cls.estimate_nclc(score, cefr)
        return {
            "estimated_cefr": cefr,
            "estimated_nclc": nclc,
            "score": round(score, 1),
            "disclaimer": cls.DISCLAIMER,
        }
