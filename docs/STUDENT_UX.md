# TEF Platform Student User Experience Guide

## 1. Student Persona & Learning Context

Candidates using the TEF Platform are typically international professionals, students, or immigration applicants seeking Canadian Permanent Residency (via Express Entry / PNP) or French nationality. 

### Emotional & Cognitive State
- **High Stakes**: Achieving NCLC 7+ ($B2$) is often the deciding factor in visa and immigration point calculations.
- **Time-Constrained**: Most candidates balance full-time careers with evening/weekend study sessions.
- **Anxiety Around Oral & Written Sections**: Self-study candidates lack reliable feedback mechanisms for Expression Orale and Expression Écrite.

### UX Heuristics Applied
1. **Never Leave the Student Wondering What to Do Next**: Every session starts with an obvious primary action.
2. **Reward Effort with Clarity, Not Gimmicks**: Avoid patronizing streaks, cartoon avatars, and false progress bars. Provide clear statistical feedback on mastery and time investment.
3. **Respect Authenticity**: Practice exercises and prompts must reflect genuine CCI Paris Île-de-France formats and grading rubrics.

---

## 2. Core User Journeys

### Journey A: Daily Practice Session (15–30 Minutes)
1. Student lands on `/dashboard`.
2. The **Next Best Action** card immediately highlights today's highest-leverage task (e.g., *"Exercice ciblé — Pronoms relatifs composés"* to bridge a 15% grammar gap).
3. Student clicks **"Continuer l'entraînement"** and enters the drill.
4. Upon completing the drill, the student is returned to the dashboard where the daily plan counter updates (e.g., `1 / 3 complété`) and the skill metric reflects the new observation.

### Journey B: Timed Writing Task with Feedback Selection
1. Student navigates to `/writing` and picks an official Section B prompt.
2. Student enters the distraction-free Writing Editor (`/writing/tasks/:id`).
3. During drafting, the live counter displays compliant word boundaries (`215 / 200-250 mots`). The autosave indicator reassures the student that drafts are secured every 800ms.
4. When clicking **"Soumettre"**, a dialog presents two distinct evaluation options:
   - **Évaluation IA**: Instant indicative scoring according to TEF criteria.
   - **Professeur certifié**: Comprehensive human annotation with a certified instructor under 24 hours.

### Journey C: Booking an Oral Coaching Session with an Examiner
1. Student identifies an oral comprehension or interaction roadblock on `/readiness`.
2. Student navigates to `/teachers`.
3. Filters by specialization (*"Expression orale"*) and target level (*"B2"*).
4. Selects *Prof. Martin Dufresne* and navigates to `/teachers/t-1`.
5. The student views availability converted to their local browser timezone, selects a 60-minute slot, adds session goals, and confirms booking.
6. The session appears in the dashboard's **"Session de coaching réservée"** card with direct link to the virtual classroom.

### Journey D: Peer Speaking Match (Practice Pool)
1. Student wants speaking immersion without formal scheduling overhead.
2. Navigates to `/practice-pool`.
3. Chooses level (*"B2"*), reviews the structured prompt (*"Commander au café"*), and clicks **"Enter Practice Pool"**.
4. System queues the student with a protective pseudonym (*"Voyageur Étoilé #77"*).
5. A peer match is found; student accepts the connection.
6. A 15-minute audio session begins with guided prompt cards and phase transitions.

---

## 3. Transparency & Examination Compliance

### Diagnostic Estimation vs. Official Certification
All predictive ratings on `/progress`, `/readiness`, and `/dashboard` carry explicit compliance banners:
> *"Estimation pédagogique interne basée sur notre algorithme de préparation. Seuls les examens officiels administrés par un centre agréé de la CCI Paris Île-de-France délivrent une attestation de résultats officielle."*

### Audio Playback Integrity
In accordance with official TEF exam regulations:
- Test simulations lock listening tracks to a single uninterrupted playback without pause or scrub capabilities.
- Free practice drills allow deliberate repetition and scrub controls for pedagogical remediation.
