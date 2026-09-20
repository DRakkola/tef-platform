# Student Practice UX Specification & Architecture

## 1. Executive Summary & Product Purpose

The **Student Practice** page (`/practice`) is the personal learning workspace for candidates preparing for high-stakes French language assessments (TEF Canada / TEF IRN).

### Guiding Philosophy: Personalized Practice BEFORE Content Catalog
Traditional learning platforms often present an overwhelming e-commerce catalog of exercises, leaving students with decision fatigue. The TEF Platform inverts this paradigm:
1. **Actionable Guidance**: The student is immediately presented with what to practice now and why it matters pedagogically.
2. **Deterministic Targeting**: Practice exercises are directly tied to diagnostic weaknesses and CEFR benchmark deficits (especially the NCLC 7 / B2 threshold).
3. **Structured Exploration**: The full exercise catalog remains easily accessible, but positioned underneath personalized recommendations and category shortcuts.

---

## 2. The 3-Step Information Hierarchy

The Practice page is structured in strict hierarchical order:

| Priority | Question Answered | Architectural Component | Pedagogical Contents |
|:---|:---|:---|:---|
| **1** | **What should I practice now?** | `PracticeHeader` + `RecommendedPracticeSection` | Breadcrumb (`Accueil > Pratique`), Title, Subtitle, and 1 High-contrast **Primary Recommendation** hero card with modality icon, CEFR level badge, estimated duration (`~15 min`), and primary CTA `Commencer l'exercice`. |
| **2** | **Why is it recommended?** | `PracticeRecommendationCard` + `DailyPracticePlan` | Explicit pedagogical rationale ("Pourquoi cette activité ? Comble un déficit de 18% identifié lors du dernier diagnostic") + 2–3 Secondary recommendations + Today's daily study checklist (`2 / 4 activités terminées`). |
| **3** | **What other practice is available?** | `PracticeCategories` + `ExplorePracticeSection` | 7 canonical TEF category accelerators (Compréhension écrite/orale, Expression écrite/orale, Grammaire, Vocabulaire, Conjugaison) + Searchable & filterable exercise catalog with responsive desktop FilterBar and mobile Sheet. |

---

## 3. Component Architecture & Contracts

All practice components reside in `apps/web/src/features/practice/`:

```
apps/web/src/features/practice/
├── PracticePage.tsx                 # Main orchestrator inside StudentLayout & PageShell
├── PracticeHeader.tsx               # Breadcrumb trail, title, and daily completion pill
├── RecommendedPracticeSection.tsx   # Hero card + secondary cards + insufficient data fallback
├── PracticeRecommendationCard.tsx   # Dual-variant card (primary hero vs compact secondary)
├── DailyPracticePlan.tsx            # Daily checklist with progress bar and direct execution
├── PracticeCategories.tsx           # 7 canonical category cards with shortcuts
├── PracticeCategoryCard.tsx         # Category accelerator card with live exercise count
├── ExplorePracticeSection.tsx       # Filterable catalog with search, responsive grid & empty state
├── PracticeFilters.tsx              # Desktop inline FilterBar + Mobile Sheet filters
├── PracticeExerciseCard.tsx         # Exercise card with level, duration, question type, & completed status
├── RecentPractice.tsx               # Chronological feed of recent attempts with review deep-links
├── PracticeSkeleton.tsx             # Granular layout-mirroring skeleton to prevent layout shift
├── types.ts                         # Domain TypeScript interfaces & enums
├── usePractice.ts                   # TanStack Query data fetching, fallbacks & auth interception
└── index.ts                         # Barrel exports
```

---

## 4. Component Details & Behavior

### 4.1 `RecommendedPracticeSection` & `PracticeRecommendationCard`
- **Primary Hero Recommendation**:
  - Elevated high-contrast card (`bg-card`, `border-primary/40`, subtle gradient).
  - Prominent pedagogical justification callout: *"Pourquoi cette activité ? Comble un déficit de 18% identifié lors de votre dernier diagnostic."*
  - Primary button: `Commencer l'exercice` with `ArrowRight`.
