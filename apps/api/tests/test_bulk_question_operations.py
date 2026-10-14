"""Tests for Question Bank Bulk Actions, File Parsing, AI Auto-Tagging, and Bulk Import."""

import json
import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.admin.bulk_question_schemas import (
    AIAutoTagAndFormatRequest,
    BulkActionRequest,
    BulkActionType,
    BulkImportCommitRequest,
    BulkImportQuestionItem,
    BulkOptionPayload,
)
from app.modules.admin.bulk_question_service import BulkQuestionService
from app.modules.admin.enums import ContentStatus, SkillDimension, SkillTagRole
from app.modules.admin.models import TaxonomyVersion
from app.modules.assessments.enums import QuestionType
from app.modules.assessments.models import (
    Question,
    QuestionOption,
    QuestionSkillTag,
    Skill,
    TaskType,
)


@pytest.fixture
async def setup_taxonomy(db_session: AsyncSession) -> tuple[Skill, Skill]:
    """Sets up minimal taxonomy version and canonical skills for testing."""
    tv = TaxonomyVersion(
        version=f"v-bulk-{uuid.uuid4().hex[:6]}",
        name="Bulk Test Taxonomy",
        status="active",
    )
    db_session.add(tv)
    await db_session.flush()

    s_rea = Skill(
        taxonomy_version_id=tv.id,
        code=f"CE-L1-COMP-GLOB-{uuid.uuid4().hex[:4]}",
        name="Compréhension Globale",
        category="reading",
        dimension=SkillDimension.REASONING,
        is_active=True,
    )
    s_lang = Skill(
        taxonomy_version_id=tv.id,
        code=f"CE-L2-GRAM-{uuid.uuid4().hex[:4]}",
        name="Morphosyntaxe et Lexique",
        category="reading",
        dimension=SkillDimension.LANGUAGE,
        is_active=True,
    )
    db_session.add_all([s_rea, s_lang])
    await db_session.flush()
    return s_rea, s_lang


@pytest.mark.asyncio
async def test_parse_csv_file() -> None:
    """Test parsing CSV formatted question bank files (comma and semicolon delimiters)."""
    csv_data = (
        "prompt,question_type,modality,level,difficulty,option_a,option_b,option_c,option_d,correct_option,stimulus_title,stimulus_text\n"
        "Quelle est l'idée clé ?,single_choice,reading,B2,3,Option 1,Option 2,Option 3,Option 4,B,Avis officiel,Voici le texte du document.\n"
        "Où se situe l'événement ?,single_choice,reading,A2,1,Paris,Lyon,Marseille,Lille,A,Annonce,Rendez-vous à Paris.\n"
        ",,,,,,,,,,,\n"
    ).encode()

    res = BulkQuestionService.parse_import_file(csv_data, "questions.csv")
    assert res.total_parsed == 2
    assert res.valid_count == 2
    assert res.invalid_count == 0
    assert len(res.parse_errors) == 0

    item1 = res.items[0]
    assert item1.prompt == "Quelle est l'idée clé ?"
    assert item1.level == "B2"
    assert item1.difficulty == 3
    assert item1.cognitive_complexity == "interpretation"
    assert item1.stimulus_title == "Avis officiel"
    assert len(item1.options) == 4
    # B was marked correct
    assert item1.options[1].is_correct is True
    assert item1.options[0].is_correct is False


@pytest.mark.asyncio
async def test_parse_semicolon_csv_and_validation_errors() -> None:
    """Test French Excel semicolon-delimited CSV and row validation rules."""
    semicolon_csv = (
        "prompt;question_type;modality;level;difficulty;option_a;option_b;correct_option;skill_codes\n"
        "Quel est l'objet du courriel ?;single_choice;reading;B1;2;Demande de congé;Facture;1;CE-L1-COMP-GLOB\n"
        "Question avec mauvais choix ?;single_choice;reading;B1;2;Choix A;Choix B;Z;\n"
        "Question avec une seule option ?;single_choice;reading;B1;2;Unique option;;A;\n"
    ).encode("cp1252")

    res = BulkQuestionService.parse_import_file(semicolon_csv, "french_excel.csv")
    assert res.total_parsed == 3
    assert res.valid_count == 1
    assert res.invalid_count == 2

    # First row: numeric '1' maps to option_a and legacy CE-L1-COMP-GLOB maps to identify_main_idea
    assert res.items[0].is_valid is True
    assert res.items[0].options[0].is_correct is True
    assert res.items[0].skill_codes == ["identify_main_idea"]

    # Second row: invalid correct_option 'Z' is caught rather than silently defaulting to A
    assert res.items[1].is_valid is False
    assert any("correct_option" in err for err in res.items[1].validation_errors)

    # Third row: fewer than 2 options is caught
    assert res.items[2].is_valid is False
    assert any("2 options" in err for err in res.items[2].validation_errors)


