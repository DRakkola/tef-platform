"""Canonical scoring strategies for Question System V2 response types."""

import unicodedata
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, ClassVar

from app.modules.assessments.enums import QuestionResponseType, ScoringStatus
from app.modules.assessments.models import AttemptAnswer


@dataclass
class ItemScoreResult:
    """Canonical grading output for an individual assessment item."""

    raw_score: float
    max_score: float
    normalized_score: float  # 0.0 - 100.0
    is_correct: bool | None
    scoring_status: ScoringStatus
    diagnostic_metadata: dict[str, Any] | None = None


def normalize_text(text: str, ignore_case: bool = True, ignore_accents: bool = False) -> str:
    """Normalize text input with whitespace collapsing, casing, and optional diacritic stripping."""
    if not text:
        return ""
    # Collapse multiple whitespaces into a single space and strip edges
    cleaned = " ".join(text.strip().split())
    if ignore_case:
        cleaned = cleaned.lower()
    if ignore_accents:
        cleaned = "".join(
            c for c in unicodedata.normalize("NFD", cleaned)
            if unicodedata.category(c) != "Mn"
        )
    return cleaned


class BaseScoringStrategy(ABC):
    """Abstract base class for all Question V2 item scoring strategies."""

    @abstractmethod
    def score(
        self,
        question_data: dict[str, Any],
        answer: AttemptAnswer | None,
    ) -> ItemScoreResult:
        """Evaluate submitted answer against question data and return ItemScoreResult."""


class SingleChoiceStrategy(BaseScoringStrategy):
    """Scoring strategy for single_choice questions (1-of-N)."""

    def score(
        self,
        question_data: dict[str, Any],
        answer: AttemptAnswer | None,
    ) -> ItemScoreResult:
        max_score = float(question_data.get("points", 1.0))
        options: list[dict[str, Any]] = question_data.get("options", [])
        correct_option_ids = {str(opt["id"]) for opt in options if opt.get("is_correct")}

        # Resolve candidate selection
        selected_id: str | None = None
        if answer:
            if answer.selected_option_id:
                selected_id = str(answer.selected_option_id)
            elif answer.selected_option_ids:
                selected_id = str(answer.selected_option_ids[0])
            elif isinstance(answer.response_payload, dict):
                sel = answer.response_payload.get("selected_option_id")
                if sel:
                    selected_id = str(sel)

        if not selected_id:
            return ItemScoreResult(
                raw_score=0.0,
                max_score=max_score,
                normalized_score=0.0,
                is_correct=False,
                scoring_status=ScoringStatus.MISSING,
            )

        if selected_id in correct_option_ids:
            return ItemScoreResult(
                raw_score=max_score,
                max_score=max_score,
                normalized_score=100.0,
                is_correct=True,
                scoring_status=ScoringStatus.CORRECT,
            )

        # Distractor diagnostic metadata
        diagnostic = None
        for opt in options:
            if str(opt.get("id")) == selected_id:
                diagnostic = {
                    "selected_option_id": selected_id,
                    "misconception_type": opt.get("misconception_type"),
                    "distractor_rationale": opt.get("distractor_rationale"),
                }
                break

        return ItemScoreResult(
            raw_score=0.0,
            max_score=max_score,
            normalized_score=0.0,
            is_correct=False,
            scoring_status=ScoringStatus.INCORRECT,
            diagnostic_metadata=diagnostic,
        )


