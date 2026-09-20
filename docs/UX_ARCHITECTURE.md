# TEF Platform User Experience Architecture

## 1. Information Architecture & Navigation Model

The student experience is anchored around a five-pillar navigation model. Each pillar addresses a distinct phase of the language acquisition and exam preparation cycle.

```
[Student Portal Shell]
  │
  ├── 1. Dashboard (/dashboard) ────────── "What should I do right now?" (Daily Plan, Next Best Action)
  ├── 2. Practice (/practice) ──────────── "I want to train specific weaknesses" (Skill catalog, drills)
  ├── 3. Progress (/progress) ──────────── "How am I progressing toward B2/NCLC 7?" (Diagnostic trends)
  ├── 4. Teachers (/teachers) ──────────── "I want expert human feedback" (Verified instructors, bookings)
  └── 5. Practice Pool (/practice-pool) ── "I want to speak with a peer" (Audio-only 15-min paired chat)

[Distraction-Free Focus Modalities]
  ├── Official Simulation (/assessments/:id, /attempts/:id) ── Fullscreen exam conditions
  └── Official Writing Studio (/writing/tasks/:id) ────────── Two-pane focus editor with live word count
```

---

## 2. Navigation Architecture Details

### Desktop Application Shell (`AppShell.tsx` & `AppSidebar.tsx`)
- **Dual-Surface Chrome**: Dark charcoal sidebar (`oklch(0.18 0.015 250)`) paired with an inset, rounded workspace canvas (`SidebarInset` with `rounded-2xl`, hairline border, and subtle shadow).
- **Official shadcn `sidebar-08` Implementation**:
  - Header: Brand icon + "Portail TEF" label + Collapsible icon rail toggle (`SidebarTrigger`).
  - Primary Pillar Navigation (5 routes):
    1. Tableau de bord (`/dashboard`)
    2. Pratique (`/practice`)
    3. Progression & Diagnostic (`/progress` & `/readiness`)
    4. Professeurs (`/teachers`)
    5. Practice Pool (`/practice-pool`)
  - Secondary Groups:
    - Outils d'évaluation: Simulations d'examen (`/assessments`), Atelier d'écriture (`/writing`).
    - Compte & Support: Facturation (`/billing`), Aide & FAQ.
  - User Account Dropdown: Displays student name, email, avatar, quick profile navigation, and logout.
- **Top Header Bar (`AppHeader.tsx`)**:
  - 56px compact chrome header.
  - `SidebarTrigger` button.
  - Dynamic breadcrumb path navigation.
  - `NotificationCenter` popover bell for real-time announcements.

### Mobile & Responsive Navigation
- Collapsible sidebar transforms into an accessible off-canvas drawer on screens $< 768\text{px}$.
- `useIsMobile` hook provides reactive breakpoint detection with fallback for headless/jsdom environments.
- 44px minimum tap targets across all mobile navigation links and buttons.

---

## 3. Screen-by-Screen Architectural Responsibilities

### 1. Student Dashboard (`/dashboard`)
- **Primary Question Answered**: *"What should I do today to reach my target score?"*
- **Hero Card**: Highlights the single Next Best Action (calibrated to the student's weakest skill gap or scheduled daily drill), current CEFR/NCLC level, and immigration target deadline countdown.
- **Metric Row**: Estimated level, total practice minutes, assessment score average, target readiness percentage.
- **Two-Column Layout**:
  - Left (8 cols): Today's structured daily plan (with time budget) + Top 3 weakest skills to reinforce (with gap percentage).
  - Right (4 cols): Teacher coaching CTA + Peer Practice Pool instant matcher + Full simulation catalog trigger.

### 2. Practice Explorer (`/practice`)
- **Primary Question Answered**: *"Where can I find targeted exercises for my weak areas?"*
- **Recommended Section First**: Surfaces highest-priority diagnostic recommendations before general browsing.
- **Skill Filter Tabs**: Reading, Listening, Writing, Speaking, Grammar, Vocabulary, Conjugation.
- **Level Chips**: All, B1, B2, C1 with real-time reactive filtering and duration indicators.

### 3. Progress & Diagnostic Hub (`/progress` & `/readiness`)
- **Primary Question Answered**: *"Am I ready for the official exam?"*
- **Diagnostic Engine**: Displays Bayesian ability estimates, score confidence intervals, and decay-weighted observations.
- **Methodology Transparency**: Explainable algorithm accordion detailing why scores changed, discounting old observations with a 45-day half-life.
- **Official Compliance Disclaimers**: Clear indicators that scores are internal educational estimates, not CCI certificates.

### 4. Certified Teachers Directory & Booking (`/teachers` & `/teachers/:id`)
- **Primary Question Answered**: *"How do I get professional evaluation from an accredited examiner?"*
- **Directory**: Instructor cards displaying accreditation badges, pricing in local currency (CAD/EUR), timezones, and specializations.
- **Detail & Booking**: Date picker, timezone-aware 60-minute slots, note input, and seamless checkout confirmation modal.

### 5. Peer Practice Pool (`/practice-pool`)
- **Primary Question Answered**: *"How can I practice speaking without fear or scheduling overhead?"*
- **Immediacy**: 1-click level selection (B1/B2/C1) and discussion prompt preview.
- **Privacy & Safety**: Strict audio-only guarantee (no camera activation required) with automatic pseudonym assignment (Zero-PII).
- **Session Flow**: 15-minute countdown timer with structured conversation phases.

---

## 4. Distraction-Free Execution Environments

To simulate official test center conditions and minimize cognitive friction, examination routes run outside the standard sidebar layout:

1. **Assessment Taking Mode (`/assessments/:id`)**:
   - Stripped header with countdown timer, server autosave badge, question navigation drawer, and emergency exit confirmation.
   - Enforces strict replay policies on listening audio (`LINEAR_LOCK`).

2. **Writing Studio (`/writing/tasks/:id`)**:
   - Split 5/7 column workspace: Left pane holds the immutable official prompt and grading rubric; Right pane provides the writing canvas.
   - Live word count with compliance badges (e.g., `228 / 200-250 mots`), debounced autosave (`Sauvegardé`), and AI vs Teacher evaluation selection.
