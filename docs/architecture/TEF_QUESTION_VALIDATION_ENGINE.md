# TEF Question System V2 — Question Validation Engine

**Status:** Canonical Implementation & Architecture Specification  
**Version:** 2.0.0  
**Domain:** Assessment Engine / Content Studio / Item Banking / Quality Assurance  
**Canonical Dependencies:** `TEF_SKILL_SYSTEM_REFERENCE.md`, `docs/architecture/TEF_TAXONOMY_V2_IMPLEMENTATION_SPEC.md`, `docs/architecture/TEF_QUESTION_V2_SPECIFICATION.md`  
**Target Repository:** `tef-platform` (`apps/api/app/modules/assessments/question_validation.py`, `apps/api/app/modules/admin/tagging_service.py`)

---

## 1. Executive Summary & Purpose

The **Question Validation Engine** (`QuestionValidationEngine`) is the centralized quality, pedagogical, and psychometric gatekeeper for the TEF Platform Question System V2.

In Question System V1, question validity was fragmented or deferred to runtime failures:
- Questions could be saved with zero options or multiple correct keys without warning.
- Clueing and answer-leak patterns (e.g., verbatim stimulus quotes unique to the correct answer) passed undetected.
- Competency tags were unverified strings or permitted invalid dimension weight distributions.
- Near-duplicate questions created by multiple authors or AI generation runs could silently pollute the item bank.
- There was no persistent, immutable audit record of question validity checks over time.

The Question Validation Engine solves these challenges by providing a single canonical validation entry point that answers:
> *"Is this question structurally, pedagogically, taxonomically, and assessment-wise valid enough to proceed?"*

---

## 2. Architecture & Pipeline Integration

The engine is decoupled from database storage mechanics, allowing it to validate in-memory draft payloads (Pydantic models, raw dictionaries) as well as persisted SQLAlchemy ORM entities across multiple stages of the question lifecycle:

```text
+---------------------+    +---------------------+    +---------------------+
|   Admin Authoring   |    |    Batch Imports    |    |  Future AI Question |
|   (Draft / Edit)    |    |    (CSV / JSON)     |    |     Generation      |
+----------+----------+    +----------+----------+    +----------+----------+
           |                          |                          |
           +--------------------------+--------------------------+
                                      |
                                      v
                +-------------------------------------------+
                |        QuestionValidationEngine           |
                |   - Flexible Input Normalization          |
                |   - 9 Specialized Validation Domains      |
                |   - Multi-Level Severity Classification   |
                |   - Deterministic Duplication Detection   |
                +---------------------+---------------------+
                                      |
                                      v
                +-------------------------------------------+
                |             ValidationResult              |
                |   - is_valid (no BLOCKING errors)         |
                |   - blocking_errors, warnings, infos      |
                |   - to_payload() for API & Audit Trail    |
                +---------------------+---------------------+
                                      |
                     +----------------+----------------+
                     |                                 |
                     v                                 v
        +-------------------------+       +-------------------------+
        |   Lifecycle Gateways    |       |   Immutable Audit Log   |
        |   (Review -> Published) |       | (question_validations)  |
        +-------------------------+       +-------------------------+
```

### 2.1 Reusable Entry Points
1. **`validate_question(db, question, *, check_duplication=True, ...) -> ValidationResult`**
   - High-speed validator for API forms, live editor previews, and pre-commit checks.
   - Accepts SQLAlchemy ORM `Question`, Pydantic `AdminQuestionCreate` / `AdminStandaloneQuestionCreate`, or dictionaries.
2. **`validate_and_persist(db, question, *, actor_id=None, system_version="v2.0.0", ...) -> ValidationResult`**
   - Executes validation and commits an immutable snapshot to the `question_validations` table.
   - Automatically calculates `blocking_error_count`, `warning_count`, and stores full issue payload in JSONB.
3. **`check_duplicates(db, prompt, *, current_question_id=None, threshold=0.85) -> list[dict]`**
   - Standalone deterministic duplicate & near-duplicate similarity probe.

---

## 3. Validation Severity Taxonomy

Every issue identified by the engine is assigned an explicit `ValidationSeverity`:

| Severity | Lifecycle Impact | Description |
| :--- | :--- | :--- |
| **`BLOCKING`** | Prevents publishing / live delivery | Fatal psychometric, pedagogical, or schema flaw (e.g., zero correct options, missing prompt, weight sum mismatch, missing stimulus for reading passage). |
| **`WARNING`** | Allowed in draft; flagged in review | Sub-optimal authoring pattern (e.g., distractor length anomaly, readability discrepancy, ungrounded distractor, near-duplicate prompt). |
| **`INFO`** | Advisory only | Pedagogical guidance or quality enhancement note (e.g., lack of distractor misconception tags). |

---

## 4. The 9 Canonical Validation Domains

The engine evaluates items across nine discrete domains:

