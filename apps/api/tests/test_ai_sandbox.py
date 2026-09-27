"""Comprehensive integration and unit tests for the Admin AI Sandbox & Benchmarking Studio."""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.modules.admin.models import AuditEvent
from app.modules.users.models import User, UserRole


@pytest.fixture
async def admin_user(db_session: AsyncSession) -> User:
    admin = User(
        id=uuid.uuid4(),
        email=f"admin-{uuid.uuid4().hex[:8]}@tef.fr",
        password_hash=hash_password("SuperAdminPass123!"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add(admin)
    await db_session.commit()
    await db_session.refresh(admin)
    return admin


@pytest.fixture
async def student_user(db_session: AsyncSession) -> User:
    student = User(
        id=uuid.uuid4(),
        email=f"student-{uuid.uuid4().hex[:8]}@tef.fr",
        password_hash=hash_password("StudentPass123!"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    db_session.add(student)
    await db_session.commit()
    await db_session.refresh(student)
    return student


@pytest.fixture
def admin_headers(admin_user: User) -> dict[str, str]:
    token = create_access_token(admin_user.id, role=admin_user.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def student_headers(student_user: User) -> dict[str, str]:
    token = create_access_token(student_user.id, role=student_user.role.value)
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# RBAC Protection Tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_ai_sandbox_rbac_blocks_student(
    client: AsyncClient,
    student_headers: dict[str, str],
) -> None:
    """Non-admin users must be rejected with 403 Forbidden on all sandbox endpoints."""
    endpoints = [
        ("GET", "/api/v1/admin/ai-sandbox/templates"),
        ("GET", "/api/v1/admin/ai-sandbox/runs"),
        ("GET", "/api/v1/admin/ai-sandbox/benchmarks"),
        ("POST", "/api/v1/admin/ai-sandbox/run/writing"),
        ("POST", "/api/v1/admin/ai-sandbox/run/speaking/turn"),
    ]

    for method, path in endpoints:
        if method == "GET":
            res = await client.get(path, headers=student_headers)
        else:
            res = await client.post(path, headers=student_headers, json={})
        assert res.status_code == 403, f"{method} {path} should have been 403, got {res.status_code}"


# ---------------------------------------------------------------------------
# Templates CRUD Tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_ai_sandbox_templates_seed_and_crud(
    client: AsyncClient,
    admin_headers: dict[str, str],
    db_session: AsyncSession,
) -> None:
    """Templates endpoint must auto-seed system presets and support custom CRUD."""
    # 1. List templates (auto-seeds 4 system presets)
    res = await client.get("/api/v1/admin/ai-sandbox/templates", headers=admin_headers)
    assert res.status_code == 200
    templates = res.json()
    assert len(templates) >= 4
    preset_names = [t["name"] for t in templates]
    assert any("Correcteur TEF Écrit" in n for n in preset_names)

    # 2. Create custom template
    payload = {
        "name": "Custom B1 Evaluator",
        "description": "Strict B1 grammar grader",
        "feature_type": "writing",
        "system_prompt": "Tu évalues spécifiquement le niveau B1.",
        "user_prompt_template": "Texte: {draft}",
        "default_model": "models/gemini-3.5-flash",
        "default_temperature": 0.4,
    }
    create_res = await client.post("/api/v1/admin/ai-sandbox/templates", headers=admin_headers, json=payload)
    assert create_res.status_code == 201
    tpl_data = create_res.json()
    tpl_id = tpl_data["id"]
    assert tpl_data["name"] == "Custom B1 Evaluator"
    assert tpl_data["is_system_preset"] is False

    # 3. Update custom template
    update_res = await client.put(
        f"/api/v1/admin/ai-sandbox/templates/{tpl_id}",
        headers=admin_headers,
        json={"name": "Custom B1 Evaluator v2", "default_temperature": 0.5},
    )
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Custom B1 Evaluator v2"
    assert update_res.json()["default_temperature"] == 0.5

    # 4. Verify system preset rejection on modification
    system_tpl = next(t for t in templates if t["is_system_preset"])
    bad_edit = await client.put(
        f"/api/v1/admin/ai-sandbox/templates/{system_tpl['id']}",
        headers=admin_headers,
        json={"name": "Tampered"},
    )
    assert bad_edit.status_code == 400

    # 5. Delete custom template
    del_res = await client.delete(f"/api/v1/admin/ai-sandbox/templates/{tpl_id}", headers=admin_headers)
    assert del_res.status_code == 204

    # Confirm deletion
    get_del = await client.get(f"/api/v1/admin/ai-sandbox/templates/{tpl_id}", headers=admin_headers)
    assert get_del.status_code == 404


# ---------------------------------------------------------------------------
# Writing Sandbox Tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_ai_sandbox_writing_evaluation(
    client: AsyncClient,
    admin_headers: dict[str, str],
    db_session: AsyncSession,
    admin_user: User,
) -> None:
    """Writing test endpoint evaluates draft, generates criteria, and persists run."""
    payload = {
        "task_prompt": "La mairie veut interdire les voitures en centre-ville. Donnez votre avis.",
        "section": "section_b",
        "target_level": "B2",
        "student_draft": (
            "Monsieur le Rédacteur, Je vous écris pour soutenir le projet de fermeture du centre-ville. "
            "Cette mesure permettra de réduire la pollution et d'améliorer la qualité de vie des habitants. "
            "De plus, les commerces locaux profiteront d'une fréquentation piétonne accrue. "
            "Néanmoins, il est indispensable de renforcer les transports publics en banlieue."
        ),
        "temperature": 0.5,
        "force_simulation": True,
    }
    res = await client.post("/api/v1/admin/ai-sandbox/run/writing", headers=admin_headers, json=payload)
    assert res.status_code == 200
    data = res.json()

    # Verify result structure
    result = data["result"]
    assert "score" in result
    assert result["score"] >= 0
    assert result["cefr_level"] in ("A1", "A2", "B1", "B2", "C1", "C2")
    assert "criteria" in result
    assert "task_completion" in result["criteria"]
    assert "strengths" in result
    assert "weaknesses" in result
    assert len(result["recommendations"]) > 0

    # Verify run record in database
    run = data["run"]
    assert run["feature_type"] == "writing"
    assert run["is_simulation"] is True
    assert run["latency_ms"] >= 0
    assert run["total_tokens"] > 0
    assert run["created_by_id"] == str(admin_user.id)

    # Check AuditEvent
    audit_stmt = select(AuditEvent).where(
        AuditEvent.actor_user_id == admin_user.id,
        AuditEvent.action == "RUN_AI_WRITING_SANDBOX",
    )
    audit_res = await db_session.execute(audit_stmt)
    assert audit_res.scalar_one_or_none() is not None


# ---------------------------------------------------------------------------
# Speaking Sandbox Tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_ai_sandbox_speaking_turn_and_evaluation(
    client: AsyncClient,
    admin_headers: dict[str, str],
    admin_user: User,
) -> None:
    """Speaking turn endpoint tests persona reply for Section A & B, followed by evaluation."""
    # 1. Section A turn (Vouvoiement formel)
    turn_req_a = {
        "section": "section_a",
        "topic": "Atelier de cuisine",
        "target_level": "B2",
        "candidate_message": "Bonjour, quels sont les tarifs de vos ateliers ?",
        "dialogue_history": [],
        "force_simulation": True,
    }
    res_a = await client.post("/api/v1/admin/ai-sandbox/run/speaking/turn", headers=admin_headers, json=turn_req_a)
    assert res_a.status_code == 200
    turn_a = res_a.json()["turn"]
    assert "tarifs" in turn_a["examiner_reply"].lower() or "euros" in turn_a["examiner_reply"].lower()
    assert turn_a["is_simulation"] is True

    # 2. Section B turn (Tutoiement amical)
    turn_req_b = {
        "section": "section_b",
        "topic": "Voyage en vélo en Bretagne",
        "target_level": "B2",
        "candidate_message": "Salut ! Tu devrais vraiment venir faire ce voyage à vélo avec moi !",
        "dialogue_history": [],
        "force_simulation": True,
    }
    res_b = await client.post("/api/v1/admin/ai-sandbox/run/speaking/turn", headers=admin_headers, json=turn_req_b)
    assert res_b.status_code == 200
    turn_b = res_b.json()["turn"]
    # Check that the simulated response uses tutoiement / friendly phrasing
    assert "tu" in turn_b["examiner_reply"].lower() or "salut" in turn_b["examiner_reply"].lower()

    # 3. Overall oral evaluation
    eval_req = {
        "section": "section_b",
        "topic": "Voyage en vélo",
        "target_level": "B2",
        "transcription": (
            "CANDIDAT: Salut ! Tu devrais venir en voyage à vélo avec moi en Bretagne. "
            "EXAMINATEUR: Écoute, ça m'a l'air fatigant. "
            "CANDIDAT: Pas du tout, c'est du canal plat, avec des vélos électriques confortables et des paysages magnifiques !"
        ),
        "force_simulation": True,
    }
    res_eval = await client.post("/api/v1/admin/ai-sandbox/run/speaking/evaluate", headers=admin_headers, json=eval_req)
    assert res_eval.status_code == 200
    eval_data = res_eval.json()["result"]
    assert eval_data["tef_points"] > 0
    assert eval_data["cefr_level"] in ("B1", "B2", "C1")
    assert eval_data["interaction_coherence"] > 0


# ---------------------------------------------------------------------------
# Raw Prompt Lab & Comparison Tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_ai_sandbox_raw_prompt_and_compare(
    client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """Raw prompt execution returns tokens, and compare endpoint diffs two runs."""
    # 1. Run prompt A
    req_a = {
        "system_prompt": "Assistant linguistique",
        "user_prompt": "Explique l'accord du participe passé avec avoir en 2 phrases.",
        "model": "models/gemini-3.5-flash",
        "temperature": 0.2,
        "force_simulation": True,
    }
    res_a = await client.post("/api/v1/admin/ai-sandbox/run/raw", headers=admin_headers, json=req_a)
    assert res_a.status_code == 200
    run_a_id = res_a.json()["run"]["id"]

    # 2. Run prompt B
    req_b = {
        "system_prompt": "Assistant linguistique expert pédagogique",
        "user_prompt": "Explique l'accord du participe passé avec avoir pour un élève débutant.",
        "model": "models/gemini-3.5-flash",
        "temperature": 0.8,
        "force_simulation": True,
    }
    res_b = await client.post("/api/v1/admin/ai-sandbox/run/raw", headers=admin_headers, json=req_b)
    assert res_b.status_code == 200
    run_b_id = res_b.json()["run"]["id"]

    # 3. Compare runs A and B
    comp_res = await client.post(
        "/api/v1/admin/ai-sandbox/compare",
        headers=admin_headers,
        json={"run_id_a": run_a_id, "run_id_b": run_b_id},
    )
    assert comp_res.status_code == 200
    comp_data = comp_res.json()
    assert comp_data["run_a"]["id"] == run_a_id
    assert comp_data["run_b"]["id"] == run_b_id
    assert "prompt_diff_summary" in comp_data
    assert "evaluation_diff_summary" in comp_data


# ---------------------------------------------------------------------------
# Benchmarks Catalog Test
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_ai_sandbox_benchmarks_catalog(
    client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """Benchmarks catalog returns curated TEF sample scenarios."""
    res = await client.get("/api/v1/admin/ai-sandbox/benchmarks", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "samples" in data
    assert len(data["samples"]) >= 4

    levels = [s["cefr_level"] for s in data["samples"]]
    assert "B2" in levels
    assert "B1" in levels
    assert "A2" in levels


# ---------------------------------------------------------------------------
# Speaking Examiner Production Model Configurations Test
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_ai_sandbox_speaking_examiner_configs(
    client: AsyncClient,
    admin_headers: dict[str, str],
    student_headers: dict[str, str],
    admin_user: User,
    db_session: AsyncSession,
) -> None:
    """Admin can get and deploy active Speaking Examiner configurations to production."""
    # 1. Non-admin gets 403
    forbidden_res = await client.get("/api/v1/admin/ai-sandbox/speaking/config", headers=student_headers)
    assert forbidden_res.status_code == 403

    # 2. Admin retrieves production configs (auto-seeded)
    get_res = await client.get("/api/v1/admin/ai-sandbox/speaking/config", headers=admin_headers)
    assert get_res.status_code == 200
    configs = get_res.json()
    assert len(configs) == 2
    sections = [c["section"] for c in configs]
    assert "section_a" in sections
    assert "section_b" in sections

    # 3. Update / promote Section B configuration to production
    update_req = {
        "section": "section_b",
        "model": "models/gemini-3.8-live",
        "voice_persona": "Fenrir",
        "system_prompt": "Tu es un ami sceptique qui conteste le projet de vacances.",
        "scepticism_level": 0.85,
        "temperature": 0.65,
        "top_p": 0.90,
    }
    put_res = await client.put(
        "/api/v1/admin/ai-sandbox/speaking/config",
        headers=admin_headers,
        json=update_req,
    )
    assert put_res.status_code == 200
    updated = put_res.json()
    assert updated["section"] == "section_b"
    assert updated["voice_persona"] == "Fenrir"
    assert updated["scepticism_level"] == 0.85
    assert updated["temperature"] == 0.65

    # 4. Verify audit log entry was created
    audit_stmt = select(AuditEvent).where(
        AuditEvent.actor_user_id == admin_user.id,
        AuditEvent.action == "SPEAKING_EXAMINER_CONFIG_UPDATED",
    )
    audit_res = await db_session.execute(audit_stmt)
    audit = audit_res.scalar_one_or_none()
    assert audit is not None
    assert audit.payload["voice_persona"] == "Fenrir"
    assert audit.payload["scepticism_level"] == 0.85


# ---------------------------------------------------------------------------
# Speaking Examiner Live Duplex Session Test
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_ai_sandbox_gemini_live_examiner_simulation(
    admin_user: User,
) -> None:
    """Test GeminiLiveExaminer duplex exchange, barge-in interruption, and report card."""
    from app.modules.speaking.providers.gemini_live import (
        GeminiLiveExaminer,
        GeminiSpeakingEvaluator,
    )

    examiner = GeminiLiveExaminer(
        session_id=uuid.uuid4(),
        topic="TEF Section A — Demande de renseignements",
        level="B2",
        model="models/gemini-3.8-flash-live-preview",
        voice_persona="Aoede",
        scepticism_level=0.75,
        force_simulation=True,
    )

    # 1. Connect
    connected = await examiner.connect()
    assert connected is True
    assert examiner.force_simulation is True

    # 2. Greeting prompt
    await examiner.send_text_turn("Bonjour, je vous appelle pour avoir des renseignements sur le cours de français.")

    # 3. Stream responses
    events = []
    async for event in examiner.stream_responses():
        events.append(event)
        if len(events) >= 2:
            break

    # Verify transcript event emitted
    assert len(events) == 2
    assert events[0]["type"] == "transcript"
    assert events[0]["role"] == "examiner"
    assert "créneaux" in events[0]["text"]
    assert events[1]["type"] == "turn_change"

    # 4. Candidate sends audio chunk
    await examiner.send_audio_chunk("bW9ja19hdWRpb19kYXRh", mime_type="audio/pcm;rate=16000")

    # 5. Candidate interrupts examiner (barge-in) multiple times to test dynamic persona
    await examiner.send_interruption()
    assert examiner.interruption_count == 1

    # Second interruption
    await examiner.send_interruption()
    assert examiner.interruption_count == 2

    # Third interruption triggers first stern warning
    await examiner.send_interruption()
    assert examiner.interruption_count == 3

    # Check simulated event stream for stern warning
    stern_events = []
    async for event in examiner.stream_responses():
        stern_events.append(event)
        if len(stern_events) >= 3:
            break

    # Event 0 is interrupted flag with count, Event 1 is stern transcript, Event 2 is turn change
    assert any(e.get("type") == "interrupted" and e.get("interruption_count") == 3 for e in stern_events)
    assert any(e.get("type") == "transcript" and "laisser terminer" in e.get("text", "") for e in stern_events)

    # 6. Verify accumulated transcript
    full_transcript = examiner.get_full_transcript()
    assert "Candidat" in full_transcript
    assert "Examinateur" in full_transcript
    assert "laisser terminer" in full_transcript

    # 7. Evaluate session to generate official TEF report card
    evaluator = GeminiSpeakingEvaluator()
    eval_result = await evaluator.evaluate_session(
        topic="TEF Section A — Demande de renseignements",
        level="B2",
        transcript=full_transcript,
    )

    assert eval_result.overall_score >= 0
    assert eval_result.tef_points >= 0
    assert eval_result.estimated_level in ("A1", "A2", "B1", "B2", "C1", "C2")
    assert eval_result.fluency >= 0
    assert eval_result.vocabulary >= 0
    assert eval_result.grammar >= 0
    assert eval_result.coherence >= 0
    assert len(eval_result.strengths) > 0
    assert len(eval_result.weaknesses) > 0
    assert len(eval_result.recommendations) > 0

    await examiner.close()

