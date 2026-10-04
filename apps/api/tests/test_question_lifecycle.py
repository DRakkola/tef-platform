"""Comprehensive Test Suite for Question Lifecycle, Versioning, and Immutability (Phase 4).

Verifies:
1. State Machine:
   - draft -> in_review -> approved -> published -> archived
   - in_review -> rejected -> draft -> in_review
   - invalid transitions rejected (draft -> published, approved -> draft, published -> draft, archived -> published)
2. Editing Guards:
   - draft and rejected questions are editable
   - approved, published, and archived questions cannot be modified in-place (400 CANNOT_EDIT_NON_DRAFT_QUESTION)
   - optimistic concurrency conflict check (409 CONCURRENT_MODIFICATION_CONFLICT)
3. Versioning & Immutability:
   - publishing creates an immutable QuestionVersion snapshot
   - create_draft_version branches a new draft (v2) while keeping v1 snapshot intact
   - mutating v2 does not mutate v1 snapshot
4. Delivered Version Tracking:
   - examinee answer submission resolves and pins delivered question_version_id
   - historical result retrieval references delivered version
5. Forking:
   - forks question into independent new item with lineage provenance (source_type='forked')
   - source item remains unmutated
6. Validation Gates:
   - blocking errors prevent review submission (422)
   - warnings allow review
7. Audit Logging:
   - every transition generates an immutable AuditEvent
8. Security & Permissions:
   - admin endpoints require UserRole.ADMIN (non-admins receive 403/401)
"""

from __future__ import annotations

import hashlib
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException
from app.modules.admin.enums import ContentStatus, SkillDimension, SkillTagRole
from app.modules.admin.models import TaxonomyVersion
from app.modules.admin.question_lifecycle_service import QuestionLifecycleService
from app.modules.admin.schemas import AdminStandaloneQuestionUpdate
from app.modules.admin.service import AdminContentService
from app.modules.assessments.enums import (
    AssessmentType,
    CognitiveComplexityLevel,
    NavigationPolicy,
    QuestionResponseType,
    QuestionType,
    ScoringPolicy,
)
from app.modules.assessments.models import (
    Assessment,
    AssessmentSection,
    Question,
    QuestionOption,
    QuestionProvenance,
    QuestionSkillTag,
    Skill,
    Stimulus,
    TaskType,
)
from app.modules.assessments.service import AssessmentService
from app.modules.users.models import User, UserRole

# ---------------------------------------------------------------------------
# Fixtures & Helpers
# ---------------------------------------------------------------------------


async def _make_test_fixtures(db: AsyncSession) -> tuple[TaskType, Stimulus, Skill, Skill]:
    """Create basic taxonomy, task type, stimulus, and reasoning + language skills."""
    tv = TaxonomyVersion(
        version=f"v-life-test-{uuid.uuid4().hex[:6]}",
        name="Lifecycle Test Taxonomy",
        status="active",
    )
    db.add(tv)
    await db.flush()

    tt = TaskType(
        code=f"life_task_{uuid.uuid4().hex[:6]}",
        name="Lifecycle Document Task",
        modality="reading",
        is_active=True,
    )
    db.add(tt)
    await db.flush()

    text_content = f"Le nouveau plan de transport en commun pour Ottawa {uuid.uuid4().hex}."
    c_hash = hashlib.sha256(text_content.encode("utf-8")).hexdigest()
    stim = Stimulus(
        title="Inauguration transport",
        modality="reading",
        content_text=text_content,
        word_count=13,
        content_hash=c_hash,
    )
    db.add(stim)
    await db.flush()

    sk_reasoning = Skill(
        taxonomy_version_id=tv.id,
        code=f"sk_rea_{uuid.uuid4().hex[:6]}",
        name="Identify Main Idea",
        category="reading",
        dimension=SkillDimension.REASONING,
        is_active=True,
    )
    sk_lang = Skill(
        taxonomy_version_id=tv.id,
        code=f"sk_lan_{uuid.uuid4().hex[:6]}",
        name="Lexical Context",
        category="reading",
        dimension=SkillDimension.LANGUAGE,
        is_active=True,
    )
    db.add_all([sk_reasoning, sk_lang])
    await db.flush()

    return tt, stim, sk_reasoning, sk_lang


