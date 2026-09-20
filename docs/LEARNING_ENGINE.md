# Student Progress, Skill Profile & Personalization Engine

## Overview

The TEF Learning Engine transforms historical student activity across all modalities (mock exam assessments, standalone exercises, teacher-reviewed writing corrections, and oral speaking sessions) into an evolving, deterministic, and persistent learning profile.

The system is designed to provide clear, actionable answers to six critical student questions:
1. **Where am I?** &rarr; Real-time estimated CEFR (A1–C2) and Canadian NCLC (3–10+) level ratings.
2. **What am I good at?** &rarr; Mastered competencies ($\ge 75\%$) with high statistical confidence.
3. **What am I weak at?** &rarr; Priority linguistic deficits ($< 65\%$) dragging down overall exam readiness.
4. **Am I improving?** &rarr; Trajectory tracking comparing recent performance against historical snapshots.
5. **What should I practice today?** &rarr; A personalized 4-part daily study plan with dynamic completion tracking.
6. **How far am I from my target?** &rarr; Target gap analysis measuring score delta, level step distance, and exam date urgency.

---

## 1. System Architecture

The engine adheres strictly to the modular monolith architecture:

```
+----------------------------------------------------------------------------------------------------+
|                                    STUDENT ACTIVITY PIPELINE                                       |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|   [Assessment Submit]      [Exercise Submit]      [Writing Graded]      [Oral Session Graded]     |
|            |                       |                      |                      |                 |
|            +-----------------------+----------------------+----------------------+                 |
|                                    |                                                               |
|                                    v                                                               |
|                 +--------------------------------------+                                           |
|                 |       LearningService Pipeline       |                                           |
|                 |  - Idempotency guard (submission_id) |                                           |
|                 |  - Activity event logging            |                                           |
|                 +--------------------------------------+                                           |
|                                    |                                                               |
|                                    v                                                               |
|                 +--------------------------------------+                                           |
|                 |             SkillEngine              |                                           |
|                 |  - Time-Decayed Bayesian EWMA        |                                           |
|                 |  - Confidence & Sample Calibration   |                                           |
|                 |  - Inactivity Decay Handler          |                                           |
|                 +--------------------------------------+                                           |
|                                    |                                                               |
|         +--------------------------+--------------------------+                                    |
|         |                          |                          |                                    |
|         v                          v                          v                                    |
|  +--------------+          +---------------+          +---------------+                            |
|  | TargetGap    |          | Strengths &   |          | DailyPlan     |                            |
|  | Service      |          | Weaknesses    |          | Service       |                            |
|  +--------------+          +---------------+          +---------------+                            |
|         |                          |                          |                                    |
|         +--------------------------+--------------------------+                                    |
|                                    |                                                               |
|                                    v                                                               |
|                 +--------------------------------------+                                           |
|                 |        RecommendationEngineV2        |                                           |
|                 |  - Priority Boost (+25 for Target)   |                                           |
|                 |  - 48h Cooldown on Completed         |                                           |
|                 |  - Lifecycle (active/done/dismissed) |                                           |
|                 +--------------------------------------+                                           |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. Skill Mastery Mathematics

All score and skill calculations are **100% deterministic**. No Large Language Model is ever invoked for core numerical scoring or level estimations.

### A. Time-Decay Weighted Bayesian Moving Average

When a student performs an evaluation (mock exam, exercise, or teacher correction) testing skill $s$, their rolling mastery $M_t$ is updated:

$$M_t = (1 - \alpha_t) \cdot M_{t-1} + \alpha_t \cdot S_t$$

Where:
- $S_t \in [0, 100]$ is the score achieved on the current event.
- $M_{t-1}$ is the previous rolling mastery (or prior $M_0 = 50.0\%$ for new students).
- $\alpha_t$ is the adaptive learning rate:

$$\alpha_t = \text{clamp}\left( \frac{w_{\text{source}}}{1 + n} \cdot \beta, \; 0.15, \; 0.60 \right)$$

- $n$ is the total number of evaluations completed for this skill.
- $w_{\text{source}}$ is the evaluation weight multiplier:
  - Mock Exam Attempt: $w = 1.2$
  - Standalone Exercise: $w = 1.0$
  - Teacher Writing Correction: $w = 1.1$
  - Teacher Oral Session: $w = 1.1$

### B. Statistical Confidence & Calibration State

A student's skill estimate is only considered stable once sufficient representative samples have been collected.

The statistical confidence $c \in [0, 1]$ is computed as:

$$c = \left(1 - e^{-n / 3}\right) \cdot \delta_{\text{diversity}}$$

Where:
- $\delta_{\text{diversity}} = 1.0 + 0.05 \cdot (\text{unique sources} - 1)$ rewards multi-modal cross-validation (e.g. practicing both exercises and full exams).
- **Calibration Threshold**: If $n < 2$ or $c < 0.25$, the skill is flagged with `insufficient_data = True` and label `"Calibration"`.
- Confidence categories:
  - $c < 0.25$: **Calibration** (low sample size, rolling estimate in progress)
  - $0.25 \le c < 0.50$: **Faible** (emerging baseline)
  - $0.50 \le c < 0.75$: **Moyenne** (reliable progress indicator)
  - $c \ge 0.75$: **Élevée** (high statistical certainty)

### C. Inactivity Decay

Knowledge fades without practice. If a skill has not been practiced for more than 14 days:

$$M_{\text{decayed}} = \max\left(30.0, \; M_t - \lambda_{\text{decay}} \cdot (\Delta d - 14)\right)$$

Where $\lambda_{\text{decay}} = 0.005 \times M_t$ per day of inactivity beyond the 14-day grace window.

---

## 3. CEFR and Canadian NCLC Level Mapping

### A. Level Cutoffs

| CEFR Level | Score Percentage | Canadian NCLC Equivalent | Description |
|:---|:---|:---|:---|
| **C2** | $\ge 95\%$ | NCLC 10+ | Maîtrise supérieure |
| **C1** | $85\% - 94.9\%$ | NCLC 9 | Autonomie complète |
| **B2** | $70\% - 84.9\%$ | NCLC 7–8 | Utilisateur indépendant avancé (Seuil immigration Canada) |
| **B1** | $55\% - 69.9\%$ | NCLC 5–6 | Utilisateur indépendant seuil |
| **A2** | $40\% - 54.9\%$ | NCLC 4 | Niveau élémentaire intermédiaire |
| **A1** | $< 40\%$ | NCLC 3 | Niveau élémentaire introductif |

### B. Official Disclaimer Requirement

To maintain full regulatory compliance with the Paris Chamber of Commerce and Industry (CCI Paris Île-de-France), every estimated level presentation in the API and UI includes the mandatory disclaimer:

> *"Ce niveau est une estimation indicative basée sur notre modèle d'apprentissage interne et ne constitue pas un résultat officiel TEF délivré par la CCI Paris Île-de-France."*

---

## 4. Target Gap Analysis Service

The `TargetGapService` computes the structural distance between the student's current standing and their declared target:

1. **Score Gap**: $\Delta = \text{Target Level Min Score} - \text{Current Rolling Score}$
2. **Level Distance**: Number of discrete CEFR bands remaining (e.g., $B1 \to B2 = 1$, $A2 \to B2 = 2$).
3. **Exam Urgency Classification**:
   - `critical`: Exam date $\le 14$ days away, or score gap $> 15\%$.
   - `urgent`: Exam date $\le 30$ days away.
   - `normal`: Exam date $> 30$ days away.
   - `overdue`: Exam date in the past.

---

## 5. Strengths, Weaknesses & Trajectory Tracking

### A. Categorization
- **Weaknesses**: Skills with mastery $< 65.0\%$ or target gap priority deficits.
- **Strengths**: Skills with mastery $\ge 75.0\%$ and confidence $\ge 0.50$.

### B. Trajectory Detection
Computed by contrasting the current rolling score against historical snapshots:
- **Improving (`improving`)**: Score gain $\ge +5.0\%$
- **Declining (`declining`)**: Score drop $\le -5.0\%$
- **Stable (`stable`)**: Variation between $-5.0\%$ and $+5.0\%$
- **Insufficient Data (`insufficient_data`)**: Single assessment or in calibration phase

---

## 6. Personalization & Recommendation Engine V2

The engine generates intelligent exercise suggestions based on:
1. **Weakness Remediation**: Skills below 65% trigger direct drill exercises.
2. **Target Gap Boost**: Exercises targeting skills required for the student's declared CEFR level receive a **+25 point priority boost**.
3. **48-Hour Cooldown**: Completed exercises are excluded from recommendations for 48 hours to prevent repetition and promote topic diversity.
4. **Lifecycle States**: `active` &rarr; `started` &rarr; `completed` (or `dismissed`).

---

## 7. Personalized Daily Practice Plan ("Que faire aujourd'hui ?")

Every student receives a daily action plan consisting of 4 structured components:
1. **Remediation Drill**: Practice targeting the student's weakest skill.
2. **Mistake Revision**: Reviewing mistakes flagged in recent assessments.
3. **Exam Simulation**: Timed section or test blanc module.
4. **Fluency Practice**: Oral or written production task.

For new students with zero prior activity, the daily plan dynamically generates **diagnostic onboarding tasks** to calibrate initial baselines.

---

## 8. Privacy & Data Immutability Guarantees

- **Multi-Tenant Isolation**: Every endpoint resolves through `current_user.id`. Student A can never access or leak Student B's skills, progress timeline, or recommendations.
- **Immutable Audit Trail**: All historical evaluations (`SkillAssessment`, `StudentActivityEvent`) are append-only. They are never updated or deleted.
- **Idempotency**: Assessment and exercise submissions use unique submission IDs. Retrying a submission will never duplicate skill adjustments or distort mastery percentages.