@pytest.mark.asyncio
async def test_parse_json_file() -> None:
    """Test parsing JSON formatted question bank files (array, items wrapper, questions wrapper)."""
    item_json = {
        "prompt": "Quel est l'objectif de ce courriel ?",
        "question_type": "single_choice",
        "modality": "reading",
        "level": "B1",
        "difficulty": 2,
        "options": [
            {"content": "Confirmer une réservation", "is_correct": True},
            {"content": "Demander un remboursement", "is_correct": False},
        ],
        "stimulus_title": "Courriel de confirmation",
        "stimulus_text": "Merci pour votre réservation.",
    }

    # 1. Top-level array
    res_arr = BulkQuestionService.parse_import_file(json.dumps([item_json]).encode("utf-8"), "batch.json")
    assert res_arr.total_parsed == 1
    assert res_arr.valid_count == 1
    assert res_arr.items[0].prompt == "Quel est l'objectif de ce courriel ?"

    # 2. {"items": [...]} wrapper
    res_items = BulkQuestionService.parse_import_file(json.dumps({"items": [item_json]}).encode("utf-8"), "batch.json")
    assert res_items.total_parsed == 1
    assert res_items.valid_count == 1

    # 3. {"questions": [...]} wrapper
    res_questions = BulkQuestionService.parse_import_file(json.dumps({"questions": [item_json]}).encode("utf-8"), "batch.json")
    assert res_questions.total_parsed == 1
    assert res_questions.valid_count == 1



@pytest.mark.asyncio
async def test_csv_template_generation() -> None:
    """Test generating standard import template with all question_type examples and round-trip parsing."""
    csv_str = BulkQuestionService.generate_csv_template()
    assert "prompt,task_type_code,question_type,modality,level,difficulty,cognitive_complexity" in csv_str
    assert "identify_main_idea" in csv_str

    parsed = BulkQuestionService.parse_import_file(csv_str.encode("utf-8"), "template.csv")
    assert parsed.total_parsed == 9
    assert parsed.valid_count == 9
    assert parsed.invalid_count == 0
    response_types = {item.response_type for item in parsed.items}
    assert response_types == {
        "single_choice",
        "multiple_choice",
        "gap_fill",
        "short_text",
        "matching",
        "ordering",
        "long_text",
        "spoken_response",
        "interaction",
    }
    task_types = {item.task_type_code for item in parsed.items}
    assert "daily_document" in task_types
    assert "press_article" in task_types
    assert "sentence_gap" in task_types
    assert "document_matching" in task_types
    assert "text_ordering" in task_types
    assert "opinion_letter" in task_types
    assert "persuasive_argumentation" in task_types
    assert "information_gathering" in task_types

    complexities = {item.cognitive_complexity for item in parsed.items}
    assert "recall_recognition" in complexities
    assert "interpretation" in complexities
    assert "critical_evaluation" in complexities


@pytest.mark.asyncio
async def test_ai_auto_tag_and_format(db_session: AsyncSession, setup_taxonomy: tuple[Skill, Skill]) -> None:
    """Test AI auto rich-text Markdown formatting and CEFR/Skill heuristics."""
    _s_rea, _ = setup_taxonomy

    raw_items = [
        BulkImportQuestionItem(
            prompt="Quel est le thème principal de cette annonce ?",
            stimulus_title="Avis de coupure",
            stimulus_text="En raison de travaux urgents sur le réseau d'eau, l'alimentation sera interrompue ce jeudi.\nA: Avez-vous reçu le message ?\nB: Oui, hier soir.",
            options=[
                BulkOptionPayload(content="Travaux sur le réseau", is_correct=True),
                BulkOptionPayload(content="Festival", is_correct=False),
            ],
        )
    ]

    req = AIAutoTagAndFormatRequest(items=raw_items, auto_tag_skills=True, auto_format_rich_text=True)
    res = await BulkQuestionService.ai_auto_tag_and_format_items(db_session, req)

    assert res.enriched_count == 1
    enriched = res.items[0]
    # Check Markdown formatting
    assert "### Avis de coupure" in (enriched.stimulus_text or "")
    assert "> **A:**" in (enriched.stimulus_text or "")
    assert enriched.target_cefr in ("A1", "A2", "B1", "B2", "C1", "C2")
    assert enriched.cognitive_complexity == "interpretation"
    # Check skill codes mapped
    assert len(enriched.skill_codes) > 0


