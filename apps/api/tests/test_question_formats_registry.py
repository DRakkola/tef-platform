"""Regression tests for the server-driven TEF question format registry.

Covers the catalogue contract, format coercion, payload normalisation, and the
draft-persistence invariants that the registry refactor had to fix.
"""

import hashlib
import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.admin.ai_question_schemas import (
    AIQuestionGenerationRequest,
    CandidateGenerationMetadata,
    CandidateOptionPayload,
    GeneratedQuestionCandidate,
)
from app.modules.admin.ai_question_service import AIQuestionGenerationService
from app.modules.admin.enums import ContentStatus
from app.modules.admin.question_formats import (
    MODULE_LABELS,
    QUESTION_FORMAT_SPECS,
    RESPONSE_GAP_FILL,
    RESPONSE_LONG_TEXT,
    RESPONSE_MATCHING,
    RESPONSE_MULTIPLE_CHOICE,
    RESPONSE_ORDERING,
    RESPONSE_SHORT_TEXT,
    RESPONSE_SINGLE_CHOICE,
    RESPONSE_SPOKEN_RESPONSE,
    accepts_response_type,
    catalog_payload,
    get_spec,
    prompt_template_version_for,
    response_type_uses_options,
    specs_for_module,
    standard_option_count_for,
)
from app.modules.assessments.enums import AssessmentType, QuestionResponseType, QuestionType
from app.modules.assessments.item_hash import compute_item_hash
from app.modules.assessments.models import (
    Assessment,
    AssessmentSection,
    AssessmentSectionQuestion,
    QuestionOption,
)

# ---------------------------------------------------------------------------
# Catalogue contract
# ---------------------------------------------------------------------------


def test_local_response_constants_match_the_enum() -> None:
    """The registry duplicates format strings to avoid an import cycle.

    Guard that duplication so the two definitions cannot drift.
    """
    assert RESPONSE_SINGLE_CHOICE == QuestionResponseType.SINGLE_CHOICE.value
    assert RESPONSE_MULTIPLE_CHOICE == QuestionResponseType.MULTIPLE_CHOICE.value
    assert RESPONSE_MATCHING == QuestionResponseType.MATCHING.value
    assert RESPONSE_ORDERING == QuestionResponseType.ORDERING.value
    assert RESPONSE_GAP_FILL == QuestionResponseType.GAP_FILL.value
    assert RESPONSE_SHORT_TEXT == QuestionResponseType.SHORT_TEXT.value
    assert RESPONSE_LONG_TEXT == QuestionResponseType.LONG_TEXT.value
    assert RESPONSE_SPOKEN_RESPONSE == QuestionResponseType.SPOKEN_RESPONSE.value


def test_every_allowed_response_type_is_a_real_enum_value() -> None:
    valid = {e.value for e in QuestionResponseType}
    for spec in QUESTION_FORMAT_SPECS.values():
        for response_type in spec.allowed_response_types:
            assert response_type in valid, f"{spec.code} declares unknown {response_type}"


def test_standard_option_count_is_derived_from_the_registry() -> None:
    # Four choices remains the norm for single choice.
    assert standard_option_count_for(QuestionResponseType.SINGLE_CHOICE.value) == (4, 4)
    # Ordering families allow a wider band.
    assert standard_option_count_for(QuestionResponseType.ORDERING.value) == (4, 6)
    # Unknown formats fall back to the TEF default rather than raising.
    assert standard_option_count_for("nope") == (4, 4)


def test_accepts_response_type_is_permissive_for_unknown_tasks() -> None:
    assert accepts_response_type("document_matching", "matching") is True
    assert accepts_response_type("document_matching", "single_choice") is False
    # Pre-registry task types must keep validating.
    assert accepts_response_type("legacy_task", "whatever") is True


def test_registry_covers_every_module() -> None:
    assert set(specs_for_module("reading"))
    assert set(specs_for_module("listening"))
    assert set(specs_for_module("lexique_structure"))
    assert set(specs_for_module("writing"))
    assert set(specs_for_module("speaking"))
    assert set(MODULE_LABELS) >= {
        "reading",
        "listening",
        "lexique_structure",
        "writing",
        "speaking",
    }


def test_registry_entry_count_is_stable() -> None:
    # 10 reading + 6 listening + 4 lexique + 2 writing + 2 speaking.
    assert len(QUESTION_FORMAT_SPECS) == 24


