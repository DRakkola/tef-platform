"""Tests proving RBAC permissions and ownership isolation."""

import pytest
from httpx import AsyncClient

from app.core.exceptions import AppException
from app.modules.auth.dependencies import check_resource_ownership
from app.modules.users.models import User


@pytest.mark.asyncio
async def test_student_can_access_student_me(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
    test_student: User,
):
    """Verify that a student can access /api/v1/students/me."""
    response = await client.get("/api/v1/students/me", headers=student_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == str(test_student.id)
    assert data["target_exam"] == "TEF Canada"


@pytest.mark.asyncio
async def test_teacher_cannot_access_student_me(
    client: AsyncClient,
    teacher_auth_headers: dict[str, str],
):
    """Verify that a teacher cannot access /api/v1/students/me."""
    response = await client.get("/api/v1/students/me", headers=teacher_auth_headers)
    assert response.status_code == 403
    data = response.json()
    assert data["error"]["code"] == "INSUFFICIENT_PERMISSIONS"


@pytest.mark.asyncio
async def test_teacher_can_access_teacher_me(
    client: AsyncClient,
    teacher_auth_headers: dict[str, str],
    test_teacher: User,
):
    """Verify that a teacher can access /api/v1/teachers/me."""
    response = await client.get("/api/v1/teachers/me", headers=teacher_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == str(test_teacher.id)
    assert data["display_name"] == "Professeur Martin"


@pytest.mark.asyncio
async def test_student_cannot_access_teacher_me(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
):
    """Verify that a student cannot access /api/v1/teachers/me."""
    response = await client.get("/api/v1/teachers/me", headers=student_auth_headers)
    assert response.status_code == 403
    data = response.json()
    assert data["error"]["code"] == "INSUFFICIENT_PERMISSIONS"


@pytest.mark.asyncio
async def test_student_cannot_call_admin_api(
    client: AsyncClient,
    student_auth_headers: dict[str, str],
):
    """Verify that students are forbidden from calling administrative endpoints."""
    response = await client.get("/api/v1/admin/system-overview", headers=student_auth_headers)
    assert response.status_code == 403
    data = response.json()
    assert data["error"]["code"] == "INSUFFICIENT_PERMISSIONS"


@pytest.mark.asyncio
async def test_teacher_cannot_call_admin_api(
    client: AsyncClient,
    teacher_auth_headers: dict[str, str],
):
    """Verify that teachers are forbidden from calling administrative endpoints."""
    response = await client.get("/api/v1/admin/system-overview", headers=teacher_auth_headers)
    assert response.status_code == 403
    data = response.json()
    assert data["error"]["code"] == "INSUFFICIENT_PERMISSIONS"


@pytest.mark.asyncio
async def test_admin_can_access_admin_api(
    client: AsyncClient,
    admin_auth_headers: dict[str, str],
):
    """Verify that administrators can access administrative endpoints."""
    response = await client.get("/api/v1/admin/system-overview", headers=admin_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["access"] == "admin_granted"


def test_resource_ownership_check(test_student: User, test_teacher: User, test_admin: User):
    """Verify ownership protection helper function."""
    # User accessing their own resource
    check_resource_ownership(test_student.id, test_student)

    # Admin accessing any user's resource
    check_resource_ownership(test_student.id, test_admin)

    # User accessing another user's resource raises 403
    with pytest.raises(AppException) as exc_info:
        check_resource_ownership(test_teacher.id, test_student)
    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "FORBIDDEN_RESOURCE"