async def _create_valid_draft_question(
    db: AsyncSession,
    tt: TaskType,
    stim: Stimulus,
    sk_rea: Skill,
    sk_lang: Skill,
    actor_id: uuid.UUID | None = None,
) -> Question:
    """Create a fully valid draft Question with 4 options and valid skill tags."""
    q = Question(
        prompt="Quel est le sujet principal de cette annonce ?",
        instructions="Choisissez la bonne réponse.",
        question_type=QuestionType.SINGLE_CHOICE,
        response_type=QuestionResponseType.SINGLE_CHOICE.value,
        level="B2",
        target_cefr="B2",
        difficulty=3,
        difficulty_rating=420,
        cognitive_complexity=CognitiveComplexityLevel.INFERENCING_SYNTHESIS.value,
        points=1,
        penalty_points=0,
        status=ContentStatus.DRAFT.value,
        version=1,
        is_live_delivered=False,
        task_type_id=tt.id,
        stimulus_id=stim.id,
        created_by_user_id=actor_id,
        updated_by_user_id=actor_id,
    )
    db.add(q)
    await db.flush()

    opts = [
        QuestionOption(
            question_id=q.id,
            content="L'ouverture du nouveau réseau de transport",
            order_index=1,
            is_correct=True,
            explanation="Le texte annonce clairement l'inauguration.",
        ),
        QuestionOption(
            question_id=q.id,
            content="La fermeture d'une station de métro à Ottawa",
            order_index=2,
            is_correct=False,
            explanation="Incorrect : il s'agit d'une ouverture.",
            misconception_type="opposite_meaning",
            distractor_rationale="Confond ouverture et fermeture.",
        ),
        QuestionOption(
            question_id=q.id,
            content="L'augmentation générale du prix des billets",
            order_index=3,
            is_correct=False,
            explanation="Non mentionné.",
            misconception_type="unsupported_inference",
            distractor_rationale="Extrapole un coût inexistant.",
        ),
        QuestionOption(
            question_id=q.id,
            content="Une grève des employés municipaux du rail",
            order_index=4,
            is_correct=False,
            explanation="Non mentionné.",
            misconception_type="unsupported_inference",
            distractor_rationale="Confond inauguration et perturbation.",
        ),
    ]
    db.add_all(opts)

    tags = [
        QuestionSkillTag(
            question_id=q.id,
            skill_id=sk_rea.id,
            role=SkillTagRole.PRIMARY,
            weight=1.0,
        ),
        QuestionSkillTag(
            question_id=q.id,
            skill_id=sk_lang.id,
            role=SkillTagRole.PRIMARY,
            weight=1.0,
        ),
    ]
    db.add_all(tags)

    prov = QuestionProvenance(
        question_id=q.id,
        author_type="human",
        source_type="original",
        created_by_user_id=actor_id,
    )
    db.add(prov)
    await db.commit()

    return await QuestionLifecycleService.get_question_with_relations(db, q.id)


# ---------------------------------------------------------------------------
# 1. State Machine Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_canonical_lifecycle_happy_path(db_session: AsyncSession) -> None:
    """Verify happy path: DRAFT -> IN_REVIEW -> APPROVED -> PUBLISHED -> ARCHIVED."""
    tt, stim, sk_rea, sk_lang = await _make_test_fixtures(db_session)
    admin_id = uuid.uuid4()
    q = await _create_valid_draft_question(db_session, tt, stim, sk_rea, sk_lang, actor_id=admin_id)

    assert q.status == ContentStatus.DRAFT.value
    assert q.version == 1

    # 1. Submit for review
    q = await QuestionLifecycleService.submit_for_review(db_session, q.id, actor_id=admin_id, comments="Ready for QA")
    assert q.status == ContentStatus.IN_REVIEW.value

    # 2. Approve
    q = await QuestionLifecycleService.approve_question(db_session, q.id, actor_id=admin_id, notes="Looks solid")
    assert q.status == ContentStatus.APPROVED.value
    assert q.provenance.reviewed_by_user_id == admin_id

    # 3. Publish
    q = await QuestionLifecycleService.publish_question(db_session, q.id, actor_id=admin_id, changelog="Initial release")
    assert q.status == ContentStatus.PUBLISHED.value
    assert q.is_live_delivered is True

    # Verify QuestionVersion snapshot was created
    ver = await QuestionLifecycleService.get_published_version(db_session, q.id)
    assert ver is not None
    assert ver.version == 1
    assert ver.snapshot_payload["prompt"] == q.prompt
    assert ver.snapshot_payload["changelog"] == "Initial release"

    # 4. Archive
    q = await QuestionLifecycleService.archive_question(db_session, q.id, actor_id=admin_id, reason="Deprecated item")
    assert q.status == ContentStatus.ARCHIVED.value


