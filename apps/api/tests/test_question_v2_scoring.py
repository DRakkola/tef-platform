import uuid

from app.modules.assessments.enums import (
    QuestionResponseType,
    QuestionType,
    ScoringStatus,
)
from app.modules.assessments.models import (
    AttemptAnswer,
    Question,
    QuestionOption,
)
from app.modules.assessments.scoring import extract_question_data
from app.modules.assessments.scoring_strategies import (
    GapFillStrategy,
    LongTextStrategy,
    MatchingStrategy,
    MultipleChoiceStrategy,
    OrderingStrategy,
    ShortTextStrategy,
    SingleChoiceStrategy,
    SpokenResponseStrategy,
    normalize_text,
)


class TestTextNormalization:
    """Verify robust text normalization for gap fill and short text."""

    def test_whitespace_collapsing(self):
        assert normalize_text("  bonjour   le   monde  ") == "bonjour le monde"

    def test_case_folding(self):
        assert normalize_text("Paris", ignore_case=True) == "paris"
        assert normalize_text("Paris", ignore_case=False) == "Paris"

    def test_french_accent_preservation_by_default(self):
        # By default in French examinations, accents distinguish homographs (ou vs où, a vs à)
        assert normalize_text("élève", ignore_accents=False) == "élève"
        assert normalize_text("ELEVE", ignore_case=True, ignore_accents=False) == "eleve"
        assert normalize_text("élève", ignore_accents=True) == "eleve"


class TestSingleChoiceStrategy:
    """Test 1-of-N single choice scoring."""

    def setup_method(self):
        self.strategy = SingleChoiceStrategy()
        self.opt1_id = uuid.uuid4()
        self.opt2_id = uuid.uuid4()
        self.question_data = {
            "id": str(uuid.uuid4()),
            "points": 5.0,
            "response_type": QuestionResponseType.SINGLE_CHOICE.value,
            "options": [
                {
                    "id": str(self.opt1_id),
                    "content": "Option A (Correct)",
                    "is_correct": True,
                    "order_index": 0,
                },
                {
                    "id": str(self.opt2_id),
                    "content": "Option B (Distractor)",
                    "is_correct": False,
                    "order_index": 1,
                    "misconception_type": "literal_distractor",
                    "distractor_rationale": "Surface word match.",
                },
            ],
        }

    def test_correct_selection(self):
        answer = AttemptAnswer(
            question_id=uuid.UUID(self.question_data["id"]),
            selected_option_id=self.opt1_id,
        )
        res = self.strategy.score(self.question_data, answer)
        assert res.is_correct is True
        assert res.raw_score == 5.0
        assert res.normalized_score == 100.0
        assert res.scoring_status == ScoringStatus.CORRECT

    def test_incorrect_selection_with_distractor_diagnostic(self):
        answer = AttemptAnswer(
            question_id=uuid.UUID(self.question_data["id"]),
            selected_option_id=self.opt2_id,
        )
        res = self.strategy.score(self.question_data, answer)
        assert res.is_correct is False
        assert res.raw_score == 0.0
        assert res.scoring_status == ScoringStatus.INCORRECT
        assert res.diagnostic_metadata is not None
        assert res.diagnostic_metadata["misconception_type"] == "literal_distractor"

    def test_missing_selection(self):
        answer = AttemptAnswer(
            question_id=uuid.UUID(self.question_data["id"]),
            selected_option_id=None,
        )
        res = self.strategy.score(self.question_data, answer)
        assert res.is_correct is False
        assert res.raw_score == 0.0
        assert res.scoring_status == ScoringStatus.MISSING