def test_every_spec_has_a_unique_prompt_template_version() -> None:
    versions = [s.prompt_template_version for s in QUESTION_FORMAT_SPECS.values()]
    assert len(versions) == len(set(versions))


def test_prompt_template_version_lookup_defaults_to_generic() -> None:
    assert prompt_template_version_for("press_article") == "tef_press_article_gen_v3.0"
    assert prompt_template_version_for("does-not-exist") == "tef_qgen_v3.0"
    assert prompt_template_version_for(None) == "tef_qgen_v3.0"


def test_ordering_family_uses_options() -> None:
    # Ordering persists QuestionOption rows; scoring_payload.sequence holds their UUIDs.
    assert get_spec("text_ordering").uses_options is True


def test_response_type_uses_options_is_narrower_than_family() -> None:
    """A family may offer a choice variant *and* a free-response variant.

    ``text_gap`` allows both ``single_choice`` and ``gap_fill``; code acting on
    one concrete question must consult the item's own response type, otherwise a
    gap-fill variant would wrongly be treated as having distractors.
    """
    spec = get_spec("text_gap")
    assert spec.uses_options is True

    assert response_type_uses_options("single_choice") is True
    assert response_type_uses_options("multiple_choice") is True
    assert response_type_uses_options("ordering") is True

    for free_response in ("gap_fill", "matching", "short_text", "long_text", "spoken_response"):
        assert response_type_uses_options(free_response) is False

    assert response_type_uses_options(None) is False
    assert response_type_uses_options("text_gap") is False


def test_families_without_options_are_flagged() -> None:
    assert get_spec("document_matching").uses_options is False
    assert response_type_uses_options("matching") is False


def test_catalog_payload_is_json_serialisable_and_lists_formats() -> None:
    payload = catalog_payload()
    assert {m["code"] for m in payload["modules"]} >= {
        "reading",
        "listening",
        "lexique_structure",
        "writing",
        "speaking",
    }
    assert {s["code"] for s in payload["stimulus_kinds"]}
    assert len(payload["formats"]) == len(QUESTION_FORMAT_SPECS)
    assert {f["code"] for f in payload["formats"]} == set(QUESTION_FORMAT_SPECS)


# ---------------------------------------------------------------------------
# Coercion
# ---------------------------------------------------------------------------


def test_coerce_response_type_falls_back_to_family_default() -> None:
    spec = get_spec("document_matching")
    assert spec is not None
    assert spec.coerce_response_type("matching") == QuestionResponseType.MATCHING.value
    # single_choice is not offered by document_matching, so the default wins.
    assert spec.coerce_response_type("single_choice") == QuestionResponseType.MATCHING.value
    assert spec.coerce_response_type(None) == QuestionResponseType.MATCHING.value


def test_coerce_response_type_respects_allowed_variants() -> None:
    spec = get_spec("text_gap")
    assert spec is not None
    assert spec.coerce_response_type("gap_fill") == QuestionResponseType.GAP_FILL.value
    assert spec.coerce_response_type("single_choice") == QuestionResponseType.SINGLE_CHOICE.value


def test_coerce_option_count_clamps_to_family_range() -> None:
    spec = get_spec("press_article")
    assert spec is not None
    assert spec.coerce_option_count(4) == 4
    # Below the family minimum.
    assert spec.coerce_option_count(1) == spec.option_count[0]
    # Above the family maximum.
    assert spec.coerce_option_count(9) == spec.option_count[1]
    # Unset means "use the family default" (its maximum).
    assert spec.coerce_option_count(None) == spec.option_count[1]


def test_specs_without_options_coerce_to_none() -> None:
    for code in ("reformulation", "fait_divers", "opinion_letter"):
        spec = get_spec(code)
        assert spec is not None
        assert spec.option_count == (0, 0)
        assert spec.coerce_option_count(4) is None
        assert spec.coerce_option_count(None) is None


# ---------------------------------------------------------------------------
# Scoring payload normalisation
# ---------------------------------------------------------------------------


def test_matching_pairs_dict_is_normalised_to_list() -> None:
    payload = AIQuestionGenerationService._extract_scoring_payload(
        {"scoring_payload": {"pairs": {"besoin_1": "doc_a"}}}, "matching"
    )
    assert payload is not None
    assert payload["pairs"] == [{"source_id": "besoin_1", "target_id": "doc_a"}]


