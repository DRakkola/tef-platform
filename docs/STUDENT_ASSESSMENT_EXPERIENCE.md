# Production-Grade Student Assessment Experience

## Overview

The student-facing assessment experience in the TEF platform is designed to provide high-fidelity, standardized simulation conditions for the TEF (Test d'Évaluation de Français) examination. It enforces strict server-authoritative integrity, anti-cheating mechanisms, network interruption resilience, debounced autosave with stale write protection, and an automated learning loop connecting assessment mistakes to targeted practice exercises.

---

## 1. Student Journey Architecture

The complete student learning lifecycle operates in a closed loop:

```
+-----------------------------------------------------------------------------------------------+
|                                    STUDENT USER JOURNEY                                       |
+-----------------------------------------------------------------------------------------------+
|                                                                                               |
|   1. Discover & Inspect                                                                       |
|      /assessments  -------->  /assessments/:id                                                |
|      (Published Catalog)      (Exam Rules, Format, Instructions, Server Timer Warning)        |
|                                         |                                                     |
|                                         v                                                     |
|   2. Exam Session Initialized                                                                 |
|      POST /api/v1/assessments/:id/attempts                                                    |
|      (Locks active AssessmentVersion, freezes expires_at = now + duration)                    |
|                                         |                                                     |
|                                         v                                                     |
|   3. Distraction-Free Exam Runner                                                             |
|      /attempts/:id                                                                            |
|      - Display-only server-synced countdown timer                                             |
|      - Debounced autosave (PUT /attempts/:id/answers/:q_id with client_timestamp)             |
|      - Network offline/reconnect event listener + GET /attempts/:id/state sync                |
|      - Linear & palette grid question navigation                                              |
|                                         |                                                     |
|                                         v                                                     |
|   4. Finalized & Graded                                                                       |
|      POST /api/v1/attempts/:id/submit (or auto-finalization upon expires_at)                   |
|                                         |                                                     |
|                                         v                                                     |
|   5. Results & Remediation                                                                    |
|      /attempts/:id/results                                                                    |
|      - Estimated CEFR Level (with mandatory official certification disclaimer)                |
|      - Overall score & sub-skill performance breakdown                                        |
|      - Strengths & prioritary axes for improvement                                            |
|      - Mistake analysis with pedagogical rules & explanations                                 |
|      - Deterministic exercise recommendations                                                 |
|                                         |                                                     |
|                                         v                                                     |
|   6. Targeted Practice Drill                                                                  |
|      /exercises/:id  -------->  /dashboard                                                    |
|      (Instant evaluation)       (Updated student mastery score & progress metrics)            |
|                                                                                               |
+-----------------------------------------------------------------------------------------------+
```

---

## 2. Server-Authoritative Integrity Guarantees

### A. Timer Authority
- Attempt expiration is computed strictly on the backend when the attempt is initialized:
  $$\text{expires\_at} = \text{started\_at} + \text{duration\_seconds}$$
- The client countdown timer is **strictly display-only**.
- Any attempt to submit answers (`PUT /attempts/:id/answers/:question_id`) or submit the attempt (`POST /attempts/:id/submit`) after `now > expires_at` is rejected with `ATTEMPT_EXPIRED`. The attempt is automatically transitioned to `AttemptStatus.EXPIRED` and graded based on all answers recorded before expiration.

### B. Anti-Cheating & Content Concealment
- When an assessment is delivered to a student (`GET /api/v1/assessments/:id` or `/api/v1/attempts/:id`):
  - Correct answer indicators (`is_correct`) are stripped from question options.
  - Explanations (`explanation`) are set to `None`.
  - Content review notes and internal drafting metadata are hidden.
- Explanations and correct answers are revealed **only** via `GET /api/v1/attempts/:id/results` after the attempt is finalized (`submitted` or `expired`).

### C. Version Snapshotting
- When a student begins an attempt, it locks to the active `assessment_version_id`.
- Any subsequent modifications, republishing, or archiving in the Content Studio by administrators will not mutate in-flight or historical attempts. The attempt evaluates against the exact snapshot version it was initiated under.

### D. Stale-Write Protection
- When autosaving an answer (`PUT /api/v1/attempts/:id/answers/:question_id`), the client provides an ISO-8601 `client_timestamp`.
- If a subsequent network packet arrives out of order or after a newer selection has already been saved, the server verifies timestamps and discards stale writes.

### E. Idempotent & Concurrency-Safe Finalization
- Submission is guarded with database transaction row locks (`with_for_update`).
- Subsequent or concurrent calls to `POST /api/v1/attempts/:id/submit` are idempotent and safely return the existing computed results.

---

## 3. Post-Submission Feedback & Legal Compliance

### A. Official Certification Disclaimer
In strict compliance with trademark and regulatory standards, all estimated CEFR performance ratings are accompanied by the official disclaimer:
> *"Ce résultat constitue une estimation indicative de performance basée sur notre algorithme de simulation. Il ne s'agit en aucun cas d'une attestation ou certification officielle TEF délivrée par la CCI Paris Île-de-France."*

### B. Educational Explanations for Mistakes
Each mistake logged in the database and displayed on the results screen includes:
- The question prompt and point value.
- The student's recorded answer.
- The expected correct answer.
- The pedagogical explanation detailing the underlying grammar rule, syntactic principle, or reading inference.

### C. Targeted Remediation Loop
- Submitting an assessment evaluates weakest skills using the `SkillEngine`.
- The `RecommendationEngine` generates targeted `Exercise` recommendations linking directly to practice drills (`/exercises/:id`).
- Completing a practice drill updates the student's mastery profile in real time, visible on the student dashboard (`/dashboard`).

---

## 4. Test Verification Suite

| Test Suite | Location | Passing Count | Key Invariants Verified |
| :--- | :--- | :--- | :--- |
| **Student Assessment Flow** | `apps/api/tests/test_student_assessment_flow.py` | 9 / 9 | Discovery, anti-cheating concealment, timer expiration, stale writes, student RBAC isolation, grading, recommendations, and dashboard reflection. |
| **Assessment Core Engine** | `apps/api/tests/test_assessments.py` | 13 / 13 | Idempotent answers, concurrent submissions, scoring algorithm, timer enforcement. |
| **Content Studio Lifecycle** | `apps/api/tests/test_content_studio.py` | 9 / 9 | Published versioning, snapshot immutability, fail-closed validation. |
| **Frontend Web Test Suite** | `apps/web/tests/StudentAssessmentJourney.test.tsx` | 5 / 5 | List catalog, instructions briefing, taking runner, timer countdown, autosave status, results view, and exercises catalog. |
| **Frontend Production Build** | `apps/web` (`pnpm build`) | Clean (0 errors) | TypeScript strict type checking (`verbatimModuleSyntax: true`). |