- **Secondary Recommendations (2–3 items)**:
  - Compact cards with category icon, title, concise reason, duration, and secondary `S'entraîner` CTA.
- **Insufficient Data / New Student Fallback**:
  - Rendered when recommendations list is empty.
  - Card message: *"Personnalisation en cours — Nous avons besoin de quelques résultats supplémentaires pour personnaliser vos exercices."*
  - Direct CTAs: `[Passer un test diagnostic]` (`/assessment`) and `[Explorer les exercices]` (smooth scroll to catalog).

### 4.2 `DailyPracticePlan`
- Card title: `Votre plan du jour`
- Progress bar and completion badge (`completed / total` e.g. `2 / 4 activités terminées`).
- Checklist items with status:
  - `✓ Terminé`: muted strikethrough styling with `Revoir` button.
  - `○ À faire`: modality badge, estimated minutes (`font-mono tabular-nums`), title, and direct `Faire` CTA.

### 4.3 `PracticeCategories` (7 Canonical Modalities)
1. **Compréhension écrite** (`BookOpen`): Lecture critique, repérage et inférences sur textes informatifs et éditoriaux.
2. **Compréhension orale** (`Headphones`): Dialogues de la vie courante, annonces publiques et chroniques radio.
3. **Expression écrite** (`PenTool`): Fait divers journalistique et lettre formelle d'argumentation Section B.
4. **Expression orale** (`Mic`): Présentation de document, négociation et argumentation persuasive.
5. **Grammaire** (`Dumbbell`): Pronoms relatifs complexes, concordance des temps et structures avancées.
6. **Vocabulaire** (`Bookmark`): Lexique soutenu, connecteurs logiques, nuances et collocations du TEF.
7. **Conjugaison** (`GraduationCap`): Modes subjonctif, conditionnel, participes et concordances formelles.

Clicking any category card sets the active category filter in the catalog and smoothly scrolls to `#explore-catalog`.

### 4.4 `PracticeFilters` & `ExplorePracticeSection`
- **Search**: Keyword matching across title, category, instructions, and prompt with a clear button.
- **Category Filter**: Filter pills on desktop; touch buttons inside drawer on mobile.
- **CEFR Level Filter**: `Tous`, `A2`, `B1`, `B2`, `C1`.
- **Mobile Filter Sheet**:
  - Triggered by `Filtres` button with badge count of active non-default filters.
  - Opens shadcn `Sheet` drawer from bottom on mobile.
  - Contains complete category and level selection with "Réinitialiser" and "Appliquer" actions.
- **Exercise Card**:
  - CEFR level badge (`font-mono text-xs`).
  - Modality icon and category name.
  - Duration estimate (`font-mono tabular-nums`) with `Clock` icon.
  - Completed status badge (`✓ Terminé`) with `Revoir` button if previously attempted.
  - High-contrast `Commencer` CTA for new exercises.
- **Empty State**:
  - Accessible `EmptyState` when 0 exercises match the current filters.
  - Immediate `Afficher tous les exercices` action that resets all filters.

### 4.5 `RecentPractice`
- Feed of last 3-4 attempts: exercise title, modality, relative date (`Hier`, `Il y a 2 jours`), outcome pill (`Réussi` or `À consolider`), and review action.
- Deep-link to `/progress` for comprehensive learning history.

---

## 5. Resilience & Quality Guardrails

1. **Zero Machine Codes Leaks**: If session expires (HTTP 401), the interface renders an accessible `ErrorState` with `"Session expirée"` and a direct `"Se reconnecter"` button. It never displays `AUTH_REQUIRED`, `401`, or raw JSON errors.
2. **Partial Failure Isolation**: If the exercise catalog fails or experiences network latency, recommendations and daily plan remain fully interactive.
3. **Zero Cumulative Layout Shift (CLS)**: The `PracticeSkeleton` mirrors the full layout with semantic pulse bars.
4. **Accessible Semantics**: Proper ARIA landmarks (`nav aria-label="Fil d'Ariane"`), `tabular-nums` for all time counters and metrics, and full keyboard navigation.