def test_matching_pairs_legacy_tuple_form_is_accepted() -> None:
    payload = AIQuestionGenerationService._extract_scoring_payload(
        {"scoring_payload": {"pairs": [["s1", "t1"], ["s2", "t2"]]}}, "matching"
    )
    assert payload is not None
    assert payload["pairs"] == [
        {"source_id": "s1", "target_id": "t1"},
        {"source_id": "s2", "target_id": "t2"},
    ]


def test_ordering_sequence_derived_from_item_positions() -> None:
    payload = AIQuestionGenerationService._extract_scoring_payload(
        {
            "scoring_payload": {
                "items": [
                    {"id": "seg_1", "text": "b", "correct_position": 2},
                    {"id": "seg_2", "text": "a", "correct_position": 1},
                ]
            }
        },
        "ordering",
    )
    assert payload is not None
    assert payload["sequence"] == ["seg_2", "seg_1"]


def test_gap_fill_accepts_correct_answer_shorthand() -> None:
    payload = AIQuestionGenerationService._extract_scoring_payload(
        {"scoring_payload": {"gaps": [{"index": 1, "correct_answer": "cependant"}]}}, "gap_fill"
    )
    assert payload is not None
    assert payload["gaps"][0]["accepted_answers"] == ["cependant"]


def test_short_text_normalises_single_string_answer() -> None:
    payload = AIQuestionGenerationService._extract_scoring_payload(
        {"scoring_payload": {"accepted_answers": "la reponse"}}, "short_text"
    )
    assert payload is not None
    assert payload["accepted_answers"] == ["la reponse"]


def test_missing_scoring_payload_returns_none() -> None:
    assert AIQuestionGenerationService._extract_scoring_payload({}, "matching") is None
    assert AIQuestionGenerationService._extract_scoring_payload({}, "short_text") is None


# ---------------------------------------------------------------------------
# Parse usability gate
# ---------------------------------------------------------------------------


def test_choice_parse_requires_a_correct_option() -> None:
    good = {"prompt": "Q ?", "options": [{"content": "A", "is_correct": True}, {"content": "B"}]}
    bad = {"prompt": "Q ?", "options": [{"content": "A"}, {"content": "B"}]}
    assert AIQuestionGenerationService._is_parse_usable(good, "single_choice") is True
    assert AIQuestionGenerationService._is_parse_usable(bad, "single_choice") is False


def test_matching_parse_requires_pairs() -> None:
    assert (
        AIQuestionGenerationService._is_parse_usable(
            {"prompt": "Q ?", "scoring_payload": {"pairs": [{"source_id": "s", "target_id": "t"}]}},
            "matching",
        )
        is True
    )
    assert AIQuestionGenerationService._is_parse_usable({"prompt": "Q ?"}, "matching") is False


# ---------------------------------------------------------------------------
# Draft persistence invariants
# ---------------------------------------------------------------------------


def _ordering_candidate() -> GeneratedQuestionCandidate:
    return GeneratedQuestionCandidate(
        prompt="Remettez les segments dans l'ordre du recit.",
        response_type=QuestionResponseType.ORDERING.value,
        target_cefr="B2",
        stimulus_title=None,
        stimulus_content=None,
        options=[],
        skill_mappings=[],
        scoring_payload={
            "items": [
                {"id": "seg_1", "text": "Le train part."},
                {"id": "seg_2", "text": "Il pleuvait fort."},
                {"id": "seg_3", "text": "Le voyage s'acheva."},
            ],
            "sequence": ["seg_2", "seg_1", "seg_3"],
        },
        generation_metadata=CandidateGenerationMetadata(
            model="models/gemini-3.5-flash",
            prompt_template_version="tef_text_ordering_gen_v3.0",
            is_simulation=True,
        ),
        status="pending_review",
    )


@pytest.mark.asyncio
async def test_ordering_draft_rebinds_sequence_to_option_uuids(
    db_session: AsyncSession,
) -> None:
    candidate = _ordering_candidate()
    question = await AIQuestionGenerationService.create_draft_from_candidate(
        db=db_session, candidate=candidate, actor_id=uuid.uuid4()
    )

    payload = question.scoring_payload or {}
    sequence = payload.get("sequence") or []
    option_ids = [str(o.id) for o in question.options]
    assert option_ids, "ordering drafts must persist option rows"
    assert sequence == option_ids, "sequence must reference persisted option UUIDs"
    # Ordinals from the candidate must not leak into the stored payload.
    assert "seg_1" not in sequence
    assert [item["id"] for item in payload["items"]] == option_ids
    assert question.question_type == QuestionType.TEXT_INPUT
    assert question.response_type == QuestionResponseType.ORDERING.value
    assert question.status == ContentStatus.DRAFT.value


