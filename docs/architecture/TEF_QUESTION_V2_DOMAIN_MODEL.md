# TEF Question System V2 — Domain Model & Question Contract Specification

**Document Version:** 2.0.0  
**Phase:** Phase 2 Implementation  
**Status:** Approved & Implemented  
**System Layer:** Backend Domain Models, Schemas, Serializers, and Contracts  

---

## 1. Executive Summary

Question System V2 transforms questions in the TEF preparation platform from tightly coupled, section-embedded database rows into **first-class pedagogical assets**. In Question V1, questions were strictly bound to a single `assessment_section_id`, stimuli were duplicated across items, options lacked diagnostic insight into student error mechanisms, and versioning was limited.

In Question System V2:
- **Questions are autonomous pedagogical items**: Items can exist independently in the item bank and be linked to one or multiple assessment sections or exercises via `assessment_section_questions`.
- **Stimuli are first-class shared entities**: Texts, audio passages, and graphics are modeled as independent `Stimulus` records, supporting item sets (multiple questions referencing a single stimulus).
- **Distractors carry pedagogical diagnostics**: Every `QuestionOption` captures `misconception_type` and `distractor_rationale`, enabling precise error remediation in the student learning loop.
- **Auditing, validation, and provenance are built-in**: Models track author origin (`QuestionProvenance`) and quality linting results (`QuestionValidation`).
- **Strict security boundaries are enforced**: Student test-taking projections strictly sanitize and strip all correct answer flags, distractor rationales, and internal scoring configuration.
- **Historical snapshots are immutable**: Changes to active questions never corrupt historical attempts; `QuestionVersion` stores a complete, frozen snapshot payload.

---

## 2. Domain Model Architecture

```
                    ┌─────────────────┐
                    │    Stimulus     │
                    │ (Text / Audio)  │
                    └────────┬────────┘
                             │ 1
                             │
                             │ 0..*
                    ┌────────┴────────┐
                    │    Question     │◄────────────────┐
                    │   (Canonical)   │                 │
                    └───┬────┬────┬───┘                 │
                        │    │    │                     │
           ┌────────────┘    │    └────────────┐        │
           │ 1..*            │ 0..*            │ 1      │
           ▼                 ▼                 ▼        │ 0..*
    ┌──────────────┐ ┌───────────────┐ ┌─────────────┐  │
    │QuestionOption│ │QuestionSkill  │ │ Question    │  │
    │(Distractors) │ │    Tag        │ │ Provenance  │  │
    └──────────────┘ └───────────────┘ └─────────────┘  │
           │                                            │
           │ 0..*                                       │
           ▼                                            │
    ┌──────────────┐                                    │
    │Question      │                                    │
    │Validation    │                                    │
    └──────────────┘                                    │
                                                        │
┌──────────────────────────┐                            │
│    AssessmentSection     │                            │
└────────────┬─────────────┘                            │
             │ 1                                        │
             │ 0..*                                     │
    ┌────────┴────────────────────┐                     │
    │  AssessmentSectionQuestion  │─────────────────────┘
    │ (Association / Reusability) │
    └─────────────────────────────┘
```

---

## 3. Entity Definitions & Specifications

### 3.1 `Stimulus` (`stimuli`)
Represents an authentic stimulus document, reading text, audio file, or administrative notice.

| Field | Type | Description |
|---|---|---|
| `id` | `UUID` (PK) | Unique stimulus identifier. |
| `title` | `String(255)` | Descriptive internal title. |
| `modality` | `String(30)` | `reading`, `listening`, `writing`, or `speaking`. |
| `content_text` | `Text` (Nullable) | Full reading text or audio transcript. |
| `text_format` | `String(20)` | `plain`, `markdown`, `html`. Default: `plain`. |
| `word_count` | `Integer` (Nullable) | Standardized word count. |
| `register` | `String(50)` (Nullable) | Sociolinguistic register (`courant`, `formel`, etc.). |
| `media_asset_id`| `UUID` (FK, Nullable) | Link to `media_assets` table for managed binary storage. |
| `media_url` | `String(512)` (Nullable) | Public CDN / presigned URL for audio/media playback. |
| `source_citation`| `Text` (Nullable) | Pedagogical or copyright attribution. |
| `content_hash` | `String(64)` (Unique) | SHA-256 fingerprint of content preventing duplicate ingestion. |

### 3.2 `Question` (`questions`)
The central competency measurement unit.

