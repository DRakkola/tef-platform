"""Deterministic learning engines: SkillEngine (mastery updates) and RecommendationEngine."""


class SkillEngine:
    """Calculates student skill mastery estimates and confidence levels."""

    @staticmethod
    def update_mastery(
        current_mastery: float,
        attempts_count: int,
        new_score: float,
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
        # Confidence reaches 1.0 after 4 assessments/exercises
        confidence = round(min(1.0, attempts * 0.25), 2)

        return new_mastery, confidence


class RecommendationEngine:
    """Deterministic recommendation engine mapping skill gaps to targeted practice."""

    MASTERY_THRESHOLD = 70.0  # Skills below 70% mastery trigger recommendations

    @staticmethod
    def calculate_priority(mastery_score: float, mistake_count: int) -> int:
        """Calculate recommendation priority (1 to 100). Higher is more urgent.

        - Base priority is inversely proportional to mastery (100 - mastery)
        - Repeated mistakes increase urgency (+10 per mistake)
        """
        base_priority = int(100.0 - mastery_score)
        mistake_boost = mistake_count * 10
        total = base_priority + mistake_boost
        return max(1, min(100, total))

    @staticmethod
    def build_recommendation_reason(
        skill_name: str,
        mastery_score: float,
        mistake_count: int,
    ) -> str:
        """Build clear, deterministic explanation for why the exercise is recommended."""
        if mistake_count > 0:
            return (
                f"Score de {mastery_score:.0f}% en {skill_name} avec {mistake_count} "
                "erreur(s) identifiée(s). Exercice de renforcement recommandé."
            )
        return (
            f"Maîtrise estimée à {mastery_score:.0f}% en {skill_name} (seuil cible : 70%). "
            "Entraînez-vous pour consolider ce point."
        )
