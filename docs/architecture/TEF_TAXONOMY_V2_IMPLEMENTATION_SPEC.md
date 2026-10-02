# TEF Taxonomy V2 — Implementation & Architecture Specification

**Status:** Draft / Technical Specification  
**Version:** 2.0.0  
**Author:** Platform & Architecture Engineering  
**Scope:** Core Taxonomy, Assessment Question Tagging, Learning Drills, Student Mastery, CEFR Mapping, and Analytics  
**Canonical Reference:** `TEF_SKILL_SYSTEM_REFERENCE.md`  
**Target Repository:** TEF Platform (`apps/api`, `apps/web`, `alembic`)

---

## 1. Executive Overview

This specification establishes the concrete technical blueprint for **Taxonomy V2** in the TEF Platform. 

In the current legacy implementation (V1), the platform suffers from:
1. **A dual subskill model** (`Skill.parent_id` vs. the disconnected `sub_skills` table).
2. **Category conflation** (mixing official exam sections like Reading/Listening with linguistic enablers like Grammar/Vocabulary in a 1D enum).
3. **Unenforced string references** (`QuestionSkillTag.subskill` and `ExerciseSkill.subskill` storing raw unindexed text).
4. **Lack of explicit cognitive vs. linguistic tagging** on items.
5. **Absence of CEFR pedagogical descriptors** mapped to skills.

Taxonomy V2 establishes a **multi-dimensional, versioned, relational taxonomy graph** that separates **exam format (task types)** from **underlying competencies (reasoning and language)**, while preserving 100% of historical student performance evidence and exam attempts.

---

## 2. Canonical Domain Model

The V2 domain model defines precise entities with distinct ontological responsibilities:

```text
                               +--------------------+
                               |  TaxonomyVersion   |
                               +---------+----------+
                                         | 1
                                         |
                                         | *
                               +---------v----------+
                               |       Skill        |
                               +---------+----------+
                                         |
            +----------------------------+----------------------------+
            | 1                          | 1                          | 1
            |                            |                            |
            | *                          | *                          | *
+-----------v------------+   +-----------v------------+   +-----------v------------+
|  SkillLevelDescriptor  |   |     SkillRelation      |   |   QuestionSkillTag     |
|   (CEFR Benchmarks)    |   | (Prerequisites/Graph)  |   | (Content Tagging / FK) |
+------------------------+   +------------------------+   +------------------------+
```

### 2.1 Entity Definitions

1. **`TaxonomyVersion`:** Represents an immutable, named snapshot of the platform competency catalog (e.g., `v2.0.0-tef-canada`). Guarantees reproducibility of past student diagnostics and analytics.
2. **`Skill`:** The authoritative competency unit in the platform. Can represent either a high-level family/domain, a primary skill, or a granular subskill via a strict, self-referential adjacency tree (`parent_id`).
3. **`SkillDimension` (Enum):**
   * `REASONING`: Mental operation required to solve a task (e.g., *inference*, *identifying main idea*, *cause-consequence*).
   * `LANGUAGE`: Linguistic knowledge and processing ability (e.g., *connectors*, *relative pronouns*, *lexical nuance*).
4. **`ExamModality` (Enum):** The official test sections of the TEF: `READING`, `LISTENING`, `WRITING`, `SPEAKING`.
5. **`TaskType`:** Represents the format, stimulus, and structure of the assessment item (e.g., `press_article`, `daily_document`, `radio_interview`, `argumentative_letter`, `oral_inquiry`). **A task type is never a skill.**
6. **`SkillRelation`:** Directed graph edge defining pedagogical dependency between competencies (`prerequisite`, `depends_on`, `supports`, `related_to`).
7. **`SkillLevelDescriptor`:** Pedagogical can-do statement contextualizing what performance on a given skill looks like at specific CEFR bands ($A1, A2, B1, B2, C1, C2$).
8. **`SkillEvidence`:** Immutable observation record generated whenever a student answers a question, completes a drill, or receives an AI/teacher oral/written evaluation.
9. **`StudentSkill`:** Rolling probabilistic estimate of mastery and calibrated confidence derived deterministically from the evidence stream.

---

## 3. Canonical Hierarchy vs. Orthogonal Relationships

The primary architectural error of V1 was trying to force all concepts into a single `parent_id` tree. In V2, concepts are factored into their proper orthogonal dimensions:

