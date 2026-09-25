"""Gemini Live Multimodal Provider for TEF Virtual Oral Examiner.

Manages bidirectional real-time audio streaming (WebSocket) with Google Gemini Live API
for Section A (Information Inquiry) and Section B (Persuasion/Argumentation), as well as
post-session CEFR/TEF competency evaluations.
"""

import asyncio
import json
import uuid
from typing import Any, AsyncGenerator

import httpx
import structlog
import websockets

from app.core.config import settings
from app.modules.speaking.abstractions import EvaluationResult, SpeakingEvaluationProvider
from app.modules.speaking.providers.mock import MockSpeakingProvider

logger = structlog.get_logger("tef-api.speaking.gemini_live")


def build_examiner_instructions(topic: str, level: str = "B2") -> str:
    """Build authentic, CEFR-aligned examiner system instructions for the oral simulation."""
    is_section_a = "section a" in topic.lower() or "renseignement" in topic.lower() or "information" in topic.lower()

    if is_section_a:
        return f"""Tu es l'examinateur virtuel officiel de l'épreuve d'expression orale du TEF (Test d'Évaluation de Français), Section A : « Prise d'information formelle ».
Niveau visé : {level}.
Sujet / Contexte de l'annonce : {topic}

CONSIGNES STRICTES POUR L'EXAMINATEUR :
1. RÔLE ET REGISTRE :
   - Tu incarnes le responsable, l'employé ou l'interlocuteur mentionné dans l'annonce.
   - Tu t'adresses au candidat en utilisant IMPÉRATIVEMENT le vouvoiement formel (« vous »).
   - Ton ton est professionnel, poli, courtois et accueillant.

2. DÉROULEMENT DU JEU DE RÔLE :
   - C'est le candidat qui doit mener l'échange et te poser une dizaine de questions précises pour obtenir des informations (tarifs, horaires, conditions, démarches, matériel, etc.).
   - Tes réponses doivent être concises (1 à 3 phrases maximum), claires et naturelles, pour lui laisser le temps de poser ses questions.
   - Ne donne pas toutes les informations d'un coup. Réponds précisément à la question posée sans anticiper les suivantes.
   - Si le candidat hésite ou fait une pause prolongée, relance-le avec bienveillance : « Avez-vous d'autres questions sur nos formules ou les horaires ? » ou « Souhaitez-vous des précisions sur un autre point ? ».

3. LANGUE :
   - Exprime-toi exclusivement en français, avec une diction impeccable et un débit adapté à un examen officiel.
"""

    return f"""Tu es l'examinateur virtuel officiel de l'épreuve d'expression orale du TEF (Test d'Évaluation de Français), Section B : « Argumentation et persuasion ».
Niveau visé : {level}.
Sujet / Contexte du document : {topic}

CONSIGNES STRICTES POUR L'EXAMINATEUR :
1. RÔLE ET REGISTRE :
   - Tu incarnes un ami proche, un colocataire ou un collègue du candidat.
   - Tu t'adresses au candidat en utilisant IMPÉRATIVEMENT le tutoiement (« tu »).
   - Ton ton est familier mais spontané, franc et expressif.

2. DÉROULEMENT DU JEU DE RÔLE :
   - Le candidat a lu une annonce ou un article et cherche à te convaincre de participer avec lui à un projet, une activité ou un achat.
   - Tu es INITIALEMENT SCEPTIQUE, hésitant et réticent.
   - Tu ne dois SURTOUT PAS accepter immédiatement sa proposition.
   - Soulève des objections réalistes et variées : budget/prix trop cher, manque de temps, contraintes logistiques, doute sur l'intérêt réel, alternatives préférables.
   - Coupe-le ou réagis naturellement quand un argument manque de consistance : « Attends, mais tu trouves pas que c'est risqué ? », « Franchement, je n'ai pas le budget pour ça ce mois-ci... ».
   - Ne cède que très progressivement à la toute fin de l'échange, et seulement s'il présente des arguments convaincants et structurés.

3. LANGUE :
   - Exprime-toi exclusivement en français parlé naturel (phrases courtes, expressions idiomatiques courantes du français oral).
"""


