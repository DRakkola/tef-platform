"""Pytest async fixtures and testing configuration."""

import uuid
from collections.abc import AsyncGenerator
from typing import BinaryIO

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import Base, get_db
from app.core.security import create_access_token, hash_password
from app.core.storage import StorageService, get_storage
from app.main import app
from app.modules.assessments.models import (  # noqa: F401
    Assessment,
    AssessmentSection,
    Attempt,
    AttemptAnswer,
    AttemptScore,
    Question,
    QuestionOption,
    QuestionSkillTag,
    Skill,
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
from app.modules.users.models import (
    RefreshToken,  # noqa: F401
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
    ) -> str:
        key = f"{folder}/test-file{file_extension}"
        self.files[key] = file_obj.read()
        return key

    def download_file(self, object_key: str) -> bytes:
        if object_key not in self.files:
            raise KeyError("File not found")
        return self.files[object_key]

    def generate_presigned_url(self, object_key: str, expiration_seconds: int = 3600) -> str:
        return f"http://storage.local/presigned/{object_key}?expires={expiration_seconds}"

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
        password_hash=hash_password("ValidPassword123!"),
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
        password_hash=hash_password("ValidPassword123!"),
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
        password_hash=hash_password("ValidPassword123!"),
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
