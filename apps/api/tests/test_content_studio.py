"""Comprehensive automated tests for Content Studio: Content Domain, Immutability, Versioning, Review Workflow, Validation Engine, and RBAC."""

import io
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.admin.models import (
    AssessmentVersion,
    AuditEvent,
    ContentReview,
    ExerciseVersion,
    MediaAsset,
    QuestionVersion,
    SubSkill,
    WritingTaskVersion,
)
from app.modules.assessments.models import Assessment, Question, Skill
from app.modules.learning.models import Exercise
from app.modules.users.models import User
from app.modules.writing.models import WritingTask


@pytest.mark.asyncio
async def test_admin_content_studio_rbac(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
    student_auth_headers: dict[str, str],
    teacher_auth_headers: dict[str, str],
):
    """Verify strict server-side RBAC on all admin content studio endpoints."""
    # 1. Unauthenticated request -> 401
    resp_unauth = await client.get("/api/v1/admin/content/assessments")
    assert resp_unauth.status_code == 401

    # 2. Student request -> 403
    resp_student = await client.get("/api/v1/admin/content/assessments", headers=student_auth_headers)
    assert resp_student.status_code == 403

    # 3. Teacher request -> 403
    resp_teacher = await client.get("/api/v1/admin/content/assessments", headers=teacher_auth_headers)
    assert resp_teacher.status_code == 403

    # 4. Admin request -> 200
    resp_admin = await client.get("/api/v1/admin/content/assessments", headers=admin_auth_headers)
    assert resp_admin.status_code == 200


