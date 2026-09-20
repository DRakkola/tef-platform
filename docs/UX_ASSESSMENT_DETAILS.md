# Student Assessment Details UX Specification & Architecture

## 1. Executive Summary & Product Purpose

The **Student Assessment Details page** (`/assessments/:id`) is the final pre-flight briefing and decision checkpoint before a candidate enters a formal, timed examination session (TEF Canada / TEF IRN).

### Calm, Authoritative, Stress-Reducing Experience
Entering an official timed exam triggers performance anxiety. The details page is engineered to provide complete transparency, eliminate uncertainty, and prepare the candidate mentally and technically before the server timer starts:
1. **Unambiguous Scope**: Candidates know the exact modality, target level, time limit, and total question count before committing.
2. **Pedagogical Breakdown**: Transparent structure showing section-by-section breakdown (number of questions, modality instructions, and time allocation) and evaluated competencies.
3. **Rigorous Exam Rules**: Explicit disclosure that the server-side countdown is authoritative, autosave is continuous, answers lock definitively upon submission, and audio clips cannot be replayed.
4. **Authoritative Attempt State**: Seamless detection of in-progress attempts with remaining time countdown, or previous attempt scores with quick links to diagnostic results.
5. **Single Primary Action**: A single, prominent, state-aware CTA eliminating decision fatigue.

---

## 2. The 6 Core Questions Answered

The page answers the candidate's six critical questions prior to starting:

| Priority | Question Answered | Architectural Component | Pedagogical & Technical Implementation |
|:---|:---|:---|:---|
| **1** | **What assessment am I about to take?** | Page Header + `AssessmentSummary` | Official title, target level badge (`B2`), modality badge (Compréhension écrite / Compréhension orale / Simulation complète), and pedagogical description. |
| **2** | **What skills/sections are included?** | `AssessmentSections` + `AssessmentSkills` | Ordered section cards with question counts and instructions, followed by skill tags (e.g. Compréhension globale, Inférence, Vocabulaire en contexte). |
| **3** | **How long will it take?** | `AssessmentSummary` + Section metadata | Total allocated time in minutes and hours, with per-section time breakdown so candidates can budget their effort. |
| **4** | **What rules should I know?** | `AssessmentRules` | 5 core exam guidelines: Server countdown authoritative notice, continuous autosave, definitive submission warning, navigation policy, and audio playback policy. |
| **5** | **Have I already started or taken this?** | `AssessmentPrimaryAction` + `AssessmentHistoryPreview` | Ongoing attempt detection with live remaining time badge; past attempt card with score percentage, estimated level, and link to results. |
| **6** | **What happens when I click Start?** | `AssessmentOverview` + Primary Action notice | Explanatory briefing card (*"À quoi vous attendre"*) detailing real-time countdown start, question loading, and post-submission automated scoring. |

---

## 3. Layout Architecture & Responsive Strategy

The layout is implemented within `StudentLayout` + `PageShell maxWidth="default"` using an asymmetric **2-column grid** on large viewports (`lg:grid-cols-3`):

```
┌────────────────────────────────────────────────────────────────────────┐
│ Breadcrumb: Accueil > Simulations TEF > Consigne de l'épreuve          │
│ Header: Title, Level Badge, Modality Badge, Description                │
├──────────────────────────────────────┬─────────────────────────────────┤
│ MAIN CONTENT (col-span-2)            │ SIDEBAR / ACTION (col-span-1)   │
│                                      │                                 │
│ 1. AssessmentSummary (4-col stats)   │ 1. AssessmentPrimaryAction      │
│    - Niveau visé                     │    - Active attempt banner      │
│    - Temps imparti                   │    - Start / Resume / Restart   │
│    - Questions                       │    - Last result deep-link      │
│    - Sections                        │    - Submission notice          │
│                                      │                                 │
│ 2. AssessmentOverview                │ 2. AssessmentHistoryPreview     │
│    - À quoi vous attendre            │    - Score percentage           │
│    - 4 Pedagogical pillars           │    - Estimated level            │
│                                      │    - Direct review button       │
│ 3. AssessmentSections                │                                 │
│    - Ordered section breakdown       │                                 │
│    - Modality icons & instructions   │                                 │
│                                      │                                 │
│ 4. AssessmentSkills                  │                                 │
│    - Evaluated competencies          │                                 │
│                                      │                                 │
│ 5. AssessmentRules                   │                                 │
│    - 5 Exam integrity rules          │                                 │
└──────────────────────────────────────┴─────────────────────────────────┘
```

### Mobile Responsive Ordering
On mobile devices (`< 1024px`), candidates must see the primary CTA and active attempt banner without scrolling through lengthy section lists. 
- Using pure CSS Flex/Grid reordering (`order-1 lg:order-2` on the sidebar column and `order-2 lg:order-1` on the main column), the primary action appears directly beneath the header on mobile.
- **Zero DOM Duplication**: Unlike naive implementations that render two separate action buttons with `hidden lg:block` and `block lg:hidden`, this page renders `AssessmentPrimaryAction` exactly **once** in the DOM tree, guaranteeing clean accessibility and zero test/screen-reader conflicts.

---

## 4. Component Architecture & Directory Structure

All components are encapsulated within `apps/web/src/features/assessments/`:

```
apps/web/src/features/assessments/
├── AssessmentDetailPage.tsx         # Page orchestrator; breadcrumb, layout shell, auth/404 handling
├── AssessmentSummary.tsx            # Compact 4-stat metric bar (Level, Duration, Questions, Sections)
├── AssessmentOverview.tsx           # Pre-flight briefing card ("À quoi vous attendre" - 4 pillars)
├── AssessmentSections.tsx           # Section-by-section breakdown (titles, instructions, questions)
├── AssessmentSkills.tsx             # Competency tags categorized by modality
├── AssessmentRules.tsx              # Exam integrity policies & server timer authoritative notices
├── AssessmentPrimaryAction.tsx      # State-aware CTA (Start / Resume / Restart) + Active Attempt banner
├── AssessmentHistoryPreview.tsx     # Past attempt summary card with score & estimated level
├── AssessmentDetailsSkeleton.tsx    # Zero-CLS layout-mirroring skeleton loader
├── useAssessmentDetail.ts           # Decoupled React Query hook, active session resolution, start API
├── types.ts                         # Domain data models & attempt state types
└── index.ts                         # Clean public barrel exports
```

---

## 5. Attempt Lifecycle & State-Aware Primary Action

The `AssessmentPrimaryAction` component deterministically transitions between 3 mutually exclusive states:

### 5.1 First-Time / Unstarted Candidate
- **Visual CTA**: `[Commencer l'évaluation]` with forward arrow icon.
- **Accessible Text**: Accessible to both standard screen readers and existing automated test runners.
- **Loading State**: Displays spinner with *"Initialisation de la session..."* while `POST /api/v1/assessments/:id/attempts` resolves.
- **Subtext Notice**: *"Une fois l'évaluation soumise, vos réponses ne pourront plus être modifiées."*

### 5.2 Active In-Progress Attempt
- **Trigger**: `GET /api/v1/assessments/me/active-attempt` returns an attempt matching this `assessment_id` with `remaining_seconds > 0`.
- **Active Attempt Banner**:
  - Emerald/Primary pulse badge: `[Session en cours]`.
  - Live remaining countdown: `Temps restant : 32 min`.
  - Question completion progress: `Vous avez une tentative non terminée (18 / 40 questions traitées)`.
- **Primary CTA**: `[Continuer l'évaluation]` routing straight to `/attempts/:attemptId`.

### 5.3 Previously Completed Assessment
- **Trigger**: Candidate has previously submitted this assessment (`lastAttempt.status === "submitted"`), with no ongoing attempt.
- **Primary CTA**: `[Recommencer l'évaluation]` allowing students to re-test their mastery.
- **Secondary CTA**: `[Voir mon dernier résultat (XX%)]` routing directly to `/attempts/:attemptId/results`.

---

## 6. Exam Integrity Rules & Content Security

### Content Security Invariant
- **No Early Leakage**: In strict accordance with platform security rules, the details page **never** queries or exposes individual questions, options, correct answers, or audio streams. Only high-level structural counts and instructions are transmitted.
- **Server Timer Rule**: Prominently displays:
  > **Chronomètre serveur faisant autorité** : Le temps est décompté en continu sur nos serveurs. Fermer votre navigateur n'interrompt pas le chronomètre de l'épreuve.
- **Single-Play Audio Notice**: For listening comprehension (`listening`), clearly specifies that recordings cannot be paused or replayed, mirroring official Paris Chamber of Commerce (CCI) test conditions.

---

## 7. Error Handling & Session Recovery

The details page implements resilient, human-centered error recovery:
- **Authentication Expiration (401)**:
  - Cleanly catches 401 unauthorized responses.
  - Clears stale tokens safely.
  - Renders friendly French `ErrorState`:
    - Title: *"Session expirée"*
    - Description: *"Votre session a expiré ou une authentification est requise pour accéder aux détails de cette épreuve."*
    - Action: `[Se reconnecter]` -> routes to `/login`.
  - **Zero machine codes**: Never exposes raw HTTP codes (`401`, `500`) or technical symbols (`AUTH_REQUIRED`) to candidates.
- **Archived / Missing Assessment (404)**:
  - Renders friendly French `ErrorState`:
    - Title: *"Cette évaluation n'est plus disponible"*
    - Description: *"L'épreuve demandée est introuvable ou a été archivée."*
    - Action: `[Retour aux simulations]` -> routes to `/assessments`.
- **Network / API Failure**:
  - Provides a contextual `[Réessayer]` action triggering React Query `refetch()`.

---

## 8. Verification & Quality Gates

The implementation satisfies all architectural quality gates:

| Verification Target | Command | Result |
|:---|:---|:---|
| **Assessment Details Unit Suite** | `npx vitest run tests/AssessmentDetail.test.tsx` | **12 / 12 PASSING** |
| **Student Journey E2E Test** | `npx vitest run tests/StudentAssessmentJourney.test.tsx` | **5 / 5 PASSING** |
| **Web Full Vitest Suite** | `npx vitest run` | **16 / 16 Suites, 106 / 106 PASSING** |
| **Web TypeScript & Production Build** | `pnpm --filter web build` | **0 TypeScript errors, 435ms build** |
| **Backend Assessment & Flow Tests** | `uv run pytest -q tests/test_assessments.py tests/test_student_assessment_flow.py` | **22 / 22 PASSING** |
| **Curriculum Content Integrity** | `uv run python scripts/validate_content.py` | **100% Content Audit PASS** |
| **Database Relational Integrity** | `uv run python scripts/validate_data.py` | **All 8 Vectors PASS, 0 Defects** |
