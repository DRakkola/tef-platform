# TEF Reading Question Bank — Canonical Taxonomy V1 Mapping & Validation Report

**Version:** 1.0.0-canonical  
**Date:** October 2026  
**Status:** Canonical & Audited  
**Associated Spec:** [`docs/taxonomy/TEF_READING_TAXONOMY_V1.md`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/docs/taxonomy/TEF_READING_TAXONOMY_V1.md)  
**Verification Engine:** [`TaggingValidationEngine`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/app/modules/admin/tagging_service.py)

---

## 1. Executive Summary

This report documents the psychometric skill tagging of the existing TEF Reading question bank against the canonical **TEF Reading Taxonomy V1**.

In accordance with TEF psychometric standards and the platform engineering contract:
1. **Modality & Task Type Coupling Decoupled**: Each question explicitly links to a canonical `TaskType` (`daily_document`, `press_article`, `professional_document`, etc.) reflecting the stimulus document format, decoupled from cognitive reasoning.
2. **Dimension Decomposition**: Every question is evaluated on two orthogonal dimensions:
   - **Cognitive Reasoning Dimension**: The specific intellectual operation required to answer (scanning, main idea extraction, causal inference, detail identification).
   - **Language Competency Dimension**: The transversal linguistic knowledge required to process the stimulus and options (vocabulary in context, synonym paraphrase, register and style, semantic nuance).
3. **No Superficial Keyword Tagging**: Mappings were determined by cognitive task analysis of the prompt, document stimulus, distractors, and correct option, assigning only the minimum sufficient competency set.
4. **Strict Normalization Rules**:
   - Exactly **one PRIMARY** reasoning competency per question (weight 1.0 or 0.70 when combined with a genuine composite secondary skill of 0.30).
   - Weights for each dimension sum to **1.0 ± 0.01**.
   - No inactive or deprecated skills can be tagged on published content.

---

## 2. Summary Matrix: Question Bank Assessment Profiles

| Item ID / Title | Task Type | CEFR | Primary Reasoning (Weight) | Secondary Reasoning (Weight) | Language Skills (Weight) | Psychometric Validation Status |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| **Demo Démo — Q1**<br>*(Avis Bibliothèque)* | `daily_document` | **A2** | `reasoning_identify_specific_detail`<br>*(PRIMARY, 1.0)* | *None* | `lang_vocab_in_context`<br>*(PRIMARY, 1.0)* | Verified Valid |
| **Demo Démo — Q2**<br>*(Pistes Cyclables)* | `press_article` | **B1** | `reasoning_identify_main_idea`<br>*(PRIMARY, 1.0)* | *None* | `lang_paraphrase_and_synonyms`<br>*(PRIMARY, 1.0)* | Verified Valid |
| **Simulation Studio — Q1**<br>*(Avis Bus Outaouais)* | `daily_document` | **A2** | `reasoning_identify_main_idea`<br>*(PRIMARY, 1.0)* | *None* | `lang_vocab_in_context`<br>*(PRIMARY, 1.0)* | Verified Valid |
| **Simulation Studio — Q2**<br>*(Arrêts Temporaires)* | `daily_document` | **B1** | `reasoning_identify_specific_detail`<br>*(PRIMARY, 1.0)* | *None* | `lang_paraphrase_and_synonyms`<br>*(PRIMARY, 1.0)* | Verified Valid |
| **Simulation Studio — Q3**<br>*(Essor Télétravail)* | `press_article` | **B2** | `reasoning_identify_specific_detail`<br>*(PRIMARY, 0.70)* | `reasoning_infer_implicit_meaning`<br>*(SECONDARY, 0.30)* | `lang_paraphrase_and_synonyms`<br>*(PRIMARY, 1.0)* | Verified Valid |
| **Blanc 1 — Q1**<br>*(Facteur Télétravail)* | `press_article` | **B1** | `reasoning_identify_cause_effect`<br>*(PRIMARY, 1.0)* | *None* | `lang_paraphrase_and_synonyms`<br>*(PRIMARY, 1.0)* | Verified Valid |
| **Blanc 1 — Q2**<br>*(Risque Outils Numériques)* | `press_article` | **B2** | `reasoning_identify_specific_detail`<br>*(PRIMARY, 0.70)* | `reasoning_infer_implicit_meaning`<br>*(SECONDARY, 0.30)* | `lang_semantic_nuance`<br>*(PRIMARY, 1.0)* | Verified Valid |
| **Drill Ex 10**<br>*(Courriel Administratif)* | `professional_document` | **B1** | `reasoning_understand_context`<br>*(PRIMARY, 1.0)* | *None* | `lang_register_and_style`<br>*(PRIMARY, 1.0)* | Verified Valid |