class GeminiLiveExaminer:
    """Manages real-time bidirectional audio exchange with Gemini Live WebSocket."""

    def __init__(
        self,
        session_id: uuid.UUID,
        topic: str,
        level: str = "B2",
    ) -> None:
        self.session_id = session_id
        self.topic = topic
        self.level = level
        self.ws: websockets.WebSocketClientProtocol | None = None
        self.transcript_entries: list[dict[str, Any]] = []
        self._is_connected = False
        self._system_prompt = build_examiner_instructions(topic, level)

    async def connect(self) -> bool:
        """Establish WebSocket connection to Gemini Multimodal Live API and send setup handshake."""
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            logger.warning("gemini_live_no_api_key", session_id=str(self.session_id))
            return False

        model = settings.GEMINI_LIVE_MODEL
        url = (
            f"wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha"
            f".GenerativeService.BidiGenerateContent?key={api_key}"
        )

        try:
            self.ws = await websockets.connect(url, ping_interval=20, ping_timeout=20)
            setup_payload = {
                "setup": {
                    "model": model,
                    "generationConfig": {
                        "responseModalities": ["AUDIO"],
                        "speechConfig": {
                            "voiceConfig": {
                                "prebuiltVoiceConfig": {
                                    "voiceName": "Aoede",  # Expressive, native French voice
                                }
                            }
                        },
                    },
                    "systemInstruction": {
                        "parts": [{"text": self._system_prompt}]
                    },
                }
            }
            await self.ws.send(json.dumps(setup_payload))
            init_resp = await asyncio.wait_for(self.ws.recv(), timeout=8.0)
            init_data = json.loads(init_resp) if isinstance(init_resp, str) else json.loads(init_resp.decode())

            if "setupComplete" in init_data:
                self._is_connected = True
                logger.info(
                    "gemini_live_handshake_successful",
                    session_id=str(self.session_id),
                    model=model,
                )
                return True

            logger.error("gemini_live_unexpected_handshake", resp=init_data)
            return False

        except Exception as exc:
            logger.error("gemini_live_connection_failed", session_id=str(self.session_id), error=str(exc))
            self._is_connected = False
            return False

    async def send_audio_chunk(self, pcm_base64: str, mime_type: str = "audio/pcm;rate=16000") -> None:
        """Send student microphone PCM audio chunk to Gemini."""
        if not self.ws or not self._is_connected:
            return

        payload = {
            "realtimeInput": {
                "mediaChunks": [
                    {
                        "mimeType": mime_type,
                        "data": pcm_base64,
                    }
                ]
            }
        }
        try:
            await self.ws.send(json.dumps(payload))
        except Exception as exc:
            logger.warning("gemini_live_send_audio_failed", error=str(exc))

    async def send_text_turn(self, text: str) -> None:
        """Send explicit text message to the virtual examiner."""
        if not self.ws or not self._is_connected:
            return

        self.record_transcript("candidate", text)
        payload = {
            "clientContent": {
                "turns": [
                    {
                        "role": "user",
                        "parts": [{"text": text}],
                    }
                ],
                "turnComplete": True,
            }
        }
        try:
            await self.ws.send(json.dumps(payload))
        except Exception as exc:
            logger.warning("gemini_live_send_text_failed", error=str(exc))

    def record_transcript(self, role: str, text: str) -> None:
        """Accumulate live conversation turns."""
        cleaned = text.strip()
        if not cleaned:
            return
        self.transcript_entries.append({
            "role": role,
            "text": cleaned,
            "timestamp": asyncio.get_event_loop().time(),
        })

    def get_full_transcript(self) -> str:
        """Format complete dialogue transcript for post-session scoring."""
        lines = []
        for entry in self.transcript_entries:
            speaker = "Examinateur" if entry["role"] == "examiner" else "Candidat"
            lines.append(f"{speaker} : {entry['text']}")
        return "\n".join(lines)

    async def stream_responses(self) -> AsyncGenerator[dict[str, Any], None]:
        """Stream events, audio chunks, and transcript updates from Gemini Live."""
        if not self.ws:
            return

        try:
            while self._is_connected:
                raw_msg = await self.ws.recv()
                msg = json.loads(raw_msg) if isinstance(raw_msg, str) else json.loads(raw_msg.decode())

                # 1. Handle server turn / audio content
                server_content = msg.get("serverContent", {})
                if server_content:
                    model_turn = server_content.get("modelTurn", {})
                    parts = model_turn.get("parts", [])

                    for part in parts:
                        # Audio chunk from examiner
                        if "inlineData" in part:
                            inline = part["inlineData"]
                            yield {
                                "action": "audio_chunk",
                                "data": inline.get("data", ""),
                                "mime_type": inline.get("mimeType", "audio/pcm;rate=24000"),
                            }

                        # Text transcript from examiner if returned in parts
                        if "text" in part:
                            examiner_text = part["text"]
                            self.record_transcript("examiner", examiner_text)
                            yield {
                                "action": "transcript",
                                "role": "examiner",
                                "text": examiner_text,
                            }

                    # Output transcription from examiner
                    if "outputTranscription" in server_content:
                        trans = server_content["outputTranscription"]
                        text = trans.get("text", "") if isinstance(trans, dict) else str(trans)
                        if text:
                            self.record_transcript("examiner", text)
                            yield {
                                "action": "transcript",
                                "role": "examiner",
                                "text": text,
                            }

                    # Input transcription from candidate if provided
                    if "inputTranscription" in server_content:
                        itrans = server_content["inputTranscription"]
                        itext = itrans.get("text", "") if isinstance(itrans, dict) else str(itrans)
                        if itext:
                            self.record_transcript("candidate", itext)
                            yield {
                                "action": "transcript",
                                "role": "candidate",
                                "text": itext,
                            }

                    # Interruption detection (student spoke over examiner)
                    if server_content.get("interrupted"):
                        yield {"action": "interrupted"}

                    # Turn complete
                    if server_content.get("turnComplete"):
                        yield {
                            "action": "turn_change",
                            "turn": "student",
                            "ai_state": "listening",
                        }

        except websockets.exceptions.ConnectionClosed:
            logger.info("gemini_live_ws_closed", session_id=str(self.session_id))
        except Exception as exc:
            logger.warning("gemini_live_stream_error", error=str(exc))
        finally:
            self._is_connected = False

    async def close(self) -> None:
        """Cleanly close Gemini Live WebSocket."""
        self._is_connected = False
        if self.ws:
            try:
                await self.ws.close()
            except Exception:
                pass
            self.ws = None


