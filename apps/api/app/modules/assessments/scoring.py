"""Isolated, testable scoring engine for the generic assessment domain."""

import uuid
from dataclasses import dataclass, field
from typing import Any

from app.modules.assessments.enums import ScoringPolicy, ScoringStatus
from app.modules.assessments.models import Assessment, AttemptAnswer, Question
from app.modules.assessments.scoring_strategies import ScoringStrategyRegistry


@dataclass
class SkillScoreDetail:
    earned: float = 0.0
    max: float = 0.0
    percentage: float = 0.0
    subskills: dict[str, dict[str, float]] = field(default_factory=dict)


@dataclass
class ScoreCalculationResult:
    total_points: float
    max_points: float
    percentage: float
    is_passed: bool | None
    estimated_level: str
    skill_scores: dict[str, Any]
    evaluated_answers: list[AttemptAnswer]
    scoring_algorithm_version: str = "v2"


def extract_question_data(
    question: Question,
    snapshot: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Extract question data either from delivered QuestionVersion snapshot or live question model."""
    if snapshot:
        points_val = float(snapshot.get("points", question.points))
        resp_type = snapshot.get("response_type")
        if not resp_type:
            if getattr(question, "response_type", None):
                resp_type = (
                    question.response_type.value
                    if hasattr(question.response_type, "value")
                    else str(question.response_type)
                )
            else:
                resp_type = (
                    question.question_type.value
                    if hasattr(question.question_type, "value")
                    else str(question.question_type)
                )
        elif hasattr(resp_type, "value"):
            resp_type = resp_type.value

        return {
            "id": str(question.id),
            "points": points_val,
            "response_type": str(resp_type),
            "options": snapshot.get("options", []),
            "scoring_payload": snapshot.get("scoring_payload") or getattr(question, "scoring_payload", None) or {},
        }

    # Use live Question ORM object
    options_data = [
        {
            "id": str(opt.id),
            "content": opt.content,
            "is_correct": opt.is_correct,
            "order_index": opt.order_index,
            "misconception_type": getattr(opt, "misconception_type", None),
            "distractor_rationale": getattr(opt, "distractor_rationale", None),
        }
        for opt in question.options
    ]

    resp_type = getattr(question, "response_type", None)
    if resp_type:
        resp_type_val = resp_type.value if hasattr(resp_type, "value") else str(resp_type)
    else:
        resp_type_val = (
            question.question_type.value
            if hasattr(question.question_type, "value")
            else str(question.question_type)
        )

    return {
        "id": str(question.id),
        "points": float(question.points),
        "response_type": resp_type_val,
        "options": options_data,
        "scoring_payload": getattr(question, "scoring_payload", None) or {},
    }


class ScoringEngine:
    """Evaluates question answers and calculates aggregate and skill-based performance."""

    @staticmethod
    def estimate_cefr_level(percentage: float) -> str:
        """Map percentage score to CEFR level benchmark using canonical level estimation."""
        from app.modules.learning.levels import LevelEstimationService

        return LevelEstimationService.estimate_cefr(percentage)

    @classmethod
    def calculate_score(
        cls,
        assessment: Assessment,
        answers: list[AttemptAnswer],
    ) -> ScoreCalculationResult:
        """Evaluate submitted answers against assessment questions and return complete score result."""
        # Index answers by question_id
        answer_map: dict[uuid.UUID, AttemptAnswer] = {ans.question_id: ans for ans in answers}

        total_points: float = 0.0
        max_points: float = 0.0
        evaluated_answers: list[AttemptAnswer] = []

        # Track skill-level metrics
        skill_tracker: dict[str, SkillScoreDetail] = {}

        for section in assessment.sections:
            for question in section.questions:
                q_points = float(question.points)
                max_points += q_points

                # Track skill max points — use canonical skill_id as key
                for tag in question.skill_tags:
                    tag_weight = float(getattr(tag, "weight", 1.0))
                    skill_code = str(tag.skill_id)
                    if skill_code not in skill_tracker:
                        skill_tracker[skill_code] = SkillScoreDetail()
                    skill_tracker[skill_code].max += q_points * tag_weight

                    # Maintain subskill breakdown by subskill_id or legacy subskill string
                    sub_key = str(getattr(tag, "subskill_id", None) or getattr(tag, "subskill", None) or "")
                    if sub_key:
                        sub = skill_tracker[skill_code].subskills.setdefault(
                            sub_key, {"earned": 0.0, "max": 0.0}
                        )
                        sub["max"] += q_points * tag_weight

                answer = answer_map.get(question.id)

                # Resolve snapshot payload if version is bound
                snapshot: dict[str, Any] | None = None
                if answer and getattr(answer, "question_version", None):
                    snapshot = answer.question_version.snapshot_payload

                q_data = extract_question_data(question, snapshot=snapshot)
                strategy = ScoringStrategyRegistry.get_strategy(q_data["response_type"])

                if not answer:
                    # Unanswered question
                    unanswered = AttemptAnswer(
                        question_id=question.id,
                        is_correct=False,
                        points_awarded=0.0,
                        scoring_status=ScoringStatus.MISSING.value,
                    )
                    evaluated_answers.append(unanswered)
                    continue

                # Evaluate using strategy
                result = strategy.score(q_data, answer)
                answer.is_correct = result.is_correct
                answer.points_awarded = result.raw_score
                answer.scoring_status = result.scoring_status.value
                total_points += result.raw_score
                evaluated_answers.append(answer)

                # Track skill earned points — only if correct or partial
                if result.is_correct is True or result.scoring_status == ScoringStatus.PARTIAL and result.raw_score > 0.0:
                    for tag in question.skill_tags:
                        tag_weight = float(getattr(tag, "weight", 1.0))
                        skill_code = str(tag.skill_id)
                        skill_tracker[skill_code].earned += result.raw_score * tag_weight

                        sub_key = str(getattr(tag, "subskill_id", None) or getattr(tag, "subskill", None) or "")
                        if sub_key and sub_key in skill_tracker[skill_code].subskills:
                            skill_tracker[skill_code].subskills[sub_key]["earned"] += (
                                result.raw_score * tag_weight
                            )

        # Apply scoring policy adjustment if needed
        if assessment.scoring_policy == ScoringPolicy.STANDARD_POINTS:
            pass  # Standard raw points

        percentage = round((total_points / max_points * 100.0), 2) if max_points > 0 else 0.0
        estimated_level = cls.estimate_cefr_level(percentage)

        is_passed: bool | None = None
        if assessment.pass_percentage is not None:
            is_passed = percentage >= assessment.pass_percentage

        # Build serialized skill scores
        skill_scores: dict[str, Any] = {}
        for code, detail in skill_tracker.items():
            pct = round((detail.earned / detail.max * 100.0), 2) if detail.max > 0 else 0.0
            sub_dict: dict[str, Any] = {}
            for sub_name, sub_vals in detail.subskills.items():
                sub_pct = (
                    round((sub_vals["earned"] / sub_vals["max"] * 100.0), 2)
                    if sub_vals["max"] > 0
                    else 0.0
                )
                sub_dict[sub_name] = {
                    "earned": sub_vals["earned"],
                    "max": sub_vals["max"],
                    "percentage": sub_pct,
                }
            skill_scores[code] = {
                "earned": detail.earned,
                "max": detail.max,
                "percentage": pct,
                "subskills": sub_dict,
            }

        return ScoreCalculationResult(
            total_points=total_points,
            max_points=max_points,
            percentage=percentage,
            is_passed=is_passed,
            estimated_level=estimated_level,
            skill_scores=skill_scores,
            evaluated_answers=evaluated_answers,
            scoring_algorithm_version="v2",
        )
