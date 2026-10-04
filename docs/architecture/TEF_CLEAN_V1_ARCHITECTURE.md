# TEF Platform — Clean V1 Architecture
## Canonical Taxonomy, Question, Assessment, and Learning Intelligence Specification

**Date:** October 4, 2026  
**Status:** Canonical Target Architecture (Phase 1)  
**Objective:** Establish a permanent, unified architectural foundation that permanently eliminates legacy technical debt (dual skill tables, string-based tags, section-coupled questions, unversioned assessments) and delivers production-grade TEF preparation capability.

---

## 1. High-Level Architectural Vision

```
                          ┌────────────────────────────────┐
                          │        TAXONOMY ENGINE         │
                          │   (Versions, Lifecycle, Tree)   │
                          └───────────────┬────────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
      ┌───────────────────────┐                       ┌───────────────────────┐
      │    EXAM MODALITIES    │                       │     COMPETENCIES      │
      │  Reading / Listening  │                       │   Single Identity     │
      │   Writing / Speaking  │                       │      Skill Tree       │
      └───────────┬───────────┘                       └───────────┬───────────┘
                  │                                               │
                  ▼                                               ▼
      ┌───────────────────────┐                       ┌───────────────────────┐
      │      TASK TYPES       │◄──────────────────────┤  DIMENSIONS & CEFR    │
      │  Article, Annonce,    │   skill_task_types    │ Reasoning vs Language │
      │  Interview, Graphique │                       │  Descriptors A1–C2    │
      └───────────┬───────────┘                       └───────────┬───────────┘
                  │                                               │
                  └───────────────────────┬───────────────────────┘
                                          │
                                          ▼
                          ┌────────────────────────────────┐
                          │        QUESTION ENGINE         │
                          │   Decoupled, Versioned Items   │
                          └───────────────┬────────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
      ┌───────────────────────┐                       ┌───────────────────────┐
      │   STIMULI & ASSETS    │                       │    RESPONSE MODEL     │
      │  Passages, Audios,    │                       │  Single/Multi Choice, │
      │  Attributions, Hashes │                       │  Matching, Gap-Fill   │
      └───────────┬───────────┘                       └───────────┬───────────┘
                  │                                               │
                  └───────────────────────┬───────────────────────┘
                                          │
                                          ▼
                          ┌────────────────────────────────┐
                          │   QUESTION VALIDATION ENGINE   │
                          │  Authoring, Duplicates, Linter │
                          └───────────────┬────────────────┘
                                          │
                                          ▼
                          ┌────────────────────────────────┐
                          │    IMMUTABLE QUESTION VERSION   │
                          │ Delivered in Exams / Attempts  │
                          └───────────────┬────────────────┘
                                          │
                                          ▼
                          ┌────────────────────────────────┐
                          │   SCORING & STUDENT EVIDENCE   │
                          │   Points, SkillEvidence Stream │
                          └───────────────┬────────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
      ┌───────────────────────┐                       ┌───────────────────────┐
      │     STUDENT SKILLS    │                       │    RECOMMENDATIONS    │
      │ Mastery, Confidence,  │                       │  Adaptive Drills,     │
      │ Readiness Profile     │                       │  Targeted Practice    │
      └───────────────────────┘                       └───────────────────────┘
```

---

## 2. Taxonomy Subsystem V1

### 2.1 Core Invariants
1. **Single Canonical Competency Identity**:
   - There is exactly **one** competency entity: `Skill`.
   - The obsolete `sub_skills` table is permanently decommissioned.
   - Hierarchy is modeled as a self-referencing adjacency tree: `Skill.parent_id -> Skill.id`.
   - Any competency may have child competencies to arbitrary depth ($N \ge 1$).
2. **Orthogonal Separation: Modality vs Dimension**:
   - **Exam Modalities** (`reading`, `listening`, `writing`, `speaking`) describe the **test format**.
   - **Competency Dimensions** (`reasoning`, `language`) describe the **cognitive/linguistic nature** of the skill:
     - `reasoning`: The mental operation required (e.g. locate detail, infer implicit intent, synthesize arguments).
     - `language`: The linguistic tool required (e.g. vocabulary in context, syntax, discourse markers, register).
3. **Task Types Decoupled from Competencies**:
   - A `TaskType` belongs to an exam modality (e.g. `reading_press_article`).
   - A `TaskType` defines expected response types and stimulus requirements.
   - Junction table `task_type_skills` explicitly maps which competencies are eligible to be assessed within each task type.
4. **Versioned & Audited**:
   - Every `Skill` belongs to a `TaxonomyVersion`.
   - Unique constraint: `(taxonomy_version_id, code)` must be unique.
   - Archiving a skill is non-destructive (`is_active = false`).