class MultipleChoiceStrategy(BaseScoringStrategy):
    """Scoring strategy for multiple_choice questions (M-of-N)."""

    def score(
        self,
        question_data: dict[str, Any],
        answer: AttemptAnswer | None,
    ) -> ItemScoreResult:
        max_score = float(question_data.get("points", 1.0))
        options: list[dict[str, Any]] = question_data.get("options", [])
        correct_option_ids = {str(opt["id"]) for opt in options if opt.get("is_correct")}
        scoring_payload: dict[str, Any] = question_data.get("scoring_payload") or {}
        allow_partial = bool(scoring_payload.get("partial_credit", False))

        selected_ids: set[str] = set()
        if answer:
            if answer.selected_option_ids:
                selected_ids = {str(opt_id) for opt_id in answer.selected_option_ids}
            elif isinstance(answer.response_payload, list):
                selected_ids = {str(x) for x in answer.response_payload}
            elif isinstance(answer.response_payload, dict):
                ids = answer.response_payload.get("selected_option_ids") or []
                selected_ids = {str(x) for x in ids}
            elif answer.selected_option_id:
                selected_ids = {str(answer.selected_option_id)}

        if not selected_ids:
            return ItemScoreResult(
                raw_score=0.0,
                max_score=max_score,
                normalized_score=0.0,
                is_correct=False,
                scoring_status=ScoringStatus.MISSING,
            )

        if selected_ids == correct_option_ids:
            return ItemScoreResult(
                raw_score=max_score,
                max_score=max_score,
                normalized_score=100.0,
                is_correct=True,
                scoring_status=ScoringStatus.CORRECT,
            )

        if allow_partial and correct_option_ids:
            correct_selected = len(selected_ids & correct_option_ids)
            incorrect_selected = len(selected_ids - correct_option_ids)
            total_target = len(correct_option_ids)
            ratio = max(0.0, (correct_selected - incorrect_selected) / total_target)
            raw_score = round(ratio * max_score, 4)
            normalized = round(ratio * 100.0, 2)

            if raw_score >= max_score:
                status = ScoringStatus.CORRECT
                is_correct = True
            elif raw_score > 0.0:
                status = ScoringStatus.PARTIAL
                is_correct = False
            else:
                status = ScoringStatus.INCORRECT
                is_correct = False

            return ItemScoreResult(
                raw_score=raw_score,
                max_score=max_score,
                normalized_score=normalized,
                is_correct=is_correct,
                scoring_status=status,
                diagnostic_metadata={
                    "correct_selected": correct_selected,
                    "incorrect_selected": incorrect_selected,
                    "total_correct": total_target,
                },
            )

        return ItemScoreResult(
            raw_score=0.0,
            max_score=max_score,
            normalized_score=0.0,
            is_correct=False,
            scoring_status=ScoringStatus.INCORRECT,
        )


class MatchingStrategy(BaseScoringStrategy):
    """Scoring strategy for matching questions (source items to target pool)."""

    def score(
        self,
        question_data: dict[str, Any],
        answer: AttemptAnswer | None,
    ) -> ItemScoreResult:
        max_score = float(question_data.get("points", 1.0))
        scoring_payload: dict[str, Any] = question_data.get("scoring_payload") or {}

        # Resolve expected pairs
        expected_pairs: dict[str, str] = {}
        raw_pairs = scoring_payload.get("pairs") or {}
        if isinstance(raw_pairs, dict):
            expected_pairs = {str(k): str(v) for k, v in raw_pairs.items()}
        elif isinstance(raw_pairs, list):
            for item in raw_pairs:
                if isinstance(item, dict) and "source_id" in item and "target_id" in item:
                    expected_pairs[str(item["source_id"])] = str(item["target_id"])
                elif isinstance(item, (list, tuple)) and len(item) == 2:
                    expected_pairs[str(item[0])] = str(item[1])

        # Candidate mapping
        submitted_pairs: dict[str, str] = {}
        if answer and answer.response_payload:
            payload = answer.response_payload
            if isinstance(payload, dict):
                submitted_pairs = {str(k): str(v) for k, v in payload.items()}
            elif isinstance(payload, list):
                for item in payload:
                    if isinstance(item, dict) and "source_id" in item and "target_id" in item:
                        submitted_pairs[str(item["source_id"])] = str(item["target_id"])
                    elif isinstance(item, (list, tuple)) and len(item) == 2:
                        submitted_pairs[str(item[0])] = str(item[1])

        if not submitted_pairs:
            return ItemScoreResult(
                raw_score=0.0,
                max_score=max_score,
                normalized_score=0.0,
                is_correct=False,
                scoring_status=ScoringStatus.MISSING,
            )

        total_pairs = len(expected_pairs)
        if total_pairs == 0:
            return ItemScoreResult(
                raw_score=max_score,
                max_score=max_score,
                normalized_score=100.0,
                is_correct=True,
                scoring_status=ScoringStatus.CORRECT,
            )

        matches = sum(
            1 for src, tgt in expected_pairs.items()
            if submitted_pairs.get(src) == tgt
        )
        ratio = matches / total_pairs
        raw_score = round(ratio * max_score, 4)
        normalized = round(ratio * 100.0, 2)

        if matches == total_pairs:
            status = ScoringStatus.CORRECT
            is_correct = True
        elif matches > 0:
            status = ScoringStatus.PARTIAL
            is_correct = False
        else:
            status = ScoringStatus.INCORRECT
            is_correct = False

        return ItemScoreResult(
            raw_score=raw_score,
            max_score=max_score,
            normalized_score=normalized,
            is_correct=is_correct,
            scoring_status=status,
            diagnostic_metadata={
                "matches": matches,
                "total_pairs": total_pairs,
            },
        )


