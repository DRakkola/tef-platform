"""Unit and integration tests for Speaking Exam Scenarios, Guardrails, and Prompt Compilation."""

import uuid

import pytest
from httpx import AsyncClient

from app.modules.admin.speaking_scenario_models import SpeakingScenario
from app.modules.speaking.enums import ExamSectionType
from app.modules.speaking.providers.gemini_live import build_examiner_instructions


@pytest.mark.asyncio
async def test_speaking_scenario_prompt_compilation_guardrails():
    """Verify that build_examiner_instructions incorporates all 5 defensive guardrail layers."""
    mock_scenario_a = SpeakingScenario(
        id=uuid.uuid4(),
        title="Club de plongée sous-marine",
        code="SCEN-TEST-A1",
        section="section_a",
        target_level="B2",
        difficulty="standard",
        is_active=True,
        document_title="Club Aquabulle — Baptêmes et formations",
        document_content="Plongez au cœur de la Méditerranée avec nos moniteurs certifiés.",
        role_title="Responsable du centre de plongée",
        persona_name="M. Mercier",
        voice_persona="Aoede",
        register="formal",
        temperament="Sérieux et attentif à la sécurité nautique.",
        scepticism_level=0.3,
        known_facts=[
            {"category": "prix", "fact": "50€ le baptême", "detail": "Matériel inclus"},
            {"category": "âge", "fact": "Dès 8 ans", "detail": "Autorisation parentale requise"},
        ],
        omitted_facts=[
            "Certificat médical de non contre-indication obligatoire",
            "Durée exacte de l'immersion sous l'eau",
        ],
        objection_cards=[],
        scope_description="Uniquement le centre de plongée et les baptêmes.",
        forbidden_topics=[
            "Politique maritime internationale",
            "Évaluation officielle du niveau de langue",
        ],
        redirection_phrases=[
            "Revenons à votre demande concernant le baptême de plongée.",
        ],
    )

    prompt_a = build_examiner_instructions(
        topic=mock_scenario_a.title,
        level="B2",
        scepticism_level=mock_scenario_a.scepticism_level,
        section=ExamSectionType.SECTION_A,
        scenario=mock_scenario_a,
    )

    # 1. Anti-Jailbreak and character-lock protocol
    assert "RÈGLES ABSOLUES DE SÉCURITÉ ET D'IMMUNITÉ" in prompt_a
    assert "IMMUNITÉ AU JAILBREAK" in prompt_a
    assert "DISCIPLINE LINGUISTIQUE (100% FRANÇAIS)" in prompt_a
    assert "REFUS DE TOUT SUJET HORS-CADRE" in prompt_a
    assert "L'évaluation sera établie par le jury d'examen" in prompt_a

    # 2. Section A Persona & Register
    assert "M. Mercier" in prompt_a
    assert "Responsable du centre de plongée" in prompt_a
    assert "VOUVOIEMENT FORMEL" in prompt_a

    # 3. Stimulus Document
    assert "Club Aquabulle — Baptêmes et formations" in prompt_a
    assert "Plongez au cœur de la Méditerranée" in prompt_a

    # 4. Factual base & omitted facts
    assert "BASE FACTUELLE CONNUE" in prompt_a
    assert "50€ le baptême" in prompt_a
    assert "Certificat médical de non contre-indication obligatoire" in prompt_a

    # 5. Guardrails & Redirection
    assert "SUJETS STRICTEMENT INTERDITS" in prompt_a
    assert "Politique maritime internationale" in prompt_a
    assert "Revenons à votre demande concernant le baptême de plongée." in prompt_a

    # Now verify Section B with Objection Cards
    mock_scenario_b = SpeakingScenario(
        id=uuid.uuid4(),
        title="Partir en vacances sans smartphone",
        code="SCEN-TEST-B1",
        section="section_b",
        target_level="B2",
        difficulty="challenging",
        is_active=True,
        document_title="Déconnexion totale : 10 jours sans écran",
        document_content="De plus en plus de voyageurs choisissent des séjours sans connexion Internet.",
        role_title="Ami accro aux technologies et aux réseaux sociaux",
        persona_name="Alex",
        voice_persona="Fenrir",
        register="informal",
        temperament="Anxieux à l'idée de ne plus pouvoir consulter ses emails.",
        scepticism_level=0.75,
        known_facts=[],
        omitted_facts=[],
        objection_cards=[
            {
                "trigger": "urgence",
                "objection": "Et si mon travail m'appelle pour une urgence absolue ?",
                "concession": "À la limite, si on a un numéro d'urgence pour l'hôtel...",
            },
        ],
        scope_description="Discussion amicale sur le projet de vacances déconnectées.",
        forbidden_topics=["Crypto-monnaies", "Score de l'examen TEF"],
        redirection_phrases=["Alex te rappelle que vous parlez de vos vacances."],
    )

    prompt_b = build_examiner_instructions(
        topic=mock_scenario_b.title,
        level="B2",
        scepticism_level=mock_scenario_b.scepticism_level,
        section=ExamSectionType.SECTION_B,
        scenario=mock_scenario_b,
    )

    assert "TUTOIEMENT" in prompt_b
    assert "Alex" in prompt_b
    assert "OBJECTIONS À SOUMETTRE PROGRESSIVEMENT" in prompt_b
    assert "Et si mon travail m'appelle pour une urgence absolue ?" in prompt_b
    assert "À la limite, si on a un numéro d'urgence pour l'hôtel" in prompt_b