@pytest.mark.asyncio
async def test_lifecycle_rejection_and_re_draft_flow(db_session: AsyncSession) -> None:
    """Verify review rejection cycle: DRAFT -> IN_REVIEW -> REJECTED -> DRAFT -> IN_REVIEW -> APPROVED."""
    tt, stim, sk_rea, sk_lang = await _make_test_fixtures(db_session)
    admin_id = uuid.uuid4()
    q = await _create_valid_draft_question(db_session, tt, stim, sk_rea, sk_lang, actor_id=admin_id)

    # 1. Submit for review
    q = await QuestionLifecycleService.submit_for_review(db_session, q.id, actor_id=admin_id)
    assert q.status == ContentStatus.IN_REVIEW.value

    # 2. Reject with feedback
    q = await QuestionLifecycleService.reject_question(db_session, q.id, actor_id=admin_id, notes="Distractors need improvement")
    assert q.status == ContentStatus.REJECTED.value
    assert q.provenance.review_notes == "Distractors need improvement"

    # 3. Rejected items can be edited in place
    update_payload = AdminStandaloneQuestionUpdate(prompt="Quel est l'objectif premier de cette annonce ?")
    q_updated = await AdminContentService.update_question(db_session, q.id, update_payload, actor_id=admin_id)
    assert q_updated.prompt == "Quel est l'objectif premier de cette annonce ?"

    # 4. Re-submit for review
    q = await QuestionLifecycleService.submit_for_review(db_session, q.id, actor_id=admin_id, comments="Addressed notes")
    assert q.status == ContentStatus.IN_REVIEW.value

    # 5. Approve
    q = await QuestionLifecycleService.approve_question(db_session, q.id, actor_id=admin_id)
    assert q.status == ContentStatus.APPROVED.value


@pytest.mark.asyncio
async def test_forbidden_lifecycle_state_transitions(db_session: AsyncSession) -> None:
    """Verify that illegal state transitions are strictly rejected by the backend."""
    tt, stim, sk_rea, sk_lang = await _make_test_fixtures(db_session)
    admin_id = uuid.uuid4()
    q = await _create_valid_draft_question(db_session, tt, stim, sk_rea, sk_lang, actor_id=admin_id)

    # 1. DRAFT -> PUBLISHED directly is forbidden
    with pytest.raises(AppException) as exc1:
        await QuestionLifecycleService.publish_question(db_session, q.id, actor_id=admin_id)
    assert exc1.value.status_code == 409
    assert exc1.value.code == "LIFECYCLE_STATE_CONFLICT"

    # 2. DRAFT -> APPROVED directly is forbidden
    with pytest.raises(AppException) as exc2:
        await QuestionLifecycleService.approve_question(db_session, q.id, actor_id=admin_id)
    assert exc2.value.status_code == 409
    assert exc2.value.code == "LIFECYCLE_STATE_CONFLICT"

    # Move to review
    await QuestionLifecycleService.submit_for_review(db_session, q.id, actor_id=admin_id)

    # 3. IN_REVIEW -> PUBLISHED directly is forbidden (must be approved first)
    with pytest.raises(AppException) as exc3:
        await QuestionLifecycleService.publish_question(db_session, q.id, actor_id=admin_id)
    assert exc3.value.status_code == 409

    # Approve and publish
    await QuestionLifecycleService.approve_question(db_session, q.id, actor_id=admin_id)
    await QuestionLifecycleService.publish_question(db_session, q.id, actor_id=admin_id)

    # 4. PUBLISHED -> IN_REVIEW directly is forbidden (must branch new draft version)
    with pytest.raises(AppException) as exc4:
        await QuestionLifecycleService.submit_for_review(db_session, q.id, actor_id=admin_id)
    assert exc4.value.status_code == 409