class OrderingStrategy(BaseScoringStrategy):
    """Scoring strategy for ordering questions (sequence permutation)."""

    def score(
        self,
        question_data: dict[str, Any],
        answer: AttemptAnswer | None,
    ) -> ItemScoreResult:
        max_score = float(question_data.get("points", 1.0))
        scoring_payload: dict[str, Any] = question_data.get("scoring_payload") or {}
        allow_partial = bool(scoring_payload.get("partial_credit", True))

        # Expected sequence
        expected_seq: list[str] = []
        if scoring_payload.get("sequence"):
            expected_seq = [str(x) for x in scoring_payload["sequence"]]
        else:
            options = question_data.get("options", [])
            sorted_opts = sorted(options, key=lambda o: o.get("order_index", 0))
            expected_seq = [str(o["id"]) for o in sorted_opts]

        # Submitted sequence
        submitted_seq: list[str] = []
        if answer and answer.response_payload:
            payload = answer.response_payload
            if isinstance(payload, list):
                submitted_seq = [str(x) for x in payload]
            elif isinstance(payload, dict) and "sequence" in payload:
                submitted_seq = [str(x) for x in payload["sequence"]]

        if not submitted_seq:
            return ItemScoreResult(
                raw_score=0.0,
                max_score=max_score,
                normalized_score=0.0,
                is_correct=False,
                scoring_status=ScoringStatus.MISSING,
            )

        if submitted_seq == expected_seq:
            return ItemScoreResult(
                raw_score=max_score,
                max_score=max_score,
                normalized_score=100.0,
                is_correct=True,
                scoring_status=ScoringStatus.CORRECT,
            )

        if allow_partial and expected_seq:
            pos_matches = sum(
                1 for i, item_id in enumerate(submitted_seq)
                if i < len(expected_seq) and item_id == expected_seq[i]
            )
            ratio = pos_matches / len(expected_seq)
            raw_score = round(ratio * max_score, 4)
            normalized = round(ratio * 100.0, 2)

            if pos_matches == len(expected_seq):
                status = ScoringStatus.CORRECT
                is_correct = True
            elif pos_matches > 0:
                status = ScoringStatus.PARTIAL
                is_correct = False
            else:
                status = ScoringStatus.INCORRECT
                is_correct = False

            return ItemScoreResult(
                raw_score=raw_score,
                max_score=max_score,
                normalized_score=normalized,
                is_correct=is_correct,
                scoring_status=status,
                diagnostic_metadata={
                    "positional_matches": pos_matches,
                    "total_items": len(expected_seq),
                },
            )

        return ItemScoreResult(
            raw_score=0.0,
            max_score=max_score,
            normalized_score=0.0,
            is_correct=False,
            scoring_status=ScoringStatus.INCORRECT,
        )