class GeminiSpeakingEvaluator(SpeakingEvaluationProvider):
    """Post-session oral evaluation provider powered by Gemini."""

    def __init__(self) -> None:
        self._fallback_provider = MockSpeakingProvider()

    async def evaluate_session(
        self,
        topic: str,
        level: str = "B2",
        duration_seconds: int = 1500,
        transcript: str | None = None,
    ) -> EvaluationResult:
        """Evaluate spoken session transcript against official TEF CEFR criteria."""
        api_key = settings.GEMINI_API_KEY
        if not api_key or not transcript or len(transcript.strip()) < 40:
            logger.info("gemini_eval_fallback_used", reason="No key or insufficient transcript")
            return await self._fallback_provider.evaluate_session(
                topic=topic,
                level=level,
                duration_seconds=duration_seconds,
                transcript=transcript,
            )

        model = settings.GEMINI_EVAL_MODEL
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

        eval_prompt = f"""Tu es un jury expert officiel d'évaluation pour le TEF (Test d'Évaluation de Français).
Analyse rigoureusement cette transcription complète d'une épreuve orale :

CONTEXTE DE L'ÉPREUVE :
- Sujet : {topic}
- Niveau cible visé : {level}
- Durée de l'échange : {duration_seconds // 60} minutes

TRANSCRIPTION DE L'ÉCHANGE :
{transcript}

CRITÈRES D'ÉVALUATION TEF (CEFR) :
1. Compréhension et traitement de la consigne (prise d'info ou argumentation).
2. Lexique : variété, pertinence, précision du vocabulaire et des collocations.
3. Morphosyntaxe : exactitude grammaticale, temps et modes (subjonctif, conditionnel), structures complexes.
4. Cohérence et organisation : connecteurs logiques, progression des idées, pertinence des relances ou réfutations.
5. Aisance communicative : réactivité, adaptation au registre (vouvoiement en Section A, tutoiement en Section B).

Renvoie UNIQUEMENT un objet JSON valide et strict respectant scrupuleusement ce schéma :
{{
  "estimated_level": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
  "fluency": <note de 0.0 à 100.0>,
  "vocabulary": <note de 0.0 à 100.0>,
  "grammar": <note de 0.0 à 100.0>,
  "coherence": <note de 0.0 à 100.0>,
  "pronunciation": <note de 0.0 à 100.0>,
  "overall_score": <note de 0.0 à 100.0>,
  "strengths": ["Point fort 1 rédigé en français avec exemple", "Point fort 2", "Point fort 3"],
  "weaknesses": ["Axe d'amélioration 1 avec erreur observée", "Axe d'amélioration 2"],
  "recommendations": ["Recommandation concrète 1 pour le TEF", "Recommandation concrète 2", "Recommandation concrète 3"],
  "detailed_feedback": "Bilan global personnalisé et constructif en français (3 à 5 phrases)."
}}
"""

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    url,
                    json={
                        "contents": [{"parts": [{"text": eval_prompt}]}],
                        "generationConfig": {
                            "responseMimeType": "application/json",
                            "temperature": 0.2,
                        },
                    },
                )
                resp.raise_for_status()
                data = resp.json()

                raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(raw_text)

                return EvaluationResult(
                    estimated_level=parsed.get("estimated_level", level),
                    fluency=float(parsed.get("fluency", 75.0)),
                    vocabulary=float(parsed.get("vocabulary", 75.0)),
                    grammar=float(parsed.get("grammar", 75.0)),
                    coherence=float(parsed.get("coherence", 75.0)),
                    pronunciation=float(parsed.get("pronunciation", 75.0)),
                    overall_score=float(parsed.get("overall_score", 75.0)),
                    strengths=parsed.get("strengths", []),
                    weaknesses=parsed.get("weaknesses", []),
                    recommendations=parsed.get("recommendations", []),
                    detailed_feedback=parsed.get("detailed_feedback"),
                    is_official_tef=False,
                    skill_breakdowns={
                        "speaking_fluency": float(parsed.get("fluency", 75.0)),
                        "speaking_vocabulary": float(parsed.get("vocabulary", 75.0)),
                        "speaking_grammar": float(parsed.get("grammar", 75.0)),
                        "speaking_coherence": float(parsed.get("coherence", 75.0)),
                        "speaking_pronunciation": float(parsed.get("pronunciation", 75.0)),
                    },
                )

        except Exception as exc:
            logger.error("gemini_evaluation_failed", error=str(exc))
            return await self._fallback_provider.evaluate_session(
                topic=topic,
                level=level,
                duration_seconds=duration_seconds,
                transcript=transcript,
            )
