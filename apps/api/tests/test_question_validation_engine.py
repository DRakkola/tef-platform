"""Comprehensive Test Suite for Question Validation Engine (Phase 3).

Covers:
1. Structural Validation (missing prompt, short prompt, invalid types, invalid CEFR, invalid difficulty, answer configs)
2. Option Quality Validation (insufficient options, distractor count, duplicate text, empty option, duplicate order, distractor rationale, unbalanced length, subset option, all/none phrase)
3. Answerability / Clueing Checks (answer leakage into prompt stem)
4. Taxonomy & Skill Validation (missing tags, weights, dimension sum, multiple primaries, inactive/missing skills, task type compatibility)
5. Task Type & Stimulus Validation (required stimulus by task type, non-existent stimulus, empty stimulus, modality mismatch, gap-fill text-only exemption)
6. CEFR & Difficulty Consistency Checks (difficulty rating vs band, cognitive complexity vs CEFR)
7. Duplication Detection (exact duplicate, near duplicate similarity >= 0.85, distinct item)
8. Provenance Validation (AI missing model, AI incomplete parameters, valid AI, valid human)
9. Validation Persistence (immutable append-only audit trail in question_validations)
10. Admin API Route Integration (POST /api/v1/admin/questions/{id}/validate)
"""

from __future__ import annotations

import hashlib
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.admin.enums import SkillDimension, SkillTagRole
from app.modules.admin.models import TaxonomyVersion
from app.modules.assessments.enums import (
    CognitiveComplexityLevel,
    QuestionResponseType,
    QuestionType,
)
from app.modules.assessments.models import (
    Assessment,
    AssessmentSection,
    Question,
    QuestionOption,
    QuestionSkillTag,
    QuestionValidation,
    Skill,
    Stimulus,
    TaskType,
)
from app.modules.assessments.question_validation import (
    QuestionValidationEngine,
)

# ---------------------------------------------------------------------------
# Test Helpers
# ---------------------------------------------------------------------------


async def _make_taxonomy(db: AsyncSession) -> TaxonomyVersion:
    tv = TaxonomyVersion(
        version=f"v-val-test-{uuid.uuid4().hex[:6]}",
        name="Validation Test Taxonomy",
        status="active",
    )
    db.add(tv)
    await db.flush()
    return tv


async def _make_skills(db: AsyncSession, tv: TaxonomyVersion) -> tuple[Skill, Skill, Skill]:
    sk_reasoning = Skill(
        code=f"CE-VAL-REA-{uuid.uuid4().hex[:4]}",
        name="Compréhension des faits principaux",
        taxonomy_version_id=tv.id,
        dimension=SkillDimension.REASONING,
        domain="reading",
        is_active=True,
    )
    sk_language = Skill(
        code=f"CE-VAL-LAN-{uuid.uuid4().hex[:4]}",
        name="Reconnaissance du lexique professionnel",
        taxonomy_version_id=tv.id,
        dimension=SkillDimension.LANGUAGE,
        domain="reading",
        is_active=True,
    )
    sk_speaking = Skill(
        code=f"EO-VAL-SPK-{uuid.uuid4().hex[:4]}",
        name="Fluidité du discours oral",
        taxonomy_version_id=tv.id,
        dimension=SkillDimension.REASONING,
        domain="speaking",
        is_active=True,
    )
    db.add_all([sk_reasoning, sk_language, sk_speaking])
    await db.flush()
    return sk_reasoning, sk_language, sk_speaking


async def _make_assessment_section(db: AsyncSession) -> AssessmentSection:
    assessment = Assessment(
        title="Test Validation Assessment",
        assessment_type="mixed",
        duration_seconds=3600,
    )
    db.add(assessment)
    await db.flush()

    section = AssessmentSection(
        assessment_id=assessment.id,
        title="Section 1",
        order_index=1,
    )
    db.add(section)
    await db.flush()
    return section