| Field | Type | Description |
|---|---|---|
| `id` | `UUID` (PK) | Unique question identifier. |
| `stimulus_id` | `UUID` (FK, Nullable) | Reference to associated `Stimulus`. |
| `section_id` | `UUID` (FK, Nullable) | Backward-compatible section reference (decoupled in V2). |
| `task_type_id` | `UUID` (FK, Nullable) | Reference to canonical Taxonomy V2 `task_types`. |
| `prompt` | `Text` | The prompt or question statement presented to the candidate. |
| `instructions` | `Text` (Nullable) | Explicit instructional directives (e.g. "Choisissez une réponse"). |
| `question_type` | `Enum(QuestionType)` | Legacy single/multiple choice discriminator. |
| `response_type` | `String(50)` | Canonical response interaction pattern (`single_choice`, `gap_fill`, etc.). |
| `level` | `String(10)` | Primary CEFR level descriptor (`A1` to `C2`). |
| `target_cefr` | `String(10)` (Nullable) | Target proficiency benchmark. |
| `difficulty` | `Integer` | 1-5 coarse difficulty scale. |
| `difficulty_rating`| `Integer` (Nullable) | Continuous difficulty rating (e.g. 100-699 scale). |
| `cognitive_complexity`| `String(50)` (Nullable) | Depth of knowledge level (`recall_recognition`, `inferential_reasoning`, etc.). |
| `points` | `Integer` | Base points awarded for correct response. |
| `penalty_points`| `Integer` | Deductions for incorrect response (if applicable). |
| `explanation` | `Text` (Nullable) | Authoritative educational solution explanation. |
| `status` | `String(20)` | Workflow status (`draft`, `in_review`, `approved`, `published`, `archived`). |
| `version` | `Integer` | Monotonically increasing version counter. |
| `is_live_delivered`| `Boolean` | True if item is currently deployed in live exams. |
| `item_hash` | `String(64)` (Nullable) | Cryptographic digest for version integrity auditing. |
| `scoring_payload`| `JSON` (Nullable) | Structured grading rubric and rules for complex response types. |

### 3.3 `QuestionOption` (`question_options`)
Answer choices enriched with pedagogical distractor rationales.

| Field | Type | Description |
|---|---|---|
| `id` | `UUID` (PK) | Unique option identifier. |
| `question_id` | `UUID` (FK) | Parent question. |
| `content` | `Text` | Option label or response choice. |
| `order_index` | `Integer` | Presentation order sequence. |
| `is_correct` | `Boolean` | Correct answer flag (**RESTRICTED: Never exposed to students in active tests**). |
| `explanation` | `Text` (Nullable) | Option-specific feedback for post-test review. |
| `misconception_type`| `String(50)` (Nullable) | Cognitive error categorization (e.g. `overgeneralization`, `false_friend`, `phonetic_confusion`). |
| `distractor_rationale`| `Text` (Nullable) | Pedagogical explanation of why candidates choose this distractor. |

### 3.4 `AssessmentSectionQuestion` (`assessment_section_questions`)
Many-to-many association enabling item reusability across multiple assessments.

| Field | Type | Description |
|---|---|---|
| `id` | `UUID` (PK) | Association record identifier. |
| `section_id` | `UUID` (FK) | Target `AssessmentSection`. |
| `question_id` | `UUID` (FK) | Reused `Question`. |
| `order_index` | `Integer` | Presentation sequence within this specific section. |
| `points_override`| `Integer` (Nullable) | Section-specific point override if different from question default. |

### 3.5 `QuestionProvenance` (`question_provenance`)
Author origin and AI generation audit trail.

| Field | Type | Description |
|---|---|---|
| `id` | `UUID` (PK) | Record identifier. |
| `question_id` | `UUID` (FK, Unique) | 1:1 relationship with `Question`. |
| `author_type` | `String(30)` | `human`, `ai_generated`, `human_curated`, `imported`. |
| `source_type` | `String(50)` | Primary origin (`press_article`, `original`, etc.). |
| `source_reference`| `Text` (Nullable) | Source URL or bibliographic reference. |
| `generator_model`| `String(100)` (Nullable)| LLM name (e.g. `gemini-1.5-pro`). |
| `generator_prompt_version`| `String(100)` (Nullable)| Prompt template tracking key. |
| `generator_parameters`| `JSON` (Nullable) | Hyperparameters (temperature, top_p, etc.). |
| `taxonomy_version_id`| `UUID` (FK, Nullable) | Taxonomy version under which item was created. |
| `reviewed_by_user_id`| `UUID` (FK, Nullable) | Human reviewer ID. |
| `reviewed_at` | `DateTime` (Nullable) | Timestamp of human pedagogical review. |
| `review_notes` | `Text` (Nullable) | Editorial remarks and remediation instructions. |

### 3.6 `QuestionValidation` (`question_validations`)
Automated quality audits and lint reports.