@pytest.mark.asyncio
async def test_bulk_import_commit(db_session: AsyncSession, setup_taxonomy: tuple[Skill, Skill]) -> None:
    """Test transactional commit of imported questions into database and canonical validation."""
    from app.modules.assessments.question_validation import QuestionValidationEngine

    s_rea, s_lang = setup_taxonomy

    items_to_import = [
        BulkImportQuestionItem(
            prompt=f"Quelle est la raison principale mentionnée dans la note {uuid.uuid4().hex[:6]} ?",
            question_type="single_choice",
            response_type="single_choice",
            modality="reading",
            level="B2",
            target_cefr="B2",
            difficulty=3,
            points=1,
            stimulus_title="Texte d'import",
            stimulus_text="Contenu du document à importer dans la banque.",
            options=[
                BulkOptionPayload(content="Bonne réponse", is_correct=True, order_index=0),
                BulkOptionPayload(content="Mauvaise réponse", is_correct=False, order_index=1),
            ],
            skill_codes=[s_rea.code, s_lang.code],
            is_valid=True,
        )
    ]

    req = BulkImportCommitRequest(items=items_to_import, default_status="draft")
    res = await BulkQuestionService.commit_bulk_import(db_session, req)

    assert res.created_count == 1
    assert len(res.created_ids) == 1
    assert len(res.errors) == 0

    # Query back from DB and verify canonical fields & zero blocking validation errors
    q_id = res.created_ids[0]
    q = await db_session.get(Question, q_id)
    assert q is not None
    assert q.status == "draft"
    assert q.level == "B2"
    assert q.difficulty_rating == 450
    assert q.cognitive_complexity == "interpretation"
    assert q.stimulus_id is not None

    val_res = await QuestionValidationEngine.validate_question(db_session, q, check_duplication=False)
    assert val_res.valid is True
    assert len(val_res.errors) == 0


@pytest.mark.asyncio
async def test_bulk_actions(db_session: AsyncSession, setup_taxonomy: tuple[Skill, Skill]) -> None:
    """Test bulk publish, archive, validate, and delete actions on question collection."""
    s_rea, _s_lang = setup_taxonomy

    # Create 2 questions
    q1 = Question(
        prompt=f"Quelle est la conclusion principale du document {uuid.uuid4().hex[:6]} ?",
        question_type=QuestionType.SINGLE_CHOICE,
        response_type="single_choice",
        level="B1",
        target_cefr="B1",
        difficulty=2,
        difficulty_rating=330,
        cognitive_complexity="interpretation",
        points=1,
        status=ContentStatus.DRAFT.value,
        version=1,
    )
    q2 = Question(
        prompt=f"Quelle information est indiquée dans l'annonce {uuid.uuid4().hex[:6]} ?",
        question_type=QuestionType.SINGLE_CHOICE,
        response_type="single_choice",
        level="B1",
        target_cefr="B1",
        difficulty=2,
        difficulty_rating=330,
        cognitive_complexity="interpretation",
        points=1,
        status=ContentStatus.DRAFT.value,
        version=1,
    )
    db_session.add_all([q1, q2])
    await db_session.flush()

    # Add options so they are valid
    opt1 = QuestionOption(question_id=q1.id, content="Correct", is_correct=True, order_index=0)
    opt2 = QuestionOption(question_id=q1.id, content="Incorrect", is_correct=False, order_index=1)
    opt3 = QuestionOption(question_id=q2.id, content="Correct", is_correct=True, order_index=0)
    opt4 = QuestionOption(question_id=q2.id, content="Incorrect", is_correct=False, order_index=1)
    db_session.add_all([opt1, opt2, opt3, opt4])

    tag1 = QuestionSkillTag(question_id=q1.id, skill_id=s_rea.id, weight=1.0, role=SkillTagRole.PRIMARY)
    tag2 = QuestionSkillTag(question_id=q2.id, skill_id=s_rea.id, weight=1.0, role=SkillTagRole.PRIMARY)
    db_session.add_all([tag1, tag2])
    await db_session.commit()

    # 1. Bulk Validate
    val_req = BulkActionRequest(question_ids=[q1.id, q2.id], action=BulkActionType.VALIDATE)
    val_res = await BulkQuestionService.execute_bulk_action(db_session, val_req)
    assert val_res.success_count == 2
    assert val_res.failure_count == 0

    # 2. Bulk Publish
    pub_req = BulkActionRequest(question_ids=[q1.id], action=BulkActionType.PUBLISH)
    pub_res = await BulkQuestionService.execute_bulk_action(db_session, pub_req)
    assert pub_res.success_count == 1
    assert pub_res.failure_count == 0

    # 3. Bulk Archive
    arc_req = BulkActionRequest(question_ids=[q1.id, q2.id], action=BulkActionType.ARCHIVE)
    arc_res = await BulkQuestionService.execute_bulk_action(db_session, arc_req)
    assert arc_res.success_count == 2
    q1_db = await db_session.get(Question, q1.id)
    assert q1_db is not None
    assert q1_db.status == ContentStatus.ARCHIVED.value

    # 4. Bulk Delete (q2 was never live delivered, so it can be deleted; q1 was live delivered so it cannot)
    del_req = BulkActionRequest(question_ids=[q2.id], action=BulkActionType.DELETE)
    del_res = await BulkQuestionService.execute_bulk_action(db_session, del_req)
    assert del_res.success_count == 1
    assert await db_session.get(Question, q2.id) is None


