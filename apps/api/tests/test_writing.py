"""Comprehensive tests for the Writing Assessment module:
- Word count utility according to French examination standards
- Server-controlled attempt timing, expiration, and live draft saving
- Submissions immutability, MinIO object storage, and size bounds
- Student data isolation and RBAC
- MockCorrectionProvider automated evaluation
- Human teacher assignment, review, correction lifecycle, and provenance
"""

import datetime
import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.modules.users.models import User, UserRole
from app.modules.writing.enums import (
    WritingTaskType,
)
from app.modules.writing.models import WritingAttempt, WritingTask
from app.modules.writing.seed import seed_writing_tasks
from app.modules.writing.utils import count_words_french

# ---------------------------------------------------------------------------
# Test Fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def seeded_tasks(db_session: AsyncSession) -> tuple[WritingTask, WritingTask]:
    """Seed sample writing tasks and return Section A and Section B tasks."""
    await seed_writing_tasks(db_session)
    task_a = await db_session.scalar(
        select(WritingTask).where(WritingTask.task_type == WritingTaskType.SECTION_A)
    )
    task_b = await db_session.scalar(
        select(WritingTask).where(WritingTask.task_type == WritingTaskType.SECTION_B)
    )
    assert task_a is not None
    assert task_b is not None
    return task_a, task_b


