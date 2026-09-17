"""FastAPI Router for teacher discovery, profiles, availability rules, and slots."""

import datetime
import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import AppException
from app.modules.auth.dependencies import require_role
from app.modules.teachers.models import (
    TeacherAvailabilityException,
    TeacherAvailabilityRule,
    TeacherBooking,
)
from app.modules.teachers.schemas import (
    AvailabilityExceptionCreate,
    AvailabilityExceptionResponse,
    AvailabilityRuleCreate,
    AvailabilityRuleResponse,
    TeacherListResponse,
    TeacherSlotsResponse,
    TeacherSummaryResponse,
)
from app.modules.teachers.slot_service import generate_available_slots
from app.modules.users.models import TeacherProfile, TeacherVerificationStatus, User, UserRole
from app.modules.users.schemas import TeacherProfileResponse

router = APIRouter(prefix="/teachers", tags=["Teachers"])


@router.get(
    "",
    response_model=TeacherListResponse,
    summary="Browse and discover teachers",
)
async def list_teachers(
    specialization: str | None = Query(None, description="Filter by expertise/specialization"),
    level: str | None = Query(None, description="Filter by CEFR teaching level (e.g. B2)"),
    min_price: int | None = Query(None, ge=0, description="Minimum hourly price in cents"),
    max_price: int | None = Query(None, ge=0, description="Maximum hourly price in cents"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> TeacherListResponse:
    """Browse verified teachers with optional filtering by expertise, level, and price."""
    stmt = select(TeacherProfile).where(
        TeacherProfile.verification_status == TeacherVerificationStatus.APPROVED
    )

    if min_price is not None:
        stmt = stmt.where(TeacherProfile.hourly_price >= min_price)
    if max_price is not None:
        stmt = stmt.where(TeacherProfile.hourly_price <= max_price)

    # Fetch all matching price/status, then filter JSON columns in Python for portable dialect compatibility
    result = await db.execute(stmt)
    all_profiles = list(result.scalars().all())

    filtered_profiles: list[TeacherProfile] = []
    for p in all_profiles:
        if specialization and specialization.lower() not in [e.lower() for e in p.expertise]:
            continue
        if level and level.upper() not in [lvl.upper() for lvl in p.teaching_levels]:
            continue
        filtered_profiles.append(p)

    total = len(filtered_profiles)
    start_idx = (page - 1) * page_size
    paged_items = filtered_profiles[start_idx : start_idx + page_size]

    items = [TeacherSummaryResponse.model_validate(p) for p in paged_items]
    return TeacherListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/me",
    response_model=TeacherProfileResponse,
    summary="Get current teacher profile",
)
async def get_my_teacher_profile(
    current_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> TeacherProfileResponse:
    """Retrieve teacher profile of currently authenticated teacher."""
    stmt = select(TeacherProfile).where(TeacherProfile.user_id == current_user.id)
    profile = (await db.execute(stmt)).scalar_one_or_none()

    if not profile:
        raise AppException(
            message="Teacher profile not found",
            code="PROFILE_NOT_FOUND",
            status_code=404,
        )

    return TeacherProfileResponse.model_validate(profile)


@router.get(
    "/{teacher_id}",
    response_model=TeacherSummaryResponse,
    summary="Get teacher public profile detail",
)
async def get_teacher_detail(
    teacher_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> TeacherSummaryResponse:
    """Retrieve public teacher profile by ID."""
    stmt = select(TeacherProfile).where(TeacherProfile.id == teacher_id)
    teacher = (await db.execute(stmt)).scalar_one_or_none()

    if not teacher:
        raise AppException(
            message="Teacher profile not found",
            code="TEACHER_NOT_FOUND",
            status_code=404,
        )

    return TeacherSummaryResponse.model_validate(teacher)


# --- Availability Rules Endpoints ---


@router.get(
    "/{teacher_id}/availability/rules",
    response_model=list[AvailabilityRuleResponse],
    summary="Get teacher recurring availability rules",
)
async def get_teacher_availability_rules(
    teacher_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list[AvailabilityRuleResponse]:
    """Retrieve all active recurring weekly availability rules for a teacher."""
    stmt = (
        select(TeacherAvailabilityRule)
        .where(
            TeacherAvailabilityRule.teacher_id == teacher_id,
            TeacherAvailabilityRule.is_active == True,
        )
        .order_by(TeacherAvailabilityRule.weekday, TeacherAvailabilityRule.start_time)
    )
    rules = (await db.execute(stmt)).scalars().all()
    return [AvailabilityRuleResponse.model_validate(r) for r in rules]


@router.post(
    "/me/availability/rules",
    response_model=AvailabilityRuleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create recurring availability rule",
)
async def create_availability_rule(
    payload: AvailabilityRuleCreate,
    current_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> AvailabilityRuleResponse:
    """Teacher defines a recurring weekly availability rule."""
    stmt = select(TeacherProfile).where(TeacherProfile.user_id == current_user.id)
    teacher = (await db.execute(stmt)).scalar_one_or_none()

    if not teacher:
        raise AppException(
            message="Teacher profile not found",
            code="PROFILE_NOT_FOUND",
            status_code=404,
        )

    rule = TeacherAvailabilityRule(
        teacher_id=teacher.id,
        weekday=payload.weekday,
        start_time=payload.start_time,
        end_time=payload.end_time,
        timezone=payload.timezone or teacher.timezone or "UTC",
        is_active=True,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)

    return AvailabilityRuleResponse.model_validate(rule)


@router.delete(
    "/me/availability/rules/{rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete recurring availability rule",
)
async def delete_availability_rule(
    rule_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Teacher deletes one of their availability rules."""
    stmt = select(TeacherProfile).where(TeacherProfile.user_id == current_user.id)
    teacher = (await db.execute(stmt)).scalar_one_or_none()

    if not teacher and current_user.role != UserRole.ADMIN:
        raise AppException(
            message="Teacher profile not found",
            code="PROFILE_NOT_FOUND",
            status_code=404,
        )

    rule_stmt = select(TeacherAvailabilityRule).where(TeacherAvailabilityRule.id == rule_id)
    rule = (await db.execute(rule_stmt)).scalar_one_or_none()

    if not rule:
        raise AppException(
            message="Availability rule not found",
            code="RULE_NOT_FOUND",
            status_code=404,
        )

    if current_user.role != UserRole.ADMIN and teacher and rule.teacher_id != teacher.id:
        raise AppException(
            message="Not authorized to delete this rule",
            code="FORBIDDEN",
            status_code=403,
        )

    await db.delete(rule)
    await db.commit()


# --- Availability Exceptions Endpoints ---


@router.get(
    "/{teacher_id}/availability/exceptions",
    response_model=list[AvailabilityExceptionResponse],
    summary="Get teacher availability exceptions",
)
async def get_teacher_availability_exceptions(
    teacher_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list[AvailabilityExceptionResponse]:
    """Retrieve schedule exceptions (blocked dates, modified hours) for a teacher."""
    stmt = (
        select(TeacherAvailabilityException)
        .where(TeacherAvailabilityException.teacher_id == teacher_id)
        .order_by(TeacherAvailabilityException.exception_date)
    )
    exceptions = (await db.execute(stmt)).scalars().all()
    return [AvailabilityExceptionResponse.model_validate(e) for e in exceptions]


@router.post(
    "/me/availability/exceptions",
    response_model=AvailabilityExceptionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create availability exception (block date or modified hours)",
)
async def create_availability_exception(
    payload: AvailabilityExceptionCreate,
    current_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> AvailabilityExceptionResponse:
    """Teacher blocks a date or modifies hours for a specific date."""
    stmt = select(TeacherProfile).where(TeacherProfile.user_id == current_user.id)
    teacher = (await db.execute(stmt)).scalar_one_or_none()

    if not teacher:
        raise AppException(
            message="Teacher profile not found",
            code="PROFILE_NOT_FOUND",
            status_code=404,
        )

    exc = TeacherAvailabilityException(
        teacher_id=teacher.id,
        exception_date=payload.exception_date,
        is_unavailable=payload.is_unavailable,
        start_time=payload.start_time,
        end_time=payload.end_time,
        reason=payload.reason,
    )
    db.add(exc)
    await db.commit()
    await db.refresh(exc)

    return AvailabilityExceptionResponse.model_validate(exc)


@router.delete(
    "/me/availability/exceptions/{exception_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete availability exception",
)
async def delete_availability_exception(
    exception_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.TEACHER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Teacher removes an availability exception."""
    stmt = select(TeacherProfile).where(TeacherProfile.user_id == current_user.id)
    teacher = (await db.execute(stmt)).scalar_one_or_none()

    if not teacher and current_user.role != UserRole.ADMIN:
        raise AppException(
            message="Teacher profile not found",
            code="PROFILE_NOT_FOUND",
            status_code=404,
        )

    exc_stmt = select(TeacherAvailabilityException).where(
        TeacherAvailabilityException.id == exception_id
    )
    exc = (await db.execute(exc_stmt)).scalar_one_or_none()

    if not exc:
        raise AppException(
            message="Availability exception not found",
            code="EXCEPTION_NOT_FOUND",
            status_code=404,
        )

    if current_user.role != UserRole.ADMIN and teacher and exc.teacher_id != teacher.id:
        raise AppException(
            message="Not authorized to delete this exception",
            code="FORBIDDEN",
            status_code=403,
        )

    await db.delete(exc)
    await db.commit()


# --- Slot Inspection Endpoints ---


@router.get(
    "/{teacher_id}/slots",
    response_model=TeacherSlotsResponse,
    summary="Inspect available booking slots for a teacher",
)
async def get_teacher_slots(
    teacher_id: uuid.UUID,
    date_from: datetime.date | None = Query(None, description="Start date (default: today)"),
    date_to: datetime.date | None = Query(None, description="End date (default: today + 7 days)"),
    student_timezone: str = Query("UTC", description="Student's local IANA timezone"),
    slot_duration_minutes: int = Query(60, ge=15, le=180, description="Slot duration in minutes"),
    db: AsyncSession = Depends(get_db),
) -> TeacherSlotsResponse:
    """Calculate and return all bookable discrete time slots for a teacher in a date window."""
    today = datetime.datetime.now(datetime.UTC).date()
    if date_from is None:
        date_from = today
    if date_to is None:
        date_to = date_from + datetime.timedelta(days=7)

    if date_to < date_from:
        raise AppException(
            message="date_to must be on or after date_from",
            code="INVALID_DATE_RANGE",
            status_code=400,
        )

    if (date_to - date_from).days > 31:
        raise AppException(
            message="Maximum date range for slot inspection is 31 days",
            code="DATE_RANGE_TOO_LARGE",
            status_code=400,
        )

    stmt = select(TeacherProfile).where(TeacherProfile.id == teacher_id)
    teacher = (await db.execute(stmt)).scalar_one_or_none()

    if not teacher:
        raise AppException(
            message="Teacher profile not found",
            code="TEACHER_NOT_FOUND",
            status_code=404,
        )

    # 1. Fetch active availability rules
    rules_stmt = select(TeacherAvailabilityRule).where(
        TeacherAvailabilityRule.teacher_id == teacher.id,
        TeacherAvailabilityRule.is_active == True,
    )
    rules = list((await db.execute(rules_stmt)).scalars().all())

    # 2. Fetch exceptions in the date range
    exc_stmt = select(TeacherAvailabilityException).where(
        TeacherAvailabilityException.teacher_id == teacher.id,
        TeacherAvailabilityException.exception_date >= date_from,
        TeacherAvailabilityException.exception_date <= date_to,
    )
    exceptions = list((await db.execute(exc_stmt)).scalars().all())

    # 3. Fetch existing active bookings that overlap this window
    start_dt_utc = datetime.datetime.combine(date_from, datetime.time.min).replace(
        tzinfo=datetime.UTC
    )
    end_dt_utc = datetime.datetime.combine(date_to, datetime.time.max).replace(tzinfo=datetime.UTC)

    bookings_stmt = select(TeacherBooking).where(
        TeacherBooking.teacher_id == teacher.id,
        TeacherBooking.start_time <= end_dt_utc,
        TeacherBooking.end_time >= start_dt_utc,
    )
    existing_bookings = list((await db.execute(bookings_stmt)).scalars().all())

    return generate_available_slots(
        teacher=teacher,
        rules=rules,
        exceptions=exceptions,
        existing_bookings=existing_bookings,
        date_from=date_from,
        date_to=date_to,
        student_timezone=student_timezone,
        slot_duration_minutes=slot_duration_minutes,
    )
