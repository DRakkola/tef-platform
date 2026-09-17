"""Comprehensive test suite for authentication endpoints and workflows."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.modules.users.models import User, UserRole


@pytest.mark.asyncio
async def test_register_student_success(client: AsyncClient):
    """Test successful student registration creating user and student profile."""
    payload = {
        "email": "new_student@tef-example.com",
        "password": "SecurePassword123!",
        "role": "student",
        "target_exam": "TEF Canada",
        "target_level": "B2",
        "timezone": "America/Toronto",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["email"] == "new_student@tef-example.com"
    assert data["user"]["role"] == "student"
    assert data["user"]["student_profile"]["target_exam"] == "TEF Canada"
    assert "access_token" in response.cookies
    assert "refresh_token" in response.cookies
    assert "csrf_token" in response.cookies


@pytest.mark.asyncio
async def test_register_teacher_success(client: AsyncClient):
    """Test successful teacher registration creating user and teacher profile."""
    payload = {
        "email": "new_teacher@tef-example.com",
        "password": "SecurePassword123!",
        "role": "teacher",
        "display_name": "Professeur Dupont",
        "hourly_price": 5000,
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["user"]["role"] == "teacher"
    assert data["user"]["teacher_profile"]["display_name"] == "Professeur Dupont"
    assert data["user"]["teacher_profile"]["verification_status"] == "pending"


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient, test_student: User):
    """Test that registering an already registered email fails with 400."""
    payload = {
        "email": test_student.email,
        "password": "SecurePassword123!",
        "role": "student",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "EMAIL_ALREADY_EXISTS"


@pytest.mark.asyncio
async def test_register_weak_password(client: AsyncClient):
    """Test that registering with weak password fails validation."""
    payload = {
        "email": "weak_pass@tef-example.com",
        "password": "weak",  # Less than 12 chars
        "role": "student",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, test_student: User):
    """Test login with valid credentials."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": test_student.email, "password": "ValidPassword123!"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["email"] == test_student.email
    assert "access_token" in response.cookies
    assert "refresh_token" in response.cookies


@pytest.mark.asyncio
async def test_login_invalid_password(client: AsyncClient, test_student: User):
    """Test login with wrong password returns generic 401."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": test_student.email, "password": "WrongPassword999!"},
    )
    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "INVALID_CREDENTIALS"
    assert data["error"]["message"] == "Invalid email or password"


@pytest.mark.asyncio
async def test_login_nonexistent_email(client: AsyncClient):
    """Test login with nonexistent email returns identical generic 401 message."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "nobody_exists@tef-example.com", "password": "WrongPassword999!"},
    )
    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "INVALID_CREDENTIALS"
    assert data["error"]["message"] == "Invalid email or password"


@pytest.mark.asyncio
async def test_login_inactive_user(client: AsyncClient, db_session: AsyncSession):
    """Test login with inactive account fails."""
    inactive_user = User(
        email="inactive@tef-example.com",
        password_hash=hash_password("ValidPassword123!"),
        role=UserRole.STUDENT,
        is_active=False,
    )
    db_session.add(inactive_user)
    await db_session.commit()

    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "inactive@tef-example.com", "password": "ValidPassword123!"},
    )
    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "ACCOUNT_INACTIVE"


@pytest.mark.asyncio
async def test_auth_me_endpoint(
    client: AsyncClient, student_auth_headers: dict[str, str], test_student: User
):
    """Test GET /api/v1/auth/me returns current user."""
    response = await client.get("/api/v1/auth/me", headers=student_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == test_student.email
    assert data["role"] == "student"
    assert data["student_profile"] is not None


@pytest.mark.asyncio
async def test_refresh_token_rotation(client: AsyncClient, test_student: User):
    """Test refresh token workflow and rotation."""
    # 1. Login to get initial refresh token
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": test_student.email, "password": "ValidPassword123!"},
    )
    refresh_token = login_res.json()["refresh_token"]

    # 2. Refresh tokens
    refresh_res = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert refresh_res.status_code == 200
    new_data = refresh_res.json()
    assert "access_token" in new_data
    assert "refresh_token" in new_data
    new_refresh_token = new_data["refresh_token"]
    assert new_refresh_token != refresh_token

    # 3. Attempting to reuse old refresh token must be rejected
    reuse_res = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert reuse_res.status_code == 401
    assert reuse_res.json()["error"]["code"] == "INVALID_REFRESH_TOKEN"


