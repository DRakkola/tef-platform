import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.modules.speaking.providers.gemini_live import GeminiLiveExaminer


@pytest.mark.asyncio
async def test_send_audio_chunk_uses_audio_field_never_media_chunks():
    """Verify Gemini Live Multimodal WebSocket payload uses realtimeInput.audio schema."""
    session_id = uuid.uuid4()
    examiner = GeminiLiveExaminer(
        session_id=session_id,
        topic="Information Inquiry",
        level="B2",
    )
    examiner._is_connected = True
    examiner.force_simulation = False

    mock_ws = AsyncMock()
    examiner.ws = mock_ws

    test_b64 = "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="
    await examiner.send_audio_chunk(test_b64, mime_type="audio/pcm;rate=16000")

    mock_ws.send.assert_called_once()
    raw_payload = mock_ws.send.call_args[0][0]
    payload = json.loads(raw_payload)

    # 1. Must have realtimeInput
    assert "realtimeInput" in payload
    # 2. Must have audio dictionary with mimeType and data
    assert "audio" in payload["realtimeInput"]
    audio_obj = payload["realtimeInput"]["audio"]
    assert audio_obj["mimeType"] == "audio/pcm;rate=16000"
    assert audio_obj["data"] == test_b64
    # 3. Must NEVER use deprecated mediaChunks
    assert "mediaChunks" not in payload["realtimeInput"]


@pytest.mark.asyncio
async def test_stream_responses_handles_vad_transcriptions_and_turn_completion():
    """Verify stream_responses correctly parses VAD, candidate transcription, examiner audio, and turnComplete."""
    session_id = uuid.uuid4()
    examiner = GeminiLiveExaminer(
        session_id=session_id,
        topic="Section A - Informations",
        level="B2",
    )
    examiner._is_connected = True
    examiner.force_simulation = False

    incoming_messages = [
        json.dumps({"voiceActivity": {"type": "ACTIVITY_START", "audioOffset": "0.320s"}}),
        json.dumps({
            "serverContent": {
                "inputTranscription": {
                    "text": "Bonjour, je voudrais avoir des informations concernant les tarifs et les horaires."
                }
            }
        }),
        json.dumps({"voiceActivity": {"type": "ACTIVITY_END", "audioOffset": "4.150s"}}),
        json.dumps({
            "serverContent": {
                "modelTurn": {
                    "parts": [
                        {
                            "inlineData": {
                                "mimeType": "audio/pcm;rate=24000",
                                "data": "VGhpcyBpcyB0ZXN0IGF1ZGlv",
                            }
                        }
                    ]
                }
            }
        }),
        json.dumps({
            "serverContent": {
                "outputTranscription": {
                    "text": "Bonjour ! Nous sommes ouverts tous les jours de 9h à 18h."
                }
            }
        }),
        json.dumps({
            "serverContent": {
                "turnComplete": True
            }
        }),
    ]

    mock_ws = AsyncMock()
    mock_ws.recv.side_effect = incoming_messages + [AsyncMock(side_effect=Exception("Stop stream"))]
    examiner.ws = mock_ws

    events = []
    async for event in examiner.stream_responses():
        events.append(event)
        if len(events) >= len(incoming_messages):
            break

    # 1. ACTIVITY_START
    assert events[0]["type"] == "voice_activity"
    assert events[0]["action"] == "voice_activity"
    assert events[0]["status"] == "speaking"
    assert events[0]["role"] == "candidate"

    # 2. Candidate input transcription
    assert events[1]["type"] == "transcript"
    assert events[1]["action"] == "transcript"
    assert events[1]["role"] == "candidate"
    assert "tarifs et les horaires" in events[1]["text"]

    # 3. ACTIVITY_END
    assert events[2]["type"] == "voice_activity"
    assert events[2]["action"] == "voice_activity"
    assert events[2]["status"] == "finished"
    assert events[2]["role"] == "candidate"

    # 4. Examiner audio chunk
    assert events[3]["type"] == "audio"
    assert events[3]["action"] == "audio_chunk"
    assert events[3]["mime_type"] == "audio/pcm;rate=24000"
    assert events[3]["data"] == "VGhpcyBpcyB0ZXN0IGF1ZGlv"

    # 5. Examiner output transcription
    assert events[4]["type"] == "transcript"
    assert events[4]["action"] == "transcript"
    assert events[4]["role"] == "examiner"
    assert "Bonjour ! Nous sommes ouverts" in events[4]["text"]

    # 6. Turn complete -> turn_change
    assert events[5]["type"] == "turn_change"
    assert events[5]["action"] == "turn_change"
    assert events[5]["turn"] == "student"
    assert events[5]["ai_state"] == "listening"
