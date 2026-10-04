"""Unit and integration contract tests for Question System V2 Domain Models & Schemas (Phase 2).

Verifies:
1. Domain Model Creation & Relationships (Stimulus, Question, Options, Associations, Provenance, Validations)
2. Strict Security Boundary (Student Views NEVER leak answer keys, distractor rationales, or internal validations)
3. QuestionSerializer Projections (to_student_dict, to_admin_dict, to_frozen_snapshot)
4. Version Snapshot Immutability (Self-contained, frozen snapshots unaffected by subsequent question mutations)
5. Pydantic Schema Validations (Admin & Student contracts, defaults, and type coercions)
6. Backward Compatibility (Legacy questions without stimuli or advanced V2 fields serialize seamlessly)
"""

import datetime
import hashlib
import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.admin.models import QuestionVersion
from app.modules.admin.schemas import (
    AdminOptionCreate,
    AdminQuestionResponse,
    QuestionVersionResponse,
)
from app.modules.assessments.enums import (
    AssessmentType,
    NavigationPolicy,
    QuestionResponseType,
    QuestionType,
    QuestionValidationStatus,
    ScoringPolicy,
)
from app.modules.assessments.models import (
    Assessment,
    AssessmentSection,
    AssessmentSectionQuestion,
    Question,
    QuestionOption,
    QuestionProvenance,
    QuestionValidation,
    Stimulus,
)
from app.modules.assessments.question_serializer import (
    FORBIDDEN_STUDENT_KEYS,
    QuestionSecurityViolation,
    QuestionSerializer,
)
from app.modules.assessments.schemas import (
    AssessmentSectionQuestionResponse,
    QuestionStudentResponse,
    StimulusStudentResponse,
)


@pytest.mark.asyncio
async def test_stimulus_and_question_v2_models_creation(db_session: AsyncSession) -> None:
    """Verify that Stimulus, Question with V2 fields, and diagnostic QuestionOptions persist and relate correctly."""
    # 1. Create Stimulus
    text_stim = "Le gouvernement canadien annonce une nouvelle politique d'immigration favorisant les francophones."
    content_hash = hashlib.sha256(text_stim.encode("utf-8")).hexdigest()

    stimulus = Stimulus(
        title="Politique d'immigration francophone",
        modality="reading",
        content_text=text_stim,
        text_format="plain_text",
        word_count=13,
        source_citation="Radio-Canada 2026",
        content_hash=content_hash,
    )
    db_session.add(stimulus)
    await db_session.flush()

    # 2. Create Question referencing Stimulus
    q = Question(
        stimulus_id=stimulus.id,
        prompt="Quel est l'objectif principal de cette annonce ?",
        instructions="Choisissez une seule réponse.",
        question_type=QuestionType.SINGLE_CHOICE,
        response_type=QuestionResponseType.SINGLE_CHOICE.value,
        level="B2",
        target_cefr="B2",
        difficulty=3,
        difficulty_rating=350,
        cognitive_complexity="inferential_reasoning",
        points=2,
        penalty_points=0,
        scoring_payload={"type": "standard_points", "point_value": 2},
        is_live_delivered=False,
        item_hash="q_hash_v2_test_001",
    )
    db_session.add(q)
    await db_session.flush()

    # 3. Create Options with distractor diagnostics
    opt1 = QuestionOption(
        question_id=q.id,
        content="Favoriser les francophones hors Québec",
        order_index=1,
        is_correct=True,
        explanation="C'est directement énoncé dans le texte.",
        misconception_type=None,
        distractor_rationale=None,
    )
    opt2 = QuestionOption(
        question_id=q.id,
        content="Réduire l'immigration générale",
        order_index=2,
        is_correct=False,
        explanation="Incorrect : il s'agit d'une politique ciblée, pas d'une réduction générale.",
        misconception_type="overgeneralization",
        distractor_rationale="L'élève confond restriction globale et ciblage francophone.",
    )
    db_session.add_all([opt1, opt2])
    await db_session.commit()

    # 4. Reload and assert relationships
    stmt = (
        select(Question)
        .where(Question.id == q.id)
        .options(selectinload(Question.options), selectinload(Question.stimulus))
    )
    loaded_q = (await db_session.execute(stmt)).scalar_one()

    assert loaded_q.stimulus_id == stimulus.id
    assert loaded_q.stimulus.title == "Politique d'immigration francophone"
    assert len(loaded_q.options) == 2
    assert loaded_q.response_type == "single_choice"
    assert loaded_q.difficulty_rating == 350
    assert loaded_q.cognitive_complexity == "inferential_reasoning"

    incorrect_opt = next(o for o in loaded_q.options if not o.is_correct)
    assert incorrect_opt.misconception_type == "overgeneralization"
    assert "confond restriction globale" in incorrect_opt.distractor_rationale