@pytest.mark.asyncio
async def test_match_canonical_task_and_import(db_session: AsyncSession, setup_taxonomy: tuple[Skill, Skill]) -> None:
    """Verifies that _match_canonical_task resolves task type when omitted, or respects task_type_code when provided."""
    # Create sample task types
    tt_daily = TaskType(
        code="daily_document",
        name="Documents de la vie quotidienne",
        modality="reading",
        default_response_type="single_choice",
        is_active=True,
    )
    tt_press = TaskType(
        code="press_article",
        name="Articles de presse",
        modality="reading",
        default_response_type="single_choice",
        is_active=True,
    )
    db_session.add_all([tt_daily, tt_press])
    await db_session.flush()

    # 1. Item with explicit task_type_code
    item_explicit = BulkImportQuestionItem(
        prompt="À quoi sert cette annonce officielle ?",
        question_type="single_choice",
        response_type="single_choice",
        task_type_code="daily_document",
        modality="reading",
        level="A2",
        difficulty=2,
        options=[
            BulkOptionPayload(content="Option A", is_correct=True),
            BulkOptionPayload(content="Option B", is_correct=False),
        ],
    )

    # 2. Item with omitted task_type_code (should auto-generate press_article for B2 article passage)
    item_auto = BulkImportQuestionItem(
        prompt="Quelle est la position de l'auteur dans cet article de presse ?",
        question_type="single_choice",
        response_type="single_choice",
        task_type_code=None,
        modality="reading",
        level="B2",
        difficulty=4,
        stimulus_title="Débat sur la transition énergétique",
        stimulus_text="Dans cette tribune publiée récemment, les chercheurs analysent les conséquences écologiques...",
        options=[
            BulkOptionPayload(content="Option 1", is_correct=True),
            BulkOptionPayload(content="Option 2", is_correct=False),
        ],
    )

    commit_req = BulkImportCommitRequest(items=[item_explicit, item_auto], default_status="draft")
    commit_res = await BulkQuestionService.commit_bulk_import(db_session, commit_req)
    assert commit_res.created_count == 2
    assert len(commit_res.created_ids) == 2

    q_explicit = await db_session.get(Question, commit_res.created_ids[0])
    q_auto = await db_session.get(Question, commit_res.created_ids[1])

    assert q_explicit is not None
    assert q_explicit.task_type_id == tt_daily.id

    assert q_auto is not None
    assert q_auto.task_type_id == tt_press.id