```text
==========================================================================================
ORTHOGONAL DIMENSION 1: EXAM FORMAT & TASKS          ORTHOGONAL DIMENSION 2: COMPETENCIES
==========================================================================================

ExamModality (reading | listening | writing | speaking)
   └── TaskType (e.g., press_article, radio_broadcast)
            │
            │ Question belongs to a Task Type
            ▼
        [ Question ] ──────────────────────────────────────────────┐
            │                                                      │
            │                                                      │
            ▼ (Tagged with)                                        ▼ (Tagged with)
    Primary Reasoning Skill                                Secondary Language Skill(s)
    (Dimension: REASONING)                                 (Dimension: LANGUAGE)
    e.g. `infer_author_stance`                             e.g. `discourse_connectors`
    Role: PRIMARY, Weight: 0.70                            Role: SECONDARY, Weight: 0.30
```

### 3.1 What is Hierarchical
* **Competency Specialization:**
  * Reasoning: `inference` $\rightarrow$ `infer_implicit_attitude`
  * Language: `syntax` $\rightarrow$ `subordination` $\rightarrow$ `relative_clauses`
* **Assessment Structure:**
  * `Assessment` $\rightarrow$ `AssessmentSection` $\rightarrow$ `Question` $\rightarrow$ `QuestionOption`

### 3.2 What is Orthogonal (Non-Hierarchical Junctions)
* **Skills and Modalities:** A language skill (e.g., `connectors` or `vocabulary_in_context`) is transversal. It applies to Reading, Listening, Writing, and Speaking. It must not be created 4 times under 4 different parents.
* **Skills and Task Types:** A `press_article` question measures reasoning and language; the task type is not the parent of the skill.
* **Reasoning and Language:** A question requires cognitive reasoning *and* linguistic processing simultaneously.

---

## 4. Database Schema Proposal (PostgreSQL)

### 4.1 Enums

```sql
CREATE TYPE skill_dimension AS ENUM ('reasoning', 'language');
CREATE TYPE skill_tag_role AS ENUM ('primary', 'secondary');
CREATE TYPE skill_relation_type AS ENUM ('prerequisite', 'depends_on', 'supports', 'related');
CREATE TYPE taxonomy_lifecycle_status AS ENUM ('draft', 'active', 'deprecated', 'archived');
CREATE TYPE cefr_band AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');
```

### 4.2 Core Tables

#### 1. `taxonomy_versions`
Tracks releases of the platform taxonomy.
```sql
CREATE TABLE taxonomy_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version VARCHAR(32) NOT NULL UNIQUE,     -- e.g. 'v2.0.0'
    name VARCHAR(255) NOT NULL,               -- e.g. 'TEF Canada Standard Taxonomy 2026'
    status taxonomy_lifecycle_status NOT NULL DEFAULT 'draft',
    description TEXT,
    activated_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_taxonomy_versions_status ON taxonomy_versions(status);
```

#### 2. `skills` (Unified V2 Entity)
Replaces the dual `skills`/`sub_skills` tables. Unifies all competencies into a clean, typed adjacency hierarchy.
```sql
CREATE TABLE skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    taxonomy_version_id UUID NOT NULL REFERENCES taxonomy_versions(id) ON DELETE RESTRICT,
    code VARCHAR(100) NOT NULL UNIQUE,       -- Semantic machine slug: e.g. 'reasoning.inference.implicit'
    name VARCHAR(255) NOT NULL,              -- Display title in French: e.g. 'Compréhension de l'implicite'
    dimension skill_dimension NOT NULL,      -- 'reasoning' vs 'language'
    domain VARCHAR(50) NOT NULL,             -- Family: 'vocabulary', 'grammar', 'syntax', 'inference', etc.
    description TEXT,
    parent_id UUID REFERENCES skills(id) ON DELETE SET NULL, -- Self-referential hierarchy
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_skills_taxonomy_version ON skills(taxonomy_version_id);
CREATE INDEX ix_skills_dimension ON skills(dimension);
CREATE INDEX ix_skills_domain ON skills(domain);
CREATE INDEX ix_skills_parent_id ON skills(parent_id);
CREATE INDEX ix_skills_is_active ON skills(is_active);
```

#### 3. `task_types`
Explicit table decoupling exam format from skills.
```sql
CREATE TABLE task_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    modality VARCHAR(30) NOT NULL,           -- 'reading', 'listening', 'writing', 'speaking'
    code VARCHAR(100) NOT NULL UNIQUE,       -- e.g. 'press_article', 'radio_chronicle'
    name VARCHAR(255) NOT NULL,              -- e.g. 'Article de presse d'opinion'
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_task_types_modality ON task_types(modality);
```