@pytest.mark.asyncio
async def test_ordering_draft_honours_candidate_order(
    db_session: AsyncSession,
) -> None:
    candidate = _ordering_candidate()
    question = await AIQuestionGenerationService.create_draft_from_candidate(
        db=db_session, candidate=candidate, actor_id=uuid.uuid4()
    )
    ordered = sorted(question.options, key=lambda o: o.order_index)
    assert [o.content for o in ordered] == [
        "Il pleuvait fort.",
        "Le train part.",
        "Le voyage s'acheva.",
    ]


@pytest.mark.asyncio
async def test_choice_draft_preserves_distractor_metadata(
    db_session: AsyncSession,
) -> None:
    candidate = GeneratedQuestionCandidate(
        prompt="Quelle proposition est exacte ?",
        response_type=QuestionResponseType.SINGLE_CHOICE.value,
        target_cefr="B2",
        stimulus_title="Doc",
        stimulus_content="Un contenu de support suffisamment long pour etre conserve.",
        options=[
            CandidateOptionPayload(
                content="Bonne reponse",
                is_correct=True,
                order_index=0,
                explanation="Preuve textuelle.",
            ),
            CandidateOptionPayload(
                content="Mauvaise reponse",
                is_correct=False,
                order_index=1,
                explanation="Non mentionne.",
                misconception_type="extrapolation",
                distractor_rationale="Le mot 'projet' apparait ailleurs.",
            ),
        ],
        skill_mappings=[],
        generation_metadata=CandidateGenerationMetadata(
            model="models/gemini-3.5-flash",
            prompt_template_version="tef_press_article_gen_v3.0",
            is_simulation=True,
        ),
        status="pending_review",
    )
    question = await AIQuestionGenerationService.create_draft_from_candidate(
        db=db_session, candidate=candidate, actor_id=uuid.uuid4()
    )

    distractor = next(o for o in question.options if not o.is_correct)
    assert distractor.misconception_type == "extrapolation"
    assert distractor.distractor_rationale == "Le mot 'projet' apparait ailleurs."


@pytest.mark.asyncio
async def test_draft_persists_canonical_item_hash(db_session: AsyncSession) -> None:
    """Draft persistence must populate item_hash so the duplicate index works."""
    candidate = GeneratedQuestionCandidate(
        prompt="  Quelle   ligne est\n interrompue ?  ",
        response_type="short_text",
        target_cefr="B2",
        accepted_answers=["La ligne B"],
        options=[],
        skill_mappings=[],
        generation_metadata=CandidateGenerationMetadata(
            model="models/gemini-3.5-flash",
            prompt_template_version="tef_reformulation_gen_v3.0",
            is_simulation=True,
        ),
        status="pending_review",
    )
    question = await AIQuestionGenerationService.create_draft_from_candidate(
        db=db_session, candidate=candidate, actor_id=uuid.uuid4()
    )

    assert question.item_hash == compute_item_hash(candidate.prompt)
    assert question.item_hash == hashlib.sha256(
        b"quelle ligne est interrompue ?"
    ).hexdigest()


@pytest.mark.asyncio
async def test_draft_rejects_invalid_response_type(db_session: AsyncSession) -> None:
    candidate = GeneratedQuestionCandidate(
        prompt="Q ?",
        response_type="not_a_real_format",  # type: ignore[arg-type]
        target_cefr="B2",
        options=[],
        skill_mappings=[],
        generation_metadata=CandidateGenerationMetadata(
            model="models/gemini-3.5-flash",
            prompt_template_version="tef_press_article_gen_v3.0",
            is_simulation=True,
        ),
        status="pending_review",
    )
    with pytest.raises(ValueError, match="Unsupported response_type"):
        await AIQuestionGenerationService.create_draft_from_candidate(
            db=db_session, candidate=candidate, actor_id=uuid.uuid4()
        )