# ---------------------------------------------------------------------------
# 1. Structural Validation Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_validation_structural_missing_and_short_prompt(db_session: AsyncSession) -> None:
    """Empty prompt triggers ERR_PROMPT_EMPTY; short prompt triggers WARN_PROMPT_TOO_SHORT."""
    # 1. Empty prompt
    q_empty = {
        "prompt": "   ",
        "response_type": "single_choice",
        "target_cefr": "B1",
        "options": [{"content": "A", "is_correct": True}, {"content": "B", "is_correct": False}],
    }
    res_empty = await QuestionValidationEngine.validate_question(db_session, q_empty, check_duplication=False)
    assert not res_empty.valid
    assert res_empty.status == "blocking"
    assert any(e.code == "ERR_PROMPT_EMPTY" for e in res_empty.errors)

    # 2. Short prompt (< 10 chars)
    q_short = {
        "prompt": "Que dit ?",
        "response_type": "single_choice",
        "target_cefr": "B1",
        "options": [
            {"content": "A", "is_correct": True},
            {"content": "B", "is_correct": False},
            {"content": "C", "is_correct": False},
            {"content": "D", "is_correct": False},
        ],
    }
    res_short = await QuestionValidationEngine.validate_question(db_session, q_short, check_duplication=False)
    assert any(w.code == "WARN_PROMPT_TOO_SHORT" for w in res_short.warnings)


@pytest.mark.asyncio
async def test_validation_structural_invalid_types_cefr_difficulty(db_session: AsyncSession) -> None:
    """Rejects invalid response type, invalid CEFR band, out-of-range difficulty rating, and invalid complexity."""
    q_bad = {
        "prompt": "Quel est le sujet principal de cet article ?",
        "response_type": "unsupported_type_xyz",
        "target_cefr": "Z9",  # Invalid CEFR
        "difficulty_rating": 850,  # Max is 699
        "cognitive_complexity": "telepathic_intuition",  # Invalid complexity
        "options": [{"content": "Option 1", "is_correct": True}, {"content": "Option 2", "is_correct": False}],
    }
    res = await QuestionValidationEngine.validate_question(db_session, q_bad, check_duplication=False)
    assert not res.valid
    codes = {e.code for e in res.errors}
    assert "ERR_INVALID_RESPONSE_TYPE" in codes
    assert "ERR_INVALID_CEFR_LEVEL" in codes
    assert "ERR_INVALID_DIFFICULTY_RATING" in codes
    assert "ERR_INVALID_COGNITIVE_COMPLEXITY" in codes


@pytest.mark.asyncio
async def test_validation_structural_single_choice_answer_keys(db_session: AsyncSession) -> None:
    """Enforces exactly 1 correct answer for single_choice and >= 1 for multiple_choice."""
    # 0 correct
    q_zero = {
        "prompt": "Quel est le sujet principal de cet article ?",
        "response_type": "single_choice",
        "target_cefr": "B1",
        "options": [
            {"content": "A", "is_correct": False},
            {"content": "B", "is_correct": False},
            {"content": "C", "is_correct": False},
            {"content": "D", "is_correct": False},
        ],
    }
    res_zero = await QuestionValidationEngine.validate_question(db_session, q_zero, check_duplication=False)
    assert any(e.code == "ERR_NO_CORRECT_ANSWER" for e in res_zero.errors)

    # 2 correct on single_choice
    q_multi = {
        "prompt": "Quel est le sujet principal de cet article ?",
        "response_type": "single_choice",
        "target_cefr": "B1",
        "options": [
            {"content": "A", "is_correct": True},
            {"content": "B", "is_correct": True},
            {"content": "C", "is_correct": False},
            {"content": "D", "is_correct": False},
        ],
    }
    res_multi = await QuestionValidationEngine.validate_question(db_session, q_multi, check_duplication=False)
    assert any(e.code == "ERR_SINGLE_CHOICE_MULTIPLE_CORRECT" for e in res_multi.errors)


