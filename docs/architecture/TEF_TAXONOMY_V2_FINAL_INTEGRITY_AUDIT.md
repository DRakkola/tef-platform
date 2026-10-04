# TEF Platform — Taxonomy V2 Final Integrity Audit

**Status:** Complete Audit Report  
**Date:** October 3, 2026  
**Auditor:** Platform Architecture & Engineering Audit Agent  
**Scope:** Database Schema, Backend Services & Engines, Frontend Components, Seed Data, and Migration Scripts  
**Canonical References:**
- [`TEF_SKILL_SYSTEM_REFERENCE.md`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/TEF_SKILL_SYSTEM_REFERENCE.md)
- [`docs/architecture/TEF_TAXONOMY_V2_IMPLEMENTATION_SPEC.md`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/docs/architecture/TEF_TAXONOMY_V2_IMPLEMENTATION_SPEC.md)
- [`docs/taxonomy/TEF_READING_TAXONOMY_V1.md`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/docs/taxonomy/TEF_READING_TAXONOMY_V1.md)

---

## 1. Executive Summary & Audit Scope

This document presents the full, exhaustive architectural and data integrity audit of the TEF Platform's transition to **Taxonomy V2**. 

The audit evaluates the alignment between the target architecture—defined by a tripartite separation of **Exam Task Types**, **Cognitive Reasoning Competencies**, and **Transversal Language Competencies**—and the active repository codebase and database schema across:
- **Database Schema & Foreign Keys:** Taxonomy versioning, hierarchical skill trees, content junctions (`question_skill_tags`, `exercise_skills`), student mastery tables (`student_skills`, `skill_evidences`, `skill_assessments`, `mistakes`), and legacy structures (`sub_skills`).
- **Backend Core Services & Engines:** Assessment submission pipeline, scoring engine, readiness engine, level estimation service, recommendation engine V2, admin taxonomy service, and asynchronous Celery workers.
- **Frontend Management & Delivery UI:** Taxonomy manager (`SkillsNavigator`, `SkillDetail`, `SkillOverview`), content creation forms, readiness dashboard, and recommendation views.
- **Seed & Fixture Pipelines:** Canonical taxonomy definitions vs. legacy seed pipelines and mock datasets.

### Strict Audit Protocol
In accordance with platform audit constraints:
- **No production or application code was modified during this audit.**
- Every detected issue is cataloged with its exact file/table location, current behavior, structural impact, recommended remediation, and database migration requirement.
- Findings are classified strictly into:
  - **P0:** Data integrity / historical data risk
  - **P1:** Architectural inconsistency
  - **P2:** Functional limitation
  - **P3:** Optimization / UX

---

## 2. Findings Summary by Severity

