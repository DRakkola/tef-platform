# Verification & Test Coverage Matrix

This matrix maps all core platform domains and operational compliance requirements to their automated test suites, scripts, and verification artifacts.

---

## 1. Automated Test Suite Matrix

| Domain / Operational Requirement | Test File / Automation | Test Count | Key Invariants Verified |
|:---|:---|:---:|:---|
| **Security & Cryptography** | `tests/test_security_hardening.py`<br>`tests/test_auth.py` | 38 | Argon2id password hashing, timing-safe comparison, JWT revocation, CSP/HSTS headers, body size limits (5MB), brute-force lockout, rate limiting. |
| **Production Configuration** | `tests/test_production_readiness.py` | 7 | Strict startup rejection of default secrets, short keys (< 32 chars), default database/redis passwords, and localhost CORS in production/staging. |
| **Storage & Upload Defense** | `tests/test_storage.py` | 13 | Magic byte inspection, binary MIME-sniffing against file forgery, path traversal rejection, size caps, presigned URL generation. |
| **Assessments & Evaluation** | `tests/test_assessments.py`<br>`tests/test_learning.py` | 32 | Single-choice and multi-choice scoring, server timer expiration, CLB level estimation, CEFR progression, weakness deficit calculation. |
| **Writing Assessment & Autosave** | `tests/test_writing.py` | 9 | French examination word counting, live draft autosaves, monotonic revision numbers, stale-write rejection, MinIO essay persistence. |
| **Speaking & WebRTC Signaling** | `tests/test_speaking.py` | 8 | Signaling state transitions, session timeboxing, audio-only constraints, AI evaluation scoring. |
| **Practice Pool Peer Matching** | `tests/test_practice_pool.py` | 14 | Redis presence tracking, queue state machine, paired session orchestration, dual-session concurrency defense. |
| **Teacher Bookings & Availability** | `tests/test_teachers.py`<br>`tests/test_bookings.py` | 18 | Availability rules, weekly schedules, slot collision prevention (`FOR UPDATE`), cancellation workflows. |
| **Billing, Monetization & Ledger** | `tests/test_billing.py` | 35 | Stripe/PayPal webhooks, double-entry financial ledger balance, credit consumption atomicity, platform commission calculation, refunds. |
| **Privacy, GDPR & Retention** | `tests/test_privacy.py` | 5 | Right to be forgotten (PII scrubbing + 7-year statutory ledger retention), portable data export, Celery draft pruning (> 7d), audit IP truncation (> 90d). |
| **Operational Feature Flags** | `tests/test_feature_flags.py` | 5 | Redis-backed kill switches, 503 feature-disabled dependencies, public status flags, admin mutation audit events, support ticket submissions. |
| **Web Frontend (React/Vite)** | `apps/web/tests/*.test.tsx` | 29 | Assessment taking timer & autosave, Practice Pool UI, Billing upgrade modal, Admin Content Studio, Student progress charts. |
| **Total Automated Tests** | **All Suites** | **228 Tests** | **100% Passing Rate (199 Backend + 29 Frontend)** |

---

## 2. Standalone Verification & Operational Scripts

| Script Name | Location | Operational Purpose | Exit Code Contract |
|:---|:---|:---|:---:|
| **Content Integrity Validator** | `scripts/validate_content.py` | Pre-deployment inspection of published assessments, options, and writing tasks. | `0` = Clean<br>`1` = Broken Content |
| **Backup & Restore Test** | `scripts/test_backup_restore.py` | Live verification of PostgreSQL dump/restore into test DB and MinIO checksum validation. | `0` = 100% Restored<br>`1` = Hash Mismatch |
| **Post-Deploy Smoke Test** | `scripts/smoke_test.py` | Validates `/health/live`, `/health/ready`, `/metrics`, `/status`, and `/system/flags`. | `0` = Healthy<br>`1` = Degraded |
| **Concurrency Load Test** | `scripts/load_test.py` | Simulates 170 concurrent workers (100 students, 50 pool, 20 teachers) measuring p50/p95 latencies. | `0` = Finished |
| **End-to-End Student Journey** | `scripts/test_student_journey.py` | Simulates complete user onboarding, diagnostic exam, grading, recommendations, and dashboard. | `0` = Journey Success |
| **PostgreSQL Backup Script** | `scripts/backup_postgres.py` | Automated `pg_dump` with SHA-256 manifest and 14-day retention rotation. | `0` = Success |
| **PostgreSQL Restore Script** | `scripts/restore_postgres.py` | Restores database snapshot with checksum integrity validation. | `0` = Success |
| **MinIO Backup Script** | `scripts/backup_minio.py` | Bucket object snapshot with cryptographic checksum manifest. | `0` = Success |
| **MinIO Restore Script** | `scripts/restore_minio.py` | Restores object storage state from snapshot directory. | `0` = Success |
