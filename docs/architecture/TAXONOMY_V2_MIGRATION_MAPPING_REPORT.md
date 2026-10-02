# TEF Taxonomy V2 Migration & Duplicate Mapping Report

**Date:** 2026-10-02  
**Database Target:** Supabase PostgreSQL (`public` schema)  
**Migration ID:** `0030_taxonomy_v2_normalization`  
**Related Specs:** `TEF_SKILL_SYSTEM_REFERENCE.md`, `docs/architecture/TEF_TAXONOMY_V2_IMPLEMENTATION_SPEC.md`

---

## 1. Executive Summary

This report documents the exhaustive data inventory, duplicate concept identification, reconciliation mapping, and schema normalization executed for **Taxonomy V2**.

Prior to this migration:
- `skills` contained 25 rows with mixed taxonomy conventions (legacy test codes `READ_FAITS`, Content Studio slugs `reading_comp`, and learning seed slugs `reading_comprehension`).
- `sub_skills` contained 28 rows, 20 of which existed only in `sub_skills` without a canonical `skills` record.
- Three reading subskills (`reading_detail`, `reading_gist`, `reading_inference`) were orphaned with `parent_id = NULL` and `category = NULL`.
- `question_skill_tags`, `exercise_skills`, and `mistakes` stored subskills as raw text strings (`subskill` column).
- Foreign key constraints on student analytics (`student_skills`, `skill_evidences`, `skill_assessments`) used `ON DELETE CASCADE`, risking catastrophic data loss upon skill deletion.

This migration unifies all competencies into **ONE canonical `skills` table**, creates directed relations between duplicate/equivalent concepts, resolves all string references into typed foreign keys, introduces task types and CEFR descriptors, and establishes `ON DELETE RESTRICT` guarantees to protect student history.

---

## 2. Exhaustive Data Inventory

### 2.1 Table Row Counts (Pre-Migration)

| Table | Pre-Migration Rows | Status |
| :--- | :--- | :--- |
| `skills` | 25 | All retained. Backfilled with `dimension`, `domain`, `taxonomy_version_id`. |
| `sub_skills` | 28 | 20 missing rows inserted into `skills` preserving exact UUIDs. |
| `question_skill_tags` | 5 | All retained. New FK `subskill_id` backfilled; `role` column added. |
| `exercise_skills` | 6 | All retained. New FK `subskill_id` backfilled; `role` column added. |
| `student_skills` | 0 | Protected. FK delete behavior switched from `CASCADE` to `RESTRICT`. |
| `skill_evidences` | 0 | Protected. FK delete behavior switched from `CASCADE` to `RESTRICT`. |
| `skill_assessments` | 0 | Protected. FK delete behavior switched from `CASCADE` to `RESTRICT`. |
| `mistakes` | 0 | Subskill string column supplemented with `subskill_id` FK. |
| `writing_correction_skills` | 0 | Retained. |
| `speaking_evaluation_skills` | 0 | Retained. |

---

## 3. Duplicate Concept Analysis & Canonical Resolution

No records are deleted. To preserve backward compatibility and prevent breaking any historical or hard-coded client references, all legacy IDs and codes are retained. Duplicate concepts are mapped to their canonical V2 counterpart and registered in `skill_relations` as `relation_type = 'related'`.

### 3.1 Domain: Reading (`dimension = 'reasoning'`)

| Concept | Existing Code | Existing ID | Canonical V2 Code | Canonical V2 ID | Resolution & Relationship |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Compréhension Écrite** | `reading_comprehension` | `fcce32e8-...` | `reading_comprehension` | `fcce32e8-...` | **Canonical Root**. Dimension: `reasoning`, Domain: `reading`. |
| Compréhension Écrite (Studio) | `reading_comp` | `046ad1d5-...` | `reading_comprehension` | `fcce32e8-...` | Alias / Parented to canonical root. `skill_relation` type: `related`. |
| Faits Divers (Mock Exam) | `READ_FAITS` | `ff5af3ca-...` | `reading_comprehension` | `fcce32e8-...` | Exam task-specific skill. Re-parented to canonical root. Task type: `fait_divers`. |
| Repérage de détails | `reading_detail` | `30f38225-...` | `reading_detail` | `30f38225-...` | Orphan fixed: re-parented to `reading_comprehension`. |
| Idée générale | `reading_gist` | `986e05b0-...` | `reading_gist` | `986e05b0-...` | Orphan fixed: re-parented to `reading_comprehension`. |
| Inférence de lecture | `reading_inference` | `dfe4b968-...` | `reading_inference` | `dfe4b968-...` | Orphan fixed: re-parented to `reading_comprehension`. |

### 3.2 Domain: Listening (`dimension = 'reasoning'`)

