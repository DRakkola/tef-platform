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

from app.core.exceptions import AppException
from app.modules.admin.ai_question_schemas import (
    AIQuestionGenerationRequest,
    AIStimulusGenerationRequest,
    CandidateGenerationMetadata,
    CandidateOptionPayload,
    CandidateRegenerateRequest,
    CandidateReviewRequest,
    CandidateSkillMapping,
    GeneratedQuestionCandidate,
)
from app.modules.admin.ai_question_service import (
    AIQuestionGenerationService,
    _calculate_jaccard_similarity,
    _tokenize_text,
)
from app.modules.admin.enums import ContentStatus
from app.modules.admin.tagging_service import TaggingValidationEngine
from app.modules.assessments.enums import (
    CognitiveComplexityLevel,
    QuestionAuthorType,
    QuestionResponseType,
    QuestionType,
)
from app.modules.assessments.models import (
    Question,
    QuestionOption,
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


@pytest.mark.asyncio
async def test_stimulus_bundling_multi_questions(db_session: AsyncSession):
    """Verify bundling multiple questions per stimulus shares the same passage across items."""
    req = AIQuestionGenerationRequest(
        modality="reading",
        target_cefr="B1",
        count=4,
        questions_per_stimulus=2,
        force_simulation=True,
    )
    resp = await AIQuestionGenerationService.generate_candidates(db=db_session, request=req)
    assert resp.total_generated == 4

    # Items 0 & 1 belong to bundle 1 and should share the exact same stimulus
    assert resp.candidates[0].stimulus_content == resp.candidates[1].stimulus_content
    assert resp.candidates[0].stimulus_title == resp.candidates[1].stimulus_title

    # Items 2 & 3 belong to bundle 2 and should share the exact same stimulus
    assert resp.candidates[2].stimulus_content == resp.candidates[3].stimulus_content


@pytest.mark.asyncio
async def test_dual_dimension_skill_tagging(db_session: AsyncSession):
    """Verify dual-dimension tagging assigns 1 reasoning skill and 1 language skill."""
    r_skill = Skill(
        code="CE_LOGICAL_INFERENCE",
        name="Inférer une conclusion",
        domain="reading",
        dimension="reasoning",
        is_active=True,
    )
    l_skill = Skill(
        code="CE_DISCOURSE_MARKERS",
        name="Connecteurs logiques et discours",
        domain="reading",
        dimension="language",
        is_active=True,
    )
    db_session.add_all([r_skill, l_skill])
    await db_session.flush()

    req = AIQuestionGenerationRequest(
        modality="reading",
        target_cefr="B2",
        count=1,
        force_simulation=True,
    )
    resp = await AIQuestionGenerationService.generate_candidates(db=db_session, request=req)
    cand = resp.candidates[0]

    # Verify both dimensions are tagged
    skill_ids = [sm.skill_id for sm in cand.skill_mappings]
    assert r_skill.id in skill_ids
    assert l_skill.id in skill_ids

    # Verify each dimension has role='primary' and weight=1.0
    for sm in cand.skill_mappings:
        assert sm.role == "primary"
        assert sm.weight == 1.0


@pytest.mark.asyncio
async def test_multi_format_generation_matching_and_gap(db_session: AsyncSession):
    """Verify generating matching and text_gap questions and persisting them to draft."""
    # Test Matching
    req_matching = AIQuestionGenerationRequest(
        modality="reading",
        response_type=QuestionResponseType.MATCHING.value,
        target_cefr="B2",
        count=1,
        force_simulation=True,
    )
    resp_m = await AIQuestionGenerationService.generate_candidates(db=db_session, request=req_matching)
    cand_m = resp_m.candidates[0]
    assert cand_m.response_type == "matching"
    assert cand_m.scoring_payload is not None
    assert "pairs" in cand_m.scoring_payload

    # Persist matching draft
    q_draft_m = await AIQuestionGenerationService.create_draft_from_candidate(
        db=db_session,
        candidate=cand_m,
        actor_id=uuid.uuid4(),
    )
    assert q_draft_m.response_type == "matching"
    assert q_draft_m.scoring_payload["pairs"] is not None

    # Test Text Gap
    req_gap = AIQuestionGenerationRequest(
        modality="reading",
        response_type="text_gap",
        target_cefr="B2",
        count=1,
        force_simulation=True,
    )
    resp_g = await AIQuestionGenerationService.generate_candidates(db=db_session, request=req_gap)
    cand_g = resp_g.candidates[0]
    assert cand_g.response_type == "text_gap"
    assert cand_g.scoring_payload is not None
    assert "gaps" in cand_g.scoring_payload

    # Persist text_gap draft
    q_draft_g = await AIQuestionGenerationService.create_draft_from_candidate(
        db=db_session,
        candidate=cand_g,
        actor_id=uuid.uuid4(),
    )
    assert q_draft_g.question_type == QuestionType.TEXT_INPUT
    assert q_draft_g.response_type == "text_gap"
    assert "gaps" in q_draft_g.scoring_payload


@pytest.mark.asyncio
async def test_stimulus_content_hash_deduplication(db_session: AsyncSession):
    """Verify candidates sharing the same stimulus content reuse the same Stimulus row."""
    shared_content = "Le festival annuel des francophonies se déroulera à Limoges du 20 au 30 septembre."
    cand1 = GeneratedQuestionCandidate(
        prompt="Où se déroule le festival ?",
        response_type=QuestionResponseType.SINGLE_CHOICE.value,
        target_cefr="A2",
        stimulus_title="Festival des Francophonies",
        stimulus_content=shared_content,
        options=[
            CandidateOptionPayload(content="À Limoges.", is_correct=True, order_index=0),
            CandidateOptionPayload(content="À Paris.", is_correct=False, order_index=1),
            CandidateOptionPayload(content="À Lyon.", is_correct=False, order_index=2),
            CandidateOptionPayload(content="À Marseille.", is_correct=False, order_index=3),
        ],
        generation_metadata=CandidateGenerationMetadata(
            model="models/gemini-2.5-flash",
            prompt_template_version="reading_mcq_gen_v2.1",
            is_simulation=True,
        ),
    )
    cand2 = GeneratedQuestionCandidate(
        prompt="Quelle est la durée approximative du festival ?",
        response_type=QuestionResponseType.SINGLE_CHOICE.value,
        target_cefr="A2",
        stimulus_title="Festival des Francophonies",
        stimulus_content=shared_content,
        options=[
            CandidateOptionPayload(content="10 jours.", is_correct=True, order_index=0),
            CandidateOptionPayload(content="1 mois.", is_correct=False, order_index=1),
            CandidateOptionPayload(content="3 jours.", is_correct=False, order_index=2),
            CandidateOptionPayload(content="2 semaines.", is_correct=False, order_index=3),
        ],
        generation_metadata=CandidateGenerationMetadata(
            model="models/gemini-2.5-flash",
            prompt_template_version="reading_mcq_gen_v2.1",
            is_simulation=True,
        ),
    )

    actor = uuid.uuid4()
    q1 = await AIQuestionGenerationService.create_draft_from_candidate(db=db_session, candidate=cand1, actor_id=actor)
    q2 = await AIQuestionGenerationService.create_draft_from_candidate(db=db_session, candidate=cand2, actor_id=actor)

    assert q1.stimulus_id is not None
    assert q2.stimulus_id is not None
    # Both questions must point to the identical Stimulus ID
    assert q1.stimulus_id == q2.stimulus_id


@pytest.mark.asyncio
async def test_generate_and_persist_stimulus_document_matching(db_session: AsyncSession):
    """Verify generating and persisting a multi-document stimulus bundle (Documents A/B/C/D)."""
    req = AIStimulusGenerationRequest(
        modality="reading",
        task_type_code="document_matching",
        target_cefr="B2",
        topic="Offres de formation professionnelle",
        force_simulation=True,
    )
    stim_cand = await AIQuestionGenerationService.generate_stimulus(
        db=db_session,
        request=req,
    )
    assert stim_cand.title is not None
    assert stim_cand.task_type_code == "document_matching"
    assert stim_cand.text_format == "multi_doc"
    assert len(stim_cand.sub_documents) == 4
    doc_labels = [d["label"] for d in stim_cand.sub_documents]
    assert doc_labels == ["Document A", "Document B", "Document C", "Document D"]

    # Persist stimulus
    stim_orm = await AIQuestionGenerationService.persist_stimulus(
        db=db_session,
        candidate=stim_cand,
        actor_id=uuid.uuid4(),
    )
    assert stim_orm.id == stim_cand.id
    assert stim_orm.text_format == "multi_doc"
    assert "Document A" in stim_orm.content_text
    assert "Document D" in stim_orm.content_text


@pytest.mark.asyncio
async def test_generate_stimulus_graph_matching(db_session: AsyncSession):
    """Verify generating a graph_matching stimulus with table markdown formatting."""
    req = AIStimulusGenerationRequest(
        modality="reading",
        task_type_code="graph_matching",
        target_cefr="B2",
        topic="Sondage sur le télétravail",
        force_simulation=True,
    )
    stim_cand = await AIQuestionGenerationService.generate_stimulus(
        db=db_session,
        request=req,
    )
    assert stim_cand.text_format == "table"
    assert "|" in stim_cand.content_text
    assert "Année" in stim_cand.content_text


@pytest.mark.asyncio
async def test_sentence_gap_suppresses_stimulus(db_session: AsyncSession):
    """Verify sentence_gap questions strictly suppress stimulus and embed gap in prompt."""
    req = AIQuestionGenerationRequest(
        modality="reading",
        task_type_code="sentence_gap",
        target_cefr="B1",
        count=1,
        force_simulation=True,
    )
    resp = await AIQuestionGenerationService.generate_candidates(db=db_session, request=req)
    cand = resp.candidates[0]

    # Verify stimulus is strictly suppressed
    assert cand.stimulus_id is None
    assert cand.stimulus_title is None
    assert cand.stimulus_content is None
    assert cand.stimulus_mode == "none"

    # Verify prompt contains gap blank
    assert "______" in cand.prompt

    # Persist draft question and verify DB stimulus_id is None
    draft_q = await AIQuestionGenerationService.create_draft_from_candidate(
        db=db_session,
        candidate=cand,
        actor_id=uuid.uuid4(),
    )
    assert draft_q.stimulus_id is None
    assert "______" in draft_q.prompt


@pytest.mark.asyncio
async def test_all_14_tef_task_types_generation(db_session: AsyncSession):
    """Verify candidate generation across all official TEF task types."""
    task_types = [
        ("reading", "document_matching"),
        ("reading", "press_article"),
        ("reading", "sentence_gap"),
        ("reading", "text_gap"),
        ("reading", "graph_matching"),
        ("listening", "short_announcement"),
        ("listening", "radio_broadcast"),
        ("listening", "public_survey"),
        ("listening", "phonological_recognition"),
        ("writing", "fait_divers"),
        ("writing", "opinion_letter"),
        ("speaking", "information_gathering"),
        ("speaking", "persuasive_argumentation"),
    ]

    for modality, task_code in task_types:
        req = AIQuestionGenerationRequest(
            modality=modality,
            task_type_code=task_code,
            target_cefr="B2",
            count=1,
            force_simulation=True,
        )
        resp = await AIQuestionGenerationService.generate_candidates(db=db_session, request=req)
        assert len(resp.candidates) == 1, f"Failed generation for {task_code}"
        cand = resp.candidates[0]
        assert cand.prompt is not None and len(cand.prompt) > 0


@pytest.mark.asyncio
async def test_granular_multi_tagging_validates_cleanly(db_session: AsyncSession):
    """Verify granular multi-tagging (Primary 0.75 + Secondary 0.25) across reasoning and language dimensions passes TaggingValidationEngine."""
    # Seed 2 reasoning skills and 2 language skills
    r_primary = Skill(
        code="TEST_REASON_PRIM",
        name="Raisonnement Principal",
        domain="reading",
        dimension="reasoning",
        is_active=True,
    )
    r_secondary = Skill(
        code="TEST_REASON_SEC",
        name="Raisonnement Secondaire",
        domain="reading",
        dimension="reasoning",
        is_active=True,
    )
    l_primary = Skill(
        code="TEST_LANG_PRIM",
        name="Langue Principale",
        domain="reading",
        dimension="language",
        is_active=True,
    )
    l_secondary = Skill(
        code="TEST_LANG_SEC",
        name="Langue Secondaire",
        domain="reading",
        dimension="language",
        is_active=True,
    )
    db_session.add_all([r_primary, r_secondary, l_primary, l_secondary])
    await db_session.flush()

    req = AIQuestionGenerationRequest(
        modality="reading",
        task_type_code="press_article",
        target_cefr="B2",
        count=1,
        force_simulation=True,
    )
    resp = await AIQuestionGenerationService.generate_candidates(db=db_session, request=req)
    cand = resp.candidates[0]

    # Verify 4 tags were assigned: 2 reasoning + 2 language
    assert len(cand.skill_mappings) == 4
    weights_by_dim: dict[str, float] = {"reasoning": 0.0, "language": 0.0}
    roles_by_dim: dict[str, list[str]] = {"reasoning": [], "language": []}

    skill_map = {
        r_primary.id: ("reasoning", "TEST_REASON_PRIM"),
        r_secondary.id: ("reasoning", "TEST_REASON_SEC"),
        l_primary.id: ("language", "TEST_LANG_PRIM"),
        l_secondary.id: ("language", "TEST_LANG_SEC"),
    }

    for mapping in cand.skill_mappings:
        assert mapping.skill_id in skill_map
        dim, _ = skill_map[mapping.skill_id]
        weights_by_dim[dim] += mapping.weight
        roles_by_dim[dim].append(mapping.role)

    # Invariants: sum = 1.0 per dimension, exactly 1 primary per dimension
    assert abs(weights_by_dim["reasoning"] - 1.0) < 0.01
    assert abs(weights_by_dim["language"] - 1.0) < 0.01
    assert roles_by_dim["reasoning"].count("primary") == 1
    assert roles_by_dim["reasoning"].count("secondary") == 1
    assert roles_by_dim["language"].count("primary") == 1
    assert roles_by_dim["language"].count("secondary") == 1

    # Validate directly against TaggingValidationEngine without exception
    validated_skills = await TaggingValidationEngine.validate_skill_tags(
        db=db_session,
        tags=cand.skill_mappings,
    )
    assert len(validated_skills) == 4

