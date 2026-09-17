# TEF Platform — Launch Gap Analysis (Launch Candidate 1)

This document provides the exhaustive product and engineering gap audit against the original product requirements for the TEF Preparation Platform as it transitions to **Launch Candidate 1 (LC1)**.

---

## 1. Executive Summary & Priority Classification

- **P0 (Launch Blocker)**: Must be fully implemented, verified, and passing all quality gates before Launch Candidate 1 is released.
- **P1 (Required for Beta)**: Core product experiences and secondary management features required for public beta trial.
- **P2 (Post-Beta)**: Enhancements, external commercial integrations (Stripe, live third-party speech APIs), and enterprise marketplace tooling.

---

## 2. Comprehensive 26-Domain Audit Matrix

| # | Feature / Domain | Existing Implementation | Missing Implementation | Risk | Priority | Dependencies | Recommended Action |
|---|---|---|---|---|---|---|---|
| 1 | **Reading simulation** | Reusable assessment engine, sections, questions, options, server timer | Interactive student runner page in frontend | Medium | **P0** | Web UI, API `/assessments` | Implement `/assessments/:id` exam runner with timer and option submission. |
| 2 | **Listening simulation** | Question audio URLs, MinIO S3 streaming | Audio player widget in frontend runner, presigned media streaming verification | Medium | **P0** | MinIO, Assessments runner | Add HTML5 audio player in assessment runner fetching presigned audio stream. |
| 3 | **Server-authoritative timer** | Server-calculated expiration, expiry check on retrieval & submission | Concurrency race condition testing during last second | Low | **P0** | Assessments, Writing | Verified in backend; ensure client timer accurately syncs with server remaining seconds. |
| 4 | **Scoring** | Standard points, penalties, CEFR level estimation (A1–C2) | None (fully functional in `assessments/scoring.py`) | Low | **P1** | Assessments | Maintain scoring engine test coverage. |
| 5 | **Skill analysis** | Skill taxonomy, EMA rolling mastery, confidence scoring in `learning/` | Visual breakdown component in student results view | Low | **P1** | Dashboard | Connect results screen to skill metrics. |
| 6 | **Mistake tracking** | Automated `Mistake` logging on wrong answers in `learning/` | Mistake review screen for student drill practice | Low | **P1** | Learning | Link mistakes to drill recommendations. |
| 7 | **Exercise recommendations** | Deterministic `RecommendationEngine` linking weak skills to drills | Interactive exercise drill page in frontend | Medium | **P0** | Exercises, Web UI | Implement `/exercises/:id` practice page with immediate answer feedback. |
| 8 | **Progress tracking** | Immutable `SkillAssessment` snapshots, `/learning/progress` API | Detailed historical timeline chart in frontend | Low | **P1** | Progress API | Render historical trajectory on Dashboard. |
| 9 | **Writing simulation** | Timed essay attempts, draft autosave, word counter, MinIO upload | Frontend writing editor view with live word count | Medium | **P0** | Writing API, MinIO | Implement `/writing/:id` interactive editor with countdown and submit button. |
| 10 | **Writing teacher correction** | Teacher queue, assignment, review state, scoring & feedback | Teacher review portal view in frontend | Medium | **P1** | Writing API | Implement teacher submission queue interface. |
| 11 | **Writing AI correction abstraction** | Protocol abstraction and `MockCorrectionProvider` | Real LLM asynchronous Celery task integration | Low | **P2** | Celery, OpenAI/Anthropic API | Post-beta: connect production LLM provider. |
| 12 | **Speaking teacher sessions** | Session lifecycle, 25m timer, WebRTC signaling, evaluation | Frontend WebRTC call room view | High | **P1** | WebRTC, WebSocket | Add WebRTC peer audio room UI in frontend. |
| 13 | **Speaking AI abstraction** | Speech transcription and evaluation providers with mock | Live STT/TTS engine connection | Low | **P2** | Celery, Speech API | Post-beta: connect live Whisper/Google STT. |
| 14 | **Teacher profiles** | Hourly rate, bio, teaching levels, verification status | Teacher directory browse page in frontend | Low | **P1** | Teachers API | Add `/teachers` browse page. |
| 15 | **Teacher availability** | Weekly recurring rules, specific calendar exceptions, slot generator | Calendar date-picker view in frontend | Low | **P1** | Teachers API | Connect slot selector to booking modal. |
| 16 | **Booking** | Pessimistic locking (`with_for_update`) to prevent double-booking | Student booking checkout & confirmation modal | Medium | **P1** | Bookings API | Implement booking flow modal with notifications. |
| 17 | **Practice Pool** | Matchmaking queue, PostgreSQL sessions, abuse reporting | Matchmaking lobby and queue modal in frontend | Medium | **P1** | Redis, WebSocket | Provide practice pool audio lobby. |
| 18 | **Anonymous student matching** | Pseudonym generator, level/language filtering, no PII sharing | None (fully implemented on backend) | Low | **P1** | Practice Pool | Connect to frontend matching view. |
| 19 | **WebRTC/audio architecture** | P2P audio, authenticated WebSocket signaling, no audio through HTTP | None (backend signaling validated) | Low | **P1** | WebSocket | Use native browser `RTCPeerConnection`. |
| 20 | **Notifications** | In-memory only! No database table, no domain event bus | Database-backed `notifications` table, internal notification service abstraction | High | **P0** | DB, Alembic, Events | **Create PostgreSQL table, domain event bus, and persistent notification service.** |
| 21 | **Admin/content management** | Single stub endpoint `/admin/system-overview` | Full CRUD for Assessments, Questions, Skills, Exercises, Tasks; lifecycle; media assets; audit logs | High | **P0** | Admin RBAC, Storage, DB | **Build comprehensive Admin Content Management API, media manager, lifecycle versioning, and audit logging.** |
| 22 | **Billing foundations** | Subscription tiers, credit balances, ledger entries | Stripe/payment gateway webhook integration | Low | **P2** | Stripe API | Post-beta: connect real payment provider. |
| 23 | **Security** | Argon2id, CSRF, CSP, HSTS, Rate Limiting, JTI Revocation, BOLA checks | Admin RBAC enforcement on all content endpoints | High | **P0** | Auth, RBAC | Verify RBAC and permission checks on all newly added routes. |
| 24 | **Observability** | Structlog JSON logging, correlation IDs, readiness/liveness checks | Audit logging of all sensitive operations, redact secrets | Medium | **P0** | Logging, Core | Ensure zero secret leakage, audit event recording. |
| 25 | **Testing** | Backend pytest suite, frontend Vitest suite (all passing) | End-to-end (E2E) automated coverage for complete student journey | High | **P0** | Web, API, Playwright/E2E | **Build comprehensive E2E student journey test runner.** |
| 26 | **Docker/production readiness** | Clean multi-stage containers, docker-compose orchestration | Tested and proven backup/restore procedures for DB and MinIO | High | **P0** | Postgres, MinIO, Scripts | **Implement and execute automated backup & restore test script.** |

