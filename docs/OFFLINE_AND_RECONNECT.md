# Offline Resilience & Client Reconnection Architecture

This document specifies the resilience mechanisms across the TEF web client and backend API when handling intermittent network disconnects, latency spikes, and browser tab backgrounding.

---

## 1. Assessment & Writing Autosave Recovery

During timed assessments and writing practice, intermittent disconnects must never cause student work or exam time to be lost.

### 1.1 Dual-Tier Draft Persistence
1. **Local Tier (`localStorage`)**:
   - Every keystroke in the writing editor and every radio selection in mock exams is instantly committed to encrypted/structured browser `localStorage` keyed by `tef_draft_{attempt_id}`.
   - If the browser crashes, computer loses power, or tab closes, the editor automatically re-hydrates the latest draft upon page reload.
2. **Server Tier (Authoritative Remote Draft)**:
   - Client sends debounced draft autosaves (`PUT /api/v1/writing/attempts/{id}/draft`) every 5 seconds.
   - Stale-write defense: Each save carries a monotonically increasing `revision_number`. If a delayed save from an older tab arrives out of order, the server rejects it with `STALE_REVISION_REJECTED` (409) rather than overwriting newer content.

### 1.2 Authoritative Server Timer & Disconnect Handling
- **Server Timer Authority**: The server alone governs `expires_at = started_at + duration_seconds`.
- **Client Sync**: Client calculates remaining time via `(expires_at - now_server)`. When a student disconnects for 2 minutes and reconnects, their client re-syncs with server time without granting unfair extra time or prematurely failing the attempt.
- **Grace Period**: A 30-second network grace window allows submission packets delayed by mobile network handovers to be graded fairly.

---

## 2. WebSocket & Realtime Reconnection Strategy

Realtime connections (Practice Pool matching and WebRTC signaling) employ strict reconnection policies:

### 2.1 Jittered Exponential Backoff
When a WebSocket connection drops (`CloseEvent` or network drop):
- **Base delay**: 1,000ms
- **Max delay**: 30,000ms
- **Multiplier**: 1.5x
- **Jitter**: \(\pm 20\%\) randomized variance to prevent the "thundering herd" problem against the API servers.

```typescript
function calculateBackoff(attempt: number): number {
  const base = 1000 * Math.pow(1.5, attempt);
  const capped = Math.min(base, 30000);
  const jitter = capped * 0.2 * (Math.random() * 2 - 1);
  return Math.floor(capped + jitter);
}
```

### 2.2 Heartbeat & Ping/Pong Timeouts
- **Client Heartbeat**: The client sends a `ping` frame every 25 seconds.
- **Server Timeout**: If the server fails to receive a ping within 60 seconds, it closes the orphaned connection, frees Redis channel subscriptions, and marks presence as absent.

---

## 3. WebRTC Speaking Session Reconnection

In 1-on-1 teacher coaching and AI oral exams:
1. **ICE Disconnect Handling**: If WebRTC `iceConnectionState` shifts to `disconnected`, the browser waits 5 seconds for automatic ICE candidate renegotiation before declaring failure.
2. **Session Resumption**: If renegotiation fails, the client issues a `reconnect` signaling message over the WebSocket, generating a fresh SDP offer without ending the active database session.

---

## 4. Authentication Token Recovery

- **Token Lifecycle**: Short-lived access JWT (15-minute expiry) + long-lived HttpOnly refresh token (7-day expiry).
- **Silent Refresh Interceptor**: Axios/Fetch response interceptor catches `401 Unauthorized`. If token expired, it queues in-flight requests, calls `POST /api/v1/auth/refresh`, updates the Authorization header, and retries original requests transparently.
- **Offline Refresh Queue**: Requests that fail due to offline network errors are paused until the browser fires `window.addEventListener('online', ...)` before failing to the user.

---

## 5. Billing & Booking Idempotency Safeguards

To prevent double-billing during flaky networks:
- All checkout and booking mutations accept an `idempotency_key` header (UUIDv4).
- The backend caches results in Redis for 10 minutes (`tef:idempotency:{key}`).
- If a student taps "Pay" twice or a mobile network drops the initial response, the second request returns the cached confirmation with zero duplicated charges or double bookings.
