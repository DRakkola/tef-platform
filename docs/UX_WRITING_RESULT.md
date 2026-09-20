# Student Writing Result / Correction Experience UX Specification & Architecture

## 1. Executive Summary & Product Purpose

The **Student Writing Result / Correction Experience** (`/writing/:attemptId/result` and `/writing/attempts/:attemptId/result`) is the pedagogical feedback and analysis environment where a submitted written production is transformed into an actionable learning loop.

### Core Product Principles
1. **Transform Evaluation into Learning**: A score is only a starting point. The primary purpose is to help the candidate understand *why* errors occurred, *what* strengths were validated, and *how* to target remediation through personalized practice.
2. **Pedagogical Clarity over Numerical Anxiety**:
   - Scores are clearly labeled as **"Score d'entraînement"** with an estimated CEFR level (A1 to C2).
   - Mandatory disclaimer prominently displayed: *"Score d'entraînement indicatif — Non officiel TEF"*.
   - Evaluator provenance is transparent: candidates clearly distinguish whether feedback originates from an automated AI evaluation or an accredited TEF teacher.
3. **Immutability of Submitted Work**: The student's submitted response is preserved in a read-only, distraction-free viewer with formatted paragraphs, word count metrics, and prompt reminder.
4. **Sentence-Level Granularity**: Annotated corrections offer side-by-side or stacked before/after diffs with pedagogical explanations ("Pourquoi ?") and category filters.
5. **Strict Privacy Safeguards**: Candidate essay text and private examiner notes are strictly omitted from telemetry events.

---

## 2. Layout Architecture & Visual Hierarchy

The page is built using `PageShell` and `StudentLayout` with a focused, premium structure:

```
┌────────────────────────────────────────────────────────────────────────┐
│ WritingResultHeader                                                    │
│ [← Retour aux rédactions]  Écrit #id • Section A/B • Statut • Correcteur │
├────────────────────────────────────────────────────────────────────────┤
│ [Pending State Banner] (if status is SUBMITTED/QUEUED/PROCESSING)      │
│  - Progress indicator & pedagogical reassurance message                │
│  - Candidate submitted text viewer                                     │
│  - Auto-polling (6s) + Manual refresh CTA                              │
├────────────────────────────────────────────────────────────────────────┤
│ WritingResultSummary (When corrected)                                  │
│ ┌───────────────────────┬────────────────────────────────────────────┐ │
│ │ Niveau estimé (B2)    │ Critères d'évaluation (6 badges):          │ │
│ │ Score: 78/100         │  - Adéquation à la consigne (85%)          │ │
│ │ Mots: 195/200-250     │  - Grammaire (70%)  - Vocabulaire (75%)    │ │
│ │                       │  - Cohérence (80%)  - Orthographe (85%)    │ │
│ │ Non officiel TEF      │  - Syntaxe (72%)                           │ │
│ └───────────────────────┴────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────┤
│ Tab Navigation:                                                        │
│ [ Vue d'ensemble ]  [ Corrections détaillées (N) ]  [ Votre copie ]    │
│ [ Recommandations (N) ]                                                │
├────────────────────────────────────────────────────────────────────────┤
│ TAB CONTENT:                                                           │
│                                                                        │
│ 1. Vue d'ensemble:                                                     │
│    - WritingEvaluatorFeedback (Teacher commentary / AI summary)        │
│    - WritingStrengthsImprovements (Points forts vs Axes prioritaires)  │
│    - Top priority recommendations preview                              │
│                                                                        │
│ 2. Corrections détaillées:                                             │
│    - Category Filter Tabs (Tous, Grammaire, Syntaxe, Vocabulaire, etc.)│
│    - Sentence-level correction cards:                                  │
│        * Type badge & impact severity indicator                        │
│        * Original sentence with strikethrough error                    │
│        * Suggested correction with highlight                           │
│        * Pedagogical explanation ("Pourquoi cette correction ?")       │
│                                                                        │
│ 3. Votre copie:                                                        │
│    - Task prompt accordion (consigne et documents d'appui)             │
│    - Read-only candidate text viewer with line numbers & copy button   │
│    - Word count metrics vs target range                                │
│                                                                        │
│ 4. Recommandations:                                                    │
│    - Actionable remediation cards tied to identified weaknesses        │
│    - Estimated duration & target skill tag                             │
│    - "S'entraîner maintenant" CTA with direct route to Practice Player │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. State Management & Polling Cycle

The `useWritingResult` hook encapsulates asynchronous state resolution:

### State Transitions
1. **Initial Loading (`isLoading: true`)**:
   - `WritingResultSkeleton` renders pulse-animated summary cards and tabs.
2. **Pending / In Review (`status: "SUBMITTED" | "QUEUED" | "PROCESSING"` or `"pending" | "in_review"`)**:
   - Renders `CorrectionPendingState`.
   - Polling interval automatically active every 6,000ms.
   - For AI correction: Reassures candidate that automated multi-criteria evaluation typically completes within 30-60 seconds.
   - For Teacher correction: Informs candidate of human evaluation SLA (typically 24-48 hours) while offering immediate review of their submitted copy.
   - Clean unmount cancels the polling interval without memory leaks.
3. **Completed / Corrected (`status: "CORRECTED" | "returned"` or correction object present)**:
   - Polling terminates immediately.
   - Full evaluation data loaded: scores, criteria breakdown, strengths, weaknesses, evaluator comments, annotated items, and recommendations.
4. **Error / Not Found (`error !== null`)**:
   - Error banner with retry CTA and fallback navigation back to `/writing/history`.

---

## 4. Evaluation Criteria & Scoring Logic

The scoring system maps directly to official TEF French writing evaluation dimensions:

| Criterion Key | French Label | Weight / Focus |
|---|---|---|
| `taskCompletion` / `adequation` | Adéquation à la consigne | Respect of prompt requirements, word count bounds, functional objective |
| `coherence` | Cohérence et logique | Text structuring, connectors, paragraph transitions, argumentation flow |
| `vocabulary` | Richesse du vocabulaire | Precision, variety, lexical range, idiomatic French usage |
| `syntax` | Structure des phrases | Sentence complexity, subordinate clauses, inversion, punctuation |
| `grammar` | Correction grammaticale | Verb conjugations, agreement (gender/number), pronoun placement |
| `spelling` / `orthographe` | Orthographe et accents | Lexical spelling, accentuation (é, è, ê, à, ç), elision |

### Score Disclaimer & CEFR Mapping
- Displayed levels: `A1`, `A2`, `B1`, `B2`, `C1`, `C2`.
- Explicit notice: *"Score d'entraînement indicatif calculé selon la grille TEF. Seul le certificat émis par la CCI Paris Île-de-France constitue un résultat officiel."*

---

## 5. Annotated Corrections Engine

Annotated corrections are presented as granular, sentence-level cards:

### Card Elements
- **Category Badge**: Distinct visual color for `Grammaire`, `Syntaxe`, `Vocabulaire`, `Orthographe`, `Cohérence`, `Registre`.
- **Original Phrase**: Red strikethrough highlight highlighting the precise error.
- **Suggested Improvement**: Green highlight displaying the corrected phrase.
- **Explanation Box**: Clear pedagogical explanation explaining the French grammar rule or lexical nuance.
- **Filtering**: Candidates can filter corrections by error category to focus their study sessions.

---

## 6. Closing the Loop: Remediation Recommendations

Rather than leaving the student with passive feedback, the result page provides dynamic recommendations:

- **Targeted Practice**: Links directly to `/exercises/:id` or `/practice?skill=:skill` with pre-filled filters.
- **Skill Alignment**: Each recommendation specifies the relevant skill (`accord_participe_passe`, `connecteurs_logiques`, `subjonctif`, etc.).
- **Immediate Action**: Single-click navigation to start practice exercises immediately.

---

## 7. Privacy & Telemetry Safeguards

In strict accordance with privacy regulations and user confidentiality:
- **Zero Text Logging**: Candidate essay text, drafts, and examiner commentary are **never** logged to analytics or telemetry payloads.
- **Emitted Events**:
  - `writing_result_viewed`: Contains `attempt_id`, `status`, `estimated_level`, `criteria_count`.
  - `writing_correction_tab_changed`: Contains `tab_id`.
  - `writing_correction_filter_applied`: Contains `category`.
  - `writing_recommendation_clicked`: Contains `exercise_id`, `skill_id`.

---

## 8. Verification & Quality Assurance

| Test Vector | Status | Description |
|---|---|---|
| Unit & Integration Tests | PASS (17/17) | `tests/WritingResult.test.tsx` verifying loading, pending states, completed view, tabs, filters, and copy actions |
| Overall Web Test Suite | PASS (214/214) | 22 test files passing across the web application |
| Production Build | PASS (0 errors) | `tsc -b && vite build` bundled cleanly |
| Backend Tests | PASS (9/9) | `uv run pytest -q tests/test_writing.py` passing |
| Content & Data Integrity | PASS (100%) | `validate_content.py` and `validate_data.py` all passing with 0 defects |
