"""Tests for Phase 3: Durable Conversation, Audio & Transcript Evidence."""

import io
import uuid
import wave

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.modules.speaking.audio import (
    calculate_audio_duration,
    pcm_to_wav,
    save_turn_audio,
)
from app.modules.speaking.enums import (
    ExamSectionType,
    SpeakingExamState,
    SpeakingTurnSpeaker,
    TranscriptStatus,
)
from app.modules.speaking.models import SpeakingEvaluation, SpeakingExam
from app.modules.users.models import User, UserRole
from app.workers.tasks import evaluate_speaking_exam_core


def test_pcm_to_wav_header_and_duration() -> None:
    """PCM samples are correctly packaged into valid RIFF/WAVE headers with accurate duration."""
    # 1 second of 16kHz 16-bit mono PCM = 16000 * 2 = 32000 bytes
    pcm_16k = b"\x00\x00" * 16000
    wav_16k = pcm_to_wav(pcm_16k, sample_rate=16000)

    assert wav_16k.startswith(b"RIFF")
    assert b"WAVE" in wav_16k[:16]
    assert calculate_audio_duration(pcm_16k, sample_rate=16000) == 1.0

    # Parse WAV container with standard wave module to verify structural validity
    with wave.open(io.BytesIO(wav_16k), "rb") as wf:
        assert wf.getnchannels() == 1
        assert wf.getsampwidth() == 2
        assert wf.getframerate() == 16000
        assert wf.getnframes() == 16000

    # 1.5 seconds of 24kHz 16-bit mono PCM = 36000 samples = 72000 bytes
    pcm_24k = b"\x00\x00" * 36000
    wav_24k = pcm_to_wav(pcm_24k, sample_rate=24000)
    assert calculate_audio_duration(pcm_24k, sample_rate=24000) == 1.5

    with wave.open(io.BytesIO(wav_24k), "rb") as wf:
        assert wf.getframerate() == 24000
        assert wf.getnframes() == 36000


def test_save_turn_audio_deterministic_key() -> None:
    """save_turn_audio uploads to private object storage using canonical deterministic key."""
    from tests.conftest import mock_storage

    exam_id = uuid.uuid4()
    pcm = b"\x01\x00" * 8000  # 0.5s at 16kHz
    key, duration = save_turn_audio(
        storage=mock_storage,
        exam_id=exam_id,
        section_type="section_a",
        turn_number=1,
        speaker="candidate",
        pcm_bytes=pcm,
        sample_rate=16000,
    )

    expected_key = f"speaking/exams/{exam_id}/section_a/turn_001_candidate.wav"
    assert key == expected_key
    assert duration == 0.5

    # Verify object in mock storage
    downloaded = mock_storage.download_file(key)
    assert downloaded.startswith(b"RIFF")


