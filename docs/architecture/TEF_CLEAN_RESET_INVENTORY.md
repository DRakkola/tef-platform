# TEF Platform — Clean Reset Inventory
## Question System & Taxonomy System Destructive Reset & Rebuild

**Date:** October 4, 2026  
**Status:** Canonical Reset Inventory (Phase 0)  
**Objective:** Define an exhaustive, safe, and deterministic blueprint to purge accumulated legacy question and taxonomy systems and establish a clean, unified V1 foundation.

---

## 1. Domain Scope & Separation Matrix

| Domain | Action | Rationale |
| :--- | :--- | :--- |
| **Questions & Items** | **PURGE & RESET** | Abandon legacy question fields, section coupling, string tags, and multi-schema versions. |
| **Taxonomy & Skills** | **PURGE & RESET** | Eliminate dual `Skill`/`SubSkill` tables, string subskill identifiers, and shadow records. Establish single canonical competency identity. |
| **Student Question Evidence** | **PURGE & RESET** | Starting fresh: purge question attempt answers, attempt scores, skill evidence, student skill mastery, mistakes, and recommendations. |
| **Users & Authentication** | **PRESERVE 100%** | All student, teacher, and admin accounts, hashed credentials, sessions, and roles remain intact. |
| **Teacher & Bookings** | **PRESERVE 100%** | Teacher profiles, availabilities, and booking transactions remain intact. |
| **Writing & Speaking Submissions** | **PRESERVE CORE** | Student essays and audio speaking sessions are preserved. Only obsolete skill junction rows (`writing_correction_skills`, `speaking_evaluation_skills`) are purged. |
| **Billing & Monetization** | **PRESERVE 100%** | Products, subscriptions, orders, payments, webhooks, and coupons are completely preserved. |
| **Media Assets & Storage** | **PRESERVE 100%** | MinIO metadata in `media_assets` and stored binary files remain intact. |
| **Infrastructure & Beta** | **PRESERVE 100%** | Beta cohorts, invitations, experiments, and analytics events remain intact. |

---

## 2. Table-by-Table Inventory

### 2.1 Tables to Delete / Purge (Full Reset)

These tables belong strictly to the deprecated Question and Taxonomy domains and will have all rows deleted (or schema dropped):

#### Assessment & Question Subsystem:
1. `attempt_answers` — Student item responses tied to old questions.
2. `attempt_scores` — Historical calculated scores for old attempts.
3. `attempts` — Student attempts on old assessments.
4. `assessment_section_questions` — Junction rows linking old sections to old questions.
5. `question_options` — Multiple choice options for old questions.
6. `question_skill_tags` — Competency tags on old questions.
7. `question_validations` — Quality and linting logs for old questions.
8. `question_provenance` — Author and AI provenance for old questions.
9. `question_versions` — Historical snapshots of old questions.
10. `questions` — Old question bank records.
11. `stimuli` — Old reading passages and audio stimulus records.
12. `assessment_sections` — Old assessment sections.
13. `assessment_versions` — Historical snapshots of old assessments.
14. `assessments` — Old assessment records.

#### Taxonomy Subsystem:
15. `sub_skills` — **Obsolete legacy table**. Shadow-synced table from migration 0009; completely removed.
16. `task_type_skills` — Junction linking old task types to old skills.
17. `skill_modalities` — Exam modality junction table.
18. `skill_aliases` — Machine alias resolution table for old skills.
19. `skill_relations` — Graph edges (prerequisites, related) between old skills.
20. `skill_level_descriptors` — CEFR level benchmark statements for old skills.
21. `taxonomy_migration_records` — Audit records tracking old legacy node reconciliation.
22. `skills` — Old competency catalog.
23. `task_types` — Old task type definitions.
24. `taxonomy_versions` — Old taxonomy release snapshots.

#### Student Learning & Diagnostic Subsystem (Derived from Old Content):
25. `student_skills` — Student estimated mastery derived from old skills.
26. `skill_assessments` — Historical logs of skill evaluations.
27. `skill_evidences` — Evidence observations linked to old `skills.id`.
28. `mistakes` — Logged student errors linked to old `skills.id` and old `questions.id`.
29. `recommendations` — AI and algorithmic recommendations referencing old skills.
30. `readiness_snapshots` — Historical readiness calculations on old skills.
31. `readiness_profiles` — Current readiness profiles calculated on old skills.
32. `exercise_attempts` — Student attempts on old exercises.
33. `exercise_skills` — Skill junction rows for old exercises.
34. `exercise_versions` — Historical snapshots of old exercises.
35. `exercises` — Old practice drills referencing old skills/categories.