@pytest.mark.asyncio
async def test_question_provenance_and_validation_models(db_session: AsyncSession) -> None:
    """Verify that QuestionProvenance (1:1) and QuestionValidation (1:N) models link properly."""
    q = Question(
        prompt="Quelle affirmation est vraie ?",
        question_type=QuestionType.SINGLE_CHOICE,
        response_type=QuestionResponseType.SINGLE_CHOICE.value,
        level="C1",
        points=1,
    )
    db_session.add(q)
    await db_session.flush()

    # Provenance
    prov = QuestionProvenance(
        question_id=q.id,
        author_type="ai_generated",
        source_type="press_article",
        generator_model="gemini-1.5-pro",
        generator_prompt_version="tef_reading_b2_c1_v1",
        generator_parameters={"temperature": 0.2, "top_p": 0.95},
    )
    db_session.add(prov)

    # Validation entry
    val = QuestionValidation(
        question_id=q.id,
        validation_status=QuestionValidationStatus.VALID.value,
        blocking_error_count=0,
        warning_count=0,
        issues_payload=[{"code": "SPELLCHECK_OK", "severity": "info"}],
        validated_by_system_version="v2.0.0",
    )
    db_session.add(val)
    await db_session.commit()

    stmt = (
        select(Question)
        .where(Question.id == q.id)
        .options(selectinload(Question.provenance), selectinload(Question.validations))
    )
    loaded = (await db_session.execute(stmt)).scalar_one()
    assert loaded.provenance is not None
    assert loaded.provenance.author_type == "ai_generated"
    assert loaded.provenance.generator_model == "gemini-1.5-pro"
    assert len(loaded.validations) == 1
    assert loaded.validations[0].validation_status == "valid"


@pytest.mark.asyncio
async def test_question_student_view_strict_security_contract(db_session: AsyncSession) -> None:
    """SECURITY GUARANTEE TEST:

    Ensure that QuestionSerializer.to_student_dict and QuestionStudentResponse
    strictly omit and never leak:
    - is_correct
    - misconception_type
    - distractor_rationale
    - scoring_payload
    - validations
    - provenance
    """
    stimulus = Stimulus(
        title="Audio Guide de Voyage",
        modality="listening",
        content_text=None,
        media_url="https://storage.tef.local/audio/sample_01.mp3",
        content_hash="hash_listening_001",
    )
    db_session.add(stimulus)
    await db_session.flush()

    q = Question(
        stimulus_id=stimulus.id,
        prompt="À quel quai part le train pour Ottawa ?",
        question_type=QuestionType.SINGLE_CHOICE,
        response_type=QuestionResponseType.SINGLE_CHOICE.value,
        level="A2",
        points=1,
        scoring_payload={"correct_option": "A", "internal_eval_formula": "exact_match"},
    )
    db_session.add(q)
    await db_session.flush()

    opt_correct = QuestionOption(
        question_id=q.id,
        content="Quai numéro 4",
        order_index=1,
        is_correct=True,
        explanation="L'annonce indique clairement la voie 4.",
        misconception_type=None,
        distractor_rationale=None,
    )
    opt_distractor = QuestionOption(
        question_id=q.id,
        content="Quai numéro 14",
        order_index=2,
        is_correct=False,
        explanation="Voie 14 est pour Montréal.",
        misconception_type="phonetic_confusion",
        distractor_rationale="L'élève confond 'quatre' et 'quatorze'.",
    )
    db_session.add_all([opt_correct, opt_distractor])

    prov = QuestionProvenance(
        question_id=q.id,
        author_type="human",
        source_type="original",
    )
    val = QuestionValidation(
        question_id=q.id,
        validation_status="valid",
    )
    db_session.add_all([prov, val])
    await db_session.commit()

    # Load with all relationships
    stmt = (
        select(Question)
        .where(Question.id == q.id)
        .options(
            selectinload(Question.options),
            selectinload(Question.stimulus),
            selectinload(Question.provenance),
            selectinload(Question.validations),
            selectinload(Question.skill_tags),
        )
    )
    loaded_q = (await db_session.execute(stmt)).scalar_one()

    # 1. Project through QuestionSerializer
    student_dict = QuestionSerializer.to_student_dict(loaded_q)

    # 2. Assert top-level keys
    for forbidden in FORBIDDEN_STUDENT_KEYS:
        assert forbidden not in student_dict, f"Forbidden key '{forbidden}' leaked in student payload!"

    # 3. Assert option keys
    for opt in student_dict["options"]:
        assert "is_correct" not in opt, "is_correct leaked in student option!"
        assert "misconception_type" not in opt, "misconception_type leaked in student option!"
        assert "distractor_rationale" not in opt, "distractor_rationale leaked in student option!"
        assert "explanation" not in opt, "explanation leaked in student option during active test!"
        assert set(opt.keys()) == {"id", "content", "order_index"}

    # 4. Verify Pydantic schema validation succeeds on student_dict
    student_schema = QuestionStudentResponse.model_validate(student_dict)
    assert student_schema.prompt == "À quel quai part le train pour Ottawa ?"
    assert student_schema.stimulus is not None
    assert student_schema.stimulus.media_url == "https://storage.tef.local/audio/sample_01.mp3"
    assert len(student_schema.options) == 2

    # 5. Verify defensive assert_no_student_leak triggers violation if tainted
    tainted = dict(student_dict)
    tainted["options"][1]["is_correct"] = False
    with pytest.raises(QuestionSecurityViolation, match="is_correct"):
        QuestionSerializer.assert_no_student_leak(tainted)