@pytest.mark.asyncio
async def test_record_turn_evidence_fields_and_idempotency(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
) -> None:
    """Turns persist speaker, transcript status, audio key, duration, and respect client_turn_id idempotency."""
    # 1. Create and start exam
    create_res = await client.post(
        "/api/v1/speaking/exams",
        json={"level": "B2"},
        headers=student_auth_headers,
    )
    exam_id = create_res.json()["id"]
    await client.post(f"/api/v1/speaking/exams/{exam_id}/start", headers=student_auth_headers)

    client_turn_id = str(uuid.uuid4())
    audio_key = f"speaking/exams/{exam_id}/section_a/turn_001_candidate.wav"

    # 2. Record Turn 1 (Candidate)
    t1_res = await client.post(
        f"/api/v1/speaking/exams/{exam_id}/sections/section_a/turns",
        json={
            "speaker": SpeakingTurnSpeaker.CANDIDATE.value,
            "content_text": "Bonjour, je vous appelle pour avoir des renseignements sur le séjour.",
            "transcript_status": TranscriptStatus.COMPLETED.value,
            "audio_storage_key": audio_key,
            "audio_duration_seconds": 3.75,
            "client_turn_id": client_turn_id,
        },
        headers=student_auth_headers,
    )
    assert t1_res.status_code == 201
    t1_data = t1_res.json()
    assert t1_data["turn_number"] == 1
    assert t1_data["speaker"] == SpeakingTurnSpeaker.CANDIDATE.value
    assert t1_data["transcript_status"] == TranscriptStatus.COMPLETED.value
    assert t1_data["audio_storage_key"] == audio_key
    assert t1_data["audio_duration_seconds"] == 3.75
    assert t1_data["client_turn_id"] == client_turn_id

    # 3. Idempotent re-send of same client_turn_id returns existing turn without incrementing turn_number
    t1_dup_res = await client.post(
        f"/api/v1/speaking/exams/{exam_id}/sections/section_a/turns",
        json={
            "speaker": SpeakingTurnSpeaker.CANDIDATE.value,
            "content_text": "Bonjour, je vous appelle pour avoir des renseignements sur le séjour.",
            "transcript_status": TranscriptStatus.COMPLETED.value,
            "audio_storage_key": audio_key,
            "audio_duration_seconds": 3.75,
            "client_turn_id": client_turn_id,
        },
        headers=student_auth_headers,
    )
    assert t1_dup_res.status_code == 201
    t1_dup_data = t1_dup_res.json()
    assert t1_dup_data["id"] == t1_data["id"]
    assert t1_dup_data["turn_number"] == 1

    # 4. Turn 2 (Examiner)
    t2_res = await client.post(
        f"/api/v1/speaking/exams/{exam_id}/sections/section_a/turns",
        json={
            "speaker": SpeakingTurnSpeaker.EXAMINER.value,
            "content_text": "Bonjour ! Oui bien sûr, que souhaitez-vous savoir en particulier ?",
            "transcript_status": TranscriptStatus.COMPLETED.value,
            "audio_storage_key": f"speaking/exams/{exam_id}/section_a/turn_002_examiner.wav",
            "audio_duration_seconds": 4.1,
            "interrupted": False,
        },
        headers=student_auth_headers,
    )
    assert t2_res.status_code == 201
    t2_data = t2_res.json()
    assert t2_data["turn_number"] == 2
    assert t2_data["speaker"] == SpeakingTurnSpeaker.EXAMINER.value

    # 5. List turns verifies ordered evidence sequence
    list_res = await client.get(
        f"/api/v1/speaking/exams/{exam_id}/sections/section_a/turns",
        headers=student_auth_headers,
    )
    assert list_res.status_code == 200
    turns = list_res.json()
    assert len(turns) == 2
    assert turns[0]["turn_number"] == 1
    assert turns[1]["turn_number"] == 2


@pytest.mark.asyncio
async def test_presigned_audio_url_authorization(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    db_session: AsyncSession,
) -> None:
    """Candidate can obtain presigned URL for own audio; other students are forbidden."""
    # 1. Create exam and record turn with audio
    create_res = await client.post(
        "/api/v1/speaking/exams",
        json={"level": "B2"},
        headers=student_auth_headers,
    )
    exam_id = create_res.json()["id"]
    await client.post(f"/api/v1/speaking/exams/{exam_id}/start", headers=student_auth_headers)

    audio_key = f"speaking/exams/{exam_id}/section_a/turn_001_candidate.wav"
    t_res = await client.post(
        f"/api/v1/speaking/exams/{exam_id}/sections/section_a/turns",
        json={
            "speaker": SpeakingTurnSpeaker.CANDIDATE.value,
            "content_text": "Bonjour.",
            "audio_storage_key": audio_key,
            "audio_duration_seconds": 1.2,
        },
        headers=student_auth_headers,
    )
    turn_id = t_res.json()["id"]

    # 2. Candidate retrieves presigned URL
    audio_res = await client.get(
        f"/api/v1/speaking/exams/{exam_id}/sections/section_a/turns/{turn_id}/audio",
        headers=student_auth_headers,
    )
    assert audio_res.status_code == 200
    data = audio_res.json()
    assert "audio_url" in data
    assert data["audio_storage_key"] == audio_key
    assert data["expires_in"] == 3600

    # 3. Create another student and attempt access -> 403 Forbidden
    other_student = User(
        email=f"other_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("OtherPassword123!"),
        role=UserRole.STUDENT,
        is_active=True,
        is_verified=True,
    )
    db_session.add(other_student)
    await db_session.commit()
    await db_session.refresh(other_student)

    other_token = create_access_token(other_student.id, other_student.role.value)
    other_headers = {"Authorization": f"Bearer {other_token}"}

    forbidden_res = await client.get(
        f"/api/v1/speaking/exams/{exam_id}/sections/section_a/turns/{turn_id}/audio",
        headers=other_headers,
    )
    assert forbidden_res.status_code == 403