---

### 2.2 Tables Requiring Selective Deletion (Junction Cleansing)

These platform tables contain critical user data that **must be preserved**, but contain foreign keys or child tables pointing to `skills.id`:

1. **`writing_corrections` & `writing_correction_skills`**:
   - `writing_correction_skills` references `skills.id` (`ondelete="CASCADE"`). **PURGE** all rows in `writing_correction_skills`.
   - `writing_correction_items` has `skill_id` column. **UPDATE** `writing_correction_items SET skill_id = NULL`.
   - Preserve `writing_tasks`, `writing_attempts`, `writing_submissions`, `writing_corrections`, and `writing_assignments`.
2. **`speaking_evaluations` & `speaking_evaluation_skills`**:
   - `speaking_evaluation_skills` references `skills.id` (`ondelete="CASCADE"`). **PURGE** all rows in `speaking_evaluation_skills`.
   - Preserve `speaking_sessions`, `speaking_session_participants`, `speaking_turns`, `speaking_evaluations`, and `speaking_exams`.
3. **`student_activity_events`**:
   - Preserve all general user events.
   - Selectively delete events where `entity_type IN ('question', 'assessment', 'exercise', 'skill')`.

---

### 2.3 Tables to Preserve (100% Untouched)

The following tables are entirely decoupled from the Question and Taxonomy domains and must **never** be dropped or truncated:

- **Users & Auth**: `users`, `user_profiles`, `refresh_tokens`, `password_resets`, `email_verifications`.
- **Media Storage**: `media_assets`.
- **Audit**: `audit_events` (admin audit history is preserved; reset will append a `SYSTEM_RESET` event).
- **Teacher & Booking**: `teacher_profiles`, `teacher_availabilities`, `teacher_bookings`.
- **Writing Submissions**: `writing_tasks`, `writing_attempts`, `writing_submissions`, `writing_draft_revisions`, `writing_assignments`, `writing_corrections`.
- **Speaking Sessions**: `speaking_sessions`, `speaking_session_participants`, `speaking_turns`, `speaking_evaluations`, `speaking_exams`, `speaking_exam_sections`, `speaking_examiner_configs`, `speaking_scenarios`.
- **Practice Pool**: `practice_sessions`, `practice_topics`, `practice_matches`.
- **Billing**: `products`, `orders`, `subscriptions`, `coupons`, `payments`, `payment_webhook_events`.
- **Infrastructure**: `beta_cohorts`, `beta_invitations`, `experiments`, `analytics_events`.

---

## 3. Foreign-Key Dependency Order (Strict Purge Sequence)

To guarantee that foreign-key constraints are never violated, all deletions must execute in this exact sequence within a single database transaction:

```
[Level 1: Leaf / Dependent Junctions & Evidence]
  1. attempt_answers
  2. attempt_scores
  3. mistakes
  4. skill_evidences
  5. student_skills
  6. skill_assessments
  7. recommendations
  8. readiness_snapshots
  9. readiness_profiles
  10. writing_correction_skills
  11. UPDATE writing_correction_items SET skill_id = NULL
  12. speaking_evaluation_skills
  13. exercise_attempts
  14. exercise_skills
  15. exercise_versions
  16. exercises
  17. assessment_section_questions
  18. question_options
  19. question_skill_tags
  20. question_validations
  21. question_provenance
  22. question_versions
  23. attempts

[Level 2: Parent Entities of Question Domain]
  24. questions
  25. stimuli
  26. assessment_sections
  27. assessment_versions
  28. assessments

[Level 3: Taxonomy Junctions & Descriptors]
  29. task_type_skills
  30. skill_modalities
  31. skill_aliases
  32. skill_relations
  33. skill_level_descriptors
  34. sub_skills
  35. taxonomy_migration_records

[Level 4: Self-referential Break & Root Entities]
  36. UPDATE skills SET parent_id = NULL
  37. skills
  38. task_types
  39. taxonomy_versions
```

---

