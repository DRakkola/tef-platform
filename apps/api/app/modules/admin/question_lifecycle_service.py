"""Canonical Question Lifecycle, Versioning, and Immutability Service.

Enforces:
1. Strict state machine:
     DRAFT -> IN_REVIEW -> APPROVED -> PUBLISHED -> ARCHIVED
                |
                v
             REJECTED -> DRAFT
2. Immutability of approved, published, and archived items.
3. Explicit version branching (create_draft_version for published questions).
4. Safe question forking with provenance attribution.
5. Automated validation gates at state transition boundaries.
6. Immutable audit logging for every lifecycle event.
"""

from __future__ import annotations

import datetime
import uuid

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import AppException
from app.modules.admin.enums import ContentAuditEventType, ContentStatus
from app.modules.admin.models import AuditEvent, QuestionVersion
from app.modules.admin.service import AuditService
from app.modules.assessments.models import (
    Question,
    QuestionOption,
    QuestionProvenance,
    QuestionSkillTag,
)
from app.modules.assessments.question_serializer import QuestionSerializer
from app.modules.assessments.question_validation import QuestionValidationEngine

logger = structlog.get_logger("tef-api.admin.question_lifecycle")


class QuestionLifecycleService:
    """Canonical service for managing Question state transitions, immutability, and version snapshots."""

    @classmethod
    async def get_question_with_relations(
        cls,
        db: AsyncSession,
        question_id: uuid.UUID,
    ) -> Question:
        """Fetch question with all relationships populated."""
        stmt = (
            select(Question)
            .where(Question.id == question_id)
            .options(
                selectinload(Question.options),
                selectinload(Question.skill_tags),
                selectinload(Question.stimulus),
                selectinload(Question.provenance),
                selectinload(Question.validations),
                selectinload(Question.versions),
            )
        )
        q = (await db.execute(stmt)).scalar_one_or_none()
        if not q:
            raise AppException(message="Question not found", code="NOT_FOUND", status_code=404)
        return q

    @classmethod
    async def submit_for_review(
        cls,
        db: AsyncSession,
        question_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
        comments: str | None = None,
    ) -> Question:
        """Submit a draft or rejected question for editorial review.

        Pre-conditions:
        - Current status must be 'draft' or 'rejected'.
        - Full automated validation must pass with zero BLOCKING errors.
        """
        q = await cls.get_question_with_relations(db, question_id)

        if q.status not in (ContentStatus.DRAFT.value, ContentStatus.REJECTED.value):
            raise AppException(
                message=f"Cannot submit question in '{q.status}' status for review. Expected 'draft' or 'rejected'.",
                code="LIFECYCLE_STATE_CONFLICT",
                status_code=409,
            )

        # 1. Run full validation and record audit trail
        val_result = await QuestionValidationEngine.validate_and_persist(
            db=db,
            question=q,
            actor_id=actor_id,
            check_duplication=True,
        )

        if val_result.blocking_error_count > 0:
            raise AppException(
                message="Question cannot be submitted for review due to blocking validation errors.",
                code="QUESTION_VALIDATION_FAILED",
                status_code=422,
                details={
                    "blocking_error_count": val_result.blocking_error_count,
                    "warning_count": val_result.warning_count,
                    "issues": val_result.to_payload(),
                },
            )

        old_status = q.status
        now = datetime.datetime.now(datetime.UTC)
        q.status = ContentStatus.IN_REVIEW.value
        q.updated_by_user_id = actor_id
        q.updated_at = now

        # Update provenance review notes if available
        if q.provenance and comments:
            q.provenance.review_notes = comments

        # 2. Audit log
        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=ContentAuditEventType.CONTENT_SUBMITTED_FOR_REVIEW.value,
            entity_type="question",
            entity_id=q.id,
            payload={
                "from_status": old_status,
                "to_status": q.status,
                "version": q.version,
                "comments": comments,
                "warning_count": val_result.warning_count,
            },
        )

        await db.flush()
        logger.info(
            "question.submitted_for_review",
            question_id=str(q.id),
            version=q.version,
            actor_id=str(actor_id) if actor_id else None,
        )
        return q

    @classmethod
    async def approve_question(
        cls,
        db: AsyncSession,
        question_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
        notes: str | None = None,
    ) -> Question:
        """Approve a question that is currently in editorial review.

        Pre-conditions:
        - Current status must be 'in_review'.
        - Question must satisfy all validation rules with zero blocking errors.
        """
        q = await cls.get_question_with_relations(db, question_id)

        if q.status != ContentStatus.IN_REVIEW.value:
            raise AppException(
                message=f"Cannot approve question in '{q.status}' status. Expected 'in_review'.",
                code="LIFECYCLE_STATE_CONFLICT",
                status_code=409,
            )

        # Integrity verification
        val_result = await QuestionValidationEngine.validate_question(
            db=db,
            question=q,
            check_duplication=False,
        )
        if val_result.blocking_error_count > 0:
            raise AppException(
                message="Question has blocking validation errors and cannot be approved.",
                code="QUESTION_VALIDATION_FAILED",
                status_code=422,
                details=val_result.to_payload(),
            )

        now = datetime.datetime.now(datetime.UTC)
        q.status = ContentStatus.APPROVED.value
        q.updated_by_user_id = actor_id
        q.updated_at = now

        if q.provenance:
            q.provenance.reviewed_by_user_id = actor_id
            q.provenance.reviewed_at = now
            if notes:
                q.provenance.review_notes = notes

        # Audit log
        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=ContentAuditEventType.CONTENT_APPROVED.value,
            entity_type="question",
            entity_id=q.id,
            payload={
                "from_status": ContentStatus.IN_REVIEW.value,
                "to_status": ContentStatus.APPROVED.value,
                "version": q.version,
                "notes": notes,
            },
        )

        await db.flush()
        logger.info(
            "question.approved",
            question_id=str(q.id),
            version=q.version,
            reviewer_id=str(actor_id) if actor_id else None,
        )
        return q

    @classmethod
    async def reject_question(
        cls,
        db: AsyncSession,
        question_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
        notes: str | None = None,
    ) -> Question:
        """Reject a question currently in review, moving it to 'rejected' status.

        Allows author to inspect reviewer feedback and transition back to draft for remediation.
        """
        q = await cls.get_question_with_relations(db, question_id)

        if q.status != ContentStatus.IN_REVIEW.value:
            raise AppException(
                message=f"Cannot reject question in '{q.status}' status. Expected 'in_review'.",
                code="LIFECYCLE_STATE_CONFLICT",
                status_code=409,
            )

        now = datetime.datetime.now(datetime.UTC)
        q.status = ContentStatus.REJECTED.value
        q.updated_by_user_id = actor_id
        q.updated_at = now

        if q.provenance:
            q.provenance.reviewed_by_user_id = actor_id
            q.provenance.reviewed_at = now
            if notes:
                q.provenance.review_notes = notes

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=ContentAuditEventType.CONTENT_REJECTED.value,
            entity_type="question",
            entity_id=q.id,
            payload={
                "from_status": ContentStatus.IN_REVIEW.value,
                "to_status": ContentStatus.REJECTED.value,
                "version": q.version,
                "notes": notes,
            },
        )

        await db.flush()
        logger.info(
            "question.rejected",
            question_id=str(q.id),
            version=q.version,
            reviewer_id=str(actor_id) if actor_id else None,
        )
        return q

    @classmethod
    async def revert_to_draft(
        cls,
        db: AsyncSession,
        question_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
        reason: str | None = None,
    ) -> Question:
        """Revert an in-review or rejected question back to draft status.

        Allowed from:
        - 'in_review' (author withdraws submission before review decision)
        - 'rejected' (author acknowledges review rejection and reopens for remediation)
        """
        q = await cls.get_question_with_relations(db, question_id)

        if q.status not in (ContentStatus.IN_REVIEW.value, ContentStatus.REJECTED.value):
            raise AppException(
                message=f"Cannot revert question in '{q.status}' status to draft. Expected 'in_review' or 'rejected'.",
                code="LIFECYCLE_STATE_CONFLICT",
                status_code=409,
            )

        old_status = q.status
        now = datetime.datetime.now(datetime.UTC)
        q.status = ContentStatus.DRAFT.value
        q.updated_by_user_id = actor_id
        q.updated_at = now

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=ContentAuditEventType.CONTENT_REVERTED.value,
            entity_type="question",
            entity_id=q.id,
            payload={
                "from_status": old_status,
                "to_status": ContentStatus.DRAFT.value,
                "version": q.version,
                "reason": reason,
            },
        )

        await db.flush()
        logger.info(
            "question.reverted_to_draft",
            question_id=str(q.id),
            version=q.version,
            from_status=old_status,
            actor_id=str(actor_id) if actor_id else None,
        )
        return q

    @classmethod
    async def publish_question(
        cls,
        db: AsyncSession,
        question_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
        changelog: str | None = None,
    ) -> Question:
        """Publish an approved question, freezing its immutable historical snapshot.

        Pre-conditions:
        - Current status must be 'approved'.
        - Final validation check must pass.
        - Creates a permanent immutable QuestionVersion row capturing full reproducible state.
        """
        q = await cls.get_question_with_relations(db, question_id)

        if q.status != ContentStatus.APPROVED.value:
            raise AppException(
                message=f"Cannot publish question in '{q.status}' status. Expected 'approved'.",
                code="LIFECYCLE_STATE_CONFLICT",
                status_code=409,
            )

        # Final safety verification
        val_result = await QuestionValidationEngine.validate_question(
            db=db,
            question=q,
            check_duplication=False,
        )
        if val_result.blocking_error_count > 0:
            raise AppException(
                message="Question has blocking validation errors and cannot be published.",
                code="QUESTION_VALIDATION_FAILED",
                status_code=422,
                details={
                    "blocking_error_count": val_result.blocking_error_count,
                    "warning_count": val_result.warning_count,
                    "issues": val_result.to_payload(),
                },
            )

        now = datetime.datetime.now(datetime.UTC)
        q.status = ContentStatus.PUBLISHED.value
        q.is_live_delivered = True
        q.updated_by_user_id = actor_id
        q.updated_at = now

        # Create/freeze snapshot in QuestionVersion
        snapshot = QuestionSerializer.to_frozen_snapshot(q, changelog=changelog)
        options_snap = [
            {
                "id": str(o.id),
                "content": o.content,
                "order_index": o.order_index,
                "is_correct": o.is_correct,
                "explanation": o.explanation,
                "misconception_type": o.misconception_type,
                "distractor_rationale": o.distractor_rationale,
            }
            for o in sorted(q.options, key=lambda o: o.order_index)
        ]
        q_type_str = q.question_type.value if hasattr(q.question_type, "value") else str(q.question_type)

        existing_ver = await db.scalar(
            select(QuestionVersion).where(
                QuestionVersion.question_id == q.id,
                QuestionVersion.version == q.version,
            )
        )
        if existing_ver:
            existing_ver.prompt = q.prompt
            existing_ver.explanation = q.explanation
            existing_ver.question_type = q_type_str
            existing_ver.difficulty = q.difficulty
            existing_ver.level = q.level
            existing_ver.points = q.points
            existing_ver.options_snapshot = options_snap
            existing_ver.snapshot_payload = snapshot
            existing_ver.changelog = changelog
        else:
            ver = QuestionVersion(
                question_id=q.id,
                version=q.version,
                prompt=q.prompt,
                explanation=q.explanation,
                question_type=q_type_str,
                difficulty=q.difficulty,
                level=q.level,
                points=q.points,
                options_snapshot=options_snap,
                snapshot_payload=snapshot,
                changelog=changelog,
                created_by_user_id=actor_id,
                created_at=now,
            )
            db.add(ver)

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=ContentAuditEventType.CONTENT_PUBLISHED.value,
            entity_type="question",
            entity_id=q.id,
            payload={
                "from_status": ContentStatus.APPROVED.value,
                "to_status": ContentStatus.PUBLISHED.value,
                "version": q.version,
                "changelog": changelog,
            },
        )

        await db.flush()
        logger.info(
            "question.published",
            question_id=str(q.id),
            version=q.version,
            publisher_id=str(actor_id) if actor_id else None,
        )
        return q

    @classmethod
    async def create_draft_version(
        cls,
        db: AsyncSession,
        question_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
        changelog: str | None = None,
    ) -> Question:
        """Create a new editable draft version for a question that has been published, approved, or archived.

        Guarantees that the prior version remains completely frozen in QuestionVersion,
        while incrementing the version counter and resetting status to 'draft'.
        """
        q = await cls.get_question_with_relations(db, question_id)

        if q.status not in (
            ContentStatus.PUBLISHED.value,
            ContentStatus.APPROVED.value,
            ContentStatus.ARCHIVED.value,
        ):
            raise AppException(
                message=(
                    f"Cannot create new draft version from question in '{q.status}' status. "
                    "Only published, approved, or archived questions can spawn a new draft version."
                ),
                code="LIFECYCLE_STATE_CONFLICT",
                status_code=409,
            )

        now = datetime.datetime.now(datetime.UTC)

        # 1. Ensure the prior version snapshot exists
        existing_ver = await db.scalar(
            select(QuestionVersion).where(
                QuestionVersion.question_id == q.id,
                QuestionVersion.version == q.version,
            )
        )
        if not existing_ver:
            snapshot = QuestionSerializer.to_frozen_snapshot(q, changelog=changelog or "Auto-frozen prior version")
            options_snap = [
                {
                    "id": str(o.id),
                    "content": o.content,
                    "order_index": o.order_index,
                    "is_correct": o.is_correct,
                    "explanation": o.explanation,
                    "misconception_type": o.misconception_type,
                    "distractor_rationale": o.distractor_rationale,
                }
                for o in sorted(q.options, key=lambda o: o.order_index)
            ]
            q_type_str = q.question_type.value if hasattr(q.question_type, "value") else str(q.question_type)
            ver = QuestionVersion(
                question_id=q.id,
                version=q.version,
                prompt=q.prompt,
                explanation=q.explanation,
                question_type=q_type_str,
                difficulty=q.difficulty,
                level=q.level,
                points=q.points,
                options_snapshot=options_snap,
                snapshot_payload=snapshot,
                changelog=changelog,
                created_by_user_id=actor_id,
                created_at=now,
            )
            db.add(ver)

        # 2. Advance to new draft version
        prev_version = q.version
        q.version += 1
        q.status = ContentStatus.DRAFT.value
        q.is_live_delivered = False
        q.updated_by_user_id = actor_id
        q.updated_at = now

        # 3. Log audit event
        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=ContentAuditEventType.CONTENT_DRAFT_VERSION_CREATED.value,
            entity_type="question",
            entity_id=q.id,
            payload={
                "previous_version": prev_version,
                "new_version": q.version,
                "changelog": changelog,
            },
        )

        await db.flush()
        logger.info(
            "question.draft_version_created",
            question_id=str(q.id),
            previous_version=prev_version,
            new_version=q.version,
        )
        return q

    @classmethod
    async def archive_question(
        cls,
        db: AsyncSession,
        question_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
        reason: str | None = None,
    ) -> Question:
        """Non-destructively archive a question.

        Archived questions:
        - Remain queryable for historical attempts and audits.
        - Are excluded from selection for new published assessments.
        - Retain all versions and provenance records intact.
        """
        q = await cls.get_question_with_relations(db, question_id)

        old_status = q.status
        now = datetime.datetime.now(datetime.UTC)
        q.status = ContentStatus.ARCHIVED.value
        q.updated_by_user_id = actor_id
        q.updated_at = now

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=ContentAuditEventType.CONTENT_ARCHIVED.value,
            entity_type="question",
            entity_id=q.id,
            payload={
                "from_status": old_status,
                "to_status": ContentStatus.ARCHIVED.value,
                "version": q.version,
                "reason": reason,
            },
        )

        await db.flush()
        logger.info(
            "question.archived",
            question_id=str(q.id),
            version=q.version,
            actor_id=str(actor_id) if actor_id else None,
        )
        return q

    @classmethod
    async def fork_question(
        cls,
        db: AsyncSession,
        question_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
        prompt_prefix: str | None = None,
        changelog: str | None = None,
    ) -> Question:
        """Fork an existing question into an independent new question entity.

        Invariants:
        - Source question and its versions are never mutated.
        - New Question receives a unique UUID, status='draft', version=1.
        - Options and canonical skill tags are cloned.
        - Provenance records explicit 'forked' linkage to source question ID and version.
        """
        source_q = await cls.get_question_with_relations(db, question_id)

        now = datetime.datetime.now(datetime.UTC)
        new_prompt = f"{prompt_prefix} {source_q.prompt}" if prompt_prefix else source_q.prompt

        new_q = Question(
            prompt=new_prompt,
            instructions=source_q.instructions,
            question_type=source_q.question_type,
            response_type=source_q.response_type,
            order_index=source_q.order_index,
            level=source_q.level,
            target_cefr=source_q.target_cefr,
            difficulty=source_q.difficulty,
            difficulty_rating=source_q.difficulty_rating,
            cognitive_complexity=source_q.cognitive_complexity,
            explanation=source_q.explanation,
            points=source_q.points,
            penalty_points=source_q.penalty_points,
            media_url=source_q.media_url,
            status=ContentStatus.DRAFT.value,
            version=1,
            is_live_delivered=False,
            item_hash=None,
            task_type_id=source_q.task_type_id,
            stimulus_id=source_q.stimulus_id,
            section_id=None,  # Decoupled
            scoring_payload=source_q.scoring_payload,
            created_by_user_id=actor_id,
            updated_by_user_id=actor_id,
            created_at=now,
            updated_at=now,
        )
        db.add(new_q)
        await db.flush()

        # Clone options
        for opt in sorted(source_q.options, key=lambda o: o.order_index):
            new_opt = QuestionOption(
                question_id=new_q.id,
                content=opt.content,
                order_index=opt.order_index,
                is_correct=opt.is_correct,
                explanation=opt.explanation,
                misconception_type=opt.misconception_type,
                distractor_rationale=opt.distractor_rationale,
                created_at=now,
                updated_at=now,
            )
            db.add(new_opt)

        # Clone skill tags
        for tag in source_q.skill_tags:
            new_tag = QuestionSkillTag(
                question_id=new_q.id,
                skill_id=tag.skill_id,
                subskill_id=tag.subskill_id,
                subskill=tag.subskill,
                role=tag.role,
                weight=tag.weight,
                context=tag.context,
                created_at=now,
                updated_at=now,
            )
            db.add(new_tag)

        # Provenance attribution
        tax_ver_id = source_q.provenance.taxonomy_version_id if source_q.provenance else None
        prov = QuestionProvenance(
            question_id=new_q.id,
            author_type="human",
            source_type="forked",
            source_reference=f"forked_from_question:{source_q.id}:v{source_q.version}",
            taxonomy_version_id=tax_ver_id,
            created_by_user_id=actor_id,
            created_at=now,
        )
        db.add(prov)

        # Audit event
        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=ContentAuditEventType.CONTENT_FORKED.value,
            entity_type="question",
            entity_id=new_q.id,
            payload={
                "forked_from_question_id": str(source_q.id),
                "forked_from_version": source_q.version,
                "changelog": changelog,
            },
        )

        await db.flush()
        logger.info(
            "question.forked",
            source_question_id=str(source_q.id),
            new_question_id=str(new_q.id),
            actor_id=str(actor_id) if actor_id else None,
        )

        return await cls.get_question_with_relations(db, new_q.id)

    @classmethod
    async def list_versions(
        cls,
        db: AsyncSession,
        question_id: uuid.UUID,
    ) -> list[QuestionVersion]:
        """List all frozen snapshots of a question ordered by version descending."""
        stmt = (
            select(QuestionVersion)
            .where(QuestionVersion.question_id == question_id)
            .order_by(QuestionVersion.version.desc())
        )
        return list((await db.execute(stmt)).scalars().all())

    @classmethod
    async def get_version(
        cls,
        db: AsyncSession,
        question_id: uuid.UUID,
        version_num: int,
    ) -> QuestionVersion:
        """Fetch a specific frozen historical version of a question."""
        stmt = select(QuestionVersion).where(
            QuestionVersion.question_id == question_id,
            QuestionVersion.version == version_num,
        )
        ver = (await db.execute(stmt)).scalar_one_or_none()
        if not ver:
            raise AppException(
                message=f"Version {version_num} of question {question_id} not found",
                code="VERSION_NOT_FOUND",
                status_code=404,
            )
        return ver

    @classmethod
    async def get_published_version(
        cls,
        db: AsyncSession,
        question_id: uuid.UUID,
    ) -> QuestionVersion:
        """Fetch the latest frozen version corresponding to live published delivery."""
        q = await cls.get_question_with_relations(db, question_id)
        stmt = (
            select(QuestionVersion)
            .where(QuestionVersion.question_id == question_id)
            .order_by(QuestionVersion.version.desc())
        )
        ver = (await db.execute(stmt)).scalars().first()
        # If question is published but no snapshot was saved yet, snapshot now
        if not ver and q.status == ContentStatus.PUBLISHED.value:
            await cls.publish_question(db, question_id, actor_id=q.updated_by_user_id)
            ver = (await db.execute(stmt)).scalars().first()

        if not ver:
            raise AppException(
                message=f"No frozen published version available for question {question_id}",
                code="VERSION_NOT_FOUND",
                status_code=404,
            )
        return ver

    @classmethod
    async def get_history(
        cls,
        db: AsyncSession,
        question_id: uuid.UUID,
    ) -> list[AuditEvent]:
        """Fetch audit event history for a question."""
        stmt = (
            select(AuditEvent)
            .where(
                AuditEvent.entity_type == "question",
                AuditEvent.entity_id == question_id,
            )
            .order_by(AuditEvent.created_at.desc())
        )
        return list((await db.execute(stmt)).scalars().all())
