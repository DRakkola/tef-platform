# TEF Skill System — Taxonomy, Assessment & Recommendation Architecture

**Status:** Foundational reference / Architecture v1.1
**Last reconciled:** October 2, 2026
**Source baseline:** Existing codebase + empirical database audit  
**Scope:** TEF Canada learning, assessment, diagnostics, analytics, and recommendations  
**Primary sections:** Reading, Listening, Writing, Speaking  
**Audience:** Backend, frontend, content, assessment, analytics, and AI-agent development

---

## 0. Purpose

This document is the canonical reference point for the TEF Platform's **Skill System**.

The Skill System is not merely an admin CRUD interface for skills and subskills. It is the pedagogical and assessment layer that connects:

```text
TEF exam structure
        ↓
Task/question design
        ↓
Competency taxonomy
        ↓
Question/exercise tagging
        ↓
Student evidence
        ↓
Skill mastery estimation
        ↓
CEFR / NCLC profile
        ↓
Learning gaps
        ↓
Personalized recommendations
```

The system must allow the platform to answer four distinct questions:

1. **What did the student get wrong?**
2. **What competency was required to answer it?**
3. **Is the problem a reasoning/cognitive issue, a language issue, or both?**
4. **What should the student practice next?**

The system must remain explainable: every diagnostic conclusion and recommendation should be traceable to observable assessment evidence.

---

# 1. Core Design Principles

## 1.1 Separate exam structure from competencies

The TEF exam format and the underlying competencies are different concepts.

For example:

```text
Reading
└── Press article
    └── Question type: author position
        ├── Reasoning skill: identify_author_position
        ├── Language skill: discourse_markers
        └── Language skill: vocabulary_in_context
```

Do not make `press_article` a skill.

Do not make `inference` a Reading-only skill.

---

## 1.2 Separate reasoning skills from language skills

### Reasoning / cognitive skills

Describe the **mental operation** required to solve a task.

Examples:

- locate information
- identify main idea
- identify specific detail
- understand context
- compare information
- identify cause/consequence
- sequence information
- infer implicit meaning
- interpret data
- identify author/speaker position
- identify tone/intention
- interpret an argument

### Language skills / subskills

Describe the **linguistic knowledge or processing ability** required.

Examples:

- vocabulary in context
- synonym / paraphrase recognition
- collocations
- word formation
- grammatical agreement
- pronouns
- prepositions
- tense selection
- complex syntax
- subordinate clauses
- connectors
- reference resolution
- discourse markers
- semantic nuance

A question may measure either dimension or both.

---

## 1.3 Skills are reusable across exam sections

Language competencies must not be duplicated unnecessarily for every TEF section.

For example:

```text
vocabulary_in_context
    ├── Reading
    ├── Listening
    ├── Writing
    └── Speaking
```

Likewise, `reference_resolution`, `connectors`, or `lexical_precision` may appear in several sections.

The section-specific applicability belongs in a relationship/mapping, not in the skill's identity.

---

## 1.4 Do not equate a micro-skill directly with a CEFR level

A skill does not intrinsically equal A2, B1, B2, C1, etc.

Instead:

```text
Skill
  ↓
CEFR descriptors / expectations
  ↓
Observed student evidence
  ↓
Mastery estimate
  ↓
Overall section proficiency
```

A student may demonstrate B2-level performance on one competency and B1-level evidence on another while having an overall Reading estimate around B1/B1+.

CEFR and NCLC remain reporting/proficiency frameworks; the micro-taxonomy is the platform's diagnostic layer.

---

## 1.5 Evidence first, diagnosis second

Never make a student diagnosis directly from a single question result when more evidence is available.

Preferred flow:

```text
Question attempt
    ↓
Skill evidence
    ↓
Aggregation / mastery model
    ↓
Confidence + sample size
    ↓
Diagnostic conclusion
    ↓
Recommendation
```

The system must distinguish between:

- **low performance with strong evidence**
- **low performance with insufficient evidence**

---

## 1.6 Historical assessment data must be preserved

Skills can be improved, renamed, split, merged, or deprecated, but historical student evidence must remain interpretable.

Therefore the taxonomy must be **versioned** and skills must have a controlled lifecycle.

---

# 2. Conceptual Architecture

```text
                         TEF SKILL SYSTEM
                                │
             ┌──────────────────┼──────────────────┐
             │                  │                  │
      EXAM STRUCTURE        TASK TYPES        COMPETENCIES
             │                                     │
   Reading / Listening                    ┌────────┴────────┐
   Writing / Speaking                    │                 │
                                      REASONING         LANGUAGE
                                         │                 │
                                       skills            skills
                                         │                 │
                                      subskills         subskills
                                         │                 │
                                         └────────┬────────┘
                                                  │
                                       CEFR descriptors
                                                  │
                                                  ▼
                                         CONTENT TAGGING
                                                  │
                             ┌────────────────────┼───────────────────┐
                             │                    │                   │
                         Questions            Exercises        AI evaluations
                             │                    │                   │
                             └────────────────────┼───────────────────┘
                                                  ▼
                                           STUDENT EVIDENCE
                                                  │
                                                  ▼
                                           MASTERY ENGINE
                                                  │
                                  ┌───────────────┴──────────────┐
                                  │                              │
                           Skill profile                   Readiness profile
                                  │                              │
                                  └───────────────┬──────────────┘
                                                  ▼
                                         RECOMMENDATION ENGINE
```

