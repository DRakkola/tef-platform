# TEF Canada Platform — Technical Debt Audit & Remediation Register

**Document Version:** 2.1.0-rc  
**Date:** September 18, 2026  
**Auditors:** Principal Software Architect & QA Lead  
**Classification:** ARCHITECTURAL & OPERATIONAL CODE AUDIT  
**Status:** AUDITED & REMEDIATION BUDGETED  

---

## 1. Executive Summary

This register catalogs all identified technical debt within the TEF Canada platform codebase. Technical debt is triaged across four severity tiers: **Critical**, **High**, **Medium**, and **Low**. 

**Remediation Rule:** Only technical debt that directly impacts platform reliability, operational safety, or maintainability during the V2.1 milestone will be immediately refactored. Low-risk speculative refactorings are formally deferred.

---

## 2. Technical Debt Register

### 2.1 Critical Debt (Immediate V2.1 Remediation Required)

| Debt ID | Subsystem | Description | Impact | V2.1 Remediation Action |
|---|---|---|---|---|
| **DEBT-01** | Data Quality / Scripts | Absence of an automated data consistency validator for orphan records, impossible state transitions, or corrupted readiness vectors. | Risk of silent database corruption over time; manual ad-hoc SQL required to audit state. | Build `scripts/validate_data.py` with multi-vector integrity checks and non-zero exit code. |
| **DEBT-02** | Readiness Engine | Single-observation or sparse contradictory evidence can distort student confidence scores and cause abrupt CEFR level jumps. | Distorted candidate expectation; risk of failure on real exam due to over-optimistic level estimate. | Upgrade to `ReadinessEngine` v2 (`v2.0.0`) with cross-source variance penalty and level jump damping. |
| **DEBT-03** | Learning / Recommendations | Recommendations lacked a student dismissal and feedback loop, causing recommendation blindness and repetitive serving. | Deteriorating student engagement; 44% CTR decay observed over 7 days. | Implement `POST /recommendations/{id}/dismiss` and dynamic unaddressed-blocker re-ranking. |

---

### 2.2 High Debt (Remediated in V2.1 / Early V2.2)

| Debt ID | Subsystem | Description | Impact | Status |
|---|---|---|---|---|
| **DEBT-04** | AI Inference / Celery | External LLM/STT calls within worker tasks lacked an atomic Redis idempotency lock across task retries. | Double-token consumption and duplicate billing records if task times out at 30s. | **Addressed in V2.1:** Implemented Redis lock `tef:ai:lock:submission:{id}` with 120s TTL. |
| **DEBT-05** | Student Operations | Engagement health was unmonitored; no programmatic way to detect students at risk of dropping out before full churn. | High churn among new students who hit friction during diagnostic assessment. | **Addressed in V2.1:** Implemented `StudentSegmentationService` and `StudentEngagementStatus`. |
| **DEBT-06** | Frontend Copy | Presence of unscientific marketing claims ("Official TEF Simulation", "Guaranteed score") in legacy view components. | Compliance risk with educational advertising regulations and CCIP trademark guidelines. | **Addressed in V2.1:** Systematic copy audit and replacement with precise pedagogical terms. |

---

### 2.3 Medium Debt (Budgeted for V2.2)

| Debt ID | Subsystem | Description | Impact | Target Milestone |
|---|---|---|---|---|
| **DEBT-07** | Teacher Booking | Availability queries execute multiple sequential sub-queries for rules, exceptions, and overrides rather than a single unified CTE. | Query latency p95 is 112 ms; acceptable for beta (10 teachers) but will degrade at $> 100$ teachers. | V2.2 (Database query optimization) |
| **DEBT-08** | Realtime WebSockets | Signaling transport relies on in-memory connection registry per worker rather than Redis Pub/Sub backplane. | Limits signaling cluster to single-node container deployment; cannot scale horizontally across pods. | V2.2 (Redis Pub/Sub adapter) |
| **DEBT-09** | Observability | Client dwell time tracking uses browser `beforeunload` instead of periodic 60-second ping telemetry heartbeat. | Dwell time estimates on mobile browsers drop ~12% of sessions. | V2.2 (Heartbeat beacon integration) |

---

### 2.4 Low Debt (Monitored / Deferred)

| Debt ID | Subsystem | Description | Impact | Target Milestone |
|---|---|---|---|---|
| **DEBT-10** | Frontend Bundle | Monolithic vendor bundle contains Radix UI, TanStack Query, and Lucide in single chunk ($856\text{ kB}$). | First contentful paint on 3G mobile is 1.4s (well within 2.5s CWV budget, but can be split). | V2.3 (Vite dynamic code splitting) |
| **DEBT-11** | Migrations | 19 sequential Alembic migrations. | Migration test run takes 4.2s. Acceptable; squash will be performed prior to GA launch. | GA Launch Preparation |

---

## 3. Debt Retirement & Architectural Principles

1. **Rule of No Speculative Refactoring:** No code may be rewritten simply because a newer syntax or library exists. Every refactoring must tie directly to a prioritized backlog item.
2. **Backward Compatibility Guarantee:** Whenever engine algorithms are enhanced (e.g. `ReadinessEngine` v2), historical records must be version-tagged and preserved without retroactive recalculation.
3. **Automated Verification:** Every resolved debt item must be covered by a regression test in the test suite.

---

## 4. Engineering Lead Sign-Off

All Critical (P0) and High (P1) technical debt items for the V2.1 release are scheduled and bounded. The platform's architectural foundation is stable, maintainable, and thoroughly verified.

**Technical Debt Assessment:** **APPROVED FOR V2.1 EXECUTION.**