@pytest.mark.asyncio
async def test_bulk_import_duplicate_detection(db_session: AsyncSession) -> None:
    """Test intra-batch duplicate detection and database duplicate skipping during bulk import."""
    # 1. Parse batch with 2 identical prompts and 1 distinct prompt
    raw_batch = [
        {
            "prompt": "Quel est le but de cette réunion de service ?",
            "question_type": "single_choice",
            "options": [{"content": "Option A", "is_correct": True}, {"content": "Option B", "is_correct": False}],
        },
        {
            "prompt": "   Quel est le but de cette réunion de service ?   ",  # duplicate with extra whitespace
            "question_type": "single_choice",
            "options": [{"content": "Option A", "is_correct": True}, {"content": "Option B", "is_correct": False}],
        },
        {
            "prompt": "Quel est l'horaire de clôture du guichet ?",
            "question_type": "single_choice",
            "options": [{"content": "17h00", "is_correct": True}, {"content": "18h00", "is_correct": False}],
        },
    ]

    parsed = BulkQuestionService.parse_import_file(json.dumps(raw_batch).encode("utf-8"), "dup_test.json")
    assert parsed.total_parsed == 3
    assert parsed.duplicate_count == 1
    assert parsed.items[0].is_duplicate is False
    assert parsed.items[1].is_duplicate is True
    assert "Doublon" in (parsed.items[1].duplicate_reason or "")
    assert parsed.items[2].is_duplicate is False

    # 2. Commit batch with skip_duplicates=True: only 2 questions should be inserted
    commit_req = BulkImportCommitRequest(items=parsed.items, skip_duplicates=True)
    res = await BulkQuestionService.commit_bulk_import(db_session, commit_req)
    assert res.created_count == 2
    assert res.skipped_duplicates_count == 1

    # 3. Commit another batch containing a prompt already in the database
    second_batch = [
        BulkImportQuestionItem(
            prompt="Quel est le but de cette réunion de service ?",  # already in db!
            question_type="single_choice",
            response_type="single_choice",
            options=[BulkOptionPayload(content="Option A", is_correct=True), BulkOptionPayload(content="Option B", is_correct=False)],
        )
    ]
    res2 = await BulkQuestionService.commit_bulk_import(
        db_session, BulkImportCommitRequest(items=second_batch, skip_duplicates=True)
    )
    assert res2.created_count == 0
    assert res2.skipped_duplicates_count == 1


@pytest.mark.asyncio
async def test_bulk_import_multigap_cloze_question(db_session: AsyncSession, setup_taxonomy: tuple[Skill, Skill]) -> None:
    """Test importing and committing a multi-gap cloze question with discrete options per gap."""
    from app.modules.assessments.question_validation import QuestionValidationEngine

    s_rea, _s_lang = setup_taxonomy

    raw_json = {
        "items": [
            {
                "stimulus_title": "Transition urbaine",
                "stimulus_text": "Le projet avance bien. [1], certains retards subsistent. Nous espérons [2] la situation rapidement.",
                "prompt": "Complétez le texte ci-dessus en choisissant la réponse appropriée pour chaque trou numéroté.",
                "task_type_code": "text_gap",
                "modality": "reading",
                "level": "B2",
                "target_cefr": "B2",
                "difficulty": 3,
                "points": 2,
                "explanation": "Texte à trous évaluant les connecteurs et le lexique.",
                "gaps": [
                    {
                        "gap_id": "1",
                        "order_index": 0,
                        "cue_text": "Connecteur logique",
                        "options": [
                            {"content": "Cependant", "is_correct": True, "order_index": 0},
                            {"content": "De plus", "is_correct": False, "order_index": 1, "misconception_type": "contradiction"},
                            {"content": "En fait", "is_correct": False, "order_index": 2, "misconception_type": "false_friend"},
                            {"content": "Puisque", "is_correct": False, "order_index": 3, "misconception_type": "morphosyntax"},
                        ],
                    },
                    {
                        "gap_id": "2",
                        "order_index": 1,
                        "cue_text": "Verbe infinitif",
                        "options": [
                            {"content": "stabiliser", "is_correct": True, "order_index": 0},
                            {"content": "aggraver", "is_correct": False, "order_index": 1, "misconception_type": "contradiction"},
                            {"content": "ignorer", "is_correct": False, "order_index": 2, "misconception_type": "literal_interpretation"},
                            {"content": "provoquer", "is_correct": False, "order_index": 3, "misconception_type": "false_friend"},
                        ],
                    },
                ],
                "skill_codes": [s_rea.code],
            }
        ]
    }

    parsed = BulkQuestionService.parse_import_file(json.dumps(raw_json).encode("utf-8"), "cloze_test.json")
    assert parsed.total_parsed == 1
    assert parsed.valid_count == 1
    item = parsed.items[0]
    assert item.is_valid is True
    assert len(item.gaps) == 2
    assert len(item.options) == 8  # 4 + 4 auto-flattened

    commit_req = BulkImportCommitRequest(items=[item], default_status="draft")
    res = await BulkQuestionService.commit_bulk_import(db_session, commit_req)
    assert res.created_count == 1
    assert len(res.created_ids) == 1

    # Query back from DB
    q = await db_session.get(Question, res.created_ids[0])
    assert q is not None
    assert q.response_type == "gap_fill"
    assert q.scoring_payload is not None
    assert "gaps" in q.scoring_payload
    saved_gaps = q.scoring_payload["gaps"]
    assert len(saved_gaps) == 2

    # Check that option IDs were assigned and linked
    assert "id" in saved_gaps[0]["options"][0]
    assert saved_gaps[0]["options"][0]["content"] == "Cependant"

    val_res = await QuestionValidationEngine.validate_question(db_session, q, check_duplication=False)
    assert val_res.valid is True
    assert len(val_res.errors) == 0