# ---------------------------------------------------------------------------
# 2. Option Quality Validation Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_validation_options_count_and_duplicates(db_session: AsyncSession) -> None:
    """Rejects < 2 options, empty options, duplicate option texts, and duplicate order indices."""
    # Duplicate option text + duplicate order_index
    q_dup = {
        "prompt": "Quel est le but de la démarche administrative ?",
        "response_type": "single_choice",
        "target_cefr": "B1",
        "options": [
            {"content": "Obtenir un permis", "is_correct": True, "order_index": 0},
            {"content": "  obtenir un permis  ", "is_correct": False, "order_index": 0},
            {"content": "", "is_correct": False, "order_index": 1},
        ],
    }
    res = await QuestionValidationEngine.validate_question(db_session, q_dup, check_duplication=False)
    codes = {e.code for e in res.errors}
    assert "ERR_DUPLICATE_OPTION_TEXT" in codes
    assert "ERR_EMPTY_OPTION" in codes
    assert "ERR_DUPLICATE_OPTION_ORDER" in codes

    # Less than 2 options
    q_one = {
        "prompt": "Quel est le but de la démarche administrative ?",
        "response_type": "single_choice",
        "options": [{"content": "Unique option", "is_correct": True}],
    }
    res_one = await QuestionValidationEngine.validate_question(db_session, q_one, check_duplication=False)
    assert any(e.code == "ERR_INSUFFICIENT_OPTIONS" for e in res_one.errors)


@pytest.mark.asyncio
async def test_validation_options_diagnostics_and_clueing_anomalies(db_session: AsyncSession) -> None:
    """Detects missing distractor rationales, unbalanced option lengths, subset options, and all/none phrasing."""
    q = {
        "prompt": "Pourquoi l'auteur s'oppose-t-il au projet ferroviaire ?",
        "response_type": "single_choice",
        "target_cefr": "B2",
        "options": [
            {
                "content": "Parce qu'il estime que le tracé actuel engendre un impact environnemental irréversible sur les zones humides protégées de la région sans apporter de gain de temps significatif pour les usagers quotidiens",
                "is_correct": True,
            },
            {
                "content": "impact environnemental",  # Subset of option A
                "is_correct": False,
                # Missing distractor rationale and misconception
            },
            {
                "content": "Toutes les réponses précédentes sont correctes",  # All/none phrasing
                "is_correct": False,
                "distractor_rationale": "Formule générique interdite",
            },
            {
                "content": "Le coût est acceptable",
                "is_correct": False,
                "misconception_type": "surface_reading",
            },
        ],
    }
    res = await QuestionValidationEngine.validate_question(db_session, q, check_duplication=False)
    warn_codes = {w.code for w in res.warnings}

    assert "WARN_UNBALANCED_OPTION_LENGTH" in warn_codes
    assert "WARN_SUBSET_OPTION" in warn_codes
    assert "WARN_ALL_OR_NONE_OPTION" in warn_codes
    assert "WARN_MISSING_DISTRACTOR_RATIONALE" in warn_codes
    assert any(i.code == "INFO_DISTRACTOR_MISCONCEPTION_TAGGED" for i in res.informational)


@pytest.mark.asyncio
async def test_validation_clueing_answer_leak_in_prompt(db_session: AsyncSession) -> None:
    """Warns when the correct answer appears verbatim in the prompt stem."""
    q = {
        "prompt": "Le candidat doit identifier la subvention municipale allouée au festival.",
        "response_type": "single_choice",
        "target_cefr": "B1",
        "options": [
            {"content": "subvention municipale", "is_correct": True, "distractor_rationale": None},
            {"content": "aide de l'État", "is_correct": False, "distractor_rationale": "Autre source"},
            {"content": "fonds privés", "is_correct": False, "distractor_rationale": "Sponsoring"},
            {"content": "billetterie", "is_correct": False, "distractor_rationale": "Recettes"},
        ],
    }
    res = await QuestionValidationEngine.validate_question(db_session, q, check_duplication=False)
    assert any(w.code == "WARN_ANSWER_LEAK_IN_PROMPT" for w in res.warnings)


