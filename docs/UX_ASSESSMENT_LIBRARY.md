# Student Assessment Library UX Specification & Architecture

## 1. Executive Summary & Product Purpose

The **Student Assessment Library** (`/assessments`) is the formal evaluation center for candidates preparing for high-stakes French language assessments (TEF Canada / TEF IRN).

### Guiding Principle: Guided First → Catalog Second
A serious exam-preparation platform must never feel like an e-commerce catalog of tests. Candidates under high pressure require clarity, confidence, and structure:
1. **Immediate Resumption**: Any timed in-progress attempt is surfaced immediately as a high-priority action with real-time remaining countdown and progress tracking.
2. **Deterministic Recommendation**: Rather than browsing dozens of simulations blindly, the candidate receives an explicit recommendation tailored to their recent performance and diagnostic targets.
3. **Structured Modalities**: Clear pathways between full timed simulations (mixed épreuves) and targeted skill evaluations (Compréhension écrite and Compréhension orale), with cross-links to writing and speaking labs.
4. **Historical Mastery**: A clean chronological record of completed evaluations with CEFR/NCLC estimates and deep-links to diagnostic score breakdowns.

---

## 2. The 6-Question Information Hierarchy

The Assessment Library answers six core questions in strict sequence:

| Priority | Question Answered | Architectural Component | Pedagogical Implementation |
|:---|:---|:---|:---|
| **0** | **Do I have an active exam in progress?** | `ActiveAttemptCard` | High-priority banner with remaining countdown (`37 min`), answered count (`18 / 40`), and `[Continuer l'évaluation]` CTA. |
| **1** | **Which assessment should I take?** | `RecommendedAssessmentCard` | Highest visual weight hero card with `Évaluation recommandée` badge, duration, question count, and `[Commencer l'évaluation]` CTA. |
| **2** | **Why should I take it?** | Pedagogical rationale callout | Explicit justification (*"Pourquoi cette évaluation ? Votre dernière simulation montre une marge de progression en compréhension orale..."*). Fallback for new candidates provides initial diagnostic guidance. |
| **3** | **What kind of assessment is it?** | `AssessmentSkillSection` + Type Badges | Canonical distinction between full official simulation, reading comprehension, and listening comprehension, plus companion links to writing and speaking labs. |
| **4** | **How long will it take?** | Time metadata on all cards | Formal duration displayed in minutes (e.g. `60 min`, `75 min`) with question counts and time badges. |
| **5** | **What will it evaluate?** | `AssessmentCard` + Level Badges | Standardized CEFR levels (`A2`, `B1`, `B2`, `C1`), question counts, and difficulty categories (`Débutant`, `Intermédiaire`, `Avancé`). |
| **6** | **What have I already completed?** | `AssessmentHistory` | Desktop table and mobile card feed of past completed/expired attempts with dates, scores (`78%`), estimated levels (`B2 / NCLC 7`), and result deep-links. |

---

## 3. Component Architecture & Directory Structure

All components for this page reside in `apps/web/src/features/assessments/`:

```
apps/web/src/features/assessments/
├── AssessmentsListPage.tsx          # Main orchestrator wrapped in StudentLayout & PageShell
├── AssessmentLibraryHeader.tsx      # Breadcrumb (Accueil > Simulations TEF), title, and count badge
├── ActiveAttemptCard.tsx            # Prominent banner for ongoing timed session with remaining countdown
├── RecommendedAssessmentCard.tsx    # Personalized hero recommendation + initial diagnostic fallback
├── AssessmentSkillSection.tsx       # Modality cards (Reading, Listening) + Writing & Speaking companion cards
├── AssessmentSection.tsx            # Complete simulations catalog with interactive filtering & empty state
├── AssessmentCard.tsx               # Standard simulation card with state-aware CTAs (Commencer, Continuer, Résultat)
├── AssessmentFilters.tsx            # Desktop pill filters (Type, Level, Duration) + Mobile sheet filter drawer
├── AssessmentHistory.tsx            # Historical attempts table/feed with scores, dates, status badges & CTAs
├── AssessmentLibrarySkeleton.tsx    # Zero-CLS layout-mirroring skeleton loader
├── types.ts                         # Domain TypeScript interfaces and attempt status types
├── useAssessmentLibrary.ts          # Decoupled TanStack Query hooks, auth expiration, and fallbacks
└── index.ts                         # Barrel exports
```

