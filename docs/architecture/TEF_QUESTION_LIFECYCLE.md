# TEF Question System V2 — Canonical Question Lifecycle, Versioning & Immutability

This specification defines the authoritative question lifecycle state machine, immutability rules, version branching, delivered version tracking, audit logging, and concurrency control for the TEF Platform Question System V2.

---

## 1. Lifecycle State Machine

The question lifecycle guarantees pedagogical quality, psychometric validity, and deterministic exam replay through strict server-enforced state transitions.

```
       ┌──────────┐
       │  DRAFT   │ ◄───────────────────────────┐
       └────┬─────┘                             │
            │ submit_for_review                 │
            ▼                                   │
      ┌───────────┐                             │
      │ IN_REVIEW │ ─── reject_question ───► ┌──────────┐
      └─────┬─────┘                          │ REJECTED │
            │ approve_question               └──────────┘
            ▼
      ┌───────────┐
      │ APPROVED  │
      └─────┬─────┘
            │ publish_question
            ▼
      ┌───────────┐
      │ PUBLISHED │
      └─────┬─────┘
            │ archive_question
            ▼
      ┌───────────┐
      │ ARCHIVED  │
      └───────────┘
```

### Transition Matrix

| Current State | Action | Next State | Validation Gate | Audit Event | Allowed Roles |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DRAFT** | `submit_for_review` | `IN_REVIEW` | `QuestionValidationEngine` (0 blocking errors) | `CONTENT_SUBMITTED_FOR_REVIEW` | `ADMIN` |
| **IN_REVIEW** | `approve_question` | `APPROVED` | `QuestionValidationEngine` (0 blocking errors) | `CONTENT_APPROVED` | `ADMIN` |
| **IN_REVIEW** | `reject_question` | `REJECTED` | None (records reviewer feedback) | `CONTENT_REJECTED` | `ADMIN` |
| **REJECTED** | `reopen_to_draft` | `DRAFT` | None (author remediates issues) | `CONTENT_REVERTED` | `ADMIN` |
| **APPROVED** | `publish_question` | `PUBLISHED` | `QuestionValidationEngine` (0 blocking errors) | `CONTENT_PUBLISHED` | `ADMIN` |
| **PUBLISHED** | `archive_question` | `ARCHIVED` | None (with optional replacement/reason) | `CONTENT_ARCHIVED` | `ADMIN` |
| **PUBLISHED** | `create_draft_version` | `DRAFT` (v+1) | None (creates new draft, v1 remains intact) | `CONTENT_DRAFT_VERSION_CREATED` | `ADMIN` |
| **ANY** | `fork_question` | `DRAFT` (new ID) | None (clones to new question with lineage) | `CONTENT_FORKED` | `ADMIN` |

### Forbidden Transitions
The following transitions are strictly forbidden and return HTTP 409 `LIFECYCLE_STATE_CONFLICT`:
- `DRAFT` -> `PUBLISHED` (Cannot bypass review & approval gates)
- `APPROVED` -> `DRAFT` (Must be rejected or edited via draft versioning)
- `PUBLISHED` -> `DRAFT` (Published questions are frozen; must use `create_draft_version`)
- `ARCHIVED` -> `PUBLISHED` (Archived questions cannot be resurrected without a new version)
- In-place mutation of `APPROVED`, `PUBLISHED`, or `ARCHIVED` items (returns HTTP 400 `CANNOT_EDIT_NON_DRAFT_QUESTION`)

---

## 2. Immutability & Editing Rules

### Mutable States
- **DRAFT**: Full in-place mutation of prompt, options, difficulty, points, cognitive complexity, stimulus, and skill tags is permitted.
- **REJECTED**: Editable in-place to address reviewer feedback before resubmitting.

### Immutable States
- **APPROVED**: Locked against content mutation. Can only proceed to `PUBLISHED` or be rejected back.
- **PUBLISHED**: Permanently frozen. Any modification requires branching a new version via `create_draft_version`.
- **ARCHIVED**: Permanently frozen. Maintained strictly for historical auditability and attempt replay.

### Optimistic Concurrency Control
All question update operations accept an optional `expected_version` integer in the payload. If `expected_version` is supplied and does not match `question.version`, the API raises HTTP 409 `CONCURRENT_MODIFICATION_CONFLICT`, preventing lost updates in multi-author workflows.

---

## 3. Versioning & Historical Snapshot Freezing