#### 4. `skill_relations`
Explicit learning dependency graph.
```sql
CREATE TABLE skill_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    to_skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    relation_type skill_relation_type NOT NULL DEFAULT 'prerequisite',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_skill_relation UNIQUE (from_skill_id, to_skill_id, relation_type),
    CONSTRAINT ck_no_self_relation CHECK (from_skill_id <> to_skill_id)
);
CREATE INDEX ix_skill_relations_from ON skill_relations(from_skill_id);
CREATE INDEX ix_skill_relations_to ON skill_relations(to_skill_id);
```

#### 5. `skill_level_descriptors`
CEFR benchmarks and can-do descriptors per competency.
```sql
CREATE TABLE skill_level_descriptors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    level cefr_band NOT NULL,
    descriptor TEXT NOT NULL,                -- e.g. 'Peut déduire une prise de position implicite...'
    evidence_guidance TEXT,                  -- Guidance for item authors and examiners
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_skill_cefr_level UNIQUE (skill_id, level)
);
CREATE INDEX ix_skill_descriptors_skill_level ON skill_level_descriptors(skill_id, level);
```

#### 6. `question_skill_tags` (Refactored V2)
Replaces raw string subskills with strict foreign keys and role attribution.
```sql
CREATE TABLE question_skill_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE RESTRICT, -- Prevent accidental cascade drop
    role skill_tag_role NOT NULL DEFAULT 'primary',
    weight FLOAT NOT NULL DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_question_skill UNIQUE (question_id, skill_id),
    CONSTRAINT ck_tag_weight CHECK (weight > 0.0 AND weight <= 1.0)
);
CREATE INDEX ix_question_skill_tags_question ON question_skill_tags(question_id);
CREATE INDEX ix_question_skill_tags_skill ON question_skill_tags(skill_id);
CREATE INDEX ix_question_skill_tags_role ON question_skill_tags(role);
```

#### 7. `exercise_skills` (Refactored V2)
Decouples drill exercises to link directly to competencies via strict foreign keys.
```sql
CREATE TABLE exercise_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
    role skill_tag_role NOT NULL DEFAULT 'primary',
    weight FLOAT NOT NULL DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_exercise_skill UNIQUE (exercise_id, skill_id),
    CONSTRAINT ck_exercise_weight CHECK (weight > 0.0 AND weight <= 1.0)
);
CREATE INDEX ix_exercise_skills_exercise ON exercise_skills(exercise_id);
CREATE INDEX ix_exercise_skills_skill ON exercise_skills(skill_id);
```

---

## 5. Backward Compatibility & Migration Strategy

### 5.1 Field-by-Field Mapping

| Legacy Entity & Field (V1) | V2 Target Entity & Field | Status | Transformation / Migration Rule |
| :--- | :--- | :--- | :--- |
| `skills.id` | `skills.id` | **Retained** | UUIDs preserved exactly to protect all foreign keys. |
| `skills.code` | `skills.code` | **Retained / Normalized** | Retained. Normalized to snake_case hierarchical slugs. |
| `skills.name` | `skills.name` | **Retained** | Preserved. |
| `skills.description` | `skills.description` | **Retained** | Preserved. |
| `skills.parent_id` | `skills.parent_id` | **Retained** | Reparented cleanly into the unified hierarchy. |
| `skills.category` | `skills.domain` + `skills.dimension` | **Migrated** | Split into `dimension` (reasoning/language) and `domain` (vocabulary, grammar, etc.). |
| `skills.is_active` | `skills.is_active` | **Retained** | Preserved for soft archival. |
| `sub_skills` (entire table) | Merged into `skills` | **Deprecated** | All `sub_skills` rows migrated into `skills` where `parent_id = skill_id`. Table kept read-only as view during transitional grace period. |
| `question_skill_tags.subskill` | `question_skill_tags.skill_id` | **Migrated** | Plain string resolved to the unified `Skill.id` and replaced by true FK. String column dropped. |
| `exercise_skills.subskill` | `exercise_skills.skill_id` | **Migrated** | Plain string resolved to unified `Skill.id`. Column dropped. |
| `mistakes.subskill` | `mistakes.skill_id` (or meta JSON) | **Migrated** | String converted to subskill FK reference or moved to payload JSON. |
| `student_skills` | `student_skills` | **Retained** | Unaltered. Foreign keys to `skills.id` remain 100% valid. |
| `skill_evidences` | `skill_evidences` | **Retained** | Unaltered. Zero loss of historical observations. |
| `skill_assessments` | `skill_assessments` | **Retained** | Unaltered. Zero loss of historical exam snapshots. |

