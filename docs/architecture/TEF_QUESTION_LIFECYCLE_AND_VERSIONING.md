# TEF Question System V2 — Question Lifecycle and Immutable Versioning

**Specification Reference:** `docs/architecture/TEF_QUESTION_V2_SPECIFICATION.md`  
**Phase:** Phase 4 (Question Lifecycle & Immutable Versioning)  
**System Invariant:** *A question that has been delivered to a student must never have its historical meaning altered by a later admin edit.*

---

## 1. Overview & Core Distinctions

Question System V2 enforces a strict architectural boundary between logical question entities and physical historical revisions:

- **Question (`Question`):** The stable, logical content identity (e.g. `Q-1042`). Maintains high-level lineage, active draft or published status, current version counter, and pedagogical metadata.
- **QuestionVersion (`QuestionVersion`):** The immutable, frozen representation of a particular published or delivered revision (e.g. `Q-1042 v1`, `Q-1042 v2`). Contains a self-contained, reproducible snapshot (`snapshot_payload`) of all options, stimuli, distractors, keys, and skill tags as they existed when examinees were tested.

---

## 2. State Machine & Transitions

The canonical lifecycle state machine governs all content from inception to retirement:

```
                 ┌─────────────┐
                 │    DRAFT    │ ◄────────────────────────┐
                 └──────┬──────┘                          │
                        │ submit_for_review               │ revert_to_draft
                        ▼                                 │ (withdrawn)
                 ┌─────────────┐                          │
                 │  IN_REVIEW  │ ─── reject_question ──► ┌──────────┐
                 └──────┬──────┘                         │ REJECTED │
                        │ approve_question               └────┬─────┘
                        ▼                                     │ revert_to_draft
                 ┌─────────────┐                              │ (reopened)
                 │   APPROVED  │                              │
                 └──────┬──────┘                              │
                        │ publish_question                    │
                        ▼                                     │
                 ┌─────────────┐                              │
                 │  PUBLISHED  │ ◄────────────────────────────┘
                 └──────┬──────┘
                        │ exam attempt answer
                        ▼
                 ┌─────────────┐
                 │  DELIVERED  │ (is_live_delivered = True)
                 └──────┬──────┘
                        │ archive_question
                        ▼
                 ┌─────────────┐
                 │  ARCHIVED   │
                 └─────────────┘
```

### Transition Specifications

| From State | Action | To State | Permission | Validation Gate | Effect on Version |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DRAFT** | `submit_for_review` | `IN_REVIEW` | `ADMIN` | `QuestionValidationEngine` (0 blocking errors) | Keeps current version |
| **IN_REVIEW** | `revert_to_draft` | `DRAFT` | `ADMIN` | None (author withdraws submission) | Keeps current version |
| **IN_REVIEW** | `approve_question` | `APPROVED` | `ADMIN` | `QuestionValidationEngine` (0 blocking errors) | Records reviewer in provenance |
| **IN_REVIEW** | `reject_question` | `REJECTED` | `ADMIN` | None (records feedback notes) | Keeps current version |
| **REJECTED** | `revert_to_draft` | `DRAFT` | `ADMIN` | None (author reopens to fix issues) | Keeps current version |
| **APPROVED** | `publish_question` | `PUBLISHED` | `ADMIN` | `QuestionValidationEngine` (0 blocking errors) | Freezes `QuestionVersion` snapshot |
| **PUBLISHED** | `submit_answer` | `DELIVERED` | `STUDENT` | Answer validation | Sets `is_live_delivered = True`, pins version |
| **PUBLISHED** / **APPROVED** / **ARCHIVED** | `create_draft_version` | `DRAFT` | `ADMIN` | Prior snapshot verified | Increments `version = N+1` |
| **ANY** | `fork_question` | `DRAFT` | `ADMIN` | Clones options/tags | Creates new `Question` entity |
| **PUBLISHED** / **DELIVERED** | `archive_question` | `ARCHIVED` | `ADMIN` | Retirement reason recorded | Non-destructive archival |

### Forbidden Transitions
Direct mutation of `status` via generic endpoints is strictly prohibited. The domain service enforces:
- `DRAFT` -> `PUBLISHED` is blocked (cannot bypass review & approval gates).
- `APPROVED` -> `DRAFT` is blocked (must be rejected or edited via draft versioning).
- `PUBLISHED` -> `DRAFT` is blocked (published items are frozen; use `create_draft_version`).
- `ARCHIVED` -> `PUBLISHED` is blocked (archived items cannot be resurrected into active pools).

---

## 3. Editing Rules & In-Place Mutation Guards

### Editable States (In-Place Mutation Permitted)
- **`DRAFT` (prior to delivery):** Authors may freely edit prompts, instructions, stimuli, options, correct answers, difficulty, CEFR target, and skill tags.
- **`REJECTED`:** Authors may edit content in place to remediate reviewer feedback.

### Immutable States (In-Place Mutation Forbidden)
- **`APPROVED`:** Content is locked awaiting publication.
- **`PUBLISHED`:** Content is live and cannot be edited in place.
- **`DELIVERED` (`is_live_delivered = True`):** Permanently frozen. Attempted in-place modification raises HTTP 400 `DELIVERED_QUESTION_IMMUTABLE`.
- **`ARCHIVED`:** Permanently locked for historical recordkeeping.

### Mutation Flow for Approved/Delivered Content
```
Current Version N (Published / Delivered)
         │
         ▼  create_draft_version()
Version N+1 (Draft, is_live_delivered=False)
         │  (Historical Version N remains permanently frozen)
         ▼  Author edits in place
         ▼  QuestionValidationEngine validation
         ▼  Submit for Review -> Approve
         ▼  Publish Version N+1
Version N+1 Published (New snapshot frozen in QuestionVersion)
```