@pytest_asyncio.fixture
async def second_student(db_session: AsyncSession) -> User:
    """Isolated second student."""
    user = User(
        email=f"student2_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("ValidPassword123!"),
        role=UserRole.STUDENT,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
def second_student_headers(second_student: User) -> dict[str, str]:
    token = create_access_token(second_student.id, second_student.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def second_teacher(db_session: AsyncSession) -> User:
    """Second verified teacher to test teacher ownership and assignment concurrency."""
    user = User(
        email=f"teacher2_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("ValidPassword123!"),
        role=UserRole.TEACHER,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
def second_teacher_headers(second_teacher: User) -> dict[str, str]:
    token = create_access_token(second_teacher.id, second_teacher.role.value)
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# 1. French Word Count Unit Tests
# ---------------------------------------------------------------------------


def test_french_word_count_rules() -> None:
    """Verify standard TEF word counting rules for French elisions and hyphens."""
    assert count_words_french("") == 0
    assert count_words_french("   ") == 0

    # Basic sentence
    assert count_words_french("Le candidat rédige un texte.") == 5

    # Elisions with apostrophes: l', d', c', qu' count as separate words
    # "L'arbre" = "L'" + "arbre" = 2
    assert count_words_french("L'arbre est grand.") == 4

    # Multiple elisions
    # "C'est d'accord" = "C'" + "est" + "d'" + "accord" = 4
    assert count_words_french("C'est d'accord.") == 4

    # Typographical apostrophe ’
    assert count_words_french("J’ai réussi.") == 3

    # Compound hyphenated words count as single word
    assert count_words_french("Peut-être qu'il viendra demain.") == 5

    # French accents preserved
    assert count_words_french("Élève dévoué et assidu à l'école.") == 7


# ---------------------------------------------------------------------------
# 2. Writing Task Endpoints
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_and_get_writing_tasks(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    seeded_tasks: tuple[WritingTask, WritingTask],
) -> None:
    """Students can list published writing tasks and view details."""
    task_a, _ = seeded_tasks

    list_resp = await client.get("/api/v1/writing/tasks", headers=student_auth_headers)
    assert list_resp.status_code == 200
    tasks = list_resp.json()
    assert len(tasks) >= 2
    assert any(t["task_type"] == "section_a" for t in tasks)

    detail_resp = await client.get(
        f"/api/v1/writing/tasks/{task_a.id}", headers=student_auth_headers
    )
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["title"] == task_a.title
    assert detail["prompt"] == task_a.prompt
    assert detail["min_words"] == 80
    assert detail["max_words"] == 120


# ---------------------------------------------------------------------------
# 3. Timed Attempts, Editor Drafts, and Server Expiration
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_attempt_start_draft_save_and_word_count(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    seeded_tasks: tuple[WritingTask, WritingTask],
) -> None:
    """Starting an attempt creates a timed draft; editing updates word count."""
    task_a, _ = seeded_tasks

    # 1. Start timed attempt
    start_resp = await client.post(
        f"/api/v1/writing/tasks/{task_a.id}/attempts",
        headers=student_auth_headers,
    )
    assert start_resp.status_code == 201
    attempt_data = start_resp.json()
    attempt_id = attempt_data["id"]
    assert attempt_data["status"] == "draft"
    assert attempt_data["remaining_seconds"] > 0
    assert attempt_data["word_count"] == 0

    # 2. Resuming active attempt returns the same attempt
    resume_resp = await client.post(
        f"/api/v1/writing/tasks/{task_a.id}/attempts",
        headers=student_auth_headers,
    )
    assert resume_resp.status_code == 201
    assert resume_resp.json()["id"] == attempt_id

    # 3. Save draft text in editor
    draft_text = (
        "Hier soir, un individu s'est introduit dans le bâtiment. C'est un événement mystérieux."
    )
    save_resp = await client.put(
        f"/api/v1/writing/attempts/{attempt_id}",
        headers=student_auth_headers,
        json={"content": draft_text},
    )
    assert save_resp.status_code == 200
    saved_data = save_resp.json()
    assert saved_data["content"] == draft_text
    assert saved_data["word_count"] == count_words_french(draft_text)
    assert saved_data["word_count"] > 10


@pytest.mark.asyncio
async def test_attempt_server_side_expiration(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    seeded_tasks: tuple[WritingTask, WritingTask],
    db_session: AsyncSession,
) -> None:
    """Server controls the clock: expired attempt rejects saves and submissions."""
    task_a, _ = seeded_tasks

    # Start attempt
    start_resp = await client.post(
        f"/api/v1/writing/tasks/{task_a.id}/attempts",
        headers=student_auth_headers,
    )
    attempt_id = start_resp.json()["id"]

    # Manually expire attempt in DB to simulate time passing
    attempt = await db_session.scalar(
        select(WritingAttempt).where(WritingAttempt.id == uuid.UUID(attempt_id))
    )
    assert attempt is not None
    attempt.expires_at = datetime.datetime.now(datetime.UTC) - datetime.timedelta(minutes=5)
    await db_session.commit()

    # Attempting to save draft after expiration must be rejected
    save_resp = await client.put(
        f"/api/v1/writing/attempts/{attempt_id}",
        headers=student_auth_headers,
        json={"content": "Late modification"},
    )
    assert save_resp.status_code == 400
    assert save_resp.json()["error"]["code"] == "ATTEMPT_EXPIRED"

    # Attempting to submit after expiration must be rejected
    sub_resp = await client.post(
        f"/api/v1/writing/attempts/{attempt_id}/submit",
        headers=student_auth_headers,
    )
    assert sub_resp.status_code == 400
    assert sub_resp.json()["error"]["code"] == "ATTEMPT_EXPIRED"


# ---------------------------------------------------------------------------
# 4. Submission, Storage in MinIO, and Immutability
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_writing_submission_and_minio_storage(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    seeded_tasks: tuple[WritingTask, WritingTask],
) -> None:
    """Submitting stores essay in MinIO, creates WritingSubmission, and prevents further edits."""
    task_a, _ = seeded_tasks

    start_resp = await client.post(
        f"/api/v1/writing/tasks/{task_a.id}/attempts",
        headers=student_auth_headers,
    )
    attempt_id = start_resp.json()["id"]

    essay = (
        "Paris — L'affaire a stupéfié les riverains du quartier hier matin. "
        "Dès l'aube, les enquêteurs de la police judiciaire se sont rendus sur place "
        "pour inspecter l'aile ouest du musée. Le suspect, vêtu d'une combinaison d'électricien, "
        "avait réussi à tromper le système d'alarme grâce à un faux badge d'accès. "
        "Cependant, un gardien vigilant a repéré l'intrus avant qu'il ne puisse emporter le moindre tableau. "
        "L'individu a été interpellé sans violence et placé en garde à vue. "
        "Le procureur de la République a salué le professionnalisme des équipes de sécurité."
    )

    # Save content
    await client.put(
        f"/api/v1/writing/attempts/{attempt_id}",
        headers=student_auth_headers,
        json={"content": essay},
    )

    # Submit essay
    sub_resp = await client.post(
        f"/api/v1/writing/attempts/{attempt_id}/submit",
        headers=student_auth_headers,
    )
    assert sub_resp.status_code == 200
    sub_data = sub_resp.json()
    submission_id = sub_data["id"]
    assert sub_data["status"] == "submitted"
    assert sub_data["word_count"] >= 80

    # Verify attempt can no longer be modified
    mod_resp = await client.put(
        f"/api/v1/writing/attempts/{attempt_id}",
        headers=student_auth_headers,
        json={"content": "Attempting to change submitted essay"},
    )
    assert mod_resp.status_code == 400
    assert mod_resp.json()["error"]["code"] == "ATTEMPT_ALREADY_SUBMITTED"

    # Duplicate submission is idempotent
    dup_resp = await client.post(
        f"/api/v1/writing/attempts/{attempt_id}/submit",
        headers=student_auth_headers,
    )
    assert dup_resp.status_code == 200
    assert dup_resp.json()["id"] == submission_id

    # View submission detail (retrieves text content from storage)
    detail_resp = await client.get(
        f"/api/v1/writing/submissions/{submission_id}",
        headers=student_auth_headers,
    )
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["content"] == essay
    assert detail["task"]["title"] == task_a.title


@pytest.mark.asyncio
async def test_empty_submission_rejected(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    seeded_tasks: tuple[WritingTask, WritingTask],
) -> None:
    """Empty essays cannot be submitted."""
    task_a, _ = seeded_tasks
    start_resp = await client.post(
        f"/api/v1/writing/tasks/{task_a.id}/attempts",
        headers=student_auth_headers,
    )
    attempt_id = start_resp.json()["id"]

    sub_resp = await client.post(
        f"/api/v1/writing/attempts/{attempt_id}/submit",
        headers=student_auth_headers,
    )
    assert sub_resp.status_code == 400
    assert sub_resp.json()["error"]["code"] == "EMPTY_SUBMISSION"


# ---------------------------------------------------------------------------
# 5. Student Authorization & Isolation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_student_isolation_on_writing_attempts_and_submissions(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    second_student_headers: dict[str, str],
    seeded_tasks: tuple[WritingTask, WritingTask],
) -> None:
    """Student A cannot view, modify, or submit Student B's writing attempts or submissions."""
    task_a, _ = seeded_tasks

    # Student 1 starts attempt
    s1_resp = await client.post(
        f"/api/v1/writing/tasks/{task_a.id}/attempts",
        headers=student_auth_headers,
    )
    s1_attempt_id = s1_resp.json()["id"]

    # Student 2 tries to access Student 1 attempt
    get_resp = await client.get(
        f"/api/v1/writing/attempts/{s1_attempt_id}",
        headers=second_student_headers,
    )
    assert get_resp.status_code == 403

    # Student 2 tries to edit Student 1 attempt
    put_resp = await client.put(
        f"/api/v1/writing/attempts/{s1_attempt_id}",
        headers=second_student_headers,
        json={"content": "Malicious modification"},
    )
    assert put_resp.status_code == 403

    # Student 2 tries to submit Student 1 attempt
    sub_resp = await client.post(
        f"/api/v1/writing/attempts/{s1_attempt_id}/submit",
        headers=second_student_headers,
    )
    assert sub_resp.status_code == 403


# ---------------------------------------------------------------------------
# 6. Automated Mock Correction
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_mock_correction_lifecycle(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    seeded_tasks: tuple[WritingTask, WritingTask],
) -> None:
    """Student can trigger MockCorrectionProvider to receive deterministic evaluation."""
    task_a, _ = seeded_tasks
    start = await client.post(
        f"/api/v1/writing/tasks/{task_a.id}/attempts", headers=student_auth_headers
    )
    attempt_id = start.json()["id"]

    essay = (
        "Paris — L'affaire a fait grand bruit dans le quartier des musées hier matin. "
        "Dès l'ouverture, les employés ont constaté l'absence d'un tableau de valeur inestimable. "
        "En effet, un individu déguisé en technicien avait réussi à contourner les caméras de surveillance. "
        "Cependant, la brigade criminelle a rapidement retrouvé la piste du voleur grâce aux empreintes relevées. "
        "De plus, les autorités ont renforcé la surveillance de tous les accès afin d'éviter de nouveaux incidents. "
        "En conclusion, cette tentative d'effraction s'est soldée par l'arrestation rapide du suspect."
    )
    await client.put(
        f"/api/v1/writing/attempts/{attempt_id}",
        headers=student_auth_headers,
        json={"content": essay},
    )
    sub = await client.post(
        f"/api/v1/writing/attempts/{attempt_id}/submit", headers=student_auth_headers
    )
    submission_id = sub.json()["id"]

    # Trigger mock correction
    correct_resp = await client.post(
        f"/api/v1/writing/submissions/{submission_id}/mock-correct",
        headers=student_auth_headers,
    )
    assert correct_resp.status_code == 200
    correction = correct_resp.json()
    assert correction["provider"] == "mock"
    assert correction["score"] >= 60.0
    assert correction["estimated_level"] in ["B1", "B2", "C1"]
    assert len(correction["strengths"]) > 0
    assert correction["comments"] != ""

    # Submission status is now returned
    detail_resp = await client.get(
        f"/api/v1/writing/submissions/{submission_id}",
        headers=student_auth_headers,
    )
    detail = detail_resp.json()
    assert detail["status"] == "returned"
    assert detail["correction"]["provider"] == "mock"


# ---------------------------------------------------------------------------
# 7. Teacher Correction Workflow & Provenance
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_teacher_correction_complete_lifecycle(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    teacher_auth_headers: dict[str, str],
    second_teacher_headers: dict[str, str],
    seeded_tasks: tuple[WritingTask, WritingTask],
) -> None:
    """Full teacher workflow: queue listing -> assignment -> review -> correction -> returned."""
    task_b, _ = seeded_tasks

    # 1. Student submits essay
    start = await client.post(
        f"/api/v1/writing/tasks/{task_b.id}/attempts", headers=student_auth_headers
    )
    attempt_id = start.json()["id"]

    essay = (
        "Monsieur le Rédacteur en chef,\n\n"
        "Je me permets de vous adresser cette lettre pour exprimer ma vive inquiétude face au projet de piétonnisation intégrale du centre-ville. "
        "D'une part, cette mesure risque de paralyser le commerce de proximité, car de nombreux clients habitant en périphérie dépendent de leur véhicule. "
        "En effet, les parkings relais actuels sont insuffisants et mal desservis par les transports en commun.\n\n"
        "D'autre part, les personnes à mobilité réduite et les personnes âgées se trouveront isolées si elles ne peuvent plus accéder aux services médicaux du centre. "
        "Par conséquent, il me semble indispensable de privilégier une concertation citoyenne et un aménagement progressif plutôt qu'une interdiction brutale.\n\n"
        "En espérant que mon point de vue trouvera un écho dans vos colonnes, je vous prie d'agréer mes salutations distinguées."
    )
    await client.put(
        f"/api/v1/writing/attempts/{attempt_id}",
        headers=student_auth_headers,
        json={"content": essay},
    )
    sub = await client.post(
        f"/api/v1/writing/attempts/{attempt_id}/submit", headers=student_auth_headers
    )
    submission_id = sub.json()["id"]

    # 2. Student cannot access teacher queue
    forbidden_queue = await client.get(
        "/api/v1/teachers/writing/submissions", headers=student_auth_headers
    )
    assert forbidden_queue.status_code == 403

    # 3. Teacher lists available queue
    queue_resp = await client.get(
        "/api/v1/teachers/writing/submissions", headers=teacher_auth_headers
    )
    assert queue_resp.status_code == 200
    queue = queue_resp.json()
    assert any(s["id"] == submission_id for s in queue)

    # 4. Teacher 1 self-assigns submission
    assign_resp = await client.post(
        f"/api/v1/teachers/writing/submissions/{submission_id}/assign",
        headers=teacher_auth_headers,
    )
    assert assign_resp.status_code == 200
    assert assign_resp.json()["status"] == "assigned"

    # 5. Teacher 2 cannot assign the same submission (409 conflict)
    conflict_resp = await client.post(
        f"/api/v1/teachers/writing/submissions/{submission_id}/assign",
        headers=second_teacher_headers,
    )
    assert conflict_resp.status_code == 409

    # 6. Teacher 2 cannot review Teacher 1's submission (403 forbidden)
    forbidden_review = await client.post(
        f"/api/v1/teachers/writing/submissions/{submission_id}/review",
        headers=second_teacher_headers,
    )
    assert forbidden_review.status_code == 403

    # 7. Teacher 1 starts reviewing
    review_resp = await client.post(
        f"/api/v1/teachers/writing/submissions/{submission_id}/review",
        headers=teacher_auth_headers,
    )
    assert review_resp.status_code == 200
    assert review_resp.json()["status"] == "reviewing"

    # 8. Teacher 1 inspects text content
    detail_resp = await client.get(
        f"/api/v1/teachers/writing/submissions/{submission_id}",
        headers=teacher_auth_headers,
    )
    assert detail_resp.status_code == 200
    assert "Monsieur le Rédacteur en chef" in detail_resp.json()["content"]

    # 9. Teacher 1 submits official correction
    correction_payload = {
        "score": 88.0,
        "estimated_level": "B2",
        "strengths": [
            "Excellente structure épistolaire avec formule d'appel et de politesse adéquates.",
            "Argumentation équilibrée appuyée par des connecteurs logiques précis.",
        ],
        "weaknesses": [
            "Quelques formulations pourraient être enrichies au subjonctif pour un niveau C1.",
        ],
        "comments": "Très bon travail. La prise de position est claire et bien argumentée.",
        "corrected_content": essay,
        "recommendations": [
            "Poursuivez la pratique sur des sujets d'actualité complexes pour viser le C1.",
        ],
    }
    correct_resp = await client.post(
        f"/api/v1/teachers/writing/submissions/{submission_id}/correct",
        headers=teacher_auth_headers,
        json=correction_payload,
    )
    assert correct_resp.status_code == 200
    corr = correct_resp.json()
    assert corr["provider"] == "teacher"
    assert corr["score"] == 88.0
    assert corr["estimated_level"] == "B2"
    assert corr["corrected_by_user_id"] is not None
    assert len(corr["strengths"]) == 2

    # 10. Student can now see the returned submission and teacher feedback
    student_view = await client.get(
        f"/api/v1/writing/submissions/{submission_id}",
        headers=student_auth_headers,
    )
    assert student_view.status_code == 200
    student_data = student_view.json()
    assert student_data["status"] == "returned"
    assert student_data["correction"]["score"] == 88.0
    assert student_data["correction"]["provider"] == "teacher"
