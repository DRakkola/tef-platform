# TEF Canada Platform — V2 Prioritized Product & Reliability Backlog

**Document Version:** 2.1.0-rc  
**Date:** September 18, 2026  
**Engineering Lead:** Principal Engineer & Product Engineering Lead  
**Prioritization Framework:** RICE (Reach, Impact, Confidence, Effort) + Weighted Learning Impact & Operational Severity  
**Status:** APPROVED FOR V2.1 EXECUTION  

---

## 1. Executive Prioritization Summary

Based on the empirical findings documented in [`docs/BETA_DATA_ANALYSIS.md`](file:///C:/Users/MSI/Documents/tef-platform/docs/BETA_DATA_ANALYSIS.md), the platform's top 10 user-facing and operational problems have been identified and ranked. Arbitrary vanity features have been excluded; every backlog item is anchored in observed student drop-offs, support tickets, or infrastructure telemetry.

```
+----+-----------------------------------------------------+----------+-----------+----------------+
| Rank| Problem Summary                                     | Severity | Frequency | Target Release |
+----+-----------------------------------------------------+----------+-----------+----------------+
| 01 | Diagnostic Assessment Drop-Off (Time to First Value) | Critical | High      | V2.1 (P0)      |
| 02 | Recommendation Blindness & Stale Exercise Serving   | High     | High      | V2.1 (P0)      |
| 03 | Sparse-Evidence Readiness Overconfidence (v1 Engine)| High     | Medium    | V2.1 (P0)      |
| 04 | Absence of Deterministic At-Risk Engagement Signals | High     | Medium    | V2.1 (P0)      |
| 05 | Peer Practice Pool Off-Peak Liquidity Deficit       | Medium   | High      | V2.1 (P1)      |
| 06 | Unscientific Copy Claims Across Onboarding/Results  | High     | Low       | V2.1 (P0)      |
| 07 | Lack of Automated Data Integrity Validation CLI      | Critical | Low       | V2.1 (P0)      |
| 08 | AI Writing Correction Latency & Retry Storm Risk    | Medium   | Low       | V2.1 (P1)      |
| 09 | Mobile Viewport Friction in Essay & Audio Capture   | Medium   | Medium    | V2.1 (P1)      |
| 10 | Teacher Calendar Slot & Timezone Mismatch Friction  | Medium   | Low       | V2.1 (P1)      |
+----+-----------------------------------------------------+----------+-----------+----------------+
```

---

## 2. Detailed Problem Breakdowns

### Item 01: Diagnostic Assessment Drop-Off (Time to First Value)
- **Problem:** New students face a 54-minute, 60-question marathon diagnostic assessment immediately following registration before receiving *any* personalized level assessment or tailored recommendations.
- **Evidence:** 28 students started the diagnostic, but 9 abandoned mid-way (32.1% drop-off). Funnel conversion drops from 90.3% to 67.9% between step 4 and step 5.
- **Impact:** High learner attrition; students who drop out during the diagnostic have an 80% 7-day churn rate.
- **Root Cause:** All-or-nothing assessment structure requiring full completion of Compréhension Écrite and Compréhension Orale before computing initial CEFR level estimates.
- **Proposed Solution:** Implement an accelerated Diagnostic Mini-Check option (10 high-discriminant adaptive questions) that delivers an initial preliminary CEFR band and unlocks targeted exercises within 8 minutes. Full simulation tests remain available for comprehensive certification readiness.
- **Expected Outcome:** Diagnostic completion rate increases from 67.9% to $\ge 85.0\%$; time-to-first-recommendation drops from 54 minutes to $< 10$ minutes.
- **Risk:** Low; does not alter scoring methodology of full tests.
- **Effort:** Medium (4 engineering days).
- **Dependencies:** `AssessmentSection`, `ReadinessEngine`.

---

### Item 02: Recommendation Blindness & Stale Exercise Serving
- **Problem:** Students are repeatedly served the exact same recommended exercise cards even after they have mastered related sub-skills or chosen to skip them.
- **Evidence:** 8 students reported recommendation fatigue. Click-through rate on recommendation cards fell from 58% on Day 1 to 24% by Day 7. 0 dismissal actions existed in v1.
- **Impact:** Reduces student trust in the platform's adaptive intelligence and increases study abandonment.
- **Root Cause:** Recommendation query in `learning/service.py` only checked if an exercise was completed, not whether the user actively dismissed it or if recent skill evidence resolved the underlying blocker.
- **Proposed Solution:** Introduce `POST /api/v1/learning/recommendations/{id}/dismiss` and `POST /api/v1/learning/recommendations/{id}/feedback`. Exclude dismissed items for 14 days and dynamically re-rank based on unresolved blocking competencies.
- **Expected Outcome:** Recommendation CTR recovers to $\ge 50.0\%$; average exercises completed per active student increases by 25%.
- **Risk:** Low.
- **Effort:** Low (1.5 engineering days).
- **Dependencies:** `Recommendation` model, `LearningRouter`.

---

### Item 03: Sparse-Evidence Readiness Overconfidence (v1 Engine)
- **Problem:** The v1 Readiness Engine generated high-confidence estimates and abrupt CEFR level jumps based on single extreme scores or contradictory evidence sources.
- **Evidence:** A student who achieved 90% on a short reading exercise and 35% on an assessment section was classified as B2 with 0.68 confidence because time-decay gave overwhelming weight to the newer exercise.
- **Impact:** False sense of exam readiness; risk of candidate failure on real TEF Canada exam.
- **Root Cause:** Absence of variance penalty across divergent data sources and lack of level-jump rate limiting.
- **Proposed Solution:** Upgrade to `ReadinessEngine` v2 (`CALCULATION_VERSION="v2.0.0"`). Add cross-source variance penalty ($\sigma > 20.0$) and damp level jumps to a maximum of 1 sub-band per 24-hour window unless verified by a full simulation test. Keep historical v1 snapshots immutable.
- **Expected Outcome:** Zero spurious level jumps; calibrated confidence scores reflect true empirical variance.
- **Risk:** Low; historical records preserved.
- **Effort:** Medium (2 engineering days).
- **Dependencies:** `ReadinessEngine`, `readiness_models.py`.

---

### Item 04: Absence of Deterministic At-Risk Engagement Signals
- **Problem:** Operations and Support have no programmatic visibility into which beta students are slipping into inactivity until they churn completely.
- **Evidence:** 7 students who registered in Week 1 did not return after Day 3; no automated re-engagement prompt was triggered.
- **Impact:** Lower weekly active retention (D7 retention currently 41.2% across the full cohort).
- **Root Cause:** No background computation of engagement risk or activity decay.
- **Proposed Solution:** Implement `StudentSegmentationService` defining 8 deterministic segments and `StudentEngagementStatus` (`on_track`, `needs_reengagement`, `at_risk`, `dormant`, `new`). Trigger controlled re-engagement notifications with 48-hour cooldowns.
- **Expected Outcome:** At-risk student identification lag reduced from 7 days to $< 24$ hours; D7 retention improves from 41.2% to $\ge 60.0\%$.
- **Risk:** Low; notifications governed by strict cooldowns and opt-outs.
- **Effort:** Medium (2.5 engineering days).
- **Dependencies:** `StudentProfile`, `NotificationService`.

---

### Item 05: Peer Practice Pool Off-Peak Liquidity Deficit
- **Problem:** Students queuing for peer oral practice outside of European/Canadian peak hours (16:00–22:00 UTC) experience wait times exceeding 4 minutes, resulting in queue abandonment.
- **Evidence:** 5 off-peak queue joins resulted in timeout abandonment. Off-peak match completion rate is 20% vs 85% during peak.
- **Impact:** Frustration for students in Asian or Australian timezones preparing for TEF Canada immigration.
- **Root Cause:** Pure synchronous peer-to-peer matchmaking requires concurrent active users with identical target CEFR levels.
- **Proposed Solution:** Add asynchronous oral exchange ("Audio Voice Notes") fallback when queue wait time exceeds 90 seconds, allowing students to exchange structured prompts asynchronously if no peer is immediately available.
- **Expected Outcome:** Session completion rate across all timezones increases from 58.3% to $\ge 80.0\%$.
- **Risk:** Medium; requires UI signaling of async mode.
- **Effort:** High (5 engineering days).
- **Dependencies:** `PracticePoolService`, `WebRTC transport`.

---

### Item 06: Unscientific Copy Claims Across Onboarding and Results
- **Problem:** Several frontend interfaces use unverified marketing phrases like "Official TEF Simulation", "Guaranteed Pass", or "AI knows your level".
- **Evidence:** Audit of `AssessmentsListPage.tsx` and `ReadinessPage.tsx` identified 4 instances of ambiguous phrasing.
- **Impact:** Legal/compliance liability and erosion of academic credibility with certified TEF examiners.
- **Root Cause:** Legacy draft copy from early prototype design.
- **Proposed Solution:** Systematically scrub frontend copy. Replace with precise pedagogical descriptions: "Simulated practice test", "Estimated CEFR level", "Observed test performance".
- **Expected Outcome:** 100% compliance with CCIP trademark and Canadian educational advertising standards.
- **Risk:** Zero.
- **Effort:** Low (1 engineering day).
- **Dependencies:** Frontend components.

---

### Item 07: Lack of Automated Data Integrity Validation CLI
- **Problem:** There is no dedicated automated CLI tool to verify relational referential integrity, orphaned attempts, or state machine violations on live or staging databases.
- **Evidence:** During staging stress testing, 2 orphaned `AttemptAnswer` records were created when an HTTP connection terminated abruptly during autosave.
- **Impact:** Risk of silent data corruption or invalid analytics aggregation over long-running cohorts.
- **Root Cause:** Database foreign keys have `ON DELETE CASCADE`, but application-level state consistency checks were not unified into an operational CLI.
- **Proposed Solution:** Create `scripts/validate_data.py` (with `--dry-run` and `--fix` options) validating 8 critical integrity vectors and exiting non-zero if critical defects are found.
- **Expected Outcome:** 100% verifiable data hygiene prior to cohort promotions.
- **Risk:** Zero.
- **Effort:** Medium (2 engineering days).
- **Dependencies:** SQLAlchemy models, CLI harness.

---

### Item 08: AI Writing Correction Latency & Retry Storm Risk
- **Problem:** Writing corrections make direct synchronous external inference calls inside the Celery worker task without idempotent request fencing, risking double token consumption on timeout retries.
- **Evidence:** 1 Celery task retried after a 30s upstream latency spike, submitting the same essay twice and consuming 3,400 unnecessary prompt tokens (\$0.07 waste).
- **Impact:** Escalating AI inference costs and potential duplicate evaluation records.
- **Root Cause:** Missing submission-level lock and soft timeout handling in `tasks.py`.
- **Proposed Solution:** Add Redis-backed idempotency lock (`tef:ai:lock:submission:{id}`) and extend soft timeout to 60s with exponential backoff.
- **Expected Outcome:** Zero duplicate inference executions; AI cost per submission stays strictly bounded.
- **Risk:** Low.
- **Effort:** Low (1 engineering day).
- **Dependencies:** Celery tasks, Redis client.

---

### Item 09: Mobile Viewport Friction in Essay Editor & Audio Capture
- **Problem:** Mobile students (38% of beta visits) encounter layout clipping in the full-screen essay editor and lack visual waveform feedback during oral recording on iOS Safari.
- **Evidence:** 2 support tickets filed specifically regarding microphone capture button obscuring the prompt on mobile screens.
- **Impact:** Mobile assessment completion rate is 48% vs 76% on desktop.
- **Root Cause:** CSS fixed heights (`h-screen`) and desktop-centric two-column layout without stacked responsive breakpoints.
- **Proposed Solution:** Refactor `WritingTakingPage.tsx` and `SpeakingTakingPage.tsx` with responsive flex-col layouts, sticky bottom navigation, and explicit mobile tap targets ($\ge 44\text{px}$).
- **Expected Outcome:** Mobile completion rate reaches parity ($\ge 70.0\%$) with desktop.
- **Risk:** Low.
- **Effort:** Medium (2.5 engineering days).
- **Dependencies:** Frontend responsive styling.

---

### Item 10: Teacher Calendar Slot & Timezone Mismatch Friction
- **Problem:** Students booking certified teachers in different geographic regions have difficulty coordinating times due to subtle timezone display confusion in the slot selection calendar.
- **Evidence:** 2 of 18 bookings were cancelled because the student assumed the slot was in Eastern Time (ET) rather than UTC/Paris time.
- **Impact:** Wasted teacher availability slots and student scheduling frustration.
- **Root Cause:** The calendar displayed times in the teacher's configured timezone rather than dynamically auto-converting to the student's local browser timezone.
- **Proposed Solution:** Update teacher availability query and frontend calendar to automatically project slots into the student's detected local timezone with an explicit timezone confirmation badge.
- **Expected Outcome:** Booking cancellation rate drops from 11.1% to $< 2.0\%$.
- **Risk:** Low.
- **Effort:** Low (1.5 engineering days).
- **Dependencies:** `slot_service.py`, `TeacherBookingPage.tsx`.

---

## 3. Backlog Execution Roadmap

- **Milestone V2.1 (Current Execution):**
  - Fix Items 01, 02, 03, 04, 06, 07 (All P0 items + critical P1s).
- **Milestone V2.2 (Subsequent Iteration):**
  - Implement Items 05, 08, 09, 10.
