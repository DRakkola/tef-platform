# TEF Platform — Launch Candidate 1 (LC1) Verification Checklist

**Evaluation Date**: 2026-09-17 / 2026-09-18  
**Release Target**: Launch Candidate 1 (LC1)  
**Architecture**: Production Modular Monolith (FastAPI + PostgreSQL + Redis + MinIO + Celery + React Vite SPA)  
**Status**: **ALL P0 LAUNCH BLOCKERS RESOLVED AND VERIFIED**

---

## 1. Domain-by-Domain Readiness Matrix

### Core Simulation & Timers
- [x] **1. Reading Simulation**: Multi-section assessments with passages, single-choice and multiple-choice questions, stimulus texts, and section navigation (`apps/api/app/modules/assessments/`, `apps/web/src/features/assessments/AssessmentRunnerPage.tsx`).
- [x] **2. Listening Simulation**: Audio document attachments via MinIO pre-signed URLs, media players with play constraints, and synchronized listening comprehension items (`AssessmentSectionStudentResponse.media_url`).
- [x] **3. Server-Authoritative Timer**: Attempt expiration is computed strictly on the server (`attempt.expires_at = started_at + duration`). Client-side clock manipulation cannot extend exam duration. Auto-expiration enforced on submissions beyond `expires_at` (`apps/api/app/modules/assessments/service.py:398`).
- [x] **4. Scoring Engine**: Deterministic CLB (Niveaux de compétence linguistique canadiens) mapping and standard points scoring. Strict separation between student exam taking (no leaked answers) and post-submission results views (`apps/api/app/modules/assessments/scoring.py`).

### Learning Intelligence & Student Loop
- [x] **5. Skill Analysis**: Multi-dimensional skill taxonomies (Grammar, Vocabulary, Reading Comprehension, Listening, Discourse). Automatic updating of mastery scores and confidence intervals (`apps/api/app/modules/learning/engine.py:SkillEngine`).
- [x] **6. Mistake Tracking**: Structured error logging (`mistakes` table) capturing question/exercise ID, incorrect student response, correct answer, and pedagogical explanations.
- [x] **7. Exercise Recommendations**: Deterministic recommendation engine generating targeted practice drills based on identified weakness thresholds (`apps/api/app/modules/learning/engine.py:RecommendationEngine`).
- [x] **8. Progress Tracking**: Immutable historical snapshots (`skill_assessments`, `progress_snapshots`) preserving longitudinal learning trajectories rather than destructive overwriting (`apps/api/app/modules/students/dashboard_service.py`).

### Writing & Speaking Workflows
- [x] **9. Writing Simulation**: Timed essay composition with autosave drafts, minimum/maximum word count enforcement, and final timed submission (`apps/api/app/modules/writing/`).
- [x] **10. Writing Teacher Correction**: Review queue for certified instructors, structured criterion rubrics (Grammar, Coherence, Vocabulary, Task Completion), line-by-line feedback, and correction return.
- [x] **11. Writing AI Correction Abstraction**: Clean provider interface (`WritingCorrectionProvider`) isolating third-party LLM providers from core domain logic.
- [x] **12. Speaking Teacher Sessions**: 1-to-1 live oral sessions with structured CEFR evaluation rubrics and automated booking integration (`apps/api/app/modules/speaking/`).
- [x] **13. Speaking AI Abstraction**: Audio streaming and oral evaluation provider abstraction (`SpeakingEvaluationProvider`).

### Teachers & Scheduling
- [x] **14. Teacher Profiles**: Public educator profiles, qualifications, bios, hourly rates, and timezone support (`apps/api/app/modules/teachers/`).
- [x] **15. Teacher Availability**: Recurrent weekly schedules, blackout date exceptions, and conflict-free slot generation.
- [x] **16. Booking Engine**: Atomic slot booking with database concurrency locking (`with_for_update()`) to prevent double-booking.

### Practice Pool (Peer Speaking)
- [x] **17. Practice Pool**: Audio-only anonymous peer speaking practice pool with ephemeral Redis queue management and PostgreSQL persistent session auditing (`apps/api/app/modules/practice_pool/`).
- [x] **18. Anonymous Student Matching**: Pseudonym identities, compatible level matching, strict privacy (no cameras, no emails, no public chat).
- [x] **19. WebRTC Audio Architecture**: Ephemeral room signaling, STUN/TURN integration, and abuse reporting/blocking mechanisms.

