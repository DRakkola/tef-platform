"""FastAPI Router for administrative content management, media, audit logs, and RBAC."""

import uuid
from typing import Annotated, Any

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Path,
    Query,
    UploadFile,
    status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import AppException
from app.core.storage import StorageService, get_storage
from app.modules.admin.enums import ContentStatus, MediaType
from app.modules.admin.schemas import (
    AdminAssessmentCreate,
    AdminAssessmentListResponse,
    AdminAssessmentResponse,
    AdminAssessmentUpdate,
    AdminExerciseCreate,
    AdminExerciseListResponse,
    AdminExerciseResponse,
    AdminExerciseUpdate,
    AdminQuestionCreate,
    AdminQuestionListResponse,
    AdminQuestionResponse,
    AdminSectionCreate,
    AdminSectionResponse,
    AdminSkillCreate,
    AdminSkillMetricsSummary,
    AdminSkillResponse,
    AdminSkillUpdate,
    AdminStandaloneQuestionUpdate,
    AdminUserRoleUpdate,
    AdminWritingTaskCreate,
    AdminWritingTaskListResponse,
    AdminWritingTaskResponse,
    AdminWritingTaskUpdate,
    AssessmentVersionResponse,
    AuditEventResponse,
    AuditLogListResponse,
    ContentReviewCreate,
    ContentReviewDecision,
    ContentReviewListResponse,
    ContentReviewResponse,
    ExerciseVersionResponse,
    MediaAssetListResponse,
    MediaAssetResponse,
    MediaPresignedUrlResponse,
    PublishValidationResponse,
    QuestionVersionResponse,
    SubSkillCreate,
    SubSkillResponse,
    SubSkillUpdate,
    WritingTaskVersionResponse,
)
from app.modules.admin.service import (
    AdminContentService,
    AuditService,
    MediaAssetService,
    PublishingValidationEngine,
    SubSkillService,
)
from app.modules.assessments.enums import QuestionType
from app.modules.auth.dependencies import require_role
from app.modules.learning.models import Exercise
from app.modules.users.models import User, UserRole
from app.modules.users.schemas import UserResponse
from app.modules.writing.models import WritingTask

router = APIRouter(prefix="/admin", tags=["Admin"])