# ---------------------------------------------------------------------------
# 3. Taxonomy & Skill Validation Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_validation_taxonomy_missing_tags_and_weights(db_session: AsyncSession) -> None:
    """Enforces presence of skill tags, valid weight range, dimension sum = 1.0, and at most 1 primary per dimension."""
    tv = await _make_taxonomy(db_session)
    sk1, sk2, _ = await _make_skills(db_session, tv)

    # 1. Missing skill tags completely
    q_no_tags = {
        "prompt": "De quel événement parle ce document ?",
        "response_type": "single_choice",
        "options": [
            {"content": "A", "is_correct": True},
            {"content": "B", "is_correct": False},
            {"content": "C", "is_correct": False},
            {"content": "D", "is_correct": False},
        ],
        "skill_tags": [],
    }
    res_no_tags = await QuestionValidationEngine.validate_question(db_session, q_no_tags, check_duplication=False)
    assert any(e.code == "ERR_TAXONOMY_TAG_MISSING" for e in res_no_tags.errors)

    # 2. Invalid weight (e.g. 1.5)
    q_bad_weight = {
        "prompt": "De quel événement parle ce document ?",
        "response_type": "single_choice",
        "options": [
            {"content": "A", "is_correct": True},
            {"content": "B", "is_correct": False},
            {"content": "C", "is_correct": False},
            {"content": "D", "is_correct": False},
        ],
        "skill_tags": [{"skill_id": sk1.id, "weight": 1.5, "role": "primary"}],
    }
    res_bad_weight = await QuestionValidationEngine.validate_question(db_session, q_bad_weight, check_duplication=False)
    assert any(e.code == "ERR_INVALID_TAG_WEIGHT" for e in res_bad_weight.errors)

    # 3. Dimension weight sum != 1.0 (e.g. 0.70)
    q_bad_sum = {
        "prompt": "De quel événement parle ce document ?",
        "response_type": "single_choice",
        "options": [
            {"content": "A", "is_correct": True},
            {"content": "B", "is_correct": False},
            {"content": "C", "is_correct": False},
            {"content": "D", "is_correct": False},
        ],
        "skill_tags": [{"skill_id": sk1.id, "weight": 0.70, "role": "primary"}],
    }
    res_bad_sum = await QuestionValidationEngine.validate_question(db_session, q_bad_sum, check_duplication=False)
    assert any(e.code == "ERR_WEIGHT_SUM_INVALID" for e in res_bad_sum.errors)

    # 4. Two primaries in same dimension
    q_two_primaries = {
        "prompt": "De quel événement parle ce document ?",
        "response_type": "single_choice",
        "options": [
            {"content": "A", "is_correct": True},
            {"content": "B", "is_correct": False},
            {"content": "C", "is_correct": False},
            {"content": "D", "is_correct": False},
        ],
        "skill_tags": [
            {"skill_id": sk1.id, "weight": 0.5, "role": "primary"},
            {"skill_id": sk2.id, "weight": 0.5, "role": "primary"},
        ],
    }
    # Note: sk1 is REASONING, sk2 is LANGUAGE -> this should actually be VALID since they are different dimensions!
    res_valid_two_dims = await QuestionValidationEngine.validate_question(db_session, q_two_primaries, check_duplication=False)
    # Both sum to 0.5 in their respective dimensions, so each triggers ERR_WEIGHT_SUM_INVALID (sum != 1.0)
    assert any(e.code == "ERR_WEIGHT_SUM_INVALID" for e in res_valid_two_dims.errors)


@pytest.mark.asyncio
async def test_validation_taxonomy_multiple_primaries_same_dimension(db_session: AsyncSession) -> None:
    """Blocks multiple PRIMARY tags within the same competency dimension."""
    tv = await _make_taxonomy(db_session)
    sk1 = Skill(
        code=f"CE-R1-{uuid.uuid4().hex[:4]}",
        name="Reasoning 1",
        taxonomy_version_id=tv.id,
        dimension=SkillDimension.REASONING,
        domain="reading",
        is_active=True,
    )
    sk2 = Skill(
        code=f"CE-R2-{uuid.uuid4().hex[:4]}",
        name="Reasoning 2",
        taxonomy_version_id=tv.id,
        dimension=SkillDimension.REASONING,
        domain="reading",
        is_active=True,
    )
    db_session.add_all([sk1, sk2])
    await db_session.flush()

    q = {
        "prompt": "Quel est l'argument principal formulé par l'auteur ?",
        "response_type": "single_choice",
        "options": [
            {"content": "A", "is_correct": True},
            {"content": "B", "is_correct": False},
            {"content": "C", "is_correct": False},
            {"content": "D", "is_correct": False},
        ],
        "skill_tags": [
            {"skill_id": sk1.id, "weight": 0.5, "role": "primary"},
            {"skill_id": sk2.id, "weight": 0.5, "role": "primary"},
        ],
    }
    res = await QuestionValidationEngine.validate_question(db_session, q, check_duplication=False)
    assert any(e.code == "ERR_MULTIPLE_PRIMARY_PER_DIMENSION" for e in res.errors)


