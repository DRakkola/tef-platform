"""Administrative Destructive Reset Script for TEF Question and Taxonomy Systems.

IMPORTANT SAFETY INVARIANTS:
1. Cannot run in production (ENVIRONMENT == "production" -> ABORT).
2. Requires explicit environment variable: TEF_ALLOW_DESTRUCTIVE_CONTENT_RESET=true.
3. Requires interactive confirmation unless --force / --yes is explicitly passed.
4. Executes within a single transaction in strict foreign-key dependency order.
5. Preserves 100% of Users, Auth, Media Assets, Bookings, Writing Submissions,
   Speaking Sessions, and Billing data.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
import uuid
from typing import Any

from sqlalchemy import inspect, text

# Add parent directory to path so app modules can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
from app.core.database import async_session_factory, engine


# Purge sequence strictly respecting FK dependencies
PURGE_ORDER: list[dict[str, Any]] = [
    # Level 1: Leaf / Dependent Junctions & Evidence
    {"table": "attempt_answers", "action": "delete"},
    {"table": "attempt_scores", "action": "delete"},
    {"table": "mistakes", "action": "delete"},
    {"table": "skill_evidences", "action": "delete"},
    {"table": "student_skills", "action": "delete"},
    {"table": "skill_assessments", "action": "delete"},
    {"table": "recommendations", "action": "delete"},
    {"table": "readiness_snapshots", "action": "delete"},
    {"table": "readiness_profiles", "action": "delete"},
    {"table": "writing_correction_skills", "action": "delete"},
    {"table": "writing_correction_items", "action": "nullify_skill"},
    {"table": "speaking_evaluation_skills", "action": "delete"},
    {"table": "exercise_attempts", "action": "delete"},
    {"table": "exercise_skills", "action": "delete"},
    {"table": "exercise_versions", "action": "delete"},
    {"table": "exercises", "action": "delete"},
    {"table": "assessment_section_questions", "action": "delete"},
    {"table": "question_options", "action": "delete"},
    {"table": "question_skill_tags", "action": "delete"},
    {"table": "question_validations", "action": "delete"},
    {"table": "question_provenance", "action": "delete"},
    {"table": "question_versions", "action": "delete"},
    {"table": "attempts", "action": "delete"},
    # Level 2: Question & Assessment Parents
    {"table": "questions", "action": "delete"},
    {"table": "stimuli", "action": "delete"},
    {"table": "assessment_sections", "action": "delete"},
    {"table": "assessment_versions", "action": "delete"},
    {"table": "assessments", "action": "delete"},
    # Level 3: Taxonomy Junctions & Descriptors
    {"table": "task_type_skills", "action": "delete"},
    {"table": "skill_modalities", "action": "delete"},
    {"table": "skill_aliases", "action": "delete"},
    {"table": "skill_relations", "action": "delete"},
    {"table": "skill_level_descriptors", "action": "delete"},
    {"table": "sub_skills", "action": "delete"},
    {"table": "taxonomy_migration_records", "action": "delete"},
    # Level 4: Self-referential Break & Root Entities
    {"table": "skills", "action": "nullify_parent"},
    {"table": "skills", "action": "delete"},
    {"table": "task_types", "action": "delete"},
    {"table": "taxonomy_versions", "action": "delete"},
]


def verify_safety_gates() -> None:
    """Enforce non-production and explicit confirmation environment gates."""
    env = getattr(settings, "ENVIRONMENT", "").lower()
    if env == "production":
        print("[FATAL] Reset script execution blocked. Cannot run destructive reset in 'production' environment.", file=sys.stderr)
        sys.exit(1)

    allow_reset_var = os.environ.get("TEF_ALLOW_DESTRUCTIVE_CONTENT_RESET", "").strip().lower()
    if allow_reset_var != "true":
        print(
            "[FATAL] Execution blocked. Required environment variable 'TEF_ALLOW_DESTRUCTIVE_CONTENT_RESET=true' is not set.\n"
            "To execute a reset in development or testing:\n"
            "  set TEF_ALLOW_DESTRUCTIVE_CONTENT_RESET=true (Windows)\n"
            "  export TEF_ALLOW_DESTRUCTIVE_CONTENT_RESET=true (Linux/Mac)",
            file=sys.stderr,
        )
        sys.exit(1)


async def execute_reset(force: bool = False) -> dict[str, int]:
    """Execute the full question and taxonomy reset in transaction."""
    verify_safety_gates()

    if not force:
        print("\n" + "=" * 70)
        print("WARNING: DESTRUCTIVE RESET OF QUESTION & TAXONOMY DOMAINS")
        print("=" * 70)
        print("This operation will permanently purge all Questions, Assessments,")
        print("Taxonomy Competencies, Task Types, and Student Question Evidence.")
        print("User accounts, media assets, billing, and bookings will NOT be deleted.")
        print("=" * 70)
        confirm = input("Type 'RESET-CONTENT-NOW' to confirm and proceed: ")
        if confirm != "RESET-CONTENT-NOW":
            print("Operation aborted by user.")
            sys.exit(0)

    print("\n[1/3] Connecting to database and verifying table schema...")
    stats: dict[str, int] = {}

    async with engine.begin() as conn:
        # Check which tables exist in database
        def get_existing_tables(sync_conn: Any) -> set[str]:
            insp = inspect(sync_conn)
            return set(insp.get_table_names())

        existing_tables = await conn.run_sync(get_existing_tables)

        print(f"[2/3] Executing dependency-ordered purge across {len(PURGE_ORDER)} steps...")

        for step in PURGE_ORDER:
            tbl = step["table"]
            action = step["action"]

            if tbl not in existing_tables:
                continue

            try:
                if action == "nullify_skill":
                    result = await conn.execute(text(f"UPDATE {tbl} SET skill_id = NULL WHERE skill_id IS NOT NULL"))
                    count = result.rowcount
                    stats[f"{tbl}_nullified"] = count
                    print(f"  [OK] Nullified skill_id references in {tbl}: {count} rows")

                elif action == "nullify_parent":
                    result = await conn.execute(text(f"UPDATE {tbl} SET parent_id = NULL WHERE parent_id IS NOT NULL"))
                    count = result.rowcount
                    stats[f"{tbl}_parent_break"] = count
                    print(f"  [OK] Broken self-referential parent_id cycles in {tbl}: {count} rows")

                elif action == "delete":
                    result = await conn.execute(text(f"DELETE FROM {tbl}"))
                    count = result.rowcount
                    stats[tbl] = count
                    print(f"  [OK] Purged {tbl}: {count} rows deleted")

            except Exception as e:
                print(f"  [FAIL] Error purging {tbl} (action: {action}): {e}", file=sys.stderr)
                raise

        # Log reset in audit_events if table exists
        if "audit_events" in existing_tables:
            audit_id = str(uuid.uuid4())
            await conn.execute(
                text(
                    "INSERT INTO audit_events (id, action, entity_type, payload, created_at) "
                    "VALUES (:id, :action, :entity_type, :payload, NOW())"
                ),
                {
                    "id": audit_id,
                    "action": "DESTRUCTIVE_CONTENT_RESET",
                    "entity_type": "system",
                    "payload": '{"description": "Question and Taxonomy System reset cleanly to Phase 0 baseline"}',
                },
            )
            print("  [OK] Recorded DESTRUCTIVE_CONTENT_RESET in audit_events table")

    print("[3/3] Transaction committed successfully. Question and Taxonomy domains are reset.")
    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Destructive reset of TEF Question and Taxonomy domains.")
    parser.add_argument("--yes", "--force", action="store_true", help="Bypass interactive confirmation prompt")
    args = parser.parse_args()

    asyncio.run(execute_reset(force=args.yes))


if __name__ == "__main__":
    main()
