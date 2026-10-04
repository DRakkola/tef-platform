# TEF Taxonomy V2 — Versioning, Immutability & Historical Integrity Policy

## 1. Overview & Architectural Principles

The TEF Platform uses a formal competency-based architecture across all exam modalities:
- **Compréhension Écrite (Reading)**
- **Compréhension Orale (Listening)**
- **Expression Écrite (Writing)**
- **Expression Orale (Speaking)**

This policy establishes immutable taxonomy identity, historical evidence integrity, and explicit skill evolution rules (replacements, splits, merges) to prevent historical data corruption or silent competency shifts.

---

## 2. Core Immutability Principles

### 2.1 Immutable Skill Identity
1. **Primary Key Stability**: Every competency has an immutable UUID primary key (`skills.id`).
2. **Version-Scoped Identifiers**: A skill `code` (e.g., `lang_vocab_in_context`) is unique within a given taxonomy version:
   $$\text{UNIQUE}(\text{taxonomy\_version\_id}, \text{code})$$
   Different releases of the taxonomy (e.g., `1.0.0` vs `2.0.0`) may define the same code with refined definitions, level descriptors, or subskills without collision.
3. **Renames and Edits**:
   - Minor typos or descriptive clarifications in an active draft do not alter identity.
   - Conceptual changes (broadening or narrowing scope) in a published taxonomy require creating a **new skill** or a **new taxonomy release** with an explicit evolution edge.

### 2.2 Historical Evidence Immutability
1. **Never Reinterpret Raw Evidence**: Historical `SkillEvidence` records represent real-world student performances evaluated at a specific point in time under a specific competency definition.
2. **Zero In-Place Rewriting**:
   - `SkillEvidence` rows are **append-only**.
   - Replacing or archiving a skill **never** re-points historical `SkillEvidence.skill_id` to a newer skill.
3. **Snapshot Metadata & Version Tracking**:
   Each `SkillEvidence` row records:
   - `taxonomy_version_id`: The taxonomy release active when the observation occurred.
   - `metadata_payload`: Contains point-in-time snapshots:
     ```json
     {
       "skill_code": "lang_vocab_in_context",
       "skill_name": "Vocabulaire en contexte",
       "skill_dimension": "language",
       "skill_domain": "reading",
       "taxonomy_version_id": "...",
       "role": "primary",
       "points_possible": 1.0
     }
     ```
   This guarantees that historical performance can always be reconstructed even if the skill is later archived, split, or replaced.

---

## 3. Skill Evolution & Replacement Relationships

When competencies evolve across taxonomy versions, changes must be explicitly modeled in the learning graph via `SkillRelation` and tracked in `TaxonomyMigrationRecord`.

### 3.1 Migration Relation Types
- **`REPLACED_BY`**: A 1-to-1 replacement where a legacy or older skill is superseded by a modern canonical skill.
  $$\text{OldSkill} \xrightarrow{\text{REPLACED\_BY}} \text{NewSkill}$$
- **`SPLIT_INTO`**: A 1-to-many decomposition where an overly broad competency is divided into finer-grained competencies.
  $$\text{OldSkill} \xrightarrow{\text{SPLIT\_INTO}} \{\text{Skill}_A, \text{Skill}_B\}$$
- **`MERGED_INTO`**: A many-to-1 consolidation where multiple overlapping competencies are unified into a single competency.
  $$\{\text{Skill}_A, \text{Skill}_B\} \xrightarrow{\text{MERGED\_INTO}} \text{UnifiedSkill}$$
- **`DEPRECATED_BY`**: Explicit retirement of a competency without direct successor.

### 3.2 Dynamic Resolution (`resolve_active_successor`)
Services querying student competencies (e.g., recommendations or current mastery tracking) query active competencies. If a historical skill ID is encountered, the system traverses migration edges:
```python
active_skill = await TaxonomyService.resolve_active_successor(db, old_skill_id)
```
If `old_skill` was split, `resolve_active_successor` returns all active child competencies, allowing targeted diagnostics without losing historical lineage.

---

## 4. Accounting for Legacy Nodes (Zero Silent Orphaning)

To guarantee that no historical competency or string-based subskill is left unmanaged:
1. **Migration Registry (`taxonomy_migration_records`)**:
   Tracks every node from legacy tables (`skills`, `sub_skills`).
   Each record must reach one of three terminal statuses:
   - `MIGRATED`: Has an explicit `target_skill_id` in canonical `skills`.
   - `DEPRECATED`: Explicitly marked as archived/retired with documented reason.
   - `UNRESOLVED`: Flagged for administrative audit; blocks clean integrity status.
2. **Reconciliation Tooling**:
   `POST /api/v1/admin/taxonomy/reconcile-legacy-nodes` scans all unversioned skills and legacy `sub_skills`, generating migration records automatically.

---

## 5. Compatibility Policy Across Subsystems

| Subsystem | Compatibility Policy |
| :--- | :--- |
| **Questions (`QuestionSkillTag`)** | Active/published content must only reference `is_active=True` skills. Tags support both `skill_id` (primary container or leaf) and optional `subskill_id` (granular leaf). Validation blocks archived skills on publish. |
| **Exercises (`ExerciseSkill`)** | Tagged with `skill_id` (canonical competency) and optional `subskill_id`. Recommendation engine queries both `skill_id` and `subskill_id` (F-12) to match practice exercises. |
| **Evidence (`SkillEvidence`)** | Append-only. Records `taxonomy_version_id` and metadata snapshot. Never altered or retroactively migrated. |
| **Student Mastery (`StudentSkill`)** | Represents rolling mastery. When a skill is replaced or split, historical evidence remains on the old skill, while new assessments generate evidence on the active successor. |
| **Writing & Speaking Evaluators** | Evaluation dimensions map dynamically via `EvaluationSkillMapper` to canonical skills. No independent writing/speaking skill tables exist. |

---

## 6. Deprecation Policy for Legacy String Subskills

1. **Foreign Key Primacy**: All question and exercise tagging must use `skill_id` and `subskill_id` (UUID foreign keys pointing to `skills.id`).
2. **Legacy String Retention**: The string field `subskill` on `QuestionSkillTag` and `ExerciseSkill` is maintained in a read-only deprecated capacity for backwards compatibility until all legacy seed data has been migrated.
3. **Decommissioning**: String columns will be dropped only after:
   - Full migration of all content studio seeds to UUIDs.
   - `TaxonomyIntegrityChecker.run_integrity_check(db)` reports zero orphan references.

---

## 7. Automated Integrity Verification

Administrators can execute automated integrity audits at any time via:
`GET /api/v1/admin/taxonomy/integrity-check`

The audit verifies 7 key dimensions:
1. **Orphan Skills & Hierarchy Cycles**: Validates parent pointers and tree acyclicity.
2. **Orphan References**: Ensures all junctions (`QuestionSkillTag`, `ExerciseSkill`, `SkillEvidence`, `StudentSkill`, `SkillRelation`) reference existing skills.
3. **Duplicate Codes & Concepts**: Enforces `(taxonomy_version_id, code)` uniqueness and flags concept collisions.
4. **Archived Skills on Active Content**: Ensures published questions and exercises do not use archived skills.
5. **Invalid Taxonomy Relationships**: Detects self-relations, prerequisite cycles, and invalid cross-version links.
6. **Inactive Version References**: Flags published content referencing inactive/archived taxonomy versions.
7. **Unresolved Migrations**: Audits unmapped legacy nodes and unresolved migration records.