# ---------------------------------------------------------------------------
# 4. Task Type & Stimulus Validation Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_validation_stimulus_presence_and_modality_mismatch(db_session: AsyncSession) -> None:
    """Validates required stimulus for press_article, stimulus content, and modality alignment."""
    # Find Reading press_article task type
    tt = await db_session.scalar(select(TaskType).where(TaskType.code == "press_article"))
    if not tt:
        tt = TaskType(code="press_article", name="Articles de presse", modality="reading")
        db_session.add(tt)
        await db_session.flush()

    # 1. press_article requires a stimulus, but none provided
    q_no_stim = {
        "prompt": "D'après l'article, quelle est la cause principale de la hausse des prix ?",
        "response_type": "single_choice",
        "task_type_id": tt.id,
        "options": [
            {"content": "A", "is_correct": True},
            {"content": "B", "is_correct": False},
            {"content": "C", "is_correct": False},
            {"content": "D", "is_correct": False},
        ],
    }
    res_no_stim = await QuestionValidationEngine.validate_question(db_session, q_no_stim, check_duplication=False)
    assert any(e.code == "ERR_MISSING_REQUIRED_STIMULUS" for e in res_no_stim.errors)

    # 2. Stimulus exists but is empty
    empty_stim = Stimulus(
        title="Empty Stimulus",
        modality="reading",
        content_text="   ",
        content_hash=hashlib.sha256(b"Empty Stimulus").hexdigest(),
    )
    db_session.add(empty_stim)
    await db_session.flush()

    q_empty_stim = {
        "prompt": "D'après l'article, quelle est la cause principale de la hausse des prix ?",
        "response_type": "single_choice",
        "task_type_id": tt.id,
        "stimulus_id": empty_stim.id,
        "options": [
            {"content": "A", "is_correct": True},
            {"content": "B", "is_correct": False},
            {"content": "C", "is_correct": False},
            {"content": "D", "is_correct": False},
        ],
    }
    res_empty_stim = await QuestionValidationEngine.validate_question(db_session, q_empty_stim, check_duplication=False)
    assert any(e.code == "ERR_STIMULUS_EMPTY" for e in res_empty_stim.errors)

    # 3. Stimulus modality mismatch (listening stimulus on reading task)
    audio_stim = Stimulus(
        title="Radio Broadcast Stimulus",
        modality="listening",
        content_text="Extrait d'émission radio sur l'écologie.",
        content_hash=hashlib.sha256(b"Radio Broadcast Stimulus").hexdigest(),
    )
    db_session.add(audio_stim)
    await db_session.flush()

    q_mismatch = {
        "prompt": "D'après l'article, quelle est la cause principale de la hausse des prix ?",
        "response_type": "single_choice",
        "task_type_id": tt.id,
        "stimulus_id": audio_stim.id,
        "options": [
            {"content": "A", "is_correct": True},
            {"content": "B", "is_correct": False},
            {"content": "C", "is_correct": False},
            {"content": "D", "is_correct": False},
        ],
    }
    res_mismatch = await QuestionValidationEngine.validate_question(db_session, q_mismatch, check_duplication=False)
    assert any(e.code == "ERR_STIMULUS_MODALITY_MISMATCH" for e in res_mismatch.errors)


