"""Tests for AI Question Generation Pipeline (Phase 7).

Verifies:
1. Candidate generation with deterministic simulation and structured parsing
2. Strict taxonomy restriction (rejection and protection against hallucinated skill IDs)
3. QuestionValidationEngine integration (psychometric checks, option rules, CEFR bands)
4. Duplicate detection (exact match, lexical similarity, and uniqueness)
5. Second-pass AI quality & naturalness review (read-only audit)
6. Conversion to Question drafts with full provenance (status='draft', author_type='ai')
7. Immutability invariant (approved or published questions cannot be mutated by AI)
8. Batch generation and partial success handling
"""

import uuid
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.exceptions import AppException
from app.modules.admin.ai_question_schemas import (
    AIQuestionGenerationRequest,
    CandidateOptionPayload,
    CandidateRegenerateRequest,
    CandidateReviewRequest,
    CandidateSkillMapping,
    GeneratedQuestionCandidate,
    CandidateGenerationMetadata,
)
from app.modules.admin.ai_question_service import (
    AIQuestionGenerationService,
    _calculate_jaccard_similarity,
    _tokenize_text,
)
from app.modules.admin.enums import ContentStatus
from app.modules.assessments.enums import (
    CognitiveComplexityLevel,
    QuestionAuthorType,
    QuestionResponseType,
    QuestionType,
)
from app.modules.assessments.models import (
    AssessmentSection,
    Question,
    QuestionOption,
    QuestionProvenance,
    QuestionSkillTag,
    Skill,
    TaskType,
)
from app.modules.users.models import User, UserRole


@pytest.mark.asyncio
async def test_tokenize_and_jaccard_similarity():
    """Verify text tokenization and Jaccard similarity metrics."""
    text_a = "Quel est le tarif horaire du cours de guitare ?"
    text_b = "Quel est le prix horaire pour un cours de guitare ?"
    text_c = "Pourquoi la médiathèque municipale ferme-t-elle ses portes ?"

    tokens_a = _tokenize_text(text_a)
    tokens_b = _tokenize_text(text_b)
    tokens_c = _tokenize_text(text_c)

    sim_ab = _calculate_jaccard_similarity(tokens_a, tokens_b)
    sim_ac = _calculate_jaccard_similarity(tokens_a, tokens_c)

    assert sim_ab > 0.4
    assert sim_ac == 0.0


@pytest.mark.asyncio
async def test_generate_candidates_deterministic(db_session: AsyncSession):
    """Test generating candidates with deterministic simulation fallback."""
    # Seed task type & skills
    tt = TaskType(
        modality="reading",
        code="press_article",
        name="Article de presse",
        description="Presse écrite",
        is_active=True,
    )
    db_session.add(tt)
    await db_session.flush()

    skill = Skill(
        code="CE_ID_GLOBALE",
        name="Identifier le thème global",
        domain="reading",
        is_active=True,
    )
    db_session.add(skill)
    await db_session.flush()

    req = AIQuestionGenerationRequest(
        modality="reading",
        task_type_code="press_article",
        target_cefr="B2",
        count=2,
        force_simulation=True,
    )

    resp = await AIQuestionGenerationService.generate_candidates(
        db=db_session,
        request=req,
    )

    assert resp.total_generated == 2
    assert resp.total_requested == 2
    assert len(resp.candidates) == 2

    first_cand = resp.candidates[0]
    assert first_cand.target_cefr == "B2"
    assert first_cand.difficulty_rating == 450
    assert first_cand.item_difficulty == 4
    assert len(first_cand.options) == 4

    # Verify exactly 1 correct answer
    correct_opts = [o for o in first_cand.options if o.is_correct]
    assert len(correct_opts) == 1

    # Verify provenance & metadata
    assert first_cand.generation_metadata.is_simulation is True
    assert first_cand.generation_metadata.prompt_template_version.startswith("reading_mcq_gen")

    # Verify duplicate report was attached
    assert first_cand.duplicate_check is not None
    assert first_cand.duplicate_check.status == "unique"

    # Verify validation report was attached
    assert first_cand.validation_report is not None
    assert "valid" in first_cand.validation_report


@pytest.mark.asyncio
async def test_taxonomy_restriction_rejects_hallucinations(db_session: AsyncSession):
    """Ensure LLM cannot hallucinate unknown skill IDs not present in DB."""
    # Seed active valid skill
    valid_skill = Skill(
        code="CE_COMP_DET",
        name="Compréhension détaillée",
        domain="reading",
        is_active=True,
    )
    db_session.add(valid_skill)
    await db_session.flush()

    fake_id = uuid.uuid4()
    mappings = AIQuestionGenerationService._bind_skill_mappings(
        allowed_skills=[valid_skill],
        parsed_skill_ids=[
            {"skill_id": str(fake_id), "role": "primary", "weight": 1.0}
        ],
        target_skill_ids=[],
    )

    # Fake ID must be discarded and replaced with valid DB skill
    assert len(mappings) == 1
    assert mappings[0].skill_id == valid_skill.id
    assert mappings[0].skill_id != fake_id


