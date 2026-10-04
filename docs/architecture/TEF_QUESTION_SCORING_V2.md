# Question System V2 — Phase 5: Scoring Engine & Response-Type Architecture

## 1. Executive Summary

Question System V2 Phase 5 elevates Question V2 response types into validated, scoreable assessment primitives while guaranteeing 100% backward compatibility with all historical attempts and assessments.

The scoring architecture replaces hard-coded conditional blocks with a **Strategy & Registry pattern**:
$$\text{QuestionVersion} \longrightarrow \text{ResponseType} \longrightarrow \text{ScoringStrategy} \longrightarrow \text{ItemScoreResult}$$

---

## 2. Core Separation of Concerns

Phase 5 enforces strict psychometric separation between three concepts previously conflated:

1. **Question Format (Item Kind):**
   The pedagogical modality, stimulus binding, and prompt requirements (e.g. Reading passage analysis, Listening dialogue comprehension, Grammar drill).
2. **Response Format (`response_type`):**
   The student input shape received by the API:
   - Option identifier (`selected_option_id`)
   - List of option identifiers (`selected_option_ids`)
   - Structured JSON payload (`response_payload`) for pairings, orderings, and blank mappings
   - Free text (`text_response`)
   - Media URI / stream reference
3. **Scoring Model (`ScoringStrategy`):**
   The deterministic or asynchronous evaluation logic applied to the response to produce an `ItemScoreResult`.

```text
+---------------------------------------------------------------------------------------+
|                                    ITEM EVALUATION                                    |
+---------------------------------------------------------------------------------------+
|   Delivered Version (Immutable Snapshot)                                              |
|      ├── points                                                                       |
|      ├── response_type                                                                |
|      ├── options (correct flags, distractors, rationales)                             |
|      └── scoring_payload (pairs, sequence, gaps, accepted answers, partial credit)    |
|                                         │                                             |
|                                         ▼                                             |
|   Candidate Submission                                                                |
|      ├── selected_option_id                                                           |
|      ├── selected_option_ids                                                          |
|      ├── text_response                                                                |
|      └── response_payload (JSON)                                                      |
|                                         │                                             |
|                                         ▼                                             |
|   ScoringStrategyRegistry.get_strategy(response_type)                                 |
|      ├── SingleChoiceStrategy                                                         |
|      ├── MultipleChoiceStrategy                                                       |
|      ├── MatchingStrategy                                                             |
|      ├── OrderingStrategy                                                             |
|      ├── GapFillStrategy                                                              |
|      ├── ShortTextStrategy                                                            |
|      ├── LongTextStrategy                                                             |
|      ├── SpokenResponseStrategy                                                       |
|      └── InteractionStrategy                                                          |
|                                         │                                             |
|                                         ▼                                             |
|   ItemScoreResult                                                                     |
|      ├── raw_score: float                                                             |
|      ├── max_score: float                                                             |
|      ├── normalized_score: float (0.0 - 100.0)                                        |
|      ├── is_correct: bool | None                                                      |
|      ├── scoring_status: ScoringStatus                                                |
|      └── diagnostic_metadata: dict | None (defensively stripped from student views)   |
+---------------------------------------------------------------------------------------+
```

---

## 3. Canonical Response Types and Scoring Strategies

### 3.1 `single_choice` (`SingleChoiceStrategy`)
- **Input:** `selected_option_id` (or `selected_option_ids[0]`).
- **Scoring:** Exactly 1 correct option. Full points or 0.0.
- **Statuses:** `correct`, `incorrect`, `missing`.
- **Diagnostics:** Captures `misconception_type` and `distractor_rationale` of selected distractor.

### 3.2 `multiple_choice` (`MultipleChoiceStrategy`)
- **Input:** `selected_option_ids` (or `response_payload` list).
- **Scoring:**
  - *Default (All-or-Nothing):* Exact set equality with correct options. Full points or 0.0.
  - *Partial Credit (`partial_credit=True`):*
    $$\text{Ratio} = \max\left(0.0, \frac{|C| - |I|}{|Target|}\right)$$
    where $C$ is correct options selected, $I$ is incorrect options selected, and $Target$ is total correct options.
- **Statuses:** `correct`, `partial`, `incorrect`, `missing`.

### 3.3 `matching` (`MatchingStrategy`)
- **Input:** `response_payload` mapping `{source_id: target_id}` or pairs `[[src, tgt], ...]`.
- **Scoring:** Evaluated against `scoring_payload["pairs"]`.
  $$\text{Raw Score} = \left(\frac{\text{matching pairs}}{\text{total pairs}}\right) \times \text{points}$$