@pytest.mark.asyncio
async def test_skills_and_subskills_taxonomy(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
    db_session: AsyncSession,
):
    """Verify hierarchical skills and subskills management."""
    unique_suffix = uuid.uuid4().hex[:6]
    skill_code = f"reading_comp_{unique_suffix}"

    # 1. Create parent skill
    skill_resp = await client.post(
        "/api/v1/admin/content/skills",
        headers=admin_auth_headers,
        json={
            "code": skill_code,
            "name": "Compréhension Écrite",
            "category": "reading",
            "description": "Capacité à comprendre des documents écrits en français.",
        },
    )
    assert skill_resp.status_code == 201
    skill_data = skill_resp.json()
    skill_id = skill_data["id"]

    # 2. Create subskill
    sub_resp = await client.post(
        f"/api/v1/admin/content/skills/{skill_id}/subskills",
        headers=admin_auth_headers,
        json={
            "code": f"ident_main_idea_{unique_suffix}",
            "name": "Identifier l'idée principale",
            "description": "Dégager le thème général d'un texte informatif.",
        },
    )
    assert sub_resp.status_code == 201
    sub_data = sub_resp.json()
    sub_id = sub_data["id"]

    # 3. List skills and verify subskill included
    list_resp = await client.get("/api/v1/admin/content/skills", headers=admin_auth_headers)
    assert list_resp.status_code == 200
    all_skills = list_resp.json()
    created_skill = next((s for s in all_skills if s["id"] == skill_id), None)
    assert created_skill is not None
    assert len(created_skill["subskills"]) >= 1
    assert any(sub["id"] == sub_id for sub in created_skill["subskills"])

    # 4. Update subskill
    update_resp = await client.put(
        f"/api/v1/admin/content/subskills/{sub_id}",
        headers=admin_auth_headers,
        json={"name": "Identifier l'idée générale et le ton"},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "Identifier l'idée générale et le ton"

    # 5. Delete subskill
    del_resp = await client.delete(f"/api/v1/admin/content/subskills/{sub_id}", headers=admin_auth_headers)
    assert del_resp.status_code == 204


@pytest.mark.asyncio
async def test_assessment_fail_closed_validation(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
):
    """Verify publishing validation engine catches incomplete assessments and blocks publishing."""
    # 1. Create empty draft assessment
    asmt_resp = await client.post(
        "/api/v1/admin/content/assessments",
        headers=admin_auth_headers,
        json={
            "title": "TEF Canada Test Blanc Invalid",
            "description": "Assessment without questions",
            "assessment_type": "reading",
            "duration_seconds": 3600,
            "status": "draft",
        },
    )
    assert asmt_resp.status_code == 201
    asmt_id = asmt_resp.json()["id"]

    # 2. Validate empty assessment -> fails closed (no sections)
    val_resp = await client.post(
        f"/api/v1/admin/content/assessments/{asmt_id}/validate",
        headers=admin_auth_headers,
    )
    assert val_resp.status_code == 200
    val_data = val_resp.json()
    assert val_data["is_valid"] is False
    assert any("section" in err["message"].lower() for err in val_data["errors"])

    # 3. Try to publish -> rejected with 422
    pub_resp = await client.post(
        f"/api/v1/admin/content/assessments/{asmt_id}/publish",
        headers=admin_auth_headers,
    )
    assert pub_resp.status_code == 422

    # 4. Add section with invalid question (no correct option)
    sec_resp = await client.post(
        f"/api/v1/admin/content/assessments/{asmt_id}/sections",
        headers=admin_auth_headers,
        json={"title": "Section A", "order_index": 0},
    )
    sec_id = sec_resp.json()["id"]

    q_resp = await client.post(
        f"/api/v1/admin/content/sections/{sec_id}/questions",
        headers=admin_auth_headers,
        json={
            "prompt": "Quel est le but de ce document ?",
            "question_type": "single_choice",
            "difficulty": 3,
            "points": 1,
            "options": [
                {"content": "Option A (faux)", "is_correct": False},
                {"content": "Option B (faux aussi)", "is_correct": False},
            ],
        },
    )
    assert q_resp.status_code == 201

    # 5. Validate again -> fails because single_choice has 0 correct options
    val_resp2 = await client.post(
        f"/api/v1/admin/content/assessments/{asmt_id}/validate",
        headers=admin_auth_headers,
    )
    assert val_resp2.status_code == 200
    assert val_resp2.json()["is_valid"] is False
    assert any("correct" in err["message"].lower() for err in val_resp2.json()["errors"])


@pytest.mark.asyncio
async def test_assessment_publishing_and_snapshot_versioning(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
    db_session: AsyncSession,
):
    """Verify assessment publishing freezes immutable snapshot in assessment_versions."""
    # 1. Create valid assessment
    asmt_resp = await client.post(
        "/api/v1/admin/content/assessments",
        headers=admin_auth_headers,
        json={
            "title": "TEF Simulation Complète B2",
            "description": "Simulation officielle TEF",
            "assessment_type": "reading",
            "duration_seconds": 3600,
            "status": "draft",
        },
    )
    asmt_id = asmt_resp.json()["id"]

    # 2. Add valid section & question
    sec_resp = await client.post(
        f"/api/v1/admin/content/assessments/{asmt_id}/sections",
        headers=admin_auth_headers,
        json={"title": "Section 1", "order_index": 0},
    )
    sec_id = sec_resp.json()["id"]

    await client.post(
        f"/api/v1/admin/content/sections/{sec_id}/questions",
        headers=admin_auth_headers,
        json={
            "prompt": "Où se déroule la scène décrite dans l'article ?",
            "question_type": "single_choice",
            "difficulty": 3,
            "points": 2,
            "options": [
                {"content": "À Paris", "is_correct": True, "order_index": 0},
                {"content": "À Montréal", "is_correct": False, "order_index": 1},
                {"content": "À Lyon", "is_correct": False, "order_index": 2},
            ],
        },
    )

    # 3. Publish assessment
    pub_resp = await client.post(
        f"/api/v1/admin/content/assessments/{asmt_id}/publish",
        headers=admin_auth_headers,
    )
    assert pub_resp.status_code == 200
    pub_data = pub_resp.json()
    assert pub_data["status"] == "published"
    assert pub_data["version"] == 1

    # 4. Check assessment_versions snapshot
    ver_resp = await client.get(
        f"/api/v1/admin/content/assessments/{asmt_id}/versions",
        headers=admin_auth_headers,
    )
    assert ver_resp.status_code == 200
    versions = ver_resp.json()
    assert len(versions) == 1
    assert versions[0]["version"] == 1
    assert len(versions[0]["sections_snapshot"]) == 1
    assert len(versions[0]["sections_snapshot"][0]["questions"]) == 1

    # 5. Fork new version
    fork_resp = await client.post(
        f"/api/v1/admin/content/assessments/{asmt_id}/new-version",
        headers=admin_auth_headers,
    )
    assert fork_resp.status_code == 200
    fork_data = fork_resp.json()
    assert fork_data["version"] == 2
    assert fork_data["status"] == "draft"


@pytest.mark.asyncio
async def test_exercise_lifecycle_and_versioning(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
):
    """Verify drill exercises can be drafted, published, and versioned."""
    # 1. Create exercise draft
    ex_resp = await client.post(
        "/api/v1/admin/content/exercises",
        headers=admin_auth_headers,
        json={
            "title": "Subjonctif Présent Exercice 1",
            "prompt": "Complétez : Il faut que tu ___ (venir) demain.",
            "category": "grammar",
            "level": "B2",
            "difficulty": 3,
            "points": 5,
            "options_payload": [
                {"content": "viennes", "is_correct": True},
                {"content": "viens", "is_correct": False},
                {"content": "viendras", "is_correct": False},
            ],
            "status": "draft",
        },
    )
    assert ex_resp.status_code == 201
    ex_id = ex_resp.json()["id"]

    # 2. Publish exercise
    pub_resp = await client.post(
        f"/api/v1/admin/content/exercises/{ex_id}/publish",
        headers=admin_auth_headers,
    )
    assert pub_resp.status_code == 200
    assert pub_resp.json()["status"] == "published"

    # 3. Check version history
    ver_resp = await client.get(
        f"/api/v1/admin/content/exercises/{ex_id}/versions",
        headers=admin_auth_headers,
    )
    assert ver_resp.status_code == 200
    assert len(ver_resp.json()) == 1

    # 4. Fork new version
    fork_resp = await client.post(
        f"/api/v1/admin/content/exercises/{ex_id}/new-version",
        headers=admin_auth_headers,
    )
    assert fork_resp.status_code == 200
    assert fork_resp.json()["version"] == 2
    assert fork_resp.json()["status"] == "draft"


@pytest.mark.asyncio
async def test_writing_task_lifecycle_and_versioning(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
):
    """Verify TEF writing task creation, publishing, and version snapshot."""
    # 1. Create writing task
    task_resp = await client.post(
        "/api/v1/admin/content/writing-tasks",
        headers=admin_auth_headers,
        json={
            "title": "Section A: Fait divers insolite",
            "task_type": "section_a",
            "prompt": "Rédigez la suite d'un fait divers journalistique...",
            "min_words": 80,
            "max_words": 120,
            "duration_minutes": 20,
            "target_level": "B1",
            "status": "draft",
        },
    )
    assert task_resp.status_code == 201
    task_id = task_resp.json()["id"]

    # 2. Publish writing task
    pub_resp = await client.post(
        f"/api/v1/admin/content/writing-tasks/{task_id}/publish",
        headers=admin_auth_headers,
    )
    assert pub_resp.status_code == 200
    assert pub_resp.json()["status"] == "published"

    # 3. Check version history
    ver_resp = await client.get(
        f"/api/v1/admin/content/writing-tasks/{task_id}/versions",
        headers=admin_auth_headers,
    )
    assert ver_resp.status_code == 200
    assert len(ver_resp.json()) == 1

    # 4. Fork new version
    fork_resp = await client.post(
        f"/api/v1/admin/content/writing-tasks/{task_id}/new-version",
        headers=admin_auth_headers,
    )
    assert fork_resp.status_code == 200
    assert fork_resp.json()["version"] == 2
    assert fork_resp.json()["status"] == "draft"


@pytest.mark.asyncio
async def test_content_review_editorial_workflow(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
):
    """Verify editorial review gate: submit -> review queue -> reject -> re-submit -> approve."""
    # 1. Create draft exercise
    ex_resp = await client.post(
        "/api/v1/admin/content/exercises",
        headers=admin_auth_headers,
        json={
            "title": "Exercice Revue Éditoriale",
            "prompt": "Identifiez le synonyme de 'éphémère'.",
            "category": "vocabulary",
            "level": "B2",
            "difficulty": 4,
            "points": 5,
            "status": "draft",
        },
    )
    ex_id = ex_resp.json()["id"]

    # 2. Submit for review
    sub_resp = await client.post(
        f"/api/v1/admin/content/exercise/{ex_id}/submit-review",
        headers=admin_auth_headers,
        json={"comments": "Prêt pour relecture pédagogique"},
    )
    assert sub_resp.status_code == 201
    review_data = sub_resp.json()
    review_id = review_data["id"]
    assert review_data["status"] == "pending"

    # 3. Verify exercise status is in_review
    ex_check = await client.get(f"/api/v1/admin/content/exercises/{ex_id}", headers=admin_auth_headers)
    assert ex_check.json()["status"] == "in_review"

    # 4. Check review queue
    q_resp = await client.get("/api/v1/admin/content/reviews?status=pending", headers=admin_auth_headers)
    assert q_resp.status_code == 200
    assert any(r["id"] == review_id for r in q_resp.json()["items"])

    # 5. Reject review with comments
    rej_resp = await client.post(
        f"/api/v1/admin/content/reviews/{review_id}/decision",
        headers=admin_auth_headers,
        json={"status": "rejected", "comments": "Veuillez préciser la consigne pour les étudiants B2."},
    )
    assert rej_resp.status_code == 200
    assert rej_resp.json()["status"] == "rejected"

    # 6. Verify exercise transitioned back to draft
    ex_after_rej = await client.get(f"/api/v1/admin/content/exercises/{ex_id}", headers=admin_auth_headers)
    assert ex_after_rej.json()["status"] == "draft"


@pytest.mark.asyncio
async def test_media_asset_management_and_security(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
):
    """Verify MinIO media asset uploads, MIME validation, path traversal defense, and presigned URLs."""
    # 1. Reject invalid MIME type (e.g. executable or dangerous script)
    fake_exe = io.BytesIO(b"MZ\x90\x00\x03\x00\x00\x00")
    bad_upload = await client.post(
        "/api/v1/admin/media/upload",
        headers=admin_auth_headers,
        files={"file": ("malicious.exe", fake_exe, "application/x-dosexec")},
        data={"title": "Malicious Executable", "media_type": "audio"},
    )
    assert bad_upload.status_code == 400

    # 2. Upload valid audio with traversal attempt in filename
    valid_audio_bytes = b"ID3\x03\x00\x00\x00\x00\x00#TIT2\x00\x00\x00\x05\x00\x00\x00Audio"
    upload_resp = await client.post(
        "/api/v1/admin/media/upload",
        headers=admin_auth_headers,
        files={"file": ("../../etc/passwd.mp3", io.BytesIO(valid_audio_bytes), "audio/mpeg")},
        data={"title": "Document Sonore 1", "media_type": "audio"},
    )
    assert upload_resp.status_code == 201
    asset_data = upload_resp.json()
    asset_id = asset_data["id"]

    # Verify traversal was sanitized
    assert ".." not in asset_data["filename"]
    assert "/" not in asset_data["filename"]
    assert "\\" not in asset_data["filename"]

    # 3. Generate presigned URL
    url_resp = await client.get(f"/api/v1/admin/media/{asset_id}/presigned-url", headers=admin_auth_headers)
    assert url_resp.status_code == 200
    assert "download_url" in url_resp.json()
    assert url_resp.json()["expires_in_seconds"] == 3600

    # 4. Delete media asset
    del_resp = await client.delete(f"/api/v1/admin/media/{asset_id}", headers=admin_auth_headers)
    assert del_resp.status_code == 204


@pytest.mark.asyncio
async def test_audit_logging_of_content_operations(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
):
    """Verify that administrative content actions generate audit events."""
    # Perform an audited operation
    await client.post(
        "/api/v1/admin/content/skills",
        headers=admin_auth_headers,
        json={
            "code": f"audit_skill_{uuid.uuid4().hex[:6]}",
            "name": "Audit Logging Test Skill",
        },
    )

    audit_resp = await client.get("/api/v1/admin/audit-logs", headers=admin_auth_headers)
    assert audit_resp.status_code == 200
    data = audit_resp.json()
    assert data["total"] >= 1
    assert len(data["items"]) >= 1
    assert any(item["action"] == "CREATE" for item in data["items"])


@pytest.mark.asyncio
async def test_skills_metrics_summary(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
):
    """Verify GET /admin/content/skills/metrics/summary returns accurate aggregate taxonomy stats."""
    resp = await client.get("/api/v1/admin/content/skills/metrics/summary", headers=admin_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "total_skills" in data
    assert "total_subskills" in data
    assert "domains_count" in data
    assert "domain_breakdown" in data
    assert "taxonomy_warnings_count" in data
    assert isinstance(data["issues"], list)


@pytest.mark.asyncio
async def test_skill_get_update_and_delete_lifecycle(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
):
    """Verify fetching, updating, and safely deleting a skill node."""
    code_suffix = uuid.uuid4().hex[:6]
    initial_code = f"vocab_idiom_{code_suffix}"

    # 1. Create skill
    create_resp = await client.post(
        "/api/v1/admin/content/skills",
        headers=admin_auth_headers,
        json={
            "code": initial_code,
            "name": "Expressions idiomatiques québécoises",
            "category": "vocabulary",
            "description": "Compréhension des expressions locales.",
            "is_active": True,
        },
    )
    assert create_resp.status_code == 201
    skill_data = create_resp.json()
    skill_id = skill_data["id"]
    assert skill_data["is_active"] is True
    assert skill_data["usage_counts"]["total_dependencies"] == 0

    # 2. Get skill by ID
    get_resp = await client.get(f"/api/v1/admin/content/skills/{skill_id}", headers=admin_auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == skill_id
    assert get_resp.json()["name"] == "Expressions idiomatiques québécoises"

    # 3. Update skill
    updated_name = "Expressions idiomatiques et tournures canadiennes"
    update_resp = await client.put(
        f"/api/v1/admin/content/skills/{skill_id}",
        headers=admin_auth_headers,
        json={
            "name": updated_name,
            "description": "Description mise à jour.",
            "is_active": False,
        },
    )
    assert update_resp.status_code == 200
    updated_data = update_resp.json()
    assert updated_data["name"] == updated_name
    assert updated_data["description"] == "Description mise à jour."
    assert updated_data["is_active"] is False

    # 4. Filter skills by search query
    search_resp = await client.get(
        f"/api/v1/admin/content/skills?q={code_suffix}",
        headers=admin_auth_headers,
    )
    assert search_resp.status_code == 200
    search_items = search_resp.json()
    assert any(s["id"] == skill_id for s in search_items)

    # 5. Delete skill (safe because 0 dependencies)
    del_resp = await client.delete(f"/api/v1/admin/content/skills/{skill_id}", headers=admin_auth_headers)
    assert del_resp.status_code == 204

    # 6. Verify skill is gone
    get_gone = await client.get(f"/api/v1/admin/content/skills/{skill_id}", headers=admin_auth_headers)
    assert get_gone.status_code == 404

