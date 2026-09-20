# Student Dashboard UX Specification & Architecture

## 1. Executive Summary

The Student Dashboard (`/dashboard`) is the pedagogical control center for candidates preparing for high-stakes French language assessments (TEF Canada / TEF IRN).

### Guiding Principle: Action Beats Raw Statistics
Rather than overwhelming the candidate with an unfocused "wall of cards" or cosmetic metrics, the dashboard is strictly engineered around the daily study loop. Every element is prioritized to give immediate clarity on where the learner stands and what concrete action they should take next.

---

## 2. The 6-Question Pedagogical Hierarchy

The dashboard answers six core questions in strict top-to-bottom and left-to-right order:

| Step | Core Question | Architectural Component | Contents & Pedagogical Purpose |
|:---|:---|:---|:---|
| **1** | **Where am I?** | `AppHeader` + `ReadinessHero` | Breadcrumb trail (`Accueil > Tableau de bord`), Personalized greeting, Target examination badge (`TEF Canada`), Required target score/level (`Cible B2 (NCLC 7)`), and Exam countdown pill (`J-34`). |
| **2** | **What is my current situation?** | `ReadinessHero` | Current estimated CEFR level (`B1+`), Gap to required target, Overall readiness percentage (`74.2%`), Indicative confidence status (`Élevée 85%` or calibration indicator), and direct link to the full Readiness Report (`/readiness`). |
| **3** | **What should I do next?** | `NextActionCard` | Prominently elevated single highest-impact activity. For new students: 20-minute diagnostic test CTA. For returning students: targeted exercise, exam simulation, or review drill with modality icon, estimated duration (`~15 min`), pedagogical justification, and primary action button (`Commencer la pratique`). |
| **4** | **What are my weaknesses?** | `PrioritySkills` | Top 3-4 priority skills presenting an observed gap against the B2 (70%) benchmark. Each item displays skill name, current mastery score, gap percentage (`Écart -15%`), concrete pedagogical reason, and direct "S'entraîner" CTA. |
| **5** | **Am I improving?** | `ProgressOverview` | Chronological learning trajectory tracking score milestones across simulations, writing studios, and oral sessions. Features 7-day, 30-day, 90-day, and all-time range filters. For sparse histories ($\le 2$ points), displays discrete calibration milestones without deceptive interpolated trend lines. |
| **6** | **What did I just do?** | `RecentActivity` | Compact timeline feed summarizing the student's last 3-5 completed activities with relative timestamps (`Hier`, `Il y a 3 jours`), modality icons, verified scores/status, and direct deep-links to review feedback. |

---

## 3. Component Architecture & Props Contracts

All dashboard components reside in `apps/web/src/features/dashboard/`:

### 3.1 `ReadinessHero` (`ReadinessHero.tsx`)
```typescript
export interface ReadinessHeroProps {
  studentName?: string
  targetExam: string
  targetLevel: string
  targetCefrLevel?: string
  targetNclcLevel?: string
  currentCefrLevel?: string | null
  currentNclcLevel?: string | null
  overallReadiness: number | null
  daysRemaining?: number | null
  engagementStatus?: EngagementStatus
  totalAssessmentsTaken: number
}
```
- **Surface**: `bg-card`, `border-border/70`, `rounded-2xl`, `shadow-2xs`.
- **States**:
  - *Calibrated Student*: Displays numeric score (e.g. `74.2%`), current CEFR vs Target CEFR comparison, and progress meter.
  - *Uncalibrated / New Student*: Displays "Étalonnage initial", target level objective, and informative prompt to complete diagnostic.

### 3.2 `NextActionCard` (`NextActionCard.tsx`)
```typescript
export interface NextActionCardProps {
  recommendation?: RecommendedExerciseSummary | DailyTaskItem | null
  isNewStudent?: boolean
  onActionClick?: (action: any) => void
}
```
- **Surface**: High-emphasis container with subtle accent border (`border-primary/30 bg-primary/5`).
- **States**:
  - *New Student*: Focuses on initial diagnostic ("Passez votre premier test diagnostic") with 20-minute calibration notice.
  - *Returning Student*: Displays activity title, modality icon (reading, listening, writing, speaking, grammar), duration badge, priority pill (`Priorité critique` / `Priorité haute`), pedagogical justification, and primary action button.

### 3.3 `DailyPlanCard` (`DailyPlanCard.tsx`)
```typescript
export interface DailyPlanCardProps {
  dailyPlan?: DailyPlanData | null
  onTaskClick?: (task: DailyTaskItem) => void
}
```
- **Surface**: `bg-card`, `border-border/70`, `shadow-2xs`.
- **Contents**: Task checklist (max 4 items), task type badge, estimated duration (`font-mono tabular-nums`), completion badge (`1/2`), and daily minutes budget (`45 minutes`).

