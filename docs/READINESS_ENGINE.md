# TEF Readiness Engine & Adaptive Learning Engine

## 1. Overview & Pedagogical Mission

The TEF Readiness Engine and Adaptive Learning Engine provide students preparing for the **TEF Canada** exam with an actionable, deterministic, and transparent progress evaluation system.

### Regulatory & Legal Compliance
* **Strict Estimation System**: This system calculates **readiness estimates** (`estimation de préparation`) and **estimated performance** based on historical practice and diagnostic assessments.
* **No Official Certification**: It does not award official TEF scores, certifications, or attestations, which are solely administered by the *Chambre de Commerce et d'Industrie (CCI) Paris Île-de-France*.
* **No Score Guarantees**: It never guarantees test outcomes, Canadian CLB/NCLC immigration points, or visa approval.

---

## 2. Mathematical Formulations

The engine relies exclusively on deterministic Python algorithms. Large Language Models (LLMs) are never utilized to compute scores, confidence intervals, or readiness bands.

### 2.1 Source Weighting ($w_{\text{src}}$)
Evidence is ingested from diverse learning modalities with trust weights reflecting assessment rigor:

| Modality | Key | Weight ($w_{\text{src}}$) | Rationale |
| :--- | :--- | :---: | :--- |
| Diagnostic / Mock Exam | `assessment` | `1.00` | Standardized, timed, multi-question formal attempt |
| Certified Teacher Review | `teacher_evaluation` | `0.95` | Expert human evaluation of oral or written production |
| AI Linguistic Evaluation | `ai_evaluation` | `0.85` | Automated scoring against rubric criteria |
| Thematic Exercise | `exercise` | `0.70` | Targeted practice on specific subskills |
| Practice Pool Session | `practice` | `0.60` | Peer interaction with self/peer metrics |

### 2.2 Exponential Time Decay ($w_{\text{rec}}$)
Language proficiency evolves over time. Older observations decay following a continuous half-life formula:

$$\lambda = \frac{\ln(2)}{t_{1/2}} = \frac{\ln(2)}{45.0} \approx 0.015403 \text{ days}^{-1}$$

$$w_{\text{rec}}(\Delta t) = \exp(-\lambda \cdot \Delta t)$$

Where $\Delta t$ is the elapsed time in days between the observation and calculation:
* $\Delta t = 0\text{ days} \implies w_{\text{rec}} = 1.00$
* $\Delta t = 45\text{ days} \implies w_{\text{rec}} = 0.50$
* $\Delta t = 90\text{ days} \implies w_{\text{rec}} = 0.25$

### 2.3 Skill Mastery Aggregation
For each evaluated skill $s$, the weighted rolling estimate $E_s$ is calculated as:

$$E_s = \frac{\sum_{i=1}^N w_{\text{eff}, i} \cdot S_i}{\sum_{i=1}^N w_{\text{eff}, i}}$$

Where:
* $S_i \in [0.0, 100.0]$ is the normalized score of observation $i$.
* $w_{\text{eff}, i} = w_{\text{src}, i} \cdot w_{\text{rec}, i} \cdot c_i \cdot w_{\text{user}, i}$ ($c_i$ is observation confidence, clamped to $[0.1, 1.0]$).

### 2.4 Decoupled Confidence Algorithm
Confidence measures the statistical reliability and depth of observations, completely independent of whether performance is high or low:

$$C_s = C_{\text{sample}} + B_{\text{diversity}} + F_{\text{consistency}} + F_{\text{recency}} + B_{\text{trust}}$$

1. **Sample Count ($C_{\text{sample}}$)**: $\min(0.50, N \cdot 0.10)$ (reaches maximum 0.50 at 5 observations).
2. **Source Diversity Bonus ($B_{\text{diversity}}$)**:
   * $+0.25$ if observed across $\ge 3$ distinct source types.
   * $+0.15$ if observed across $2$ distinct source types.
3. **Variance Consistency ($F_{\text{consistency}}$)**:
   * Standard deviation $\sigma \le 10.0 \implies +0.15$
   * $\sigma \le 20.0 \implies +0.05$
   * $\sigma > 30.0 \implies -0.10$
