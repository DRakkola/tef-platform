# TEF Platform — Question System V2
## Phase 7: AI Question Generation Pipeline Specification & Implementation Guide

---

### 1. Executive Summary & Design Principles

The **AI Question Generation Pipeline (Phase 7)** introduces a supervised, production-grade artificial intelligence authoring copilot into the TEF Question System V2. It is engineered to assist human pedagogues and psychometricians by generating candidate evaluation items strictly compliant with official TEF standards, CEFR levels (A1–C2), and psychometric item-authoring invariants.

#### Fundamental Invariants
1. **Never Autonomous Publication**: AI can **never** publish, approve, or advance a question past `draft` status.
2. **Immutable Provenance**: Every AI-generated question is tagged with `author_type = "ai"` on `QuestionProvenance`, recording the exact generator model, prompt template version, latency, token consumption, and simulation state.
3. **Strict Taxonomy Restriction**: The AI generation pipeline cannot hallucinate or insert arbitrary competency identifiers. All tagged competencies must map to active, persisted `Skill` entities within the PostgreSQL database compatible with the exam modality.
4. **Automated Quality & Duplication Audits**: Before human review, every candidate is audited by:
   - **Token-based Duplicate Detection Engine**: Comparing prompt and stimulus text against the entire question bank.
   - **QuestionValidationEngine**: Enforcing option counts, single/multiple correct answers, distractor rationales, and cognitive complexity.
   - **Second-Pass AI Pedagogical Review**: An independent critique pass evaluating French naturalness, distractor plausibility, and CEFR alignment.
5. **Immutability Protection on Regeneration**: Component-level AI regeneration (distractors, prompt, explanation) is strictly restricted to questions in `draft` status. Any attempt to mutate `approved`, `published`, or `archived` questions triggers a `409 Conflict` (`IMMUTABLE_QUESTION_MUTATION`).

---

### 2. Pipeline Architecture & Data Flow

```
                      Human Admin / Author
                               │
            Configures Modality, CEFR, Complexity,
               Stimulus Mode, Topic, Skills
                               │
                               ▼
        ┌──────────────────────────────────────────────┐
        │        AIQuestionGenerationService           │
        └──────────────────────────────────────────────┘
                               │
            1. Prompt Engineering & Few-Shot Context
            2. Gemini 2.5 API Call / Deterministic Engine
            3. Strict Taxonomy Restriction & Resolution
            4. Jaccard Duplicate Detection Engine
            5. QuestionValidationEngine Automated Audit
            6. Second-Pass Pedagogical Critique (Optional)
                               │
                               ▼
        ┌──────────────────────────────────────────────┐
        │          GeneratedQuestionCandidate          │
        │  (In-Memory Candidate with Complete Audit)   │
        └──────────────────────────────────────────────┘
                               │
                     Human Author Reviews
              ┌────────────────┴────────────────┐
              ▼                                 ▼
      [ Reject Candidate ]            [ Create Draft Question ]
                                                │
                                                ▼
                                    Question (`draft`)
                                    Stimulus (`stimuli`)
                                    QuestionOption (1-4)
                                    QuestionSkillTag (DB verified)
                                    QuestionProvenance (`ai`)
                                    QuestionValidation (Audit log)
                                    AuditEvent (Immutable trail)
```

---

### 3. Core Components & Implementations

#### 3.1 Schemas (`apps/api/app/modules/admin/ai_question_schemas.py`)
- `AIQuestionGenerationRequest`: Input payload specifying modality, CEFR band (A1–C2), task type, cognitive complexity level, topic, stimulus mode, target skills, count, temperature, and simulation toggle.
- `GeneratedQuestionCandidate`: Canonical candidate draft encapsulating prompt, options, skill mappings, stimulus excerpt, duplicate check, and psychometric validation reports.
- `DuplicateCheckReport`: Audit report evaluating similarity score ($0.0 - 1.0$), matched question ID, and status (`unique`, `possible_duplicate`, `exact_duplicate`).
- `AIReviewReport`: Second-pass audit with quality score, French naturalness score, distractor analysis, strengths, and warnings.
- `CandidateCreateDraftRequest` & `CandidateRegenerateRequest`: Payloads for database persistence and component-level refinement.

#### 3.2 Service Layer (`apps/api/app/modules/admin/ai_question_service.py`)
- `generate_candidates()`: Orchestrates prompt generation, model invocation, taxonomy binding, duplication checks, and validation audits.
- `_bind_skill_mappings()`: Restricts skill tagging strictly to database-persisted `Skill` entities matching the target domain/modality. Discards hallucinated UUIDs.
- `check_question_duplicates()`: Tokenizes prompts and stimuli to compute Jaccard similarity coefficients ($\frac{|A \cap B|}{|A \cup B|}$) against the database bank.
- `create_draft_from_candidate()`: Atomically commits candidate into PostgreSQL, ensuring `status = "draft"`, creating `QuestionProvenance`, triggering `validate_and_persist()`, and logging an immutable `AuditEvent`.
- `regenerate_draft_component()`: Regenerates distractors, prompt, or explanation for an existing draft question while strictly enforcing immutability guards against non-draft states.

#### 3.3 REST API Endpoints (`apps/api/app/modules/admin/router.py`)
| Endpoint | Method | Role | Description |
| :--- | :---: | :---: | :--- |
| `/api/v1/admin/content/generation/candidates` | `POST` | Admin | Generates batch of candidate questions with automated audits. |
| `/api/v1/admin/content/generation/candidates/review` | `POST` | Admin | Runs second-pass AI pedagogical critique on candidate. |
| `/api/v1/admin/content/generation/candidates/create-draft` | `POST` | Admin | Commits approved candidate into a database draft Question. |
| `/api/v1/admin/content/questions/{question_id}/regenerate` | `POST` | Admin | Regenerates specific component on an existing draft question. |

#### 3.4 Frontend Admin Interface
- **`AIGenerationModal.tsx`**: Interactive generation studio allowing admins to configure psychometric parameters, launch generation, inspect candidates, view validation issues and duplicate scores, trigger second-pass critiques, and convert candidates into draft questions.
- **`QuestionsListPage.tsx`**: Header action button `"Générer par IA"` launching the generation modal.
- **`QuestionWorkspaceHeader.tsx`**: Contextual `"Distracteurs IA"` action in draft state for instant distractor regeneration and re-validation.

---

### 4. Verification & Quality Gates

#### Test Suites Passing
- `tests/test_ai_question_generation.py`: 8/8 tests pass (100%).
- `tests/test_question_lifecycle.py`: 14/14 tests pass (100%).
- `tests/test_question_v2_contract.py`: 7/7 tests pass (100%).
- `tests/test_question_v2_scoring.py`: 21/21 tests pass (100%).
- `tests/test_question_validation_engine.py`: 15/15 tests pass (100%).
- Total Backend Question Tests: **65 / 65 Passing**.
- Frontend Vitest Tests: **391 / 391 Passing across 41 test files**.
- Frontend TypeScript Build (`tsc -b && vite build`): **0 errors, clean production bundle**.