---

# 3. Taxonomy Layers

The taxonomy must support multiple layers without forcing everything into one hierarchy.

## 3.1 Dimension

Top-level competency dimension:

```text
reasoning
language
```

Additional dimensions may be introduced later only when there is a real pedagogical need.

---

## 3.2 Domain / family

For language competencies, examples include:

```text
vocabulary
grammar
verb_system
syntax
discourse
semantics_pragmatics
pronunciation          # primarily for speaking/listening
fluency                 # primarily for speaking
orthography             # primarily for writing
```

These are organizational families, not necessarily directly assessable skills.

---

## 3.3 Skill

A skill is a meaningful, reusable competency that can receive assessment evidence.

Examples:

```text
make_inference
identify_main_idea
vocabulary_in_context
reference_resolution
complex_sentence_comprehension
argument_development
lexical_precision
```

---

## 3.4 Subskill

A subskill provides finer diagnosis when the parent skill is too broad.

Example:

```text
vocabulary
├── vocabulary_in_context
├── synonym_recognition
├── antonym_recognition
├── collocations
└── word_formation
```

A subskill may be directly assessable. A parent may be purely organizational.

---

## 3.5 Relations

Not every relationship should be represented through `parent_id`.

Use explicit relations for:

```text
prerequisite
related
supports
depends_on
broader_than
narrower_than
```

Example:

```text
reference_resolution
        ↓ depends_on
pronoun_comprehension
```

This is not necessarily a parent/child taxonomy relationship.

---

# 4. Recommended Initial Taxonomy

This is a **starting taxonomy**, not a claim that all categories are final. The taxonomy should be validated against real TEF content before being frozen.

## 4.1 Reasoning / Cognitive Skills

```text
reasoning
├── information_retrieval
│   ├── locate_information
│   └── identify_specific_detail
│
├── comprehension
│   ├── identify_main_idea
│   ├── understand_context
│   ├── understand_sequence
│   └── understand_cause_consequence
│
├── integration
│   ├── compare_information
│   ├── synthesize_information
│   └── match_information
│
├── inference
│   ├── make_inference
│   ├── infer_implicit_information
│   └── infer_pragmatic_meaning
│
├── discourse_interpretation
│   ├── identify_author_position
│   ├── identify_speaker_position
│   ├── identify_tone
│   └── identify_communicative_intention
│
├── argumentation
│   ├── identify_claim
│   ├── identify_supporting_reason
│   ├── evaluate_argument_relationship
│   └── counterargument_handling
│
└── data_interpretation
    ├── read_values
    ├── identify_trend
    └── compare_data
```

Avoid creating a taxonomy so fine-grained that every question gets 8–12 reasoning tags. Most questions should have **one primary reasoning skill** and optionally a small number of secondary skills.

---

## 4.2 Language — Vocabulary

```text
vocabulary
├── vocabulary_in_context
├── synonym_recognition
├── antonym_recognition
├── paraphrase_recognition
├── lexical_relationships
├── collocations
├── word_formation
├── polysemy
└── register_and_formality
```

---

## 4.3 Language — Grammar

```text
grammar
├── grammatical_agreement
├── articles_and_determiners
├── pronouns
├── prepositions
├── negation
├── modality
├── sentence_level_grammar
└── grammatical_constructions
```

---

## 4.4 Language — Verb System

```text
verb_system
├── conjugation
├── tense_selection
├── tense_relationships
├── mood
├── auxiliary_usage
└── verb_patterns
```

---

## 4.5 Language — Syntax

```text
syntax
├── sentence_structure
├── coordination
├── subordination
├── relative_clauses
├── conditional_structures
├── complex_sentences
└── syntactic_ambiguity
```

---

## 4.6 Language — Discourse

```text
discourse
├── connectors
├── discourse_markers
├── cohesion
├── coherence
├── reference_resolution
└── paragraph_structure
```

---

## 4.7 Language — Semantics / Pragmatics

```text
semantics_pragmatics
├── literal_meaning
├── paraphrase_interpretation
├── implied_meaning
├── nuance
└── communicative_intention
```

---

# 5. TEF Task Types Are Not Skills

Task types describe **the format and context of the assessment activity**.

## 5.1 Reading initial task taxonomy

The TEF Canada Reading test currently uses 40 multiple-choice questions within 60 minutes, with several distinct document/task families. The official sample materials include everyday documents, fill-in-the-blank items, short-document/graph matching, administrative/professional documents, and press articles.

Recommended platform task types:

```text
reading
├── daily_document
├── sentence_gap
├── text_gap
├── document_matching
├── graph_matching
├── administrative_document
├── professional_document
└── press_article
```

The task taxonomy must remain separate from the competency taxonomy.

---

## 5.2 Future task types

Listening, Writing, and Speaking will add their own task families while reusing the same underlying language/competency taxonomy where appropriate.