@pytest.mark.asyncio
async def test_logout(client: AsyncClient, test_student: User):
    """Test logout revokes the refresh token."""
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": test_student.email, "password": "ValidPassword123!"},
    )
    refresh_token = login_res.json()["refresh_token"]

    csrf_token = login_res.cookies.get("csrf_token")
    headers = {"X-CSRF-Token": csrf_token} if csrf_token else {}

    logout_res = await client.post(
        "/api/v1/auth/logout",
        headers=headers,
        json={"refresh_token": refresh_token},
    )
    assert logout_res.status_code == 200
    assert logout_res.json()["message"] == "Successfully logged out"

    # Token should no longer be usable for refresh
    after_logout_refresh = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert after_logout_refresh.status_code == 401


@pytest.mark.asyncio
async def test_change_password(
    client: AsyncClient, student_auth_headers: dict[str, str], test_student: User
):
    """Test password change with correct and incorrect current passwords."""
    # Wrong current password fails
    bad_res = await client.post(
        "/api/v1/auth/change-password",
        headers=student_auth_headers,
        json={
            "current_password": "WrongPassword999!",
            "new_password": "NewValidPassword456!",
        },
    )
    assert bad_res.status_code == 400
    assert bad_res.json()["error"]["code"] == "INVALID_CURRENT_PASSWORD"

    # Correct current password succeeds
    good_res = await client.post(
        "/api/v1/auth/change-password",
        headers=student_auth_headers,
        json={
            "current_password": "ValidPassword123!",
            "new_password": "NewValidPassword456!",
        },
    )
    assert good_res.status_code == 200

    # Verify login with new password works
    login_new = await client.post(
        "/api/v1/auth/login",
        json={"email": test_student.email, "password": "NewValidPassword456!"},
    )
    assert login_new.status_code == 200

    # Old password no longer works
    login_old = await client.post(
        "/api/v1/auth/login",
        json={"email": test_student.email, "password": "ValidPassword123!"},
    )
    assert login_old.status_code == 401


@pytest.mark.asyncio
async def test_malformed_token_rejected(client: AsyncClient):
    """Test that forged or malformed tokens return 401."""
    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer totally-invalid-jwt-token"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_TOKEN"


@pytest.mark.asyncio
async def test_csrf_protection_on_cookie_auth(client: AsyncClient, test_student: User):
    """Test that cookie-authenticated mutation requests without matching CSRF token fail."""
    token = create_access_token(test_student.id, test_student.role.value)

    # Mutation with cookie but missing X-CSRF-Token header
    client.cookies.set("access_token", token)
    client.cookies.set("csrf_token", "valid-csrf-token-123")

    response = await client.post(
        "/api/v1/auth/change-password",
        json={
            "current_password": "ValidPassword123!",
            "new_password": "AnotherNewPassword789!",
        },
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "CSRF_TOKEN_MISSING"

    # With mismatched CSRF token
    response_mismatch = await client.post(
        "/api/v1/auth/change-password",
        headers={"X-CSRF-Token": "different-csrf-token"},
        json={
            "current_password": "ValidPassword123!",
            "new_password": "AnotherNewPassword789!",
        },
    )
    assert response_mismatch.status_code == 403
    assert response_mismatch.json()["error"]["code"] == "CSRF_VALIDATION_FAILED"

    # With matching CSRF token
    response_match = await client.post(
        "/api/v1/auth/change-password",
        headers={"X-CSRF-Token": "valid-csrf-token-123"},
        json={
            "current_password": "ValidPassword123!",
            "new_password": "AnotherNewPassword789!",
        },
    )
    assert response_match.status_code == 200

    client.cookies.clear()