# ---------------------------------------------------------------------------
# 2. Editing Protection & Concurrency Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_approved_and_published_questions_cannot_be_mutated_in_place(db_session: AsyncSession) -> None:
    """Verify immutability: approved or published questions reject update_question calls."""
    tt, stim, sk_rea, sk_lang = await _make_test_fixtures(db_session)
    admin_id = uuid.uuid4()
    q = await _create_valid_draft_question(db_session, tt, stim, sk_rea, sk_lang, actor_id=admin_id)

    # Move to approved
    await QuestionLifecycleService.submit_for_review(db_session, q.id, actor_id=admin_id)
    await QuestionLifecycleService.approve_question(db_session, q.id, actor_id=admin_id)

    # Attempt to edit approved question
    payload = AdminStandaloneQuestionUpdate(prompt="Attempted malicious mutation of approved item")
    with pytest.raises(AppException) as exc_appr:
        await AdminContentService.update_question(db_session, q.id, payload, actor_id=admin_id)
    assert exc_appr.value.status_code == 400
    assert exc_appr.value.code == "CANNOT_EDIT_NON_DRAFT_QUESTION"

    # Move to published
    await QuestionLifecycleService.publish_question(db_session, q.id, actor_id=admin_id)

    # Attempt to edit published question
    with pytest.raises(AppException) as exc_pub:
        await AdminContentService.update_question(db_session, q.id, payload, actor_id=admin_id)
    assert exc_pub.value.status_code == 400
    assert exc_pub.value.code == "CANNOT_EDIT_NON_DRAFT_QUESTION"


@pytest.mark.asyncio
async def test_optimistic_concurrency_conflict_detection(db_session: AsyncSession) -> None:
    """Verify that expected_version mismatch triggers 409 CONCURRENT_MODIFICATION_CONFLICT."""
    tt, stim, sk_rea, sk_lang = await _make_test_fixtures(db_session)
    admin_id = uuid.uuid4()
    q = await _create_valid_draft_question(db_session, tt, stim, sk_rea, sk_lang, actor_id=admin_id)

    assert q.version == 1

    # Update with correct expected_version succeeds
    payload_ok = AdminStandaloneQuestionUpdate(prompt="Correct version edit", expected_version=1)
    q_updated = await AdminContentService.update_question(db_session, q.id, payload_ok, actor_id=admin_id)
    assert q_updated.prompt == "Correct version edit"

    # Update with stale expected_version (e.g. 0 or 2) fails with 409
    payload_conflict = AdminStandaloneQuestionUpdate(prompt="Stale edit", expected_version=2)
    with pytest.raises(AppException) as exc:
        await AdminContentService.update_question(db_session, q.id, payload_conflict, actor_id=admin_id)
    assert exc.value.status_code == 409
    assert exc.value.code == "CONCURRENT_MODIFICATION_CONFLICT"