Examples:

```text
speaking
├── information_request_roleplay
├── persuasion_roleplay
├── guided_interaction
└── opinion_response
```

```text
writing
├── article_continuation
├── opinion_argumentation
└── structured_written_response
```

These examples are architectural placeholders and must be validated against the relevant official TEF format before being treated as final task definitions.

---

# 6. Question Metadata Model

Each question should answer:

- Which exam section?
- Which task type?
- Which competencies are being measured?
- Which language subskills are involved?
- What is the target difficulty / level context?
- What evidence should the attempt produce?

Conceptual model:

```ts
Question {
  id
  section
  taskType
  level
  ...questionContent
}
```

Skill mapping must be many-to-many:

```ts
QuestionSkill {
  questionId
  skillId

  dimension       // reasoning | language
  role            // primary | secondary
  weight          // 0.0 - 1.0
  evidenceMode    // direct | inferred
}
```

### Tagging rules

1. Every diagnostic question must have at least one primary skill.
2. Prefer **1 primary reasoning skill**.
3. Add secondary reasoning skills only when they materially contribute.
4. Language tags should describe meaningful linguistic requirements, not generic French knowledge that is irrelevant to the item.
5. Do not tag every possible skill just because it appears in the content.
6. Weights should represent the intended contribution to the evidence, not arbitrary proportions.

---

# 7. Example: TEF Reading Question

Example question intent:

> According to the article, why are consumers changing their purchasing habits?

The article may express the idea with different wording from the answer options.

Possible mapping:

```yaml
section: reading
taskType: press_article

reasoningSkills:
  - skill: understand_cause_consequence
    role: primary
    weight: 0.7
  - skill: locate_information
    role: secondary
    weight: 0.3

languageSkills:
  - skill: vocabulary_in_context
    weight: 0.4
  - skill: paraphrase_recognition
    weight: 0.3
  - skill: discourse_connectors
    weight: 0.3
```

This lets the platform distinguish:

```text
Wrong because the student failed to find the relevant sentence
```

from:

```text
Wrong because the student found the relevant sentence but failed to understand the paraphrase
```

The distinction is central to personalized learning.

---

# 8. Distractor / Error Model

For multiple-choice questions, `correct = false` is not enough for a diagnostic system.

Where possible, distractors should be authored with an intended misconception/error label.

Conceptual model:

```ts
QuestionOption {
  id
  questionId
  text
  isCorrect

  errorTags[]
}
```

Examples:

```text
missed_negation
confused_cause_with_consequence
selected_related_but_incorrect_detail
missed_paraphrase
misread_reference
misinterpreted_tone
vocabulary_confusion
```

Then an attempt can preserve:

```ts
QuestionAttempt {
  questionId
  selectedOptionId
  isCorrect
  responseTimeMs
  errorTags[]
}
```

Error tags are **diagnostic evidence**, not automatically confirmed diagnoses. They must be aggregated over time.

---

# 9. Skill Evidence Model

The central analytics object is **skill evidence**.

A question attempt should produce evidence against each tagged skill.

Conceptual model:

```ts
SkillEvidence {
  id
  studentId
  skillId

  sourceType       // question_attempt | exercise_attempt | writing_eval | speaking_eval | listening_eval
  sourceId

  outcome          // normalized observed performance, e.g. 0.0 - 1.0
  weight
  difficulty
  confidence

  metadata
  observedAt
}
```

### Important

Do not directly mutate a student's mastery score from the frontend.

Evidence should be immutable/auditable; mastery is a derived projection.

---

# 10. Student Skill Profile

The platform may expose a derived `StudentSkill` record, but it should be understood as a **current estimate**, not the raw truth.

Conceptual model:

```ts
StudentSkill {
  studentId
  skillId

  masteryScore
  estimatedLevel
  confidence

  evidenceCount
  lastEvidenceAt
  trend

  updatedAt
}
```

Possible `trend` values:

```text
improving
stable
declining
insufficient_evidence
```

The existing platform direction includes a Bayesian/rolling mastery engine. The new architecture should preserve that concept while making evidence and skill tagging more explicit.

---

# 11. Confidence and Minimum Evidence

The recommendation engine must not overreact to tiny samples.

Example:

```text
Skill: inference
Attempts: 2
Accuracy: 50%
Confidence: LOW
```

should not immediately become:

```text
"Student is weak at inference."
```

Whereas:

```text
Skill: inference
Attempts: 18
Accuracy: 51%
Confidence: HIGH
```

supports a substantially stronger diagnostic signal.

The exact statistical model can evolve, but the system must preserve at least:

```text
evidence_count
performance
confidence
recency
item_difficulty
```

---

# 12. Difficulty Is Separate From Skill

Do not encode difficulty as a property of the skill itself.

Example:

```text
inference
```

can appear in:

```text
B1-level item
B2-level item
C1-level item
```

Therefore:

```text
Skill ≠ difficulty
Skill ≠ CEFR level
```

Difficulty belongs to the assessed content/item and the resulting evidence model.

---

# 13. CEFR Descriptor Mapping

