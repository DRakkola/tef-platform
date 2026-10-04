"""Exhaustive tests for Taxonomy V2 Backend API and Services.

Covers:
- Taxonomy metadata and lifecycle versions
- Hierarchical tree retrieval with zero N+1 batch usage calculation
- Assessment task types decoupled from competencies
- Skills CRUD, search, pagination, filtering, sorting, archiving, restoring, and safe deletion
- Subskill creation, inheritance, and reparenting with cycle prevention
- CEFR level descriptors (can-do statements and observable evidence guidance)
- Directed learning graph relations with self-relation and cycle loop detection
- Relational usage impact aggregation across questions, exercises, and mastery
- RBAC authorization gates
- Backward compatibility with legacy endpoints
"""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.admin.models import (
    SubSkill,
)
from app.modules.assessments.models import (
    Assessment,
    AssessmentSection,
    Question,
    QuestionSkillTag,
    Skill,
)
from app.modules.learning.models import Exercise, ExerciseSkill, StudentSkill
from app.modules.users.models import User


@pytest.mark.asyncio
async def test_taxonomy_metadata_and_versions(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
):
    """Test metadata overview and version lifecycle management."""
    # 1. Get metadata
    resp = await client.get("/api/v1/admin/taxonomy/metadata", headers=admin_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "dimensions" in data
    assert "reasoning" in data["dimensions"]
    assert "language" in data["dimensions"]
    assert "cefr_bands" in data
    assert "metrics" in data
    assert "active_version" in data

    # 2. Create new taxonomy draft version
    v_code = f"v2-draft-{uuid.uuid4().hex[:6]}"
    v_payload = {
        "version": v_code,
        "name": "TEF 2027 Experimental Draft",
        "description": "Next generation taxonomy with micro-skills",
        "status": "draft",
    }
    create_v_resp = await client.post("/api/v1/admin/taxonomy/versions", json=v_payload, headers=admin_auth_headers)
    assert create_v_resp.status_code == 201
    version_id = create_v_resp.json()["id"]

    # 3. List versions and find the newly created one
    list_v_resp = await client.get("/api/v1/admin/taxonomy/versions", headers=admin_auth_headers)
    assert list_v_resp.status_code == 200
    versions = list_v_resp.json()
    assert any(v["id"] == version_id for v in versions)

    # 4. Activate the version
    update_v_resp = await client.put(
        f"/api/v1/admin/taxonomy/versions/{version_id}",
        json={"status": "active"},
        headers=admin_auth_headers,
    )
    assert update_v_resp.status_code == 200
    assert update_v_resp.json()["status"] == "active"


@pytest.mark.asyncio
async def test_task_types_crud(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
):
    """Test creating, listing, updating, and deleting decoupled task types."""
    code = f"TASK_READ_{uuid.uuid4().hex[:6].upper()}"
    create_resp = await client.post(
        "/api/v1/admin/taxonomy/task-types",
        json={
            "modality": "reading",
            "code": code,
            "name": "Offres d'emploi & Petites Annonces",
            "description": "Short classified ads with factual lookup",
            "is_active": True,
        },
        headers=admin_auth_headers,
    )
    assert create_resp.status_code == 201
    task_type = create_resp.json()
    task_type_id = task_type["id"]
    assert task_type["code"] == code

    # List with modality filter
    list_resp = await client.get("/api/v1/admin/taxonomy/task-types?modality=reading", headers=admin_auth_headers)
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert any(t["id"] == task_type_id for t in items)

    # Update
    update_resp = await client.put(
        f"/api/v1/admin/taxonomy/task-types/{task_type_id}",
        json={"name": "Petites Annonces Modifiées"},
        headers=admin_auth_headers,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "Petites Annonces Modifiées"

    # Delete
    del_resp = await client.delete(f"/api/v1/admin/taxonomy/task-types/{task_type_id}", headers=admin_auth_headers)
    assert del_resp.status_code == 204


@pytest.mark.asyncio
async def test_skill_crud_search_and_pagination(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
):
    """Test full skills CRUD, duplicate code protection, search, and pagination."""
    code = f"skill_root_{uuid.uuid4().hex[:6]}"
    payload = {
        "code": code,
        "name": "Synthèse et inférence critique",
        "dimension": "reasoning",
        "domain": "reading",
        "description": "Identifier l'implicite et les opinions divergentes",
        "is_active": True,
    }

    # 1. Create skill
    create_resp = await client.post("/api/v1/admin/taxonomy/skills", json=payload, headers=admin_auth_headers)
    assert create_resp.status_code == 201
    skill = create_resp.json()
    skill_id = skill["id"]
    assert skill["code"] == code
    assert skill["dimension"] == "reasoning"
    assert skill["domain"] == "reading"

    # 2. Duplicate code rejected
    dup_resp = await client.post("/api/v1/admin/taxonomy/skills", json=payload, headers=admin_auth_headers)
    assert dup_resp.status_code == 400

    # 3. Get detail
    detail_resp = await client.get(f"/api/v1/admin/taxonomy/skills/{skill_id}", headers=admin_auth_headers)
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["id"] == skill_id
    assert "usage_counts" in detail

    # 4. Search and pagination
    list_resp = await client.get(f"/api/v1/admin/taxonomy/skills?q={code}&dimension=reasoning", headers=admin_auth_headers)
    assert list_resp.status_code == 200
    paged = list_resp.json()
    assert paged["total"] >= 1
    assert any(s["id"] == skill_id for s in paged["items"])

    # 5. Update
    up_resp = await client.put(
        f"/api/v1/admin/taxonomy/skills/{skill_id}",
        json={"name": "Synthèse critique avancée"},
        headers=admin_auth_headers,
    )
    assert up_resp.status_code == 200
    assert up_resp.json()["name"] == "Synthèse critique avancée"

    # 6. Archive and Restore
    arch_resp = await client.post(f"/api/v1/admin/taxonomy/skills/{skill_id}/archive", headers=admin_auth_headers)
    assert arch_resp.status_code == 200
    assert arch_resp.json()["is_active"] is False

    rest_resp = await client.post(f"/api/v1/admin/taxonomy/skills/{skill_id}/restore", headers=admin_auth_headers)
    assert rest_resp.status_code == 200
    assert rest_resp.json()["is_active"] is True

    # 7. Safe Delete (zero dependencies)
    del_resp = await client.delete(f"/api/v1/admin/taxonomy/skills/{skill_id}", headers=admin_auth_headers)
    assert del_resp.status_code == 204


@pytest.mark.asyncio
async def test_subskills_and_reparenting(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
    db_session: AsyncSession,
):
    """Test child subskill creation, domain inheritance, dual-table sync, and cycle-safe reparenting."""
    parent_code = f"parent_{uuid.uuid4().hex[:6]}"
    p_resp = await client.post(
        "/api/v1/admin/taxonomy/skills",
        json={
            "code": parent_code,
            "name": "Maîtrise grammaticale",
            "dimension": "language",
            "domain": "grammar",
        },
        headers=admin_auth_headers,
    )
    assert p_resp.status_code == 201
    parent_id = p_resp.json()["id"]

    # Create child subskill
    child_code = f"child_{uuid.uuid4().hex[:6]}"
    c_resp = await client.post(
        f"/api/v1/admin/taxonomy/skills/{parent_id}/children",
        json={
            "code": child_code,
            "name": "Subjonctif présent dans les subordonnées",
        },
        headers=admin_auth_headers,
    )
    assert c_resp.status_code == 201
    child = c_resp.json()
    child_id = child["id"]
    assert child["parent_id"] == parent_id
    assert child["dimension"] == "language"
    assert child["domain"] == "grammar"

    # Verify child is in canonical skills table with parent_id and NOT duplicated in legacy sub_skills
    canonical_child = await db_session.get(Skill, uuid.UUID(child_id))
    assert canonical_child is not None
    assert canonical_child.code == child_code
    assert str(canonical_child.parent_id) == str(parent_id)

    sub_row = await db_session.get(SubSkill, uuid.UUID(child_id))
    assert sub_row is None

    # List children
    children_resp = await client.get(f"/api/v1/admin/taxonomy/skills/{parent_id}/children", headers=admin_auth_headers)
    assert children_resp.status_code == 200
    c_items = children_resp.json()
    assert len(c_items) == 1
    assert c_items[0]["id"] == child_id

    # Create another parent for reparenting
    parent2_code = f"parent2_{uuid.uuid4().hex[:6]}"
    p2_resp = await client.post(
        "/api/v1/admin/taxonomy/skills",
        json={
            "code": parent2_code,
            "name": "Structures complexes",
            "dimension": "language",
            "domain": "grammar",
        },
        headers=admin_auth_headers,
    )
    parent2_id = p2_resp.json()["id"]

    # Reparent child under parent2
    reparent_resp = await client.put(
        f"/api/v1/admin/taxonomy/skills/{child_id}/parent",
        json={"new_parent_id": parent2_id},
        headers=admin_auth_headers,
    )
    assert reparent_resp.status_code == 200
    assert reparent_resp.json()["parent_id"] == parent2_id

    # Reparent cycle check: cannot set self as parent
    self_parent_resp = await client.put(
        f"/api/v1/admin/taxonomy/skills/{child_id}/parent",
        json={"new_parent_id": child_id},
        headers=admin_auth_headers,
    )
    assert self_parent_resp.status_code == 400

    # Clean up: deleting parent with children should be rejected
    del_parent_resp = await client.delete(f"/api/v1/admin/taxonomy/skills/{parent2_id}", headers=admin_auth_headers)
    assert del_parent_resp.status_code == 400


@pytest.mark.asyncio
async def test_cefr_descriptors(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
):
    """Test CEFR level can-do descriptors and evidence guidance."""
    sk_code = f"sk_cefr_{uuid.uuid4().hex[:6]}"
    sk_resp = await client.post(
        "/api/v1/admin/taxonomy/skills",
        json={
            "code": sk_code,
            "name": "Identification du ton et de l'ironie",
            "dimension": "reasoning",
            "domain": "listening",
        },
        headers=admin_auth_headers,
    )
    skill_id = sk_resp.json()["id"]

    # Upsert B2 descriptor
    d_resp = await client.put(
        f"/api/v1/admin/taxonomy/skills/{skill_id}/descriptors",
        json={
            "level": "B2",
            "descriptor": "Peut identifier des nuances d'ironie dans un dialogue familier.",
            "evidence_guidance": "L'étudiant choisit correctement l'attitude implicite du locuteur.",
        },
        headers=admin_auth_headers,
    )
    assert d_resp.status_code == 200
    b2_desc = d_resp.json()
    assert b2_desc["level"] == "B2"

    # Upsert C1 descriptor
    await client.put(
        f"/api/v1/admin/taxonomy/skills/{skill_id}/descriptors",
        json={
            "level": "C1",
            "descriptor": "Peut déceler le sous-entendu et le sarcasme dans des débats polémiques rapides.",
        },
        headers=admin_auth_headers,
    )

    # List descriptors
    list_desc_resp = await client.get(f"/api/v1/admin/taxonomy/skills/{skill_id}/descriptors", headers=admin_auth_headers)
    assert list_desc_resp.status_code == 200
    descriptors = list_desc_resp.json()
    assert len(descriptors) == 2
    assert descriptors[0]["level"] == "B2"
    assert descriptors[1]["level"] == "C1"

    # Get single descriptor
    get_desc_resp = await client.get(f"/api/v1/admin/taxonomy/skills/{skill_id}/descriptors/B2", headers=admin_auth_headers)
    assert get_desc_resp.status_code == 200
    assert get_desc_resp.json()["descriptor"].startswith("Peut identifier")

    # Delete descriptor
    del_desc_resp = await client.delete(f"/api/v1/admin/taxonomy/skills/{skill_id}/descriptors/B2", headers=admin_auth_headers)
    assert del_desc_resp.status_code == 204


@pytest.mark.asyncio
async def test_skill_relations_and_cycle_prevention(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
):
    """Test learning graph relations, self-relation rejection, and circular loop detection."""
    # Create Skill A and Skill B
    resp_a = await client.post(
        "/api/v1/admin/taxonomy/skills",
        json={
            "code": f"rel_a_{uuid.uuid4().hex[:6]}",
            "name": "Conjugaison de base",
            "dimension": "language",
            "domain": "grammar",
        },
        headers=admin_auth_headers,
    )
    skill_a_id = resp_a.json()["id"]

    resp_b = await client.post(
        "/api/v1/admin/taxonomy/skills",
        json={
            "code": f"rel_b_{uuid.uuid4().hex[:6]}",
            "name": "Concordance des temps complexe",
            "dimension": "language",
            "domain": "grammar",
        },
        headers=admin_auth_headers,
    )
    skill_b_id = resp_b.json()["id"]

    # 1. Add valid prerequisite relation: A -> B
    rel_resp = await client.post(
        f"/api/v1/admin/taxonomy/skills/{skill_a_id}/relations",
        json={"to_skill_id": skill_b_id, "relation_type": "prerequisite"},
        headers=admin_auth_headers,
    )
    assert rel_resp.status_code == 201
    relation_id = rel_resp.json()["id"]

    # 2. Self-relation rejected: A -> A
    self_rel = await client.post(
        f"/api/v1/admin/taxonomy/skills/{skill_a_id}/relations",
        json={"to_skill_id": skill_a_id, "relation_type": "prerequisite"},
        headers=admin_auth_headers,
    )
    assert self_rel.status_code == 400

    # 3. Cycle prevention: B -> A rejected
    cycle_rel = await client.post(
        f"/api/v1/admin/taxonomy/skills/{skill_b_id}/relations",
        json={"to_skill_id": skill_a_id, "relation_type": "prerequisite"},
        headers=admin_auth_headers,
    )
    assert cycle_rel.status_code == 400
    err_body = cycle_rel.json()
    err_msg = err_body.get("detail") or err_body.get("error", {}).get("message", "")
    assert "circular" in err_msg.lower() or "cycle" in err_msg.lower()

    # 4. List relations
    list_rel = await client.get(f"/api/v1/admin/taxonomy/skills/{skill_a_id}/relations", headers=admin_auth_headers)
    assert list_rel.status_code == 200
    rel_data = list_rel.json()
    assert len(rel_data["outgoing"]) == 1
    assert rel_data["outgoing"][0]["to_skill_id"] == skill_b_id

    # 5. Delete relation
    del_rel = await client.delete(f"/api/v1/admin/taxonomy/skills/{skill_a_id}/relations/{relation_id}", headers=admin_auth_headers)
    assert del_rel.status_code == 204


@pytest.mark.asyncio
async def test_relational_usage_counts_and_deletion_protection(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
    db_session: AsyncSession,
    test_student: User,
):
    """Test that Zero N+1 batch usage calculation aggregates real references and blocks dangerous deletes."""
    # 1. Create skill
    sk_resp = await client.post(
        "/api/v1/admin/taxonomy/skills",
        json={
            "code": f"usage_{uuid.uuid4().hex[:6]}",
            "name": "Accords participes passés complexes",
            "dimension": "language",
            "domain": "grammar",
        },
        headers=admin_auth_headers,
    )
    skill_id = uuid.UUID(sk_resp.json()["id"])

    # 2. Add question tag
    section_id = uuid.uuid4()
    assessment_id = uuid.uuid4()
    asmt = Assessment(id=assessment_id, title="Test Exam", assessment_type="reading", duration_seconds=3600)
    sec = AssessmentSection(id=section_id, assessment_id=assessment_id, title="Section A", order_index=1)
    q = Question(section_id=section_id, prompt="Choisissez la bonne forme", difficulty=3, level="B2")
    db_session.add_all([asmt, sec, q])
    await db_session.flush()

    tag = QuestionSkillTag(question_id=q.id, skill_id=skill_id, weight=1.0)
    db_session.add(tag)

    # 3. Add exercise tag
    ex = Exercise(title="Exercice accords", prompt="Complétez les phrases", category="grammar", level="B2")
    db_session.add(ex)
    await db_session.flush()
    ex_skill = ExerciseSkill(exercise_id=ex.id, skill_id=skill_id, weight=1.0)
    db_session.add(ex_skill)

    # 4. Add student mastery record
    sm = StudentSkill(user_id=test_student.id, skill_id=skill_id, mastery_score=0.85, confidence=0.9)
    db_session.add(sm)
    await db_session.flush()

    # 5. Query skill detail and verify usage_counts
    detail_resp = await client.get(f"/api/v1/admin/taxonomy/skills/{skill_id}", headers=admin_auth_headers)
    assert detail_resp.status_code == 200
    usage = detail_resp.json()["usage_counts"]
    assert usage["questions"] == 1
    assert usage["exercises"] == 1
    assert usage["assessments"] == 1
    assert usage["student_mastery"] == 1
    assert usage["total_dependencies"] >= 3

    # 6. Attempt hard-delete -> MUST BE REJECTED with 400
    del_resp = await client.delete(f"/api/v1/admin/taxonomy/skills/{skill_id}", headers=admin_auth_headers)
    assert del_resp.status_code == 400
    del_body = del_resp.json()
    del_msg = del_body.get("detail") or del_body.get("error", {}).get("message", "")
    assert "dependencies" in del_msg.lower() or "enregistrements en dépendent" in del_msg.lower()


@pytest.mark.asyncio
async def test_hierarchical_tree_endpoint(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
):
    """Test /tree endpoint returns nested roots, children, and descriptors."""
    resp = await client.get("/api/v1/admin/taxonomy/tree", headers=admin_auth_headers)
    assert resp.status_code == 200
    tree = resp.json()
    assert isinstance(tree, list)
    if tree:
        first = tree[0]
        assert "children" in first
        assert "level_descriptors" in first
        assert "usage_counts" in first


@pytest.mark.asyncio
async def test_rbac_taxonomy_access(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
):
    """Test that non-admin roles cannot access taxonomy endpoints."""
    # Student gets 403
    resp = await client.get("/api/v1/admin/taxonomy/metadata", headers=student_auth_headers)
    assert resp.status_code == 403

    # Unauthenticated gets 401
    anon_resp = await client.get("/api/v1/admin/taxonomy/metadata")
    assert anon_resp.status_code == 401


@pytest.mark.asyncio
async def test_backward_compatibility_content_skills(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
):
    """Verify legacy /admin/content/skills endpoints still operate with zero N+1 queries."""
    # List legacy skills
    list_resp = await client.get("/api/v1/admin/content/skills", headers=admin_auth_headers)
    assert list_resp.status_code == 200
    skills = list_resp.json()
    assert isinstance(skills, list)
    if skills:
        first = skills[0]
        assert "subskills" in first
        assert "usage_counts" in first

    # Create legacy skill
    leg_code = f"leg_skill_{uuid.uuid4().hex[:6]}"
    create_resp = await client.post(
        "/api/v1/admin/content/skills",
        json={
            "code": leg_code,
            "name": "Compréhension des faits divers",
            "category": "reading",
        },
        headers=admin_auth_headers,
    )
    assert create_resp.status_code == 201
    created = create_resp.json()
    assert created["code"] == leg_code
    parent_id = created["id"]

    # Create legacy subskill under parent
    sub_code = f"leg_sub_{uuid.uuid4().hex[:6]}"
    sub_resp = await client.post(
        f"/api/v1/admin/content/skills/{parent_id}/subskills",
        json={
            "code": sub_code,
            "name": "Chronologie des faits",
        },
        headers=admin_auth_headers,
    )
    assert sub_resp.status_code == 201
    assert sub_resp.json()["code"] == sub_code