---

## 4. Version Snapshots Contract

`QuestionVersion.snapshot_payload` contains an explicit, self-contained JSON schema guaranteeing complete pedagogical and psychometric reproducibility:

```json
{
  "snapshot_schema_version": 1,
  "snapshot_version": "2.0.0",
  "snapshot_timestamp": "2026-10-04T11:00:00Z",
  "changelog": "Clarified ambiguous distractor C",
  "question_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "version": 1,
  "prompt": "Quel est le sujet principal de cette annonce ?",
  "instructions": "Choisissez la bonne réponse.",
  "question_type": "single_choice",
  "response_type": "single_choice",
  "level": "B2",
  "target_cefr": "B2",
  "difficulty": 3,
  "difficulty_rating": 420,
  "cognitive_complexity": "inferencing_synthesis",
  "points": 1,
  "penalty_points": 0,
  "media_url": null,
  "explanation": "Le texte annonce clairement l'inauguration.",
  "status": "published",
  "is_live_delivered": true,
  "item_hash": "a1b2c3d4...",
  "task_type_id": "...",
  "scoring_payload": null,
  "stimulus": {
    "id": "...",
    "title": "Inauguration transport",
    "modality": "reading",
    "content_text": "Full passage text...",
    "text_format": "plain",
    "word_count": 13,
    "register": "standard",
    "media_url": null,
    "source_citation": null,
    "content_hash": "..."
  },
  "options": [
    {
      "id": "...",
      "content": "L'ouverture du nouveau réseau de transport",
      "order_index": 1,
      "is_correct": true,
      "explanation": "Le texte annonce clairement l'inauguration.",
      "misconception_type": null,
      "distractor_rationale": null
    }
  ],
  "skill_tags": [
    {
      "skill_id": "...",
      "subskill_id": null,
      "subskill": "Identify Main Idea",
      "role": "primary",
      "weight": 1.0,
      "context": null
    }
  ],
  "provenance": {
    "author_type": "human",
    "source_type": "original",
    "source_reference": null,
    "generator_model": null,
    "generator_prompt_version": null,
    "generator_parameters": null,
    "taxonomy_version_id": "..."
  }
}
```

---

## 5. Revision vs. Fork

| Aspect | Revision (`create_draft_version`) | Fork (`fork_question`) |
| :--- | :--- | :--- |
| **Entity Identity** | Same `Question` UUID | Brand new `Question` UUID |
| **Version Counter** | Increments (`v1 -> v2`) | Resets to `v1` |
| **Use Case** | Errata, pedagogical refinement, distractor tuning | Creating a variant, new task type, or alternative passage drill |
| **Historical Lineage** | Direct version sequence on parent Question | Explicit `source_type="forked"`, `source_details` in `QuestionProvenance` |
| **Parent Mutation** | Prior version snapshot preserved | Source question completely untouched |

---

## 6. Delivery Freeze & Historical Attempt Binding

1. **Attempt Answer Binding:** Every row in `attempt_answers` stores `question_version_id` pointing directly to the immutable `question_versions.id` delivered during the exam.
2. **Delivery Resolution:** When an examinee submits an answer:
   - If `AssessmentSectionQuestion` pinned a specific `question_version_id`, that version is bound.
   - Otherwise, the published `QuestionVersion` matching the current version is bound.
3. **Immediate Delivery Freeze:** Upon receiving the first student response, `question.is_live_delivered` is set to `True`. Subsequent attempts to modify the question in-place are rejected with HTTP 400 `DELIVERED_QUESTION_IMMUTABLE`.
4. **Historical Replay:** Graded results and mistake analytics retrieve answers joined against the delivered `question_version_id`. If an admin later drafts, approves, and publishes Version 2, the candidate's historical result continues to evaluate against Version 1.

---

## 7. Optimistic Concurrency Control

To prevent multi-author overwrites:
- `AdminStandaloneQuestionUpdate` accepts `expected_version: int`.
- If `expected_version` is provided and does not match `question.version`, the API rejects the update with HTTP 409 `CONCURRENT_MODIFICATION_CONFLICT`.

---

## 8. Taxonomy Version Compatibility

- `QuestionVersion.snapshot_payload` records `taxonomy_version_id` from provenance.
- Historical question versions remain valid under their authored taxonomy version even when new active taxonomies are published.
- Questions are never automatically mutated or retagged when global taxonomies change; retagging requires creating a new revision (`v+1`) and executing validation.

---

## 9. Student Delivery Privacy & Security Invariants

The student test delivery endpoint and `QuestionSerializer.to_student_dict()` strictly enforce that zero diagnostic secrets are transmitted to examinees:
- **Forbidden Fields:** `is_correct`, `misconception_type`, `distractor_rationale`, `scoring_payload`, `validations`, `provenance`, reviewer notes.
- Tested by automated invariants (`assert_no_student_leak`).

---

## 10. Audit Trail Behavior

Every lifecycle change logs an immutable `AuditEvent` to `audit_events`:
- `content.submitted_for_review`
- `content.approved`
- `content.rejected`
- `content.reverted`
- `content.published`
- `content.archived`
- `content.draft_version_created`
- `content.forked`

---

## 11. Migration & Backfill Strategy

1. **Alembic Migration 0036:**
   - Added `question_version_id` to `assessment_section_questions` and `attempt_answers`.
   - Deterministically backfilled historical `attempt_answers` where `question_versions(version=1)` existed.
2. **Ambiguous Legacy Records:**
   - Legacy records authored prior to Question V2 where no version snapshot existed are documented as version 1 baselines. No artificial version history is invented.