| Concept | Existing Code | Existing ID | Canonical V2 Code | Canonical V2 ID | Resolution & Relationship |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Compréhension Orale** | `listening_comprehension` | `35dfb73c-...` | `listening_comprehension` | `35dfb73c-...` | **Canonical Root**. Dimension: `reasoning`, Domain: `listening`. |
| Compréhension Orale (Studio) | `listening_comp` | `53d7c46a-...` | `listening_comprehension` | `35dfb73c-...` | Alias / Parented to canonical root. `skill_relation` type: `related`. |
| Radio Orale Rapide | `LIST_RADIO` | `b21837fb-...` | `listening_comprehension` | `35dfb73c-...` | Exam task-specific skill. Re-parented to canonical root. Task type: `radio_broadcast`. |
| Annonces publiques | `listening_announcement` | `85ddabdb-...` | `listening_announcement` | `85ddabdb-...` | Retained as child of `listening_comprehension`. |
| Entretien thématique | `listening_interview` | `1381b0f0-...` | `listening_interview` | `1381b0f0-...` | Retained as child of `listening_comprehension`. |

### 3.3 Domain: Grammar & Syntax (`dimension = 'language'`)

| Concept | Existing Code | Existing ID | Canonical V2 Code | Canonical V2 ID | Resolution & Relationship |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Grammaire et Syntaxe** | `grammar` | `48996dcc-...` | `grammar` | `48996dcc-...` | **Canonical Root**. Dimension: `language`, Domain: `grammar`. |
| Maîtrise Grammaticale (Studio) | `grammar_mastery` | `8c682751-...` | `grammar` | `48996dcc-...` | Alias. Re-parented to `grammar`. `skill_relation`: `related`. |
| Subjonctif (Mock Exam) | `GRAM_SUBJ` | `d0a74df2-...` | `grammar` | `48996dcc-...` | Exam task-specific skill. Re-parented to `grammar`. |
| Pronoms relatifs | `relative_pronouns` | `889a838f-...` | `relative_pronouns` | `889a838f-...` | **Canonical Subskill** under `grammar`. |
| Pronoms relatifs (Studio) | `grammar_relative_pronouns` | `b7bf70a4-...` | `relative_pronouns` | `889a838f-...` | Inserted into `skills`. `skill_relation`: `related` to `relative_pronouns`. |
| Subjonctif | `subjunctive` | `436be9f4-...` | `subjunctive` | `436be9f4-...` | **Canonical Subskill** under `grammar`. |
| Subjonctif (Studio) | `grammar_subjunctive_mood` | `afa12271-...` | `subjunctive` | `436be9f4-...` | Inserted into `skills`. `skill_relation`: `related` to `subjunctive`. |
| Systèmes hypothétiques | `grammar_hypothetical_systems` | `ae338fe5-...` | `grammar_hypothetical_systems`| `ae338fe5-...` | Inserted into `skills` under `grammar`. |
| Connecteurs logiques (Gram) | `grammar_logical_connectors` | `3f628508-...` | `connectors` | `cde1c9a4-...` | Inserted into `skills`. `skill_relation`: `related` to `connectors`. |

### 3.4 Domain: Vocabulary & Lexicon (`dimension = 'language'`)

| Concept | Existing Code | Existing ID | Canonical V2 Code | Canonical V2 ID | Resolution & Relationship |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Vocabulaire et Lexique** | `vocabulary` | `ea7ea630-...` | `vocabulary` | `ea7ea630-...` | **Canonical Root**. Dimension: `language`, Domain: `vocabulary`. |
| Vocabulaire (Studio) | `vocabulary_lexicon` | `9e32a67e-...` | `vocabulary` | `ea7ea630-...` | Alias. Re-parented to `vocabulary`. `skill_relation`: `related`. |
| Connecteurs d'articulation | `connectors` | `cde1c9a4-...` | `connectors` | `cde1c9a4-...` | **Canonical Subskill** under `vocabulary`. |
| Collocations idiomatiques | `collocations` | `3b856daa-...` | `collocations` | `3b856daa-...` | **Canonical Subskill** under `vocabulary`. |

### 3.5 Domain: Conjugation & Morphology (`dimension = 'language'`)

| Concept | Existing Code | Existing ID | Canonical V2 Code | Canonical V2 ID | Resolution & Relationship |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Conjugaison et Modes** | `conjugation` | `ec72062b-...` | `conjugation` | `ec72062b-...` | **Canonical Root**. Dimension: `language`, Domain: `conjugation`. |
| Conjugaison (Studio) | `conjugation_tenses` | `0d7ee856-...` | `conjugation` | `ec72062b-...` | Alias. Re-parented to `conjugation`. `skill_relation`: `related`. |
| Temps du passé | `past_tenses` | `66235bf3-...` | `past_tenses` | `66235bf3-...` | **Canonical Subskill** under `conjugation`. |
| Conditionnel | `conditional` | `a129ebe4-...` | `conditional` | `a129ebe4-...` | **Canonical Subskill** under `conjugation`. |

### 3.6 Domain: Written Expression (`dimension = 'language'`)

