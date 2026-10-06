"""Regression tests for question identity hashing and duplicate detection."""

from __future__ import annotations

import hashlib

import pytest
import pytest_asyncio

from app.modules.admin.ai_question_service import AIQuestionGenerationService
from app.modules.assessments.enums import QuestionResponseType, QuestionType
from app.modules.assessments.item_hash import compute_item_hash, normalize_prompt_for_hash
from app.modules.assessments.models import Question


def _migration_formula(prompt: str | None) -> str:
    """Reproduce the exact normalization from revision 0035."""
    normalized = " ".join((prompt or "").strip().lower().split())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


class TestItemHashContract:
    """item_hash must match the Alembic 0035 backfill byte-for-byte."""

    @pytest.mark.parametrize(
        "prompt",
        [
            "Quelle ligne de transport est temporairement interrompue ?",
            "  A   multiple\n\n  space   question  ",
            "MiXeD CaSe PROMPT",
            "Accents: café crème à l'écran",
            "",
        ],
    )
    def test_matches_migration_backfill_formula(self, prompt: str) -> None:
        assert compute_item_hash(prompt) == _migration_formula(prompt)

    def test_normalization_collapses_internal_whitespace(self) -> None:
        assert normalize_prompt_for_hash("  A   b\n c  ") == "a b c"

    def test_hash_is_64_char_sha256_hex(self) -> None:
        digest = compute_item_hash("anything")
        assert len(digest) == 64
        assert all(char in "0123456789abcdef" for char in digest)

    def test_whitespace_variants_share_one_hash(self) -> None:
        assert compute_item_hash("A  b   c") == compute_item_hash(" a b c ")

    def test_distinct_prompts_differ(self) -> None:
        assert compute_item_hash("Question A") != compute_item_hash("Question B")

    def test_empty_and_none_are_handled(self) -> None:
        assert compute_item_hash("") == compute_item_hash(None)


@pytest_asyncio.fixture
async def duplicate_question(db_session):
    """A question stored with a populated item_hash."""
    question = Question(
        prompt="Quelle ligne de transport est temporairement interrompue ?",
        question_type=QuestionType.SINGLE_CHOICE,
        response_type=QuestionResponseType.SINGLE_CHOICE.value,
        level="A2",
        target_cefr="A2",
        difficulty=2,
        difficulty_rating=2,
        points=1,
        item_hash=compute_item_hash(
            "Quelle ligne de transport est temporairement interrompue ?"
        ),
    )
    db_session.add(question)
    await db_session.flush()
    yield question
    await db_session.delete(question)
    await db_session.flush()


@pytest.mark.asyncio
class TestCheckQuestionDuplicates:
    async def test_detects_exact_duplicate_via_item_hash(self, db_session, duplicate_question) -> None:
        report = await AIQuestionGenerationService.check_question_duplicates(
            db_session,
            prompt="quelle ligne de transport est   temporairement interrompue ?",
        )

        assert report.is_duplicate is True
        assert report.status == "exact_duplicate"
        assert report.matched_question_id == duplicate_question.id

    async def test_distinct_prompt_is_not_a_duplicate(self, db_session, duplicate_question) -> None:
        report = await AIQuestionGenerationService.check_question_duplicates(
            db_session,
            prompt="Combien de terminals desservent cette ligne ?",
        )

        assert report.is_duplicate is False

    async def test_empty_prompt_is_skipped(self, db_session) -> None:
        report = await AIQuestionGenerationService.check_question_duplicates(db_session, prompt="   ")

        assert report.is_duplicate is False
        assert report.status == "unique"

    async def test_detects_legacy_row_with_null_item_hash(self, db_session) -> None:
        """Rows written before item_hash was populated must still be caught."""
        legacy = Question(
            prompt="Question historique sans empreinte de hachage",
            question_type=QuestionType.SINGLE_CHOICE,
            response_type=QuestionResponseType.SINGLE_CHOICE.value,
            level="B1",
            target_cefr="B1",
            difficulty=3,
            difficulty_rating=3,
            points=1,
            item_hash=None,
        )
        db_session.add(legacy)
        await db_session.flush()

        try:
            report = await AIQuestionGenerationService.check_question_duplicates(
                db_session, prompt="question historique sans empreinte de hachage"
            )
            assert report.is_duplicate is True
            assert report.status == "exact_duplicate"
        finally:
            await db_session.delete(legacy)
            await db_session.flush()

    async def test_scan_is_deterministic_across_repeated_calls(self, db_session) -> None:
        """Without ORDER BY the truncated scan could return unstable matches."""
        for index in range(5):
            db_session.add(
                Question(
                    prompt=f"Question de correspondance numero {index}",
                    question_type=QuestionType.SINGLE_CHOICE,
                    response_type=QuestionResponseType.SINGLE_CHOICE.value,
                    level="B1",
                    target_cefr="B1",
                    difficulty=3,
                    difficulty_rating=3,
                    points=1,
                    item_hash=compute_item_hash(f"Question de correspondance numero {index}"),
                )
            )
        await db_session.flush()

        matches = set()
        for _ in range(5):
            report = await AIQuestionGenerationService.check_question_duplicates(
                db_session, prompt="Question de correspondance numero 4"
            )
            matches.add(report.status)
            assert report.is_duplicate is True

        assert len(matches) == 1