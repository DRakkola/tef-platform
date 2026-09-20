# TEF Canada Platform — Beta Cohort Retrospective Template

**Cohort Identifier:** [e.g., Cohorte Bêta Octobre 2026 - Alpha]  
**Evaluation Period:** [Start Date] to [End Date]  
**Meeting Date:** [Retrospective Session Date]  
**Participants:** Principal Engineer, Product Manager, Academic Lead, SRE Lead, Support Lead  
**Document Status:** [DRAFT / FINAL APPROVED]  

---

## 1. Cohort Executive Summary & Context

Provide a high-level 2–3 paragraph summary of the cohort's objectives, student profile mix (e.g., beginners vs. intermediate candidates aiming for Express Entry), teacher participation, and overall qualitative outcome.

- **Total Invitations Dispatched:** [Count]
- **Accepted / Registered Students:** [Count] ([% of dispatched])
- **Active Certified Teachers:** [Count]
- **Curriculum Scope Covered:** [e.g., Compréhension Écrite & Expression Écrite focus]

---

## 2. Quantitative Performance Scorecard

### 2.1 Funnel & Engagement Metrics

| Metric Category | Target KPI | Actual Cohort Result | Variance | Status |
|---|---|---|---|---|
| **Invitation Activation Rate** | $\ge 80.0\%$ | [Value]% | [$\pm$]% | [MET / MISSED] |
| **Onboarding Completion** | $\ge 90.0\%$ | [Value]% | [$\pm$]% | [MET / MISSED] |
| **Diagnostic Assessment Completion** | $\ge 75.0\%$ | [Value]% | [$\pm$]% | [MET / MISSED] |
| **Weekly Active Retention (D7)** | $\ge 65.0\%$ | [Value]% | [$\pm$]% | [MET / MISSED] |
| **Weekly Active Retention (D14)** | $\ge 50.0\%$ | [Value]% | [$\pm$]% | [MET / MISSED] |
| **Average Exercises Completed / Student** | $\ge 8.0$ | [Value] | [$\pm$] | [MET / MISSED] |
| **Writing Submissions / Student** | $\ge 2.0$ | [Value] | [$\pm$] | [MET / MISSED] |
| **Speaking Sessions / Student** | $\ge 2.0$ | [Value] | [$\pm$] | [MET / MISSED] |
| **Peer Practice Match Completion Rate** | $\ge 70.0\%$ | [Value]% | [$\pm$]% | [MET / MISSED] |

### 2.2 Pedagogical Outcomes & Score Progression

| Competency Dimension | Baseline Diagnostic (Avg) | Final Evaluation (Avg) | Mean Score Gain | % Achieving NCLC 7 (B2) Target |
|---|---|---|---|---|
| **Compréhension Écrite (CE)** | [Score] / 699 (B1) | [Score] / 699 (B2) | +[Points] pts | [Value]% |
| **Compréhension Orale (CO)** | [Score] / 699 (B1) | [Score] / 699 (B2) | +[Points] pts | [Value]% |
| **Expression Écrite (EE)** | [Score] / 450 (B1) | [Score] / 450 (B2) | +[Points] pts | [Value]% |
| **Expression Orale (EO)** | [Score] / 450 (B1) | [Score] / 450 (B2) | +[Points] pts | [Value]% |

### 2.3 Teacher Marketplace & Support

| Marketplace Metric | Target KPI | Actual Cohort Result | Status |
|---|---|---|---|
| **Teacher Booking Fulfillment Rate** | $\ge 95.0\%$ | [Value]% | [MET / MISSED] |
| **Teacher No-Show Rate** | $\le 2.0\%$ | [Value]% | [MET / MISSED] |
| **Average Teacher Rating** | $\ge 4.7$ / 5.0 | [Value] / 5.0 | [MET / MISSED] |
| **Support Tickets Filed / User** | $\le 0.5$ | [Value] | [MET / MISSED] |
| **P0/P1 Incident Count** | 0 | [Value] | [MET / MISSED] |