@pytest.mark.asyncio
async def test_speaking_scenarios_seed_and_idempotency(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
):
    """Admin seeds authentic default scenarios and validates idempotency."""
    resp = await client.post(
        "/api/v1/admin/ai-sandbox/scenarios/seed",
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    scenarios = resp.json()
    assert len(scenarios) >= 4

    codes = [s["code"] for s in scenarios]
    assert "SCEN-A-01" in codes
    assert "SCEN-B-01" in codes
    assert "SCEN-A-02" in codes
    assert "SCEN-B-02" in codes

    # Seed again: must be idempotent and return existing without error
    resp_again = await client.post(
        "/api/v1/admin/ai-sandbox/scenarios/seed",
        headers=admin_auth_headers,
    )
    assert resp_again.status_code == 200
    assert len(resp_again.json()) >= 4


@pytest.mark.asyncio
async def test_speaking_scenarios_crud_lifecycle(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
    student_auth_headers: dict[str, str],
):
    """Complete CRUD and permission verification for speaking scenarios."""
    # 1. Non-admin forbidden
    resp_forbidden = await client.get(
        "/api/v1/admin/ai-sandbox/scenarios",
        headers=student_auth_headers,
    )
    assert resp_forbidden.status_code == 403

    # 2. Create scenario
    new_scenario_payload = {
        "title": "Bénévolat dans un refuge animalier",
        "code": f"SCEN-CRUD-{uuid.uuid4().hex[:6].upper()}",
        "section": "section_a",
        "target_level": "B2",
        "difficulty": "standard",
        "is_active": True,
        "document_title": "Refuge des Quatre Pattes — Recherche bénévoles",
        "document_content": "Aidez-nous à promener les chiens et nettoyer les enclos le week-end.",
        "role_title": "Coordinateur des bénévoles du refuge",
        "persona_name": "M. Fabre",
        "voice_persona": "Aoede",
        "register": "formal",
        "temperament": "Accueillant et soucieux du bien-être des animaux.",
        "scepticism_level": 0.25,
        "known_facts": [{"category": "horaires", "fact": "Samedi 9h-12h"}],
        "omitted_facts": ["Vaccin antitétanique à jour obligatoire"],
        "objection_cards": [],
        "scope_description": "Missions et engagement bénévole au refuge.",
        "forbidden_topics": ["Adoption internationale", "Politique des partis"],
        "redirection_phrases": ["Parlons de votre disponibilité au refuge."],
    }

    create_resp = await client.post(
        "/api/v1/admin/ai-sandbox/scenarios",
        json=new_scenario_payload,
        headers=admin_auth_headers,
    )
    assert create_resp.status_code == 201
    created_data = create_resp.json()
    scenario_id = created_data["id"]
    assert created_data["code"] == new_scenario_payload["code"]
    assert created_data["document_title"] == "Refuge des Quatre Pattes — Recherche bénévoles"

    # 3. Duplicate code conflict
    conflict_resp = await client.post(
        "/api/v1/admin/ai-sandbox/scenarios",
        json=new_scenario_payload,
        headers=admin_auth_headers,
    )
    assert conflict_resp.status_code == 409

    # 4. Get by ID
    get_resp = await client.get(
        f"/api/v1/admin/ai-sandbox/scenarios/{scenario_id}",
        headers=admin_auth_headers,
    )
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == scenario_id

    # 5. Update scenario
    update_payload = {
        "title": "Bénévolat refuge animalier (Mise à jour)",
        "difficulty": "challenging",
        "scepticism_level": 0.45,
    }
    update_resp = await client.put(
        f"/api/v1/admin/ai-sandbox/scenarios/{scenario_id}",
        json=update_payload,
        headers=admin_auth_headers,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["title"] == "Bénévolat refuge animalier (Mise à jour)"
    assert update_resp.json()["difficulty"] == "challenging"
    assert update_resp.json()["scepticism_level"] == 0.45

    # 6. Duplicate scenario
    dup_resp = await client.post(
        f"/api/v1/admin/ai-sandbox/scenarios/{scenario_id}/duplicate",
        headers=admin_auth_headers,
    )
    assert dup_resp.status_code == 201
    dup_data = dup_resp.json()
    assert dup_data["id"] != scenario_id
    assert "(Copie)" in dup_data["title"]
    assert dup_data["is_active"] is False

    # 7. Delete scenario
    del_resp = await client.delete(
        f"/api/v1/admin/ai-sandbox/scenarios/{scenario_id}",
        headers=admin_auth_headers,
    )
    assert del_resp.status_code == 204

    # Confirm 404 after delete
    check_del = await client.get(
        f"/api/v1/admin/ai-sandbox/scenarios/{scenario_id}",
        headers=admin_auth_headers,
    )
    assert check_del.status_code == 404


@pytest.mark.asyncio
async def test_speaking_exam_creation_links_active_scenario(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
    student_auth_headers: dict[str, str],
):
    """When a student creates a speaking exam, active scenarios are linked and prompts contain guardrails."""
    # Ensure default scenarios are seeded
    await client.post(
        "/api/v1/admin/ai-sandbox/scenarios/seed",
        headers=admin_auth_headers,
    )

    # Student creates exam
    exam_payload = {
        "title": "Simulation Officielle TEF Expression Orale",
        "target_level": "B2",
    }
    create_exam_resp = await client.post(
        "/api/v1/speaking/exams",
        json=exam_payload,
        headers=student_auth_headers,
    )
    assert create_exam_resp.status_code == 201
    exam = create_exam_resp.json()

    assert "sections" in exam
    assert len(exam["sections"]) == 2

    sec_a = next(s for s in exam["sections"] if s["section_type"] == "section_a")
    sec_b = next(s for s in exam["sections"] if s["section_type"] == "section_b")

    # Section A check
    assert "Club de randonnée" in sec_a["prompt_topic"] or "Stage de théâtre" in sec_a["prompt_topic"]
    assert "ANNONCE :" in sec_a["prompt_context"]

    # Section B check
    assert "covoiturage" in sec_b["prompt_topic"].lower() or "liseuse" in sec_b["prompt_topic"].lower()
    assert "ARTICLE / SITUATION :" in sec_b["prompt_context"]