@pytest.mark.asyncio
async def test_bulk_import_json_with_trous_and_dict_format() -> None:
    """Test importing JSON where gaps are labeled 'trous' and formatted as a dictionary."""
    raw_json = {
        "items": [
            {
                "prompt": "Complétez le texte ci-dessous.",
                "stimulus_title": "Écologie urbaine",
                "stimulus_text": "Texte avec [1] et [2].",
                "task_type_code": "text_gap",
                "trous": {
                    "1": {
                        "options": [
                            {"content": "En effet", "is_correct": True},
                            {"content": "Pourtant", "is_correct": False},
                        ]
                    },
                    "2": {
                        "choices": [
                            {"content": "facilitée", "is_correct": True},
                            {"content": "ralentie", "is_correct": False},
                        ]
                    },
                },
            }
        ]
    }
    parsed = BulkQuestionService.parse_import_file(json.dumps(raw_json).encode("utf-8"), "test.json")
    assert parsed.total_parsed == 1
    assert parsed.valid_count == 1
    item = parsed.items[0]
    assert item.is_valid is True
    assert len(item.gaps) == 2
    assert len(item.options) == 4
    assert item.response_type == "gap_fill"
    assert item.gaps[0].gap_id == "1"
    assert item.gaps[1].gap_id == "2"
    assert item.gaps[1].options[0].content == "facilitée"


@pytest.mark.asyncio
async def test_bulk_import_json_synthesizes_gaps_from_bracketed_options() -> None:
    """Test importing question where gaps are omitted but options contain [1], [2] gap markers."""
    raw_json = {
        "items": [
            {
                "prompt": "Complétez le texte ci-dessous.",
                "stimulus_title": "Aménagement urbain",
                "stimulus_text": "Le vélo [1] les déplacements. Cette mesure est [2].",
                "task_type_code": "text_gap",
                "options": [
                    {"content": "[1] facilite", "is_correct": True},
                    {"content": "[1] bloque", "is_correct": False},
                    {"content": "[2] appréciée", "is_correct": True},
                    {"content": "[2] rejetée", "is_correct": False},
                ],
            }
        ]
    }
    parsed = BulkQuestionService.parse_import_file(json.dumps(raw_json).encode("utf-8"), "test.json")
    assert parsed.total_parsed == 1
    assert parsed.valid_count == 1
    item = parsed.items[0]
    assert item.is_valid is True
    assert item.response_type == "gap_fill"
    assert len(item.gaps) == 2
    assert item.gaps[0].gap_id == "1"
    assert item.gaps[1].gap_id == "2"
    assert len(item.gaps[0].options) == 2
    assert item.gaps[0].options[0].content == "facilite"
    assert item.gaps[0].options[0].is_correct is True


