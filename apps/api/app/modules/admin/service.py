"""Service layer for Admin Content Management, Media Assets, Versioning, and Audit Logging."""

import datetime
import os
import re
import uuid
from typing import Any, ClassVar

import structlog
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import AppException
from app.core.storage import StorageService
from app.modules.admin.enums import AuditAction, ContentStatus, MediaType, ReviewStatus
from app.modules.admin.models import (
    AssessmentVersion,
    AuditEvent,
    ContentReview,
    ExerciseVersion,
    MediaAsset,
    QuestionVersion,
    WritingTaskVersion,
)
from app.modules.admin.schemas import (
    AdminAssessmentCreate,
    AdminAssessmentUpdate,
    AdminExerciseCreate,
    AdminExerciseUpdate,
    AdminQuestionCreate,
    AdminSectionCreate,
    AdminSkillCreate,
    AdminSkillMetricsSummary,
    AdminSkillUpdate,
    AdminStandaloneQuestionCreate,
    AdminStandaloneQuestionUpdate,
    AdminStimulusCreate,
    AdminWritingTaskCreate,
    AdminWritingTaskUpdate,
    ContentReviewDecision,
    SkillUsageCounts,
    SubSkillCreate,
    SubSkillUpdate,
    ValidationIssue,
)
from app.modules.assessments.enums import QuestionType
from app.modules.assessments.models import (
    Assessment,
    AssessmentSection,
    Attempt,
    Question,
    QuestionOption,
    QuestionSkillTag,
    QuestionValidation,
    Skill,
    Stimulus,
)
from app.modules.learning.models import Exercise, ExerciseSkill
from app.modules.users.models import User, UserRole
from app.modules.writing.models import WritingTask

logger = structlog.get_logger("tef-api.admin.service")


class AuditService:
    """Service to record and query immutable security and operational audit logs."""

    @staticmethod
    async def log_event(
        db: AsyncSession,
        actor_user_id: uuid.UUID | None,
        action: AuditAction | str,
        entity_type: str,
        entity_id: uuid.UUID | None,
        payload: dict[str, Any] | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> AuditEvent:
        """Record an administrative or security-sensitive audit entry."""
        action_str = action.value if isinstance(action, AuditAction) else str(action)
        event = AuditEvent(
            actor_user_id=actor_user_id,
            action=action_str,
            entity_type=entity_type,
            entity_id=entity_id,
            payload=payload or {},
            ip_address=ip_address,
            user_agent=user_agent,
            created_at=datetime.datetime.now(datetime.UTC),
        )
        db.add(event)
        await db.flush()
        logger.info(
            "audit_event_recorded",
            action=action_str,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id else None,
            actor_id=str(actor_user_id) if actor_user_id else None,
        )
        return event

    @staticmethod
    async def list_logs(
        db: AsyncSession,
        action: str | None = None,
        entity_type: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[AuditEvent], int]:
        """Query audit log entries with pagination."""
        stmt = select(AuditEvent).order_by(AuditEvent.created_at.desc())
        if action:
            stmt = stmt.where(AuditEvent.action == action)
        if entity_type:
            stmt = stmt.where(AuditEvent.entity_type == entity_type)

        count_stmt = select(func.count(AuditEvent.id))
        if action:
            count_stmt = count_stmt.where(AuditEvent.action == action)
        if entity_type:
            count_stmt = count_stmt.where(AuditEvent.entity_type == entity_type)

        total = (await db.execute(count_stmt)).scalar() or 0
        paged_stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        items = list((await db.execute(paged_stmt)).scalars().all())
        return items, total


class MediaAssetService:
    """Service managing MinIO media uploads and presigned access for exam content."""

    ALLOWED_AUDIO_MIMES: ClassVar[set[str]] = {
        "audio/mpeg",
        "audio/mp3",
        "audio/wav",
        "audio/ogg",
        "audio/mp4",
        "audio/x-m4a",
        "audio/aac",
    }
    ALLOWED_IMAGE_MIMES: ClassVar[set[str]] = {
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
    }
    MAX_AUDIO_SIZE = 50 * 1024 * 1024  # 50 MB
    MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB

    @classmethod
    async def upload_asset(
        cls,
        db: AsyncSession,
        title: str,
        media_type: MediaType,
        file_bytes: bytes,
        filename: str,
        content_type: str,
        uploader_id: uuid.UUID | None,
        storage: StorageService,
    ) -> MediaAsset:
        """Validate, save media to MinIO, and register metadata record."""
        # Sanitize filename against path traversal
        raw_basename = os.path.basename(filename)
        clean_name = re.sub(r"[^a-zA-Z0-9._-]", "_", raw_basename)[:100]
        if not clean_name:
            clean_name = "media_asset"

        # Validate MIME type and size
        if media_type == MediaType.AUDIO:
            if content_type not in cls.ALLOWED_AUDIO_MIMES:
                raise AppException(
                    message=f"Unsupported audio type: {content_type}. Allowed: {cls.ALLOWED_AUDIO_MIMES}",
                    code="INVALID_MIME_TYPE",
                    status_code=400,
                )
            if len(file_bytes) > cls.MAX_AUDIO_SIZE:
                raise AppException(
                    message=f"Audio file exceeds 50MB limit: {len(file_bytes)} bytes",
                    code="FILE_TOO_LARGE",
                    status_code=400,
                )
        elif media_type == MediaType.IMAGE:
            if content_type not in cls.ALLOWED_IMAGE_MIMES:
                raise AppException(
                    message=f"Unsupported image type: {content_type}. Allowed: {cls.ALLOWED_IMAGE_MIMES}",
                    code="INVALID_MIME_TYPE",
                    status_code=400,
                )
            if len(file_bytes) > cls.MAX_IMAGE_SIZE:
                raise AppException(
                    message=f"Image file exceeds 10MB limit: {len(file_bytes)} bytes",
                    code="FILE_TOO_LARGE",
                    status_code=400,
                )

        # Upload private object to MinIO via storage service
        import io
        file_ext = os.path.splitext(clean_name)[1]
        object_key = storage.upload_file(
            file_obj=io.BytesIO(file_bytes),
            content_type=content_type,
            folder="media",
            file_extension=file_ext,
        )

        now = datetime.datetime.now(datetime.UTC)
        asset = MediaAsset(
            title=title,
            filename=clean_name,
            content_type=content_type,
            file_size=len(file_bytes),
            storage_object_key=object_key,
            bucket="tef-private",
            media_type=media_type,
            is_public=False,
            uploaded_by_user_id=uploader_id,
            created_at=now,
            updated_at=now,
        )
        db.add(asset)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=uploader_id,
            action=AuditAction.CREATE,
            entity_type="media_asset",
            entity_id=asset.id,
            payload={"filename": asset.filename, "size": asset.file_size, "content_type": asset.content_type},
        )
        return asset

    @staticmethod
    async def get_presigned_download_url(
        db: AsyncSession,
        asset_id: uuid.UUID,
        storage: StorageService,
        expires_in_seconds: int = 3600,
    ) -> str:
        """Generate short-lived presigned download URL for private asset."""
        stmt = select(MediaAsset).where(MediaAsset.id == asset_id)
        asset = (await db.execute(stmt)).scalar_one_or_none()
        if not asset:
            raise AppException(
                message="Media asset not found",
                code="ASSET_NOT_FOUND",
                status_code=404,
            )

        url = storage.generate_presigned_url(
            object_key=asset.storage_object_key,
            expiration_seconds=expires_in_seconds,
        )
        return url

    @staticmethod
    async def list_assets(
        db: AsyncSession,
        media_type: MediaType | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[MediaAsset], int]:
        """List media assets."""
        stmt = select(MediaAsset).order_by(MediaAsset.created_at.desc())
        if media_type:
            stmt = stmt.where(MediaAsset.media_type == media_type)

        count_stmt = select(func.count(MediaAsset.id))
        if media_type:
            count_stmt = count_stmt.where(MediaAsset.media_type == media_type)

        total = (await db.execute(count_stmt)).scalar() or 0
        paged = stmt.offset((page - 1) * page_size).limit(page_size)
        items = list((await db.execute(paged)).scalars().all())
        return items, total

    @staticmethod
    async def delete_asset(
        db: AsyncSession,
        asset_id: uuid.UUID,
        storage: StorageService,
        actor_id: uuid.UUID | None = None,
    ) -> None:
        """Delete media asset from MinIO and remove record."""
        stmt = select(MediaAsset).where(MediaAsset.id == asset_id)
        asset = (await db.execute(stmt)).scalar_one_or_none()
        if not asset:
            raise AppException(message="Media asset not found", code="NOT_FOUND", status_code=404)

        try:
            storage.delete_file(asset.storage_object_key)
        except Exception as e:  # noqa: BLE001
            logger.warning("failed_to_delete_storage_object", key=asset.storage_object_key, error=str(e))

        await db.delete(asset)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.DELETE,
            entity_type="media_asset",
            entity_id=asset_id,
            payload={"filename": asset.filename},
        )