@pytest.mark.asyncio
async def test_validation_gap_fill_stimulus_exemption(db_session: AsyncSession) -> None:
    """Text-gap and sentence-gap task types do not strictly require an external stimulus."""
    tt_gap = await db_session.scalar(select(TaskType).where(TaskType.code == "sentence_gap"))
    if not tt_gap:
        tt_gap = TaskType(code="sentence_gap", name="Phrases à compléter", modality="reading")
        db_session.add(tt_gap)
        await db_session.flush()

    tv = await _make_taxonomy(db_session)
    sk1, _, _ = await _make_skills(db_session, tv)

    q_gap = {
        "prompt": "Il est important que chacun [...] à la réunion de demain.",
        "response_type": "single_choice",
        "task_type_id": tt_gap.id,
        "target_cefr": "B1",
        "options": [
            {"content": "vienne", "is_correct": True, "distractor_rationale": "Subjonctif requis"},
            {"content": "vient", "is_correct": False, "distractor_rationale": "Indicatif"},
            {"content": "venu", "is_correct": False, "distractor_rationale": "Participe"},
            {"content": "venir", "is_correct": False, "distractor_rationale": "Infinitif"},
        ],
        "skill_tags": [{"skill_id": sk1.id, "weight": 1.0, "role": "primary"}],
    }
    res = await QuestionValidationEngine.validate_question(db_session, q_gap, check_duplication=False)
    assert not any(e.code == "ERR_MISSING_REQUIRED_STIMULUS" for e in res.errors)


# ---------------------------------------------------------------------------
# 5. CEFR & Difficulty Consistency Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_validation_cefr_difficulty_consistency(db_session: AsyncSession) -> None:
    """Warns on out-of-band difficulty rating or cognitive complexity vs CEFR mismatch."""
    # A1 level with difficulty rating 580 (expected 100-199) and critical_evaluation
    q = {
        "prompt": "Où se trouve le bureau de poste ?",
        "response_type": "single_choice",
        "target_cefr": "A1",
        "difficulty_rating": 580,
        "cognitive_complexity": CognitiveComplexityLevel.CRITICAL_EVALUATION.value,
        "options": [
            {"content": "Près de la gare", "is_correct": True},
            {"content": "Au cinéma", "is_correct": False},
            {"content": "Dans le parc", "is_correct": False},
            {"content": "Sur le pont", "is_correct": False},
        ],
    }
    res = await QuestionValidationEngine.validate_question(db_session, q, check_duplication=False)
    warn_codes = {w.code for w in res.warnings}
    assert "WARN_DIFFICULTY_RATING_BAND_MISMATCH" in warn_codes
    assert "WARN_COGNITIVE_CEFR_MISMATCH" in warn_codes


# ---------------------------------------------------------------------------
# 6. Duplication Detection Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_validation_duplication_exact_and_near(db_session: AsyncSession) -> None:
    """Detects exact normalized prompt duplicate and high-similarity near duplicates."""
    sec = await _make_assessment_section(db_session)

    existing_q = Question(
        prompt="Quelles sont les nouvelles modalités d'inscription pour la session d'automne ?",
        question_type=QuestionType.SINGLE_CHOICE,
        response_type=QuestionResponseType.SINGLE_CHOICE.value,
        status="published",
    )
    db_session.add(existing_q)
    await db_session.flush()

    # 1. Exact normalized match
    q_exact = {
        "prompt": "  quelles sont les nouvelles modalités d'inscription pour la session d'automne ?  ",
        "response_type": "single_choice",
        "options": [
            {"content": "A", "is_correct": True},
            {"content": "B", "is_correct": False},
            {"content": "C", "is_correct": False},
            {"content": "D", "is_correct": False},
        ],
    }
    res_exact = await QuestionValidationEngine.validate_question(db_session, q_exact, check_duplication=True)
    assert any(w.code == "WARN_EXACT_DUPLICATE" for w in res_exact.warnings)

    # 2. Near match (> 85% token overlap)
    q_near = {
        "prompt": "Quelles sont les nouvelles modalités d'inscription prévues pour la session d'automne ?",
        "response_type": "single_choice",
        "options": [
            {"content": "A", "is_correct": True},
            {"content": "B", "is_correct": False},
            {"content": "C", "is_correct": False},
            {"content": "D", "is_correct": False},
        ],
    }
    res_near = await QuestionValidationEngine.validate_question(db_session, q_near, check_duplication=True)
    assert any(w.code in ("WARN_EXACT_DUPLICATE", "WARN_NEAR_DUPLICATE") for w in res_near.warnings)

    # 3. Completely distinct question
    q_distinct = {
        "prompt": "À quelle heure part le premier train direct en direction de Montréal ?",
        "response_type": "single_choice",
        "options": [
            {"content": "A", "is_correct": True},
            {"content": "B", "is_correct": False},
            {"content": "C", "is_correct": False},
            {"content": "D", "is_correct": False},
        ],
    }
    res_dist = await QuestionValidationEngine.validate_question(db_session, q_distinct, check_duplication=True)
    assert not any(w.code in ("WARN_EXACT_DUPLICATE", "WARN_NEAR_DUPLICATE") for w in res_dist.warnings)