### 4.1 Domain 1: Structural Integrity (`structural`)
Verifies schema-level completeness and boundary adherence:
- **`ERR_PROMPT_EMPTY`**: Prompt is missing, null, or empty string.
- **`ERR_PROMPT_TOO_SHORT`**: Prompt contains fewer than 3 characters.
- **`ERR_INVALID_QUESTION_TYPE`**: Question type is not a valid `QuestionType` enum value.
- **`ERR_INVALID_RESPONSE_TYPE`**: Response type is not a recognized `QuestionResponseType`.
- **`ERR_INVALID_CEFR_LEVEL`**: Target CEFR level is not one of `{A1, A2, B1, B2, C1, C2}`.
- **`ERR_INVALID_DIFFICULTY_RATING`**: Numeric difficulty rating is outside the psychometric scale `[100, 699]`.
- **`ERR_INVALID_COGNITIVE_COMPLEXITY`**: Cognitive complexity level is not an official `CognitiveComplexityLevel`.
- **`ERR_POINTS_NON_POSITIVE`**: Base points value is less than or equal to 0.

### 4.2 Domain 2: Option Quality & Answer Key (`options`)
Enforces valid answer keys and distractor integrity for choice-based items:
- **`ERR_TOO_FEW_OPTIONS`**: Single choice or multiple choice items must have at least 2 options (TEF standard: 4 options).
- **`ERR_NO_CORRECT_OPTION`**: Choice items must have at least one correct option.
- **`ERR_MULTIPLE_CORRECT_SINGLE_CHOICE`**: Single-choice questions cannot designate more than one correct option.
- **`ERR_OPTION_EMPTY`**: Option content cannot be empty or blank whitespace.
- **`ERR_DUPLICATE_OPTION_CONTENT`**: All options must be mutually distinct (normalized whitespace & case).
- **`WARN_MISSING_DISTRACTOR_RATIONALE`**: Distractor is missing a pedagogical rationale explaining why it is incorrect.
- **`WARN_DISTRACTOR_LENGTH_OUTLIER`**: Correct option length deviates by more than 2.5x from average distractor length (common test-wiseness cue).

### 4.3 Domain 3: Clueing & Distractor Vulnerability (`clueing`)
Flags superficial test-taking cues that allow candidates to guess without comprehension:
- **`WARN_ABSOLUTE_LANGUAGE_DISTRACTOR`**: Distractor relies on transparent absolute qualifiers (*"toujours"*, *"jamais"*, *"absolument"*, *"aucun"*).
- **`WARN_PROMPT_WORD_CLUE_IN_CORRECT_OPTION`**: Correct option repeats rare substantive words (>4 chars) from the prompt that appear in no distractor.
- **`WARN_PROMPT_LEAK_IN_STIMULUS`**: Verbatim long n-gram overlap between correct option and stimulus that is absent from distractors.

### 4.4 Domain 4: Canonical Taxonomy & Skill Tagging (`skills`)
Delegates to `TaggingValidationEngine.audit_skill_tags`:
- **`ERR_MISSING_SKILL_TAGS`**: Question must be tagged with at least one canonical skill.
- **`ERR_DUPLICATE_SKILL_TAG`**: Same `skill_id` appears more than once in the tag list.
- **`ERR_INACTIVE_OR_MISSING_SKILL`**: Referenced skill does not exist or has `is_active=False`.
- **`ERR_INVALID_TAG_WEIGHT`**: Tag weight must satisfy `0.0 < weight <= 1.0`.
- **`ERR_DIMENSION_WEIGHT_SUM`**: Sum of weights within each dimension (reasoning, language) must equal `1.0 ± 0.01`.
- **`ERR_MULTIPLE_PRIMARY_PER_DIMENSION`**: At most one `PRIMARY` role tag permitted per dimension.
- **`ERR_INCOMPATIBLE_SKILL_TASK_TYPE`**: Skill domain contradicts task type modality (e.g., `speaking` skill on `reading` task).

### 4.5 Domain 5: Task Type & Modality Alignment (`task_type`)
- **`ERR_MISSING_TASK_TYPE`**: Content must have a valid `task_type_id`.
- **`ERR_INACTIVE_TASK_TYPE`**: Task type referenced is archived or inactive.
- **`ERR_TASK_TYPE_NOT_FOUND`**: `task_type_id` does not exist in the database.
- **`ERR_MODALITY_TASK_TYPE_MISMATCH`**: Inferred question modality does not match task type modality.

### 4.6 Domain 6: Stimulus Consistency (`stimulus`)
- **`ERR_STIMULUS_NOT_FOUND`**: Referenced `stimulus_id` does not exist in database.
- **`ERR_STIMULUS_EMPTY`**: Referenced stimulus contains neither text content nor media asset.
- **`ERR_STIMULUS_MODALITY_MISMATCH`**: Stimulus modality differs from task type modality (e.g., audio stimulus on reading task).
- **`ERR_MISSING_REQUIRED_STIMULUS`**: Stimulus-dependent task types (`daily_document`, `press_article`, etc.) must provide a linked stimulus or stimulus text.
- **`WARN_STIMULUS_WORD_COUNT_ANOMALY`**: Stimulus word count is outside standard TEF bounds for the task type.