### 2.2 Entity Definitions

#### `TaxonomyVersion`
- `id`: UUID (PK)
- `version`: String(32), unique (e.g. `"v1.0.0"`)
- `name`: String(255)
- `status`: Enum (`draft`, `active`, `archived`)
- `description`: Text, nullable
- `activated_at`: Timestamp, nullable
- `archived_at`: Timestamp, nullable

#### `Skill`
- `id`: UUID (PK)
- `taxonomy_version_id`: UUID, FK -> `taxonomy_versions.id` (RESTRICT)
- `code`: String(100), indexed, unique per version (e.g. `"REA_INFERENCE"`, `"LNG_VOCAB_CONTEXT"`)
- `name`: String(255)
- `dimension`: Enum (`reasoning`, `language`)
- `description`: Text, nullable
- `parent_id`: UUID, FK -> `skills.id` (SET NULL)
- `order_index`: Integer, default 0
- `is_active`: Boolean, default true
- `created_at`, `updated_at`: Timestamps

#### `TaskType`
- `id`: UUID (PK)
- `modality`: String(30), indexed (`reading`, `listening`, `writing`, `speaking`)
- `code`: String(100), unique, indexed (e.g. `"reading_factual_notice"`)
- `name`: String(255)
- `description`: Text, nullable
- `default_response_type`: String(50), default `"single_choice"`
- `is_active`: Boolean, default true
- `created_at`, `updated_at`: Timestamps

#### `TaskTypeSkill`
- `task_type_id`: UUID, FK -> `task_types.id` (CASCADE)
- `skill_id`: UUID, FK -> `skills.id` (CASCADE)
- Primary Key: `(task_type_id, skill_id)`

#### `SkillRelation`
- `from_skill_id`: UUID, FK -> `skills.id` (CASCADE)
- `to_skill_id`: UUID, FK -> `skills.id` (CASCADE)
- `relation_type`: Enum (`prerequisite`, `related`, `depends_on`)
- Unique constraint: `(from_skill_id, to_skill_id, relation_type)`

#### `SkillLevelDescriptor`
- `skill_id`: UUID, FK -> `skills.id` (CASCADE)
- `level`: Enum (`A1`, `A2`, `B1`, `B2`, `C1`, `C2`)
- `descriptor`: Text (Can-do benchmark)
- `evidence_guidance`: Text, nullable
- Unique constraint: `(skill_id, level)`

---

## 3. Question Subsystem V1

### 3.1 Core Invariants
1. **Full Decoupling from Assessment Sections**:
   - A `Question` is an independent bank entity. It does **not** possess a `section_id` foreign key.
   - Questions are attached to `AssessmentSection` via `assessment_section_questions` (M:N).
2. **Authoritative Versioning & Immutability**:
   - When a Question is approved and published, a `QuestionVersion` snapshot is created.
   - Exams deliver a specific `question_version_id`.
   - Modifying a published question requires creating a new version.
3. **Structured Response Models**:
   - Canonical response types: `single_choice`, `multiple_choice`, `matching`, `ordering`, `gap_fill`, `short_text`, `long_text`, `spoken_response`.
   - For choices, options are stored in `QuestionOption` with pedagogical distractor rationales.
   - For non-choice types, scoring parameters reside in `scoring_payload`.
4. **Canonical Competency Tagging**:
   - Tagging links `Question` directly to canonical `Skill.id`.
   - Every question specifies:
     - 1 Primary **Reasoning** competency (weight $1.0$ or shared).
     - 1 Primary **Language** competency (weight $1.0$ or shared).
   - Zero string `subskill` fallback columns.

### 3.2 Entity Definitions

#### `Stimulus`
- `id`: UUID (PK)
- `modality`: String(30), indexed (`reading`, `listening`)
- `title`: String(255)
- `content_text`: Text, nullable
- `media_asset_id`: UUID, FK -> `media_assets.id` (SET NULL)
- `source_citation`: Text, nullable
- `content_hash`: String(64), unique, indexed (SHA-256)
- `word_count`: Integer, nullable

