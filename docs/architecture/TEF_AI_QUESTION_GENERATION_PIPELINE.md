# TEF Platform — Question System V2: AI Question Generation Pipeline

> Status: implemented. This document describes the shipped architecture of the
> AI question generation pipeline, its server-driven format catalogue, its
> asynchronous job workflow, and the admin wizard that drives it.

---

## 1. Executive summary & invariants

The AI generation pipeline is a supervised authoring copilot for human pedagogues
and psychometricians. It produces candidate TEF items that are strictly
compliant with the official task formats, CEFR levels (A1–C2) and the
psychometric authoring invariants of the Question System V2.

Fundamental invariants:

1. **Never autonomous publication.** The AI can never publish, approve or
   advance a question past `draft`. Every persisted item is created with
   `status = "draft"` and requires a human to publish it.
2. **Immutable provenance.** Every AI-generated question records
   `author_type = "ai"` on `QuestionProvenance` (generator model, prompt
   template version, latency, token usage, simulation state).
3. **Strict taxonomy restriction.** Skill tagging is resolved against persisted
   `Skill` rows only. Hallucinated UUIDs are discarded by
   `AIQuestionGenerationService._bind_skill_mappings()`.
4. **Automated audits before human review.** Every candidate is checked by:
   - the **duplicate detection engine** (canonical item hash + Jaccard
     similarity scan),
   - the **`QuestionValidationEngine`** (option counts, correct-answer
     cardinality, distractor rationales, cognitive complexity),
   - the optional **second-pass AI pedagogical review** (French naturalness,
     distractor plausibility, CEFR alignment).
5. **Immutability on regeneration.** Component-level AI regeneration
   (`distractors`, `prompt`, `explanation`) is restricted to `draft` questions;
   mutating `approved`, `published` or `archived` items returns
   `409 IMMUTABLE_QUESTION_MUTATION`.
6. **Format truth lives on the server.** The frontend never hardcodes the list
   of authorable formats. It renders every selector from the catalogue
   endpoint, so adding a task format never requires a frontend release.

---

## 2. Pipeline architecture & data flow

```
                      Human Admin / Author
                               │
     ┌─────────────────────────┴──────────────────────────┐
     │  GET /admin/content/generation/formats  (catalogue) │
     │  → modules, formats, response types, constraints    │
     └─────────────────────────┬──────────────────────────┘
                               │
              Admin wizard (/admin/questions/generate)
              1. Format  2. Stimulus  3. Generate  4. Review
                               │
        ┌──────────────────────┴──────────────────────┐
        │                                             │
  SYNC (compatibility)                      ASYNC (default)
  POST .../generation/candidates            POST .../generation/jobs → 202
        │                                             │
        │                                   Celery: tasks.
        │                                   run_ai_question_generation_job
        │                                             │
        └──────────────────────┬──────────────────────┘
                               ▼
        ┌──────────────────────────────────────────────────┐
        │            AIQuestionGenerationService           │
        │  1. resolve format spec (registry)               │
        │  2. format-aware prompt engineering + few-shot   │
        │  3. model call / deterministic simulation        │
        │  4. parse + coerce to the format contract        │
        │  5. taxonomy binding (skills only from DB)       │
        │  6. canonical item-hash + Jaccard duplicates     │
        │  7. QuestionValidationEngine audit               │
        └──────────────────────────────────────────────────┘
                               │
                               ▼
          GeneratedQuestionCandidate(s)  (in memory, audited)
                               │
                     Human author reviews
              ┌───────────────┴───────────────┐
              ▼                               ▼
     [ Dismiss candidate ]          [ Create draft ]
                                            │
                                            ▼
                              Question (`draft`, author `ai`)
                              QuestionOption (persisted IDs)
                              QuestionSkillTag (DB-verified)
                              QuestionProvenance (`ai`)
                              QuestionValidation (audit log)
                              AuditEvent (immutable trail)
```

---

## 3. Server-driven format catalogue

`apps/api/app/modules/admin/question_formats.py` is the single source of truth.

- `_SPEC_LIST` holds **24 official TEF formats**, grouped into 5 modules:

| Module | Code | Formats |
| :--- | :--- | :--- |
| Compréhension écrite | `reading` | `daily_document`, `sentence_gap`, `text_gap`, `document_matching`, `graph_matching`, `administrative_document`, `professional_document`, `press_article`, `text_ordering`, `reformulation` |
| Compréhension orale | `listening` | `short_announcement`, `radio_broadcast`, `public_survey`, `message_association`, `conversation_extract`, `phonological_recognition` |
| Lexique et structure | `lexique_structure` | `word_formation`, `adjective_agreement`, `pronoun_reference`, `syntax_construction` |
| Expression écrite | `writing` | `fait_divers`, `opinion_letter` |
| Expression orale | `speaking` | `information_gathering`, `persuasive_argumentation` |

- Each `TaskFormatSpec` carries: `code`, `module`, `name`, `admin_hint`,
  `stimulus_kind`, `allowed_response_types`, `default_response_type`,
  `option_count`, `prompt_guidance`, few-shot examples.