Each meaningful assessable skill may have level descriptors.

Conceptual model:

```ts
SkillLevelDescriptor {
  skillId
  cefrLevel
  descriptor
  evidenceGuidance
}
```

Example:

```text
Skill: make_inference

B1
→ Can infer relatively direct information from contextual clues.

B2
→ Can infer unstated relationships or conclusions in moderately complex material.

C1
→ Can interpret nuanced or implicit relationships across complex material.
```

These descriptors are pedagogical benchmarks. They are not a replacement for the official TEF scoring system.

---

# 14. Applicability by Section

Skills should be mapped to the sections in which they can meaningfully be assessed.

Conceptual model:

```ts
SkillApplication {
  skillId
  section          // reading | listening | writing | speaking
  relevanceWeight
  assessmentMode
}
```

For example:

```text
vocabulary_in_context
  Reading   → high
  Listening → high
  Writing   → medium
  Speaking  → medium
```

This is more maintainable than creating four duplicate vocabulary hierarchies.

---

# 15. Prerequisites and Skill Graph

The taxonomy is a hierarchy, but the learning system is a graph.

Use a separate relationship model:

```ts
SkillRelation {
  fromSkillId
  toSkillId
  relationType
}
```

Possible relation types:

```text
prerequisite
depends_on
supports
related
```

Example:

```text
complex_inference
      ↓ depends_on
reference_resolution
      ↓ depends_on
pronoun_comprehension
```

This allows the recommendation engine to avoid pushing advanced tasks when foundational gaps are blocking progress.

---

# 16. Recommendation Architecture

Recommendations should be generated from **skill gaps**, not directly from question scores.

```text
Question attempts
      ↓
Skill evidence
      ↓
Student skill profile
      ↓
Gap detection
      ↓
Prerequisite analysis
      ↓
Learning content matching
      ↓
Recommendation
```

Example:

```text
Student profile:

information_retrieval       88%
vocabulary_in_context        84%
main_idea                    79%
reference_resolution         61%
inference                    52%
author_position              48%
```

Potential diagnosis:

```text
Primary gap: author_position
Secondary gap: inference
Underlying blocker: reference_resolution
```

Potential recommendation chain:

```text
reference_resolution lesson
      ↓
reference-resolution exercises
      ↓
inference practice
      ↓
author-position practice
      ↓
mini reassessment
```

The exact recommendation policy should be configurable and explainable.

---

# 17. Recommendation Object

Conceptual model:

```ts
Recommendation {
  id
  studentId
  skillId

  reasonCode
  priority
  confidence

  targetLevel
  contentIds[]

  generatedAt
  expiresAt
}
```

Example reason codes:

```text
LOW_MASTERY
PREREQUISITE_GAP
STALE_EVIDENCE
HIGH_ERROR_RATE
READINESS_BLOCKER
SKILL_NOT_ASSESSED
```

The UI should be able to explain a recommendation in plain language:

> "You are accurate when information is stated directly, but you lose points when information must be inferred. Practice inference and reference resolution before moving to harder press-article questions."

---

# 18. Taxonomy Versioning

Every production taxonomy must have a version.

Conceptual model:

```ts
TaxonomyVersion {
  id
  version
  name
  status           // draft | active | retired
  notes
  createdAt
  activatedAt
  retiredAt
}
```

A version should be immutable after activation except for explicitly supported metadata corrections.

Historical evidence should retain enough information to determine which taxonomy definition was used at assessment time.

---

# 19. Skill Lifecycle

Skills need a controlled lifecycle:

```text
draft
  ↓
active
  ↓
archived
```

Avoid hard deletion of production skills.

Reasons:

- questions may reference the skill
- exercises may reference the skill
- student evidence may reference the skill
- historical readiness calculations may reference the skill
- reports may depend on the skill

Archiving should normally mean:

```text
Existing historical data → preserved
Existing reports         → preserved
New content tagging     → disabled
New evidence            → disabled unless explicitly allowed
```

---

# 20. Naming and Code Conventions

Machine codes should be:

- lowercase
- stable
- English
- snake_case
- semantic
- independent of display language

Examples:

```text
reading_comprehension
make_inference
identify_author_position
vocabulary_in_context
reference_resolution
complex_sentence_structure
```

Do not encode mutable labels or CEFR levels into codes:

```text
❌ inference_b2
❌ reading_skill_final
❌ vocab_new
```

Display names may be localized later.

---

# 21. Internationalization

The canonical code is language-neutral.

The display layer should support localized labels/descriptions.

Future-friendly model:

```ts
SkillTranslation {
  skillId
  locale
  name
  description
}
```

French should be the primary TEF-facing content language where appropriate, but English/internal codes remain stable.

---

# 22. Admin Skill Management Architecture

The admin interface should manage the taxonomy as a **knowledge system**, not as an expandable list of cards.

Recommended structure:

```text
┌─────────────────────────────────────────────────────────────┐
│ Skill Taxonomy                              [+ New Skill]     │
│ Search...   [All] [Reasoning] [Language]                   │
├───────────────────────┬─────────────────────────────────────┤
│                       │                                     │
│ Skill tree / list     │ Selected skill                      │
│                       │                                     │
│ Reasoning             │ Overview                            │
│  Information ...      │ Description                         │
│  Inference         ←  │ Type / family / status              │
│  Author position      │                                     │
│                       │ Subskills                           │
│ Language              │                                     │
│  Vocabulary           │ CEFR descriptors                    │
│  Grammar              │                                     │
│  Syntax               │ Section applicability              │
│  Discourse            │ Prerequisites / relations           │
│                       │                                     │
│                       │ Linked content                      │
│                       │ Questions / Exercises / Evals       │
│                       │                                     │
└───────────────────────┴─────────────────────────────────────┘
```

The UI should support:

- search by name/code/description
- dimension/family filtering
- status filtering
- create/edit/archive
- subskill management
- CEFR descriptor management
- prerequisite/relationship management
- linked content counts
- navigation to linked questions/exercises
- audit history
- safe impact inspection before archival
- future bulk import/export

The UI should use server-state caching and the project's established form/UI primitives.

---

# 23. Current Implementation Baseline (Empirical Audit)

This section records the state that exists in the codebase **today**. It is intentionally separate from the target architecture so that future agents do not confuse existing implementation with the desired V2 model.

## 23.1 What is already implemented

The current platform already has a relatively mature admin taxonomy console and API lifecycle:

```text
/admin/skills
    ↓
Master / Detail taxonomy console
    ├── Search
    ├── Category / activity filters
    ├── Skill navigator
    ├── Skill overview
    ├── Subskills
    ├── Linked content
    ├── Activity / audit
    └── Create / edit / archive / delete workflows
```

The API already exposes parent-skill CRUD, subskill CRUD, filtering, active-state handling, usage metrics, and administrative audit logging. The frontend already uses a dedicated skills feature area with navigator/detail components and form sheets.

Therefore the next work is **not a greenfield UI implementation**. The priority is to make the underlying taxonomy model correct and authoritative, then adapt the UI to expose the richer model.

## 23.2 Current canonical execution identity

`skills.id` is currently the identity consumed by the execution systems:

```text
questions
exercises
student_skills
skill_assessments
skill_evidences
writing evaluations
speaking evaluations
readiness
recommendations
        ↓
    skills.id
```

This is a key migration constraint. Historical student analytics should remain attached to the same stable skill identity wherever possible.

## 23.3 Current dual representation

The repository still contains two representations of child competencies:

```text
skills.parent_id
    ↓
child Skill rows

sub_skills
    ↓
separate SubSkill rows
```

The later Content Studio implementation uses `sub_skills`, while the original assessment/learning implementation uses the hierarchical `skills` table. A synchronization/shadow-row mechanism currently bridges the two.

**Architectural rule:** do not add new product semantics that depend on this duality. Treat it as transitional legacy state.

## 23.4 Current database integrity issue

The relational skill identity is strong for `skill_id`, but several child references remain strings:

```text
question_skill_tags.subskill   → VARCHAR
exercise_skills.subskill        → VARCHAR
mistakes.subskill               → VARCHAR
```

These values are not foreign keys. A renamed or deleted code can therefore leave historical records pointing to a nonexistent taxonomy concept.

The target system must replace these with stable skill IDs or a dedicated normalized mapping table.

## 23.5 Current taxonomy data quality issues

The empirical audit found:

- duplicated root concepts created by multiple seed paths
- orphaned reading child concepts represented as root `Skill` rows
- duplicate or overlapping grammar concepts
- overlapping connector concepts under unrelated families
- shadow duplication between `skills` and `sub_skills`

These are **data migration problems**, not reasons to create more hierarchy in the admin UI.

## 23.6 Current dimensional conflation

The existing `SkillCategory` combines two different ideas:

```text
Exam modality / pillar
  reading
  listening
  writing
  speaking

Transversal language domain
  vocabulary
  grammar
  conjugation
```

The target taxonomy must model these independently.

## 23.7 Current learning intelligence

The platform already has:

```text
SkillAssessment
SkillEvidence
StudentSkill
ReadinessProfile
Recommendation
```

and existing mastery / readiness / recommendation engines. The V2 taxonomy should therefore **feed these systems through better evidence and better skill identity**, rather than replacing them wholesale.

## 23.8 Current CEFR limitation

CEFR is currently attached primarily to question/exercise/evaluation outputs and estimated student levels. Skills themselves do not yet have structured CEFR descriptors or proficiency-band expectations.

The V2 taxonomy should add descriptor mappings without confusing a micro-skill with an official overall CEFR result.

---

# 24. Target Architecture vs. Current State

Use this table as the default decision aid when an implementation choice is unclear.