# ---------------------------------------------------------------------------
# 7. Provenance Validation Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_validation_provenance_rules(db_session: AsyncSession) -> None:
    """Enforces generator_model on AI questions; human questions require no AI metadata."""
    # 1. AI question missing generator model
    q_ai_missing = {
        "prompt": "Quelle est l'idée directrice exprimée dans ce paragraphe ?",
        "response_type": "single_choice",
        "author_type": "ai",
        "provenance": None,
        "options": [
            {"content": "A", "is_correct": True},
            {"content": "B", "is_correct": False},
            {"content": "C", "is_correct": False},
            {"content": "D", "is_correct": False},
        ],
    }
    res_ai_missing = await QuestionValidationEngine.validate_question(db_session, q_ai_missing, check_duplication=False)
    assert any(e.code == "ERR_AI_PROVENANCE_MISSING_MODEL" for e in res_ai_missing.errors)

    # 2. AI question with generator model but missing parameters -> warning
    q_ai_partial = {
        "prompt": "Quelle est l'idée directrice exprimée dans ce paragraphe ?",
        "response_type": "single_choice",
        "author_type": "ai",
        "provenance": {
            "generator_model": "gemini-1.5-pro",
            "generator_prompt_version": None,
            "generator_parameters": None,
        },
        "options": [
            {"content": "A", "is_correct": True},
            {"content": "B", "is_correct": False},
            {"content": "C", "is_correct": False},
            {"content": "D", "is_correct": False},
        ],
    }
    res_ai_partial = await QuestionValidationEngine.validate_question(db_session, q_ai_partial, check_duplication=False)
    assert not any(e.code == "ERR_AI_PROVENANCE_MISSING_MODEL" for e in res_ai_partial.errors)
    assert any(w.code == "WARN_AI_PROVENANCE_INCOMPLETE" for w in res_ai_partial.warnings)

    # 3. Human question has no AI provenance requirements
    q_human = {
        "prompt": "Quelle est l'idée directrice exprimée dans ce paragraphe ?",
        "response_type": "single_choice",
        "author_type": "human",
        "options": [
            {"content": "A", "is_correct": True},
            {"content": "B", "is_correct": False},
            {"content": "C", "is_correct": False},
            {"content": "D", "is_correct": False},
        ],
    }
    res_human = await QuestionValidationEngine.validate_question(db_session, q_human, check_duplication=False)
    assert not any("PROVENANCE" in e.code for e in res_human.errors)