class GapFillStrategy(BaseScoringStrategy):
    """Scoring strategy for gap_fill questions with multiple discrete blanks."""

    def score(
        self,
        question_data: dict[str, Any],
        answer: AttemptAnswer | None,
    ) -> ItemScoreResult:
        max_score = float(question_data.get("points", 1.0))
        scoring_payload: dict[str, Any] = question_data.get("scoring_payload") or {}
        ignore_case = bool(scoring_payload.get("ignore_case", True))
        ignore_accents = bool(scoring_payload.get("ignore_accents", False))

        # Expected gaps dictionary: {gap_key: [accepted_variants]}
        expected_gaps: dict[str, list[str]] = {}
        raw_gaps = scoring_payload.get("gaps") or scoring_payload.get("gap_solutions") or {}
        if isinstance(raw_gaps, dict):
            for k, v in raw_gaps.items():
                if isinstance(v, list):
                    expected_gaps[str(k)] = [str(x) for x in v]
                else:
                    expected_gaps[str(k)] = [str(v)]
        elif isinstance(raw_gaps, list):
            for i, item in enumerate(raw_gaps):
                gap_key = f"gap_{i + 1}"
                if isinstance(item, list):
                    expected_gaps[gap_key] = [str(x) for x in item]
                else:
                    expected_gaps[gap_key] = [str(item)]

        # Candidate submissions: {gap_key: text}
        submitted_gaps: dict[str, str] = {}
        if answer:
            if isinstance(answer.response_payload, dict):
                submitted_gaps = {str(k): str(v) for k, v in answer.response_payload.items()}
            elif isinstance(answer.response_payload, list):
                submitted_gaps = {f"gap_{i + 1}": str(v) for i, v in enumerate(answer.response_payload)}
            elif answer.text_response:
                # Single gap fallback
                submitted_gaps = {"gap_1": answer.text_response}

        if not submitted_gaps:
            return ItemScoreResult(
                raw_score=0.0,
                max_score=max_score,
                normalized_score=0.0,
                is_correct=False,
                scoring_status=ScoringStatus.MISSING,
            )

        if not expected_gaps:
            return ItemScoreResult(
                raw_score=max_score,
                max_score=max_score,
                normalized_score=100.0,
                is_correct=True,
                scoring_status=ScoringStatus.CORRECT,
            )

        correct_gaps = 0
        total_gaps = len(expected_gaps)

        for gap_key, accepted_list in expected_gaps.items():
            user_val = submitted_gaps.get(gap_key, "")
            norm_user = normalize_text(user_val, ignore_case=ignore_case, ignore_accents=ignore_accents)
            norm_accepted = [
                normalize_text(acc, ignore_case=ignore_case, ignore_accents=ignore_accents)
                for acc in accepted_list
            ]
            if norm_user in norm_accepted:
                correct_gaps += 1

        ratio = correct_gaps / total_gaps if total_gaps > 0 else 0.0
        raw_score = round(ratio * max_score, 4)
        normalized = round(ratio * 100.0, 2)

        if correct_gaps == total_gaps:
            status = ScoringStatus.CORRECT
            is_correct = True
        elif correct_gaps > 0:
            status = ScoringStatus.PARTIAL
            is_correct = False
        else:
            status = ScoringStatus.INCORRECT
            is_correct = False

        return ItemScoreResult(
            raw_score=raw_score,
            max_score=max_score,
            normalized_score=normalized,
            is_correct=is_correct,
            scoring_status=status,
            diagnostic_metadata={
                "correct_gaps": correct_gaps,
                "total_gaps": total_gaps,
            },
        )


class ShortTextStrategy(BaseScoringStrategy):
    """Scoring strategy for short_text questions (exact/regex match with accepted variants)."""

    def score(
        self,
        question_data: dict[str, Any],
        answer: AttemptAnswer | None,
    ) -> ItemScoreResult:
        max_score = float(question_data.get("points", 1.0))
        scoring_payload: dict[str, Any] = question_data.get("scoring_payload") or {}
        ignore_case = bool(scoring_payload.get("ignore_case", True))
        ignore_accents = bool(scoring_payload.get("ignore_accents", False))

        # Check for accepted answers in scoring_payload or correct options
        accepted_answers: list[str] = []
        if scoring_payload.get("accepted_answers"):
            raw_acc = scoring_payload["accepted_answers"]
            if isinstance(raw_acc, list):
                accepted_answers = [str(x) for x in raw_acc]
            else:
                accepted_answers = [str(raw_acc)]
        else:
            options = question_data.get("options", [])
            accepted_answers = [opt["content"] for opt in options if opt.get("is_correct")]

        # If no accepted answers are defined, this is open-ended short text requiring manual/AI evaluation
        if not accepted_answers:
            return ItemScoreResult(
                raw_score=0.0,
                max_score=max_score,
                normalized_score=0.0,
                is_correct=None,
                scoring_status=ScoringStatus.PENDING_EVALUATION,
                diagnostic_metadata={"evaluation_pipeline": "writing_evaluator"},
            )

        # Candidate text
        user_text: str | None = None
        if answer:
            if answer.text_response:
                user_text = answer.text_response
            elif isinstance(answer.response_payload, dict):
                user_text = answer.response_payload.get("text")
            elif isinstance(answer.response_payload, str):
                user_text = answer.response_payload

        if not user_text:
            return ItemScoreResult(
                raw_score=0.0,
                max_score=max_score,
                normalized_score=0.0,
                is_correct=False,
                scoring_status=ScoringStatus.MISSING,
            )

        norm_user = normalize_text(user_text, ignore_case=ignore_case, ignore_accents=ignore_accents)
        norm_accepted = [
            normalize_text(a, ignore_case=ignore_case, ignore_accents=ignore_accents)
            for a in accepted_answers
        ]

        if norm_user in norm_accepted:
            return ItemScoreResult(
                raw_score=max_score,
                max_score=max_score,
                normalized_score=100.0,
                is_correct=True,
                scoring_status=ScoringStatus.CORRECT,
            )

        return ItemScoreResult(
            raw_score=0.0,
            max_score=max_score,
            normalized_score=0.0,
            is_correct=False,
            scoring_status=ScoringStatus.INCORRECT,
            diagnostic_metadata={"submitted_normalized": norm_user},
        )