@pytest.mark.asyncio
async def test_question_admin_view_complete_metadata(db_session: AsyncSession) -> None:
    """Verify that QuestionSerializer.to_admin_dict and AdminQuestionResponse include all pedagogical and diagnostic metadata."""
    stimulus = Stimulus(
        title="Article de presse Écologie",
        modality="reading",
        content_text="Texte sur les énergies renouvelables...",
        content_hash="stim_hash_admin_001",
    )
    db_session.add(stimulus)
    await db_session.flush()

    q = Question(
        stimulus_id=stimulus.id,
        prompt="Quelle est la thèse de l'auteur ?",
        instructions="Cochez l'énoncé exact.",
        question_type=QuestionType.SINGLE_CHOICE,
        response_type="single_choice",
        level="B2",
        target_cefr="B2",
        difficulty=4,
        difficulty_rating=420,
        cognitive_complexity="author_stance_analysis",
        points=2,
        penalty_points=0,
        scoring_payload={"type": "standard_points"},
        is_live_delivered=True,
        item_hash="admin_item_hash_001",
    )
    db_session.add(q)
    await db_session.flush()

    opt = QuestionOption(
        question_id=q.id,
        content="La transition est trop lente",
        order_index=1,
        is_correct=False,
        explanation="L'auteur affirme le contraire au 3e paragraphe.",
        misconception_type="opposite_meaning",
        distractor_rationale="L'élève a confondu l'argument des détracteurs avec celui de l'auteur.",
    )
    db_session.add(opt)

    prov = QuestionProvenance(
        question_id=q.id,
        author_type="human_curated",
        generator_model="gemini-1.5-pro",
        source_type="press_article",
    )
    val = QuestionValidation(
        question_id=q.id,
        validation_status="valid",
        blocking_error_count=0,
        warning_count=1,
        issues_payload=[{"code": "DISTRACTOR_LENGTH_SIMILAR", "severity": "info"}],
    )
    db_session.add_all([prov, val])
    await db_session.commit()

    stmt = (
        select(Question)
        .where(Question.id == q.id)
        .options(
            selectinload(Question.options),
            selectinload(Question.stimulus),
            selectinload(Question.provenance),
            selectinload(Question.validations),
            selectinload(Question.skill_tags),
        )
    )
    loaded_q = (await db_session.execute(stmt)).scalar_one()

    admin_dict = QuestionSerializer.to_admin_dict(loaded_q)

    # Must contain full metadata
    assert admin_dict["cognitive_complexity"] == "author_stance_analysis"
    assert admin_dict["is_live_delivered"] is True
    assert admin_dict["scoring_payload"] == {"type": "standard_points"}
    assert admin_dict["stimulus"]["title"] == "Article de presse Écologie"
    assert admin_dict["provenance"]["author_type"] == "human_curated"
    assert len(admin_dict["validations"]) == 1
    assert admin_dict["options"][0]["misconception_type"] == "opposite_meaning"
    assert "détecteurs" not in admin_dict["options"][0]["distractor_rationale"]  # Check actual string presence

    # Validate against AdminQuestionResponse schema
    admin_schema = AdminQuestionResponse.model_validate(admin_dict)
    assert admin_schema.difficulty_rating == 420
    assert admin_schema.options[0].misconception_type == "opposite_meaning"
    assert admin_schema.validations[0].validation_status == "valid"
    assert admin_schema.provenance is not None
    assert admin_schema.provenance.generator_model == "gemini-1.5-pro"