class TestMultipleChoiceStrategy:
    """Test M-of-N multiple selection scoring with all-or-nothing and partial credit."""

    def setup_method(self):
        self.strategy = MultipleChoiceStrategy()
        self.o1 = str(uuid.uuid4())
        self.o2 = str(uuid.uuid4())
        self.o3 = str(uuid.uuid4())
        self.o4 = str(uuid.uuid4())
        self.base_data = {
            "id": str(uuid.uuid4()),
            "points": 4.0,
            "response_type": QuestionResponseType.MULTIPLE_CHOICE.value,
            "options": [
                {"id": self.o1, "content": "Correct 1", "is_correct": True},
                {"id": self.o2, "content": "Correct 2", "is_correct": True},
                {"id": self.o3, "content": "Distractor 1", "is_correct": False},
                {"id": self.o4, "content": "Distractor 2", "is_correct": False},
            ],
            "scoring_payload": {"partial_credit": False},
        }

    def test_all_or_nothing_success(self):
        answer = AttemptAnswer(
            question_id=uuid.UUID(self.base_data["id"]),
            selected_option_ids=[self.o1, self.o2],
        )
        res = self.strategy.score(self.base_data, answer)
        assert res.is_correct is True
        assert res.raw_score == 4.0
        assert res.scoring_status == ScoringStatus.CORRECT

    def test_all_or_nothing_partial_fails(self):
        # Only 1 of 2 selected under strict all-or-nothing
        answer = AttemptAnswer(
            question_id=uuid.UUID(self.base_data["id"]),
            selected_option_ids=[self.o1],
        )
        res = self.strategy.score(self.base_data, answer)
        assert res.is_correct is False
        assert res.raw_score == 0.0
        assert res.scoring_status == ScoringStatus.INCORRECT

    def test_partial_credit_enabled(self):
        data = dict(self.base_data)
        data["scoring_payload"] = {"partial_credit": True}

        # 1 correct selected out of 2, 0 incorrect -> ratio = 0.5 -> 2.0 pts
        answer = AttemptAnswer(
            question_id=uuid.UUID(data["id"]),
            selected_option_ids=[self.o1],
        )
        res = self.strategy.score(data, answer)
        assert res.is_correct is False
        assert res.raw_score == 2.0
        assert res.normalized_score == 50.0
        assert res.scoring_status == ScoringStatus.PARTIAL

        # 1 correct selected + 1 incorrect selected -> (1 - 1)/2 = 0.0 pts
        answer_with_penalty = AttemptAnswer(
            question_id=uuid.UUID(data["id"]),
            selected_option_ids=[self.o1, self.o3],
        )
        res_penalty = self.strategy.score(data, answer_with_penalty)
        assert res_penalty.is_correct is False
        assert res_penalty.raw_score == 0.0
        assert res_penalty.scoring_status == ScoringStatus.INCORRECT


class TestMatchingStrategy:
    """Test pairwise association matching scoring."""

    def setup_method(self):
        self.strategy = MatchingStrategy()
        self.question_data = {
            "id": str(uuid.uuid4()),
            "points": 6.0,
            "response_type": QuestionResponseType.MATCHING.value,
            "scoring_payload": {
                "pairs": {
                    "source_1": "target_A",
                    "source_2": "target_B",
                    "source_3": "target_C",
                }
            },
        }

    def test_perfect_matching(self):
        answer = AttemptAnswer(
            question_id=uuid.UUID(self.question_data["id"]),
            response_payload={
                "source_1": "target_A",
                "source_2": "target_B",
                "source_3": "target_C",
            },
        )
        res = self.strategy.score(self.question_data, answer)
        assert res.is_correct is True
        assert res.raw_score == 6.0
        assert res.scoring_status == ScoringStatus.CORRECT

    def test_partial_matching(self):
        # 2 of 3 correct -> 4.0 points
        answer = AttemptAnswer(
            question_id=uuid.UUID(self.question_data["id"]),
            response_payload={
                "source_1": "target_A",
                "source_2": "target_WRONG",
                "source_3": "target_C",
            },
        )
        res = self.strategy.score(self.question_data, answer)
        assert res.is_correct is False
        assert res.raw_score == 4.0
        assert res.scoring_status == ScoringStatus.PARTIAL

    def test_zero_match(self):
        answer = AttemptAnswer(
            question_id=uuid.UUID(self.question_data["id"]),
            response_payload={
                "source_1": "target_X",
                "source_2": "target_Y",
                "source_3": "target_Z",
            },
        )
        res = self.strategy.score(self.question_data, answer)
        assert res.is_correct is False
        assert res.raw_score == 0.0
        assert res.scoring_status == ScoringStatus.INCORRECT


