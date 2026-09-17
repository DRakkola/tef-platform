"""Service layer for Admin Content Management, Media Assets, and Audit Logging."""

import datetime
import uuid
from typing import Any

import structlog
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import AppException
from app.core.storage import StorageService
from app.modules.admin.enums import AuditAction, ContentStatus, MediaType
from app.modules.admin.models import AuditEvent, MediaAsset
from app.modules.admin.schemas import (
    AdminAssessmentCreate,
    AdminAssessmentUpdate,
    AdminExerciseCreate,
    AdminOptionCreate,
    AdminQuestionCreate,
    AdminSectionCreate,
    AdminSkillCreate,
    AdminWritingTaskCreate,
)
from app.modules.assessments.models import (
    Assessment,
    AssessmentSection,
    Attempt,
    Question,
    QuestionOption,
    QuestionSkillTag,
    Skill,
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

    @staticmethod
    async def upload_asset(
        db: AsyncSession,
        title: str,
        media_type: MediaType,
        file_bytes: bytes,
        filename: str,
        content_type: str,
        uploader_id: uuid.UUID | None,
        storage: StorageService,
    ) -> MediaAsset:
        """Save media to MinIO and register metadata record."""
        # Generate private server-controlled key: media/{uuid}/{sanitized_name}
        clean_name = "".join(c for c in filename if c.isalnum() or c in "._- ")[:100]
        object_key = f"media/{uuid.uuid4()}/{clean_name}"

        # Upload private object to MinIO
        storage.upload_bytes(
            object_name=object_key,
            data=file_bytes,
            content_type=content_type,
        )

        now = datetime.datetime.now(datetime.UTC)
        asset = MediaAsset(
            title=title,
            filename=filename,
            content_type=content_type,
            file_size=len(file_bytes),
            storage_object_key=object_key,
            media_type=media_type,
            is_public=False,
            uploaded_by_user_id=uploader_id,
            created_at=now,
            updated_at=now,
        )
        db.add(asset)
        await db.flush()

        logger.info(
            "media_asset_uploaded",
            asset_id=str(asset.id),
            media_type=media_type.value,
            size=asset.file_size,
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

        url = storage.get_presigned_url(
            object_name=asset.storage_object_key,
            expires_in_seconds=expires_in_seconds,
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
        """Update assessment. If already published and attempts exist, version is incremented for reproducibility."""
        asmt = await AdminContentService.get_assessment_with_tree(db, assessment_id)

        # Check if attempts exist under this assessment
        attempt_count_stmt = select(func.count(Attempt.id)).where(Attempt.assessment_id == assessment_id)
        has_attempts = ((await db.execute(attempt_count_stmt)).scalar() or 0) > 0

        # If published and has historical attempts, increment version
        if asmt.status == ContentStatus.PUBLISHED.value and has_attempts:
            asmt.version += 1
            logger.info("assessment_version_bumped", assessment_id=str(asmt.id), new_version=asmt.version)

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
    async def transition_assessment_lifecycle(
        db: AsyncSession,
        assessment_id: uuid.UUID,
        new_status: ContentStatus,
        actor_id: uuid.UUID | None = None,
    ) -> Assessment:
        """Explicitly transition content lifecycle (draft -> review -> published -> archived)."""
        stmt = select(Assessment).where(Assessment.id == assessment_id)
        asmt = (await db.execute(stmt)).scalar_one_or_none()
        if not asmt:
            raise AppException(message="Assessment not found", code="NOT_FOUND", status_code=404)

        old_status = asmt.status
        asmt.status = new_status.value
        asmt.is_published = (new_status == ContentStatus.PUBLISHED)
        asmt.updated_at = datetime.datetime.now(datetime.UTC)
        await db.flush()

        action = AuditAction.PUBLISH if new_status == ContentStatus.PUBLISHED else (
            AuditAction.ARCHIVE if new_status == ContentStatus.ARCHIVED else AuditAction.UPDATE
        )
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
                selectinload(Assessment.sections).selectinload(AssessmentSection.questions).selectinload(Question.options)
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
        asmt = await AdminContentService.get_assessment_with_tree(db, assessment_id)
        now = datetime.datetime.now(datetime.UTC)
        sec = AssessmentSection(
            assessment_id=assessment_id,
            title=payload.title,
            instructions=payload.instructions,
            order_index=payload.order_index,
            time_limit_seconds=payload.time_limit_seconds,
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
            question_type=payload.question_type,
            prompt=payload.prompt,
            stimulus_text=payload.stimulus_text,
            audio_url=payload.audio_url,
            media_url=payload.media_url,
            order_index=payload.order_index,
            difficulty=payload.difficulty,
            explanation=payload.explanation,
            points=payload.points,
            penalty_points=payload.penalty_points,
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
                created_at=now,
                updated_at=now,
            )
            db.add(q_opt)

        for tag in payload.skill_tags:
            q_tag = QuestionSkillTag(
                question_id=q.id,
                skill_id=tag.skill_id,
                subskill=tag.subskill,
                weight=tag.weight,
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
            payload={"section_id": str(section_id), "prompt": q.prompt[:50]},
        )
        return q

    # --- Skills Taxonomy ---

    @staticmethod
    async def create_skill(
        db: AsyncSession,
        payload: AdminSkillCreate,
        actor_id: uuid.UUID | None = None,
    ) -> Skill:
        """Create skill or subskill."""
        now = datetime.datetime.now(datetime.UTC)
        skill = Skill(
            code=payload.code,
            name=payload.name,
            category=payload.category,
            description=payload.description,
            parent_id=payload.parent_id,
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
            payload={"code": skill.code, "name": skill.name},
        )
        return skill

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
            created_at=now,
            updated_at=now,
        )
        db.add(ex)
        await db.flush()

        for sk_id in payload.skill_ids:
            es = ExerciseSkill(
                exercise_id=ex.id,
                skill_id=sk_id,
                weight=1.0,
            )
            db.add(es)

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