### 2.4 Infrastructure & AI Economics

| Economic / SRE Metric | Budget Ceiling | Actual Cohort Consumption | Variance |
|---|---|---|---|
| **Total AI Cost (USD)** | $\le \$250.00$ | \$[Value] | [$\pm$]\$ |
| **Average AI Spend per Active Student** | $\le \$5.00$ | \$[Value] | [$\pm$]\$ |
| **System Uptime SLA** | $\ge 99.5\%$ | [Value]% | [MET / MISSED] |
| **API Response Latency (p95)** | $\le 500\text{ ms}$ | [Value] ms | [MET / MISSED] |

---

## 3. Qualitative Feedback & Thematic Analysis

### 3.1 What Worked Exceptionally Well
- *Observation 1:* [e.g., Immediate feedback on writing tasks significantly boosted student confidence.]
- *Observation 2:* [e.g., Peer practice pool matchmaking had high praise for reducing speaking anxiety.]
- *Observation 3:* [e.g., Teacher booking workflow was seamless with zero double-booking occurrences.]

### 3.2 Key Friction Points & User Frustrations
- *Friction 1:* [e.g., Autosave indicator during long essay writing was too subtle; students feared losing progress.]
- *Friction 2:* [e.g., Microphone permissions prompt confused mobile browser users on iOS Safari.]
- *Friction 3:* [e.g., Some audio recordings had slight background echo affecting STT accuracy.]

---

## 4. Root Cause Analysis (5 Whys) for Critical Defects

*(Include this section for any P0, P1, or recurrent P2 issues experienced during the cohort).*

**Defect Description:** [e.g., User received HTTP 429 quota error despite having only performed 2 AI corrections.]

1. **Why did the user receive HTTP 429?**  
   The server returned `BETA_QUOTA_EXCEEDED` because the daily counter was 5.
2. **Why was the daily counter 5 if the user only submitted 2 tasks?**  
   Retried background jobs due to a 30-second gateway timeout incremented the counter multiple times.
3. **Why did the background job retry multiple times?**  
   The inference API took 32 seconds to respond during upstream peak, tripping the Celery task timeout.
4. **Why was the task timeout set to 30 seconds?**  
   Initial default configuration did not account for large multi-paragraph essay corrections.
5. **Systemic Root Cause:**  
   Quota increment was placed inside the task execution rather than atomically gated on user submission idempotency.

**Remediation:**  
Move quota reservation to idempotent submission start, and increase Celery task soft timeout to 60 seconds with exponential backoff.

---

## 5. Action Items & Roadmap Alignment

| Action Item | Area | Priority | Assignee | Target Release / Milestone |
|---|---|---|---|---|
| Increase AI writing Celery timeout to 60s & add idempotency key | Backend | P1 | @backend-lead | Beta Release 1.1 |
| Add explicit "Saved just now" badge on essay editor | Frontend | P2 | @frontend-lead | Beta Release 1.1 |
| Calibrate oral Section B rubric prompts with additional Canadian French idioms | Academic | P2 | @academic-lead | Curriculum Update 1.0.2 |
| Expand Postgres connection pool max_overflow to 20 for cohort 2 | SRE | P3 | @sre-oncall | Infrastructure Ops |

---

## 6. Graduation & Scaling Decision

Based on the quantitative metrics and qualitative review of this cohort:

- [ ] **HOLD:** Unresolved P0/P1 defects; run another pilot cohort at current capacity.
- [ ] **EXPAND BETA:** Metrics met; expand cohort capacity from 25 to 50 students.
- [ ] **GENERAL AVAILABILITY (GA):** All quality, reliability, and economic targets sustained across multiple cohorts.

**Final Decision:** **[SELECT ONE]**  
**Signed off by:**  
- Engineering Lead: __________________________  
- Product Lead: ______________________________  
- Academic Lead: _____________________________  
