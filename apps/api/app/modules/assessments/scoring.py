"""Isolated, testable scoring engine for the generic assessment domain."""

import uuid
from dataclasses import dataclass, field
from typing import Any

from app.modules.assessments.enums import CEFRLevel, QuestionType, ScoringPolicy
from app.modules.assessments.models import Assessment, AttemptAnswer


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


class ScoringEngine:
    """Evaluates question answers and calculates aggregate and skill-based performance."""

    @staticmethod
    def estimate_cefr_level(percentage: float) -> str:
        """Map percentage score to CEFR level benchmark."""
        if percentage >= 90.0:
            return CEFRLevel.C2.value
        if percentage >= 75.0:
            return CEFRLevel.C1.value
        if percentage >= 60.0:
            return CEFRLevel.B2.value
        if percentage >= 45.0:
            return CEFRLevel.B1.value
        if percentage >= 30.0:
            return CEFRLevel.A2.value
        return CEFRLevel.A1.value

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

                # Track skill max points
                for tag in question.skill_tags:
                    skill_code = tag.subskill if tag.subskill else str(tag.skill_id)
                    if skill_code not in skill_tracker:
                        skill_tracker[skill_code] = SkillScoreDetail()
                    skill_tracker[skill_code].max += q_points

                    if tag.subskill:
                        sub = skill_tracker[skill_code].subskills.setdefault(
                            tag.subskill, {"earned": 0.0, "max": 0.0}
                        )
                        sub["max"] += q_points

                answer = answer_map.get(question.id)
                if not answer:
                    # Unanswered question
                    evaluated_answers.append(
                        AttemptAnswer(
                            question_id=question.id,
                            is_correct=False,
                            points_awarded=0.0,
                        )
                    )
                    continue

                is_correct = False
                points_awarded = 0.0

                if question.question_type == QuestionType.SINGLE_CHOICE:
                    correct_option_ids = {opt.id for opt in question.options if opt.is_correct}
                    if (
                        answer.selected_option_id
                        and answer.selected_option_id in correct_option_ids
                    ):
                        is_correct = True
                        points_awarded = q_points

                elif question.question_type == QuestionType.MULTIPLE_CHOICE:
                    correct_opt_str_ids = {
                        str(opt.id) for opt in question.options if opt.is_correct
                    }
                    selected_ids = {str(opt_id) for opt_id in (answer.selected_option_ids or [])}
                    if selected_ids and selected_ids == correct_opt_str_ids:
                        is_correct = True
                        points_awarded = q_points

                elif question.question_type == QuestionType.TEXT_INPUT:
                    acceptable_answers = {
                        opt.content.strip().lower() for opt in question.options if opt.is_correct
                    }
                    if (
                        answer.text_response
                        and answer.text_response.strip().lower() in acceptable_answers
                    ):
                        is_correct = True
                        points_awarded = q_points

                answer.is_correct = is_correct
                answer.points_awarded = points_awarded
                total_points += points_awarded
                evaluated_answers.append(answer)

                # Track skill earned points
                if is_correct:
                    for tag in question.skill_tags:
                        skill_code = tag.subskill if tag.subskill else str(tag.skill_id)
                        skill_tracker[skill_code].earned += points_awarded
                        if tag.subskill and tag.subskill in skill_tracker[skill_code].subskills:
                            skill_tracker[skill_code].subskills[tag.subskill]["earned"] += (
                                points_awarded
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
        )