---

## 3. Item-by-Item Cognitive Analysis

### 3.1. Test Démo — Question 1 (Avis Bibliothèque Municipale)
- **Source:** [`apps/api/app/modules/assessments/seed.py`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/app/modules/assessments/seed.py)
- **Prompt:** *"Que pouvez-vous faire à la bibliothèque pendant la première quinzaine d'octobre ?"*
- **Stimulus:** *"AVIS DE LA BIBLIOTHÈQUE MUNICIPALE : En raison de travaux de rénovation énergétique, les salles d'étude du deuxième étage seront fermées du 1er au 15 octobre. Le service d'emprunt au rez-de-chaussée reste accessible aux horaires habituels."*
- **Correct Option:** *"Emprunter des livres au rez-de-chaussée."*
- **Task Type:** `daily_document` (Short practical public notice)
- **Cognitive Operation:** Locating an explicit operational condition / authorized activity in a brief public sign. The reader must isolate what remains accessible versus what is closed.
  - **Primary Reasoning:** `reasoning_identify_specific_detail` (weight 1.0)
  - **Secondary Reasoning:** None required.
- **Language Dependency:** Everyday administrative/public service vocabulary (`"première quinzaine d'octobre"` = `"1er au 15 octobre"`; `"service d'emprunt"` = `"Emprunter des livres"`).
  - **Language Competency:** `lang_vocab_in_context` (weight 1.0)
- **CEFR Level:** **A2** (Calibrated: Can understand short, simple notices and locate specific practical information).

---

### 3.2. Test Démo — Question 2 (Pistes Cyclables à Saint-Denis)
- **Source:** [`apps/api/app/modules/assessments/seed.py`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/app/modules/assessments/seed.py)
- **Prompt:** *"Quel est l'objectif principal visé par la municipalité à travers ce nouvel aménagement ?"*
- **Stimulus:** *"La municipalité de Saint-Denis a inauguré un nouveau réseau de pistes cyclables protégées reliant le centre-ville aux zones d'activités périphériques. L'objectif avoué est de réduire le recours à l'automobile individuelle de 25% d'ici cinq ans. Si les associations d'usagers saluent unanimement une avancée sécuritaire majeure, certains commerçants craignent une raréfaction des places de stationnement."*
- **Correct Option:** *"Diminuer l'utilisation des véhicules personnels de 25%."*
- **Task Type:** `press_article` (Civic journalism snippet with policy rationale and stakeholder opinions)
- **Cognitive Operation:** Identifying the overarching goal / thesis statement among conflicting local reactions.
  - **Primary Reasoning:** `reasoning_identify_main_idea` (weight 1.0)
  - **Secondary Reasoning:** None.
- **Language Dependency:** Paraphrase of civic/environmental policy language (`"réduire le recours à l'automobile individuelle"` $\rightarrow$ `"Diminuer l'utilisation des véhicules personnels"`).
  - **Language Competency:** `lang_paraphrase_and_synonyms` (weight 1.0)
- **CEFR Level:** **B1** (Calibrated: Can recognize the main thesis in straightforward journalistic texts).

---

### 3.3. Simulation Studio — Question 1 (Avis Société de Transport)
- **Source:** [`apps/api/seed_content_studio.py`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/seed_content_studio.py)
- **Prompt:** *"Quel est l'objet principal de cet avis aux usagers ?"*
- **Stimulus:** *"AVIS DE LA SOCIÉTÉ DE TRANSPORT DE L'OUTAOUAIS — En raison des travaux d'infrastructure majeurs sur le boulevard des Allumettières, les lignes express 22 et 34 seront détournées à compter de ce lundi 15 octobre, dès 06h00. Des arrêts temporaires sont aménagés à l'intersection de la rue Montcalm. Les usagers munis d'un titre mensuel régulier ne subiront aucune tarification supplémentaire."*
- **Correct Option:** *"Une modification d'itinéraire pour deux lignes de bus"*
- **Task Type:** `daily_document` (Public transit advisory)
- **Cognitive Operation:** Identifying the overall purpose / object of an everyday advisory notice without confusing it with secondary tariff clarifications.
  - **Primary Reasoning:** `reasoning_identify_main_idea` (weight 1.0)
  - **Secondary Reasoning:** None.
- **Language Dependency:** Deciphering everyday utilitarian vocabulary in context (`"détournées"`, `"lignes express"`, `"usagers"`).
  - **Language Competency:** `lang_vocab_in_context` (weight 1.0)
- **CEFR Level:** **A2** (Calibrated: Can understand the general message of a short public transit advisory).