| ID | Severity | Category | File / Table | Migration Required? | Summary |
|---|---|---|---|---|---|
| **F-01** | **P0** | Dangerous Hard Deletes | `apps/api/app/modules/admin/service.py` (`SubSkillService.delete_subskill`) | No | Hard-deleting subskills deletes shadow skills without checking student evidence, causing unhandled 500 DB constraint crashes. |
| **F-02** | **P0** | Usage Aggregation Blindspot | `apps/api/app/modules/admin/taxonomy_service.py` (`batch_get_skill_usage`) | No | Usage count aggregation ignores `subskill_id`, allowing safe-delete checks to permit deletion of actively used leaf competencies. |
| **F-03** | **P0** | Duplicate Taxonomy Sources | `cli/seed.py`, `seed_content_studio.py`, `assessments/seed.py`, `seed_demo.py` | Yes (Data cleanup) | 5 divergent seed pipelines inject conflicting skill codes and dual taxonomies simultaneously into the database. |
| **F-04** | **P0** | Historical Mastery Drift | `apps/api/app/modules/learning/readiness_engine.py` (`recalculate_student_skills`) | No | Global mastery recalculation performs unconstrained scans over all skills without filtering `is_active=True` or `taxonomy_version_id`. |
| **F-05** | **P1** | CEFR Cutoff Discrepancy | `learning/levels.py` vs. `assessments/scoring.py` | No | Contradictory CEFR percentage cutoffs cause identical student scores (e.g., 62%) to be rated B2 in assessments but B1 in profiles. |
| **F-06** | **P1** | Speaking/Celery Arbitrary Selection | `speaking/service.py:299`, `workers/tasks.py:673` | No | Speaking evaluation queries 3 arbitrary skills using `Skill.category == SPEAKING limit 3` without ordering or taxonomy linkage. |
| **F-07** | **P1** | Writing AI String Fallback | `apps/api/app/modules/writing/service.py:1106-1116` | No | AI writing evaluation uses loose regex/string matching (`["writing", "expression_ecrite", "EE"]`) to resolve skills. |
| **F-08** | **P1** | Frontend Hierarchy Truncation | `apps/web/src/features/admin/skills/components/SkillsNavigator.tsx` | No | Hardcoded `hasChildren={false}` and `level={1}` prevents expanding multi-level taxonomy hierarchies beyond 1 child level. |
| **F-09** | **P1** | Legacy 1D Category Dependency | `learning/readiness_engine.py`, `learning/service.py` | No | Core calculations group competencies using legacy 1D `SkillCategory` enum rather than canonical `ExamModality` and `SkillDimension`. |
| **F-10** | **P1** | Disconnected Legacy `sub_skills` Table | `admin/models.py:156` (`SubSkill`), `alembic` | Yes (Drop/deprecate table) | Redundant `sub_skills` table persists with zero incoming foreign keys while shadow-syncing with `Skill.parent_id`. |
| **F-11** | **P2** | Assessment Submission Tag Fallback | `apps/api/app/modules/assessments/service.py:737-752` | No | Ingestion assumes index 0 is primary tag and records deprecated `subskill` string instead of resolving canonical `subskill_id`. |
| **F-12** | **P2** | Recommendation Subskill Blindspot | `apps/api/app/modules/learning/recommendations_v2.py:187-196` | No | Exercise queries only filter `ExerciseSkill.skill_id`, failing to recommend exercises tagged via `subskill_id`. |
| **F-13** | **P2** | Content Studio Tagging UI Missing | `AssessmentEditorPage.tsx`, `ExercisesListPage.tsx` | No | Content authoring interfaces lack controls for selecting `task_type_id` and multi-dimensional canonical skill tags. |
| **F-14** | **P2** | Legacy String Subskill Fallbacks | `apps/api/app/modules/learning/service.py` | No | Mistake tracking methods continue to accept and record unindexed string subskills alongside foreign keys. |
| **F-15** | **P3** | Dead Admin API Routes & Client | `admin/router.py`, `features/admin/api.ts` | No | Obsolete endpoints (`/admin/content/skills`, `/admin/content/subskills`) remain active and exposed to the frontend. |
| **F-16** | **P3** | Readiness Dashboard Missing Dimensions | `apps/web/src/features/readiness` | No | Student readiness UI displays flat skill cards without distinguishing Reasoning vs. Language dimensions or CEFR descriptors. |
| **F-17** | **P3** | Missing Composite Indexes | `question_skill_tags`, `exercise_skills` | Yes (Add indexes) | High-volume item evaluation queries lack composite index on `(skill_id, role)`. |

---

## 3. Detailed Audit Findings

---

### [P0] Critical Findings: Data Integrity & Historical Evidence Risk