- `requires_stimulus` is derived: `stimulus_kind != "none"`. Formats without an
  external document (`sentence_gap`, `word_formation`, `adjective_agreement`)
  skip the stimulus step of the wizard entirely.
- `catalog_payload()` / `TaskFormatCatalogResponse` projects the table to the
  frontend (`modules`, `stimulus_kinds`, `formats`).

Response-type contracts (canonical, format-aware):

| Family | Canonical contract |
| :--- | :--- |
| matching | `scoring_payload.pairs` |
| ordering | `scoring_payload.sequence` of persisted `QuestionOption.id` UUIDs (rebound after persistence) |
| gap fill | `scoring_payload.gaps`; free-response canonical value `gap_fill` |
| short text | `accepted_answers` + `ignore_case` / `ignore_accents` |
| long text / spoken | rubric-based, no options |

`text_gap` is a **task type**, not a response type.

### Taxonomy alignment

`apps/api/app/modules/admin/seed/taxonomy_v1.yaml` is seeded by
`taxonomy_seeder.py` (`TaxonomySeedValidator.validate_dataset`):

- 24 task types ↔ 24 registry formats, 1:1, zero modality mismatches, zero
  unmapped task types.
- 5 modalities: `reading`, `listening`, `lexique_structure`, `writing`,
  `speaking` (`VALID_MODALITIES`).
- 57 skills, 183 skill–modality bindings, 164 task-type–skill mappings,
  28 CEFR descriptors, 20 skill relations.
- The seeding is data-only: no CHECK or Enum constraint exists on `modality`.

---

## 4. Core components

### 4.1 Schemas — `apps/api/app/modules/admin/ai_question_schemas.py`

- `AIQuestionGenerationRequest`: modality, `task_type_id`/`task_type_code`,
  response type, CEFR band, cognitive complexity, topic, stimulus mode/id,
  supplied stimulus text, target skills, count, temperature, model,
  `force_simulation`, `api_key_override`.
- `GeneratedQuestionCandidate`: prompt, options, skill mappings, stimulus
  excerpt, `duplicate_check`, `validation_report`, `ai_review`.
- `DuplicateCheckReport`: similarity score, matched question ID, status.
- `AIReviewReport`: quality score, naturalness score, strengths, weaknesses,
  warnings, suggested improvements.
- `AIGenerationJobCreateRequest` / `AIGenerationJobCreateResponse` /
  `AIGenerationJobResponse`: async job contracts (mirrors the sync request so
  both entrypoints stay interchangeable).
- `TaskFormatCatalogResponse`: server-driven catalogue contract.

### 4.2 Registry — `question_formats.py`

`get_spec()`, `specs_for_module()`, `catalog_payload()` plus format-aware
prompt templates, parsers, validators and coercion rules. The generation
service resolves the spec by **explicit `task_type_code` first**, falling back
to `task_type_id`, and only falls back to modality inference when neither is
supplied; an explicit code without a DB row still resolves (the registry is the
format truth), while a missing explicit row returns `None`.

### 4.3 Service — `apps/api/app/modules/admin/ai_question_service.py`

- `generate_candidates()`: prompt generation → model/simulation → parse →
  coerce → taxonomy binding → duplicates → validation.
- `_bind_skill_mappings()`: only DB-persisted `Skill` entities compatible with
  the modality survive.
- `check_question_duplicates()`: canonical item hash
  (`item_hash.py`, SHA-256 of the normalized prompt) indexed lookup plus a
  Jaccard similarity scan ordered by `created_at DESC, id DESC`.
- `create_draft_from_candidate()`: atomic commit as `draft`, provenance row,
  validation audit, immutable `AuditEvent`.
- `regenerate_draft_component()`: component regeneration for draft questions
  only, with the immutability guard.
- `get_format_catalog()`, `run_generation_job()`, `get_generation_job()`.

### 4.4 Deterministic simulation

With `force_simulation = true` (or no provider key), a deterministic local
engine produces candidates — used by tests and demos. Simulation never
publishes and never bypasses validation.

---

## 5. REST API

All endpoints are under `/api/v1/admin/` and require the `ADMIN` role
(`require_role(UserRole.ADMIN)`).

| Endpoint | Method | Description |
| :--- | :---: | :--- |
| `/content/generation/formats` | `GET` | Server-driven catalogue backing the wizard. |
| `/content/generation/jobs` | `POST` | Queue an async batch → `202` `{job, poll_url}`. |
| `/content/generation/jobs/{job_id}` | `GET` | Poll job status/result (owner or admin). |
| `/content/generation/candidates` | `POST` | Synchronous batch generation (compatibility). |
| `/content/generation/candidates/review` | `POST` | Second-pass AI pedagogical critique. |
| `/content/generation/candidates/create-draft` | `POST` | Persist an accepted candidate as `draft`. |
| `/content/generation/stimuli/generate` | `POST` | Generate a stimulus candidate. |
| `/content/generation/stimuli/persist` | `POST` | Persist a stimulus candidate. |
| `/content/questions/{question_id}/regenerate` | `POST` | Regenerate one component of a draft. |