class SubSkillService:
    """Compatibility service for subskills, delegating directly to canonical Skill hierarchy."""

    @staticmethod
    async def create_subskill(
        db: AsyncSession,
        skill_id: uuid.UUID,
        payload: SubSkillCreate,
        actor_id: uuid.UUID | None = None,
    ) -> Skill:
        """Create a child competency under a parent skill directly in canonical skills table."""
        skill = await db.get(Skill, skill_id)
        if not skill:
            raise AppException(message="Parent skill not found", code="SKILL_NOT_FOUND", status_code=404)

        # Check unique code across canonical skills
        existing = await db.scalar(select(Skill).where(Skill.code == payload.code.strip()))
        if existing:
            raise AppException(message=f"Subskill with code '{payload.code}' already exists", code="DUPLICATE_CODE", status_code=409)

        now = datetime.datetime.now(datetime.UTC)
        sub_skill = Skill(
            id=uuid.uuid4(),
            code=payload.code.strip(),
            name=payload.name.strip(),
            dimension=skill.dimension,
            domain=skill.domain,
            taxonomy_version_id=skill.taxonomy_version_id,
            category=skill.category,
            description=payload.description.strip() if payload.description else None,
            parent_id=skill.id,
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        db.add(sub_skill)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.CREATE,
            entity_type="subskill",
            entity_id=sub_skill.id,
            payload={"skill_id": str(skill_id), "code": sub_skill.code, "name": sub_skill.name},
        )
        return sub_skill

    @staticmethod
    async def list_subskills(db: AsyncSession, skill_id: uuid.UUID) -> list[Skill]:
        """List active child competencies for a skill from canonical hierarchy."""
        stmt = (
            select(Skill)
            .where(Skill.parent_id == skill_id, Skill.is_active.is_(True))
            .order_by(Skill.name.asc())
        )
        return list((await db.execute(stmt)).scalars().all())

    @staticmethod
    async def update_subskill(
        db: AsyncSession,
        subskill_id: uuid.UUID,
        payload: SubSkillUpdate,
        actor_id: uuid.UUID | None = None,
    ) -> Skill:
        """Update child competency in canonical hierarchy."""
        sub_skill = await db.get(Skill, subskill_id)
        if not sub_skill:
            raise AppException(message="Subskill not found", code="NOT_FOUND", status_code=404)

        if payload.code is not None and payload.code.strip() != sub_skill.code:
            new_code = payload.code.strip()
            existing = await db.scalar(select(Skill).where(Skill.code == new_code))
            if existing and existing.id != subskill_id:
                raise AppException(message=f"Subskill code '{payload.code}' in use", code="DUPLICATE_CODE", status_code=409)
            sub_skill.code = new_code

        if payload.name is not None:
            sub_skill.name = payload.name.strip()
        if payload.description is not None:
            sub_skill.description = payload.description.strip() if payload.description else None

        sub_skill.updated_at = datetime.datetime.now(datetime.UTC)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.UPDATE,
            entity_type="subskill",
            entity_id=sub_skill.id,
            payload={"code": sub_skill.code, "name": sub_skill.name},
        )
        return sub_skill

    @staticmethod
    async def archive_subskill(
        db: AsyncSession,
        subskill_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
    ) -> Skill:
        """Safely soft-archive a child competency in canonical hierarchy."""
        sub_skill = await db.get(Skill, subskill_id)
        if not sub_skill:
            raise AppException(message="Subskill not found", code="NOT_FOUND", status_code=404)

        sub_skill.is_active = False
        sub_skill.updated_at = datetime.datetime.now(datetime.UTC)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.ARCHIVE,
            entity_type="subskill",
            entity_id=subskill_id,
            payload={"code": sub_skill.code, "is_active": False},
        )
        return sub_skill

    @staticmethod
    async def delete_subskill(
        db: AsyncSession,
        subskill_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
    ) -> None:
        """Safely delete or soft-archive subskill checking relational dependencies."""
        sub_skill = await db.get(Skill, subskill_id)
        if not sub_skill:
            raise AppException(message="Subskill not found", code="NOT_FOUND", status_code=404)

        target_name = sub_skill.name
        target_code = sub_skill.code

        from app.modules.admin.taxonomy_service import TaxonomyService

        usage_map = await TaxonomyService.batch_get_skill_usage(db, [subskill_id])
        total_deps = sum(u.total_dependencies for u in usage_map.values())
        u = usage_map.get(subskill_id, SkillUsageCounts())

        # Also check legacy string occurrences
        q_str_count = (await db.scalar(select(func.count(QuestionSkillTag.id)).where(QuestionSkillTag.subskill == target_code))) or 0
        ex_str_count = (await db.scalar(select(func.count(ExerciseSkill.id)).where(ExerciseSkill.subskill == target_code))) or 0
        extra_str_deps = max(0, q_str_count - u.questions) + max(0, ex_str_count - u.exercises)
        total_deps += extra_str_deps

        if total_deps > 0:
            raise AppException(
                message=(
                    f"Impossible de supprimer la sous-compétence '{target_name}' car elle possède des dépendances actives "
                    f"({u.questions + max(0, q_str_count - u.questions)} questions, {u.exercises + max(0, ex_str_count - u.exercises)} exercices, "
                    f"{u.student_mastery} profils étudiants, {u.skill_evidence} preuves, {u.skill_assessments} évaluations). "
                    "Veuillez archiver cette compétence pour préserver l'historique pédagogique."
                ),
                code="SUBSKILL_IN_USE",
                status_code=409,
            )

        # Soft-archive canonical skill
        sub_skill.is_active = False
        sub_skill.updated_at = datetime.datetime.now(datetime.UTC)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.DELETE,
            entity_type="subskill",
            entity_id=subskill_id,
            payload={"code": target_code, "is_active": False},
        )


class PublishingValidationEngine:
    """Fail-closed assessment validation engine ensuring content integrity before release."""

    @staticmethod
    async def validate_assessment(
        db: AsyncSession,
        assessment_id: uuid.UUID,
    ) -> tuple[bool, list[ValidationIssue], list[ValidationIssue]]:
        errors: list[ValidationIssue] = []
        warnings: list[ValidationIssue] = []

        stmt = (
            select(Assessment)
            .where(Assessment.id == assessment_id)
            .options(
                selectinload(Assessment.sections).selectinload(AssessmentSection.questions).selectinload(Question.options),
                selectinload(Assessment.sections).selectinload(AssessmentSection.questions).selectinload(Question.skill_tags),
            )
        )
        asmt = (await db.execute(stmt)).scalar_one_or_none()
        if not asmt:
            errors.append(ValidationIssue(field="assessment", message="Assessment not found"))
            return False, errors, warnings

        # 1. Assessment duration
        if asmt.duration_seconds <= 0:
            errors.append(ValidationIssue(field="duration_seconds", message="Assessment duration must be greater than 0 seconds"))

        # 2. Section presence
        if not asmt.sections:
            errors.append(ValidationIssue(field="sections", message="Assessment must contain at least one section"))
            return False, errors, warnings

        # 3. Sections sequential ordering
        order_indices = [sec.order_index for sec in asmt.sections]
        if len(set(order_indices)) != len(order_indices):
            warnings.append(ValidationIssue(field="sections", message="Sections contain duplicate order indices", severity="warning"))

        total_questions = 0
        for s_idx, sec in enumerate(asmt.sections):
            if not sec.questions:
                errors.append(
                    ValidationIssue(
                        field=f"sections[{s_idx}]",
                        message=f"Section '{sec.title}' contains 0 questions. All published sections must have questions.",
                    )
                )
                continue

            total_questions += len(sec.questions)

            for q_idx, q in enumerate(sec.questions):
                prefix = f"sections[{s_idx}].questions[{q_idx}]"

                if not q.prompt or not q.prompt.strip():
                    errors.append(ValidationIssue(field=f"{prefix}.prompt", message="Question prompt cannot be empty"))

                if q.points <= 0:
                    errors.append(ValidationIssue(field=f"{prefix}.points", message="Question points must be greater than 0"))

                if q.difficulty < 1 or q.difficulty > 5:
                    errors.append(ValidationIssue(field=f"{prefix}.difficulty", message="Difficulty must be between 1 and 5"))

                # Options validation
                if q.question_type in (QuestionType.SINGLE_CHOICE, QuestionType.MULTIPLE_CHOICE):
                    if len(q.options) < 2:
                        errors.append(
                            ValidationIssue(
                                field=f"{prefix}.options",
                                message=f"Question '{q.prompt[:30]}...' must have at least 2 options",
                            )
                        )
                    correct_count = sum(1 for opt in q.options if opt.is_correct)
                    if q.question_type == QuestionType.SINGLE_CHOICE:
                        if correct_count != 1:
                            errors.append(
                                ValidationIssue(
                                    field=f"{prefix}.options",
                                    message=f"Single-choice question must have exactly 1 correct option (found {correct_count})",
                                )
                            )
                    elif q.question_type == QuestionType.MULTIPLE_CHOICE and correct_count < 1:
                        errors.append(
                            ValidationIssue(
                                field=f"{prefix}.options",
                                message="Multiple-choice question must have at least 1 correct option",
                            )
                        )

        if total_questions == 0:
            errors.append(ValidationIssue(field="questions", message="Assessment contains no questions"))

        is_valid = len(errors) == 0
        return is_valid, errors, warnings