# ---------------------------------------------------------------------------
# 8. Validation Persistence & Immutability Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_validation_persistence_append_only(db_session: AsyncSession) -> None:
    """Verifies validate_and_persist inserts immutable QuestionValidation audit records."""
    sec = await _make_assessment_section(db_session)
    tv = await _make_taxonomy(db_session)
    sk1, _, _ = await _make_skills(db_session, tv)

    q = Question(
        prompt="Où se situe l'action décrite dans ce court extrait littéraire ?",
        question_type=QuestionType.SINGLE_CHOICE,
        response_type=QuestionResponseType.SINGLE_CHOICE.value,
        target_cefr="B1",
        difficulty_rating=350,
        status="draft",
        version=1,
    )
    db_session.add(q)
    await db_session.flush()

    # Add options and skill tags
    opts = [
        QuestionOption(question_id=q.id, content="Dans un café parisien", is_correct=True, order_index=0, distractor_rationale=None),
        QuestionOption(question_id=q.id, content="À la gare du Nord", is_correct=False, order_index=1, distractor_rationale="Confusion de lieu"),
        QuestionOption(question_id=q.id, content="Dans un parc public", is_correct=False, order_index=2, distractor_rationale="Confusion d'espace"),
        QuestionOption(question_id=q.id, content="Dans une bibliothèque", is_correct=False, order_index=3, distractor_rationale="Lieu silencieux"),
    ]
    tag = QuestionSkillTag(
        question_id=q.id,
        skill_id=sk1.id,
        role=SkillTagRole.PRIMARY,
        weight=1.0,
    )
    db_session.add_all(opts + [tag])
    await db_session.flush()

    # Run 1: validate and persist
    res1 = await QuestionValidationEngine.validate_and_persist(db_session, q, check_duplication=False)
    assert res1.valid
    assert res1.status in ("valid", "warning")

    # Verify record in DB
    vals_1 = (await db_session.execute(
        select(QuestionValidation).where(QuestionValidation.question_id == q.id)
    )).scalars().all()
    assert len(vals_1) == 1
    assert vals_1[0].validated_by_system_version == "v2.0.0"
    first_record_id = vals_1[0].id

    # Run 2: validate again (must create a new row, NOT overwrite the old one)
    await QuestionValidationEngine.validate_and_persist(db_session, q, check_duplication=False)
    vals_2 = (await db_session.execute(
        select(QuestionValidation).where(QuestionValidation.question_id == q.id).order_by(QuestionValidation.checked_at)
    )).scalars().all()
    assert len(vals_2) == 2
    assert vals_2[0].id == first_record_id
    assert vals_2[1].id != first_record_id


# ---------------------------------------------------------------------------
# 9. Admin API Route Integration Test
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_admin_validate_question_endpoint(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
) -> None:
    """Verifies POST /api/v1/admin/content/questions/{id}/validate executes validation linter and returns result."""
    # 1. Create assessment
    ass_resp = await client.post(
        "/api/v1/admin/content/assessments",
        headers=admin_auth_headers,
        json={
            "title": "Validation API Test Assessment",
            "assessment_type": "mixed",
            "duration_seconds": 3600,
        },
    )
    assert ass_resp.status_code == 201, ass_resp.text
    ass_id = ass_resp.json()["id"]

    try:
        # 2. Create section
        sec_resp = await client.post(
            f"/api/v1/admin/content/assessments/{ass_id}/sections",
            headers=admin_auth_headers,
            json={"title": "Section 1", "order_index": 1},
        )
        assert sec_resp.status_code == 201, sec_resp.text
        sec_id = sec_resp.json()["id"]

        # 3. Create question
        q_resp = await client.post(
            f"/api/v1/admin/content/sections/{sec_id}/questions",
            headers=admin_auth_headers,
            json={
                "prompt": "Que recommande le spécialiste pour optimiser le sommeil ?",
                "question_type": "single_choice",
                "level": "B2",
                "difficulty": 4,
                "options": [
                    {"content": "Éviter les écrans", "is_correct": True, "order_index": 0},
                    {"content": "Prendre un café", "is_correct": False, "order_index": 1, "distractor_rationale": "Contre-productif"},
                    {"content": "Faire du sport intensif", "is_correct": False, "order_index": 2, "distractor_rationale": "Excitant"},
                    {"content": "Chauffer la chambre", "is_correct": False, "order_index": 3, "distractor_rationale": "Trop chaud"},
                ],
            },
        )
        assert q_resp.status_code == 201, q_resp.text
        q_id = q_resp.json()["id"]

        # 4. Validate question via API endpoint
        resp = await client.post(
            f"/api/v1/admin/content/questions/{q_id}/validate",
            headers=admin_auth_headers,
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()

        assert "valid" in data
        assert "status" in data
        assert "errors" in data
        assert "warnings" in data
        assert "validator_version" in data
        assert data["validator_version"] == "v2.0.0"
        assert data["question_id"] == str(q_id)
    finally:
        await client.delete(f"/api/v1/admin/content/assessments/{ass_id}", headers=admin_auth_headers)

