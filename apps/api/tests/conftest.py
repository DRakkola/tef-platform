"""Pytest async fixtures and testing configuration."""

from collections.abc import AsyncGenerator
from typing import BinaryIO

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import Base, get_db
from app.core.storage import StorageService, get_storage
from app.main import app

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