class TestOrderingStrategy:
    """Test sequential permutation ordering scoring."""

    def setup_method(self):
        self.strategy = OrderingStrategy()
        self.seq = ["item_A", "item_B", "item_C", "item_D"]
        self.question_data = {
            "id": str(uuid.uuid4()),
            "points": 4.0,
            "response_type": QuestionResponseType.ORDERING.value,
            "scoring_payload": {
                "sequence": self.seq,
                "partial_credit": True,
            },
        }

    def test_perfect_order(self):
        answer = AttemptAnswer(
            question_id=uuid.UUID(self.question_data["id"]),
            response_payload=["item_A", "item_B", "item_C", "item_D"],
        )
        res = self.strategy.score(self.question_data, answer)
        assert res.is_correct is True
        assert res.raw_score == 4.0
        assert res.scoring_status == ScoringStatus.CORRECT

    def test_partial_positional_order(self):
        # item_A at pos 0 (correct), item_C at pos 1 (wrong), item_B at pos 2 (wrong), item_D at pos 3 (correct)
        # 2 out of 4 correct positions -> 2.0 points
        answer = AttemptAnswer(
            question_id=uuid.UUID(self.question_data["id"]),
            response_payload=["item_A", "item_C", "item_B", "item_D"],
        )
        res = self.strategy.score(self.question_data, answer)
        assert res.is_correct is False
        assert res.raw_score == 2.0
        assert res.scoring_status == ScoringStatus.PARTIAL


class TestGapFillStrategy:
    """Test cloze / gap fill scoring with variants, accents, and normalization."""

    def setup_method(self):
        self.strategy = GapFillStrategy()
        self.question_data = {
            "id": str(uuid.uuid4()),
            "points": 3.0,
            "response_type": QuestionResponseType.GAP_FILL.value,
            "scoring_payload": {
                "gaps": {
                    "gap_1": ["développement", "developpement"],
                    "gap_2": ["système"],
                    "gap_3": ["rapide"],
                },
                "ignore_case": True,
                "ignore_accents": False,
            },
        }

    def test_all_gaps_correct(self):
        answer = AttemptAnswer(
            question_id=uuid.UUID(self.question_data["id"]),
            response_payload={
                "gap_1": "  Développement ",
                "gap_2": "SYSTÈME",
                "gap_3": "rapide",
            },
        )
        res = self.strategy.score(self.question_data, answer)
        assert res.is_correct is True
        assert res.raw_score == 3.0
        assert res.scoring_status == ScoringStatus.CORRECT

    def test_accent_strictness(self):
        # gap_2 expects 'système', user submitted 'systeme' with ignore_accents=False
        answer = AttemptAnswer(
            question_id=uuid.UUID(self.question_data["id"]),
            response_payload={
                "gap_1": "développement",
                "gap_2": "systeme",
                "gap_3": "rapide",
            },
        )
        res = self.strategy.score(self.question_data, answer)
        assert res.is_correct is False
        assert res.raw_score == 2.0
        assert res.scoring_status == ScoringStatus.PARTIAL


class TestShortTextStrategy:
    """Test short text exact match and open-ended routing."""

    def setup_method(self):
        self.strategy = ShortTextStrategy()

    def test_deterministic_short_text_match(self):
        q_data = {
            "id": str(uuid.uuid4()),
            "points": 2.0,
            "response_type": QuestionResponseType.SHORT_TEXT.value,
            "scoring_payload": {
                "accepted_answers": ["Montréal", "Montreal"],
            },
        }
        answer = AttemptAnswer(
            question_id=uuid.UUID(q_data["id"]),
            text_response="  montréal  ",
        )
        res = self.strategy.score(q_data, answer)
        assert res.is_correct is True
        assert res.raw_score == 2.0
        assert res.scoring_status == ScoringStatus.CORRECT

    def test_open_ended_short_text_pending_evaluation(self):
        # No accepted_answers in payload -> routes to manual/AI writing evaluator
        q_data = {
            "id": str(uuid.uuid4()),
            "points": 5.0,
            "response_type": QuestionResponseType.SHORT_TEXT.value,
            "scoring_payload": {},
            "options": [],
        }
        answer = AttemptAnswer(
            question_id=uuid.UUID(q_data["id"]),
            text_response="Une réponse libre et argumentée.",
        )
        res = self.strategy.score(q_data, answer)
        assert res.is_correct is None
        assert res.raw_score == 0.0
        assert res.scoring_status == ScoringStatus.PENDING_EVALUATION


