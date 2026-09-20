# Student Writing Workspace UX Specification & Architecture

## 1. Executive Summary & Product Purpose

The **Student Writing Workspace** (`/writing/tasks/:id` / `/writing/:id`) provides a calm, high-focus, distraction-free examination and practice environment for French written expression (TEF Canada / TEF IRN Expression Écrite: Section A fait divers/récit, Section B lettre d'opinion formelle).

### Core Design Principles
1. **Calm & Distraction-Free**: Strips away standard application navigation, marketing sidebars, and extraneous UI to create a focused testing atmosphere.
2. **Server-Authoritative Reliability**: Timers and drafts are synchronized with server endpoints (`expires_at`, `current_revision`). Candidates never lose written work during network interruptions.
3. **Examination-Accurate Word Counting**: Follows official French examination rules (elisions split on straight/curly apostrophes, hyphens retained in compound words) matching the backend algorithm `count_words_french`.
4. **Friction-Based Academic Integrity**: Intercepts copy-paste and drag-and-drop actions with educational notices without locking out assistive technologies or breaking typing.
5. **Clear Correction Routing**: Candidates choose between instant AI diagnostic evaluation (CEFR estimate, error localization) and certified human teacher review.

---

## 2. Layout Architecture & Responsive Strategy

The Writing Workspace leverages [`FocusedWritingShell`](file:///C:/Users/MSI/Documents/tef-platform/apps/web/src/components/layout/FocusedWritingShell.tsx) with a balanced **two-pane 12-column grid** on desktop (`lg:grid-cols-12`):

```
┌────────────────────────────────────────────────────────────────────────┐
│ Header: [← Quitter] • Title & Section • Save Status • [Timer] • [Soumettre] │
├──────────────────────────────────────┬─────────────────────────────────┤
│ LEFT PANE (5 cols / 12)              │ RIGHT PANE (7 cols / 12)        │
│                                      │                                 │
│ 1. Header & Section Badge            │ 1. Editor Subheader             │
│    - "Consigne officielle TEF"       │    - Save Badge (Sauvegardé,    │
│    - Section A / Section B badge     │      Enregistrement, Hors ligne)│
│                                      │    - Live Word Counter Badge    │
│ 2. Target Constraints Card           │                                 │
│    - Target range (e.g. 200 à 250)   │ 2. Main Writing Canvas          │
│    - Duration (e.g. 60 min)          │    - French-friendly typography │
│                                      │    - 4-space Tab indentation    │
│ 3. Document Support (Stimulus)       │    - Anti-copy/drop UX notice   │
│    - Reference text in font-serif    │    - Read-only banner if closed │
│                                      │                                 │
│ 4. Official Subject / Prompt         │ 3. Editor Subfooter             │
│    - Clear, formatted writing task   │    - Tab shortcut reminder      │
│                                      │    - Character counter          │
│ 5. Official Grading Criteria         │                                 │
│    - Length, structure, vocabulary,  │                                 │
│      syntax, argumentation           │                                 │
└──────────────────────────────────────┴─────────────────────────────────┘
```

### Responsive & Mobile Adaptation (`< 1024px`)
- The two columns stack vertically into a natural document flow.
- The left pane includes a mobile collapse toggle (`Réduire` / `Afficher`) so students on smaller screens can hide the instructions once read and maximize editing viewport height.
- The textarea maintains a minimum height of `460px` with no horizontal overflow.

---

## 3. Server-Authoritative Clock & Timer Escalation

The timer is governed by `expires_at` returned by the server attempt model:

```ts
const nowMs = Date.now()
const expiresMs = new Date(attempt.expires_at).getTime()
const remainingSeconds = Math.max(0, Math.floor((expiresMs - nowMs) / 1000))
```

### Visual Escalation Hierarchy

| State | Remaining Time | Visual Styling | Screen-Reader Announcement |
|:---|:---|:---|:---|
| **Normal** | `> 300s` (`> 5 min`) | Neutral border, muted background, subdued clock | Silent (avoids polling noise) |
| **Warning** | `60s < t <= 300s` | Amber border, subtle amber accent, `font-bold` | Polite announcement at 5 min |
| **Critical** | `1s <= t <= 60s` | Red border, pulse animation, contrast boost | Polite announcement at 1 min |
| **Expired** | `0s` | Red background, displays `00:00`, triggers read-only lock | *"Temps d'examen écoulé. Copie verrouillée."* |

---

## 4. French Examination Word Counter

The word counting algorithm in [`wordCounter.ts`](file:///C:/Users/MSI/Documents/tef-platform/apps/web/src/features/writing/utils/wordCounter.ts) mirrors `count_words_french` in `apps/api/app/modules/writing/utils.py`:

### Linguistic & Examination Rules
1. **Elisions split into distinct words**:
   - `d'accord` → 2 words (`d'` + `accord`)
   - `l'eau` / `l’eau` → 2 words (handles both straight `'` and typographic curly `’` apostrophes)
   - `j'ai` → 2 words
   - `qu'il` → 2 words
   - `aujourd'hui` → 2 words
2. **Hyphenated compound words treated as 1 word**:
   - `socio-économique` → 1 word
   - `peut-être` → 1 word
   - `rendez-vous` → 1 word
3. **Compound words with elisions**:
   - `c'est-à-dire` → 2 words (`c'` + `est-à-dire`)
4. **Diacritics & Accents**:
   - Full Unicode support for French characters (`é`, `è`, `ê`, `ë`, `à`, `â`, `î`, `ï`, `ô`, `ù`, `û`, `ü`, `ç`, `æ`, `œ`).

### Compliance Feedback & Visual States

| Category | Condition | Visual Indicator | Status Message |
|:---|:---|:---|:---|
| **Below Minimum** | `wordCount < minWords` | Amber badge & border | *"Encore X mot(s) pour atteindre le minimum requis"* |
| **In Range** | `minWords <= wordCount <= maxWords` | Emerald badge & border | *"Longueur conforme (X–Y mots)"* |
| **Above Maximum** | `wordCount > maxWords` | Red destructive badge | *"Attention : X mot(s) au-delà de la limite maximale"* |

---

## 5. Anti-Copy/Paste & Academic Integrity UX

Rather than intrusive JavaScript that breaks browser accessibility or causes input bugs:
- **Paste Interception**: Intercepts `onPaste` on the editor textarea, shows a polite informational alert:
  > *"Le copier-coller est désactivé pendant cette simulation d'épreuve pour refléter les conditions réelles d'examen."*
- **Drop Interception**: Prevents dragging external text directly into the textarea.
- **Typing Integrity**: Native keyboard typing, arrow keys, backspace, and delete are never blocked.
- **Tab Indentation**: Intercepts `Tab` key to insert 4 spaces for proper French paragraph indentation, maintaining cursor positioning.

---

## 6. Autosave & Revision Conflict Handling

State management in [`useWritingSession.ts`](file:///C:/Users/MSI/Documents/tef-platform/apps/web/src/features/writing/useWritingSession.ts) provides robust resilience:
- **Debounced Network Sync**: Automatically saves drafts to `PUT /api/v1/writing/attempts/{id}/draft` with an 800ms debounce after user stops typing.
- **Revision Number Tracking**: Each save increments `revision_number`.
- **409 Conflict Recovery**: If the server rejects with 409 (stale revision conflict), the hook fetches the latest server attempt, updates `current_revision`, and re-attempts save without discarding student text.
- **Local Storage Backup**: Every keystroke mirrors to `sessionStorage` (`tef_writing_draft_{attemptId}`) to survive page refreshes or unexpected tab closures.
- **Offline / Online Recovery**: When network drops, status updates to `offline` ("Hors ligne (brouillon local)"); when the browser triggers `online`, draft sync automatically re-fires.

---

## 7. Submission & Exit Confirmation Dialogs

### Submit Dialog (`SubmitWritingDialog`)
- **Compliance Check**: Displays current word count with pass/warning/fail color coding and delta to required minimum/maximum.
- **Time Remaining**: Shows remaining clock time.
- **Correction Routing**:
  - **Évaluation IA**: Instant indicative evaluation, error breakdown, CEFR level estimation (included).
  - **Professeur certifié**: Human teacher evaluation with personalized annotations within 24h (1 credit).
- **Submission Feedback**: Shows success animation and links directly to `/writing` submissions list.

### Exit Dialog (`WritingExitDialog`)
- Triggered when candidate clicks "Quitter".
- Warns that the official exam clock continues to tick on the server even after leaving.
- Provides immediate actions: "Poursuivre la rédaction" or "Quitter maintenant".

---

## 8. Verification & Test Coverage

| Test Suite | Scope | Status |
|:---|:---|:---|
| `tests/WritingWorkspace.test.tsx` | 20 unit & integration tests (word counter, shell, editor, tab, anti-copy, submit dialog, exit dialog, loading skeleton, 404 handling) | **PASS (20/20)** |
| `tests/StudentExperienceOverhaul.test.tsx` | 10 end-to-end user experience flow tests | **PASS (10/10)** |
| Full Web Suite (`apps/web`) | 21 test files across entire frontend application | **PASS (197/197)** |
| Web Production Build | `pnpm --filter web build` (TypeScript compilation & Vite bundle) | **PASS (0 errors, 451ms)** |
| Backend Writing API | `uv run pytest -q tests/test_writing.py` in `apps/api` | **PASS (9/9)** |
| Content Integrity Audit | `scripts/validate_content.py` | **PASS (100% valid)** |
| Database Integrity Audit | `scripts/validate_data.py` | **PASS (8/8 vectors)** |