4. **Recency Adjustment ($F_{\text{recency}}$)**:
   * Days since last observation $\le 14 \implies +0.10$
   * Days since last observation $> 30 \implies -\min(0.25, \frac{\Delta t_{\text{last}} - 30}{7} \cdot 0.02)$
5. **High-Trust Source Bonus ($B_{\text{trust}}$)**: $+0.10$ if at least one `assessment` or `teacher_evaluation` exists.

Final confidence $C_s$ is clamped to $[0.0, 1.0]$. If $N < 2$ or $C_s < 0.35$, the state is flagged as `insufficient_data`.

---

## 3. Prioritization & Blocking Skills

### 3.1 Target Gap Ranking
For each skill $s$ and student target level threshold $T$ (e.g., $65.0\%$ for B2):

$$\text{Gap}_s = \max(0.0, T - E_s)$$

$$\text{Priority}_s = (\text{Gap}_s \cdot 0.6) \cdot M_{\text{core}} \cdot M_{\text{urgency}} + \min(15.0, M_{\text{mistakes}} \cdot 3.0) + B_{\text{conf}}$$

* $M_{\text{core}} = 1.4$ for core test pillars (*Compréhension écrite*, *Compréhension orale*, *Expression écrite*, *Expression orale*), $1.0$ for supporting subskills.
* $M_{\text{urgency}} = 1.3$ if exam date $\le 14$ days, $1.15$ if $\le 30$ days, $1.0$ otherwise.
* $B_{\text{conf}} = +10.0$ if $C_s \ge 0.35$ (targets confirmed deficits before uncalibrated skills).

### 3.2 Limiting Factors (Blocking Skills)
A skill is formally classified as a **blocking skill** (`compétence bloquante` / `facteur limitant`) only when:
1. It has at least $2$ recorded observations.
2. Its confidence $C_s \ge 0.35$.
3. Its deficit $\text{Gap}_s \ge 10.0$ percentage points.

---

## 4. Controlled Readiness Bands

The student's overall profile is categorized into five strict readiness bands:

| Readiness Band | Key | Criteria |
| :--- | :--- | :--- |
| **Données insuffisantes** | `insufficient_data` | $< 2$ core skills evaluated OR overall confidence $< 0.35$. |
| **En développement** | `developing` | Overall score $< T - 20.0$ (e.g. $< 45\%$ for B2). |
| **En progression** | `progressing` | $T - 20.0 \le \text{Score} < T - 8.0$ (e.g. $45\% - 56.9\%$). |
| **Proche de la cible** | `near_target` | $T - 8.0 \le \text{Score} < T$ OR $\text{Score} \ge T$ with a core skill deficit $> 15\%$. |
| **Conforme à la cible** | `target_consistent` | $\text{Score} \ge T$ with confirmed confidence and no critical core deficit. |

---

## 5. Adaptive Learning & Daily Plan V2

### 5.1 Strict Time Budgeting
Students configure their available study time in `StudentProfile.daily_minutes_available` (15, 30, 45, or 60 minutes).
The Daily Plan generator strictly complies with this constraint:
$$\sum_{k=1}^M \text{Duration}_k \le \text{Budget}_{\text{available}}$$

### 5.2 Plan Composition
1. **Spaced Review item** (10–15 min): Targets older mastered items approaching forgetting thresholds.
2. **Core Practice item** (15–20 min): Focused on the highest priority blocking skill.
3. **Diagnostic / Refresh item** (remaining time): Quick checks or micro-assessments.

### 5.3 Adaptive Difficulty Selector
Exercises are categorized into tiers relative to the student's mastery:
* `too_easy`: Chosen for recovery after $\ge 3$ consecutive errors to prevent demoralization.
* `appropriate`: Exercises matched to current estimated proficiency $\pm 1$ tier.
* `challenging`: Target+1 tier exercises. Enforces a **48-hour cooldown** between challenging tasks to prevent cognitive fatigue.

---

## 6. Reassessment Engine

Formal mock exams require substantial student effort. The Reassessment Engine enforces:
* **7-day Cooldown**: Reassessment is actively discouraged within 7 days of a completed diagnostic.
* **Volume Threshold**: Recommended only after $\ge 5$ new practice activities are logged or when a previously blocking skill shows significant improvement.