## 4. Code Inventory: Files to Delete, Rewrite, or Clean

### 4.1 Code to Delete (Dead / Legacy Code)
- `apps/api/app/modules/admin/reading_taxonomy_data.py` — Hardcoded legacy skill trees and dict mappings.
- `apps/api/app/modules/admin/tagging_service.py` — Transitional tagging rules relying on outdated domain pairs.
- `SubSkill` class in `apps/api/app/modules/admin/models.py` — Obsolete shadow table model and insert-prevention listener.
- `SubSkillService` in `apps/api/app/modules/admin/service.py` — Legacy service syncing subskills.
- Legacy seed scripts:
  - `apps/api/seed_content_studio.py`
  - `apps/api/seed_demo.py`
  - `apps/api/app/modules/assessments/seed.py`
  - `apps/api/app/modules/learning/seed.py`
  - `apps/api/app/modules/writing/seed.py`
- Legacy test files with deprecated assertions:
  - `apps/api/tests/test_f03_taxonomy_unification.py`
  - `apps/web/src/features/admin/skills/components/DeleteSubskillDialog.tsx`

### 4.2 Code to Rewrite / Streamline
- **`apps/api/app/modules/assessments/models.py`**:
  - Remove deprecated `section_id` from `Question`.
  - Remove string `subskill` and redundant `subskill_id` from `QuestionSkillTag`.
  - Ensure `Question` links cleanly to `TaskType`, `Stimulus`, `QuestionOption`, and `QuestionSkillTag`.
- **`apps/api/app/modules/admin/models.py`**:
  - Remove `SubSkill` model.
  - Simplify `SkillRelation`, `SkillLevelDescriptor`, `TaskTypeSkill`.
- **`apps/api/app/modules/learning/models.py`**:
  - Remove string `subskill` and redundant `subskill_id` from `Mistake` and `ExerciseSkill`.
- **`apps/api/app/modules/assessments/scoring.py`**:
  - Eliminate string-based subskill tracking; track competency scores strictly by canonical UUID `skill_id`.
- **`apps/api/app/modules/assessments/question_validation.py`**:
  - Update validation engine to enforce clean V1 question contracts without legacy field fallbacks.
- **`apps/api/app/modules/admin/taxonomy_service.py`**:
  - Strip subskill dual-sync facades; focus purely on canonical `Skill` (with `parent_id`), `TaskType`, and `TaxonomyVersion`.
- **`apps/api/app/modules/admin/router.py`**:
  - Remove legacy `/subskills` CRUD endpoints.
- **`apps/api/app/cli/seed.py`**:
  - Single authoritative, deterministic seed command.

### 4.3 Frontend Files Affected
- `apps/web/src/features/admin/types.ts`: Remove `SubSkill` interface, remove deprecated `subskill` string properties.
- `apps/web/src/features/admin/api.ts`: Remove `createSubSkill`, `updateSubSkill`, `deleteSubSkill`.
- `apps/web/src/features/admin/skills/`:
  - Update `SkillsListPage.tsx` and `SkillHierarchyView.tsx` to handle unified competencies cleanly.
  - Delete `DeleteSubskillDialog.tsx`.
- `apps/web/src/features/admin/questions/SkillsTab.tsx`:
  - Clean up to support canonical multi-dimension skill tagging (Reasoning + Language) without subskill strings.

---

## 5. Environmental & Operational Safety Protocol

To eliminate the catastrophic risk of running destructive resets against production:

1. **Environment Gate**:
   - The reset script must explicitly inspect `settings.ENVIRONMENT`. If `ENVIRONMENT == "production"`, refuse execution immediately with exit code 1.
2. **Explicit Safety Variable**:
   - Execution requires the environment variable `TEF_ALLOW_DESTRUCTIVE_CONTENT_RESET=true`. If absent or not exactly `"true"`, refuse execution.
3. **Interactive Confirmation Guard**:
   - When run interactively, prompt for confirmation: `Type 'RESET-CONTENT-NOW' to confirm`.
4. **Transaction Atomicity**:
   - All purges must occur inside a single SQLAlchemy transaction (`async with db.begin():`). Any failure rolls back completely, leaving zero partially deleted states.
5. **Full Structured Audit Logging**:
   - An immutable audit log entry is written to `audit_events` with the count of deleted entities, executing actor, and timestamp.
