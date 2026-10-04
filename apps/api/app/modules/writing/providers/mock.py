"""Deterministic mock correction provider for local development and unit tests."""

import re

from app.modules.writing.enums import CorrectionProviderType
from app.modules.writing.models import WritingSubmission, WritingTask
from app.modules.writing.providers.base import CorrectionProvider, CorrectionResult
from app.modules.writing.utils import count_words_french


class MockCorrectionProvider(CorrectionProvider):
    """Rule-based deterministic correction provider for automated evaluation without LLM costs."""

    async def evaluate(
        self,
        submission: WritingSubmission,
        text_content: str,
        task: WritingTask,
    ) -> CorrectionResult:
        word_count = count_words_french(text_content)
        strengths: list[str] = []
        weaknesses: list[str] = []
        recommendations: list[str] = []

        base_score = 75.0

        # 1. Word count constraint evaluation
        if word_count < task.min_words:
            deficit = task.min_words - word_count
            penalty = min(30.0, (deficit / max(1, task.min_words)) * 40.0)
            base_score -= penalty
            weaknesses.append(
                f"Longueur insuffisante : {word_count} mots rédigés (minimum requis : {task.min_words} mots)."
            )
            recommendations.append(
                "Développez davantage vos arguments et exemples pour atteindre le volume attendu."
            )
        elif word_count > task.max_words + 20:
            base_score -= 5.0
            weaknesses.append(
                f"Dépassement de la consigne : {word_count} mots (maximum conseillé : {task.max_words} mots)."
            )
            recommendations.append(
                "Apprenez à synthétiser vos idées pour respecter les limites imposées au TEF."
            )
        else:
            base_score += 10.0
            strengths.append(f"Volume respecté avec précision ({word_count} mots).")

        # 2. Paragraph and discourse structure evaluation
        paragraphs = [p.strip() for p in text_content.split("\n") if p.strip()]
        if len(paragraphs) >= 3:
            strengths.append(
                "Structure textuelle claire avec introduction, développement et conclusion distincts."
            )
            base_score += 5.0
        else:
            weaknesses.append(
                "Organisation visuelle dense ; aérez votre texte en plusieurs paragraphes."
            )
            recommendations.append("Structurez votre devoir en au moins 3 paragraphes distincts.")

        # 3. Logical connectors check
        common_connectors = [
            "en effet",
            "cependant",
            "toutefois",
            "de plus",
            "en outre",
            "d'une part",
            "d'autre part",
            "en conclusion",
            "par conséquent",
            "ainsi",
        ]
        found_connectors = [
            c
            for c in common_connectors
            if re.search(r"\b" + re.escape(c) + r"\b", text_content, re.IGNORECASE)
        ]
        if len(found_connectors) >= 2:
            strengths.append(
                f"Bon usage des connecteurs logiques ({', '.join(found_connectors[:3])})."
            )
            base_score += 5.0
        else:
            weaknesses.append(
                "Peu de connecteurs logiques pour articuler la progression des arguments."
            )
            recommendations.append(
                "Enrichissez les transitions entre vos phrases avec des mots de liaison variés."
            )

        final_score = round(max(10.0, min(100.0, base_score)), 1)

        # CEFR level estimation based on final score
        if final_score >= 85.0:
            level = "C1"
        elif final_score >= 70.0:
            level = "B2"
        elif final_score >= 55.0:
            level = "B1"
        elif final_score >= 40.0:
            level = "A2"
        else:
            level = "A1"

        comments = (
            f"Évaluation automatisée du devoir TEF. Score global : {final_score}/100. "
            f"Niveau estimé : {level}. Le candidat démontre une bonne compréhension du sujet avec {word_count} mots."
        )

        # Compute criterion breakdown
        tc_score = round(max(30.0, min(100.0, 85.0 if task.min_words <= word_count <= task.max_words + 20 else 60.0)), 1)
        coh_score = round(max(30.0, min(100.0, 80.0 if len(paragraphs) >= 3 and len(found_connectors) >= 2 else 65.0)), 1)

        return CorrectionResult(
            provider=CorrectionProviderType.MOCK,
            score=final_score,
            estimated_level=level,
            strengths=strengths,
            weaknesses=weaknesses,
            comments=comments,
            corrected_content=text_content,  # In mock, returns verified copy
            recommendations=recommendations,
            task_completion=tc_score,
            coherence=coh_score,
            vocabulary=final_score,
            grammar=final_score,
            syntax=final_score,
            spelling=final_score,
            register=80.0,
        )