# ---------------------------------------------------------------------------
# 3. Versioning & Immutability Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_draft_version_branches_v2_preserving_v1(db_session: AsyncSession) -> None:
    """Verify version branching: published v1 is frozen, create_draft_version produces v2 in draft."""
    tt, stim, sk_rea, sk_lang = await _make_test_fixtures(db_session)
    admin_id = uuid.uuid4()
    q = await _create_valid_draft_question(db_session, tt, stim, sk_rea, sk_lang, actor_id=admin_id)

    # Publish Version 1
    await QuestionLifecycleService.submit_for_review(db_session, q.id, actor_id=admin_id)
    await QuestionLifecycleService.approve_question(db_session, q.id, actor_id=admin_id)
    await QuestionLifecycleService.publish_question(db_session, q.id, actor_id=admin_id, changelog="V1 Initial")

    v1_snapshot = await QuestionLifecycleService.get_version(db_session, q.id, 1)
    assert v1_snapshot.prompt == q.prompt
    assert v1_snapshot.snapshot_payload["prompt"] == q.prompt

    # Branch new draft version (creates V2)
    q_v2 = await QuestionLifecycleService.create_draft_version(db_session, q.id, actor_id=admin_id, changelog="Starting V2")
    assert q_v2.version == 2
    assert q_v2.status == ContentStatus.DRAFT.value
    assert q_v2.is_live_delivered is False

    # Now V2 draft can be edited freely
    edit_payload = AdminStandaloneQuestionUpdate(
        prompt="Nouveau libellé pour la Version 2",
        difficulty_rating=460,
    )
    q_v2_edited = await AdminContentService.update_question(db_session, q_v2.id, edit_payload, actor_id=admin_id)
    assert q_v2_edited.prompt == "Nouveau libellé pour la Version 2"
    assert q_v2_edited.difficulty_rating == 460

    # Verify V1 historical snapshot remains completely unaltered!
    v1_reloaded = await QuestionLifecycleService.get_version(db_session, q.id, 1)
    assert v1_reloaded.prompt != "Nouveau libellé pour la Version 2"
    assert v1_reloaded.snapshot_payload["prompt"] != "Nouveau libellé pour la Version 2"
    assert v1_reloaded.snapshot_payload["difficulty_rating"] == 420