@pytest.mark.asyncio
async def test_bulk_import_ai_auto_tag_preserves_gaps_validity(db_session: AsyncSession) -> None:
    """Test that ai_auto_tag_and_format_items re-validates multi-gap items without injecting false missing answer errors."""
    raw_json = {
        "items": [
            {
                "prompt": "Complétez le texte ci-dessous.",
                "stimulus_title": "Texte lacunaire",
                "stimulus_text": "Première partie [1] deuxième partie [2].",
                "task_type_code": "text_gap",
                "gaps": [
                    {
                        "gap_id": "1",
                        "options": [
                            {"content": "A1", "is_correct": True},
                            {"content": "A2", "is_correct": False},
                        ],
                    },
                    {
                        "gap_id": "2",
                        "options": [
                            {"content": "B1", "is_correct": True},
                            {"content": "B2", "is_correct": False},
                        ],
                    },
                ],
            }
        ]
    }
    parsed = BulkQuestionService.parse_import_file(json.dumps(raw_json).encode("utf-8"), "test.json")
    item = parsed.items[0]
    assert item.is_valid is True

    from app.modules.admin.bulk_question_schemas import AIAutoTagAndFormatRequest
    enrich_req = AIAutoTagAndFormatRequest(items=[item], auto_tag_skills=True, auto_format_rich_text=True)
    res = await BulkQuestionService.ai_auto_tag_and_format_items(db_session, enrich_req)
    assert res.enriched_count == 1
    enriched_item = res.items[0]
    assert enriched_item.is_valid is True
    assert len(enriched_item.validation_errors) == 0
    assert enriched_item.response_type == "gap_fill"


@pytest.mark.asyncio
async def test_bulk_import_json_multi_gap_singular_and_nested_aliases() -> None:
    """Test importing cloze questions using singular aliases, flat options, dict options, and nested containers."""
    # 1. Singular gap + singular option
    raw_singular = {
        "items": [
            {
                "prompt": "Complétez le texte.",
                "stimulus_text": "Le vélo [1] les déplacements.",
                "task_type_code": "text_gap",
                "gap": [
                    {
                        "id": "1",
                        "option": [
                            {"text": "facilite", "is_correct": True},
                            {"text": "bloque", "is_correct": False},
                        ],
                    }
                ],
            }
        ]
    }
    parsed1 = BulkQuestionService.parse_import_file(json.dumps(raw_singular).encode("utf-8"), "test1.json")
    assert parsed1.total_parsed == 1
    assert parsed1.valid_count == 1
    item1 = parsed1.items[0]
    assert item1.is_valid is True
    assert len(item1.gaps) == 1
    assert item1.gaps[0].gap_id == "1"
    assert len(item1.gaps[0].options) == 2
    assert item1.gaps[0].options[0].is_correct is True
    assert len(item1.options) == 2

    # 2. Flat gap options with gap-level correct_option
    raw_flat = {
        "items": [
            {
                "prompt": "Complétez le texte.",
                "stimulus_text": "Le projet est [1].",
                "task_type_code": "text_gap",
                "gaps": [
                    {
                        "gap_id": "1",
                        "option_a": "validé",
                        "option_b": "rejeté",
                        "correct_option": "A",
                    }
                ],
            }
        ]
    }
    parsed2 = BulkQuestionService.parse_import_file(json.dumps(raw_flat).encode("utf-8"), "test2.json")
    assert parsed2.total_parsed == 1
    assert parsed2.valid_count == 1
    item2 = parsed2.items[0]
    assert item2.is_valid is True
    assert len(item2.gaps[0].options) == 2
    assert item2.gaps[0].options[0].content == "validé"
    assert item2.gaps[0].options[0].is_correct is True
    assert item2.gaps[0].options[1].is_correct is False

    # 3. response_metadata container with dict options
    raw_nested = {
        "items": [
            {
                "prompt": "Complétez le texte.",
                "stimulus_text": "Le résultat est [1].",
                "task_type_code": "text_gap",
                "response_metadata": {
                    "gaps": [
                        {
                            "gap_id": "1",
                            "options": {
                                "A": "attendu",
                                "B": "inconnu",
                            },
                            "solution": "B",
                        }
                    ]
                },
            }
        ]
    }
    parsed3 = BulkQuestionService.parse_import_file(json.dumps(raw_nested).encode("utf-8"), "test3.json")
    assert parsed3.total_parsed == 1
    assert parsed3.valid_count == 1
    item3 = parsed3.items[0]
    assert item3.is_valid is True
    assert len(item3.gaps[0].options) == 2
    assert item3.gaps[0].options[1].content == "inconnu"
    assert item3.gaps[0].options[1].is_correct is True