@pytest.mark.asyncio
async def test_evaluate_speaking_exam_core_evidence_snapshot(
    db_session: AsyncSession,
    test_student: User,
) -> None:
    """Core evaluation builds chronological evidence snapshot and updates exam state idempotently."""
    from app.modules.speaking.exam_service import SpeakingExamService
    from app.modules.speaking.schemas import SpeakingExamCreate, SpeakingTurnCreate

    # 1. Create Exam
    exam = await SpeakingExamService.create_exam(
        db=db_session,
        student_id=test_student.id,
        payload=SpeakingExamCreate(level="B2"),
    )
    exam = await SpeakingExamService.start_exam(db_session, exam.id, test_student.id)

    # 2. Record turns in Section A
    await SpeakingExamService.record_turn(
        db=db_session,
        exam_id=exam.id,
        section_type=ExamSectionType.SECTION_A,
        turn_data=SpeakingTurnCreate(
            speaker=SpeakingTurnSpeaker.EXAMINER,
            content_text="Bonjour, je vous écoute.",
            audio_storage_key=f"speaking/exams/{exam.id}/section_a/turn_001_examiner.wav",
            audio_duration_seconds=2.0,
        ),
        user_id=test_student.id,
    )
    await SpeakingExamService.record_turn(
        db=db_session,
        exam_id=exam.id,
        section_type=ExamSectionType.SECTION_A,
        turn_data=SpeakingTurnCreate(
            speaker=SpeakingTurnSpeaker.CANDIDATE,
            content_text="Bonjour, pouvez-vous me préciser les tarifs pour le séjour ?",
            audio_storage_key=f"speaking/exams/{exam.id}/section_a/turn_002_candidate.wav",
            audio_duration_seconds=3.5,
        ),
        user_id=test_student.id,
    )

    # 3. Transition to Section B and record turn
    await SpeakingExamService.complete_section(db_session, exam.id, ExamSectionType.SECTION_A, test_student.id)
    await SpeakingExamService.start_section(db_session, exam.id, ExamSectionType.SECTION_B, test_student.id)
    await SpeakingExamService.record_turn(
        db=db_session,
        exam_id=exam.id,
        section_type=ExamSectionType.SECTION_B,
        turn_data=SpeakingTurnCreate(
            speaker=SpeakingTurnSpeaker.CANDIDATE,
            content_text="Salut ! Je voulais te parler de la colocation en périphérie.",
            audio_storage_key=f"speaking/exams/{exam.id}/section_b/turn_001_candidate.wav",
            audio_duration_seconds=4.0,
        ),
        user_id=test_student.id,
    )

    # Complete Section B
    exam = await SpeakingExamService.complete_section(
        db_session, exam.id, ExamSectionType.SECTION_B, test_student.id
    )
    assert exam.status == SpeakingExamState.COMPLETED

    # 4. Run evaluate_speaking_exam_core
    eval_result = await evaluate_speaking_exam_core(db_session, exam.id)
    assert eval_result["status"] == "success"
    assert "evaluation_id" in eval_result

    # 5. Inspect database evaluation record
    eval_stmt = select(SpeakingEvaluation).where(SpeakingEvaluation.exam_id == exam.id)
    evaluation = (await db_session.execute(eval_stmt)).scalar_one_or_none()
    assert evaluation is not None
    assert evaluation.student_id == test_student.id
    assert evaluation.evaluator_model is not None
    assert evaluation.overall_score > 0
    assert evaluation.evidence_snapshot is not None

    snapshot = evaluation.evidence_snapshot
    assert snapshot["exam_id"] == str(exam.id)
    assert len(snapshot["sections"]) == 2

    # Section A has 2 turns
    sec_a_snap = next(s for s in snapshot["sections"] if s["section_type"] == "section_a")
    assert len(sec_a_snap["turns"]) == 2
    assert sec_a_snap["turns"][0]["speaker"] == "examiner"
    assert sec_a_snap["turns"][1]["speaker"] == "candidate"

    # Section B has 1 turn
    sec_b_snap = next(s for s in snapshot["sections"] if s["section_type"] == "section_b")
    assert len(sec_b_snap["turns"]) == 1

    # Check exam state
    updated_exam = (await db_session.execute(select(SpeakingExam).where(SpeakingExam.id == exam.id))).scalar_one()
    assert updated_exam.status == SpeakingExamState.EVALUATED
    assert updated_exam.evaluation_id == evaluation.id

    # 6. Idempotency: Calling evaluate_speaking_exam_core again returns already_evaluated
    dup_eval = await evaluate_speaking_exam_core(db_session, exam.id)
    assert dup_eval["status"] == "already_evaluated"
    assert dup_eval["evaluation_id"] == str(evaluation.id)
