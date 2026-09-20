# TEF Canada Platform — Release Notes: Version 2.1.0-rc (Release Candidate)

**Release Version:** V2.1.0-rc  
**Release Date:** September 18, 2026  
**Release Lead:** Principal Engineer & Product Engineering Lead  
**Target Environments:** Staging & Production Private Beta  
**Target Cohort:** Cohort 1 & 2 (10–50 Students, 5–15 Certified Teachers)  

---

## 1. Release Overview

Version 2.1.0-rc is a **data-driven optimization milestone** informed by empirical findings from the Private Beta phase. This release implements critical user-impact fixes, eliminates drop-off friction along the activation and first-value path, improves recommendation quality, upgrades the Readiness Engine to version `v2.0.0`, introduces deterministic student segmentation, and deploys comprehensive data integrity validation tools.

### Core Architectural Principles Preserved:
- **Zero Architecture Churn:** Monolithic architecture retained; no microservices introduced.
- **Zero-PII Compliance:** Hashed invitation tokens, sanitized logs, and ephemeral peer identities strictly maintained.
- **Self-Hosted Boundaries:** System of record remains on self-hosted PostgreSQL 16 and MinIO object storage.
- **Backward Compatibility:** All historical assessments, student drafts, and readiness snapshots are preserved without retroactive mutation.

---

## 2. Detailed Changelog

### 2.1 Added
- **Deterministic Student Segmentation (`StudentSegmentationService`)**:
  - Automatically categorizes learners into 8 objective behavioral segments: `new_student`, `activated_student`, `returning_student`, `at_risk_student`, `premium_student`, `teacher_engaged_student`, `ai_heavy_user`, `practice_pool_user`.
- **Deterministic `StudentEngagementStatus`**:
  - Programmatic engagement health indicator (`on_track`, `needs_reengagement`, `at_risk`, `dormant`, `new`) based on objective activity intervals, pending corrections, and unresolved blocking competencies. Non-judgmental terminology enforced.
- **Recommendation Dismissal & Adaptive Feedback Loop**:
  - Added `POST /api/v1/learning/recommendations/{id}/dismiss` and `POST /api/v1/learning/recommendations/{id}/feedback`.
  - Dynamically hides dismissed recommendations for 14 days and re-ranks available exercises prioritizing unaddressed blocking competencies.
- **Controlled Re-Engagement Notification Pipeline (`ReengagementService`)**:
  - Delivers targeted return nudges (pending recommendations, completed writing corrections ready, reassessment reminders) with a mandatory 48-hour cooldown per student.
- **Data Consistency & Hygiene Validator CLI (`scripts/validate_data.py`)**:
  - Comprehensive automated integrity checker verifying orphaned attempts, invalid status transitions, duplicate activity logs, and billing entitlement consistency. Includes `--dry-run` and `--fix` modes.

### 2.2 Changed & Calibrated
- **Readiness Engine Upgrade (`ReadinessEngine` v2.0.0)**:
  - Upgraded `CALCULATION_VERSION` from `"v1.0.0"` to `"v2.0.0"`.
  - Added cross-source variance penalty ($\sigma > 20.0$) preventing false certainty when assessments and exercises diverge.
  - Added level jump damping (maximum 1 sub-band shift per 24 hours unless verified by a full simulation test).
  - Historical snapshots retain immutable `v1.0.0` version tagging.
- **Product Copy Audit & Academic Alignment**:
  - Systematically scrubbed misleading or unscientific promises across the frontend, replacing terms like "Official TEF Score" or "Guaranteed Pass" with accurate pedagogical terms: "Simulated TEF practice", "Estimated CEFR level", and "Observed test performance".

### 2.3 Fixed & Hardened
- **AI Task Retry Lock**:
  - Added Redis idempotency lock (`tef:ai:lock:submission:{id}`) with 120s TTL preventing duplicate inference calls and token waste during Celery worker retries.
- **Teacher Booking Timezone Auto-Projection**:
  - Frontend calendar now automatically detects and projects available teacher slots into the student's local browser timezone with explicit timezone confirmation badges.
- **Mobile Viewport & Autosave Visibility**:
  - Fixed full-screen essay editor layout on mobile viewports and added a prominent real-time autosave status pill.

---

## 3. Database Schema & Migration Status

- **Current Revision Head:** `0019_beta_cohorts_and_invitations` (alembic chain verified).
- **Total Tables Managed:** 83 relational tables in PostgreSQL `Base.metadata`.
- **Zero Destructive Schema Changes:** All V2.1 features operate within the existing schema or leverage flexible JSON payload fields without requiring downtime migrations.

---

## 4. Before & After Metrics Tracking Matrix

| Operational / Product Metric | Beta Baseline (v1) | Target V2.1 Milestone Goal | Measurement Method | Post-Release Status |
|---|---|---|---|---|
| **Diagnostic Completion Rate** | 67.9% | $\ge 85.0\%$ | Funnel step 4 $\to$ 5 in `AnalyticsService` | Tracking (Baseline: 67.9%) |
| **Time to First Recommendation** | 54 minutes | $< 10$ minutes | Registration timestamp $\to$ first recommendation view | Tracking |
| **Recommendation CTR** | 44.1% (Decaying to 24%)| $\ge 50.0\%$ (Sustained) | Clicks / Impressions via `telemetry.ts` | Tracking |
| **D7 Student Retention** | 41.2% | $\ge 60.0\%$ | Weekly retention cohort matrix | Tracking (Baseline: 41.2%) |
| **Teacher Booking Cancellation Rate** | 11.1% (Timezone error) | $< 2.0\%$ | Cancelled bookings / Total bookings | Tracking (Baseline: 11.1%) |
| **Duplicate AI Invocations** | 1 occurrence / 68 | **0 (Zero)** | Redis lock telemetry | **0 (Verified)** |
| **Data Integrity Defects** | Unmonitored | **0 (Zero)** | `scripts/validate_data.py` non-zero exit code | **0 (Verified)** |

---

## 5. Verification & Test Evidence

- **Backend Pytest Suite:** 234 existing tests + new V2 optimization tests passing (100%).
- **Frontend Vitest Suite:** 39 tests passing (100%).
- **Web Production Bundle:** Clean build with Vite and TypeScript (`tsc -b && vite build`), 0 compilation errors.
- **Curriculum Integrity Run:** All 32 curriculum items verified via `scripts/validate_content.py` (0 defects).

---

## 6. Release Approval

This release candidate meets all engineering, security, and pedagogical criteria for staging deployment and pilot cohort onboarding.

**Release Status:** **APPROVED FOR V2.1 STAGING ROLLOUT.**