@pytest.mark.asyncio
async def test_bulk_import_json_missing_gaps_reports_accurate_diagnostic() -> None:
    """Test that a gap_fill question without gaps or options reports the accurate diagnostic message."""
    raw_missing = {
        "items": [
            {
                "prompt": "Complétez le texte.",
                "stimulus_text": "Texte sans lacunes configurées [1].",
                "task_type_code": "text_gap",
            }
        ]
    }
    parsed = BulkQuestionService.parse_import_file(json.dumps(raw_missing).encode("utf-8"), "missing.json")
    assert parsed.total_parsed == 1
    assert parsed.valid_count == 0
    item = parsed.items[0]
    assert item.is_valid is False
    assert any("ne comporte aucun trou configuré" in err for err in item.validation_errors)
    assert not any("Au moins 1 réponse attendue est obligatoire." in err for err in item.validation_errors)


@pytest.mark.asyncio
async def test_bulk_import_questions_sharing_prompt_with_distinct_stimuli_are_not_duplicates(db_session: AsyncSession) -> None:
    """Questions sharing standardized task prompts but possessing distinct stimuli and options must NOT be flagged as duplicates."""
    raw_batch = {
        "items": [
            {
                "prompt": "Complétez le texte en choisissant la meilleure option pour chacune des deux lacunes.",
                "stimulus_title": "Document 1 — Client",
                "stimulus_text": "Pour rester en permanence __________ (1) de ses clients...",
                "task_type_code": "lexique_structure",
                "gaps": [
                    {
                        "gap_id": "1",
                        "options": [
                            {"content": "à l'écoute", "is_correct": True},
                            {"content": "au besoin", "is_correct": False},
                        ],
                    }
                ],
            },
            {
                "prompt": "Complétez le texte en choisissant la meilleure option pour chacune des deux lacunes.",
                "stimulus_title": "Document 2 — Formation",
                "stimulus_text": "La prochaine session de formation se tiendra __________ (1)...",
                "task_type_code": "lexique_structure",
                "gaps": [
                    {
                        "gap_id": "1",
                        "options": [
                            {"content": "en amont", "is_correct": True},
                            {"content": "en avant", "is_correct": False},
                        ],
                    }
                ],
            },
        ]
    }

    parsed = BulkQuestionService.parse_import_file(json.dumps(raw_batch).encode("utf-8"), "distinct_stimuli.json")
    assert parsed.total_parsed == 2
    assert parsed.valid_count == 2
    assert parsed.duplicate_count == 0
    assert parsed.items[0].is_duplicate is False
    assert parsed.items[1].is_duplicate is False

    commit_req = BulkImportCommitRequest(items=parsed.items, skip_duplicates=True)
    res = await BulkQuestionService.commit_bulk_import(db_session, commit_req)
    assert res.created_count == 2
    assert res.skipped_duplicates_count == 0


@pytest.mark.asyncio
async def test_bulk_import_true_duplicate_with_same_stimulus_and_gaps_is_detected(db_session: AsyncSession) -> None:
    """Questions with identical prompt, stimulus, AND gaps must be caught as duplicates."""
    raw_batch = {
        "items": [
            {
                "prompt": "Complétez le texte en choisissant la meilleure option pour chacune des deux lacunes.",
                "stimulus_title": "Doc A",
                "stimulus_text": "Texte identique pour le test de doublon exact.",
                "task_type_code": "lexique_structure",
                "gaps": [
                    {
                        "gap_id": "1",
                        "options": [
                            {"content": "option 1", "is_correct": True},
                            {"content": "option 2", "is_correct": False},
                        ],
                    }
                ],
            },
            {
                "prompt": "Complétez le texte en choisissant la meilleure option pour chacune des deux lacunes.",
                "stimulus_title": "Doc A",
                "stimulus_text": "Texte identique pour le test de doublon exact.",
                "task_type_code": "lexique_structure",
                "gaps": [
                    {
                        "gap_id": "1",
                        "options": [
                            {"content": "option 1", "is_correct": True},
                            {"content": "option 2", "is_correct": False},
                        ],
                    }
                ],
            },
        ]
    }

    parsed = BulkQuestionService.parse_import_file(json.dumps(raw_batch).encode("utf-8"), "true_dup.json")
    assert parsed.total_parsed == 2
    assert parsed.duplicate_count == 1
    assert parsed.items[0].is_duplicate is False
    assert parsed.items[1].is_duplicate is True
    assert "Doublon" in (parsed.items[1].duplicate_reason or "")

    commit_req = BulkImportCommitRequest(items=parsed.items, skip_duplicates=True)
    res = await BulkQuestionService.commit_bulk_import(db_session, commit_req)
    assert res.created_count == 1
    assert res.skipped_duplicates_count == 1
