"""Pytest async fixtures and testing configuration."""

import uuid
from collections.abc import AsyncGenerator
from typing import BinaryIO

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.database import Base, get_db
from app.core.security import create_access_token
from app.core.storage import StorageService, get_storage
from app.main import app

settings.ENVIRONMENT = "testing"

from app.modules.admin.beta_models import (  # noqa: F401
    BetaCohort,
    BetaInvitation,
)
from app.modules.admin.models import (  # noqa: F401
    AuditEvent,
    SkillLevelDescriptor,
    SkillRelation,
    TaxonomyVersion,
)
from app.modules.analytics.models import (  # noqa: F401
    AnalyticsEvent,
    Experiment,
    ExperimentAssignment,
    ExperimentVariant,
    SupportTicket,
    UserFeedback,
)
from app.modules.assessments.models import (  # noqa: F401
    Assessment,
    AssessmentSection,
    AssessmentSectionQuestion,
    Attempt,
    AttemptAnswer,
    AttemptScore,
    Question,
    QuestionOption,
    QuestionProvenance,
    QuestionSkillTag,
    QuestionValidation,
    Skill,
    Stimulus,
    TaskType,
)
from app.modules.billing.models import (  # noqa: F401
    AIUsageRecord,
    BillingLedgerEntry,
    BookingReservation,
    Coupon,
    CreditAccount,
    CreditConsumption,
    CreditGrant,
    Order,
    OrderItem,
    PaymentWebhookEvent,
    Product,
    ProductEntitlement,
    ProductPrice,
    Subscription,
    TeacherEarning,
    UserEntitlementGrant,
)
from app.modules.learning.models import (  # noqa: F401
    Exercise,
    ExerciseAttempt,
    ExerciseSkill,
    Mistake,
    Recommendation,
    SkillAssessment,
    StudentSkill,
)
from app.modules.learning.readiness_models import (  # noqa: F401
    ReadinessProfile,
    ReadinessSnapshot,
    SkillEvidence,
)
from app.modules.practice_pool.models import (  # noqa: F401
    PracticeBlock,
    PracticeMatch,
    PracticeQueueEntry,
    PracticeReport,
    PracticeRequest,
    PracticeSession,
)
from app.modules.speaking.models import (  # noqa: F401
    SpeakingEvaluation,
    SpeakingEvaluationSkill,
    SpeakingExam,
    SpeakingParticipant,
    SpeakingSection,
    SpeakingSession,
    SpeakingTurn,
)
from app.modules.teachers.models import (  # noqa: F401
    TeacherAvailabilityException,
    TeacherAvailabilityRule,
    TeacherBooking,
)
from app.modules.users.models import (
    StudentProfile,
    TeacherProfile,
    TeacherVerificationStatus,
    User,
    UserRole,
)
from app.modules.writing.models import (  # noqa: F401
    WritingAttempt,
    WritingCorrection,
    WritingSubmission,
    WritingTask,
)

# Test SQLite in-memory database for isolated testing
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class MockStorageService(StorageService):
    """In-memory mock storage service for tests."""

    def __init__(self) -> None:
        self.files: dict[str, bytes] = {}
        self.is_healthy = True

    def upload_file(
        self,
        file_obj: BinaryIO,
        content_type: str,
        folder: str = "general",
        file_extension: str = "",
        filename: str | None = None,
    ) -> str:
        import io

        from app.core.exceptions import AppException
        from app.core.storage import ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES

        normalized_content_type = content_type.lower().split(";")[0].strip()
        if normalized_content_type not in ALLOWED_MIME_TYPES:
            raise AppException(
                message=f"File type '{content_type}' is not permitted",
                code="INVALID_FILE_TYPE",
                status_code=415,
            )

        file_obj.seek(0, io.SEEK_END)
        file_size = file_obj.tell()
        file_obj.seek(0)
        if file_size > MAX_FILE_SIZE_BYTES:
            raise AppException(
                message=f"File size exceeds maximum permitted limit of {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB",
                code="FILE_TOO_LARGE",
                status_code=413,
            )

        if ".." in folder or folder.startswith("/") or "\\" in folder:
            raise AppException(
                message="Folder path contains illegal path traversal characters",
                code="INVALID_FOLDER_PATH",
                status_code=400,
            )
        clean_ext = f".{file_extension.lstrip('.')}" if file_extension else ""
        if filename:
            key = f"{folder}/{filename}{clean_ext}"
        else:
            key = f"{folder}/test-file{clean_ext}"
        self.files[key] = file_obj.read()
        return key

    def download_file(self, object_key: str) -> bytes:
        if ".." in object_key or object_key.startswith("/") or "\\" in object_key:
            from app.core.exceptions import AppException

            raise AppException(
                message="Invalid object key path traversal detected",
                code="INVALID_OBJECT_KEY",
                status_code=400,
            )
        if object_key not in self.files:
            raise KeyError("File not found")
        return self.files[object_key]

    def generate_presigned_url(self, object_key: str, expiration_seconds: int = 3600) -> str:
        if ".." in object_key or object_key.startswith("/") or "\\" in object_key:
            from app.core.exceptions import AppException

            raise AppException(
                message="Invalid object key path traversal detected",
                code="INVALID_OBJECT_KEY",
                status_code=400,
            )
        from app.core.storage import MAX_PRESIGNED_URL_EXPIRY_SECONDS

        capped_expiry = min(max(60, expiration_seconds), MAX_PRESIGNED_URL_EXPIRY_SECONDS)
        return f"http://storage.local/presigned/{object_key}?expires={capped_expiry}"

    def delete_file(self, object_key: str) -> bool:
        if object_key in self.files:
            del self.files[object_key]
            return True
        return False

    def check_health(self) -> bool:
        return self.is_healthy