---

## 3. P0 Launch Critical Workstreams

### A. Content Management & Versioning
- **Lifecycle states**: `draft`, `review`, `published`, `archived`.
- **Reproducibility**: Once an assessment is published, student attempts lock the `assessment_version`. Any substantive edits create a new version, preserving the integrity of historical grading and attempt reviews.
- **Media Asset Storage**: Upload listening passages and exam illustrations to MinIO with server-generated UUID keys and short-lived presigned URLs. Zero exposure of S3 credentials to the client.

### B. Admin RBAC & Audit Trail
- Every administrative route requires `UserRole.ADMIN`.
- System records immutable `audit_events` entries capturing:
  - Actor ID, action type, target entity, timestamp, IP address, and payload diff.

### C. Persistent Notifications
- Replace in-memory dictionaries with a dedicated PostgreSQL `notifications` table.
- Domain events:
  - `writing.correction_ready`: Notifies student when essay review is complete.
  - `booking.confirmed`: Notifies student and teacher of confirmed slot.
  - `booking.cancelled`: Notifies counterparty of cancellation.
  - `speaking.evaluation_ready`: Notifies student of CEFR evaluation.
  - `practice_pool.matched`: Notifies both parties of live practice session.

### D. Complete Student Journey
- Seamless flow:
  1. Student registration & profile completion.
  2. Assessment selection & start (`/assessments/:id`).
  3. Timed answer submission with option persistence.
  4. Final grading & instant score display.
  5. Automatic skill decay/mastery updates and mistake logging.
  6. Personalized drill recommendation generation.
  7. Interactive exercise execution (`/exercises/:id`).
  8. Dashboard progress verification.

### E. Backup & Disaster Recovery Verification
- Automated logical PostgreSQL dump & drop-restore validation.
- Automated MinIO bucket mirror & restore verification.
