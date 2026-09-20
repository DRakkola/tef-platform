# Student Speaking Workspace & Real-Time Speaking Experience UX Specification & Architecture

## 1. Executive Summary & Product Purpose

The **Student Speaking Workspace** (`/speaking`, `/speaking/sessions/:sessionId`, `/speaking/:id`) is the dedicated real-time oral examination and practice environment for French oral production (TEF Canada / TEF IRN Expression Orale: Section A prise d'information formelle, Section B argumentation et conviction).

### Core Product Principles
1. **Audio is Primary (Zero-Video Invariant)**: The environment is strictly audio-only. There is **no camera requirement**, no video tiles, and no video conferencing clutter. The UI is calibrated to feel like an examination and pedagogical simulation workspace rather than a generic video meeting.
2. **Server-Authoritative Clock**: The exam duration (default 25 minutes) is owned strictly by the backend (`starts_at` and `expires_at`). Local timers count down synchronously with server drift compensation and handle tab backgrounding seamlessly.
3. **WebRTC Media Transport & WebSocket Signaling**: Real-time peer-to-peer audio flows via `RTCPeerConnection` with STUN candidates from `/api/v1/speaking/sessions/{id}` and signaling through `/api/v1/speaking/ws/{room_id}`. Live audio is never proxied through standard REST endpoints.
4. **Resilient State Machine**: Session transitions are modeled through an explicit state machine (`preparing`, `microphone_required`, `connecting`, `ready`, `listening`, `student_speaking`, `ai_speaking`, `teacher_speaking`, `transitioning`, `reconnecting`, `ending`, `submitted`, `failed`), preventing impossible states and race conditions.
5. **Calm, Distraction-Free Visual Direction**: Built on the TEF design system with a focused shell, subtle borders, high contrast typography, restrained surfaces, and clear visual state communication.
6. **Privacy & Telemetry**: Zero raw audio or transcript content is transmitted to analytics or telemetry.

---

## 2. Layout Architecture & Visual Hierarchy

The workspace operates in two primary modes:
1. **Launcher View (`/speaking`)**: Allows candidates to choose between TEF Section A (Prise d'information) and Section B (Argumentation), view recent/scheduled sessions, and launch a simulation.
2. **Active Speaking Workspace (`/speaking/sessions/:sessionId`)**: A distraction-free focused shell (`FocusedSpeakingShell`).

```
┌────────────────────────────────────────────────────────────────────────┐
│ FocusedSpeakingShell TopBar                                            │
│ [Speaking · IA/Prof]  Session Title • [Status] • [Micro] • [24:18] • [Quitter] │
├────────────────────────────────────────────────────────────────────────┤
│ [ReconnectingBanner] (when connection drops - non-blocking)            │
├────────────────────────────────────────────────────────────────────────┤
│ MAIN SPEAKING AREA (Centered, max-w-4xl):                              │
│                                                                        │
│ 1. SpeakingPrompt Card:                                                │
│    - Question 1 sur 2 • Niveau B2                                      │
│    - Scenario Topic & Context                                          │
│    - Consigne pour le candidat (Objective)                            │
│                                                                        │
│ 2. SpeakingTurnIndicator (AI Mode Only):                               │
│    - "L'examinateur parle..." vs. "À vous de parler · Micro actif"     │
│                                                                        │
│ 3. SpeakingParticipant Card:                                           │
│    - AI Mode: "Examinateur Virtuel TEF" • Status badge (À l'écoute,     │
│      En train de parler, En réflexion)                                 │
│    - Teacher Mode: Teacher name, credentials, online indicator         │
│                                                                        │
│ 4. SpeakingTranscript (Optional, Collapsible):                         │
│    - Non-dominant, readable transcript panel (if available)             │
│                                                                        │
│ 5. SpeakingControls:                                                   │
│    - AudioLevelIndicator (5-bar PCM volume confirmation)               │
│    - [Couper le micro] / [Microphone coupé] (Mute/Unmute)               │
│    - [Question suivante] (if multiple prompts)                         │
│    - [Terminer l'entretien] (Submit & evaluate)                        │
│    - [Quitter] (Leave confirmation dialog)                             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Real-Time State Transitions & State Machine

```
[Preparing / Mic Check]
        │
        ▼ (Microphone granted)
  [Connecting]
        │
        ▼ (WebSocket & WebRTC connected)
     [Ready]
   ┌────┴────────────────────────┐
   ▼                             ▼
(AI Mode)                  (Teacher Mode)
   │                             │
   ├─► [AI Speaking]             └─► [Teacher Conversation]
   │         │                              │
   ├─► [Student Speaking]                   │
   │                                        │
   └──────────┬─────────────────────────────┘
              │
              ▼ (Timer expired / Terminer clicked)
          [Ending]
              │
              ▼ (API completion & evaluation generation)
         [Submitted] ──► [SpeakingSessionComplete Screen]
```

### Race-Condition Safeguards
- **Leave during Reconnect**: Intentional leave immediately flags `isIntentionalLeave = true`, closes WebSocket, stops audio tracks, and closes RTCPeerConnection, preventing unwanted auto-reconnect.
- **Expiry during Reconnect**: Authoritative expiration closes media room and transitions workspace to `"submitted"` regardless of active reconnect attempts.

---

## 4. Evaluation & Score Reporting

Upon completion, `SpeakingSessionComplete` presents the standardized oral evaluation:
- **Estimated Level**: CEFR rating (`A1` to `C2`).
- **Score d'entraînement**: Overall score (`/100`).
- **Mandatory Disclaimer**: *"Score d'entraînement indicatif — Non officiel TEF. Seul le certificat officiel émis par la CCI Paris Île-de-France constitue un résultat officiel."*
- **5 Oral Competency Dimensions**:
  1. **Aisance & Débit** (Fluency)
  2. **Richesse du Vocabulaire** (Vocabulary)
  3. **Correction Morphosyntaxique** (Grammar)
  4. **Prononciation & Intonation** (Pronunciation)
  5. **Cohérence & Articulateurs Logiques** (Coherence)
- **Validated Strengths & Priority Improvement Axes**.

---

## 5. Privacy & Telemetry Safeguards

- **Zero Audio Telemetry**: Audio streams and audio buffers are **never** logged, cached, or transmitted to analytics.
- **Zero Transcript in Analytics**: Transcripts are treated as sensitive student data and excluded from all telemetry payloads.
- **Emitted High-Level Events**:
  - `speaking_opened`
  - `speaking_started`
  - `microphone_permission_denied`
  - `speaking_reconnect_started`
  - `speaking_reconnected`
  - `speaking_connection_failed`
  - `speaking_completed`
  - `speaking_abandoned`

---

## 6. Verification & Quality Assurance

| Test Vector | Status | Details |
|---|---|---|
| Speaking Workspace Tests | PASS (20/20) | `tests/SpeakingWorkspace.test.tsx` verifying timer, mic permissions, connection states, mute/unmute, participant rendering, AI turn-taking, leave modal, completion screen, and full integration flow |
| Full Web Test Suite | PASS (234/234) | 23 test files passing across the web application |
| Web Production Build | PASS (0 errors) | `tsc -b && vite build` built cleanly |
| Backend Pytest Suite | PASS (16/16) | `tests/test_speaking.py` passing |
| Content & Data Integrity | PASS (100%) | `validate_content.py` and `validate_data.py` verified with 0 defects |