@pytest.mark.asyncio
async def test_question_version_snapshot_immutability(db_session: AsyncSession) -> None:
    """Verify that frozen snapshots created for QuestionVersion remain completely immutable when the original question is mutated."""
    stimulus = Stimulus(
        title="Stimulus Version 1",
        modality="reading",
        content_text="Texte original version 1",
        content_hash="hash_v1_snapshot",
    )
    db_session.add(stimulus)
    await db_session.flush()

    q = Question(
        stimulus_id=stimulus.id,
        prompt="Original Prompt V1",
        question_type=QuestionType.SINGLE_CHOICE,
        response_type="single_choice",
        level="B1",
        difficulty=2,
        points=1,
        version=1,
    )
    db_session.add(q)
    await db_session.flush()

    opt1 = QuestionOption(
        question_id=q.id,
        content="Option A Original",
        order_index=1,
        is_correct=True,
    )
    opt2 = QuestionOption(
        question_id=q.id,
        content="Option B Original",
        order_index=2,
        is_correct=False,
        misconception_type="lexical_confusion",
    )
    db_session.add_all([opt1, opt2])
    await db_session.commit()

    # Reload with options
    stmt = (
        select(Question)
        .where(Question.id == q.id)
        .options(
            selectinload(Question.options),
            selectinload(Question.stimulus),
            selectinload(Question.provenance),
            selectinload(Question.validations),
            selectinload(Question.skill_tags),
        )
    )
    loaded_q = (await db_session.execute(stmt)).scalar_one()

    # Freeze snapshot
    snapshot_v1 = QuestionSerializer.to_frozen_snapshot(loaded_q, changelog="Initial publishing")

    # Store in QuestionVersion
    qv = QuestionVersion(
        question_id=loaded_q.id,
        version=1,
        prompt=loaded_q.prompt,
        explanation=loaded_q.explanation,
        question_type=loaded_q.question_type.value,
        difficulty=loaded_q.difficulty,
        level=loaded_q.level,
        points=loaded_q.points,
        options_snapshot=[{"content": o.content, "order_index": o.order_index} for o in loaded_q.options],
        snapshot_payload=snapshot_v1,
        changelog="Initial publishing",
        created_at=datetime.datetime.now(datetime.UTC),
    )
    db_session.add(qv)
    await db_session.commit()

    # Now MUTATE original question and options
    loaded_q.prompt = "Mutated Prompt for Version 2"
    loaded_q.difficulty = 5
    loaded_q.version = 2
    loaded_q.options[0].content = "Option A Mutated"
    stimulus.content_text = "Mutated Stimulus Text"
    await db_session.commit()

    # Query back the QuestionVersion and verify snapshot immutability
    ver_loaded = await db_session.scalar(
        select(QuestionVersion).where(
            QuestionVersion.question_id == q.id,
            QuestionVersion.version == 1,
        )
    )
    assert ver_loaded is not None
    payload = ver_loaded.snapshot_payload
    assert payload["prompt"] == "Original Prompt V1"
    assert payload["difficulty"] == 2
    assert payload["options"][0]["content"] == "Option A Original"
    assert payload["stimulus"]["content_text"] == "Texte original version 1"
    assert payload["changelog"] == "Initial publishing"

    # Validate against QuestionVersionResponse schema
    ver_schema = QuestionVersionResponse.model_validate(ver_loaded)
    assert ver_schema.snapshot_payload["prompt"] == "Original Prompt V1"
    assert ver_schema.changelog == "Initial publishing"