| Concern | Current state | Target state |
|---|---|---|
| Skill identity | `skills.id` | Keep stable `skills.id` |
| Child taxonomy | `parent_id` + separate `sub_skills` | One canonical hierarchical `Skill` entity |
| Subskill references | Some VARCHAR codes | Stable FK-based skill IDs |
| Dimensions | Mixed in `SkillCategory` | Separate exam modality from competency dimension/domain |
| Reasoning vs language | Not modeled explicitly | Explicit dimension/type |
| Task type | Mixed with skill semantics | Separate task-type taxonomy |
| CEFR | Mostly content/result level | Skill-level descriptors + content levels + student estimate remain separate |
| Question tags | skill + raw subskill string + weight | skill + dimension + role + weight |
| Student diagnosis | Existing rolling mastery/evidence | Preserve; enrich with better evidence attribution |
| Deletion | Current fail-safe paths exist, but DB cascades remain a concern | Archive/deactivate by default |
| Versioning | No first-class taxonomy version entity | Explicit taxonomy version + mappings |
| Relations | Mostly parent-child | Parent-child + prerequisites + related/depends-on |
| Admin UX | Mature master-detail console | Keep pattern, expand it around V2 semantics |

---

# 25. Canonical Domain Model (V2)

The target model should conceptually be: 

```text
TAXONOMY_VERSION
      │
      └── SKILL
            ├── parent_id → SKILL.id (organizational hierarchy)
            ├── dimension: reasoning | language
            ├── domain/family
            ├── status
            ├── assessability
            ├── CEFR descriptors
            ├── section applicability
            └── explicit relations

TASK_TYPE
      │
QUESTION ─── QUESTION_SKILL ─── SKILL
      │
EXERCISE ── EXERCISE_SKILL ─── SKILL
      │
EVALUATION ─ EVALUATION_SKILL ─ SKILL

STUDENT
   │
   └── SKILL_EVIDENCE ─── SKILL
           │
           └── STUDENT_SKILL (derived projection)
```

## 25.1 Skill dimensions

The minimum V2 dimensions are:

```text
reasoning
language
```

`reading`, `listening`, `writing`, and `speaking` are **exam modalities / application contexts**, not the same conceptual dimension.

## 25.2 Language domains

Initial language families:

```text
vocabulary
grammar
verb_system
syntax
discourse
semantics_pragmatics
```

Speaking/listening may later add areas such as pronunciation or fluency, but those should be introduced only when the assessment model genuinely needs them.

## 25.3 Assessable vs organizational nodes

Every taxonomy node must declare whether it can receive direct evidence:

```text
is_assessable = true
```

Organizational nodes can group child competencies without pretending they are directly measured.

This prevents the current ambiguity where both root skills and child skills may be used as evidence targets.

---

# 26. Canonical Tagging Contract

Every question/exercise/evaluation annotation should answer:

```text
1. What task is being performed?
2. What reasoning competency is being measured?
3. What language competency is involved?
4. Which skill is primary?
5. How much evidence should this item contribute to each skill?
```

Recommended shape:

```yaml
skill:
  id: skill_uuid
  dimension: reasoning | language
  role: primary | secondary
  weight: 0.0-1.0
```

A single item may have one primary skill and several secondary skills. The system must also allow a question to have only one skill when that is the honest representation of what it measures.

## 26.1 Do not over-tag

A question should not receive every skill that is incidentally encountered in the text. A language feature should be tagged only when it materially contributes to the task.

Example:

```text
Question asks for the author's implied opinion.

Primary: identify_author_position
Secondary: inference
Language: discourse_markers   (only if they materially support interpretation)
```

This keeps diagnostic analytics meaningful.

---

# 23. Current Implementation Constraints

The existing implementation has two competing subskill paradigms:

```text
A. skills.parent_id
   Historical seed data uses child Skill rows.

B. sub_skills
   Current Content Studio creates separate SubSkill rows.
```

This must be normalized before the new architecture becomes authoritative.

Important constraints identified in the existing audit:

- the `skills` table is referenced by many assessment/learning tables
- hard deletion can cascade into historical student data
- some question/exercise references use subskill strings rather than stable foreign keys
- current skill listing is unpaginated and lacks server-side search/filtering
- current parent skill update/archive lifecycle is incomplete
- current frontend uses manual fetch/state rather than the preferred TanStack Query approach
- current taxonomy lacks status/order/priority fields
- current taxonomy does not store CEFR descriptors directly

Do not treat the current `sub_skills` table as the final conceptual model simply because it exists.

---

# 27. Database Normalization Direction

Target conceptual model:

```text
TAXONOMY_VERSION
      │
      └── SKILL
            │
            ├── parent_id → SKILL.id
            ├── SKILL_LEVEL_DESCRIPTOR
            ├── SKILL_APPLICATION
            └── SKILL_RELATION

QUESTION
    │
    └── QUESTION_SKILL → SKILL

EXERCISE
    │
    └── EXERCISE_SKILL → SKILL

STUDENT
    │
    └── SKILL_EVIDENCE → SKILL
            │
            └── STUDENT_SKILL (derived)
```

Goal: references should ultimately use stable `skill_id` foreign keys rather than skill names/codes stored as unvalidated strings.

Code remains the human/system-readable identifier; ID remains the relational identity.

---

# 28. Migration Strategy

Migration must be incremental.

## Phase A — Inventory

1. Export all current `Skill` rows.
2. Export all `SubSkill` rows.
3. Identify parent/child relationships.
4. Identify duplicate semantic concepts.
5. Find all question/exercise/student references.
6. Identify string-based skill references.
7. Record current production usage counts.