---

### 3.4. Simulation Studio — Question 2 (Arrêts Temporaires Outaouais)
- **Source:** [`apps/api/seed_content_studio.py`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/seed_content_studio.py)
- **Prompt:** *"Que doivent faire les passagers pour emprunter les autobus détournés ?"*
- **Stimulus:** *(Same notice as 3.3)*
- **Correct Option:** *"Se rendre aux arrêts temporaires situés rue Montcalm"*
- **Task Type:** `daily_document`
- **Cognitive Operation:** Locating an explicit operational procedure / directive for passengers.
  - **Primary Reasoning:** `reasoning_identify_specific_detail` (weight 1.0)
  - **Secondary Reasoning:** None.
- **Language Dependency:** Paraphrase of practical directives (`"Des arrêts temporaires sont aménagés à l'intersection de la rue Montcalm"` $\rightarrow$ `"Se rendre aux arrêts temporaires situés rue Montcalm"`).
  - **Language Competency:** `lang_paraphrase_and_synonyms` (weight 1.0)
- **CEFR Level:** **B1** (Calibrated: Can extract specific practical guidelines from public notices).

---

### 3.5. Simulation Studio — Question 3 (Essor du télétravail au Canada)
- **Source:** [`apps/api/seed_content_studio.py`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/seed_content_studio.py)
- **Prompt:** *"D'après les sociologues cités, quel est l'inconvénient majeur du travail à distance ?"*
- **Stimulus:** *"Selon une étude publiée récemment par Statistique Canada, près de 40% des actifs canadiens exercent désormais tout ou partie de leurs fonctions professionnelles à distance. Si ce modèle hybride s'accompagne d'une réduction substantielle du temps de transport et d'une plus grande autonomie, plusieurs sociologues tirent la sonnette d'alarme quant aux risques de délitement du lien social et d'effacement des frontières entre vie privée et vie professionnelle."*
- **Correct Option:** *"Une fragilisation des relations humaines et de l'équilibre personnel"*
- **Task Type:** `press_article` (Sociological press report)
- **Cognitive Operation:** Composite operation at B2 level. Candidate must first identify the specific stance attributed to the sociologists (`"tirent la sonnette d'alarme quant aux risques"`), and secondly infer the conceptual equivalence between abstract sociological expressions (`"délitement du lien social"` and `"effacement des frontières"`).
  - **Primary Reasoning:** `reasoning_identify_specific_detail` (weight 0.70)
  - **Secondary Reasoning:** `reasoning_infer_implicit_meaning` (weight 0.30)
- **Language Dependency:** Advanced lexical reformulation of sociological concepts (`"délitement"` $\rightarrow$ `"fragilisation"`; `"lien social"` $\rightarrow$ `"relations humaines"`).
  - **Language Competency:** `lang_paraphrase_and_synonyms` (weight 1.0)
- **CEFR Level:** **B2** (Calibrated: Can understand specialized articles beyond their field with dense paraphrasing).

---

### 3.6. Demo Blanc 1 — Question 1 (Facteur du Télétravail)
- **Source:** [`apps/api/seed_demo.py`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/seed_demo.py)
- **Prompt:** *"Selon l'analyse présentée, quel est le principal facteur du développement du télétravail dans les grandes métropoles ?"*
- **Stimulus:** *"Une étude récente montre que l'adoption croissante du travail à distance est portée par le souhait des employés d'éviter les embouteillages quotidiens et d'obtenir une meilleure conciliation vie professionnelle et vie personnelle."*
- **Correct Option:** *"La recherche d'une meilleure conciliation vie professionnelle-personnelle et la réduction des trajets."*
- **Task Type:** `press_article`
- **Cognitive Operation:** Identifying explicit causal drivers (`"est portée par..."`).
  - **Primary Reasoning:** `reasoning_identify_cause_effect` (weight 1.0)
  - **Secondary Reasoning:** None.
- **Language Dependency:** Paraphrase of commute terms (`"éviter les embouteillages quotidiens"` $\rightarrow$ `"la réduction des trajets"`).
  - **Language Competency:** `lang_paraphrase_and_synonyms` (weight 1.0)
- **CEFR Level:** **B1** (Calibrated: Can identify causal connections in standard informative prose).

---