#### Finding F-01: Hard-deleting subskills deletes shadow skills without student evidence checks
- **Exact File / Table:**  
  - File: [`apps/api/app/modules/admin/service.py:432-460`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/app/modules/admin/service.py#L432-L460)  
  - Affected Tables: `sub_skills`, `skills`, `student_skills`, `skill_evidences`, `skill_assessments`
- **Current Behavior:**  
  The legacy `SubSkillService.delete_subskill` method checks whether the subskill is referenced in `QuestionSkillTag` or `ExerciseSkill`. If neither is found, it hard-deletes the `SubSkill` row and immediately attempts to hard-delete the corresponding shadow `Skill` row (`await db.execute(delete(Skill).where(Skill.id == subskill.id))`). It performs **no verification** of whether student mastery records (`student_skills`), evaluation evidence (`skill_evidences`), or immutable assessment attempts (`skill_assessments`) reference this `Skill.id`.
- **Why It Matters:**  
  `student_skills`, `skill_evidences`, and `skill_assessments` enforce `ForeignKey("skills.id", ondelete="RESTRICT")`. When an admin deletes a subskill that has accumulated historical student performance data, the deletion fails with an unhandled database `IntegrityError`, causing an HTTP 500 error. More critically, if cascading rules were inadvertently enabled or foreign keys bypassed, it would permanently destroy student learning history.
- **Recommended Correction:**  
  1. Deprecate and remove the hard-delete operation in `SubSkillService.delete_subskill`.
  2. Enforce the soft-delete/archival pattern (`is_active = False`) established in `TaxonomyService.archive_skill`.
  3. Expand pre-deletion verification in all admin deletion pathways to check `student_skills`, `skill_evidences`, and `skill_assessments`.
- **Database Migration Required:** No schema change required; service logic correction only.

---

#### Finding F-02: Usage count aggregation ignores `subskill_id`, allowing safe-delete checks to delete active competencies
- **Exact File / Table:**  
  - File: [`apps/api/app/modules/admin/taxonomy_service.py:90-190`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/app/modules/admin/taxonomy_service.py#L90-L190)  
  - Affected Tables: `question_skill_tags`, `exercise_skills`, `skills`
- **Current Behavior:**  
  The `TaxonomyService.batch_get_skill_usage` method aggregates content usage to prevent deletion of in-use skills. The queries for questions and exercises are written as:
  ```python
  q_stmt = (
      select(QuestionSkillTag.skill_id, func.count(QuestionSkillTag.id))
      .where(QuestionSkillTag.skill_id.in_(unique_ids))
      .group_by(QuestionSkillTag.skill_id)
  )
  ```
  The query completely omits `QuestionSkillTag.subskill_id` and `ExerciseSkill.subskill_id`.
- **Why It Matters:**  
  In the canonical taxonomy (e.g. Reading V1), questions and exercises are frequently tagged with leaf competencies assigned via `subskill_id` (with a container skill assigned as `skill_id`). When `TaxonomyService.delete_skill_safe` checks usage for a leaf competency, `batch_get_skill_usage` returns `question_count: 0` and `exercise_count: 0`. The system allows deletion of the competency, which subsequently breaks active assessment items.
- **Recommended Correction:**  
  Update `batch_get_skill_usage` to union or combine counts across both `skill_id` and `subskill_id`:
  ```python
  # Question usage query should count occurrences as primary skill or subskill
  q_stmt = (
      select(
          func.coalesce(QuestionSkillTag.subskill_id, QuestionSkillTag.skill_id).label("tracked_skill_id"),
          func.count(QuestionSkillTag.id)
      )
      .where(
          or_(
              QuestionSkillTag.skill_id.in_(unique_ids),
              QuestionSkillTag.subskill_id.in_(unique_ids)
          )
      )
      .group_by("tracked_skill_id")
  )
  ```
- **Database Migration Required:** No migration required.

---

#### Finding F-03: Five divergent seed pipelines injecting duplicate and conflicting skill codes
- **Exact File / Table:**  
  - Files:  
    - [`apps/api/app/modules/admin/reading_taxonomy_data.py`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/app/modules/admin/reading_taxonomy_data.py) (Canonical V2)  
    - [`apps/api/app/cli/seed.py:80-140`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/app/cli/seed.py) (Master CLI Seed)  
    - [`apps/api/app/seed_content_studio.py:120-210`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/app/seed_content_studio.py) (Content Studio Seed)  
    - [`apps/api/app/modules/assessments/seed.py:40-90`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/app/modules/assessments/seed.py) (Assessment Seed)  
    - [`apps/api/app/seed_demo.py:50-110`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/app/seed_demo.py) (Demo Seed)  
  - Affected Tables: `skills`, `sub_skills`, `taxonomy_versions`
- **Current Behavior:**  
  The repository maintains five separate, conflicting taxonomy seed sources:
  1. `reading_taxonomy_data.py`: Seeds canonical Taxonomy V2 codes (`reasoning_reading_root`, `reasoning_locate_information`, `lang_vocab_in_context`).
  2. `seed_content_studio.py`: Seeds legacy codes (`reading_comp`, `reading_factual_info`, `grammar_mastery`, `grammar_subjunctive_mood`).
  3. `assessments/seed.py`: Seeds legacy codes (`reading_comprehension`, `reading_gist`, `reading_detail`, `reading_inference`).
  4. `learning/seed.py`: Seeds legacy codes (`writing_expression`, `speaking_expression`, `vocabulary`, `grammar`, `connectors`).
  5. `seed_demo.py`: Seeds uppercase abbreviation codes (`GRAM_SUBJ`, `LIST_RADIO`, `READ_FAITS`, `WRIT_SECTB`).
  In `apps/api/app/cli/seed.py`, running `python -m app.cli.seed` executes both the legacy seed and the canonical V2 seed, creating parallel, disconnected skill entities for identical pedagogical concepts in the same database.
- **Why It Matters:**  
  Student answers to demo questions or content studio exercises generate evidence pointing to `reading_factual_info`, while official reading assessments generate evidence pointing to `reasoning_locate_information`. The platform fails to aggregate learning analytics, readiness diagnostics remain fragmented, and recommendations cannot find appropriate drills.
- **Recommended Correction:**  
  1. Designate `reading_taxonomy_data.py` (and forthcoming listening/writing/speaking canonical modules) as the **single source of truth**.
  2. Refactor `seed_content_studio.py`, `assessments/seed.py`, and `seed_demo.py` to reference canonical skill codes from Taxonomy V2.
  3. Implement a database cleanup migration script that remaps historical skill references from legacy codes to canonical V2 IDs and removes legacy seed records.
- **Database Migration Required:** Yes (Data migration/cleanup script to remap legacy references).

---

#### Finding F-04: Global readiness recalculation performs unconstrained scan over all skills without version/active scoping
- **Exact File / Table:**  
  - File: [`apps/api/app/modules/learning/readiness_engine.py:593, 622`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/app/modules/learning/readiness_engine.py#L593)  
  - Affected Tables: `skills`, `student_skills`, `skill_level_descriptors`
- **Current Behavior:**  
  In `ReadinessEngine.recalculate_student_skills` and `evaluate_cefr_readiness`:
  ```python
  skills_result = await db.execute(select(Skill))
  all_skills = skills_result.scalars().all()
  ```
  The query executes an unconstrained full-table scan on `skills` without filtering by `is_active == True` or scoping to the student's active `taxonomy_version_id`.
- **Why It Matters:**  
  Archived skills, deprecated test-fixture skills, or competencies belonging to retired taxonomy versions are pulled into active student readiness calculations. If an archived skill has zero evidence, the student profile can register an unearned deficit (gap), corrupting readiness scores and generating spurious recommendations.
- **Recommended Correction:**  
  Scope the skill query to active skills under the active taxonomy version:
  ```python
  stmt = (
      select(Skill)
      .where(Skill.is_active.is_(True))
  )
  if active_version_id:
      stmt = stmt.where(Skill.taxonomy_version_id == active_version_id)
  ```
- **Database Migration Required:** No migration required.

---

### [P1] Architectural Inconsistencies

#### Finding F-05: Contradictory CEFR percentage cutoffs between ScoringEngine and LevelEstimationService
- **Exact File / Table:**  
  - Files:  
    - [`apps/api/app/modules/learning/levels.py:22-28`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/app/modules/learning/levels.py#L22-L28) (`LevelEstimationService`)  
    - [`apps/api/app/modules/assessments/scoring.py:165-171`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/app/modules/assessments/scoring.py#L165-L171) (`ScoringEngine`)
- **Current Behavior:**  
  The platform maintains two conflicting CEFR score cutoffs:
  - `LevelEstimationService`:
    - `A1`: 0% – 34%
    - `A2`: 35% – 49%
    - `B1`: 50% – 64%
    - `B2`: 65% – 79%
    - `C1`: 80% – 89%
    - `C2`: 90%+
  - `ScoringEngine`:
    - `A1`: 0% – 29%
    - `A2`: 30% – 44%
    - `B1`: 45% – 59%
    - `B2`: 60% – 74%
    - `C1`: 75% – 89%
    - `C2`: 90%+
- **Why It Matters:**  
  A student scoring **62%** on a reading assessment receives a **B2** on their assessment result screen (`ScoringEngine`). However, when viewing their student profile and skill readiness dashboard (`LevelEstimationService`), their level for that same skill is displayed as **B1**. This discrepancy undermines diagnostic credibility and causes confusion.
- **Recommended Correction:**  
  Extract CEFR cutoff thresholds into a single canonical configuration or constant in `app/core/constants.py` or `app/modules/learning/levels.py`, and mandate that `ScoringEngine`, `LevelEstimationService`, and frontend utilities import and utilize the identical benchmark map.
- **Database Migration Required:** No migration required.

---

#### Finding F-06: Speaking evaluation queries arbitrary skills via `Skill.category == SPEAKING limit 3`
- **Exact File / Table:**  
  - Files:  
    - [`apps/api/app/modules/speaking/service.py:299-308`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/app/modules/speaking/service.py#L299-L308)  
    - [`apps/api/app/workers/tasks.py:673-682`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/app/workers/tasks.py#L673-L682)
  - Affected Tables: `skills`, `speaking_evaluation_skills`
- **Current Behavior:**  
  When conducting speaking evaluations, the service executes:
  ```python
  skills = await db.scalars(
      select(Skill).where(Skill.category == SkillCategory.SPEAKING).limit(3)
  )
  ```
  The query uses the legacy 1D category enum, provides no `order_by`, and does not inspect the canonical speaking taxonomy, task type, or skill relations.
- **Why It Matters:**  
  In PostgreSQL, a query with `limit 3` and no deterministic ordering returns arbitrary rows depending on database physical page layout. Students completing identical speaking tasks are evaluated on randomly differing competencies. Furthermore, speaking evaluation bypasses the reasoning vs. language dimensional split.
- **Recommended Correction:**  
  1. Define canonical task-to-skill applicability for speaking tasks (Section A: informal presentation / information gathering; Section B: formal argumentation / persuasion).
  2. Associate speaking evaluation criteria directly with specific canonical competencies (e.g. `reasoning_argumentation`, `lang_phonetics_fluency`, `lang_lexical_range`) rather than querying arbitrary records.
- **Database Migration Required:** No migration required (schema already supports task and skill relationships).

---

#### Finding F-07: Writing AI evaluation relies on fragile string matching to resolve skills
- **Exact File / Table:**  
  - File: [`apps/api/app/modules/writing/service.py:1106-1116`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/app/modules/writing/service.py#L1106-L1116)  
  - Affected Tables: `skills`, `writing_tasks`, `writing_correction_skills`
- **Current Behavior:**  
  When resolving competencies for writing evaluations, the AI evaluation fallback executes:
  ```python
  stmt = select(Skill).where(
      or_(
          Skill.code.in_(["writing", "expression_ecrite", "EE", "writing_b2"]),
          Skill.name.ilike("%writing%"),
          Skill.name.ilike("%écrite%"),
      )
  )
  ```
- **Why It Matters:**  
  This heuristic string matching is fragile. If the taxonomy defines `reasoning_argumentative_synthesis` or `lang_discourse_connectors`, this query fails to associate the evaluation with the proper canonical skill, defaulting to null or an arbitrary fallback entity.
- **Recommended Correction:**  
  Link `WritingTask` explicitly to canonical `TaskType` and attach canonical `QuestionSkillTag`-style competency tags to the writing prompt. Ingest evaluation evidence directly against these pre-defined skill IDs.
- **Database Migration Required:** No migration required.

---

#### Finding F-08: Frontend navigation truncates taxonomy hierarchy to exactly one child level
- **Exact File / Table:**  
  - File: [`apps/web/src/features/admin/skills/components/SkillsNavigator.tsx:100-111`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/web/src/features/admin/skills/components/SkillsNavigator.tsx#L100-L111)
- **Current Behavior:**  
  When rendering the tree of competencies, `SkillsNavigator` renders root skills (`parent_id === null`) and loops through their direct children. However, for every child item, it hardcodes:
  ```tsx
  <SkillTreeItem
    key={child.id}
    skill={child}
    level={1}
    hasChildren={false}
    isExpanded={false}
    ...
  />
  ```
- **Why It Matters:**  
  The canonical Taxonomy V2 hierarchy (specified in `TEF_READING_TAXONOMY_V1.md`) is inherently 3-level:
  `Root Container` (`reasoning_reading_root`) $\rightarrow$ `Functional Sub-Containers` (`reasoning_info_extraction`) $\rightarrow$ `Assessable Leaf Competencies` (`reasoning_locate_information`).  
  Because `hasChildren={false}` is hardcoded for level 1 items, administrators and content authors cannot expand sub-containers to view or manage assessable leaf competencies in the navigation UI.
- **Recommended Correction:**  
  Refactor `SkillsNavigator.tsx` to render recursively:
  ```tsx
  const renderSkillTree = (parentId: string | null = null, level = 0) => {
    const nodes = skillsByParent.get(parentId) || [];
    return nodes.map((node) => {
      const children = skillsByParent.get(node.id) || [];
      const hasChildren = children.length > 0;
      return (
        <React.Fragment key={node.id}>
          <SkillTreeItem
            skill={node}
            level={level}
            hasChildren={hasChildren}
            isExpanded={expandedIds.has(node.id)}
            ...
          />
          {hasChildren && expandedIds.has(node.id) && renderSkillTree(node.id, level + 1)}
        </React.Fragment>
      );
    });
  };
  ```
- **Database Migration Required:** No migration required (pure frontend component fix).

---

#### Finding F-09: Core learning calculations rely on legacy 1D `SkillCategory` enum
- **Exact File / Table:**  
  - Files:  
    - [`apps/api/app/modules/learning/readiness_engine.py:348-356`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/app/modules/learning/readiness_engine.py#L348-L356)  
    - [`apps/api/app/modules/learning/service.py:530-545`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/app/modules/learning/service.py#L530-L545)
- **Current Behavior:**  
  Methods aggregate student performance by iterating over `SkillCategory`:
  ```python
  for category in [SkillCategory.READING, SkillCategory.LISTENING, SkillCategory.WRITING, SkillCategory.SPEAKING]:
      # fetch skills by category
  ```
- **Why It Matters:**  
  In Taxonomy V2, `SkillCategory` is a legacy construct that conflates exam modality with transversal enabling skills (`GRAMMAR`, `VOCABULARY`). Canonical skills are partitioned by `modality` (`ExamModality`) and `dimension` (`SkillDimension`). Grouping strictly by `category` causes transversal language competencies (which support reading and listening) to be miscategorized or omitted from section readiness.
- **Recommended Correction:**  
  Refactor readiness aggregation to query skills by `modality` and `dimension`. Use `SkillRelation` (applicability) to map language competencies to their target exam sections.
- **Database Migration Required:** No migration required.

---

#### Finding F-10: Redundant `sub_skills` table persists with zero incoming foreign keys
- **Exact File / Table:**  
  - File: [`apps/api/app/modules/admin/models.py:156-175`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/app/modules/admin/models.py#L156-L175)  
  - Affected Table: `sub_skills`
- **Current Behavior:**  
  The `sub_skills` table exists in PostgreSQL. However:
  - `QuestionSkillTag.subskill_id` points to `skills.id` (not `sub_skills.id`).
  - `ExerciseSkill.subskill_id` points to `skills.id` (not `sub_skills.id`).
  - `Mistake.subskill_id` points to `skills.id` (not `sub_skills.id`).
  - No foreign keys reference `sub_skills.id`.
  Meanwhile, `SubSkillService` in `admin/service.py` continues to insert rows into `sub_skills` while simultaneously creating shadow rows in `skills`.
- **Why It Matters:**  
  Maintaining a disconnected table that duplicates the self-referential `Skill.parent_id` tree violates single-source-of-truth principles, creates dead data, and confuses developers and migration scripts.
- **Recommended Correction:**  
  Generate an Alembic migration to formally deprecate and drop the `sub_skills` table. Redirect all legacy subskill operations to manage child `Skill` records directly.
- **Database Migration Required:** Yes (Alembic migration to drop `sub_skills`).

---

### [P2] Functional Limitations

#### Finding F-11: Assessment submission assumes first tag is primary and logs string subskill
- **Exact File / Table:**  
  - File: [`apps/api/app/modules/assessments/service.py:737-752`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/app/modules/assessments/service.py#L737-L752)  
  - Affected Tables: `question_skill_tags`, `mistakes`
- **Current Behavior:**  
  When an assessment answer is evaluated, mistake generation logic executes:
  ```python
  primary_tag = q.skill_tags[0] if q.skill_tags else None
  subskill_str = primary_tag.subskill if primary_tag else None
  ```
- **Why It Matters:**  
  1. `q.skill_tags[0]` assumes database retrieval order guarantees the primary tag is first. If tags are returned in alternate order, a secondary tag is erroneously treated as primary.
  2. It accesses `primary_tag.subskill` (the legacy string column) rather than `primary_tag.subskill_id`, perpetuating unindexed text in mistake records.
- **Recommended Correction:**  
  Find the primary tag explicitly via role comparison and pass `subskill_id`:
  ```python
  primary_tag = next((t for t in q.skill_tags if t.role == SkillTagRole.PRIMARY), None) or (q.skill_tags[0] if q.skill_tags else None)
  subskill_id = primary_tag.subskill_id if primary_tag else None
  ```
- **Database Migration Required:** No migration required.

---

#### Finding F-12: Exercise recommendation query ignores `subskill_id`
- **Exact File / Table:**  
  - File: [`apps/api/app/modules/learning/recommendations_v2.py:187-196`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/app/modules/learning/recommendations_v2.py#L187-L196)  
  - Affected Tables: `exercise_skills`, `exercises`
- **Current Behavior:**  
  When selecting exercises to target identified skill deficits, the query filters:
  ```python
  stmt = (
      select(Exercise)
      .join(ExerciseSkill, ExerciseSkill.exercise_id == Exercise.id)
      .where(ExerciseSkill.skill_id.in_(target_skill_ids))
  )
  ```
- **Why It Matters:**  
  If targeted practice exercises are tagged with specific leaf competencies via `ExerciseSkill.subskill_id` (with a high-level container as `skill_id`), this query will not match them. The engine falsely reports that no exercises are available for the student's weakest competencies.
- **Recommended Correction:**  
  Match against both `skill_id` and `subskill_id`:
  ```python
  stmt = (
      select(Exercise)
      .join(ExerciseSkill, ExerciseSkill.exercise_id == Exercise.id)
      .where(
          or_(
              ExerciseSkill.skill_id.in_(target_skill_ids),
              ExerciseSkill.subskill_id.in_(target_skill_ids),
          )
      )
  )
  ```
- **Database Migration Required:** No migration required.

---

#### Finding F-13: Content authoring UI lacks task type and canonical multi-tagging selectors
- **Exact File / Table:**  
  - Files:  
    - [`apps/web/src/features/admin/assessments/pages/AssessmentEditorPage.tsx`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/web/src/features/admin/assessments/pages/AssessmentEditorPage.tsx)  
    - [`apps/web/src/features/admin/exercises/pages/ExercisesListPage.tsx`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/web/src/features/admin/exercises/pages/ExercisesListPage.tsx)
- **Current Behavior:**  
  While the backend API and database schemas now fully support `task_type_id`, `role`, `weight`, and `subskill_id`, the frontend question and exercise authoring forms have not added input fields for them. Questions are authored without `task_type_id`, and skills can only be selected as flat IDs.
- **Why It Matters:**  
  Content creators cannot take advantage of Taxonomy V2 capabilities through the web application. New questions created via the UI lack task metadata and reasoning vs. language multi-tagging, requiring database scripts for content ingestion.
- **Recommended Correction:**  
  Update `AssessmentEditorPage` and `ExerciseModal` to include:
  1. A dropdown for selecting official `TaskType` filtered by section modality.
  2. An interactive skill tagging table allowing selection of Reasoning (Primary/Secondary with weights) and Language (Primary/Secondary with weights) competencies.
- **Database Migration Required:** No migration required.

---

#### Finding F-14: Learning mistake tracking continues to accept legacy unindexed string subskills
- **Exact File / Table:**  
  - File: [`apps/api/app/modules/learning/service.py:113-145, 812-825`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/app/modules/learning/service.py#L113-L145)  
  - Affected Tables: `mistakes`
- **Current Behavior:**  
  The `record_mistake` service helpers accept `subskill: str | None = None` and store raw strings in `mistakes.subskill` even when `subskill_id` is available.
- **Why It Matters:**  
  String subskills cannot be reliably joined with `SkillLevelDescriptor`, cannot be localized, and suffer from casing/spelling inconsistencies.
- **Recommended Correction:**  
  Make `subskill_id` the canonical attribute for mistake tracking. Populate `subskill` string only as a read-only computed backward-compatibility field derived from `skill.name`.
- **Database Migration Required:** No migration required.

---

### [P3] Optimizations & UX Enhancements

#### Finding F-15: Deprecated admin routes and client methods remain active
- **Exact File / Table:**  
  - Files:  
    - [`apps/api/app/modules/admin/router.py:150-185`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/app/modules/admin/router.py#L150-L185)  
    - [`apps/web/src/features/admin/api.ts:25-45`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/web/src/features/admin/api.ts#L25-L45)
- **Current Behavior:**  
  Endpoints `/api/v1/admin/content/skills` and `/api/v1/admin/content/subskills` remain exposed alongside canonical `/api/v1/admin/taxonomy/*` endpoints.
- **Why It Matters:**  
  Maintaining parallel legacy endpoints invites accidental usage by developers, bypasses taxonomy versioning and validation engines, and increases maintenance overhead.
- **Recommended Correction:**  
  Mark legacy routes with `deprecated=True` in OpenAPI metadata and schedule their removal in the next minor release.
- **Database Migration Required:** No migration required.

---

#### Finding F-16: Readiness dashboard lacks cognitive vs. linguistic dimensional visualization
- **Exact File / Table:**  
  - File: [`apps/web/src/features/readiness/components/SkillRadar.tsx`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/web/src/features/readiness/components/SkillRadar.tsx)
- **Current Behavior:**  
  The readiness dashboard renders competencies in a single flat list or radar chart, without categorizing them into Cognitive Reasoning and Transversal Language dimensions or showing applicable CEFR Can-Do descriptors.
- **Why It Matters:**  
  Students cannot clearly distinguish whether their reading score is suppressed by text structure and inference difficulties (cognitive reasoning) or lexical and grammatical gaps (language enablers).
- **Recommended Correction:**  
  Update `SkillRadar` and readiness summary cards to partition competencies by `SkillDimension` (`REASONING` vs. `LANGUAGE`) and display the active `SkillLevelDescriptor` text corresponding to the student's estimated CEFR level.
- **Database Migration Required:** No migration required.

---

#### Finding F-17: Missing composite indexes on high-volume junction tables
- **Exact File / Table:**  
  - Files:  
    - [`apps/api/app/modules/assessments/models.py:450-485`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/app/modules/assessments/models.py#L450-L485) (`question_skill_tags`)  
    - [`apps/api/app/modules/learning/models.py:340-375`](file:///c:/Users/MSI/Documents/GitHub/tef-platform/apps/api/app/modules/learning/models.py#L340-L375) (`exercise_skills`)
- **Current Behavior:**  
  `question_skill_tags` has individual indexes on `question_id`, `skill_id`, and `subskill_id`. However, frequent analytical and scoring queries filter specifically by `(skill_id, role)`.
- **Why It Matters:**  
  As assessment volume grows to millions of item submissions, queries filtering for primary tags or grouping by role execute bitmap index scans instead of rapid composite index-only scans.
- **Recommended Correction:**  
  Add composite index:
  `Index("ix_question_skill_tags_skill_role", "skill_id", "role")`  
  `Index("ix_exercise_skills_skill_role", "skill_id", "role")`
- **Database Migration Required:** Yes (Alembic migration to add indexes).

---

## 4. Comprehensive Integrity Matrix (The 17 Check Categories)

| # | Check Category | Status | Primary Audit Finding Reference |
|---|---|---|---|
| **1** | Duplicate taxonomy sources | **FAIL** | **F-03** (5 divergent seed scripts in CLI, content studio, assessments, learning, demo) |
| **2** | String-based skill references | **FAIL** | **F-07**, **F-11**, **F-14** (Mistake recording, scoring engine subskills, writing regex) |
| **3** | Broken / Inconsistent foreign keys | **FAIL** | **F-01**, **F-10** (Orphan `sub_skills` table, missing cascade/restrict checks on delete) |
| **4** | Stale seed files | **FAIL** | **F-03** (`seed_content_studio.py`, `seed_demo.py`, `assessments/seed.py`) |
| **5** | Hard-coded skill assumptions | **FAIL** | **F-05**, **F-06** (CEFR cutoffs differ: 60% vs 65% for B2; speaking selects 3 random skills) |
| **6** | Old API paths bypassing taxonomy | **FAIL** | **F-15** (`/admin/content/skills` & `/admin/content/subskills` bypass versioning) |
| **7** | Category calculations bypassing metadata | **FAIL** | **F-09** (`readiness_engine.py` aggregates by legacy 1D `SkillCategory` enum) |
| **8** | Recommendation bypassing evidence | **FAIL** | **F-12** (`recommendations_v2.py` misses exercises tagged by `subskill_id`) |
| **9** | Writing/Speaking incompatible models | **FAIL** | **F-06**, **F-07** (Speaking uses flat category; writing uses string match heuristics) |
| **10** | UI single-level depth assumption | **FAIL** | **F-08** (`SkillsNavigator.tsx` hardcodes `hasChildren={false}` for child nodes) |
| **11** | Dangerous hard deletes | **FAIL** | **F-01** (`SubSkillService.delete_subskill` hard deletes shadow skills) |
| **12** | Historical evidence invalidation | **FAIL** | **F-04** (`recalculate_student_skills` scans unconstrained across all skills) |
| **13** | Orphan skills | **FAIL** | **F-10** (`sub_skills` rows and test fixture skills without `taxonomy_version_id`) |
| **14** | Duplicate skills | **FAIL** | **F-03** (`reading_comp` vs `reading_comprehension` vs `reasoning_reading_root`) |
| **15** | Inconsistent skill codes | **FAIL** | **F-03** (`READ_FAITS` vs `reading_factual_info` vs `reasoning_locate_information`) |
| **16** | Missing indexes | **WARN** | **F-17** (Missing composite `(skill_id, role)` indexes on junctions) |
| **17** | N+1 taxonomy queries | **FAIL** | **F-02** (`batch_get_skill_usage` ignores `subskill_id`, returning zero counts) |

---

## 5. Architectural Remediation Roadmap

To transition Taxonomy V2 to fully operational status without service disruption or data loss, execution should follow three distinct phases:

### Phase 1: Data Integrity & Critical Service Fixes (Immediate)
1. **Fix Usage Aggregation (`F-02`):** Update `batch_get_skill_usage` in `taxonomy_service.py` to aggregate over both `skill_id` and `subskill_id`.
2. **Prevent Dangerous Deletion (`F-01`):** Disable hard deletes in `SubSkillService.delete_subskill`; enforce soft-delete / archival checks across `student_skills` and `skill_evidences`.
3. **Harmonize CEFR Cutoffs (`F-05`):** Unify percentage cutoffs between `ScoringEngine` and `LevelEstimationService` in `app/core/constants.py`.
4. **Scope Readiness Calculations (`F-04`):** Constrain `ReadinessEngine` recalculation queries to `is_active=True` and active `taxonomy_version_id`.
5. **Support Multi-Level UI Navigation (`F-08`):** Update `SkillsNavigator.tsx` to recursively render child nodes.

### Phase 2: Seed Pipeline Unification & Data Cleanup (Short-Term)
1. **Consolidate Seed Scripts (`F-03`):** Make `reading_taxonomy_data.py` (and upcoming listening/writing/speaking modules) the sole authority. Deprecate legacy codes in `seed_content_studio.py` and `seed_demo.py`.
2. **Database Cleanup Script (`F-03`, `F-10`):** Implement an Alembic data migration to remap legacy skill IDs to canonical V2 IDs in `question_skill_tags`, `exercise_skills`, and `mistakes`.
3. **Deprecate `sub_skills` Table (`F-10`):** Create an Alembic migration to drop the redundant `sub_skills` table.

### Phase 3: Engine Alignment & Content Studio Integration (Medium-Term)
1. **Align Speaking and Writing Engines (`F-06`, `F-07`):** Bind oral tasks and writing prompts to canonical task types and competencies.
2. **Expose Tagging in Admin UI (`F-13`):** Provide full multi-dimensional tagging interfaces in `AssessmentEditorPage` and `ExercisesListPage`.
3. **Add Composite Indexes (`F-17`):** Create migration for composite index `(skill_id, role)` on junction tables.

---

## 6. Audit Verdict

Taxonomy V2 implementation status: **NEEDS FIXES**
