#!/usr/bin/env python3
"""TEF Platform — Data Quality & Integrity Validation CLI.

Validates referential integrity, state machine validity, entitlement consistency,
and pedagogical data hygiene.
Exits with code 0 if data is intact; exits with code 1 if critical integrity defects are found.
"""

import argparse
import asyncio
import os
import sys
import uuid
from pathlib import Path
from typing import Any

# Ensure apps/api is on the python path
api_path = Path(__file__).resolve().parent.parent / "apps" / "api"
sys.path.insert(0, str(api_path))

from sqlalchemy import func, select, and_, or_
from app.core.database import async_session_factory
import app.modules.admin.models
import app.modules.admin.beta_models
from app.modules.assessments.models import Attempt, AttemptAnswer, AttemptStatus, Question
from app.modules.billing.models import Order, OrderStatus, UserEntitlementGrant, Product
from app.modules.learning.models import Recommendation, RecommendationStatus
from app.modules.learning.readiness_models import ReadinessSnapshot, SkillEvidence
from app.modules.teachers.models import TeacherBooking, BookingStatus
from app.modules.writing.models import WritingSubmission, WritingCorrection
from app.modules.writing.enums import WritingSubmissionStatus
from app.modules.users.models import User



async def run_integrity_audit(fix: bool = False, dry_run: bool = True) -> tuple[int, list[str]]:
    """Runs all deterministic database integrity vectors."""
    critical_defects: list[str] = []
    warnings: list[str] = []
    repaired_count = 0

    async with async_session_factory() as db:
        print("=" * 70)
        print("          TEF PLATFORM DATABASE INTEGRITY AUDIT CLI          ")
        print("=" * 70)

        # -------------------------------------------------------------
        # 1. Orphan Attempt Answers
        # -------------------------------------------------------------
        orphan_answers = (
            await db.execute(
                select(AttemptAnswer.id)
                .outerjoin(Attempt, AttemptAnswer.attempt_id == Attempt.id)
                .where(Attempt.id.is_(None))
            )
        ).scalars().all()

        if orphan_answers:
            msg = f"[CRITICAL] Found {len(orphan_answers)} orphaned AttemptAnswer records with no parent Attempt."
            critical_defects.append(msg)
            print(f"  FAILED: {msg}")
            if fix and not dry_run:
                # Delete orphans
                for ans_id in orphan_answers:
                    ans = await db.scalar(select(AttemptAnswer).where(AttemptAnswer.id == ans_id))
                    if ans:
                        await db.delete(ans)
                await db.commit()
                repaired_count += len(orphan_answers)
                print(f"  REPAIRED: Purged {len(orphan_answers)} orphaned answers.")
        else:
            print("  [PASS] Vector 1: Zero orphaned attempt answers.")

        # -------------------------------------------------------------
        # 2. Impossible State Transitions in Assessment Attempts
        # -------------------------------------------------------------
        corrupted_attempts = (
            await db.execute(
                select(Attempt.id)
                .where(
                    Attempt.status == AttemptStatus.SUBMITTED,
                    Attempt.submitted_at.is_(None),
                )
            )
        ).scalars().all()

        if corrupted_attempts:
            msg = f"[CRITICAL] Found {len(corrupted_attempts)} Attempts marked SUBMITTED without submitted_at timestamp."
            critical_defects.append(msg)
            print(f"  FAILED: {msg}")
        else:
            print("  [PASS] Vector 2: Attempt state machine consistency verified.")

        # -------------------------------------------------------------
        # 3. Writing Submissions Marked Corrected/Returned Without Corrections
        # -------------------------------------------------------------
        completed_unscored_writing = (
            await db.execute(
                select(WritingSubmission.id)
                .outerjoin(WritingCorrection, WritingCorrection.submission_id == WritingSubmission.id)
                .where(
                    WritingSubmission.status.in_([WritingSubmissionStatus.CORRECTED, WritingSubmissionStatus.RETURNED]),
                    WritingCorrection.id.is_(None),
                )
            )
        ).scalars().all()

        if completed_unscored_writing:
            msg = f"[CRITICAL] Found {len(completed_unscored_writing)} WritingSubmissions marked CORRECTED/RETURNED without attached WritingCorrection."
            critical_defects.append(msg)
            print(f"  FAILED: {msg}")
        else:
            print("  [PASS] Vector 3: Writing correction linkage verified.")

        # -------------------------------------------------------------
        # 4. Duplicate Active Recommendations for Same Entity
        # -------------------------------------------------------------
        dup_recs_stmt = (
            select(Recommendation.user_id, Recommendation.entity_id, func.count(Recommendation.id))
            .where(Recommendation.status == RecommendationStatus.ACTIVE)
            .group_by(Recommendation.user_id, Recommendation.entity_id)
            .having(func.count(Recommendation.id) > 1)
        )
        dup_recs = (await db.execute(dup_recs_stmt)).all()

        if dup_recs:
            msg = f"[WARNING] Found {len(dup_recs)} duplicate active recommendation groups for identical exercises."
            warnings.append(msg)
            print(f"  WARNING: {msg}")
            if fix and not dry_run:
                # Deduplicate: leave newest, dismiss older
                for uid, eid, _ in dup_recs:
                    active_items = (
                        await db.execute(
                            select(Recommendation)
                            .where(
                                Recommendation.user_id == uid,
                                Recommendation.entity_id == eid,
                                Recommendation.status == RecommendationStatus.ACTIVE,
                            )
                            .order_by(Recommendation.generated_at.desc())
                        )
                    ).scalars().all()
                    for stale in active_items[1:]:
                        stale.status = RecommendationStatus.DISMISSED
                await db.commit()
                repaired_count += len(dup_recs)
                print(f"  REPAIRED: De-duplicated {len(dup_recs)} redundant active recommendation clusters.")
        else:
            print("  [PASS] Vector 4: Zero duplicate active recommendations.")

        # -------------------------------------------------------------
        # 5. Invalid Readiness Snapshot Score Bounds
        # -------------------------------------------------------------
        corrupted_snapshots = (
            await db.execute(
                select(ReadinessSnapshot.id).where(
                    or_(
                        ReadinessSnapshot.overall_estimate < 0.0,
                        ReadinessSnapshot.overall_estimate > 100.0,
                        ReadinessSnapshot.confidence < 0.0,
                        ReadinessSnapshot.confidence > 1.0,
                    )
                )
            )
        ).scalars().all()

        if corrupted_snapshots:
            msg = f"[CRITICAL] Found {len(corrupted_snapshots)} ReadinessSnapshots with mathematically invalid score/confidence vectors."
            critical_defects.append(msg)
            print(f"  FAILED: {msg}")
        else:
            print("  [PASS] Vector 5: Readiness snapshot mathematical bounds verified.")

        # -------------------------------------------------------------
        # 6. Inconsistent Teacher Bookings (End <= Start)
        # -------------------------------------------------------------
        invalid_bookings = (
            await db.execute(
                select(TeacherBooking.id).where(
                    TeacherBooking.start_time >= TeacherBooking.end_time
                )
            )
        ).scalars().all()

        if invalid_bookings:
            msg = f"[CRITICAL] Found {len(invalid_bookings)} TeacherBookings with start_time >= end_time."
            critical_defects.append(msg)
            print(f"  FAILED: {msg}")
        else:
            print("  [PASS] Vector 6: Teacher booking temporal ordering verified.")

        # -------------------------------------------------------------
        # 7. Entitlement Grants with Orphaned Users
        # -------------------------------------------------------------
        orphan_entitlements = (
            await db.execute(
                select(UserEntitlementGrant.id)
                .outerjoin(User, UserEntitlementGrant.user_id == User.id)
                .where(
                    User.id.is_(None),
                )
            )
        ).scalars().all()

        if orphan_entitlements:
            msg = f"[CRITICAL] Found {len(orphan_entitlements)} UserEntitlementGrants referencing non-existent Users."
            critical_defects.append(msg)
            print(f"  FAILED: {msg}")
        else:
            print("  [PASS] Vector 7: User entitlement user references verified.")

        # -------------------------------------------------------------
        # 8. Skill Evidence Referential Integrity
        # -------------------------------------------------------------
        orphan_evidences = (
            await db.execute(
                select(SkillEvidence.id)
                .outerjoin(User, SkillEvidence.student_id == User.id)
                .where(User.id.is_(None))
            )
        ).scalars().all()

        if orphan_evidences:
            msg = f"[CRITICAL] Found {len(orphan_evidences)} SkillEvidence records with no linked Student User."
            critical_defects.append(msg)
            print(f"  FAILED: {msg}")
        else:
            print("  [PASS] Vector 8: Skill evidence student references verified.")

    print("=" * 70)
    if critical_defects:
        print(f"[FAIL] Audit completed with {len(critical_defects)} critical integrity defect(s).")
        return 1, critical_defects
    else:
        print(f"[SUCCESS] All 8 integrity vectors verified. 0 critical defects.")
        if warnings:
            print(f"[INFO] {len(warnings)} non-critical warning(s) identified.")
        return 0, []


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate TEF Platform database integrity.")
    parser.add_argument("--fix", action="store_true", help="Safely repair non-destructive anomalies.")
    parser.add_argument("--dry-run", action="store_true", default=True, help="Simulate audit without mutating data.")
    args = parser.parse_args()

    exit_code, defects = asyncio.run(run_integrity_audit(fix=args.fix, dry_run=args.dry_run))
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
