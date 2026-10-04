# TEF Platform — Question System V2: Admin Question Authoring & Review Workspace

## 1. Overview

Phase 6 introduces a production-grade, pedagogically rigorous **Admin Question Authoring & Review Workspace** for the TEF Platform.

The workspace is designed to bridge psychometric requirements, canonical taxonomy indexing, diagnostic pedagogy, and editorial state-machine workflows into a unified, responsive interface.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              QUESTION WORKSPACE V2                                     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [Header]  ID • Status (Draft/InReview/Approved/Published) • vN • Validation • Actions  │
├───────────┬───────────┬───────────┬───────────┬─────────────┬─────────────┬────────────┤
│  Contenu  │  Profil   │Compétences│  Qualité  │ Traçabilité │ Historique  │   Aperçu   │
│ (Stimulus/│  & CEFR   │  (Taxo V2 │ (Linter   │ (Origine &  │ (Snapshots  │ (Candidat/ │
│  Prompt/  │ (1-5 Diff/│  Poids /  │  Blocages)│  Humain/IA) │   & Diff)   │  Admin)    │
│  Options) │  Bloom)   │  Balance) │           │             │             │            │
└───────────┴───────────┴───────────┴───────────┴─────────────┴─────────────┴────────────┘
```

---

## 2. Key Modules & Functional Architecture

### 2.1 Workspace Header (`QuestionWorkspaceHeader.tsx`)
- **Identification & Concurrency:**
  - Displays Question UUID with one-click clipboard copying.
  - Displays active semantic version (`v1`, `v2`, ...).
  - Displays lifecycle status pill (`Brouillon`, `En révision`, `Approuvé`, `Publié`, `Archivé`, `Rejeté`).
  - Validation compliance badge (`Conforme`, `Avertissements`, `Bloquant`).
  - **Optimistic Concurrency Detection:** Compares client version against server version; if another administrator or job updated the record, renders a non-destructive stale warning with quick reload.
- **State Machine Toolbar:**
  - *Draft / Rejected:* « Enregistrer », « Valider », « Soumettre pour révision » (with confirmation and editorial comments).
  - *In Review:* « Approuver », « Rejeter » (with mandatory feedback note), « Renvoyer en brouillon ».
  - *Approved:* « Publier officiellement » (freezes immutable snapshot in version history), « Renvoyer en brouillon ».
  - *Published:* « Créer version vN+1 », « Dupliquer (Fork) », « Archiver ».
  - *Archived:* « Réactiver dans nouvelle version », « Dupliquer ».

---

### 2.2 Content & Stimulus Tab (`ContentTab.tsx`)
- **Reusable Stimulus Integration (`StimulusDialog.tsx`):**
  - Items can link to existing stimuli in the central stimulus repository or create new text/audio stimuli directly.
  - Linked stimulus displays title, CEFR level, source attribution, and snippet with quick detach capability.
- **Item Prompt & Media:**
  - Prompt textarea with rich formatting guidelines.
  - Audio/media URL input with instant inline HTML5 audio preview for listening items.
  - General didactic explanation textarea.
- **Dynamic Response-Type Editors:**
  - `OptionEditor.tsx`:
    - Handles `single_choice` (radio toggle) and `multiple_choice` (checkbox toggle).
    - Reorder options up/down, add, and remove options.
    - **Diagnostic Distractor Analysis:** Collapsible pedagogical drawer per option configuring `misconception_type` (e.g. *Piège lexical*, *Sur-généralisation*, *Inférence non fondée*) and `distractor_rationale`.
  - `MatchingEditor.tsx`: Left/Right premise-target pairs builder.
  - `OrderingEditor.tsx`: Sequential elements with order reordering.
  - `GapFillEditor.tsx`: Cloze template text with `[blank:N]` tokens and multi-accepted answer arrays per blank.
  - `ShortTextEditor.tsx`: Canonical exact answer and accepted alternative orthographic variations with case/whitespace toggles.

---

### 2.3 Assessment Profile & De-Conflated Psychometrics (`AssessmentProfileTab.tsx`)
Enforces the TEF psychometric triad without confounding standards:
1. **Target CEFR Level:** The standard proficiency descriptor benchmark (`A1`, `A2`, `B1`, `B2`, `C1`, `C2`).
2. **Item Difficulty (1 to 5):** The empirical calibration of item discrimination (*1: Très accessible* to *5: Très discriminant / Expert*).
3. **Cognitive Complexity Level:** Taxonomy of Bloom revised (*remember*, *understand*, *apply*, *analyze*, *evaluate*, *create*).
4. **Modality & Task Type:** Modality selector (`reading`, `listening`, `writing`, `speaking`) dynamically filtering canonical Task Types from the backend taxonomy engine (`/api/v1/admin/taxonomy/task-types`).
5. **Scoring Rules:** Positive points (default 1) and optional penalty points.

---

### 2.4 Canonical Taxonomy V2 Skill Tagging (`SkillsTab.tsx`)
- Integrates directly with the canonical competency graph via `/api/v1/admin/taxonomy/skills` (strictly zero hardcoded frontend skill lists).
- **Dimension Grouping:**
  - **Dimension Raisonnement (Cognitive / Comprehension Reasoning)**
  - **Dimension Langue (Formal Language / Grammar / Lexis)**
- **Live Dimension Weight Sum Validation:**
  - For each dimension present, weights must sum to `1.00 ± 0.01`.
  - Status indicator displays current sum in real-time with green (balanced) or amber (unbalanced) badges.
  - Enforces maximum of **1 PRIMARY** role per dimension.
- **Auto-Balance Utility:** One-click normalization button evenly distributes weights to total exactly 1.00 per dimension.

---

### 2.5 Quality & Automated Linter Tab (`QualityTab.tsx`)
- Directly communicates with the backend `QuestionValidationEngine` (`/api/v1/admin/content/questions/{id}/validate`).
- Displays issues grouped into three distinct severity levels:
  - 🔴 **Problèmes bloquants (blocking):** Formally blocks review submission and publication (e.g. no correct answer, empty prompt, dimension sum != 1.0, multiple primary tags in same dimension).
  - 🟡 **Avertissements (warnings):** Recommended pedagogical improvements (e.g. uncalibrated distractors, missing explanations).
  - 🔵 **Recommandations (info):** Structural suggestions and taxonomy metadata.
- Each issue features a **« Corriger »** direct action button that jumps immediately to the relevant workspace tab and field.

---

### 2.6 Provenance & Traceability Tab (`ProvenanceTab.tsx`)
- Records the complete lineage of each item:
  - **Author Type:** `human` (Pedagogical teacher/designer), `ai` (TEF AI Studio generated), `imported` (Official partner annals).
  - **Source Attribution:** Reference citation and copyright attribution.
  - **AI Lineage:** Foundation model ID (e.g. `gemini-1.5-pro`) and prompt template version.
  - **Human Verification:** Explicit verification status with reviewer identity and timestamp.
  - **Confidential Internal Notes:** Private editorial review feedback.

---

### 2.7 History & Immutable Versions Tab (`HistoryTab.tsx`)
- **Immutable Snapshot Inspection:** Displays all frozen versions (`v1`, `v2`, ...). Clicking an entry opens a read-only inspector showing the complete JSON payload delivered to examinees at that version.
- **Visual Diff Comparison:** Side-by-side comparison modal between any frozen version and the active draft, highlighting changes in prompts, options, CEFR levels, and skill tags.
- **Audit Event Timeline:** Complete audit trail of all lifecycle events (`created`, `updated`, `submitted_review`, `approved`, `published`, `archived`) with actor ID and timestamps.

---

### 2.8 Preview Tab & Student Security Boundary (`PreviewTab.tsx`)
Provides a dual-mode viewport:
1. 🎓 **Aperçu Candidat (Safe Student View):**
   - **STRICT LEAKAGE PREVENTION BOUNDARY:** Faithfully reproduces the exact candidate exam-taking experience.
   - Interactive options selection, media/audio playback, and stimulus text rendering.
   - **Guarantees zero leakage:** Strictly prohibits rendering correct answer indicators, green badges, distractor rationales, misconception tags, difficulty levels, or skill taxonomy tags.
2. 🔍 **Aperçu Révision Enseignant (Admin Review View):**
   - Comprehensive pedagogical review view highlighting correct answers in green.
   - Displays distractor traps, misconception classifications, cognitive complexity, CEFR calibration, and skill weights.

---

### 2.9 Upgraded Questions Bank (`QuestionsListPage.tsx`)
- **Server-Side Filtering & Search:**
  - Search by prompt and keywords.
  - Filter by Modality (`reading`, `listening`, `writing`, `speaking`).
  - Filter by Task Type (dynamic from taxonomy).
  - Filter by Response Type (`single_choice`, `multiple_choice`, `matching`, `ordering`, `gap_fill`, `short_text`, `long_text`).
  - Filter by Target CEFR (`A1` to `C2`).
  - Filter by Difficulty (1 to 5).
  - Filter by Lifecycle Status (`draft`, `in_review`, `approved`, `published`, `archived`).
  - Filter by Validation Status (`valid`, `warning`, `invalid`).
- **Rich Summary Badges:** Version, CEFR level, difficulty rating, task type, validation pill.
- **Quick Action Toolbar:** Quick Validate, Duplicate (Fork), Open Workspace (`/admin/questions/:id`).
- **Pagination:** Server-side pagination with page size and total question counts.

---

## 3. Pedagogical & Psychometric Security Rules

| Rule | Enforcement Location | Consequence of Violation |
|---|---|---|
| **No Diagnostic Leakage** | `PreviewTab.tsx` (Student Mode) | Student preview never receives or displays correct answers, distractor rationales, or misconception tags. |
| **Immutability of Published Items** | Backend + `QuestionWorkspacePage.tsx` | Published items are read-only; editing requires branching a new version (`vN+1`) via `create_draft_version`. |
| **Dimension Weight Sum** | `SkillsTab.tsx` + `TaggingValidationEngine` | Weights in each dimension must equal 1.00 (±0.01). Flagged as blocking validation error if violated. |
| **Single Primary Tag Rule** | `SkillsTab.tsx` + `TaggingValidationEngine` | At most 1 primary competency tag allowed per dimension. Flagged as blocking error if violated. |
| **Optimistic Concurrency** | Header + `expected_version` | Prevents concurrent administrators from overwriting edits; returns HTTP 409 and prompts reload. |

---

## 4. Verification & Quality Gates

The implementation has been thoroughly tested and verified:
- **Unit & Component Testing:** `apps/web/tests/QuestionAuthoringWorkspace.test.tsx` (5/5 tests passing).
- **TypeScript Static Verification:** `npx tsc --noEmit` clean with 0 errors across the entire frontend.
- **Full Backend Regression Suite:** 42/42 tests passing in `tests/test_question_lifecycle_and_versioning.py`, `tests/test_question_scoring_v2.py`, etc.