| Field | Type | Description |
|---|---|---|
| `id` | `UUID` (PK) | Record identifier. |
| `question_id` | `UUID` (FK) | 1:N relationship with `Question`. |
| `validation_status`| `String(30)` | `valid`, `warning`, `blocking`. |
| `blocking_error_count`| `Integer` | Count of blocking errors preventing publication. |
| `warning_count` | `Integer` | Count of non-blocking style/pedagogical warnings. |
| `issues_payload` | `JSON` | List of structured lint findings (`code`, `message`, `severity`). |
| `checked_at` | `DateTime` | Timestamp of validation run. |
| `validated_by_system_version`| `String(50)`| Validation engine version release. |

---

## 4. Security Boundary & Zero-Leak Contracts

To preserve test integrity and candidate fairness, **under no circumstances may answer keys or distractor diagnostic metadata reach a student during an active exam attempt**.

### 4.1 Schema Matrix

| Property | Student View (`QuestionStudentResponse`) | Admin View (`AdminQuestionResponse`) | Frozen Snapshot (`QuestionVersion.snapshot_payload`) |
|---|:---:|:---:|:---:|
| `id`, `prompt`, `instructions` | Yes | Yes | Yes |
| `stimulus` | Yes (Public fields) | Yes (Full metadata) | Yes (Full snapshot) |
| `response_type`, `level`, `points` | Yes | Yes | Yes |
| `options.id`, `options.content`, `options.order_index` | Yes | Yes | Yes |
| `options.is_correct` | **NEVER** | Yes | Yes |
| `options.misconception_type` | **NEVER** | Yes | Yes |
| `options.distractor_rationale` | **NEVER** | Yes | Yes |
| `options.explanation` | **NEVER** | Yes | Yes |
| `explanation` (Question level) | **NEVER** | Yes | Yes |
| `scoring_payload` | **NEVER** | Yes | Yes |
| `provenance` | **NEVER** | Yes | Yes |
| `validations` | **NEVER** | Yes | Yes |

### 4.2 Automated Invariant Assertion
The `QuestionSerializer.assert_no_student_leak` method defensively checks every student payload recursively:
```python
FORBIDDEN_STUDENT_KEYS = frozenset({
    "is_correct",
    "misconception_type",
    "distractor_rationale",
    "scoring_payload",
    "validations",
    "provenance",
})
```
If any of these keys exist in the student payload dictionary, execution immediately aborts with `QuestionSecurityViolation`.

---

## 5. Question Serialization & Snapshot Architecture

The `QuestionSerializer` class (`app.modules.assessments.question_serializer`) provides three canonical projections:

1. **`to_student_dict(question: Question) -> dict[str, Any]`**:
   - Generates sanitized student payload for active test attempts.
   - Strips all answer keys, explanations, and distractor rationales.
   - Validates against `FORBIDDEN_STUDENT_KEYS`.

2. **`to_admin_dict(question: Question) -> dict[str, Any]`**:
   - Generates full authoring and inspection payload.
   - Includes full distractor diagnostics, provenance history, and validation logs.

3. **`to_frozen_snapshot(question: Question, changelog: str | None = None) -> dict[str, Any]`**:
   - Generates an immutable, self-contained snapshot representation.
   - Includes embedded copies of stimulus, options, skill tags, and scoring configurations.
   - Stored directly into `QuestionVersion.snapshot_payload`.

---

## 6. Versioning and Immutability Semantics

When an approved or published question is edited:
1. `AdminContentService.fork_new_question_version` captures the current state via `QuestionSerializer.to_frozen_snapshot`.
2. A new `QuestionVersion` record is written with `snapshot_payload`.
3. The active `Question.version` counter is incremented, and status transitions back to `draft`.
4. Subsequent modifications to the question do NOT alter existing snapshots.
5. Student attempts and score recalculations evaluate against the specific version snapshot under which the attempt occurred.

---

## 7. Backward Compatibility Strategy

1. **Section Decoupling**:
   - `Question.section_id` remains in the database as a nullable column for backward compatibility.
   - Existing queries relying on `Question.section_id` continue to function.
   - New code references `AssessmentSectionQuestion` associations for multi-section reusability.
2. **Nullable V2 Fields**:
   - All newly added columns (`stimulus_id`, `instructions`, `target_cefr`, `difficulty_rating`, `cognitive_complexity`, `scoring_payload`, `item_hash`, `misconception_type`, `distractor_rationale`) are nullable or supply sensible defaults.
   - Legacy questions without stimuli or distractor diagnostics serialize cleanly without schema validation errors.
3. **ORM Relationships**:
   - `AssessmentSection.questions` relationship is preserved via foreign key fallback.
   - `AssessmentSection.question_associations` provides access to the many-to-many link.