| Concept | Existing Code | Existing ID | Canonical V2 Code | Canonical V2 ID | Resolution & Relationship |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Expression Écrite** | `writing_expression` | `a206b0d9-...` | `writing_expression` | `a206b0d9-...` | **Canonical Root**. Dimension: `language`, Domain: `writing`. |
| Expression Écrite (Studio) | `writing_production` | `beeb0341-...` | `writing_expression` | `a206b0d9-...` | Alias. Re-parented to `writing_expression`. `skill_relation`: `related`. |
| Écrit Section B (Mock) | `WRIT_SECTB` | `b42db2e2-...` | `writing_expression` | `a206b0d9-...` | Re-parented to `writing_expression`. Task type: `argumentative_letter`. |
| Récit de fait divers | `writing_narrative_fait_divers`| `8ba1d87d-...` | `writing_narrative_fait_divers`| `8ba1d87d-...` | Inserted into `skills` under `writing_production`. |
| Lettre argumentative | `writing_persuasive_letter` | `aeab44a4-...` | `writing_persuasive_letter` | `aeab44a4-...` | Inserted into `skills` under `writing_production`. |
| Variété syntaxique | `writing_syntactic_variety` | `c0cc7e74-...` | `writing_syntactic_variety` | `c0cc7e74-...` | Inserted into `skills` under `writing_production`. |
| Cohésion textuelle | `writing_textual_cohesion` | `e298432c-...` | `writing_textual_cohesion` | `e298432c-...` | Inserted into `skills` under `writing_production`. |

### 3.7 Domain: Oral Expression (`dimension = 'language'`)

| Concept | Existing Code | Existing ID | Canonical V2 Code | Canonical V2 ID | Resolution & Relationship |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Expression Orale** | `speaking_expression` | `63a9c8ab-...` | `speaking_expression` | `63a9c8ab-...` | **Canonical Root**. Dimension: `language`, Domain: `speaking`. |
| Interaction Orale (Studio) | `speaking_interaction` | `4fb96985-...` | `speaking_expression` | `63a9c8ab-...` | Alias. Re-parented to `speaking_expression`. `skill_relation`: `related`. |
| Aisance & phonétique | `speaking_fluency_phonetics` | `b85f55f0-...` | `speaking_fluency_phonetics`| `b85f55f0-...` | Inserted into `skills` under `speaking_interaction`. |
| Réfutation & objections | `speaking_rebuttal_objections`| `1199ad86-...` | `speaking_rebuttal_objections`| `1199ad86-...` | Inserted into `skills` under `speaking_interaction`. |
| Section A : Enquête | `speaking_section_a_inquiries`| `622dac47-...` | `speaking_section_a_inquiries`| `622dac47-...` | Inserted into `skills` under `speaking_interaction`. |
| Section B : Plaidoyer | `speaking_section_b_persuasion`| `9ffa2740-...`| `speaking_section_b_persuasion`| `9ffa2740-...`| Inserted into `skills` under `speaking_interaction`. |

---

## 4. Subskill Reference Normalization

### 4.1 `question_skill_tags`
Pre-migration state:
- 2 rows had `subskill = None` and `skill_id = READ_FAITS`
- 1 row had `subskill = 'reading_detail'`, `skill_id = reading_detail`
- 1 row had `subskill = 'reading_gist'`, `skill_id = reading_gist`
- 1 row had `subskill = 'listening_announcement'`, `skill_id = listening_announcement`

Migration action:
- `subskill_id` column added as UUID FK to `skills(id)`.
- `role` column added with enum `skill_tag_role` defaulting to `'primary'`.
- Rows with text subskills had their `subskill_id` populated with the corresponding `skills.id`.
- The legacy `subskill` text column is preserved for non-breaking read compatibility.

### 4.2 `exercise_skills`
Pre-migration state:
- 6 rows linking exercises to skills. `subskill` column was null.
- Exercises link to both root domain skills (e.g. `grammar`, `vocabulary`) and subskills (e.g. `relative_pronouns`, `connectors`).

Migration action:
- `subskill_id` column added as UUID FK to `skills(id)`.
- `role` column added with default `'primary'`.
- Legacy `subskill` text column preserved.

### 4.3 `mistakes`
Migration action:
- `subskill_id` column added as UUID FK to `skills(id)` with `ON DELETE SET NULL`.
- Backfill query automatically resolves string `subskill` to `skills.id` when matching.

---

## 5. Non-Destructive Lifecycle Guarantees

To ensure that administrative operations never delete student analytics or historical examination records:
1. `student_skills.skill_id`: Changed constraint from `CASCADE` to `RESTRICT`.
2. `skill_evidences.skill_id`: Changed constraint from `CASCADE` to `RESTRICT`.
3. `skill_assessments.skill_id`: Changed constraint from `CASCADE` to `RESTRICT`.
4. `question_skill_tags.skill_id`: Changed constraint from `CASCADE` to `RESTRICT`.
5. `exercise_skills.skill_id`: Changed constraint from `CASCADE` to `RESTRICT`.

Deleting a skill that has associated student analytics or active question tags will be rejected by PostgreSQL with an integrity violation. Content administrators must instead archive the skill by setting `is_active = FALSE` or transitioning lifecycle status to `archived`.