---

## 6. Asynchronous job workflow

**Default path for large/billable batches.** HTTP endpoints never block on
expensive AI work.

```
queued ──► running ──► succeeded
                  └──► failed
```

- **Create**: `POST /content/generation/jobs` validates the payload, persists
  an `AIGenerationJob` row (`started_at`, `expires_at`, `status = queued`,
  `requested_count`, `task_type_code`, `modality`, `target_cefr`) and returns
  `202` with `poll_url`.
- **Dispatch**: `_enqueue_generation_job()` calls
  `run_ai_question_generation_job_task.delay(job_id)` and stores the
  `celery_task_id`. If the broker is unavailable the queued row survives, the
  failure is logged (`ai_generation_job.enqueue_failed`) and the client gets a
  safe French error message.
- **Worker**: `app/workers/tasks.py` →
  `@celery_app.task(name="tasks.run_ai_question_generation_job")`
  (`bind=True`, `max_retries = 3`). It marks the job `running` before work
  starts and always reaches a terminal state, so the client can stop polling.
- **Poll**: `GET /content/generation/jobs/{job_id}` returns
  `AIGenerationJobResponse` with `is_terminal` and, when succeeded, the full
  `AIBatchGenerationResponse` (`result`).
- **Owner/admin authorization** on read; 404 for other users.

Security properties:

- `api_key_override` is accepted for parity but **stripped before
  persistence** — no secret is ever written to the jobs table.
- Internal exception detail never reaches `error_message`; failures surface a
  safe, user-facing French message while stack traces stay in logs.
- Under `ENVIRONMENT in ("testing", "test")` dispatch is skipped entirely
  (tests drive the worker core directly); poll contracts remain testable.

---

## 7. Admin wizard (frontend)

`apps/web/src/features/admin/questions/AIGenerationPage.tsx`, routed at
**`/admin/questions/generate`** (`src/routes/AppRoutes.tsx`), replaces the old
`AIGenerationModal` dialog (removed).

Four steps:

1. **Format TEF** — module / format / response type / CEFR selectors rendered
   exclusively from `GET /admin/content/generation/formats`; shows the format
   hint, stimulus kind, option range and prompt guidance.
2. **Support documentaire** — stimulus studio (skipped when
   `requires_stimulus = false`): generate a support with AI, edit it inline,
   preview it with `StimulusRenderer`, persist it (`/generation/stimuli/persist`)
   to attach it, or continue with pasted/unsaved text.
3. **Génération asynchrone** — evaluation parameters (complexity, topic,
   target skill, temperature, item count, simulation). Submits
   `POST /generation/jobs` and polls `GET /generation/jobs/{id}` every 1.5 s
   (bounded, cancellation-safe) until `is_terminal`, showing job status and
   result counters.
4. **Revue & brouillon** — split-screen exam preview (stimulus left, item
   right) with validation/duplicate badges, skill tags, second-pass audit
   (`/generation/candidates/review`), dismiss, and
   “Créer le brouillon” → `POST /generation/candidates/create-draft` →
   navigates to `/admin/questions/{id}?tab=content`.

Client contracts: `apps/web/src/features/admin/types.ts`
(`TaskFormatCatalogResponse`, `AIGenerationJobResponse`, …) and
`fetchGenerationFormats()`, `createGenerationJob()`, `getGenerationJob()` in
`apps/web/src/features/admin/api.ts`.

Related UI: `QuestionWorkspaceHeader.tsx` still exposes the contextual
“Distracteurs IA” regeneration action for draft questions.

---

## 8. Verification & quality gates

Frontend (`apps/web`):

- `tests/AIGenerationWizard.test.tsx`: catalogue-driven rendering, stimulus
  step skipping, async job → polling → review, job failure surfaced without
  advancing (4 tests).
- `npm run lint` (oxlint): 0 issues in the generation wizard files.
- `npx tsc -b` / `npm run build`: 0 errors.
- `npm test` (Vitest): 43 files / 401 tests passing.

Backend (`apps/api`), verification run over the AI, question and taxonomy
suites — **174 passed, 0 failed** (3m14s):

- `tests/test_ai_question_generation.py`
- `tests/test_ai_generation_jobs.py`
- `tests/test_ai_duplicate_detection.py`
- `tests/test_ai_sandbox.py`
- `tests/test_question_formats_registry.py`
- `tests/test_question_lifecycle.py`
- `tests/test_question_v2_contract.py`
- `tests/test_question_v2_scoring.py`
- `tests/test_question_validation_engine.py`
- `tests/test_taxonomy_v1_seed.py`

Frontend suite totals for this change: 43 files / 401 tests passing.

Known pre-existing failures (unrelated to this pipeline, baseline-verified):
the `SubSkill`/`subskill_id` family across `test_assessments.py`,
`test_learning.py`, `test_learning_pipeline_v2.py`,
`test_production_readiness.py`, plus 5 test files failing to import `SubSkill`
at collection time.