#### `Question`
- `id`: UUID (PK)
- `task_type_id`: UUID, FK -> `task_types.id` (RESTRICT)
- `stimulus_id`: UUID, FK -> `stimuli.id` (SET NULL), nullable
- `response_type`: String(50), default `"single_choice"`
- `prompt`: Text
- `instructions`: Text, nullable
- `target_cefr`: String(10), indexed (`A1`–`C2`)
- `difficulty_rating`: Integer, nullable (100–699 scale)
- `cognitive_complexity`: Enum (`recall_recognition`, `interpretation`, `inferencing_synthesis`, `critical_evaluation`)
- `explanation`: Text, nullable
- `points`: Integer, default 1
- `penalty_points`: Integer, default 0
- `status`: Enum (`draft`, `in_review`, `approved`, `published`, `archived`)
- `version`: Integer, default 1
- `is_live_delivered`: Boolean, default false
- `scoring_payload`: JSONB, nullable
- `created_by_user_id`: UUID, FK -> `users.id` (SET NULL)
- `updated_by_user_id`: UUID, FK -> `users.id` (SET NULL)
- `created_at`, `updated_at`: Timestamps

#### `QuestionOption`
- `id`: UUID (PK)
- `question_id`: UUID, FK -> `questions.id` (CASCADE)
- `content`: Text
- `order_index`: Integer, default 0
- `is_correct`: Boolean, default false
- `explanation`: Text, nullable
- `distractor_rationale`: Text, nullable (pedagogical explanation of distractor trap)

#### `QuestionSkillTag`
- `id`: UUID (PK)
- `question_id`: UUID, FK -> `questions.id` (CASCADE)
- `skill_id`: UUID, FK -> `skills.id` (RESTRICT)
- `role`: Enum (`primary`, `secondary`)
- `weight`: Float, default 1.0 ($0.0 < w \le 1.0$)
- `context`: JSONB, nullable
- Unique constraint: `(question_id, skill_id)`

#### `QuestionVersion`
- `id`: UUID (PK)
- `question_id`: UUID, FK -> `questions.id` (CASCADE)
- `version`: Integer
- `snapshot_payload`: JSONB (complete frozen question, options, skills, stimulus, scoring)
- `changelog`: Text, nullable
- `created_by_user_id`: UUID, FK -> `users.id` (SET NULL)
- `created_at`: Timestamp
- Unique constraint: `(question_id, version)`

#### `QuestionProvenance`
- `id`: UUID (PK)
- `question_id`: UUID, FK -> `questions.id` (CASCADE), unique
- `author_type`: Enum (`human`, `ai`, `imported`)
- `source_type`: String(50)
- `source_reference`: Text, nullable
- `generator_model`: String(100), nullable
- `generator_prompt_version`: String(100), nullable
- `generator_parameters`: JSONB, nullable
- `created_by_user_id`: UUID, FK -> `users.id` (SET NULL)
- `created_at`: Timestamp

#### `AssessmentSectionQuestion`
- `id`: UUID (PK)
- `assessment_section_id`: UUID, FK -> `assessment_sections.id` (CASCADE)
- `question_id`: UUID, FK -> `questions.id` (CASCADE)
- `question_version_id`: UUID, FK -> `question_versions.id` (SET NULL)
- `order_index`: Integer, default 0
- `points_override`: Integer, nullable
- Unique constraint: `(assessment_section_id, question_id)`

---

## 4. Student Intelligence & Scoring Subsystem V1

### 4.1 Scoring Engine Invariants
- Scoring executes strictly against the immutable `QuestionVersion` snapshot.
- For each evaluated answer, the engine emits granular `SkillEvidence` rows:
  - Weight and role are read from the question version's `skill_tags`.
  - Contribution: $\text{points\_awarded} \times \text{weight}$.
  - Normalized: $\frac{\text{points\_awarded}}{\text{points\_possible}} \times 100\%$.

### 4.2 Entity Definitions

#### `SkillEvidence`
- `id`: UUID (PK)
- `student_id`: UUID, FK -> `users.id` (CASCADE)
- `skill_id`: UUID, FK -> `skills.id` (RESTRICT)
- `source_type`: Enum (`assessment_item`, `exercise`, `writing`, `speaking`)
- `source_id`: UUID, indexed
- `raw_score`: Float
- `normalized_score`: Float ($0.0 \dots 100.0$)
- `weight`: Float ($0.0 \dots 1.0$)
- `confidence`: Float ($0.0 \dots 1.0$)
- `observed_at`: Timestamp
- `metadata_payload`: JSONB (question ID, attempt ID, role)

#### `StudentSkill`
- `id`: UUID (PK)
- `user_id`: UUID, FK -> `users.id` (CASCADE)
- `skill_id`: UUID, FK -> `skills.id` (RESTRICT)
- `mastery_score`: Float ($0.0 \dots 100.0$)
- `confidence`: Float ($0.0 \dots 1.0$)
- `attempts_count`: Integer, default 0
- `successful_attempts`: Integer, default 0
- `last_assessed_at`: Timestamp
- Unique constraint: `(user_id, skill_id)`