## Phase B — Canonical taxonomy

1. Create taxonomy version.
2. Define canonical skill codes.
3. Map old skills/subskills to canonical IDs.
4. Define aliases for renamed concepts.
5. Define archived/merged/split behavior.

## Phase C — Reference migration

1. Add foreign-key-based mappings where missing.
2. Backfill references.
3. Verify counts.
4. Run consistency checks.
5. Keep compatibility columns only while required.

## Phase D — Application migration

Update:

- question tagging
- exercise tagging
- assessment scoring
- writing evaluation
- speaking evaluation
- readiness engine
- student skill analytics
- recommendation engine

## Phase E — Remove legacy duplication

Only after all dependencies are migrated should legacy subskill pathways be retired.

---

# 29. Validation Rules

The backend should enforce taxonomy integrity.

Examples:

```text
Skill code must be unique.
Parent must exist.
A skill cannot be its own parent.
Cycles are forbidden.
Archived skills cannot receive new production references.
Only valid dimension/category combinations are allowed.
A CEFR descriptor must reference a valid skill.
A prerequisite relation must reference valid skills.
```

For tagging:

```text
Question must have a valid task type.
Question skill references must point to active/valid skills.
Primary/secondary roles must be valid.
Weights must be in a known range.
```

---

# 30. Analytics Model

The system should eventually expose at least four levels of analytics.

## Content analytics

```text
How often is a skill assessed?
How many questions use it?
How difficult are those questions?
How discriminating are they?
```

## Student analytics

```text
mastery
accuracy
confidence
evidence count
recency
trend
```

## Gap analytics

```text
weak skills
blocked prerequisites
under-assessed skills
stale evidence
```

## Recommendation analytics

```text
recommendations shown
recommendations accepted
practice completion
post-practice improvement
```

This allows the recommendation engine itself to be evaluated.

---

# 31. Assessment Design Rules

The content team should tag questions based on **intended construct**, not on superficial content.

Bad tagging:

```text
Article mentions a past event
→ tag every question with past_tense
```

Good tagging:

```text
Question requires understanding a chronological relationship
→ reasoning: understand_sequence

Question wording requires distinguishing passé composé / imparfait
→ language: tense_relationships
```

A skill tag should answer:

> "Would this competency materially affect whether a candidate can solve the item?"

If the answer is no, don't tag it.

---

# 32. Recommended Tagging Cardinality

Use a constrained tagging model.

Typical question:

```text
1 primary reasoning skill
0–2 secondary reasoning skills
1–3 language skills
```

Complex questions may exceed these numbers, but the default should remain compact.

The goal is **diagnostic signal**, not exhaustive annotation.

---

# 33. Skill Quality Criteria

A skill is ready for production when it is:

- semantically distinct
- observable through assessment evidence
- reusable across multiple items
- understandable by content authors
- stable enough to survive taxonomy versions
- useful for student diagnostics
- useful for recommendations

Avoid skills that are:

- too broad to diagnose
- indistinguishable from another skill
- only a document/topic/category
- merely a CEFR level
- tied to one exact question
- too subjective to score consistently

---

# 34. What the System Must NOT Become

Do not build:

```text
❌ One giant tree containing exam sections + grammar + vocabulary + reasoning + CEFR

❌ Skills permanently hard-coded to one CEFR level

❌ Skill deletion that destroys historical analytics

❌ String-only references to skills

❌ Student diagnosis based on one question

❌ Recommendations based only on raw section score

❌ A taxonomy that mirrors the admin UI rather than the pedagogical model
```

---

# 35. Development Order

The implementation order should be:

```text
1. Taxonomy specification
        ↓
2. Data model / normalization
        ↓
3. Taxonomy API
        ↓
4. Reading taxonomy v1
        ↓
5. Tag representative question bank
        ↓
6. Evidence model
        ↓
7. Student mastery projection
        ↓
8. Diagnostic engine
        ↓
9. Recommendation engine
        ↓
10. Admin Skill Management UI
        ↓
11. Expand to Listening
        ↓
12. Expand to Writing
        ↓
13. Expand to Speaking
```

The admin UI should **not** be the first step. It should be built around the final domain model.

---

# 36. First Milestone: Reading v1

The first production slice should cover Reading only.

## Reading task types

```text
daily_document
sentence_gap
text_gap
document_matching
graph_matching
administrative_document
professional_document
press_article
```

## Reading reasoning coverage

At minimum:

```text
locate_information
identify_main_idea
identify_specific_detail
understand_context
understand_cause_consequence
compare_information
match_information
make_inference
infer_implicit_information
identify_author_position
identify_tone
identify_communicative_intention
interpret_data
```

## Reusable language coverage

Start with:

```text
vocabulary_in_context
synonym_recognition
paraphrase_recognition
word_formation
pronouns
prepositions
tense_relationships
complex_sentence_structure
connectors
reference_resolution
cohesion
semantic_nuance
```

This list is a starting point and should be revised during item annotation.

---

# 37. Definition of Done for Taxonomy v1

Taxonomy v1 is not complete until:

- [ ] canonical codes are defined
- [ ] parent/child semantics are documented
- [ ] reasoning and language dimensions are separated
- [ ] Reading task types are defined
- [ ] assessable skills are distinguishable from organizational nodes
- [ ] CEFR descriptors exist where useful
- [ ] section applicability is mapped
- [ ] prerequisite/related relationships are defined where justified
- [ ] all production references can resolve to stable skill IDs
- [ ] archived skills preserve history
- [ ] a representative question set has been tagged
- [ ] tagging guidelines are documented
- [ ] evidence can be traced from student result → question → skill
- [ ] recommendation logic can explain why a recommendation was produced

---

# 38. Decision Log

## Decision 001 — Skill system is a platform-wide competency layer

**Decision:** Skills are not a Reading-only or admin-only construct. They are shared infrastructure for the full TEF learning/assessment platform.

## Decision 002 — Reasoning and language are separate dimensions

**Decision:** A question may assess cognitive reasoning, linguistic knowledge, or both. These dimensions must remain distinguishable.

## Decision 003 — Task type is separate from skill

**Decision:** `press_article`, `sentence_gap`, `persuasion_roleplay`, etc. are assessment formats, not competencies.

## Decision 004 — Evidence is the source of truth for student diagnostics

**Decision:** Student mastery is derived from accumulated evidence rather than directly stored as arbitrary per-question score changes.

## Decision 005 — No destructive skill deletion in production

**Decision:** Archive/deactivate instead of hard-delete when a skill has historical or live references.

## Decision 006 — Taxonomy is versioned

**Decision:** Changes to competency definitions must not silently invalidate historical assessment data.

## Decision 007 — One canonical skill entity

**Decision:** The long-term target is one canonical hierarchical skill model; the current `Skill.parent_id` and `SubSkill` duplication must be normalized through migration rather than extended indefinitely.

---

# 39. Reference Example — Complete Question Annotation

```yaml
question:
  id: q_1842
  section: reading
  taskType: press_article
  level: B2

  skills:
    - skill: understand_cause_consequence
      dimension: reasoning
      role: primary
      weight: 0.70

    - skill: locate_information
      dimension: reasoning
      role: secondary
      weight: 0.30

    - skill: vocabulary_in_context
      dimension: language
      role: secondary
      weight: 0.40

    - skill: paraphrase_recognition
      dimension: language
      role: secondary
      weight: 0.30

    - skill: discourse_connectors
      dimension: language
      role: secondary
      weight: 0.30

  options:
    - id: a
      correct: true

    - id: b
      correct: false
      errorTags:
        - confused_cause_with_consequence

    - id: c
      correct: false
      errorTags:
        - selected_related_but_incorrect_detail

    - id: d
      correct: false
      errorTags:
        - missed_paraphrase
```

---

# 37. Reference Example — Student Diagnostic

```yaml
student: student_123
section: reading

skills:
  information_retrieval:
    mastery: 0.88
    confidence: 0.93

  vocabulary_in_context:
    mastery: 0.84
    confidence: 0.91

  main_idea:
    mastery: 0.79
    confidence: 0.86

  reference_resolution:
    mastery: 0.61
    confidence: 0.77

  inference:
    mastery: 0.52
    confidence: 0.91

  author_position:
    mastery: 0.48
    confidence: 0.89
```

Diagnostic output:

```text
Strong:
- explicit information retrieval
- vocabulary in context

Developing:
- reference resolution

Priority gaps:
- inference
- author position
```

Recommendation logic then consults prerequisites and available learning content before selecting exercises.

---

# 38. Source / Standards Note

The exam-format portions of this document should be validated against the current official TEF documentation whenever exam formats change.

For the current Reading architecture used as the starting point here, official TEF Canada materials describe a 40-question computer-based multiple-choice Reading test and provide sample families covering everyday documents, gap-completion, short-document/graph matching, administrative/professional documents, and press articles.

Official source:

- Le français des affaires / CCI Paris Île-de-France — TEF Canada candidate information and sample Reading materials.

This document intentionally distinguishes **official exam structure** from the platform's own **diagnostic skill taxonomy**, which is an internal pedagogical architecture.

---

# 39. Change Control

Any future change to the Skill System should update this document when it changes:

- taxonomy semantics
- database identity/model
- tagging rules
- evidence semantics
- mastery semantics
- CEFR mapping logic
- recommendation logic
- lifecycle/versioning rules

Implementation code should follow this document, not silently redefine the architecture.

When code and this reference disagree, the discrepancy should be explicitly resolved and the decision log updated.

---

# 40. Next Engineering Action

Before redesigning `/admin/skills`, create and approve **Taxonomy v1 for Reading** and a canonical relational model that eliminates the dual `Skill.parent_id` / `SubSkill` conceptual split.

The next deliverables should be:

```text
A. taxonomy_seed.yaml / taxonomy_seed.json
B. canonical SQLAlchemy models + Alembic migration
C. question_skill mapping model
D. skill evidence model
E. taxonomy admin API
F. representative Reading question annotation set
```

The admin UI should then be rebuilt on top of those contracts.