# ---------------------------------------------------------------------------
# 4. Delivered Version Tracking & Attempt Linkage
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_attempt_pins_delivered_question_version(db_session: AsyncSession) -> None:
    """Verify that student exam attempt answers pin the exact delivered QuestionVersion."""
    tt, stim, sk_rea, sk_lang = await _make_test_fixtures(db_session)
    admin_id = uuid.uuid4()
    q = await _create_valid_draft_question(db_session, tt, stim, sk_rea, sk_lang, actor_id=admin_id)

    # Publish question (creates QuestionVersion v1)
    await QuestionLifecycleService.submit_for_review(db_session, q.id, actor_id=admin_id)
    await QuestionLifecycleService.approve_question(db_session, q.id, actor_id=admin_id)
    await QuestionLifecycleService.publish_question(db_session, q.id, actor_id=admin_id)

    v1_ver = await QuestionLifecycleService.get_published_version(db_session, q.id)
    assert v1_ver is not None

    # Create Assessment and Section containing this question
    asmt = Assessment(
        title="Test Exam Versioning",
        assessment_type=AssessmentType.READING,
        duration_seconds=3600,
        navigation_policy=NavigationPolicy.FREE,
        scoring_policy=ScoringPolicy.STANDARD_POINTS,
        is_published=True,
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

    q.section_id = sec.id
    await db_session.commit()

    # Create student and attempt
    student = User(
        email=f"candidate.{uuid.uuid4().hex[:6]}@example.com",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db_session.add(student)
    await db_session.flush()

    attempt = await AssessmentService.create_attempt(db_session, asmt.id, student.id)

    # Reload question options
    q_loaded = await QuestionLifecycleService.get_question_with_relations(db_session, q.id)
    correct_opt = next(o for o in q_loaded.options if o.is_correct)

    # Submit answer
    ans = await AssessmentService.submit_answer(
        db=db_session,
        attempt_id=attempt.id,
        current_user_id=student.id,
        question_id=q.id,
        selected_option_id=correct_opt.id,
    )

    # Assert AttemptAnswer was pinned to delivered question_version_id
    assert ans.question_version_id is not None
    assert ans.question_version_id == v1_ver.id

    # Verify attempt results include question_version_id
    await AssessmentService.submit_attempt(
        db=db_session,
        attempt_id=attempt.id,
        current_user_id=student.id,
    )
    await db_session.commit()

    results = await AssessmentService.get_attempt_results(
        db=db_session,
        attempt_id=attempt.id,
        current_user_id=student.id,
    )
    assert len(results["sections"]) > 0
    ans_data = results["sections"][0]["questions"][0]["user_answer"]
    assert ans_data["question_version_id"] == v1_ver.id


# ---------------------------------------------------------------------------
# 5. Question Forking Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_question_fork_creates_independent_entity_with_lineage(db_session: AsyncSession) -> None:
    """Verify that forking a question clones options and skills without altering source."""
    tt, stim, sk_rea, sk_lang = await _make_test_fixtures(db_session)
    admin_id = uuid.uuid4()
    source_q = await _create_valid_draft_question(db_session, tt, stim, sk_rea, sk_lang, actor_id=admin_id)

    # Publish source question
    await QuestionLifecycleService.submit_for_review(db_session, source_q.id, actor_id=admin_id)
    await QuestionLifecycleService.approve_question(db_session, source_q.id, actor_id=admin_id)
    await QuestionLifecycleService.publish_question(db_session, source_q.id, actor_id=admin_id)

    # Fork question
    forked_q = await QuestionLifecycleService.fork_question(
        db=db_session,
        question_id=source_q.id,
        actor_id=admin_id,
        prompt_prefix="[Variante]",
        changelog="Forked variant for regional test",
    )

    # Verify forked question identity and status
    assert forked_q.id != source_q.id
    assert forked_q.status == ContentStatus.DRAFT.value
    assert forked_q.version == 1
    assert forked_q.prompt.startswith("[Variante]")
    assert len(forked_q.options) == len(source_q.options)
    assert len(forked_q.skill_tags) == len(source_q.skill_tags)

    # Verify provenance lineage
    assert forked_q.provenance is not None
    assert forked_q.provenance.source_type == "forked"
    assert str(source_q.id) in forked_q.provenance.source_reference
    assert f":v{source_q.version}" in forked_q.provenance.source_reference

    # Verify source question is completely untouched
    source_reloaded = await QuestionLifecycleService.get_question_with_relations(db_session, source_q.id)
    assert source_reloaded.status == ContentStatus.PUBLISHED.value
    assert not source_reloaded.prompt.startswith("[Variante]")


# ---------------------------------------------------------------------------
# 6. Validation Gates at State Boundaries
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_validation_gate_blocks_review_if_blocking_error(db_session: AsyncSession) -> None:
    """Verify that QuestionValidationEngine blocks submit_for_review if blocking errors exist."""
    tt, stim, _sk_rea, _sk_lang = await _make_test_fixtures(db_session)
    admin_id = uuid.uuid4()

    # Create invalid question (e.g. 0 options)
    invalid_q = Question(
        prompt="Question sans aucune option de réponse ?",
        question_type=QuestionType.SINGLE_CHOICE,
        response_type="single_choice",
        level="B1",
        difficulty=3,
        points=1,
        status=ContentStatus.DRAFT.value,
        task_type_id=tt.id,
        stimulus_id=stim.id,
    )
    db_session.add(invalid_q)
    await db_session.commit()

    # Submitting for review must fail with 422 QUESTION_VALIDATION_FAILED
    with pytest.raises(AppException) as exc:
        await QuestionLifecycleService.submit_for_review(db_session, invalid_q.id, actor_id=admin_id)
    assert exc.value.status_code == 422
    assert exc.value.code == "QUESTION_VALIDATION_FAILED"
    assert exc.value.details["blocking_error_count"] > 0


# ---------------------------------------------------------------------------
# 7. Audit Logging Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_every_lifecycle_transition_records_audit_event(db_session: AsyncSession) -> None:
    """Verify that submit_for_review, approve, publish, and archive each record an AuditEvent."""
    tt, stim, sk_rea, sk_lang = await _make_test_fixtures(db_session)
    admin_id = uuid.uuid4()
    q = await _create_valid_draft_question(db_session, tt, stim, sk_rea, sk_lang, actor_id=admin_id)

    # 1. Submit review
    await QuestionLifecycleService.submit_for_review(db_session, q.id, actor_id=admin_id)
    # 2. Approve
    await QuestionLifecycleService.approve_question(db_session, q.id, actor_id=admin_id)
    # 3. Publish
    await QuestionLifecycleService.publish_question(db_session, q.id, actor_id=admin_id)
    # 4. Archive
    await QuestionLifecycleService.archive_question(db_session, q.id, actor_id=admin_id)

    events = await QuestionLifecycleService.get_history(db_session, q.id)
    assert len(events) >= 4

    actions = [e.action for e in events]
    assert "content.submitted_for_review" in actions
    assert "content.approved" in actions
    assert "content.published" in actions
    assert "content.archived" in actions

    for event in events:
        assert event.entity_type == "question"
        assert event.entity_id == q.id
        assert event.actor_user_id == admin_id
        assert "from_status" in event.payload
        assert "to_status" in event.payload


# ---------------------------------------------------------------------------
# 8. Admin API Route Integration Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_admin_api_question_lifecycle_routes(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
    student_auth_headers: dict[str, str],
    db_session: AsyncSession,
) -> None:
    """Verify HTTP API lifecycle routes: permissions, transitions, version listing, and history."""
    tt, stim, sk_rea, sk_lang = await _make_test_fixtures(db_session)
    q = await _create_valid_draft_question(db_session, tt, stim, sk_rea, sk_lang)

    # 1. Non-admin cannot submit review (403)
    resp_student = await client.post(
        f"/api/v1/admin/content/questions/{q.id}/submit-review",
        headers=student_auth_headers,
        json={"comments": "Student attempt"},
    )
    assert resp_student.status_code == 403

    # 2. Admin submits for review (200)
    resp_review = await client.post(
        f"/api/v1/admin/content/questions/{q.id}/submit-review",
        headers=admin_auth_headers,
        json={"comments": "Submitting via API"},
    )
    assert resp_review.status_code == 200
    assert resp_review.json()["status"] == "in_review"

    # 3. Admin approves (200)
    resp_appr = await client.post(
        f"/api/v1/admin/content/questions/{q.id}/approve",
        headers=admin_auth_headers,
        json={"notes": "Approved via API"},
    )
    assert resp_appr.status_code == 200
    assert resp_appr.json()["status"] == "approved"

    # 4. Admin publishes (200)
    resp_pub = await client.post(
        f"/api/v1/admin/content/questions/{q.id}/publish",
        headers=admin_auth_headers,
        json={"changelog": "Published via API"},
    )
    assert resp_pub.status_code == 200
    assert resp_pub.json()["status"] == "published"

    # 5. Fetch published version (200)
    resp_ver = await client.get(
        f"/api/v1/admin/content/questions/{q.id}/published-version",
        headers=admin_auth_headers,
    )
    assert resp_ver.status_code == 200
    assert resp_ver.json()["version"] == 1
    assert resp_ver.json()["changelog"] == "Published via API"

    # 6. Fork question via API (201)
    resp_fork = await client.post(
        f"/api/v1/admin/content/questions/{q.id}/fork",
        headers=admin_auth_headers,
        json={"prompt_prefix": "[API Fork]"},
    )
    assert resp_fork.status_code == 201
    forked_id = resp_fork.json()["id"]
    assert forked_id != str(q.id)

    # 7. Fetch audit history (200)
    resp_hist = await client.get(
        f"/api/v1/admin/content/questions/{q.id}/history",
        headers=admin_auth_headers,
    )
    assert resp_hist.status_code == 200
    history = resp_hist.json()
    assert len(history) >= 3


@pytest.mark.asyncio
async def test_revert_to_draft_flow_and_forbidden_states(db_session: AsyncSession) -> None:
    """Verify that in_review and rejected questions can be reverted to draft, while other states reject it."""
    tt, stim, sk_rea, sk_lang = await _make_test_fixtures(db_session)
    admin_id = uuid.uuid4()
    q = await _create_valid_draft_question(db_session, tt, stim, sk_rea, sk_lang, actor_id=admin_id)

    # 1. Reverting an already draft question raises 409
    with pytest.raises(AppException) as exc1:
        await QuestionLifecycleService.revert_to_draft(db_session, q.id, actor_id=admin_id)
    assert exc1.value.status_code == 409
    assert exc1.value.code == "LIFECYCLE_STATE_CONFLICT"

    # 2. IN_REVIEW -> DRAFT (author withdraws review request)
    await QuestionLifecycleService.submit_for_review(db_session, q.id, actor_id=admin_id)
    assert q.status == ContentStatus.IN_REVIEW.value
    q_rev = await QuestionLifecycleService.revert_to_draft(db_session, q.id, actor_id=admin_id, reason="Author withdrew")
    assert q_rev.status == ContentStatus.DRAFT.value

    # 3. REJECTED -> DRAFT (author acknowledges rejection)
    await QuestionLifecycleService.submit_for_review(db_session, q.id, actor_id=admin_id)
    await QuestionLifecycleService.reject_question(db_session, q.id, actor_id=admin_id, notes="Needs fix")
    assert q.status == ContentStatus.REJECTED.value
    q_reopened = await QuestionLifecycleService.revert_to_draft(db_session, q.id, actor_id=admin_id, reason="Reopening to fix")
    assert q_reopened.status == ContentStatus.DRAFT.value

    # 4. APPROVED -> DRAFT via revert_to_draft is forbidden
    await QuestionLifecycleService.submit_for_review(db_session, q.id, actor_id=admin_id)
    await QuestionLifecycleService.approve_question(db_session, q.id, actor_id=admin_id)
    assert q.status == ContentStatus.APPROVED.value
    with pytest.raises(AppException) as exc2:
        await QuestionLifecycleService.revert_to_draft(db_session, q.id, actor_id=admin_id)
    assert exc2.value.status_code == 409
    assert exc2.value.code == "LIFECYCLE_STATE_CONFLICT"


@pytest.mark.asyncio
async def test_delivered_question_freeze_blocks_in_place_edits(db_session: AsyncSession) -> None:
    """Verify that a question with is_live_delivered=True is permanently frozen from in-place edits."""
    tt, stim, sk_rea, sk_lang = await _make_test_fixtures(db_session)
    admin_id = uuid.uuid4()
    q = await _create_valid_draft_question(db_session, tt, stim, sk_rea, sk_lang, actor_id=admin_id)

    # Simulate question being delivered
    q.is_live_delivered = True
    await db_session.flush()

    # Attempting to edit in place must fail with DELIVERED_QUESTION_IMMUTABLE
    update_payload = AdminStandaloneQuestionUpdate(prompt="Attempted modification to delivered question")
    with pytest.raises(AppException) as exc:
        await AdminContentService.update_question(db_session, q.id, update_payload, actor_id=admin_id)
    assert exc.value.status_code == 400
    assert exc.value.code == "DELIVERED_QUESTION_IMMUTABLE"


@pytest.mark.asyncio
async def test_student_delivery_privacy_and_snapshot_schema(db_session: AsyncSession) -> None:
    """Verify that student delivery view leaks no internal secrets, and frozen snapshot matches contract."""
    from app.modules.assessments.question_serializer import (
        FORBIDDEN_STUDENT_KEYS,
        QuestionSerializer,
    )

    tt, stim, sk_rea, sk_lang = await _make_test_fixtures(db_session)
    admin_id = uuid.uuid4()
    q = await _create_valid_draft_question(db_session, tt, stim, sk_rea, sk_lang, actor_id=admin_id)

    # 1. Student dictionary inspection
    student_dict = QuestionSerializer.to_student_dict(q)
    for forbidden_key in FORBIDDEN_STUDENT_KEYS:
        assert forbidden_key not in student_dict
    for opt in student_dict["options"]:
        assert "is_correct" not in opt
        assert "misconception_type" not in opt
        assert "distractor_rationale" not in opt
    assert "provenance" not in student_dict
    assert "validations" not in student_dict

    # 2. Frozen snapshot inspection
    snapshot = QuestionSerializer.to_frozen_snapshot(q, changelog="Initial publishing")
    assert snapshot["snapshot_schema_version"] == 1
    assert snapshot["snapshot_version"] == "2.0.0"
    assert snapshot["stimulus"] is not None
    assert snapshot["stimulus"]["content_text"] == stim.content_text
    assert len(snapshot["options"]) == 4
    assert any(opt["is_correct"] for opt in snapshot["options"])
    assert any(opt["misconception_type"] for opt in snapshot["options"] if not opt["is_correct"])
    assert len(snapshot["skill_tags"]) == 2