### 5.2 Zero-Loss Migration Pipeline
To guarantee that no student mastery, evidence, or teacher corrections are damaged:
1. **Phase 1 (Additive DDL):**
   * Create `taxonomy_versions`, `task_types`, `skill_relations`, `skill_level_descriptors`.
   * Add `taxonomy_version_id`, `dimension`, and `domain` columns to `skills` as nullable.
   * Add `role` column to `question_skill_tags` and `exercise_skills`.
2. **Phase 2 (Data Backfill & Unification):**
   * Insert `taxonomy_versions` row for `'v1.0.0-legacy'`.
   * Map existing root skills to appropriate dimensions (`reading_comp` $\rightarrow$ `dimension='reasoning'`, `grammar` $\rightarrow$ `dimension='language'`).
   * Insert any missing subskills from `sub_skills` into `skills` with matching IDs.
   * Update `question_skill_tags` that had string `subskill` by resolving their IDs against `skills.code`.
3. **Phase 3 (Constraint Enforcement):**
   * Set `taxonomy_version_id`, `dimension`, and `domain` to `NOT NULL`.
   * Switch FK delete behaviors on `skills` from `CASCADE` to `RESTRICT` on `student_skills` and `skill_evidences` to guarantee safe non-destructive operations.
4. **Phase 4 (Deprecation Grace Period):**
   * Deprecate `sub_skills` table (provide a database VIEW for legacy queries).
   * Drop string columns `subskill` from `question_skill_tags` and `exercise_skills`.

---

## 6. Content Tagging Architecture

Every question or exercise must be tagged with explicit pedagogical intent:

```ts
interface QuestionSkillTaggingPayload {
  question_id: string;
  tags: Array<{
    skill_id: string;          // Direct UUID FK to unified Skill
    role: "primary" | "secondary";
    weight: number;            // 0.1 to 1.0 (normalized sum)
  }>;
}
```

### 6.1 Tagging Rules
1. **Rule 1 (Primary Reasoning):** A diagnostic comprehension item must have exactly **1 primary reasoning skill** (e.g., `reasoning.inference.cause_consequence`).
2. **Rule 2 (Language Enablers):** A question may have 1 to 3 secondary language skills (e.g., `language.syntax.connectors`, `language.vocabulary.paraphrase`).
3. **Rule 3 (Sum of Weights):** The total weight across all tags for a question must equal $1.0$.
4. **Rule 4 (Strict Foreign Key):** Authors cannot type freeform text for subskills; selections must resolve to an active `Skill.id` in the current taxonomy.

---

## 7. CEFR Architecture

CEFR is decoupled from the skill's identity.

```text
Skill (e.g. `reasoning.inference.pragmatic`)
   ├── LevelDescriptor: B1 → "Peut comprendre les conclusions évidentes d'un texte simple..."
   ├── LevelDescriptor: B2 → "Peut identifier l'ironie et les sous-entendus d'un article d'opinion..."
   └── LevelDescriptor: C1 → "Peut saisir les allusions culturelles et nuances fines dans un éditorial..."
```

### 7.1 How CEFR Estimation Works
* Questions have a calibrated difficulty level ($A2, B1, B2, C1$).
* When a student succeeds or fails on a question, evidence is attributed to the skill with the question's CEFR level context.
* A student's mastery of a skill is represented as a continuous scale ($0.0 - 100.0\%$).
* When that scale crosses thresholds ($50\% \rightarrow B1$, $65\% \rightarrow B2$, $80\% \rightarrow C1$), the platform pairs the score with the corresponding `SkillLevelDescriptor` to explain what the student can currently achieve.

---

## 8. Student Evidence & Mastery Architecture

The learning loop is strictly data-driven:

