# Real-Time Architecture: FastAPI vs. Redis vs. WebSocket vs. WebRTC

This document clarifies the clear boundaries and separation of concerns across the real-time communications stack of the TEF platform.

---

## 1. Architectural Separation Matrix

| Layer | Technology | Primary Role | Latency Profile | Authoritative? |
| :--- | :--- | :--- | :--- | :--- |
| **REST API** | FastAPI / PostgreSQL | System of Record, Queue Entry/Exit, Invitation Lifecycle, Session Persistence, Safety Moderation | 15–50 ms | **Authoritative** (PostgreSQL) |
| **Ephemeral Cache** | Redis 7.4 | Presence Tracking (Heartbeat 60s TTL), Queue Caching, Distributed Mutex Locks (`SET NX EX`) | < 2 ms | **Ephemeral** |
| **Signaling** | FastAPI WebSockets | Peer Exchange: Session Offers, Answers, and ICE Candidates | 20–80 ms | Authoritative for Room Access |
| **Media Transport** | WebRTC (P2P Mesh) | Direct Peer-to-Peer Live Audio (Opus codec, SRTP/DTLS) | 30–120 ms | Ephemeral Voice Data |

---

## 2. Flow of a Practice Session

```
[ Student A ]                               [ Student B ]
     │                                           │
     ├────── 1. POST /practice/queue/join ──────┤
     │       (FastAPI + Redis Presence)          │
     │                                           │
     ├────── 2. POST /practice/requests ────────>│
     │       (Invitation sent with 60s TTL)      │
     │                                           │
     │<───── 3. POST /requests/{id}/accept ──────┤
     │       (FastAPI creates 25-minute session) │
     │                                           │
     ├────── 4. Connect WebSocket /ws/{room_id} ─┤
     │       (Bearer JWT Auth & Room Check)      │
     │                                           │
     ├────── 5. SDP Offer / Answer Signaling ───┤
     │       (Over WebSocket - Audio Only)       │
     │                                           │
     ═══════ 6. WebRTC P2P Audio Stream ═════════
     │       (Direct Audio via Opus / SRTP)      │
     │       (Zero Audio through Server)         │
     │                                           │
     ├────── 7. 25-minute Timer Closes Room ─────┤
     │       (Status: COMPLETED / EXPIRED)       │
     ▼                                           ▼
```

---

## 3. Strict Audio-Only Enforcement

### Client-Side Guarantees (`usePracticeWebRTC.ts`)
1. **Media Stream Constraints**:
   ```typescript
   navigator.mediaDevices.getUserMedia({
     audio: {
       echoCancellation: true,
       noiseSuppression: true,
       autoGainControl: true,
     },
     video: false, // Strictly disabled
   });
   ```
2. **Track Assertion**: Immediately inspects acquired tracks; if any track kind is `"video"`, it is stopped and discarded.
3. **Offer / Answer Constraints**:
   ```typescript
   pc.createOffer({
     offerToReceiveAudio: true,
     offerToReceiveVideo: false,
   });
   ```

### Server-Side Signaling Inspection (`router.py`)
All WebSocket signaling frames pass through strict validation:
1. Validated against `PracticeSignalingEnvelope`.
2. Inspects SDP strings during `"offer"` and `"answer"` actions.
3. **Rejection Rule**: If any active video media line is present:
   ```python
   for line in sdp.splitlines():
       if line.startswith("m=video") and not line.startswith("m=video 0"):
           # Reject frame immediately with error notice
           await websocket.send_json({
               "action": "error",
               "message": "Audio-only room: Video tracks are strictly prohibited.",
           })
   ```

---

## 4. Scalability & Operational Guarantees

1. **Zero Media Server Overhead**:
   - Because students connect peer-to-peer using STUN/TURN traversal, the FastAPI backend processes lightweight JSON signaling messages only (~1 KB per negotiation).
   - A single backend instance can support thousands of simultaneous practice rooms without CPU audio transcoding overhead.
2. **Failure Recovery & Disconnects**:
   - If a student closes their browser, Redis presence TTL expires within 60 seconds.
   - Background Celery tasks automatically sweep abandoned sessions and expire unjoined rooms.
3. **Privacy & Contact Protection**:
   - The signaling channel relays opaque connection IDs (`conn_...`) and French pseudonyms (`Voyageur #482`).
   - Real email addresses and database UUIDs are never published over the wire.