- **Statuses:** `correct` (100%), `partial` (>0%), `incorrect` (0%), `missing`.

### 3.4 `ordering` (`OrderingStrategy`)
- **Input:** `response_payload` list `["item_1", "item_2", ...]`.
- **Scoring:** Evaluated against `scoring_payload["sequence"]` or options ordered by `order_index`.
  - Exact sequence match awards 100% points (`correct`).
  - Partial credit mode awards fractional points based on items placed in the exact target position (`partial`).
- **Statuses:** `correct`, `partial`, `incorrect`, `missing`.

### 3.5 `gap_fill` (`GapFillStrategy`)
- **Input:** `response_payload` `{gap_key: candidate_text}`.
- **Scoring:** Evaluated against `scoring_payload["gaps"]` with variants.
  - Whitespace is collapsed, casing folded.
  - Accents are preserved by default (`ignore_accents=False`), reflecting standard French spelling rules.
  - Optional `ignore_accents=True` supported for relaxed phonological assessments.
  - Fractional points awarded per correctly filled blank.
- **Statuses:** `correct`, `partial`, `incorrect`, `missing`.

### 3.6 `short_text` (`ShortTextStrategy`)
- **Input:** `text_response` or `response_payload.text`.
- **Scoring:**
  - If `accepted_answers` are configured in `scoring_payload` or options: normalized exact string match. Full points or 0.0.
  - If no accepted answers are configured (open-ended short answer): marks status as `pending_evaluation`, `is_correct=None`, `raw_score=0.0`, routing item to evaluation pipelines.
- **Statuses:** `correct`, `incorrect`, `missing`, `pending_evaluation`.

### 3.7 `long_text` (`LongTextStrategy`)
- **Input:** Free-form writing text in `text_response`.
- **Scoring:** Asynchronous evaluation. Evaluates to `is_correct=None`, `raw_score=0.0`, `scoring_status=ScoringStatus.PENDING_EVALUATION`.
- **Diagnostics:** `evaluation_pipeline="writing_evaluator"`.

### 3.8 `spoken_response` (`SpokenResponseStrategy`)
- **Input:** Audio file URL or WebRTC recording reference in `text_response` or `response_payload`.
- **Scoring:** Asynchronous evaluation. Evaluates to `is_correct=None`, `raw_score=0.0`, `scoring_status=ScoringStatus.PENDING_EVALUATION`.
- **Diagnostics:** `evaluation_pipeline="speaking_evaluator"`.

### 3.9 `interaction` (`InteractionStrategy`)
- **Input:** Interactive session data or turn-taking payload.
- **Scoring:** Asynchronous evaluation. Evaluates to `is_correct=None`, `raw_score=0.0`, `scoring_status=ScoringStatus.PENDING_EVALUATION`.
- **Diagnostics:** `evaluation_pipeline="interaction_evaluator"`.

---

## 4. Immutable Version-Bound Scoring Guarantee

To eliminate retroactive psychometric drift:
1. When a candidate answers a question, `AttemptAnswer.question_version_id` is bound to the delivered version.
2. In `ScoringEngine.calculate_score`, if `answer.question_version` is present with `snapshot_payload`, all question metadata—points, response type, options, scoring keys—is read from `snapshot_payload`.
3. If an author later edits the live question, creates new distractors, changes points, or archives options in the question bank, previously submitted candidate attempts continue to score against the exact frozen snapshot delivered during their exam.

---

## 5. Learning & Readiness Engine Integration

Items with asynchronous or pending status (`is_correct is None`, `scoring_status == "pending_evaluation"`) are guarded from premature processing in `LearningService`:
- **Mistake Engine:** Only records `Mistake` entries when `ans.is_correct is False` and `scoring_status != "pending_evaluation"`.
- **Skill Evidence Ingestion:** `ReadinessEngine.ingest_evidence` skips items where `ans.is_correct is None`.
- **Algorithm Version Tagging:** `AttemptScore.scoring_algorithm_version` is persisted as `"v2"`.

---

## 6. Database Migration (Alembic 0037)

Migration `0037_scoring_v2_and_response_payload.py` extends:
1. `attempt_answers`:
   - `response_payload` (`JSON`, nullable=True)
   - `scoring_status` (`String(30)`, nullable=True)
2. `attempt_scores`:
   - `scoring_algorithm_version` (`String(20)`, server_default="v2", nullable=False)