```text
Student Question Attempt
          │
          ▼
   [ Evaluation ] ── (Correct / Incorrect / Partial)
          │
          ▼
   [ Evidence Generation ]
   Produces N `SkillEvidence` rows:
     ├── student_id
     ├── skill_id (from QuestionSkillTag)
     ├── raw_score, normalized_score
     ├── weight (tag.weight * question.points)
     ├── difficulty (question.level)
     └── observed_at
          │
          ▼
   [ Mastery Projection Engine ]
   Runs Bayesian time-decay update on `StudentSkill`:
     ├── Mastery = 0.60 * PriorMastery + 0.40 * NewScore (recency weighted)
     ├── Confidence calibrated from sample size, source diversity, and variance
     └── Estimated CEFR mapped via LevelEstimationService
          │
          ▼
   [ Readiness Profile & Gap Analysis ]
   Identifies weak competencies (< 70% threshold)
          │
          ▼
   [ Recommendation Engine V2 ]
   Matches weak skill IDs to ExerciseSkills (enforcing 48h cooldown)
```

---

## 9. Taxonomy Versioning & Lifecycle Governance

### 9.1 Lifecycle States
Skills transition through a strict finite state machine:
$$\text{draft} \longrightarrow \text{active} \longrightarrow \text{deprecated} \longrightarrow \text{archived}$$

* **`draft`:** Visible only to Content Admins. Cannot be tagged on published assessments.
* **`active`:** Authoritative. Available for question authoring, student practice, and mastery tracking.
* **`deprecated`:** Read-only. Retained on existing published questions; cannot be added to new questions. Mastery calculations continue.
* **`archived`:** Completely hidden from authoring. All historical `SkillEvidence` and `StudentSkill` records are preserved permanently.

### 9.2 Audit Logging
All taxonomy mutations emit an immutable `AuditEvent` (`action="taxonomy_updated"`, `entity_type="skill"`) capturing diffs of modified fields and admin IDs.

---

## 10. Comprehensive Test Matrix

Before declaring Taxonomy V2 ready for production, the following test suites must be implemented:

| Suite | Target | Test Cases |
| :--- | :--- | :--- |
| **Unit: Schema & Models** | SQLAlchemy Models | Verify table creation, unique code constraints, self-referential tree relations, enum validations, and cascade restrictions. |
| **Unit: Mastery Math** | `SkillEngine` & `ReadinessEngine` | Test Bayesian time-decay, recency half-life (45 days), variance penalty on contradictory scores, and multi-skill weighted roll-ups. |
| **Service: Tagging** | `AdminContentService` | Test question creation with primary reasoning + secondary language skills; enforce weight sum validation ($= 1.0$) and rejection of invalid FKs. |
| **Service: Taxonomy FSM** | `SkillLifecycleService` | Test state transitions (`draft` $\rightarrow$ `active` $\rightarrow$ `archived`); verify that archived skills cannot be tagged on new content. |
| **Integration: Migration** | Alembic Migration 0030 | Run upgrade on a snapshot of live data; verify zero rows lost in `student_skills`, `skill_evidences`, and `question_skill_tags`. Run downgrade and verify reversibility. |
| **Integration: API** | `/admin/content/skills` | Test batch usage aggregation query (preventing N+1), filtering by dimension/domain, and tree hierarchy serialization. |
| **E2E / Frontend** | Skills Navigator & Workspace | Test master-detail navigation, search/filter toolbar, subskill CRUD forms, and dialog safety checks before archival. |

---

## 11. Implementation Order & Roadmap

1. **Step 1 — Architecture Specification Approval:** Review and merge `TEF_TAXONOMY_V2_IMPLEMENTATION_SPEC.md`.
2. **Step 2 — Alembic Schema Migration (0030):** Add `taxonomy_versions`, `task_types`, `skill_relations`, `skill_level_descriptors`, and unify `skills`.
3. **Step 3 — Data Migration & Seed Normalization:** Reconcile duplicate root skills (`reading_comp` vs `reading_comprehension`) and populate V2 dimensions.
4. **Step 4 — Backend Service & Engine Refactor:** Update `AdminContentService`, `LearningService`, and `ReadinessEngine` to consume V2 dimensions and batch query usage stats.
5. **Step 5 — Content Authoring Update:** Enhance question and exercise authoring forms to support dual reasoning/language tagging with weights.
6. **Step 6 — Frontend Skills Console Polish:** Update `/admin/skills` to render dimension tabs (Reasoning vs Language) and CEFR descriptor drawers.
7. **Step 7 — Full Test Verification & Release:** Run the complete test matrix, build Docker images, and verify zero regressions in student readiness dashboards.