class LongTextStrategy(BaseScoringStrategy):
    """Scoring strategy for long_text (writing tasks evaluated asynchronously)."""

    def score(
        self,
        question_data: dict[str, Any],
        answer: AttemptAnswer | None,
    ) -> ItemScoreResult:
        max_score = float(question_data.get("points", 1.0))
        has_text = bool(answer and (answer.text_response or answer.response_payload))
        if not has_text:
            return ItemScoreResult(
                raw_score=0.0,
                max_score=max_score,
                normalized_score=0.0,
                is_correct=False,
                scoring_status=ScoringStatus.MISSING,
            )
        return ItemScoreResult(
            raw_score=0.0,
            max_score=max_score,
            normalized_score=0.0,
            is_correct=None,
            scoring_status=ScoringStatus.PENDING_EVALUATION,
            diagnostic_metadata={"evaluation_pipeline": "writing_evaluator"},
        )


class SpokenResponseStrategy(BaseScoringStrategy):
    """Scoring strategy for spoken_response (oral tasks evaluated asynchronously)."""

    def score(
        self,
        question_data: dict[str, Any],
        answer: AttemptAnswer | None,
    ) -> ItemScoreResult:
        max_score = float(question_data.get("points", 1.0))
        has_audio = bool(answer and (answer.text_response or answer.response_payload))
        if not has_audio:
            return ItemScoreResult(
                raw_score=0.0,
                max_score=max_score,
                normalized_score=0.0,
                is_correct=False,
                scoring_status=ScoringStatus.MISSING,
            )
        return ItemScoreResult(
            raw_score=0.0,
            max_score=max_score,
            normalized_score=0.0,
            is_correct=None,
            scoring_status=ScoringStatus.PENDING_EVALUATION,
            diagnostic_metadata={"evaluation_pipeline": "speaking_evaluator"},
        )


class InteractionStrategy(BaseScoringStrategy):
    """Scoring strategy for interaction (realtime spoken or interactive roleplay)."""

    def score(
        self,
        question_data: dict[str, Any],
        answer: AttemptAnswer | None,
    ) -> ItemScoreResult:
        max_score = float(question_data.get("points", 1.0))
        return ItemScoreResult(
            raw_score=0.0,
            max_score=max_score,
            normalized_score=0.0,
            is_correct=None,
            scoring_status=ScoringStatus.PENDING_EVALUATION,
            diagnostic_metadata={"evaluation_pipeline": "interaction_evaluator"},
        )


class ScoringStrategyRegistry:
    """Registry providing strategy resolution for all question response types."""

    _strategies: ClassVar[dict[str, BaseScoringStrategy]] = {
        QuestionResponseType.SINGLE_CHOICE.value: SingleChoiceStrategy(),
        QuestionResponseType.MULTIPLE_CHOICE.value: MultipleChoiceStrategy(),
        QuestionResponseType.MATCHING.value: MatchingStrategy(),
        QuestionResponseType.ORDERING.value: OrderingStrategy(),
        QuestionResponseType.GAP_FILL.value: GapFillStrategy(),
        QuestionResponseType.SHORT_TEXT.value: ShortTextStrategy(),
        QuestionResponseType.LONG_TEXT.value: LongTextStrategy(),
        QuestionResponseType.SPOKEN_RESPONSE.value: SpokenResponseStrategy(),
        QuestionResponseType.INTERACTION.value: InteractionStrategy(),
        # Legacy question_type mappings
        "single_choice": SingleChoiceStrategy(),
        "multiple_choice": MultipleChoiceStrategy(),
        "text_input": ShortTextStrategy(),
    }

    @classmethod
    def get_strategy(cls, response_type: QuestionResponseType | str | None) -> BaseScoringStrategy:
        """Resolve scoring strategy by response_type or fallback to single choice."""
        if not response_type:
            return cls._strategies[QuestionResponseType.SINGLE_CHOICE.value]
        key = response_type.value if hasattr(response_type, "value") else str(response_type)
        return cls._strategies.get(key, cls._strategies[QuestionResponseType.SINGLE_CHOICE.value])