### 3.7. Demo Blanc 1 — Question 2 (Risque des Outils Numériques)
- **Source:** [`apps/api/seed_demo.py`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/seed_demo.py)
- **Prompt:** *"Quel risque majeur est souligné par l'auteur concernant la généralisation des outils numériques ?"*
- **Stimulus:** *(Same passage as 3.6)*
- **Correct Option:** *"L'effritement du lien social et le risque d'isolement des collaborateurs."*
- **Task Type:** `press_article`
- **Cognitive Operation:** Composite operation at B2 level: isolating the specific cautionary point and evaluating distractor options that propose extreme or fabricated consequences.
  - **Primary Reasoning:** `reasoning_identify_specific_detail` (weight 0.70)
  - **Secondary Reasoning:** `reasoning_infer_implicit_meaning` (weight 0.30)
- **Language Dependency:** Semantic precision and distinction of nuances (`"effritement"` vs `"baisse"`, distinguishing psychological impact from technical/economic issues).
  - **Language Competency:** `lang_semantic_nuance` (weight 1.0)
- **CEFR Level:** **B2** (Calibrated: Can grasp fine distinctions of risk and argumentative stance).

---

### 3.8. Reading Drill Exercise 10 (Courriel Administratif)
- **Source:** [`apps/api/seed_content_studio.py`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/seed_content_studio.py)
- **Prompt:** *"Dans un courriel administratif, quelle formule est appropriée pour solliciter un délai ?"*
- **Options:**
  - *"Je sollicite bienveillamment un report d'échéance"* (Correct)
  - *"Donnez-moi plus de temps sinon c'est impossible"* (Incorrect: familier / agressif)
  - *"Je verrai quand j'aurai le temps"* (Incorrect: inapproprié)
- **Task Type:** `professional_document` (Workplace administrative correspondence)
- **Cognitive Operation:** Identifying the pragmatic decorum and appropriateness of an administrative request in context.
  - **Primary Reasoning:** `reasoning_understand_context` (weight 1.0)
  - **Secondary Reasoning:** None.
- **Language Dependency:** Register and stylistic distinction between formal professional discourse and inappropriate colloquial register.
  - **Language Competency:** `lang_register_and_style` (weight 1.0)
- **CEFR Level:** **B1** (Calibrated: Can select register-appropriate formulaic expressions for administrative correspondence).

---

## 4. Psychometric Observations & Flagged Anomalies

### Observation 1: Distractor Symmetry in Studio Q1
- **Observation:** In Studio Q1 (*"Quel est l'objet principal de cet avis aux usagers ?"*), three options represent distinct transit actions (`"hausse des tarifs"`, `"modification d'itinéraire"`, `"inauguration d'une nouvelle ligne"`), while the fourth is an extreme distractor (`"La fermeture totale du réseau d'autobus"`).
- **Psychometric Impact:** While plausible at A2 level, extreme options (`"fermeture totale"`) tend to be discarded by test-takers through test-wiseness rather than textual comprehension.
- **Recommendation:** In subsequent question bank authoring, replace extreme distractors with moderate administrative alternatives (e.g., *"Un appel à candidature pour conducteurs"*).

### Observation 2: Single-Item Stimulus Coupling in Studio Section 1
- **Observation:** Section A features two questions (`Q1`, `Q2`) on a 65-word bus detour notice.
- **Psychometric Assessment:** Authentic TEF Section A items typically present one single question per brief notice (e.g. 4 distinct notices for 4 questions). However, for platform simulation and multi-skill testing (testing both Global Main Idea on Q1 and Specific Detail on Q2), paired items on a rich notice are psychometrically sound and increase evidence density.

### Observation 3: Incompatible Skill-TaskType Validation Guard
- **Observation:** The automated validation engine caught that `reasoning_identify_main_idea` initially omitted `daily_document` from its `applicable_task_types` in `reading_taxonomy_data.py`, despite the specification explicitly designating CEFR A2 descriptors for understanding the main purpose of announcements.
- **Resolution:** Re-aligned `reading_taxonomy_data.py` with `TEF_READING_TAXONOMY_V1.md` specification to include `daily_document`.

---

## 5. Verification & Test Suite Execution

All validation rules were executed programmatically against SQLite and PostgreSQL in-memory test databases:

1. **Tagging Integrity Suite (`test_reading_question_bank_tagging.py`):**
   - `test_reading_question_bank_canonical_tagging`: **PASSED**
   - `test_reading_assessment_submission_generates_granular_evidence`: **PASSED**
   - `test_content_studio_reading_questions_validation`: **PASSED**
   - `test_demo_blanc_reading_questions_validation`: **PASSED**
2. **Canonical Tagging Validation Engine Suite (`test_canonical_tagging.py`):**
   - 22/22 tests **PASSED**
3. **Assessment Scoring Engine Suite (`test_assessments.py`):**
   - 13/13 tests **PASSED**
4. **Linter & Code Standards:**
   - `ruff check`: **0 errors, all checks passed**