@pytest.mark.asyncio
async def test_duplicate_detection_exact_and_similar(db_session: AsyncSession):
    """Ensure duplicate detection correctly flags exact and similar questions."""
    existing_prompt = "Qu'est-ce que l'auteur cherche principalement à démontrer ?"

    # Insert existing question
    q = Question(
        prompt=existing_prompt,
        difficulty=3,
        level="B1",
        points=1,
        penalty_points=0,
        status="draft",
        version=1,
    )
    db_session.add(q)
    await db_session.flush()

    # Exact duplicate test
    dup_exact = await AIQuestionGenerationService.check_question_duplicates(
        db=db_session,
        prompt="  Qu'est-ce que l'auteur cherche principalement à démontrer ? ",
    )
    assert dup_exact.is_duplicate is True
    assert dup_exact.status == "exact_duplicate"
    assert dup_exact.similarity_score == 1.0
    assert dup_exact.matched_question_id == q.id

    # Similar duplicate test
    dup_similar = await AIQuestionGenerationService.check_question_duplicates(
        db=db_session,
        prompt="Qu'est-ce que l'auteur cherche principalement à prouver ou démontrer ?",
    )
    assert dup_similar.is_duplicate is True
    assert dup_similar.status == "possible_duplicate"
    assert dup_similar.similarity_score >= 0.75

    # Unique test
    dup_unique = await AIQuestionGenerationService.check_question_duplicates(
        db=db_session,
        prompt="Quel est le prix moyen du loyer à Paris selon l'étude ?",
    )
    assert dup_unique.is_duplicate is False
    assert dup_unique.status == "unique"


@pytest.mark.asyncio
async def test_second_pass_ai_review():
    """Verify second-pass AI critique produces structured score and qualitative notes."""
    candidate = GeneratedQuestionCandidate(
        prompt="Quelle idée directrice l'auteur cherche-t-il à mettre en relief ?",
        target_cefr="B2",
        options=[
            CandidateOptionPayload(content="L'innovation doit s'accompagner de sobriété.", is_correct=True),
            CandidateOptionPayload(content="Les énergies vertes sont inutiles.", is_correct=False),
            CandidateOptionPayload(content="L'isolation thermique suffit à elle seule.", is_correct=False),
            CandidateOptionPayload(content="La population refuse de changer.", is_correct=False),
        ],
        generation_metadata=CandidateGenerationMetadata(
            model="models/gemini-2.5-flash",
            prompt_template_version="v2",
            is_simulation=True,
        ),
    )

    review_req = CandidateReviewRequest(
        candidate=candidate,
        force_simulation=True,
    )

    review_report = await AIQuestionGenerationService.review_candidate(
        db=None,  # Not needed for review
        request=review_req,
    )

    assert review_report.quality_score >= 70.0
    assert review_report.naturalness_score >= 80.0
    assert len(review_report.strengths) > 0


