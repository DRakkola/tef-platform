"""Tests for Question Bank Bulk Actions, File Parsing, AI Auto-Tagging, and Bulk Import."""

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
from app.modules.assessments.models import Question, QuestionOption, QuestionSkillTag, Skill


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
    """Test parsing CSV formatted question bank files."""
    csv_data = (
        "prompt,question_type,modality,level,difficulty,option_a,option_b,option_c,option_d,correct_option,stimulus_title,stimulus_text\n"
        "Quelle est l'idée clé ?,single_choice,reading,B2,3,Option 1,Option 2,Option 3,Option 4,B,Avis officiel,Voici le texte du document.\n"
        "Où se situe l'événement ?,single_choice,reading,A2,1,Paris,Lyon,Marseille,Lille,A,Annonce,Rendez-vous à Paris.\n"
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
    assert item1.stimulus_title == "Avis officiel"
    assert len(item1.options) == 4
    # B was marked correct
    assert item1.options[1].is_correct is True
    assert item1.options[0].is_correct is False


@pytest.mark.asyncio
async def test_parse_json_file() -> None:
    """Test parsing JSON formatted question bank files."""
    json_str = """[
      {
        "prompt": "Quel est l'objectif de ce courriel ?",
        "question_type": "single_choice",
        "modality": "reading",
        "level": "B1",
        "difficulty": 2,
        "options": [
          {"content": "Confirmer une réservation", "is_correct": true},
          {"content": "Demander un remboursement", "is_correct": false}
        ],
        "stimulus_title": "Courriel de confirmation",
        "stimulus_text": "Merci pour votre réservation."
      }
    ]"""
    json_data = json_str.encode("utf-8")

    res = BulkQuestionService.parse_import_file(json_data, "batch.json")
    assert res.total_parsed == 1
    assert res.valid_count == 1
    assert res.items[0].prompt == "Quel est l'objectif de ce courriel ?"
    assert res.items[0].options[0].is_correct is True


@pytest.mark.asyncio
async def test_csv_template_generation() -> None:
    """Test generating standard import template."""
    csv_str = BulkQuestionService.generate_csv_template()
    assert "prompt,question_type,modality,level,difficulty" in csv_str
    assert "CE-L1-COMP-GLOB" in csv_str


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
    # Check skill codes mapped
    assert len(enriched.skill_codes) > 0


@pytest.mark.asyncio
async def test_bulk_import_commit(db_session: AsyncSession, setup_taxonomy: tuple[Skill, Skill]) -> None:
    """Test transactional commit of imported questions into database."""
    s_rea, s_lang = setup_taxonomy

    items_to_import = [
        BulkImportQuestionItem(
            prompt=f"Question d'import {uuid.uuid4().hex[:6]}",
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

    # Query back from DB
    q_id = res.created_ids[0]
    q = await db_session.get(Question, q_id)
    assert q is not None
    assert q.status == "draft"
    assert q.level == "B2"
    assert q.stimulus_id is not None


@pytest.mark.asyncio
async def test_bulk_actions(db_session: AsyncSession, setup_taxonomy: tuple[Skill, Skill]) -> None:
    """Test bulk archive, validate, and delete actions on question collection."""
    s_rea, _s_lang = setup_taxonomy

    # Create 2 questions
    q1 = Question(
        prompt=f"Question Bulk 1 {uuid.uuid4().hex}",
        question_type=QuestionType.SINGLE_CHOICE,
        response_type="single_choice",
        level="B1",
        difficulty=2,
        points=1,
        status=ContentStatus.DRAFT.value,
        version=1,
    )
    q2 = Question(
        prompt=f"Question Bulk 2 {uuid.uuid4().hex}",
        question_type=QuestionType.SINGLE_CHOICE,
        response_type="single_choice",
        level="B1",
        difficulty=2,
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

    # 2. Bulk Archive
    arc_req = BulkActionRequest(question_ids=[q1.id, q2.id], action=BulkActionType.ARCHIVE)
    arc_res = await BulkQuestionService.execute_bulk_action(db_session, arc_req)
    assert arc_res.success_count == 2
    q1_db = await db_session.get(Question, q1.id)
    assert q1_db is not None
    assert q1_db.status == ContentStatus.ARCHIVED.value

    # 3. Bulk Delete
    del_req = BulkActionRequest(question_ids=[q1.id, q2.id], action=BulkActionType.DELETE)
    del_res = await BulkQuestionService.execute_bulk_action(db_session, del_req)
    assert del_res.success_count == 2
    assert await db_session.get(Question, q1.id) is None
    assert await db_session.get(Question, q2.id) is None