mock_storage = MockStorageService()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_db():
    """Create test tables in memory."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


def _truncate_all_tables(sync_conn) -> None:
    """Empty every application table, leaving schema and alembic state intact.

    Tables are cleared child-first so foreign keys stay satisfied, and the
    pragma guards against a deferred violation from self-referencing rows.
    """
    sync_conn.execute(text("PRAGMA foreign_keys=OFF"))
    for table in reversed(Base.metadata.sorted_tables):
        sync_conn.execute(table.delete())
    sync_conn.execute(text("PRAGMA foreign_keys=ON"))


@pytest_asyncio.fixture(autouse=True)
async def isolate_test_data():
    """Give every test an empty database.

    The engine is session-scoped and several seeders commit their work, so
    without this a test that seeds canonical taxonomy rows leaks them into
    every later test in the run. That made outcomes depend on file execution
    order: for example a test asserting on the single active skill failed once
    another file had already seeded the full 57-skill catalogue.
    """
    async with test_engine.begin() as conn:
        await conn.run_sync(_truncate_all_tables)
    yield


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession]:
    """Provide isolated transactional session."""
    async with TestingSessionLocal() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient]:
    """FastAPI test client with overridden dependencies."""

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_storage] = lambda: mock_storage

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_student(db_session: AsyncSession) -> User:
    """Fixture providing an active student user with profile."""
    user = User(
        email=f"student_{uuid.uuid4().hex[:8]}@example.com",
        role=UserRole.STUDENT,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.flush()

    profile = StudentProfile(
        user_id=user.id,
        target_exam="TEF Canada",
        target_level="B2",
        timezone="America/Toronto",
        native_language="English",
        learning_preferences={"daily_goal_minutes": 30},
    )
    db_session.add(profile)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_teacher(db_session: AsyncSession) -> User:
    """Fixture providing an active teacher user with profile."""
    user = User(
        email=f"teacher_{uuid.uuid4().hex[:8]}@example.com",
        role=UserRole.TEACHER,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.flush()

    profile = TeacherProfile(
        user_id=user.id,
        display_name="Professeur Martin",
        bio="Certified TEF examiner with 10 years experience",
        expertise=["comprehension_orale", "expression_orale"],
        teaching_levels=["B1", "B2", "C1"],
        hourly_price=4500,
        verification_status=TeacherVerificationStatus.APPROVED,
    )
    db_session.add(profile)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_admin(db_session: AsyncSession) -> User:
    """Fixture providing an active admin user."""
    user = User(
        email=f"admin_{uuid.uuid4().hex[:8]}@example.com",
        role=UserRole.ADMIN,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
def student_auth_headers(test_student: User) -> dict[str, str]:
    """Provide Bearer auth header for the test student."""
    token = create_access_token(test_student.id, test_student.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def teacher_auth_headers(test_teacher: User) -> dict[str, str]:
    """Provide Bearer auth header for the test teacher."""
    token = create_access_token(test_teacher.id, test_teacher.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_auth_headers(test_admin: User) -> dict[str, str]:
    """Provide Bearer auth header for the test admin."""
    token = create_access_token(test_admin.id, test_admin.role.value)
    return {"Authorization": f"Bearer {token}"}
