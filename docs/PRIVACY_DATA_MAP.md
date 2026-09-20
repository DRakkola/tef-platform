# Privacy Architecture & Data Classification Map

This document establishes the comprehensive data mapping, access boundaries, retention horizons, and deletion policies across all data categories stored within the TEF Platform.

---

## 1. Data Classification Inventory

| Data Category | Specific Elements | Purpose | Storage Location | Retention Horizon | Access Restriction | Deletion / Anonymization Policy |
|:---|:---|:---|:---|:---|:---|:---|
| **Account Credentials** | Email, Argon2id password hash, role, active status | Identity, authentication, and RBAC | PostgreSQL (`users`) | Duration of account lifecycle | Account owner, Admin | **Anonymized**: Email replaced with `deleted_{uuid}@anonymized.local`, hash cleared |
| **Student Profile** | Target CEFR/NCLC level, exam target date | Study planning and personalization | PostgreSQL (`student_profiles`) | Duration of account lifecycle | Account owner, assigned teachers | **Hard Delete** upon account deletion |
| **Assessment Attempts** | Selected answers, section timestamps, calculated scores | Skill assessment & diagnostic testing | PostgreSQL (`attempts`, `attempt_answers`, `attempt_scores`) | Account lifecycle + 180 days | Student, Admin | Anonymized; aggregated scores preserved for curriculum calibration |
| **Writing Drafts & Revisions** | In-progress draft revisions, autosave timestamps | Exam resilience and stale-write defense | PostgreSQL (`writing_draft_revisions`) | Attempt expiration + 7 days | Student | **Hard Delete** after attempt submitted or expired |
| **Writing Submissions** | Submitted essay text, word counts, timestamps | Teacher/AI correction and evaluation | MinIO (`writing/{id}.txt`) & PostgreSQL (`writing_submissions`) | Account lifecycle + 1 year | Student, assigned Teacher, Evaluator | **Hard Delete** from MinIO; DB row metadata retained anonymized |
| **Speaking Audio Recordings** | WebM/WAV student audio files | AI scoring and human teacher evaluation | MinIO (`audio/speaking/{id}.webm`) | **30 days** maximum post-session | Student, correcting Teacher | **Automated Celery deletion** after 30 days |
| **Audio Transcripts** | STT transcription of speaking responses | Pedagogical feedback and error highlights | PostgreSQL (`speaking_evaluations`) | Account lifecycle + 90 days | Student, correcting Teacher | Anonymized on account deletion |
| **AI Evaluations** | LLM feedback tokens, subskill scores, recommendations | Formative feedback and learning roadmap | PostgreSQL (`writing_corrections`, `ai_usage_records`) | Account lifecycle + 180 days | Student, Admin | Disassociated from user UUID |
| **Teacher Bookings** | Slot start/end, timezone, meeting URL | Scheduling 1-on-1 speaking coaching | PostgreSQL (`teacher_bookings`) | 1 year (for dispute resolution) | Booking Student, Teacher, Admin | Student reference anonymized |
| **Billing & Financial Ledger**| Cents amounts, ledger type, provider transaction ID, order number | Double-entry accounting & tax compliance | PostgreSQL (`orders`, `billing_ledger_entries`, `teacher_earnings`) | **7 years** (Mandatory Legal / Tax Requirement) | Financial Admin, Auditor | **STRICTLY RETAINED**: User PII replaced with anonymous ID; ledger rows are immutable |
| **Security Audit Logs** | IP address, user agent, actor ID, action type | Tamper detection, forensic security audits | PostgreSQL (`audit_events`) | **1 year** | Security Admin | IP addresses truncated/anonymized after 90 days |

---

## 2. Audio Minimization & Strict Retention

1. **Zero Indefinite Audio Retention**: Raw voice audio recordings recorded during speaking practice sessions are stored in private MinIO storage (`tef-private/audio/`) and automatically purged after **30 days** by the `cleanup_retention_artifacts` Celery background worker.
2. **Audio-Only Principle**: Video tracks are rejected at the WebRTC signaling negotiation layer; zero video files or camera data are ever ingested or stored.

---

## 3. Account Deletion Workflow (GDPR "Right to be Forgotten")

When a student executes an account deletion request via `DELETE /api/v1/students/me`:

1. **Authentication Re-Verification**: Student must provide their current password to confirm authorization.
2. **PII Scrubbing**:
   - `users.email` is scrambled to `deleted_<uuid>@anonymized.local`.
   - `users.password_hash` is cleared.
   - `users.is_active` is set to `False`.
   - Refresh tokens and active session JWTs are immediately revoked.
3. **Data Deletion**:
   - `student_profiles` row is hard-deleted.
   - Stored audio files and writing text in MinIO are deleted.
   - Open bookings in the future are cancelled.
4. **Mandatory Retentions (Tax & Legal Exemption)**:
   - `orders` and `billing_ledger_entries` are preserved with the anonymized UUID to satisfy statutory accounting obligations.
   - Security `audit_events` rows are preserved without personal identifying text.