class AdminContentService:
    """Production-grade content management service with lifecycle & versioning."""

    # --- Assessments ---

    @staticmethod
    async def create_assessment(
        db: AsyncSession,
        payload: AdminAssessmentCreate,
        actor_id: uuid.UUID | None = None,
    ) -> Assessment:
        """Create new assessment in draft status."""
        now = datetime.datetime.now(datetime.UTC)
        asmt = Assessment(
            title=payload.title,
            description=payload.description,
            assessment_type=payload.assessment_type,
            duration_seconds=payload.duration_seconds,
            navigation_policy=payload.navigation_policy,
            scoring_policy=payload.scoring_policy,
            max_attempts=payload.max_attempts,
            pass_percentage=payload.pass_percentage,
            status=payload.status.value,
            version=1,
            is_published=(payload.status == ContentStatus.PUBLISHED),
            created_by_user_id=actor_id,
            updated_by_user_id=actor_id,
            created_at=now,
            updated_at=now,
        )
        db.add(asmt)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.CREATE,
            entity_type="assessment",
            entity_id=asmt.id,
            payload={"title": asmt.title, "type": asmt.assessment_type.value, "status": asmt.status},
        )
        return await AdminContentService.get_assessment_with_tree(db, asmt.id)

    @staticmethod
    async def update_assessment(
        db: AsyncSession,
        assessment_id: uuid.UUID,
        payload: AdminAssessmentUpdate,
        actor_id: uuid.UUID | None = None,
    ) -> Assessment:
        """Update draft assessment. Published assessments must be forked to a new version."""
        asmt = await AdminContentService.get_assessment_with_tree(db, assessment_id)

        # Check attempts
        attempt_count = (await db.execute(select(func.count(Attempt.id)).where(Attempt.assessment_id == assessment_id))).scalar() or 0
        if asmt.status == ContentStatus.PUBLISHED.value and attempt_count > 0:
            # Immutability safeguard: cannot mutate published assessment with attempts
            raise AppException(
                message="Cannot directly modify a published assessment with existing student attempts. Create a new draft version.",
                code="IMMUTABLE_CONTENT",
                status_code=409,
            )

        if payload.title is not None:
            asmt.title = payload.title
        if payload.description is not None:
            asmt.description = payload.description
        if payload.duration_seconds is not None:
            asmt.duration_seconds = payload.duration_seconds
        if payload.navigation_policy is not None:
            asmt.navigation_policy = payload.navigation_policy
        if payload.scoring_policy is not None:
            asmt.scoring_policy = payload.scoring_policy
        if payload.max_attempts is not None:
            asmt.max_attempts = payload.max_attempts
        if payload.pass_percentage is not None:
            asmt.pass_percentage = payload.pass_percentage
        if payload.status is not None:
            asmt.status = payload.status.value
            asmt.is_published = (payload.status == ContentStatus.PUBLISHED)

        asmt.updated_by_user_id = actor_id
        asmt.updated_at = datetime.datetime.now(datetime.UTC)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.UPDATE,
            entity_type="assessment",
            entity_id=asmt.id,
            payload={"title": asmt.title, "version": asmt.version, "status": asmt.status},
        )
        return asmt

    @staticmethod
    async def publish_assessment(
        db: AsyncSession,
        assessment_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
    ) -> Assessment:
        """Validate and publish an assessment, freezing an immutable AssessmentVersion snapshot."""
        # 1. Run fail-closed publishing validation
        is_valid, errors, warnings = await PublishingValidationEngine.validate_assessment(db, assessment_id)
        if not is_valid:
            raise AppException(
                message="Assessment validation failed before publishing",
                code="PUBLISHING_VALIDATION_FAILED",
                status_code=422,
                details=[{"errors": [e.model_dump() for e in errors], "warnings": [w.model_dump() for w in warnings]}],
            )

        asmt = await AdminContentService.get_assessment_with_tree(db, assessment_id)

        # 2. Build sections snapshot
        sections_snapshot = []
        for sec in asmt.sections:
            questions_data = []
            for q in sec.questions:
                options_data = [
                    {
                        "id": str(opt.id),
                        "content": opt.content,
                        "order_index": opt.order_index,
                        "is_correct": opt.is_correct,
                        "explanation": opt.explanation,
                    }
                    for opt in q.options
                ]
                questions_data.append(
                    {
                        "id": str(q.id),
                        "prompt": q.prompt,
                        "question_type": q.question_type.value,
                        "difficulty": q.difficulty,
                        "level": q.level,
                        "points": q.points,
                        "penalty_points": q.penalty_points,
                        "explanation": q.explanation,
                        "media_url": q.media_url,
                        "order_index": q.order_index,
                        "options": options_data,
                    }
                )
            sections_snapshot.append(
                {
                    "id": str(sec.id),
                    "title": sec.title,
                    "instructions": sec.instructions,
                    "order_index": sec.order_index,
                    "time_limit_seconds": sec.duration_seconds,
                    "media_url": sec.media_url,
                    "passage_text": sec.passage_text,
                    "questions": questions_data,
                }
            )

        # 3. Create or update immutable AssessmentVersion record
        existing_version = (
            await db.execute(
                select(AssessmentVersion).where(
                    AssessmentVersion.assessment_id == asmt.id,
                    AssessmentVersion.version == asmt.version,
                )
            )
        ).scalar_one_or_none()

        if existing_version:
            existing_version.sections_snapshot = sections_snapshot
            existing_version.title = asmt.title
            existing_version.description = asmt.description
            existing_version.duration_seconds = asmt.duration_seconds
        else:
            version_record = AssessmentVersion(
                assessment_id=asmt.id,
                version=asmt.version,
                title=asmt.title,
                description=asmt.description,
                assessment_type=asmt.assessment_type.value,
                duration_seconds=asmt.duration_seconds,
                navigation_policy=asmt.navigation_policy.value,
                scoring_policy=asmt.scoring_policy.value,
                pass_percentage=asmt.pass_percentage,
                sections_snapshot=sections_snapshot,
                created_by_user_id=actor_id,
                created_at=datetime.datetime.now(datetime.UTC),
            )
            db.add(version_record)

        # 4. Transition assessment
        asmt.status = ContentStatus.PUBLISHED.value
        asmt.is_published = True
        asmt.updated_by_user_id = actor_id
        asmt.updated_at = datetime.datetime.now(datetime.UTC)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.PUBLISH,
            entity_type="assessment",
            entity_id=asmt.id,
            payload={"version": asmt.version, "title": asmt.title},
        )
        return asmt

    @staticmethod
    async def fork_new_assessment_version(
        db: AsyncSession,
        assessment_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
    ) -> Assessment:
        """Fork a new draft version from an existing assessment."""
        asmt = await AdminContentService.get_assessment_with_tree(db, assessment_id)
        asmt.version += 1
        asmt.status = ContentStatus.DRAFT.value
        asmt.is_published = False
        asmt.updated_by_user_id = actor_id
        asmt.updated_at = datetime.datetime.now(datetime.UTC)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action="content.fork_version",
            entity_type="assessment",
            entity_id=asmt.id,
            payload={"new_version": asmt.version},
        )
        return asmt

    @staticmethod
    async def list_assessment_versions(
        db: AsyncSession,
        assessment_id: uuid.UUID,
    ) -> list[AssessmentVersion]:
        stmt = (
            select(AssessmentVersion)
            .where(AssessmentVersion.assessment_id == assessment_id)
            .order_by(AssessmentVersion.version.desc())
        )
        return list((await db.execute(stmt)).scalars().all())

    @staticmethod
    async def transition_assessment_lifecycle(
        db: AsyncSession,
        assessment_id: uuid.UUID,
        new_status: ContentStatus,
        actor_id: uuid.UUID | None = None,
    ) -> Assessment:
        """Explicitly transition content lifecycle."""
        if new_status == ContentStatus.PUBLISHED:
            return await AdminContentService.publish_assessment(db, assessment_id, actor_id)

        stmt = select(Assessment).where(Assessment.id == assessment_id)
        asmt = (await db.execute(stmt)).scalar_one_or_none()
        if not asmt:
            raise AppException(message="Assessment not found", code="NOT_FOUND", status_code=404)

        old_status = asmt.status
        asmt.status = new_status.value
        asmt.is_published = (new_status == ContentStatus.PUBLISHED)
        asmt.updated_by_user_id = actor_id
        asmt.updated_at = datetime.datetime.now(datetime.UTC)
        await db.flush()

        action = AuditAction.ARCHIVE if new_status == ContentStatus.ARCHIVED else AuditAction.UPDATE
        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=action,
            entity_type="assessment",
            entity_id=asmt.id,
            payload={"old_status": old_status, "new_status": new_status.value, "version": asmt.version},
        )
        return asmt

    @staticmethod
    async def get_assessment_with_tree(db: AsyncSession, assessment_id: uuid.UUID) -> Assessment:
        """Fetch assessment with sections, questions, options, and skill tags."""
        stmt = (
            select(Assessment)
            .where(Assessment.id == assessment_id)
            .options(
                selectinload(Assessment.sections).selectinload(AssessmentSection.questions).selectinload(Question.options),
                selectinload(Assessment.sections).selectinload(AssessmentSection.questions).selectinload(Question.skill_tags),
                selectinload(Assessment.sections).selectinload(AssessmentSection.questions).selectinload(Question.stimulus),
                selectinload(Assessment.sections).selectinload(AssessmentSection.questions).selectinload(Question.validations),
                selectinload(Assessment.sections).selectinload(AssessmentSection.questions).selectinload(Question.provenance),
            )
        )
        asmt = (await db.execute(stmt)).scalar_one_or_none()
        if not asmt:
            raise AppException(message="Assessment not found", code="NOT_FOUND", status_code=404)
        return asmt

    @staticmethod
    async def list_admin_assessments(
        db: AsyncSession,
        status_filter: ContentStatus | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Assessment], int]:
        """List assessments for administration."""
        stmt = (
            select(Assessment)
            .options(
                selectinload(Assessment.sections).selectinload(AssessmentSection.questions).selectinload(Question.options),
                selectinload(Assessment.sections).selectinload(AssessmentSection.questions).selectinload(Question.skill_tags),
                selectinload(Assessment.sections).selectinload(AssessmentSection.questions).selectinload(Question.stimulus),
                selectinload(Assessment.sections).selectinload(AssessmentSection.questions).selectinload(Question.validations),
                selectinload(Assessment.sections).selectinload(AssessmentSection.questions).selectinload(Question.provenance),
            )
            .order_by(Assessment.created_at.desc())
        )
        if status_filter:
            stmt = stmt.where(Assessment.status == status_filter.value)

        count_stmt = select(func.count(Assessment.id))
        if status_filter:
            count_stmt = count_stmt.where(Assessment.status == status_filter.value)

        total = (await db.execute(count_stmt)).scalar() or 0
        paged = stmt.offset((page - 1) * page_size).limit(page_size)
        items = list((await db.execute(paged)).scalars().all())
        return items, total

    # --- Sections & Questions ---

    @staticmethod
    async def add_section(
        db: AsyncSession,
        assessment_id: uuid.UUID,
        payload: AdminSectionCreate,
        actor_id: uuid.UUID | None = None,
    ) -> AssessmentSection:
        """Add section to an assessment."""
        _ = await AdminContentService.get_assessment_with_tree(db, assessment_id)
        now = datetime.datetime.now(datetime.UTC)
        sec = AssessmentSection(
            assessment_id=assessment_id,
            title=payload.title,
            instructions=payload.instructions,
            order_index=payload.order_index,
            duration_seconds=payload.time_limit_seconds,
            media_url=payload.media_url,
            passage_text=payload.passage_text,
            created_at=now,
            updated_at=now,
        )
        db.add(sec)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.CREATE,
            entity_type="section",
            entity_id=sec.id,
            payload={"assessment_id": str(assessment_id), "title": sec.title},
        )
        return sec

    @staticmethod
    async def add_question(
        db: AsyncSession,
        section_id: uuid.UUID,
        payload: AdminQuestionCreate,
        actor_id: uuid.UUID | None = None,
    ) -> Question:
        """Add question with options and skill tags to a section."""
        now = datetime.datetime.now(datetime.UTC)
        q = Question(
            section_id=section_id,
            stimulus_id=getattr(payload, "stimulus_id", None),
            question_type=payload.question_type,
            response_type=getattr(payload, "response_type", "single_choice"),
            prompt=payload.prompt,
            instructions=getattr(payload, "instructions", None),
            media_url=payload.media_url or payload.audio_url,
            order_index=payload.order_index,
            difficulty=payload.difficulty,
            difficulty_rating=getattr(payload, "difficulty_rating", None),
            level=payload.level,
            target_cefr=getattr(payload, "target_cefr", None),
            cognitive_complexity=getattr(payload, "cognitive_complexity", None),
            explanation=payload.explanation,
            points=payload.points,
            penalty_points=payload.penalty_points,
            scoring_payload=getattr(payload, "scoring_payload", None),
            is_live_delivered=getattr(payload, "is_live_delivered", False),
            item_hash=getattr(payload, "item_hash", None),
            task_type_id=getattr(payload, "task_type_id", None),
            status=ContentStatus.DRAFT.value,
            version=1,
            created_by_user_id=actor_id,
            updated_by_user_id=actor_id,
            created_at=now,
            updated_at=now,
        )
        db.add(q)
        await db.flush()

        for opt in payload.options:
            q_opt = QuestionOption(
                question_id=q.id,
                content=opt.content,
                order_index=opt.order_index,
                is_correct=opt.is_correct,
                explanation=opt.explanation,
                misconception_type=getattr(opt, "misconception_type", None),
                distractor_rationale=getattr(opt, "distractor_rationale", None),
                created_at=now,
                updated_at=now,
            )
            db.add(q_opt)

        if payload.skill_tags:
            from app.modules.admin.enums import SkillTagRole
            from app.modules.admin.tagging_service import TaggingValidationEngine
            await TaggingValidationEngine.validate_skill_tags(
                db=db,
                tags=payload.skill_tags,
                task_type_id=getattr(payload, "task_type_id", None),
            )
        for tag in payload.skill_tags:
            role_val = getattr(tag, "role", "primary")
            q_tag = QuestionSkillTag(
                question_id=q.id,
                skill_id=tag.skill_id,
                subskill_id=getattr(tag, "subskill_id", None),
                subskill=tag.subskill,
                role=SkillTagRole(role_val) if isinstance(role_val, str) else role_val,
                weight=tag.weight,
                context=getattr(tag, "context", None),
                created_at=now,
                updated_at=now,
            )
            db.add(q_tag)

        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.CREATE,
            entity_type="question",
            entity_id=q.id,
            payload={"section_id": str(section_id) if section_id else None, "prompt": q.prompt[:50]},
        )
        return await AdminContentService.get_question(db, q.id)

    # --- Standalone Question Management ---

    @staticmethod
    async def get_question(db: AsyncSession, question_id: uuid.UUID) -> Question:
        stmt = (
            select(Question)
            .where(Question.id == question_id)
            .options(
                selectinload(Question.options),
                selectinload(Question.skill_tags),
                selectinload(Question.stimulus),
                selectinload(Question.provenance),
                selectinload(Question.validations),
            )
        )
        q = (await db.execute(stmt)).scalar_one_or_none()
        if not q:
            raise AppException(message="Question not found", code="NOT_FOUND", status_code=404)
        return q

    @staticmethod
    async def validate_question(
        db: AsyncSession,
        question_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
    ) -> Any:
        """Validate question and persist audit trail in question_validations."""
        q = await AdminContentService.get_question(db, question_id)
        from app.modules.assessments.question_validation import QuestionValidationEngine
        return await QuestionValidationEngine.validate_and_persist(
            db=db,
            question=q,
            actor_id=actor_id,
            check_duplication=True,
        )

    @staticmethod
    async def list_questions(
        db: AsyncSession,
        section_id: uuid.UUID | None = None,
        level: str | None = None,
        target_cefr: str | None = None,
        difficulty: int | None = None,
        question_type: QuestionType | None = None,
        response_type: str | None = None,
        status: str | None = None,
        task_type_id: uuid.UUID | None = None,
        search: str | None = None,
        validation_status: str | None = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Question], int]:
        stmt = (
            select(Question)
            .options(
                selectinload(Question.options),
                selectinload(Question.skill_tags),
                selectinload(Question.stimulus),
                selectinload(Question.provenance),
                selectinload(Question.validations),
            )
        )
        count_stmt = select(func.count(Question.id))

        if section_id:
            stmt = stmt.where(Question.section_id == section_id)
            count_stmt = count_stmt.where(Question.section_id == section_id)
        if level:
            stmt = stmt.where(Question.level == level)
            count_stmt = count_stmt.where(Question.level == level)
        if target_cefr:
            stmt = stmt.where(Question.target_cefr == target_cefr)
            count_stmt = count_stmt.where(Question.target_cefr == target_cefr)
        if difficulty:
            stmt = stmt.where(Question.difficulty == difficulty)
            count_stmt = count_stmt.where(Question.difficulty == difficulty)
        if question_type:
            stmt = stmt.where(Question.question_type == question_type)
            count_stmt = count_stmt.where(Question.question_type == question_type)
        if response_type:
            stmt = stmt.where(Question.response_type == response_type)
            count_stmt = count_stmt.where(Question.response_type == response_type)
        if status:
            stmt = stmt.where(Question.status == status)
            count_stmt = count_stmt.where(Question.status == status)
        if task_type_id:
            stmt = stmt.where(Question.task_type_id == task_type_id)
            count_stmt = count_stmt.where(Question.task_type_id == task_type_id)
        if search:
            search_clause = Question.prompt.ilike(f"%{search}%")
            stmt = stmt.where(search_clause)
            count_stmt = count_stmt.where(search_clause)
        if validation_status:
            stmt = stmt.join(Question.validations).where(QuestionValidation.validation_status == validation_status)
            count_stmt = count_stmt.join(Question.validations).where(QuestionValidation.validation_status == validation_status)

        # Dynamic Sorting
        sort_col = getattr(Question, sort_by, Question.created_at)
        if sort_order.lower() == "asc":
            stmt = stmt.order_by(sort_col.asc())
        else:
            stmt = stmt.order_by(sort_col.desc())

        total = (await db.execute(count_stmt)).scalar() or 0
        paged = stmt.offset((page - 1) * page_size).limit(page_size)
        items = list((await db.execute(paged)).scalars().all())
        return items, total

    @staticmethod
    async def create_standalone_question(
        db: AsyncSession,
        payload: AdminStandaloneQuestionCreate,
        actor_id: uuid.UUID | None = None,
    ) -> Question:
        """Create a question directly from the Question Authoring Workspace."""
        from app.modules.admin.schemas import AdminQuestionCreate
        create_payload = AdminQuestionCreate(**payload.model_dump())
        return await AdminContentService.add_question(
            db=db,
            section_id=payload.section_id,
            payload=create_payload,
            actor_id=actor_id,
        )

    # --- Reusable Stimuli Management ---

    @staticmethod
    async def create_stimulus(
        db: AsyncSession,
        payload: AdminStimulusCreate,
        actor_id: uuid.UUID | None = None,
    ) -> Stimulus:
        """Create or reuse an existing Stimulus record matching content hash."""
        import hashlib
        content_for_hash = f"{payload.title}:{payload.modality}:{payload.content_text or ''}:{payload.media_url or ''}"
        c_hash = hashlib.sha256(content_for_hash.encode("utf-8")).hexdigest()

        existing = await db.scalar(select(Stimulus).where(Stimulus.content_hash == c_hash))
        if existing:
            return existing

        word_count = payload.word_count
        if word_count is None and payload.content_text:
            word_count = len(payload.content_text.split())

        stim = Stimulus(
            title=payload.title,
            modality=payload.modality,
            content_text=payload.content_text,
            text_format=payload.text_format or "plain",
            word_count=word_count,
            media_url=payload.media_url,
            source_citation=payload.source_citation,
            content_hash=c_hash,
        )
        db.add(stim)
        await db.flush()
        return stim

    @staticmethod
    async def list_stimuli(
        db: AsyncSession,
        modality: str | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Stimulus], int]:
        stmt = select(Stimulus).order_by(Stimulus.created_at.desc())
        count_stmt = select(func.count(Stimulus.id))
        if modality:
            stmt = stmt.where(Stimulus.modality == modality)
            count_stmt = count_stmt.where(Stimulus.modality == modality)
        if search:
            search_clause = Stimulus.title.ilike(f"%{search}%") | Stimulus.content_text.ilike(f"%{search}%")
            stmt = stmt.where(search_clause)
            count_stmt = count_stmt.where(search_clause)

        total = (await db.execute(count_stmt)).scalar() or 0
        paged = stmt.offset((page - 1) * page_size).limit(page_size)
        items = list((await db.execute(paged)).scalars().all())
        return items, total

    @staticmethod
    async def get_stimulus(db: AsyncSession, stimulus_id: uuid.UUID) -> Stimulus:
        stim = await db.scalar(select(Stimulus).where(Stimulus.id == stimulus_id))
        if not stim:
            raise AppException(message="Stimulus not found", code="NOT_FOUND", status_code=404)
        return stim

    @staticmethod
    async def update_question(
        db: AsyncSession,
        question_id: uuid.UUID,
        payload: AdminStandaloneQuestionUpdate,
        actor_id: uuid.UUID | None = None,
    ) -> Question:
        q = await AdminContentService.get_question(db, question_id)

        # Immutability guard: Only draft or rejected questions can be modified in-place
        if q.status not in (ContentStatus.DRAFT.value, ContentStatus.REJECTED.value):
            raise AppException(
                message=(
                    f"Cannot edit question in '{q.status}' status. Only draft or rejected questions can be edited. "
                    "Create a new draft version or fork to propose changes."
                ),
                code="CANNOT_EDIT_NON_DRAFT_QUESTION",
                status_code=400,
            )

        if q.is_live_delivered:
            raise AppException(
                message="Cannot edit a delivered question in-place. Create a new draft version or fork to propose changes.",
                code="DELIVERED_QUESTION_IMMUTABLE",
                status_code=400,
            )

        # Optimistic concurrency check
        expected_ver = getattr(payload, "expected_version", None)
        if expected_ver is not None and q.version != expected_ver:
            raise AppException(
                message=f"Question version conflict: current version is {q.version}, but request expected {expected_ver}.",
                code="CONCURRENT_MODIFICATION_CONFLICT",
                status_code=409,
            )

        if payload.prompt is not None:
            q.prompt = payload.prompt
        if payload.instructions is not None:
            q.instructions = payload.instructions
        if payload.question_type is not None:
            q.question_type = payload.question_type
        if getattr(payload, "response_type", None) is not None:
            q.response_type = payload.response_type
        if getattr(payload, "stimulus_id", None) is not None:
            q.stimulus_id = payload.stimulus_id
        if getattr(payload, "section_id", None) is not None:
            q.section_id = payload.section_id
        if payload.difficulty is not None:
            q.difficulty = payload.difficulty
        if getattr(payload, "difficulty_rating", None) is not None:
            q.difficulty_rating = payload.difficulty_rating
        if payload.level is not None:
            q.level = payload.level
        if getattr(payload, "target_cefr", None) is not None:
            q.target_cefr = payload.target_cefr
        if getattr(payload, "cognitive_complexity", None) is not None:
            q.cognitive_complexity = payload.cognitive_complexity
        if payload.explanation is not None:
            q.explanation = payload.explanation
        if payload.points is not None:
            q.points = payload.points
        if payload.penalty_points is not None:
            q.penalty_points = payload.penalty_points
        if getattr(payload, "scoring_payload", None) is not None:
            q.scoring_payload = payload.scoring_payload
        if getattr(payload, "is_live_delivered", None) is not None:
            q.is_live_delivered = payload.is_live_delivered
        if getattr(payload, "item_hash", None) is not None:
            q.item_hash = payload.item_hash
        if payload.media_url is not None:
            q.media_url = payload.media_url
        if payload.order_index is not None:
            q.order_index = payload.order_index
        if payload.status is not None:
            q.status = payload.status.value

        # Replace options if provided
        if payload.options is not None:
            await db.execute(delete(QuestionOption).where(QuestionOption.question_id == question_id))
            now = datetime.datetime.now(datetime.UTC)
            for opt in payload.options:
                q_opt = QuestionOption(
                    question_id=q.id,
                    content=opt.content,
                    order_index=opt.order_index,
                    is_correct=opt.is_correct,
                    explanation=opt.explanation,
                    misconception_type=getattr(opt, "misconception_type", None),
                    distractor_rationale=getattr(opt, "distractor_rationale", None),
                    created_at=now,
                    updated_at=now,
                )
                db.add(q_opt)

        if payload.task_type_id is not None:
            q.task_type_id = payload.task_type_id

        # Replace skill tags if provided
        if getattr(payload, "skill_tags", None) is not None:
            from sqlalchemy import delete as sa_delete

            from app.modules.admin.enums import SkillTagRole
            from app.modules.admin.tagging_service import TaggingValidationEngine
            await TaggingValidationEngine.validate_skill_tags(
                db=db,
                tags=payload.skill_tags,
                task_type_id=q.task_type_id,
            )
            await db.execute(sa_delete(QuestionSkillTag).where(QuestionSkillTag.question_id == question_id))
            now_tags = datetime.datetime.now(datetime.UTC)
            for tag in payload.skill_tags:
                role_val = getattr(tag, "role", "primary")
                q_tag = QuestionSkillTag(
                    question_id=q.id,
                    skill_id=tag.skill_id,
                    subskill_id=getattr(tag, "subskill_id", None),
                    subskill=tag.subskill,
                    role=SkillTagRole(role_val) if isinstance(role_val, str) else role_val,
                    weight=tag.weight,
                    context=getattr(tag, "context", None),
                    created_at=now_tags,
                    updated_at=now_tags,
                )
                db.add(q_tag)

        q.updated_by_user_id = actor_id
        q.updated_at = datetime.datetime.now(datetime.UTC)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.UPDATE,
            entity_type="question",
            entity_id=q.id,
            payload={"prompt": q.prompt[:50], "version": q.version},
        )
        return await AdminContentService.get_question(db, question_id)

    @staticmethod
    async def submit_question_for_review(
        db: AsyncSession,
        question_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
        comments: str | None = None,
    ) -> Question:
        from app.modules.admin.question_lifecycle_service import QuestionLifecycleService
        return await QuestionLifecycleService.submit_for_review(db, question_id, actor_id, comments)

    @staticmethod
    async def approve_question(
        db: AsyncSession,
        question_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
        notes: str | None = None,
    ) -> Question:
        from app.modules.admin.question_lifecycle_service import QuestionLifecycleService
        return await QuestionLifecycleService.approve_question(db, question_id, actor_id, notes)

    @staticmethod
    async def reject_question(
        db: AsyncSession,
        question_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
        notes: str | None = None,
    ) -> Question:
        from app.modules.admin.question_lifecycle_service import QuestionLifecycleService
        return await QuestionLifecycleService.reject_question(db, question_id, actor_id, notes)

    @staticmethod
    async def revert_question_to_draft(
        db: AsyncSession,
        question_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
        reason: str | None = None,
    ) -> Question:
        from app.modules.admin.question_lifecycle_service import QuestionLifecycleService
        return await QuestionLifecycleService.revert_to_draft(db, question_id, actor_id, reason)

    @staticmethod
    async def publish_question(
        db: AsyncSession,
        question_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
        changelog: str | None = None,
    ) -> Question:
        from app.modules.admin.question_lifecycle_service import QuestionLifecycleService
        return await QuestionLifecycleService.publish_question(db, question_id, actor_id, changelog)

    @staticmethod
    async def archive_question(
        db: AsyncSession,
        question_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
        reason: str | None = None,
    ) -> Question:
        from app.modules.admin.question_lifecycle_service import QuestionLifecycleService
        return await QuestionLifecycleService.archive_question(db, question_id, actor_id, reason)

    @staticmethod
    async def create_draft_version(
        db: AsyncSession,
        question_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
        changelog: str | None = None,
    ) -> Question:
        from app.modules.admin.question_lifecycle_service import QuestionLifecycleService
        return await QuestionLifecycleService.create_draft_version(db, question_id, actor_id, changelog)

    @staticmethod
    async def fork_question(
        db: AsyncSession,
        question_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
        prompt_prefix: str | None = None,
        changelog: str | None = None,
    ) -> Question:
        from app.modules.admin.question_lifecycle_service import QuestionLifecycleService
        return await QuestionLifecycleService.fork_question(db, question_id, actor_id, prompt_prefix, changelog)

    @staticmethod
    async def fork_new_question_version(
        db: AsyncSession,
        question_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
    ) -> Question:
        from app.modules.admin.question_lifecycle_service import QuestionLifecycleService
        return await QuestionLifecycleService.create_draft_version(db, question_id, actor_id)

    @staticmethod
    async def list_question_versions(db: AsyncSession, question_id: uuid.UUID) -> list[QuestionVersion]:
        from app.modules.admin.question_lifecycle_service import QuestionLifecycleService
        return await QuestionLifecycleService.list_versions(db, question_id)

    @staticmethod
    async def get_question_version(
        db: AsyncSession,
        question_id: uuid.UUID,
        version_num: int,
    ) -> QuestionVersion:
        from app.modules.admin.question_lifecycle_service import QuestionLifecycleService
        return await QuestionLifecycleService.get_version(db, question_id, version_num)

    @staticmethod
    async def get_published_question_version(
        db: AsyncSession,
        question_id: uuid.UUID,
    ) -> QuestionVersion:
        from app.modules.admin.question_lifecycle_service import QuestionLifecycleService
        return await QuestionLifecycleService.get_published_version(db, question_id)

    @staticmethod
    async def get_question_history(
        db: AsyncSession,
        question_id: uuid.UUID,
    ) -> list[AuditEvent]:
        from app.modules.admin.question_lifecycle_service import QuestionLifecycleService
        return await QuestionLifecycleService.get_history(db, question_id)

    # --- Skills Taxonomy ---

    @staticmethod
    async def get_skill_usage(db: AsyncSession, skill_id: uuid.UUID) -> SkillUsageCounts:
        """Aggregate real relational dependencies across all subsystems for a skill."""
        from app.modules.admin.taxonomy_service import TaxonomyService
        usage_map = await TaxonomyService.batch_get_skill_usage(db, [skill_id])
        return usage_map.get(skill_id, SkillUsageCounts())

    @staticmethod
    async def get_metrics_summary(db: AsyncSession) -> AdminSkillMetricsSummary:
        """Compute real global taxonomy metrics, domain distribution, and integrity warnings."""
        # Total root skills
        total_skills_stmt = select(func.count(Skill.id)).where(Skill.parent_id.is_(None))
        total_skills = (await db.scalar(total_skills_stmt)) or 0

        # Total child competencies in canonical skills table
        total_subskills_stmt = select(func.count(Skill.id)).where(Skill.parent_id.is_not(None), Skill.is_active.is_(True))
        total_subskills = (await db.scalar(total_subskills_stmt)) or 0

        # Distinct domains
        domains_stmt = select(func.count(func.distinct(Skill.category))).where(Skill.parent_id.is_(None), Skill.category.is_not(None))
        domains_count = (await db.scalar(domains_stmt)) or 0

        # Domain breakdown
        breakdown_stmt = (
            select(Skill.category, func.count(Skill.id))
            .where(Skill.parent_id.is_(None))
            .group_by(Skill.category)
        )
        breakdown_rows = (await db.execute(breakdown_stmt)).all()
        domain_breakdown = {
            (r[0].value if hasattr(r[0], "value") else str(r[0])) if r[0] else "unassigned": r[1]
            for r in breakdown_rows
        }

        # Inspect issues/warnings
        issues: list[dict[str, Any]] = []

        # 1. Root skills with 0 subskills
        all_root_stmt = select(Skill).options(selectinload(Skill.subskills)).where(Skill.parent_id.is_(None))
        all_root = (await db.execute(all_root_stmt)).scalars().all()
        for sk in all_root:
            if not sk.subskills or len(sk.subskills) == 0:
                issues.append({
                    "skill_id": str(sk.id),
                    "skill_code": sk.code,
                    "skill_name": sk.name,
                    "severity": "warning",
                    "message": f"Compétence '{sk.name}' sans sous-compétences définies.",
                })
            if not sk.description or len(sk.description.strip()) == 0:
                issues.append({
                    "skill_id": str(sk.id),
                    "skill_code": sk.code,
                    "skill_name": sk.name,
                    "severity": "info",
                    "message": f"Compétence '{sk.name}' sans description pédagogique.",
                })
            if not sk.is_active:
                issues.append({
                    "skill_id": str(sk.id),
                    "skill_code": sk.code,
                    "skill_name": sk.name,
                    "severity": "info",
                    "message": f"Compétence '{sk.name}' est actuellement archivée/inactivée.",
                })

        return AdminSkillMetricsSummary(
            total_skills=total_skills,
            total_subskills=total_subskills,
            domains_count=domains_count,
            domain_breakdown=domain_breakdown,
            taxonomy_warnings_count=len(issues),
            issues=issues,
        )

    @staticmethod
    async def get_skill(db: AsyncSession, skill_id: uuid.UUID) -> tuple[Skill, SkillUsageCounts]:
        """Fetch a single skill with its subskills and relational usage stats."""
        stmt = select(Skill).options(selectinload(Skill.subskills)).where(Skill.id == skill_id)
        skill = (await db.execute(stmt)).scalar_one_or_none()
        if not skill:
            raise AppException(message="Skill not found", code="SKILL_NOT_FOUND", status_code=404)
        usage = await AdminContentService.get_skill_usage(db, skill.id)
        return skill, usage

    @staticmethod
    async def create_skill(
        db: AsyncSession,
        payload: AdminSkillCreate,
        actor_id: uuid.UUID | None = None,
    ) -> tuple[Skill, SkillUsageCounts]:
        """Create skill node with unique code verification and audit logging."""
        existing = (await db.execute(select(Skill).where(Skill.code == payload.code))).scalar_one_or_none()
        if existing:
            raise AppException(message=f"Skill with code '{payload.code}' already exists", code="DUPLICATE_CODE", status_code=409)

        from app.modules.admin.enums import SkillDimension
        from app.modules.admin.taxonomy_service import TaxonomyService
        active_version = await TaxonomyService.get_active_version(db)

        dimension = SkillDimension.LANGUAGE
        domain = "general"
        if payload.parent_id:
            parent = await db.get(Skill, payload.parent_id)
            if parent:
                dimension = parent.dimension
                domain = parent.domain
        elif payload.category:
            cat_str = (payload.category.value if hasattr(payload.category, "value") else str(payload.category)).lower()
            if any(k in cat_str for k in ("reasoning", "logic", "inference", "coherence")):
                dimension = SkillDimension.REASONING
            domain = cat_str

        now = datetime.datetime.now(datetime.UTC)
        skill = Skill(
            code=payload.code,
            name=payload.name,
            dimension=dimension,
            domain=domain,
            taxonomy_version_id=active_version.id,
            category=payload.category,
            description=payload.description,
            parent_id=payload.parent_id,
            is_active=payload.is_active,
            created_at=now,
            updated_at=now,
        )
        db.add(skill)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.CREATE,
            entity_type="skill",
            entity_id=skill.id,
            payload={"code": skill.code, "name": skill.name, "category": skill.category},
        )
        usage = await AdminContentService.get_skill_usage(db, skill.id)
        return skill, usage

    @staticmethod
    async def update_skill(
        db: AsyncSession,
        skill_id: uuid.UUID,
        payload: AdminSkillUpdate,
        actor_id: uuid.UUID | None = None,
    ) -> tuple[Skill, SkillUsageCounts]:
        """Update skill attributes with safe code propagation and audit logging."""
        stmt = select(Skill).options(selectinload(Skill.subskills)).where(Skill.id == skill_id)
        skill = (await db.execute(stmt)).scalar_one_or_none()
        if not skill:
            raise AppException(message="Skill not found", code="SKILL_NOT_FOUND", status_code=404)

        if payload.code is not None and payload.code != skill.code:
            existing = (await db.execute(select(Skill).where(Skill.code == payload.code))).scalar_one_or_none()
            if existing:
                raise AppException(message=f"Skill code '{payload.code}' is already in use", code="DUPLICATE_CODE", status_code=409)
            skill.code = payload.code

        if payload.name is not None:
            skill.name = payload.name
        if payload.category is not None:
            skill.category = payload.category
        if payload.description is not None:
            skill.description = payload.description
        if payload.is_active is not None:
            skill.is_active = payload.is_active

        skill.updated_at = datetime.datetime.now(datetime.UTC)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.UPDATE,
            entity_type="skill",
            entity_id=skill.id,
            payload={"code": skill.code, "name": skill.name, "is_active": skill.is_active},
        )
        usage = await AdminContentService.get_skill_usage(db, skill.id)
        return skill, usage

    @staticmethod
    async def delete_skill(
        db: AsyncSession,
        skill_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
    ) -> None:
        """Safely delete skill only when no foreign key dependencies exist across the platform."""
        stmt = select(Skill).options(selectinload(Skill.subskills)).where(Skill.id == skill_id)
        skill = (await db.execute(stmt)).scalar_one_or_none()
        if not skill:
            raise AppException(message="Skill not found", code="SKILL_NOT_FOUND", status_code=404)

        usage = await AdminContentService.get_skill_usage(db, skill_id)
        if usage.total_dependencies > 0:
            raise AppException(
                message=(
                    f"Impossible de supprimer la compétence '{skill.name}' : {usage.total_dependencies} enregistrements en dépendent "
                    f"({usage.questions} questions, {usage.exercises} exercices, {usage.student_mastery} profils étudiants). "
                    f"Veuillez archiver/désactiver cette compétence à la place."
                ),
                code="SKILL_HAS_DEPENDENCIES",
                status_code=409,
            )

        skill_name = skill.name
        skill_code = skill.code
        await db.delete(skill)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.DELETE,
            entity_type="skill",
            entity_id=skill_id,
            payload={"code": skill_code, "name": skill_name},
        )

    @staticmethod
    async def list_skills(
        db: AsyncSession,
        parent_id: uuid.UUID | None = None,
        q: str | None = None,
        category: str | None = None,
        is_active: bool | None = None,
        has_subskills: bool | None = None,
    ) -> list[tuple[Skill, SkillUsageCounts]]:
        """List skills with subskills and usage metrics, filtering root competencies by default."""
        stmt = select(Skill).options(selectinload(Skill.subskills))
        if parent_id is not None:
            stmt = stmt.where(Skill.parent_id == parent_id)
        else:
            # Default to root competencies only
            stmt = stmt.where(Skill.parent_id.is_(None))

        if q and q.strip():
            pat = f"%{q.strip()}%"
            stmt = stmt.where(or_(Skill.name.ilike(pat), Skill.code.ilike(pat)))

        if category and category.strip():
            stmt = stmt.where(Skill.category == category.strip())

        if is_active is not None:
            stmt = stmt.where(Skill.is_active == is_active)

        stmt = stmt.order_by(Skill.name.asc())
        skills = list((await db.execute(stmt)).scalars().all())

        if has_subskills is True:
            skills = [s for s in skills if s.subskills and len(s.subskills) > 0]
        elif has_subskills is False:
            skills = [s for s in skills if not s.subskills or len(s.subskills) == 0]

        if not skills:
            return []

        from app.modules.admin.taxonomy_service import TaxonomyService
        skill_ids = [sk.id for sk in skills]
        usage_map = await TaxonomyService.batch_get_skill_usage(db, skill_ids)
        return [(sk, usage_map.get(sk.id, SkillUsageCounts())) for sk in skills]

    # --- Exercises ---

    @staticmethod
    async def create_exercise(
        db: AsyncSession,
        payload: AdminExerciseCreate,
        actor_id: uuid.UUID | None = None,
    ) -> Exercise:
        """Create drill exercise."""
        now = datetime.datetime.now(datetime.UTC)
        ex = Exercise(
            title=payload.title,
            prompt=payload.prompt,
            category=payload.category,
            level=payload.level,
            difficulty=payload.difficulty,
            question_type=payload.question_type,
            instructions=payload.instructions,
            explanation=payload.explanation,
            points=payload.points,
            options_payload=payload.options_payload,
            status=payload.status.value,
            version=1,
            is_published=(payload.status == ContentStatus.PUBLISHED),
            created_by_user_id=actor_id,
            updated_by_user_id=actor_id,
            created_at=now,
            updated_at=now,
        )
        db.add(ex)
        await db.flush()

        # Support new skill_tags (canonical) with fallback to legacy skill_ids
        exercise_skill_tags = getattr(payload, "skill_tags", []) or []
        if exercise_skill_tags:
            from app.modules.admin.enums import SkillTagRole
            from app.modules.admin.tagging_service import TaggingValidationEngine
            await TaggingValidationEngine.validate_skill_tags(
                db=db,
                tags=exercise_skill_tags,
                task_type_id=getattr(payload, "task_type_id", None),
            )
            for tag in exercise_skill_tags:
                role_val = getattr(tag, "role", "primary")
                es = ExerciseSkill(
                    exercise_id=ex.id,
                    skill_id=tag.skill_id,
                    subskill_id=getattr(tag, "subskill_id", None),
                    subskill=tag.subskill,
                    role=SkillTagRole(role_val) if isinstance(role_val, str) else role_val,
                    weight=tag.weight,
                    context=getattr(tag, "context", None),
                )
                db.add(es)
        else:
            # Legacy: plain skill_ids with weight=1.0
            for sk_id in payload.skill_ids:
                es = ExerciseSkill(
                    exercise_id=ex.id,
                    skill_id=sk_id,
                    weight=1.0,
                )
                db.add(es)

        if getattr(payload, "task_type_id", None):
            ex.task_type_id = payload.task_type_id

        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.CREATE,
            entity_type="exercise",
            entity_id=ex.id,
            payload={"title": ex.title, "category": ex.category.value, "status": ex.status},
        )
        return ex

    @staticmethod
    async def update_exercise(
        db: AsyncSession,
        exercise_id: uuid.UUID,
        payload: AdminExerciseUpdate,
        actor_id: uuid.UUID | None = None,
    ) -> Exercise:
        stmt = select(Exercise).where(Exercise.id == exercise_id).options(selectinload(Exercise.skills))
        ex = (await db.execute(stmt)).scalar_one_or_none()
        if not ex:
            raise AppException(message="Exercise not found", code="NOT_FOUND", status_code=404)

        if payload.title is not None:
            ex.title = payload.title
        if payload.prompt is not None:
            ex.prompt = payload.prompt
        if payload.category is not None:
            ex.category = payload.category
        if payload.level is not None:
            ex.level = payload.level
        if payload.difficulty is not None:
            ex.difficulty = payload.difficulty
        if payload.question_type is not None:
            ex.question_type = payload.question_type
        if payload.instructions is not None:
            ex.instructions = payload.instructions
        if payload.explanation is not None:
            ex.explanation = payload.explanation
        if payload.points is not None:
            ex.points = payload.points
        if payload.options_payload is not None:
            ex.options_payload = payload.options_payload
        if payload.status is not None:
            ex.status = payload.status.value
            ex.is_published = (payload.status == ContentStatus.PUBLISHED)

        if payload.task_type_id is not None:
            ex.task_type_id = payload.task_type_id

        # Support new skill_tags (canonical) with fallback to legacy skill_ids
        new_skill_tags = getattr(payload, "skill_tags", None)
        if new_skill_tags is not None:
            from app.modules.admin.enums import SkillTagRole
            from app.modules.admin.tagging_service import TaggingValidationEngine
            await TaggingValidationEngine.validate_skill_tags(
                db=db,
                tags=new_skill_tags,
                task_type_id=ex.task_type_id,
            )
            await db.execute(delete(ExerciseSkill).where(ExerciseSkill.exercise_id == exercise_id))
            for tag in new_skill_tags:
                role_val = getattr(tag, "role", "primary")
                db.add(ExerciseSkill(
                    exercise_id=ex.id,
                    skill_id=tag.skill_id,
                    subskill_id=getattr(tag, "subskill_id", None),
                    subskill=tag.subskill,
                    role=SkillTagRole(role_val) if isinstance(role_val, str) else role_val,
                    weight=tag.weight,
                    context=getattr(tag, "context", None),
                ))
        elif payload.skill_ids is not None:
            # Legacy path
            await db.execute(delete(ExerciseSkill).where(ExerciseSkill.exercise_id == exercise_id))
            for sk_id in payload.skill_ids:
                db.add(ExerciseSkill(exercise_id=ex.id, skill_id=sk_id, weight=1.0))

        ex.updated_by_user_id = actor_id
        ex.updated_at = datetime.datetime.now(datetime.UTC)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.UPDATE,
            entity_type="exercise",
            entity_id=ex.id,
            payload={"title": ex.title, "status": ex.status},
        )
        return ex

    @staticmethod
    async def publish_exercise(
        db: AsyncSession,
        exercise_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
    ) -> Exercise:
        stmt = select(Exercise).where(Exercise.id == exercise_id)
        ex = (await db.execute(stmt)).scalar_one_or_none()
        if not ex:
            raise AppException(message="Exercise not found", code="NOT_FOUND", status_code=404)

        if not ex.prompt or not ex.prompt.strip():
            raise AppException(message="Exercise prompt cannot be empty", code="VALIDATION_FAILED", status_code=422)

        # Record immutable snapshot
        ver = ExerciseVersion(
            exercise_id=ex.id,
            version=ex.version,
            title=ex.title,
            instructions=ex.instructions,
            category=ex.category.value,
            level=ex.level,
            difficulty=ex.difficulty,
            prompt=ex.prompt,
            explanation=ex.explanation,
            points=ex.points,
            options_payload=ex.options_payload or [],
            created_by_user_id=actor_id,
            created_at=datetime.datetime.now(datetime.UTC),
        )
        db.add(ver)

        ex.status = ContentStatus.PUBLISHED.value
        ex.is_published = True
        ex.updated_by_user_id = actor_id
        ex.updated_at = datetime.datetime.now(datetime.UTC)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.PUBLISH,
            entity_type="exercise",
            entity_id=ex.id,
            payload={"title": ex.title, "version": ex.version},
        )
        return ex

    @staticmethod
    async def fork_new_exercise_version(
        db: AsyncSession,
        exercise_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
    ) -> Exercise:
        stmt = select(Exercise).where(Exercise.id == exercise_id)
        ex = (await db.execute(stmt)).scalar_one_or_none()
        if not ex:
            raise AppException(message="Exercise not found", code="NOT_FOUND", status_code=404)

        ex.version += 1
        ex.status = ContentStatus.DRAFT.value
        ex.is_published = False
        ex.updated_by_user_id = actor_id
        ex.updated_at = datetime.datetime.now(datetime.UTC)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action="content.fork_version",
            entity_type="exercise",
            entity_id=ex.id,
            payload={"new_version": ex.version},
        )
        return ex

    @staticmethod
    async def list_exercise_versions(db: AsyncSession, exercise_id: uuid.UUID) -> list[ExerciseVersion]:
        stmt = (
            select(ExerciseVersion)
            .where(ExerciseVersion.exercise_id == exercise_id)
            .order_by(ExerciseVersion.version.desc())
        )
        return list((await db.execute(stmt)).scalars().all())

    @staticmethod
    async def list_exercises(
        db: AsyncSession,
        category: str | None = None,
        level: str | None = None,
        status: ContentStatus | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Exercise], int]:
        stmt = select(Exercise).order_by(Exercise.created_at.desc())
        if category:
            stmt = stmt.where(Exercise.category == category)
        if level:
            stmt = stmt.where(Exercise.level == level)
        if status:
            stmt = stmt.where(Exercise.status == status.value)

        count_stmt = select(func.count(Exercise.id))
        if category:
            count_stmt = count_stmt.where(Exercise.category == category)
        if level:
            count_stmt = count_stmt.where(Exercise.level == level)
        if status:
            count_stmt = count_stmt.where(Exercise.status == status.value)

        total = (await db.execute(count_stmt)).scalar() or 0
        paged = stmt.offset((page - 1) * page_size).limit(page_size)
        items = list((await db.execute(paged)).scalars().all())
        return items, total

    # --- Writing Tasks ---

    @staticmethod
    async def create_writing_task(
        db: AsyncSession,
        payload: AdminWritingTaskCreate,
        actor_id: uuid.UUID | None = None,
    ) -> WritingTask:
        """Create TEF writing task prompt."""
        now = datetime.datetime.now(datetime.UTC)
        task = WritingTask(
            title=payload.title,
            task_type=payload.task_type,
            prompt=payload.prompt,
            stimulus_text=payload.stimulus_text,
            min_words=payload.min_words,
            max_words=payload.max_words,
            duration_minutes=payload.duration_minutes,
            target_level=payload.target_level,
            status=payload.status.value,
            version=1,
            is_published=(payload.status == ContentStatus.PUBLISHED),
            created_by_user_id=actor_id,
            updated_by_user_id=actor_id,
            created_at=now,
            updated_at=now,
        )
        db.add(task)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.CREATE,
            entity_type="writing_task",
            entity_id=task.id,
            payload={"title": task.title, "type": task.task_type.value, "status": task.status},
        )
        return task

    @staticmethod
    async def update_writing_task(
        db: AsyncSession,
        writing_task_id: uuid.UUID,
        payload: AdminWritingTaskUpdate,
        actor_id: uuid.UUID | None = None,
    ) -> WritingTask:
        stmt = select(WritingTask).where(WritingTask.id == writing_task_id)
        task = (await db.execute(stmt)).scalar_one_or_none()
        if not task:
            raise AppException(message="Writing task not found", code="NOT_FOUND", status_code=404)

        if payload.title is not None:
            task.title = payload.title
        if payload.task_type is not None:
            task.task_type = payload.task_type
        if payload.prompt is not None:
            task.prompt = payload.prompt
        if payload.stimulus_text is not None:
            task.stimulus_text = payload.stimulus_text
        if payload.min_words is not None:
            task.min_words = payload.min_words
        if payload.max_words is not None:
            task.max_words = payload.max_words
        if payload.duration_minutes is not None:
            task.duration_minutes = payload.duration_minutes
        if payload.target_level is not None:
            task.target_level = payload.target_level
        if payload.status is not None:
            task.status = payload.status.value
            task.is_published = (payload.status == ContentStatus.PUBLISHED)

        task.updated_by_user_id = actor_id
        task.updated_at = datetime.datetime.now(datetime.UTC)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.UPDATE,
            entity_type="writing_task",
            entity_id=task.id,
            payload={"title": task.title, "status": task.status},
        )
        return task

    @staticmethod
    async def publish_writing_task(
        db: AsyncSession,
        writing_task_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
    ) -> WritingTask:
        stmt = select(WritingTask).where(WritingTask.id == writing_task_id)
        task = (await db.execute(stmt)).scalar_one_or_none()
        if not task:
            raise AppException(message="Writing task not found", code="NOT_FOUND", status_code=404)

        if not task.prompt or not task.prompt.strip():
            raise AppException(message="Prompt cannot be empty", code="VALIDATION_FAILED", status_code=422)
        if task.min_words <= 0 or task.max_words < task.min_words:
            raise AppException(message="Invalid word count constraints", code="VALIDATION_FAILED", status_code=422)

        ver = WritingTaskVersion(
            writing_task_id=task.id,
            version=task.version,
            title=task.title,
            instructions="",
            prompt=task.prompt,
            task_type=task.task_type.value,
            level=task.target_level,
            min_words=task.min_words,
            max_words=task.max_words,
            duration_minutes=task.duration_minutes,
            evaluation_criteria=[],
            created_by_user_id=actor_id,
            created_at=datetime.datetime.now(datetime.UTC),
        )
        db.add(ver)

        task.status = ContentStatus.PUBLISHED.value
        task.is_published = True
        task.updated_by_user_id = actor_id
        task.updated_at = datetime.datetime.now(datetime.UTC)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.PUBLISH,
            entity_type="writing_task",
            entity_id=task.id,
            payload={"title": task.title, "version": task.version},
        )
        return task

    @staticmethod
    async def fork_new_writing_task_version(
        db: AsyncSession,
        writing_task_id: uuid.UUID,
        actor_id: uuid.UUID | None = None,
    ) -> WritingTask:
        stmt = select(WritingTask).where(WritingTask.id == writing_task_id)
        task = (await db.execute(stmt)).scalar_one_or_none()
        if not task:
            raise AppException(message="Writing task not found", code="NOT_FOUND", status_code=404)

        task.version += 1
        task.status = ContentStatus.DRAFT.value
        task.is_published = False
        task.updated_by_user_id = actor_id
        task.updated_at = datetime.datetime.now(datetime.UTC)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action="content.fork_version",
            entity_type="writing_task",
            entity_id=task.id,
            payload={"new_version": task.version},
        )
        return task

    @staticmethod
    async def list_writing_task_versions(db: AsyncSession, writing_task_id: uuid.UUID) -> list[WritingTaskVersion]:
        stmt = (
            select(WritingTaskVersion)
            .where(WritingTaskVersion.writing_task_id == writing_task_id)
            .order_by(WritingTaskVersion.version.desc())
        )
        return list((await db.execute(stmt)).scalars().all())

    @staticmethod
    async def list_writing_tasks(
        db: AsyncSession,
        level: str | None = None,
        status: ContentStatus | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[WritingTask], int]:
        stmt = select(WritingTask).order_by(WritingTask.created_at.desc())
        if level:
            stmt = stmt.where(WritingTask.target_level == level)
        if status:
            stmt = stmt.where(WritingTask.status == status.value)

        count_stmt = select(func.count(WritingTask.id))
        if level:
            count_stmt = count_stmt.where(WritingTask.target_level == level)
        if status:
            count_stmt = count_stmt.where(WritingTask.status == status.value)

        total = (await db.execute(count_stmt)).scalar() or 0
        paged = stmt.offset((page - 1) * page_size).limit(page_size)
        items = list((await db.execute(paged)).scalars().all())
        return items, total

    # --- Content Review Workflow ---

    @staticmethod
    async def submit_for_review(
        db: AsyncSession,
        entity_type: str,
        entity_id: uuid.UUID,
        comments: str | None = None,
        actor_id: uuid.UUID | None = None,
    ) -> ContentReview:
        """Submit draft content for editorial peer review."""
        version = 1

        if entity_type == "assessment":
            asmt = (await db.execute(select(Assessment).where(Assessment.id == entity_id))).scalar_one_or_none()
            if not asmt:
                raise AppException(message="Assessment not found", code="NOT_FOUND", status_code=404)
            asmt.status = ContentStatus.IN_REVIEW.value
            version = asmt.version
        elif entity_type == "exercise":
            ex = (await db.execute(select(Exercise).where(Exercise.id == entity_id))).scalar_one_or_none()
            if not ex:
                raise AppException(message="Exercise not found", code="NOT_FOUND", status_code=404)
            ex.status = ContentStatus.IN_REVIEW.value
            version = ex.version
        elif entity_type == "writing_task":
            wt = (await db.execute(select(WritingTask).where(WritingTask.id == entity_id))).scalar_one_or_none()
            if not wt:
                raise AppException(message="Writing task not found", code="NOT_FOUND", status_code=404)
            wt.status = ContentStatus.IN_REVIEW.value
            version = wt.version
        elif entity_type == "question":
            from app.modules.admin.question_lifecycle_service import QuestionLifecycleService
            q = await QuestionLifecycleService.submit_for_review(db, entity_id, actor_id, comments)
            version = q.version
        else:
            raise AppException(message=f"Unsupported entity type for review: {entity_type}", code="INVALID_TYPE", status_code=400)

        now = datetime.datetime.now(datetime.UTC)
        review = ContentReview(
            entity_type=entity_type,
            entity_id=entity_id,
            version=version,
            status=ReviewStatus.PENDING.value,
            comments=comments,
            created_at=now,
            updated_at=now,
        )
        db.add(review)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action="content.review_submitted",
            entity_type=entity_type,
            entity_id=entity_id,
            payload={"version": version, "comments": comments},
        )
        return review

    @staticmethod
    async def review_decision(
        db: AsyncSession,
        review_id: uuid.UUID,
        decision: ContentReviewDecision,
        reviewer_id: uuid.UUID | None = None,
    ) -> ContentReview:
        """Approve or reject content in review."""
        stmt = select(ContentReview).where(ContentReview.id == review_id)
        rev = (await db.execute(stmt)).scalar_one_or_none()
        if not rev:
            raise AppException(message="Content review not found", code="NOT_FOUND", status_code=404)

        rev.status = decision.status.value
        rev.reviewer_id = reviewer_id
        if decision.comments:
            rev.comments = decision.comments
        rev.updated_at = datetime.datetime.now(datetime.UTC)

        # Update entity status accordingly
        target_status = ContentStatus.PUBLISHED.value if decision.status == ReviewStatus.APPROVED else ContentStatus.DRAFT.value

        if rev.entity_type == "assessment":
            asmt = (await db.execute(select(Assessment).where(Assessment.id == rev.entity_id))).scalar_one_or_none()
            if asmt:
                if decision.status == ReviewStatus.APPROVED:
                    await AdminContentService.publish_assessment(db, asmt.id, reviewer_id)
                else:
                    asmt.status = target_status
                    asmt.updated_at = datetime.datetime.now(datetime.UTC)
        elif rev.entity_type == "exercise":
            ex = (await db.execute(select(Exercise).where(Exercise.id == rev.entity_id))).scalar_one_or_none()
            if ex:
                if decision.status == ReviewStatus.APPROVED:
                    await AdminContentService.publish_exercise(db, ex.id, reviewer_id)
                else:
                    ex.status = target_status
                    ex.updated_at = datetime.datetime.now(datetime.UTC)
        elif rev.entity_type == "writing_task":
            wt = (await db.execute(select(WritingTask).where(WritingTask.id == rev.entity_id))).scalar_one_or_none()
            if wt:
                if decision.status == ReviewStatus.APPROVED:
                    await AdminContentService.publish_writing_task(db, wt.id, reviewer_id)
                else:
                    wt.status = target_status
                    wt.updated_at = datetime.datetime.now(datetime.UTC)
        elif rev.entity_type == "question":
            from app.modules.admin.question_lifecycle_service import QuestionLifecycleService
            if decision.status == ReviewStatus.APPROVED:
                await QuestionLifecycleService.approve_question(db, rev.entity_id, reviewer_id, notes=decision.comments)
            else:
                await QuestionLifecycleService.reject_question(db, rev.entity_id, reviewer_id, notes=decision.comments)

        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=reviewer_id,
            action="content.reviewed",
            entity_type=rev.entity_type,
            entity_id=rev.entity_id,
            payload={"decision": decision.status.value, "comments": decision.comments},
        )
        return rev

    @staticmethod
    async def list_reviews(
        db: AsyncSession,
        status_filter: str | None = None,
        entity_type: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[ContentReview], int]:
        stmt = select(ContentReview).order_by(ContentReview.created_at.desc())
        if status_filter:
            stmt = stmt.where(ContentReview.status == status_filter)
        if entity_type:
            stmt = stmt.where(ContentReview.entity_type == entity_type)

        count_stmt = select(func.count(ContentReview.id))
        if status_filter:
            count_stmt = count_stmt.where(ContentReview.status == status_filter)
        if entity_type:
            count_stmt = count_stmt.where(ContentReview.entity_type == entity_type)

        total = (await db.execute(count_stmt)).scalar() or 0
        paged = stmt.offset((page - 1) * page_size).limit(page_size)
        items = list((await db.execute(paged)).scalars().all())
        return items, total

    # --- User Management & Role Changes ---

    @staticmethod
    async def update_user_role(
        db: AsyncSession,
        target_user_id: uuid.UUID,
        new_role: UserRole,
        actor_id: uuid.UUID | None = None,
    ) -> User:
        """Change user role with mandatory security audit trail."""
        stmt = select(User).where(User.id == target_user_id)
        user = (await db.execute(stmt)).scalar_one_or_none()
        if not user:
            raise AppException(message="User not found", code="NOT_FOUND", status_code=404)

        old_role = user.role
        user.role = new_role
        user.updated_at = datetime.datetime.now(datetime.UTC)
        await db.flush()

        await AuditService.log_event(
            db=db,
            actor_user_id=actor_id,
            action=AuditAction.ROLE_CHANGE,
            entity_type="user",
            entity_id=user.id,
            payload={"old_role": old_role.value, "new_role": new_role.value},
        )
        return user