class TestAsynchronousEvaluations:
    """Test long_text, spoken_response, and interaction pending evaluation behavior."""

    def test_long_text_pending_evaluation(self):
        strategy = LongTextStrategy()
        q_data = {"id": str(uuid.uuid4()), "points": 10.0}
        answer = AttemptAnswer(
            question_id=uuid.UUID(q_data["id"]),
            text_response="Ceci est un essai pour la section B de l'expression écrite...",
        )
        res = strategy.score(q_data, answer)
        assert res.is_correct is None
        assert res.raw_score == 0.0
        assert res.scoring_status == ScoringStatus.PENDING_EVALUATION

    def test_spoken_response_pending_evaluation(self):
        strategy = SpokenResponseStrategy()
        q_data = {"id": str(uuid.uuid4()), "points": 10.0}
        answer = AttemptAnswer(
            question_id=uuid.UUID(q_data["id"]),
            text_response="https://storage.local/audio/sample.webm",
        )
        res = strategy.score(q_data, answer)
        assert res.is_correct is None
        assert res.raw_score == 0.0
        assert res.scoring_status == ScoringStatus.PENDING_EVALUATION


class TestScoringEngineWithVersionSnapshot:
    """Verify version-aware snapshot scoring and immutable historical attempt preservation."""

    def test_historical_attempt_scored_against_snapshot(self):
        # Candidate was delivered Version 1 where Option A was correct
        v1_opt_a = str(uuid.uuid4())
        v1_opt_b = str(uuid.uuid4())
        v1_snapshot = {
            "id": str(uuid.uuid4()),
            "prompt": "V1 prompt",
            "points": 3,
            "response_type": "single_choice",
            "options": [
                {"id": v1_opt_a, "content": "V1 Option A", "is_correct": True},
                {"id": v1_opt_b, "content": "V1 Option B", "is_correct": False},
            ],
        }

        # Mock question whose live state was modified by author later (Option B is now correct!)
        live_question = Question(
            id=uuid.UUID(v1_snapshot["id"]),
            question_type=QuestionType.SINGLE_CHOICE,
            prompt="V2 prompt after author edit",
            points=10,  # Points changed in V2
            response_type=QuestionResponseType.SINGLE_CHOICE,
        )
        live_opt_a = QuestionOption(id=uuid.UUID(v1_opt_a), question_id=live_question.id, content="V1 Option A", is_correct=False)
        live_opt_b = QuestionOption(id=uuid.UUID(v1_opt_b), question_id=live_question.id, content="V1 Option B", is_correct=True)
        live_question.options = [live_opt_a, live_opt_b]

        # Candidate selected v1_opt_a
        candidate_answer = AttemptAnswer(
            question_id=live_question.id,
            selected_option_id=uuid.UUID(v1_opt_a),
        )

        # 1. Scoring against live question directly would mark candidate INCORRECT (points=10, opt_a is False)
        live_data = extract_question_data(live_question, snapshot=None)
        res_live = SingleChoiceStrategy().score(live_data, candidate_answer)
        assert res_live.is_correct is False
        assert res_live.raw_score == 0.0

        # 2. Scoring against delivered snapshot marks candidate CORRECT with V1 points (points=3, opt_a was True)
        snapshot_data = extract_question_data(live_question, snapshot=v1_snapshot)
        res_snapshot = SingleChoiceStrategy().score(snapshot_data, candidate_answer)
        assert res_snapshot.is_correct is True
        assert res_snapshot.raw_score == 3.0
        assert res_snapshot.scoring_status == ScoringStatus.CORRECT