### The `QuestionVersion` Snapshot
When a question transitions to `PUBLISHED` (or upon drafting a new version), a permanent row is written to `question_versions`:
- `question_id`: UUID of parent Question
- `version`: Integer version number (1, 2, ...)
- `snapshot_data`: Complete, reproducible JSON dictionary containing:
  - Question core metadata (prompt, instructions, question_type, response_type, CEFR level, difficulty_rating, cognitive_complexity, points, penalty_points, stimulus_id)
  - Options list (id, content, order_index, is_correct, explanation, distractor_rationale, misconception_type)
  - Skill tags list (skill_id, subskill_id, role, weight, context)
  - Provenance (author_type, author_name, source_type, parent_id, license)
- `changelog`: Human-readable summary of modifications from the previous version.
- `created_by_user_id`: Author/Publisher ID.

### Version Branching (`create_draft_version`)
When an editor updates a `PUBLISHED` question:
1. `create_draft_version` increments `question.version` (e.g. 1 -> 2).
2. Sets `question.status = "draft"`.
3. Sets `question.is_live_delivered = False`.
4. The historical `QuestionVersion(version=1)` snapshot in the database remains unchanged.
5. In-place edits to the draft question mutate only the active Question row and its options/tags.
6. When the new draft is eventually approved and published, `QuestionVersion(version=2)` is frozen.

---

## 4. Delivered Version Tracking for Examinee Attempts

A core architectural contract of the TEF Platform is: **An examinee attempt must resolve to the exact version of the question delivered at exam time.**

### Data Model Linkage
- `assessment_section_questions.question_version_id`: Foreign key to `question_versions.id` (set when an exam section pins a specific published question version).
- `attempt_answers.question_version_id`: Foreign key to `question_versions.id` stored on every answer row.

### Answer Submission Flow
When a candidate submits an answer (`AssessmentService.submit_answer`):
1. The engine checks if the question is linked via `AssessmentSectionQuestion.question_version_id`.
2. If not pinned on the section, it resolves the published `QuestionVersion` matching `question.id` and `question.version`.
3. The resolved `question_version_id` is persisted on `AttemptAnswer.question_version_id`.
4. Subsequent score reports, mistake reviews, and historical analytics retrieve `ans.question_version_id`, guaranteeing that later edits to the question bank will never alter or corrupt the examinee's historical test record.

---

## 5. Question Forking Semantics

The `fork_question` operation enables reusing and adapting questions without corrupting original item statistics or creating accidental version collisions.

- **New Entity**: Creates an entirely new `Question` row with a new primary key UUID.
- **Deep Clone**: Deep-copies all `QuestionOption` items and `QuestionSkillTag` associations.
- **Lineage Tracking**:
  - `provenance.source_type = "forked"`
  - `provenance.source_details = {"original_question_id": str(source_q.id), "original_version": source_q.version}`
- **Source Preservation**: The source question remains unchanged in its current state.
- **Initial State**: The newly forked question begins in `DRAFT` status with `version = 1`.

---

## 6. Question Archival Semantics

When an item is deprecated or retired:
- Transitioned via `archive_question`.
- Sets `status = "archived"`, `is_live_delivered = False`.
- Captures `reason` and optional `replaced_by_id` in audit log and metadata.
- Excluded from live test authoring and active question pools.
- Retained in PostgreSQL indefinitely so past examinee records and certificates remain verifiable.

---

## 7. Audit Trail Logging

Every transition records an immutable row in `audit_events`:
- `action`: E.g. `content_submitted_for_review`, `content_approved`, `content_rejected`, `content_published`, `content_archived`, `content_forked`, `content_draft_version_created`.
- `entity_type`: `"question"`
- `entity_id`: Question UUID
- `actor_user_id`: Admin User UUID
- `payload`: Contains transition metadata (`from_status`, `to_status`, `version`, `comments`, `notes`, `changelog`).

---

## 8. Admin API Endpoints

All endpoints are prefixed with `/api/v1/admin/content/questions` and protected with `require_role(UserRole.ADMIN)`:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/{id}/submit-review` | Submit draft/rejected question for review |
| `POST` | `/{id}/approve` | Approve in-review question |
| `POST` | `/{id}/reject` | Reject in-review question with feedback |
| `POST` | `/{id}/publish` | Publish approved question and freeze snapshot |
| `POST` | `/{id}/archive` | Archive published question |
| `POST` | `/{id}/create-draft-version` | Branch new draft version from published question |
| `POST` | `/{id}/fork` | Fork question into independent new item |
| `GET` | `/{id}/versions` | List all historical frozen versions |
| `GET` | `/{id}/versions/{version_number}` | Get specific frozen version snapshot |
| `GET` | `/{id}/published-version` | Get latest published version snapshot |
| `GET` | `/{id}/history` | Get full audit event history for question |