@pytest.mark.asyncio
async def test_draft_links_to_assessment_section(db_session: AsyncSession) -> None:
    assessment = Assessment(
        title="Mock reading exam",
        assessment_type=AssessmentType.READING,
        duration_seconds=1800,
    )
    db_session.add(assessment)
    await db_session.flush()

    section = AssessmentSection(
        assessment_id=assessment.id,
        title="Section A",
        order_index=1,
    )
    db_session.add(section)
    await db_session.flush()

    candidate = GeneratedQuestionCandidate(
        prompt="Q ?",
        response_type=QuestionResponseType.SINGLE_CHOICE.value,
        target_cefr="B2",
        stimulus_title="Doc",
        stimulus_content="Un contenu de support pour la question.",
        options=[
            CandidateOptionPayload(content="A", is_correct=True, order_index=0),
            CandidateOptionPayload(content="B", is_correct=False, order_index=1),
        ],
        skill_mappings=[],
        generation_metadata=CandidateGenerationMetadata(
            model="models/gemini-3.5-flash",
            prompt_template_version="tef_press_article_gen_v3.0",
            is_simulation=True,
        ),
        status="pending_review",
    )
    question = await AIQuestionGenerationService.create_draft_from_candidate(
        db=db_session, candidate=candidate, actor_id=uuid.uuid4(), section_id=section.id
    )

    links = (
        await db_session.execute(
            select(AssessmentSectionQuestion).where(
                AssessmentSectionQuestion.question_id == question.id
            )
        )
    ).scalars().all()
    assert len(links) == 1
    assert links[0].assessment_section_id == section.id


# ---------------------------------------------------------------------------
# Generation smoke coverage per response format
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("task_code", "response_type"),
    [
        ("document_matching", QuestionResponseType.MATCHING.value),
        ("text_ordering", QuestionResponseType.ORDERING.value),
        ("reformulation", QuestionResponseType.SHORT_TEXT.value),
        ("fait_divers", QuestionResponseType.LONG_TEXT.value),
        ("information_gathering", QuestionResponseType.SPOKEN_RESPONSE.value),
    ],
)
@pytest.mark.asyncio
async def test_generation_supports_non_choice_formats(
    db_session: AsyncSession, task_code: str, response_type: str
) -> None:
    request = AIQuestionGenerationRequest(
        modality=get_spec(task_code).module,  # type: ignore[union-attr]
        task_type_code=task_code,
        response_type=response_type,
        target_cefr="B2",
        count=1,
        force_simulation=True,
    )
    response = await AIQuestionGenerationService.generate_candidates(
        db=db_session, request=request
    )
    candidate = response.candidates[0]
    assert candidate.task_type_code == task_code
    assert candidate.response_type == response_type
    assert candidate.format_spec_version == get_spec(task_code).prompt_template_version  # type: ignore[union-attr]

    question = await AIQuestionGenerationService.create_draft_from_candidate(
        db=db_session, candidate=candidate, actor_id=uuid.uuid4()
    )
    assert question.status == ContentStatus.DRAFT.value
    assert question.response_type == response_type


@pytest.mark.asyncio
async def test_lexique_structure_generation_uses_registry(db_session: AsyncSession) -> None:
    request = AIQuestionGenerationRequest(
        modality="lexique_structure",
        task_type_code="adjective_agreement",
        target_cefr="B2",
        count=1,
        force_simulation=True,
    )
    response = await AIQuestionGenerationService.generate_candidates(
        db=db_session, request=request
    )
    candidate = response.candidates[0]
    assert candidate.task_type_code == "adjective_agreement"
    # Lexique families are prompt-only: no separate stimulus document.
    assert candidate.stimulus_id is None
    assert candidate.stimulus_content is None


@pytest.mark.asyncio
async def test_question_options_persist_no_section_leak(db_session: AsyncSession) -> None:
    """Sanity check that draft creation leaves a consistent option set behind."""
    candidate = GeneratedQuestionCandidate(
        prompt="Q ?",
        response_type=QuestionResponseType.SINGLE_CHOICE.value,
        target_cefr="B2",
        stimulus_title="Doc",
        stimulus_content="Un contenu de support.",
        options=[
            CandidateOptionPayload(content="A", is_correct=True, order_index=0),
            CandidateOptionPayload(content="B", is_correct=False, order_index=1),
        ],
        skill_mappings=[],
        generation_metadata=CandidateGenerationMetadata(
            model="models/gemini-3.5-flash",
            prompt_template_version="tef_press_article_gen_v3.0",
            is_simulation=True,
        ),
        status="pending_review",
    )
    question = await AIQuestionGenerationService.create_draft_from_candidate(
        db=db_session, candidate=candidate, actor_id=uuid.uuid4()
    )
    stored = (
        await db_session.execute(
            select(QuestionOption).where(QuestionOption.question_id == question.id)
        )
    ).scalars().all()
    assert len(stored) == 2
    assert {o.content for o in stored} == {"A", "B"}
    assert sum(1 for o in stored if o.is_correct) == 1