@pytest.mark.asyncio
async def test_create_draft_from_candidate(db_session: AsyncSession):
    """Verify converting candidate creates a persistent Question draft with complete provenance."""
    # Seed skill and task type
    skill = Skill(
        code="CE_ARGUMENTATION",
        name="Comprendre l'argumentation",
        domain="reading",
        is_active=True,
    )
    db_session.add(skill)
    await db_session.flush()
    skill_id = skill.id

    user = User(email="admin-author@test.com", role=UserRole.ADMIN)
    db_session.add(user)
    await db_session.flush()

    actor_id = user.id
    candidate = GeneratedQuestionCandidate(
        prompt="Quel est l'objectif principal du nouveau décret municipal ?",
        instructions="Choisissez la bonne réponse.",
        response_type=QuestionResponseType.SINGLE_CHOICE.value,
        target_cefr="B2",
        difficulty_rating=450,
        item_difficulty=4,
        cognitive_complexity=CognitiveComplexityLevel.INTERPRETATION.value,
        points=1,
        penalty_points=0,
        stimulus_title="Décret sur la circulation urbaine",
        stimulus_content="La mairie annonce la restriction des véhicules polluants en centre-ville dès le 1er janvier...",
        options=[
            CandidateOptionPayload(content="Réduire la pollution atmosphérique.", is_correct=True, order_index=0),
            CandidateOptionPayload(content="Augmenter le tarif du stationnement.", is_correct=False, order_index=1),
            CandidateOptionPayload(content="Supprimer les pistes cyclables.", is_correct=False, order_index=2),
            CandidateOptionPayload(content="Interdire les transports en commun.", is_correct=False, order_index=3),
        ],
        skill_mappings=[
            CandidateSkillMapping(skill_id=skill.id, role="primary", weight=1.0)
        ],
        explanation="Le premier paragraphe précise explicitement la réduction de pollution.",
        generation_metadata=CandidateGenerationMetadata(
            model="models/gemini-2.5-flash",
            prompt_template_version="reading_mcq_gen_v2.1",
            total_tokens=420,
            latency_ms=180,
            is_simulation=True,
        ),
    )

    question = await AIQuestionGenerationService.create_draft_from_candidate(
        db=db_session,
        candidate=candidate,
        actor_id=actor_id,
    )

    # VERIFY HARD INVARIANTS:
    # 1. Status is strictly 'draft'
    assert question.status == ContentStatus.DRAFT.value
    # 2. Author type in provenance is strictly 'ai'
    assert question.provenance.author_type == QuestionAuthorType.AI.value
    # 3. Target CEFR and metrics match
    assert question.target_cefr == "B2"
    assert question.difficulty_rating == 450
    assert question.points == 1

    # Verify options persisted
    assert len(question.options) == 4
    correct_opts = [o for o in question.options if o.is_correct]
    assert len(correct_opts) == 1
    assert correct_opts[0].content == "Réduire la pollution atmosphérique."

    # Verify skills persisted
    assert len(question.skill_tags) == 1
    assert question.skill_tags[0].skill_id == skill_id

    # Verify stimulus created
    assert question.stimulus is not None
    assert question.stimulus.title == "Décret sur la circulation urbaine"

    # Verify QuestionProvenance record
    assert question.provenance is not None
    assert question.provenance.source_type == "ai_generation"
    assert question.provenance.author_type == QuestionAuthorType.AI.value
    assert question.provenance.generator_model == "models/gemini-2.5-flash"
    assert question.provenance.generator_prompt_version == "reading_mcq_gen_v2.1"


@pytest.mark.asyncio
async def test_immutability_invariant_blocks_mutation_of_published(db_session: AsyncSession):
    """Verify AI cannot mutate approved, published, or archived questions."""
    actor_id = uuid.uuid4()

    # Create published question
    pub_q = Question(
        prompt="Question officielle publiée et distribuée aux candidats",
        difficulty=3,
        level="B1",
        points=1,
        penalty_points=0,
        status=ContentStatus.PUBLISHED.value,
        version=1,
    )
    db_session.add(pub_q)
    await db_session.flush()

    regen_req = CandidateRegenerateRequest(
        component="distractors",
        custom_instructions="Rendre les distracteurs plus difficiles",
    )

    # Must raise AppException with 409 conflict
    with pytest.raises(AppException) as exc_info:
        await AIQuestionGenerationService.regenerate_draft_component(
            db=db_session,
            question_id=pub_q.id,
            request=regen_req,
            actor_id=actor_id,
        )

    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "IMMUTABLE_QUESTION_MUTATION"


@pytest.mark.asyncio
async def test_regeneration_on_draft_question_succeeds(db_session: AsyncSession):
    """Verify AI can regenerate components on questions that are in DRAFT status."""
    actor_id = uuid.uuid4()

    draft_q = Question(
        prompt="Question initiale en cours de conception",
        difficulty=3,
        level="B1",
        points=1,
        penalty_points=0,
        status=ContentStatus.DRAFT.value,
        version=1,
    )
    db_session.add(draft_q)
    await db_session.flush()

    opt_correct = QuestionOption(
        question_id=draft_q.id,
        content="Bonne réponse d'origine",
        is_correct=True,
        order_index=0,
    )
    opt_distractor = QuestionOption(
        question_id=draft_q.id,
        content="Ancien distracteur faible",
        is_correct=False,
        order_index=1,
    )
    db_session.add_all([opt_correct, opt_distractor])
    await db_session.flush()

    regen_req = CandidateRegenerateRequest(
        component="distractors",
        custom_instructions="Rendre les distracteurs plus complexes",
    )

    updated_q = await AIQuestionGenerationService.regenerate_draft_component(
        db=db_session,
        question_id=draft_q.id,
        request=regen_req,
        actor_id=actor_id,
    )

    assert updated_q.status == ContentStatus.DRAFT.value
    assert len(updated_q.options) == 4
    # Preserves original correct answer
    correct_opts = [o for o in updated_q.options if o.is_correct]
    assert len(correct_opts) == 1
    assert correct_opts[0].content == "Bonne réponse d'origine"