### 4.7 Domain 7: CEFR & Difficulty Consistency (`cefr_difficulty`)
Verifies alignment between categorical CEFR levels and continuous psychometric metrics:
- **`WARN_DIFFICULTY_RATING_BAND_MISMATCH`**: Numeric difficulty rating deviates by >50 points from canonical CEFR band:
  - `A1`: [100, 199]
  - `A2`: [200, 299]
  - `B1`: [300, 399]
  - `B2`: [400, 499]
  - `C1`: [500, 599]
  - `C2`: [600, 699]
- **`WARN_COGNITIVE_COMPLEXITY_CEFR_MISMATCH`**: High-order cognitive complexity (e.g., `evaluative_synthesis`, `counter_argumentation`) assigned to low CEFR levels (`A1`, `A2`).

### 4.8 Domain 8: Duplication & Near-Duplicate Detection (`duplication`)
Guarantees item bank uniqueness and catches accidental duplicate authoring:
- **`ERR_EXACT_DUPLICATE_PROMPT`**: Identical normalized prompt string already exists in the question bank.
- **`WARN_NEAR_DUPLICATE_PROMPT`**: Prompt exhibits token Jaccard similarity $\ge 0.85$ with an existing item.
- Excludes self-comparison during question updates.

### 4.9 Domain 9: Provenance & Attribution Integrity (`provenance`)
- **`WARN_MISSING_PROVENANCE`**: Question lacks authoring attribution (`QuestionProvenance`).
- **`ERR_AI_GENERATION_MISSING_METADATA`**: AI-generated questions (`author_type="ai_generated"`) must record generator model name and prompt version.

---

## 5. Duplication Detection Architecture

The engine uses a deterministic, two-tier algorithm for high-speed duplicate detection without requiring external vector infrastructure:

```text
Incoming Prompt ──> Normalization (lowercase, strip punctuation, tokenize)
                          │
                          ├─► Tier 1: Exact Hash / String Match (DB Query)
                          │     └── Match found? ──> ERR_EXACT_DUPLICATE_PROMPT
                          │
                          └─► Tier 2: Token Set Jaccard Similarity:
                                      J(A, B) = |A ∩ B| / |A ∪ B|
                                      └── J(A, B) >= 0.85? ──> WARN_NEAR_DUPLICATE_PROMPT
```

### Future Evolution: Hybrid Lexical + Dense Embeddings
In future milestones, Tier 2 will be complemented with PostgreSQL `pgvector` dense embeddings (e.g., multilingual sentence transformers) to detect semantic paraphrasing across different vocabulary choices.

---

## 6. Audit Trail & Immutability Model

Question validations are stored in the append-only `question_validations` table. Every run produces a permanent audit record:

```sql
CREATE TABLE question_validations (
    id UUID PRIMARY KEY,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    validation_status VARCHAR(50) NOT NULL, -- 'valid', 'warning', 'blocking_error'
    blocking_error_count INTEGER NOT NULL DEFAULT 0,
    warning_count INTEGER NOT NULL DEFAULT 0,
    issues_payload JSONB NOT NULL DEFAULT '[]',
    validated_by_user_id UUID REFERENCES users(id) ONDELETE SET NULL,
    validated_by_system_version VARCHAR(50) NOT NULL DEFAULT 'v2.0.0',
    checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

### Invariants:
1. **Append-Only History:** Successive validations do not overwrite prior records; they append a new audit entry, tracking quality evolution across draft revisions.
2. **Deterministic Status:**
   - If `blocking_error_count > 0` $\implies$ `validation_status = 'blocking_error'`
   - Else if `warning_count > 0` $\implies$ `validation_status = 'warning'`
   - Else $\implies$ `validation_status = 'valid'`

---

## 7. Admin API Interface

### Endpoint:
`POST /api/v1/admin/content/questions/{question_id}/validate`

**Authorization:** Requires `admin` role.

**Request:** None (or optional query params `persist=true`, `check_duplication=true`).

**Response Schema (`QuestionValidationResultResponse`):**
```json
{
  "is_valid": true,
  "validation_status": "warning",
  "blocking_error_count": 0,
  "warning_count": 1,
  "info_count": 0,
  "validated_by_system_version": "v2.0.0",
  "issues": [
    {
      "code": "WARN_DISTRACTOR_LENGTH_OUTLIER",
      "severity": "warning",
      "message": "Correct option length (14 chars) is significantly shorter/longer than distractors average (68 chars).",
      "rule": "options",
      "field": "options",
      "metadata": {
        "correct_len": 14,
        "avg_distractor_len": 68.3
      }
    }
  ]
}
```

---

## 8. Verification & Quality Gates

The engine is verified by comprehensive unit, integration, and security test suites in `apps/api/tests/test_question_validation_engine.py`:
- 15 test cases verifying all 9 validation domains.
- Zero false positives on canonical Reading Question Bank items.
- Strict immutability verification for `question_validations` audit trail.
- 100% compliance with `ruff check` and strict typing standards.