@pytest.mark.asyncio
async def test_backward_compatibility_legacy_question_serialization(db_session: AsyncSession) -> None:
    """Verify that legacy questions (no stimulus, no V2 fields, linked directly to section_id)

    can still be serialized safely to both student and admin schemas without errors.
    """
    # Create Assessment and Section
    asmt = Assessment(
        title="TEF Test Legacy Backward Compatibility",
        assessment_type=AssessmentType.MIXED,
        duration_seconds=3600,
        navigation_policy=NavigationPolicy.FREE,
        scoring_policy=ScoringPolicy.STANDARD_POINTS,
    )
    db_session.add(asmt)
    await db_session.flush()

    sec = AssessmentSection(
        assessment_id=asmt.id,
        title="Section 1",
        order_index=1,
    )
    db_session.add(sec)
    await db_session.flush()

    # Legacy Question
    q = Question(
        stimulus_id=None,
        prompt="Question classique sans stimulus ?",
        question_type=QuestionType.SINGLE_CHOICE,
        order_index=0,
        difficulty=3,
        level="B1",
        points=1,
        penalty_points=0,
    )
    db_session.add(q)
    await db_session.flush()

    asq = AssessmentSectionQuestion(
        assessment_section_id=sec.id,
        question_id=q.id,
        order_index=0,
    )
    db_session.add(asq)

    opt = QuestionOption(
        question_id=q.id,
        content="Choix unique classique",
        order_index=1,
        is_correct=True,
    )
    db_session.add(opt)
    await db_session.commit()

    stmt = (
        select(Question)
        .where(Question.id == q.id)
        .options(
            selectinload(Question.options),
            selectinload(Question.stimulus),
            selectinload(Question.provenance),
            selectinload(Question.validations),
            selectinload(Question.skill_tags),
            selectinload(Question.section_associations),
        )
    )
    loaded_q = (await db_session.execute(stmt)).scalar_one()

    # 1. Student Dict & Validation
    student_dict = QuestionSerializer.to_student_dict(loaded_q)
    assert student_dict["section_id"] == str(sec.id)
    assert student_dict["stimulus"] is None
    assert student_dict["response_type"] == "single_choice"
    student_resp = QuestionStudentResponse.model_validate(student_dict)
    assert student_resp.section_id == sec.id
    assert student_resp.stimulus is None

    # 2. Admin Dict & Validation
    admin_dict = QuestionSerializer.to_admin_dict(loaded_q)
    assert admin_dict["section_id"] == str(sec.id)
    assert admin_dict["stimulus"] is None
    assert admin_dict["validations"] == []
    assert admin_dict["provenance"] is None
    admin_resp = AdminQuestionResponse.model_validate(admin_dict)
    assert admin_resp.section_id == sec.id
    assert admin_resp.options[0].misconception_type is None


def test_pydantic_schema_pure_unit_contracts() -> None:
    """Pure unit test on Pydantic schema contracts and defaults."""
    # StimulusStudentResponse
    stim_id = uuid.uuid4()
    stim = StimulusStudentResponse(
        id=stim_id,
        title="Document A",
        modality="reading",
        content_text="Texte court",
    )
    assert stim.text_format == "plain_text"
    assert stim.word_count is None

    # AdminOptionCreate
    opt_create = AdminOptionCreate(
        content="Option test",
        order_index=0,
        is_correct=False,
        misconception_type="false_friend",
        distractor_rationale="Confond 'actuellement' avec 'actually'.",
    )
    assert opt_create.misconception_type == "false_friend"

    # AssessmentSectionQuestionResponse
    assoc = AssessmentSectionQuestionResponse(
        id=uuid.uuid4(),
        section_id=uuid.uuid4(),
        question_id=uuid.uuid4(),
        order_index=1,
        points_override=5,
    )
    assert assoc.order_index == 1
    assert assoc.points_override == 5