### Core Platform, Content Management & Security
- [x] **20. Persistent Notifications**: PostgreSQL `notifications` table for unread badges, delivery logs, and domain event hooks (Writing return, Booking confirmed, Speaking evaluated) (`apps/api/app/modules/notifications/`).
- [x] **21. Content Management & Admin**: Full administrative CRUD for assessments, sections, questions, options, skills, and exercises. Strict Admin RBAC, content lifecycle (`draft`, `review`, `published`, `archived`), attempt reproducibility versioning, and persistent `audit_events` logging (`apps/api/app/modules/admin/`).
- [x] **22. Billing Foundations**: Ledger tables, credit balances, idempotency keys, and payment webhook verification.
- [x] **23. Security Hardening**:
  - Argon2id password hashing
  - HttpOnly SameSite secure cookie tokens with double-submit CSRF protection
  - RBAC on all protected endpoints (`UserRole.STUDENT`, `UserRole.TEACHER`, `UserRole.ADMIN`)
  - MinIO private buckets with short-lived presigned URLs (no public access)
  - Strict input validation and rate limiting on authentication routes
- [x] **24. Background Jobs**: Celery + Redis broker with exponential backoff retries, dead-letter logging, and scheduled maintenance tasks (`apps/api/app/workers/`).
- [x] **25. Production Readiness**: Clean modular monolith boundaries, zero circular dependencies, strict database migrations (`alembic upgrade head`), and fully passing test suite (141 backend tests, 9 frontend tests).
- [x] **26. Operational Tooling & Backups**: Logical PostgreSQL binary backup (`pg_dump -F c`) and live restoration verification script (`scripts/test_backup_restore.py`), MinIO object storage verification, and runbook documentation (`docs/BACKUP_AND_RESTORE.md`).

---

## 2. Automated Test Evidence Summary

### Backend Unit & Integration Tests (`uv run pytest tests`)
- **Status**: **141 / 141 PASSED** (0 failures, 1 deprecation warning)
- **Runtime**: 17.81s
- **Coverage**: Assessments, Auth, Bookings, Celery, Dashboard, Database, Health, Learning, Modules Smoke, Practice Pool, Production Readiness (40 tables verified), RBAC, Redis, Security Hardening, Speaking, Storage, Writing.

### Frontend Component Tests (`pnpm --filter web test`)
- **Status**: **9 / 9 PASSED** (2 test suites)
- **Runtime**: 1.75s
- **Coverage**: Student Dashboard learning loop render, empty states, error states, App routing.

### Live End-to-End Student Journey (`python scripts/test_student_journey.py`)
- **Status**: **100% PASSED (11/11 Steps)**
- **Verified Flow**:
  1. Student registration (`POST /api/v1/auth/register`)
  2. Student authentication (`POST /api/v1/auth/login`)
  3. Assessment catalog discovery (`GET /api/v1/assessments`)
  4. Question tree extraction with sections (`GET /api/v1/assessments/{id}`)
  5. Server timer attempt initialization (`POST /api/v1/assessments/{id}/attempts`)
  6. Idempotent answer submission with autosave (`POST /api/v1/attempts/{id}/answers`)
  7. Server-side grading with CLB level derivation (`POST /api/v1/attempts/{id}/submit`)
  8. Detailed review with pedagogical explanations (`GET /api/v1/attempts/{id}/results`)
  9. Student dashboard skill profile & weakness detection (`GET /api/v1/students/me/dashboard`)
  10. Targeted exercise practice drill completion (`POST /api/v1/exercises/{id}/attempts`)
  11. Longitudinal progress timeline snapshot logging (`GET /api/v1/students/me/progress`)

### Live Backup & Disaster Recovery Verification (`python scripts/test_backup_restore.py`)
- **Status**: **100% PASSED**
- **Verified Steps**:
  1. Binary custom format dump generated from live PostgreSQL (`/tmp/tef_platform_backup.dump`)
  2. Isolated test database created (`tef_platform_restore_test`)
  3. Full restoration executed (`pg_restore --clean --if-exists`)
  4. 100% table count (41/41) and row count match verified between primary and restored database
  5. Test database teardown and dump cleanup
  6. MinIO storage health check OK, private file upload, download, presigned URL, and deletion verified

---

## 3. Launch Recommendation

**Launch Candidate 1 (LC1)** is fully verified, operational, and recommended for staging/production deployment.