# ---------------------------------------------------------------------------
# System & Audit Logging Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/system-overview",
    summary="Admin system overview metrics",
)
async def get_admin_system_overview(
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> dict[str, Any]:
    """Administrative overview endpoint restricted strictly to admin role."""
    return {
        "status": "operational",
        "restricted": True,
        "access": "admin_granted",
        "environment": "production-ready",
    }


@router.get(
    "/audit-logs",
    response_model=AuditLogListResponse,
    summary="List immutable system audit logs",
)
async def list_audit_logs(
    action: str | None = Query(None, description="Filter by action: CREATE, UPDATE, ROLE_CHANGE, etc."),
    entity_type: str | None = Query(None, description="Filter by entity type: assessment, user, etc."),
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> AuditLogListResponse:
    """Query audit logs with pagination and filters."""
    items, total = await AuditService.list_logs(
        db=db,
        action=action,
        entity_type=entity_type,
        page=page,
        page_size=page_size,
    )
    return AuditLogListResponse(
        items=[AuditEventResponse.model_validate(it) for it in items],
        total=total,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------------------------
# Media Asset Management (MinIO Private Storage)
# ---------------------------------------------------------------------------


@router.post(
    "/media/upload",
    response_model=MediaAssetResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload media asset (listening audio, exam diagram) to private storage",
)
async def upload_media_asset(
    file: UploadFile = File(...),
    title: str = Form(...),
    media_type: MediaType = Form(MediaType.AUDIO),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
    storage: StorageService = Depends(get_storage),
) -> MediaAssetResponse:
    # Enforce beta quota limits
    from app.core.beta_limits import BetaLimitsService
    await BetaLimitsService.check_and_increment(current_admin.id, "file_upload")

    content_bytes = await file.read()
    asset = await MediaAssetService.upload_asset(
        db=db,
        title=title,
        media_type=media_type,
        file_bytes=content_bytes,
        filename=file.filename or "media_file",
        content_type=file.content_type or "application/octet-stream",
        uploader_id=current_admin.id,
        storage=storage,
    )
    return MediaAssetResponse.model_validate(asset)


@router.get(
    "/media",
    response_model=MediaAssetListResponse,
    summary="List media assets in library",
)
async def list_media_assets(
    media_type: MediaType | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> MediaAssetListResponse:
    """Retrieve catalog of uploaded media assets."""
    items, total = await MediaAssetService.list_assets(
        db=db,
        media_type=media_type,
        page=page,
        page_size=page_size,
    )
    return MediaAssetListResponse(
        items=[MediaAssetResponse.model_validate(a) for a in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/media/{asset_id}/presigned-url",
    response_model=MediaPresignedUrlResponse,
    summary="Get temporary presigned URL for private asset",
)
async def get_media_presigned_url(
    asset_id: uuid.UUID,
    expires_in: Annotated[int, Query(ge=60, le=86400)] = 3600,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
    storage: StorageService = Depends(get_storage),
) -> MediaPresignedUrlResponse:
    """Generate time-limited presigned URL without revealing MinIO credentials."""
    url = await MediaAssetService.get_presigned_download_url(
        db=db,
        asset_id=asset_id,
        storage=storage,
        expires_in_seconds=expires_in,
    )
    return MediaPresignedUrlResponse(
        asset_id=asset_id,
        download_url=url,
        expires_in_seconds=expires_in,
    )


@router.delete(
    "/media/{asset_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete media asset from library",
)
async def delete_media_asset(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
    storage: StorageService = Depends(get_storage),
) -> None:
    await MediaAssetService.delete_asset(
        db=db,
        asset_id=asset_id,
        storage=storage,
        actor_id=current_admin.id,
    )


# ---------------------------------------------------------------------------
# Assessment Content Lifecycle, Validation & Versioning
# ---------------------------------------------------------------------------


@router.post(
    "/content/assessments",
    response_model=AdminAssessmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create assessment draft",
)
async def create_assessment(
    payload: AdminAssessmentCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminAssessmentResponse:
    asmt = await AdminContentService.create_assessment(
        db=db,
        payload=payload,
        actor_id=current_admin.id,
    )
    return AdminAssessmentResponse.model_validate(asmt)


@router.get(
    "/content/assessments",
    response_model=AdminAssessmentListResponse,
    summary="List assessments for administration",
)
async def list_admin_assessments(
    status_filter: ContentStatus | None = Query(None, alias="status"),
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminAssessmentListResponse:
    items, total = await AdminContentService.list_admin_assessments(
        db=db,
        status_filter=status_filter,
        page=page,
        page_size=page_size,
    )
    return AdminAssessmentListResponse(
        items=[AdminAssessmentResponse.model_validate(it) for it in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/content/assessments/{assessment_id}",
    response_model=AdminAssessmentResponse,
    summary="Get full assessment content tree",
)
async def get_admin_assessment_detail(
    assessment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminAssessmentResponse:
    asmt = await AdminContentService.get_assessment_with_tree(db=db, assessment_id=assessment_id)
    return AdminAssessmentResponse.model_validate(asmt)


@router.put(
    "/content/assessments/{assessment_id}",
    response_model=AdminAssessmentResponse,
    summary="Update assessment (requires draft or will reject if published with attempts)",
)
async def update_assessment(
    assessment_id: uuid.UUID,
    payload: AdminAssessmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminAssessmentResponse:
    asmt = await AdminContentService.update_assessment(
        db=db,
        assessment_id=assessment_id,
        payload=payload,
        actor_id=current_admin.id,
    )
    return AdminAssessmentResponse.model_validate(asmt)


@router.post(
    "/content/assessments/{assessment_id}/validate",
    response_model=PublishValidationResponse,
    summary="Run validation engine on assessment before publication",
)
async def validate_assessment(
    assessment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> PublishValidationResponse:
    is_valid, errors, warnings = await PublishingValidationEngine.validate_assessment(db, assessment_id)
    return PublishValidationResponse(
        is_valid=is_valid,
        errors=errors,
        warnings=warnings,
    )


@router.post(
    "/content/assessments/{assessment_id}/publish",
    response_model=AdminAssessmentResponse,
    summary="Publish assessment with validation and snapshot versioning",
)
async def publish_assessment(
    assessment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminAssessmentResponse:
    asmt = await AdminContentService.publish_assessment(
        db=db,
        assessment_id=assessment_id,
        actor_id=current_admin.id,
    )
    return AdminAssessmentResponse.model_validate(asmt)


@router.post(
    "/content/assessments/{assessment_id}/archive",
    response_model=AdminAssessmentResponse,
    summary="Archive assessment",
)
async def archive_assessment(
    assessment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminAssessmentResponse:
    asmt = await AdminContentService.transition_assessment_lifecycle(
        db=db,
        assessment_id=assessment_id,
        new_status=ContentStatus.ARCHIVED,
        actor_id=current_admin.id,
    )
    return AdminAssessmentResponse.model_validate(asmt)


@router.post(
    "/content/assessments/{assessment_id}/new-version",
    response_model=AdminAssessmentResponse,
    summary="Fork a new draft version from published assessment",
)
async def fork_assessment_version(
    assessment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminAssessmentResponse:
    asmt = await AdminContentService.fork_new_assessment_version(
        db=db,
        assessment_id=assessment_id,
        actor_id=current_admin.id,
    )
    return AdminAssessmentResponse.model_validate(asmt)


@router.get(
    "/content/assessments/{assessment_id}/versions",
    response_model=list[AssessmentVersionResponse],
    summary="List immutable historical snapshot versions of assessment",
)
async def list_assessment_versions(
    assessment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> list[AssessmentVersionResponse]:
    versions = await AdminContentService.list_assessment_versions(db, assessment_id)
    return [AssessmentVersionResponse.model_validate(v) for v in versions]


@router.post(
    "/content/assessments/{assessment_id}/sections",
    response_model=AdminSectionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add section to assessment",
)
async def add_assessment_section(
    assessment_id: uuid.UUID,
    payload: AdminSectionCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminSectionResponse:
    sec = await AdminContentService.add_section(
        db=db,
        assessment_id=assessment_id,
        payload=payload,
        actor_id=current_admin.id,
    )
    return AdminSectionResponse(
        id=sec.id,
        assessment_id=sec.assessment_id,
        title=sec.title,
        instructions=sec.instructions,
        order_index=sec.order_index,
        duration_seconds=sec.duration_seconds,
        time_limit_seconds=sec.duration_seconds,
        media_url=sec.media_url,
        passage_text=sec.passage_text,
        questions=[],
    )


# ---------------------------------------------------------------------------
# Questions Management & Versioning
# ---------------------------------------------------------------------------


@router.post(
    "/content/sections/{section_id}/questions",
    response_model=AdminQuestionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add question with options to section",
)
async def add_section_question(
    section_id: uuid.UUID,
    payload: AdminQuestionCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminQuestionResponse:
    q = await AdminContentService.add_question(
        db=db,
        section_id=section_id,
        payload=payload,
        actor_id=current_admin.id,
    )
    return AdminQuestionResponse.model_validate(q)


@router.get(
    "/content/questions",
    response_model=AdminQuestionListResponse,
    summary="List questions across sections",
)
async def list_questions(
    section_id: uuid.UUID | None = None,
    level: str | None = None,
    difficulty: int | None = None,
    question_type: QuestionType | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminQuestionListResponse:
    items, total = await AdminContentService.list_questions(
        db=db,
        section_id=section_id,
        level=level,
        difficulty=difficulty,
        question_type=question_type,
        page=page,
        page_size=page_size,
    )
    return AdminQuestionListResponse(
        items=[AdminQuestionResponse.model_validate(q) for q in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/content/questions/{question_id}",
    response_model=AdminQuestionResponse,
    summary="Get question detail with options",
)
async def get_question_detail(
    question_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminQuestionResponse:
    q = await AdminContentService.get_question(db, question_id)
    return AdminQuestionResponse.model_validate(q)


@router.put(
    "/content/questions/{question_id}",
    response_model=AdminQuestionResponse,
    summary="Update question content or options",
)
async def update_question(
    question_id: uuid.UUID,
    payload: AdminStandaloneQuestionUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminQuestionResponse:
    q = await AdminContentService.update_question(
        db=db,
        question_id=question_id,
        payload=payload,
        actor_id=current_admin.id,
    )
    return AdminQuestionResponse.model_validate(q)


@router.post(
    "/content/questions/{question_id}/new-version",
    response_model=AdminQuestionResponse,
    summary="Fork a new draft version of a question",
)
async def fork_question_version(
    question_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminQuestionResponse:
    q = await AdminContentService.fork_new_question_version(
        db=db,
        question_id=question_id,
        actor_id=current_admin.id,
    )
    return AdminQuestionResponse.model_validate(q)


@router.get(
    "/content/questions/{question_id}/versions",
    response_model=list[QuestionVersionResponse],
    summary="List question versions",
)
async def list_question_versions(
    question_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> list[QuestionVersionResponse]:
    versions = await AdminContentService.list_question_versions(db, question_id)
    return [QuestionVersionResponse.model_validate(v) for v in versions]


# ---------------------------------------------------------------------------
# Skills & Subskills Taxonomy
# ---------------------------------------------------------------------------


@router.get(
    "/content/skills/metrics/summary",
    response_model=AdminSkillMetricsSummary,
    summary="Get global taxonomy metrics, domain distribution, and integrity warnings",
)
async def get_skills_metrics_summary(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminSkillMetricsSummary:
    return await AdminContentService.get_metrics_summary(db)


@router.post(
    "/content/skills",
    response_model=AdminSkillResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Define a new skill in taxonomy",
)
async def create_skill(
    payload: AdminSkillCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminSkillResponse:
    skill, usage = await AdminContentService.create_skill(
        db=db,
        payload=payload,
        actor_id=current_admin.id,
    )
    return AdminSkillResponse(
        id=skill.id,
        code=skill.code,
        name=skill.name,
        category=skill.category.value if hasattr(skill.category, "value") and skill.category else (str(skill.category) if skill.category else None),
        description=skill.description,
        parent_id=skill.parent_id,
        is_active=skill.is_active,
        created_at=skill.created_at,
        updated_at=skill.updated_at,
        subskills=[],
        usage_counts=usage,
    )


@router.get(
    "/content/skills",
    response_model=list[AdminSkillResponse],
    summary="List skills with subskills and usage metrics",
)
async def list_skills(
    parent_id: uuid.UUID | None = None,
    q: str | None = None,
    category: str | None = None,
    is_active: bool | None = None,
    has_subskills: bool | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> list[AdminSkillResponse]:
    items = await AdminContentService.list_skills(
        db,
        parent_id=parent_id,
        q=q,
        category=category,
        is_active=is_active,
        has_subskills=has_subskills,
    )
    result = []
    for sk, usage in items:
        resp = AdminSkillResponse(
            id=sk.id,
            code=sk.code,
            name=sk.name,
            category=sk.category.value if hasattr(sk.category, "value") and sk.category else (str(sk.category) if sk.category else None),
            description=sk.description,
            parent_id=sk.parent_id,
            is_active=sk.is_active,
            created_at=sk.created_at,
            updated_at=sk.updated_at,
            subskills=[SubSkillResponse.model_validate(sub) for sub in (sk.subskills or [])],
            usage_counts=usage,
        )
        result.append(resp)
    return result


@router.get(
    "/content/skills/{skill_id}",
    response_model=AdminSkillResponse,
    summary="Get single skill details with subskills and relational usage stats",
)
async def get_skill(
    skill_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminSkillResponse:
    skill, usage = await AdminContentService.get_skill(db, skill_id)
    return AdminSkillResponse(
        id=skill.id,
        code=skill.code,
        name=skill.name,
        category=skill.category.value if hasattr(skill.category, "value") and skill.category else (str(skill.category) if skill.category else None),
        description=skill.description,
        parent_id=skill.parent_id,
        is_active=skill.is_active,
        created_at=skill.created_at,
        updated_at=skill.updated_at,
        subskills=[SubSkillResponse.model_validate(sub) for sub in (skill.subskills or [])],
        usage_counts=usage,
    )


@router.put(
    "/content/skills/{skill_id}",
    response_model=AdminSkillResponse,
    summary="Update parent skill node in taxonomy",
)
async def update_skill(
    skill_id: uuid.UUID,
    payload: AdminSkillUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminSkillResponse:
    skill, usage = await AdminContentService.update_skill(
        db=db,
        skill_id=skill_id,
        payload=payload,
        actor_id=current_admin.id,
    )
    return AdminSkillResponse(
        id=skill.id,
        code=skill.code,
        name=skill.name,
        category=skill.category.value if hasattr(skill.category, "value") and skill.category else (str(skill.category) if skill.category else None),
        description=skill.description,
        parent_id=skill.parent_id,
        is_active=skill.is_active,
        created_at=skill.created_at,
        updated_at=skill.updated_at,
        subskills=[SubSkillResponse.model_validate(sub) for sub in (skill.subskills or [])],
        usage_counts=usage,
    )


@router.delete(
    "/content/skills/{skill_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete parent skill only if safe and has no dependencies",
)
async def delete_skill(
    skill_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> None:
    await AdminContentService.delete_skill(
        db=db,
        skill_id=skill_id,
        actor_id=current_admin.id,
    )


@router.post(
    "/content/skills/{skill_id}/subskills",
    response_model=SubSkillResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create subskill under parent skill",
)
async def create_subskill(
    skill_id: uuid.UUID,
    payload: SubSkillCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> SubSkillResponse:
    sub = await SubSkillService.create_subskill(
        db=db,
        skill_id=skill_id,
        payload=payload,
        actor_id=current_admin.id,
    )
    return SubSkillResponse.model_validate(sub)


@router.get(
    "/content/skills/{skill_id}/subskills",
    response_model=list[SubSkillResponse],
    summary="List subskills for a skill",
)
async def list_subskills_for_skill(
    skill_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> list[SubSkillResponse]:
    subs = await SubSkillService.list_subskills(db, skill_id)
    return [SubSkillResponse.model_validate(s) for s in subs]


@router.put(
    "/content/subskills/{subskill_id}",
    response_model=SubSkillResponse,
    summary="Update subskill",
)
async def update_subskill(
    subskill_id: uuid.UUID,
    payload: SubSkillUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> SubSkillResponse:
    sub = await SubSkillService.update_subskill(
        db=db,
        subskill_id=subskill_id,
        payload=payload,
        actor_id=current_admin.id,
    )
    return SubSkillResponse.model_validate(sub)


@router.delete(
    "/content/subskills/{subskill_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete subskill",
)
async def delete_subskill(
    subskill_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> None:
    await SubSkillService.delete_subskill(
        db=db,
        subskill_id=subskill_id,
        actor_id=current_admin.id,
    )


@router.post(
    "/content/subskills/{subskill_id}/archive",
    response_model=SubSkillResponse,
    summary="Archive subskill safely without deleting educational history",
)
async def archive_subskill(
    subskill_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> SubSkillResponse:
    sub = await SubSkillService.archive_subskill(
        db=db,
        subskill_id=subskill_id,
        actor_id=current_admin.id,
    )
    return SubSkillResponse.model_validate(sub)


# ---------------------------------------------------------------------------
# Exercises Admin & Versioning
# ---------------------------------------------------------------------------


@router.post(
    "/content/exercises",
    response_model=AdminExerciseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create targeted practice exercise",
)
async def create_exercise(
    payload: AdminExerciseCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminExerciseResponse:
    ex = await AdminContentService.create_exercise(
        db=db,
        payload=payload,
        actor_id=current_admin.id,
    )
    return AdminExerciseResponse.model_validate(ex)


@router.get(
    "/content/exercises",
    response_model=AdminExerciseListResponse,
    summary="List exercises for management",
)
async def list_exercises(
    category: str | None = None,
    level: str | None = None,
    status_filter: ContentStatus | None = Query(None, alias="status"),
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminExerciseListResponse:
    items, total = await AdminContentService.list_exercises(
        db=db,
        category=category,
        level=level,
        status=status_filter,
        page=page,
        page_size=page_size,
    )
    return AdminExerciseListResponse(
        items=[AdminExerciseResponse.model_validate(e) for e in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/content/exercises/{exercise_id}",
    response_model=AdminExerciseResponse,
    summary="Get exercise detail",
)
async def get_exercise_detail(
    exercise_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminExerciseResponse:
    stmt = select(Exercise).where(Exercise.id == exercise_id)
    ex = (await db.execute(stmt)).scalar_one_or_none()
    if not ex:
        raise AppException(message="Exercise not found", code="NOT_FOUND", status_code=404)
    return AdminExerciseResponse.model_validate(ex)


@router.put(
    "/content/exercises/{exercise_id}",
    response_model=AdminExerciseResponse,
    summary="Update exercise",
)
async def update_exercise(
    exercise_id: uuid.UUID,
    payload: AdminExerciseUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminExerciseResponse:
    ex = await AdminContentService.update_exercise(
        db=db,
        exercise_id=exercise_id,
        payload=payload,
        actor_id=current_admin.id,
    )
    return AdminExerciseResponse.model_validate(ex)


@router.post(
    "/content/exercises/{exercise_id}/publish",
    response_model=AdminExerciseResponse,
    summary="Publish exercise with snapshot versioning",
)
async def publish_exercise(
    exercise_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminExerciseResponse:
    ex = await AdminContentService.publish_exercise(
        db=db,
        exercise_id=exercise_id,
        actor_id=current_admin.id,
    )
    return AdminExerciseResponse.model_validate(ex)


@router.post(
    "/content/exercises/{exercise_id}/new-version",
    response_model=AdminExerciseResponse,
    summary="Fork a new version of exercise",
)
async def fork_exercise_version(
    exercise_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminExerciseResponse:
    ex = await AdminContentService.fork_new_exercise_version(
        db=db,
        exercise_id=exercise_id,
        actor_id=current_admin.id,
    )
    return AdminExerciseResponse.model_validate(ex)


@router.get(
    "/content/exercises/{exercise_id}/versions",
    response_model=list[ExerciseVersionResponse],
    summary="List exercise snapshot versions",
)
async def list_exercise_versions(
    exercise_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> list[ExerciseVersionResponse]:
    versions = await AdminContentService.list_exercise_versions(db, exercise_id)
    return [ExerciseVersionResponse.model_validate(v) for v in versions]


# ---------------------------------------------------------------------------
# Writing Tasks Admin & Versioning
# ---------------------------------------------------------------------------


@router.post(
    "/content/writing-tasks",
    response_model=AdminWritingTaskResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create TEF writing task prompt",
)
async def create_writing_task(
    payload: AdminWritingTaskCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminWritingTaskResponse:
    task = await AdminContentService.create_writing_task(
        db=db,
        payload=payload,
        actor_id=current_admin.id,
    )
    return AdminWritingTaskResponse.model_validate(task)


@router.get(
    "/content/writing-tasks",
    response_model=AdminWritingTaskListResponse,
    summary="List writing tasks for management",
)
async def list_writing_tasks(
    level: str | None = None,
    status_filter: ContentStatus | None = Query(None, alias="status"),
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminWritingTaskListResponse:
    items, total = await AdminContentService.list_writing_tasks(
        db=db,
        level=level,
        status=status_filter,
        page=page,
        page_size=page_size,
    )
    return AdminWritingTaskListResponse(
        items=[AdminWritingTaskResponse.model_validate(t) for t in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/content/writing-tasks/{task_id}",
    response_model=AdminWritingTaskResponse,
    summary="Get writing task detail",
)
async def get_writing_task_detail(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminWritingTaskResponse:
    stmt = select(WritingTask).where(WritingTask.id == task_id)
    task = (await db.execute(stmt)).scalar_one_or_none()
    if not task:
        raise AppException(message="Writing task not found", code="NOT_FOUND", status_code=404)
    return AdminWritingTaskResponse.model_validate(task)


@router.put(
    "/content/writing-tasks/{task_id}",
    response_model=AdminWritingTaskResponse,
    summary="Update writing task",
)
async def update_writing_task(
    task_id: uuid.UUID,
    payload: AdminWritingTaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminWritingTaskResponse:
    task = await AdminContentService.update_writing_task(
        db=db,
        writing_task_id=task_id,
        payload=payload,
        actor_id=current_admin.id,
    )
    return AdminWritingTaskResponse.model_validate(task)


@router.post(
    "/content/writing-tasks/{task_id}/publish",
    response_model=AdminWritingTaskResponse,
    summary="Publish writing task with snapshot versioning",
)
async def publish_writing_task(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminWritingTaskResponse:
    task = await AdminContentService.publish_writing_task(
        db=db,
        writing_task_id=task_id,
        actor_id=current_admin.id,
    )
    return AdminWritingTaskResponse.model_validate(task)


@router.post(
    "/content/writing-tasks/{task_id}/new-version",
    response_model=AdminWritingTaskResponse,
    summary="Fork new version of writing task",
)
async def fork_writing_task_version(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> AdminWritingTaskResponse:
    task = await AdminContentService.fork_new_writing_task_version(
        db=db,
        writing_task_id=task_id,
        actor_id=current_admin.id,
    )
    return AdminWritingTaskResponse.model_validate(task)


@router.get(
    "/content/writing-tasks/{task_id}/versions",
    response_model=list[WritingTaskVersionResponse],
    summary="List writing task snapshot versions",
)
async def list_writing_task_versions(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> list[WritingTaskVersionResponse]:
    versions = await AdminContentService.list_writing_task_versions(db, task_id)
    return [WritingTaskVersionResponse.model_validate(v) for v in versions]


# ---------------------------------------------------------------------------
# Content Review Workflow Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/content/{entity_type}/{entity_id}/submit-review",
    response_model=ContentReviewResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit content for editorial peer review",
)
async def submit_content_for_review(
    entity_type: str = Path(..., description="assessment, exercise, writing_task, or question"),
    entity_id: uuid.UUID = Path(...),
    payload: ContentReviewCreate = ContentReviewCreate(),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> ContentReviewResponse:
    review = await AdminContentService.submit_for_review(
        db=db,
        entity_type=entity_type,
        entity_id=entity_id,
        comments=payload.comments,
        actor_id=current_admin.id,
    )
    return ContentReviewResponse.model_validate(review)


@router.get(
    "/content/reviews",
    response_model=ContentReviewListResponse,
    summary="List content reviews in editorial queue",
)
async def list_content_reviews(
    status_filter: str | None = Query(None, alias="status", description="pending, approved, rejected"),
    entity_type: str | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> ContentReviewListResponse:
    items, total = await AdminContentService.list_reviews(
        db=db,
        status_filter=status_filter,
        entity_type=entity_type,
        page=page,
        page_size=page_size,
    )
    return ContentReviewListResponse(
        items=[ContentReviewResponse.model_validate(r) for r in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/content/reviews/{review_id}/decision",
    response_model=ContentReviewResponse,
    summary="Approve or reject a content review item",
)
async def review_content_decision(
    review_id: uuid.UUID,
    payload: ContentReviewDecision,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> ContentReviewResponse:
    review = await AdminContentService.review_decision(
        db=db,
        review_id=review_id,
        decision=payload,
        reviewer_id=current_admin.id,
    )
    return ContentReviewResponse.model_validate(review)


# ---------------------------------------------------------------------------
# User Administration & Role Management
# ---------------------------------------------------------------------------


@router.post(
    "/users/{user_id}/role",
    response_model=UserResponse,
    summary="Update user role (audited)",
)
async def update_user_role(
    user_id: uuid.UUID,
    payload: AdminUserRoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
) -> UserResponse:
    """Change user role with mandatory security audit logging."""
    user = await AdminContentService.update_user_role(
        db=db,
        target_user_id=user_id,
        new_role=payload.role,
        actor_id=current_admin.id,
    )
    return UserResponse.model_validate(user)
