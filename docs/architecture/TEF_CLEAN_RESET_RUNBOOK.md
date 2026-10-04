# TEF Platform — Clean Reset Runbook

**Document:** `docs/architecture/TEF_CLEAN_RESET_RUNBOOK.md`  
**Target:** Question and Taxonomy Domains  
**Audience:** Platform Engineers, Database Administrators  

---

## 1. Prerequisites

Before executing the reset procedure:

1. **Verify Current Environment**:
   - The script **refuses to run** if `ENVIRONMENT=production`.
   - Permitted environments: `development`, `staging`, `testing`.
2. **Database Snapshot / Backup**:
   - Even in development or staging, always create a PostgreSQL backup before running destructive operations:
     ```bash
     pg_dump -U tef -d tef_platform -F c -b -v -f /backups/tef_pre_reset_$(date +%Y%m%d_%H%M%S).dump
     ```
3. **Terminate Active Workers**:
   - Ensure Celery background workers and active test runners are paused to avoid concurrent read/write locks during the transaction.

---

## 2. Safety Invariants & Environmental Protections

The reset script implements three mandatory safety gates:

1. **Environment Gate**:
   - Inspects `settings.ENVIRONMENT`. If equal to `"production"`, execution is immediately aborted with a fatal error.
2. **Explicit Safety Environment Variable**:
   - The script will not execute unless `TEF_ALLOW_DESTRUCTIVE_CONTENT_RESET=true` is present in the execution environment.
3. **Interactive Confirmation Guard**:
   - Unless explicitly run with `--yes` or `--force` (used in CI/CD pipeline automation), the operator must type `RESET-CONTENT-NOW`.
4. **Single Transaction Boundary**:
   - The entire purge executes inside an atomic database transaction (`async with engine.begin() as conn:`). If any foreign key violation occurs, the entire operation rolls back to the previous state.

---

## 3. Exact Execution Commands

### Windows (PowerShell)
```powershell
$env:TEF_ALLOW_DESTRUCTIVE_CONTENT_RESET="true"
cd apps\api
.\.venv\Scripts\python.exe scripts\reset_question_taxonomy.py --yes
```

### Linux / macOS / Docker
```bash
export TEF_ALLOW_DESTRUCTIVE_CONTENT_RESET="true"
python scripts/reset_question_taxonomy.py --yes
```

---

## 4. Expected Purged vs. Preserved Entities

### Purged Entities
- **Questions Bank**: `questions`, `question_options`, `question_skill_tags`, `question_versions`, `question_validations`, `question_provenance`, `stimuli`.
- **Assessments**: `assessments`, `assessment_sections`, `assessment_section_questions`, `assessment_versions`.
- **Attempts**: `attempts`, `attempt_answers`, `attempt_scores`.
- **Taxonomy**: `skills`, `sub_skills`, `task_types`, `task_type_skills`, `skill_modalities`, `skill_aliases`, `skill_relations`, `skill_level_descriptors`, `taxonomy_versions`, `taxonomy_migration_records`.
- **Student Derived Evidence**: `student_skills`, `skill_evidences`, `skill_assessments`, `mistakes`, `recommendations`, `readiness_snapshots`, `readiness_profiles`, `exercise_attempts`, `exercise_skills`, `exercise_versions`, `exercises`.

### Preserved Entities (100% Intact)
- `users`, `user_profiles`, `refresh_tokens`, `password_resets`, `email_verifications`.
- `media_assets` (audio, documents in MinIO).
- `teacher_profiles`, `teacher_availabilities`, `teacher_bookings`.
- `writing_tasks`, `writing_attempts`, `writing_submissions`, `writing_draft_revisions`, `writing_assignments`, `writing_corrections`.
- `speaking_sessions`, `speaking_session_participants`, `speaking_turns`, `speaking_evaluations`, `speaking_exams`, `speaking_scenarios`.
- `practice_sessions`, `practice_topics`, `practice_matches`.
- `products`, `orders`, `subscriptions`, `coupons`, `payments`, `payment_webhook_events`.
- `beta_cohorts`, `beta_invitations`, `experiments`, `analytics_events`, `audit_events`.

---

## 5. Post-Reset Verification

Run following verification queries in psql / client:

```sql
-- 1. Verify question bank is empty:
SELECT count(*) FROM questions;             -- Expected: 0
SELECT count(*) FROM question_versions;     -- Expected: 0

-- 2. Verify taxonomy is empty:
SELECT count(*) FROM skills;                -- Expected: 0
SELECT count(*) FROM task_types;            -- Expected: 0
SELECT count(*) FROM taxonomy_versions;     -- Expected: 0

-- 3. Verify user accounts are intact:
SELECT count(*) FROM users;                 -- Expected: > 0

-- 4. Verify media assets are intact:
SELECT count(*) FROM media_assets;          -- Expected: > 0
```

---

## 6. Recovery Strategy (Rollback)

If the reset needs to be reverted:
1. Stop the application server.
2. Restore the database dump taken prior to the reset:
   ```bash
   pg_restore -U tef -d tef_platform --clean --if-exists -v /backups/tef_pre_reset_*.dump
   ```
3. Restart the API application server.