### 3.4 `PrioritySkills` (`PrioritySkills.tsx`)
```typescript
export interface PrioritySkillsProps {
  skills?: WeakestSkillSummary[]
  onPracticeSkill?: (skill: WeakestSkillSummary) => void
}
```
- **Surface**: `bg-card`, `border-border/70`, `shadow-2xs`.
- **Contents**: Top 3-4 weak skills with mastery percentage, gap badge (`Écart -18%`), progress bar against 70% threshold, pedagogical error diagnosis, and direct "S'entraîner" CTA.

### 3.5 `ProgressOverview` (`ProgressOverview.tsx`)
```typescript
export interface ProgressOverviewProps {
  timeline?: ProgressDataPoint[]
  isLoading?: boolean
  error?: Error | null
  onRetry?: () => void
}
```
- **Surface**: `bg-card`, `border-border/70`, `shadow-2xs`.
- **Controls**: Filter pills (`7j`, `30j`, `90j`, `Tout`).
- **Data Integrity**: Never renders fabricated or smoothed curves when data is sparse. Displays explicit calibration notice for $\le 2$ evaluations.

### 3.6 `RecentActivity` (`RecentActivity.tsx`)
```typescript
export interface RecentActivityProps {
  assessments?: RecentAssessmentSummary[]
  writings?: RecentWritingSummary[]
  speakingSessions?: RecentSpeakingSummary[]
  onViewAll?: () => void
}
```
- **Surface**: `bg-card`, `border-border/70`, `shadow-2xs`.
- **Contents**: Unified chronological feed of recent submissions, relative timestamps (`À l'instant`, `Hier`, `Il y a 3 jours`), status badges, and review links.

---

## 4. Responsive Layout & Spacing

The dashboard employs a 2-column layout designed to maximize information density without clutter:

```
+------------------------------------------------------------------------------------+
| AppHeader: Accueil > Tableau de bord                        [Notifications] [User] |
+------------------------------------------------------------------------------------+
| ReadinessHero: Target B2 (NCLC 7) | Countdown J-34 | Overall Readiness: 74.2%      |
+--------------------------------------------------+---------------------------------+
| Main Column (8 cols)                             | Secondary Column (4 cols)       |
|                                                  |                                 |
| 1. NextActionCard                                | 1. DailyPlanCard                |
|    - Modality icon, ~15 min, Priority badge      |    - Checklist (max 4 items)    |
|    - Title & Pedagogical reason                  |    - Daily budget: 30 min       |
|    - Primary CTA [Commencer la pratique]         |    - [Faire] / [Revoir] actions |
|                                                  |                                 |
| 2. ProgressOverview                              | 2. PrioritySkills               |
|    - Time range filters: [7j] [30j] [90j] [Tout] |    - Top 3-4 weakest skills     |
|    - Chronological milestone cards               |    - Gap -15% badge             |
|    - Discrete calibration points                 |    - [S'entraîner] button       |
|                                                  |                                 |
|                                                  | 3. Upcoming Teacher Booking     |
|                                                  |    - Verified instructor & slot |
|                                                  |                                 |
|                                                  | 4. RecentActivity               |
|                                                  |    - Last 3-5 completed events  |
|                                                  |    - Score badges & review deep |
+--------------------------------------------------+---------------------------------+
```

### Breakpoints:
- **Desktop ($\ge 1024\text{px}$)**: 2-column layout (8 cols / 4 cols) in `PageShell maxWidth="default"`.
- **Tablet ($768\text{px} - 1023\text{px}$)**: Balanced stacked layout with 2-column sub-grids.
- **Mobile ($< 768\text{px}$)**: Single column stacked in exact pedagogical order (Hero $\rightarrow$ Next Action $\rightarrow$ Daily Plan $\rightarrow$ Priority Skills $\rightarrow$ Trajectory $\rightarrow$ Recent Activity).

---

## 5. Error & Authentication Resilience

1. **Centralized Auth Expiration Interception**:
   - HTTP 401 triggers clean token clearance (`localStorage.removeItem("auth_token")`) and throws an `AuthRequiredError`.
   - Machine error strings like `AUTH_REQUIRED` or `401` are intercepted by `ErrorState` and translated to human-readable French ("Session expirée ou connexion requise").
   - Action button directs the user cleanly to authentication without crashing or exposing raw stack traces.

2. **Decoupled Data Streaming (Partial Failure Isolation)**:
   - `useStudentDashboard` fetches the primary dashboard and progress timeline independently.
   - If progress history is delayed or encounters an error, the core dashboard (Readiness, Next Action, Daily Plan, Weak Skills) continues to render seamlessly.
   - `ProgressOverview` renders its own localized error/retry state.