---

## 4. API Endpoints & Data Contracts

The library is supported by dedicated, decoupled endpoints:

### 4.1 Catalog Listing: `GET /api/v1/assessments?page_size=50`
- Returns published simulations list (`AssessmentListItem[]`) with summary metadata (`id`, `title`, `description`, `assessment_type`, `duration_seconds`, `estimated_completion_time_minutes`, `level`, `question_count`, `section_count`, `total_points`).
- **Security constraint**: Never returns internal question texts, choices, correct answers, or audio assets in catalog queries.

### 4.2 Active Attempt: `GET /api/v1/assessments/me/active-attempt`
- Returns active timed attempt summary (`ActiveAttemptSummary`) if the authenticated student has an in-progress attempt with remaining time (`remaining_seconds > 0`), or `null`.

### 4.3 Recommendation: `GET /api/v1/assessments/me/recommendation`
- Returns candidate recommendation (`AssessmentRecommendation`) based on skill deficits and NCLC target, or fallback diagnostic guidance.

### 4.4 History: `GET /api/v1/assessments/me/history?limit=20`
- Returns completed, submitted, or expired attempts (`AssessmentHistoryItem[]`) with calculated scores, estimated levels, and timestamps.

---

## 5. Visual Hierarchy & Interactive Patterns

### 5.1 Hero Recommendation
- Elevated high-contrast card with subtle gradient accent.
- Highlights whether the assessment is a full simulation or single-skill drill.
- Prominent explanation box (*"Pourquoi cette évaluation ?"*) gives candidates clarity on pedagogical value.

### 5.2 Modality Cards
- Interactive accelerators for single-skill preparation:
  - **Compréhension écrite**: 60 min, 40–50 questions, direct filter link.
  - **Compréhension orale**: 40 min, 60 audio questions, direct filter link.
- Subdued companion cards pointing to Writing Workshop (`/writing`) and Speaking Lab (`/speaking`).

### 5.3 Filterable Catalog & Empty States
- Real-time search query matching simulation title and description.
- Filter pills:
  - **Type**: Tous, Simulation complète, Compréhension écrite, Compréhension orale.
  - **Niveau**: Tous, A2, B1, B2, C1.
  - **Durée**: Toutes, < 45 min, 45–60 min, > 60 min.
- Accessible `EmptyState` when 0 results match with direct `Réinitialiser les filtres` action.

### 5.4 Attempt History
- Responsive view:
  - **Desktop**: Full semantic table with columns (Épreuve, Date, Statut, Score, Niveau estimé, Action).
  - **Mobile**: Compact card rows with stacked metrics and action buttons.
- Status badges:
  - `submitted`: Emerald `Terminé`
  - `started`: Blue pulse `En cours`
  - `expired`: Amber `Expiré`
  - `abandoned`: Muted `Abandonné`

---

## 6. Verification & Quality Gates

- **Zero Machine Code Leaks**: HTTP 401 triggers clean French session recovery without leaking `401` or `AUTH_REQUIRED`.
- **Zero Layout Shift (CLS)**: `AssessmentLibrarySkeleton` mirrors the full page hierarchy during initial query loading.
- **Automated Vitest Suite**: 12 dedicated tests in `apps/web/tests/AssessmentLibrary.test.tsx` + 5 backward-compatibility tests in `apps/web/tests/StudentAssessmentJourney.test.tsx`.
- **Backend Tests**: 22 Pytest tests in `apps/api/tests/test_assessments.py` and `test_student_assessment_flow.py`.
