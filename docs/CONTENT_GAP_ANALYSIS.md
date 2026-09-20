# TEF Canada Platform — Curriculum Content Gap Analysis & Expansion Roadmap

**Document Version:** 2.1.0-rc  
**Date:** September 18, 2026  
**Audited By:** Academic Lead (TEF Certified Pedagogical Expert) & Curriculum Architect  
**Curriculum Standard:** CCIP TEF Canada Examination Guidelines & NCLC Equivalency  
**Status:** CURRICULUM AUDIT & EXPANSION PLAN  

---

## 1. Executive Summary

To prepare candidates effectively for Canadian immigration thresholds (NCLC 7 / CEFR B2), the platform requires a balanced distribution of curriculum content across all four competencies:
1. **Compréhension Écrite (CE)** — Reading comprehension
2. **Compréhension Orale (CO)** — Listening comprehension
3. **Expression Écrite (EE)** — Written expression (Sections A & B)
4. **Expression Orale (EO)** — Oral expression (Sections A & B)

This audit establishes the baseline inventory, quantifies critical content deficits, and defines the expansion roadmap for certified authoring. **In accordance with pedagogical integrity standards, no content is automatically published by generative AI without certified native Francophone review and approval.**

---

## 2. Current Curriculum Inventory Baseline

| Competency Domain | Published Assessments | Published Questions | Micro-Exercises | Writing Tasks | Speaking Scenarios / Topics | Audio Assets |
|---|---|---|---|---|---|---|
| **Compréhension Écrite** | 1 full exam (60 min) | 3 questions | 4 exercises | — | — | — |
| **Compréhension Orale** | 1 full exam (40 min) | 2 questions | 2 exercises | — | — | 2 `.mp3` tracks |
| **Expression Écrite** | — | — | 3 exercises | 2 tasks (Sec A + B) | — | — |
| **Expression Orale** | — | — | 2 exercises | — | 8 scenarios | 2 sample audios |
| **Total Published Units** | **2 Assessments** | **5 Questions** | **11 Exercises** | **2 Tasks** | **8 Scenarios** | **4 Media Assets** |

*All 32 existing items were validated with 0 defects via the `validate-content` CLI ([`docs/BETA_CONTENT_AUDIT.md`](file:///C:/Users/MSI/Documents/tef-platform/docs/BETA_CONTENT_AUDIT.md)).*

---

## 3. Quantitative Gap Analysis by Domain

### 3.1 Compréhension Orale (Listening Deficit — CRITICAL)
- **Current Inventory:** 2 audio questions and 2 micro-exercises.
- **Target Examination Demand:** The official TEF Canada listening exam comprises 60 questions across 4 sections with varying audio speed, accents (Metropolitan French, Québécois, international francophone), and background ambient noise (train station announcements, radio broadcasts, telephone dialogues).
- **Identified Shortage:**
  - Need $\ge 18$ new audio items across levels B1 (6 items), B2 (8 items), and C1 (4 items).
  - Shortage of Québécois / Canadian French phonological variants (e.g., diphthongization, colloquial idioms used in Radio-Canada broadcasts).
  - Need short audio snippets (15–30s) for rapid listening micro-exercises.

### 3.2 Expression Écrite (Writing Task Shortage — HIGH)
- **Current Inventory:** 1 Section A (Fait divers: *L'incendie insolite d'une boulangerie*) and 1 Section B (Lettre d'opinion: *Le télétravail obligatoire*).
- **Identified Shortage:**
  - Repeating the same 2 tasks causes artificial learning plateauing for students submitting multiple essays.
  - Need at least 6 new Section A prompts (mysterious discovery, unexpected rescue, meteorological event, municipal dispute, scientific oddity).
  - Need at least 6 new Section B persuasive letters covering contemporary Canadian social themes:
    - *L'interdiction des véhicules à essence dans les centres-villes.*
    - *L'intégration de l'intelligence artificielle dans les écoles secondaires.*
    - *Le financement public des énergies renouvelables vs hydrocarbures.*
    - *La semaine de travail de quatre jours.*
    - *La préservation du patrimoine linguistique francophone.*

### 3.3 Expression Orale (Roleplay Scenario Shortage — MEDIUM)
- **Current Inventory:** 8 scenarios in the Peer Practice Pool.
- **Identified Shortage:**
  - Section A (Inquiry): Only 4 scenarios. Candidates need realistic practice with administrative inquiries (renting an apartment in Montreal, enrolling in a college course, applying for a volunteer program, querying a travel agency).
  - Section B (Persuasion): Only 4 scenarios. Candidates need scenarios addressing hesitant interlocutors (convincing a friend to relocate to a rural province, persuasive pitch to participate in an eco-marathon, adopting a pet from a shelter).

### 3.4 Micro-Exercises & Skill Remediation Coverage
- **Grammar & Morphosyntax Deficits:**
  - *Subjonctif:* Only 2 exercises; need exercises specifically targeting verbs of feeling, necessity, and concession (*bien que, quoique*).
  - *Pronoms personnels compléments:* Absence of dedicated drills for double pronoun placement (`me le`, `te les`, `lui en`, `y en`).
  - *Concordance des temps:* Need exercises contrasting *passé composé* (discrete completed action) and *imparfait* (habitual state/context).

---

## 4. CEFR & NCLC Distribution Matrix

```
Target Distribution (Blue) vs. Current Inventory (Red):

Level   Current Items   Target Inventory (GA)   Gap
---------------------------------------------------
A1/A2   2               8                       -6
B1      4               24                      -20
B2      5               36 (Core Target)        -31
C1      0               12                      -12
C2      0               4                       -4
---------------------------------------------------
Total   11              84                      -73
```

---

## 5. Human-in-the-Loop Content Authoring Protocol

To scale curriculum while guaranteeing 100% academic rigor:

1. **Draft Generation (AI-Assisted in Content Studio):**
   - Authors draft prompts and distractors in Admin Content Studio (`/admin/content`).
   - Automated checks verify that distractors reflect common Francophone learner errors without ambiguous phrasing.
2. **Pedagogical Review & Peer Sign-Off:**
   - Certified TEF examiner validates rubric alignment, word counts, and CEFR level calibration.
   - The status is transitioned from `draft` to `review` with formal reviewer ID logging (`content_reviews` table).
3. **Audio Production Standards:**
   - Studio recordings or high-fidelity neural voice synthesis with authentic prosody.
   - Bitrate: 128 kbps minimum, 44.1 kHz, normalized to $-16\text{ LUFS}$.
4. **CLI Pre-Deployment Verification:**
   - Prior to staging deployment, `uv --project apps/api run python scripts/validate_content.py` must run and exit code `0`.

---

## 6. Content Release Schedule

- **Sprint 1 (V2.1):** 4 new Writing Tasks (2 Sec A, 2 Sec B) + 6 Micro-Exercises (Subjonctif & Pronoms).
- **Sprint 2 (V2.2):** 10 new Compréhension Orale audio items with Canadian French variations.
- **Sprint 3 (V2.3):** Full Practice Simulation Exam #2 covering all 4 modules.
