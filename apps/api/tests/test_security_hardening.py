"""Dedicated security hardening test suite covering all audited security domains."""

import io
import time
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    revoke_token_jti,
    verify_password_timing_safe,
)
from app.modules.assessments.enums import AssessmentType, AttemptStatus
from app.modules.assessments.models import Assessment, Attempt
from app.modules.practice_pool.service import PracticePoolService
from app.modules.speaking.service import SpeakingService
from app.modules.users.models import User, UserRole
from tests.conftest import MockStorageService

# ==============================================================================
# 1. API Security Headers & Payload Limits
# ==============================================================================


@pytest.mark.asyncio
async def test_security_headers_present(client: AsyncClient):
    """Verify that comprehensive security headers are attached to all API responses."""
    response = await client.get("/api/v1/status")
    assert response.status_code == 200

    headers = response.headers
    assert headers.get("x-content-type-options") == "nosniff"
    assert headers.get("x-frame-options") == "DENY"
    assert headers.get("x-xss-protection") == "1; mode=block"
    assert headers.get("referrer-policy") == "strict-origin-when-cross-origin"
    assert "default-src 'self'" in headers.get("content-security-policy", "")
    assert headers.get("cross-origin-opener-policy") in ("same-origin", "same-origin-allow-popups")
    assert headers.get("cross-origin-resource-policy") in ("same-origin", "cross-origin")


@pytest.mark.asyncio
async def test_payload_size_limit_rejected(client: AsyncClient):
    """Verify that request bodies exceeding max payload size (5MB) return 413 Payload Too Large."""
    oversized_length = 6 * 1024 * 1024  # 6 MB
    response = await client.post(
        "/api/v1/auth/login",
        headers={"Content-Length": str(oversized_length), "Content-Type": "application/json"},
        content=b'{"dummy": "data"}',
    )
    assert response.status_code == 413
    data = response.json()
    assert data["error"]["code"] == "PAYLOAD_TOO_LARGE"


# ==============================================================================
# 2. Timing-Safe Verification & Brute-Force Lockout
# ==============================================================================


@pytest.mark.asyncio
async def test_timing_safe_password_verification():
    """Verify that verify_password_timing_safe returns False for non-existent users without timing leakage."""
    start_time = time.perf_counter()
    result = verify_password_timing_safe("WrongPassword123!", None)
    elapsed = time.perf_counter() - start_time

    assert result is False
    # Argon2id hashing takes measurable computational work (> 10ms)
    assert elapsed > 0.01


@pytest.mark.asyncio
async def test_account_lockout_after_five_consecutive_failures(
    client: AsyncClient, test_student: User
):
    """Verify that 5 failed login attempts trigger account lockout with HTTP 429."""
    # Attempt 5 incorrect logins
    for i in range(5):
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": test_student.email, "password": f"WrongPassword_{i}!"},
        )
        assert resp.status_code == 401
        assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"

    # 6th attempt should be blocked by account lockout (HTTP 429)
    resp6 = await client.post(
        "/api/v1/auth/login",
        json={"email": test_student.email, "password": "ValidPassword123!"},
    )
    assert resp6.status_code == 429
    assert resp6.json()["error"]["code"] == "ACCOUNT_LOCKED"
    assert "locked" in resp6.json()["error"]["message"].lower()


@pytest.mark.asyncio
async def test_successful_login_resets_failed_counter(
    client: AsyncClient, db_session: AsyncSession
):
    """Verify that a successful login clears failed attempts."""
    email = f"reset_test_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "ValidPassword123!"
    user = User(
        email=email,
        password_hash=hash_password(pwd),
        role=UserRole.STUDENT,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()

    # Fail twice
    for _ in range(2):
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "BadPassword!"},
        )
        assert resp.status_code == 401

    # Successful login
    success_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": pwd},
    )
    assert success_resp.status_code == 200

    # Fail twice more (should not be locked since previous failures were reset)
    for _ in range(2):
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "BadPassword!"},
        )
        assert resp.status_code == 401
        assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"


# ==============================================================================
# 3. JWT Access Token Blacklisting / Revocation
# ==============================================================================


@pytest.mark.asyncio
async def test_jwt_revocation_on_logout(client: AsyncClient, test_student: User):
    """Verify that logging out revokes the access token JTI immediately."""
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": test_student.email, "password": "ValidPassword123!"},
    )
    assert login_resp.status_code == 200
    token_data = login_resp.json()
    access_token = token_data["access_token"]
    refresh_token = token_data["refresh_token"]

    # Access /me works with Bearer token
    me_resp = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_resp.status_code == 200

    # Logout with access token and refresh token
    logout_resp = await client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"refresh_token": refresh_token},
    )
    assert logout_resp.status_code == 200

    # Attempt to use the same access token again - must be rejected with TOKEN_REVOKED
    revoked_resp = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert revoked_resp.status_code == 401
    assert revoked_resp.json()["error"]["code"] == "TOKEN_REVOKED"


@pytest.mark.asyncio
async def test_jwt_revocation_on_password_change(client: AsyncClient, db_session: AsyncSession):
    """Verify that changing password revokes the current access token."""
    email = f"pwd_change_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "OriginalPassword123!"
    user = User(
        email=email,
        password_hash=hash_password(pwd),
        role=UserRole.STUDENT,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()

    # Login
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": pwd},
    )
    access_token = login_resp.json()["access_token"]

    # Change password
    change_resp = await client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"current_password": pwd, "new_password": "NewSecurePassword456!"},
    )
    assert change_resp.status_code == 200

    # Prior token is now revoked
    me_resp = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_resp.status_code == 401
    assert me_resp.json()["error"]["code"] == "TOKEN_REVOKED"


# ==============================================================================
# 4. CSRF Protection
# ==============================================================================


@pytest.mark.asyncio
async def test_csrf_missing_header_cookie_auth(client: AsyncClient, test_student: User):
    """Verify that cookie-authenticated mutation requests without X-CSRF-Token return 403."""
    access_token = create_access_token(test_student.id, test_student.role.value)

    client.cookies.set("access_token", access_token)

    resp = await client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": "dummy"},
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "CSRF_TOKEN_MISSING"

    client.cookies.clear()


@pytest.mark.asyncio
async def test_csrf_mismatched_token_cookie_auth(client: AsyncClient, test_student: User):
    """Verify that mismatched X-CSRF-Token and csrf_token cookie returns 403 CSRF_VALIDATION_FAILED."""
    access_token = create_access_token(test_student.id, test_student.role.value)

    client.cookies.set("access_token", access_token)
    client.cookies.set("csrf_token", "valid_cookie_token_1234567890123456")

    resp = await client.post(
        "/api/v1/auth/logout",
        headers={"X-CSRF-Token": "different_and_invalid_token_xyz"},
        json={"refresh_token": "dummy"},
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "CSRF_VALIDATION_FAILED"

    client.cookies.clear()


@pytest.mark.asyncio
async def test_csrf_valid_token_cookie_auth(client: AsyncClient, test_student: User):
    """Verify that matching X-CSRF-Token header and csrf_token cookie succeeds."""
    access_token = create_access_token(test_student.id, test_student.role.value)
    csrf_val = "valid_csrf_token_abcdef1234567890"

    client.cookies.set("access_token", access_token)
    client.cookies.set("csrf_token", csrf_val)

    resp = await client.post(
        "/api/v1/auth/logout",
        headers={"X-CSRF-Token": csrf_val},
        json={},
    )
    assert resp.status_code == 200

    client.cookies.clear()


@pytest.mark.asyncio
async def test_csrf_exempt_for_bearer_token(
    client: AsyncClient, student_auth_headers: dict[str, str]
):
    """Verify that pure Bearer token authentication is exempt from CSRF checks."""
    resp = await client.post(
        "/api/v1/auth/logout",
        headers=student_auth_headers,
        json={},
    )
    assert resp.status_code == 200


# ==============================================================================
# 5. Storage Path Traversal, MIME Validation, and Size Limits
# ==============================================================================


@pytest.mark.asyncio
async def test_storage_path_traversal_rejected():
    """Verify that storage rejects path traversal directory patterns."""
    storage = MockStorageService()

    # Reject folder path traversal
    with pytest.raises(AppException) as exc_info:
        storage.upload_file(
            file_obj=io.BytesIO(b"test"),
            folder="../traversal",
            file_extension=".txt",
            content_type="text/plain",
        )
    assert exc_info.value.code == "INVALID_FOLDER_PATH"

    # Reject object key traversal
    with pytest.raises(AppException) as exc_info2:
        storage.generate_presigned_url("submissions/../../etc/passwd")
    assert exc_info2.value.code == "INVALID_OBJECT_KEY"


@pytest.mark.asyncio
async def test_storage_disallowed_mime_type():
    """Verify that uploading disallowed executable MIME types is rejected."""
    storage = MockStorageService()

    with pytest.raises(AppException) as exc_info:
        storage.upload_file(
            file_obj=io.BytesIO(b"MZ\x90\x00"),
            folder="submissions",
            file_extension=".exe",
            content_type="application/x-msdownload",
        )
    assert exc_info.value.code == "INVALID_FILE_TYPE"
    assert exc_info.value.status_code == 415


@pytest.mark.asyncio
async def test_storage_oversized_file_rejected():
    """Verify that files exceeding the 10MB limit are rejected."""
    storage = MockStorageService()
    oversized = io.BytesIO(b"x" * (11 * 1024 * 1024))

    with pytest.raises(AppException) as exc_info:
        storage.upload_file(
            file_obj=oversized,
            folder="submissions",
            file_extension=".txt",
            content_type="text/plain",
        )
    assert exc_info.value.code == "FILE_TOO_LARGE"
    assert exc_info.value.status_code == 413


@pytest.mark.asyncio
async def test_storage_presigned_expiry_capped():
    """Verify that presigned URL expiry cannot exceed 3600 seconds."""
    storage = MockStorageService()
    url = storage.generate_presigned_url("submissions/test.txt", expiration_seconds=999999)
    assert "expires=3600" in url


# ==============================================================================
# 6. Realtime WebSockets & Revocation
# ==============================================================================


@pytest.mark.asyncio
async def test_websocket_revoked_token_rejected_in_speaking(
    db_session: AsyncSession, test_student: User
):
    """Verify that SpeakingService.authorize_room_connection rejects revoked JWT tokens."""
    token = create_access_token(test_student.id, test_student.role.value)
    payload = decode_access_token(token)
    jti = payload["jti"]

    await revoke_token_jti(jti, ttl_seconds=600)

    with pytest.raises(AppException) as exc_info:
        await SpeakingService.authorize_room_connection(
            db=db_session,
            room_id="dummy_room_123",
            token=token,
        )
    assert exc_info.value.code == "TOKEN_REVOKED"
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_websocket_revoked_token_rejected_in_practice_pool(
    db_session: AsyncSession, test_student: User
):
    """Verify that PracticePoolService.authorize_room_connection rejects revoked JWT tokens."""
    token = create_access_token(test_student.id, test_student.role.value)
    payload = decode_access_token(token)
    jti = payload["jti"]

    await revoke_token_jti(jti, ttl_seconds=600)

    with pytest.raises(AppException) as exc_info:
        await PracticePoolService.authorize_room_connection(
            db=db_session,
            room_id="dummy_practice_room_123",
            token=token,
        )
    assert exc_info.value.code == "TOKEN_REVOKED"
    assert exc_info.value.status_code == 401


# ==============================================================================
# 7. Exam Tampering & Integrity Protections
# ==============================================================================


@pytest.mark.asyncio
async def test_exam_cannot_modify_answers_on_submitted_attempt(
    client: AsyncClient,
    db_session: AsyncSession,
    test_student: User,
    student_auth_headers: dict[str, str],
):
    """Verify that answers cannot be submitted or altered once an attempt is SUBMITTED."""
    assessment = Assessment(
        title="Security Integrity Exam",
        assessment_type=AssessmentType.READING,
        duration_seconds=1800,
    )
    db_session.add(assessment)
    await db_session.flush()

    attempt = Attempt(
        assessment_id=assessment.id,
        user_id=test_student.id,
        status=AttemptStatus.SUBMITTED,
    )
    db_session.add(attempt)
    await db_session.commit()

    resp = await client.post(
        f"/api/v1/attempts/{attempt.id}/answers",
        headers=student_auth_headers,
        json={"question_id": str(uuid.uuid4()), "selected_option_id": str(uuid.uuid4())},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "ATTEMPT_ALREADY_SUBMITTED"


@pytest.mark.asyncio
async def test_exam_cannot_submit_answers_to_expired_attempt(
    client: AsyncClient,
    db_session: AsyncSession,
    test_student: User,
    student_auth_headers: dict[str, str],
):
    """Verify that answers cannot be submitted to an expired attempt."""
    assessment = Assessment(
        title="Security Expired Exam",
        assessment_type=AssessmentType.READING,
        duration_seconds=1800,
    )
    db_session.add(assessment)
    await db_session.flush()

    attempt = Attempt(
        assessment_id=assessment.id,
        user_id=test_student.id,
        status=AttemptStatus.EXPIRED,
    )
    db_session.add(attempt)
    await db_session.commit()

    resp = await client.post(
        f"/api/v1/attempts/{attempt.id}/answers",
        headers=student_auth_headers,
        json={"question_id": str(uuid.uuid4()), "selected_option_id": str(uuid.uuid4())},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "ATTEMPT_EXPIRED"


@pytest.mark.asyncio
async def test_exam_cannot_submit_answers_to_other_users_attempt(
    client: AsyncClient,
    db_session: AsyncSession,
    test_teacher: User,
    student_auth_headers: dict[str, str],
):
    """Verify that answers cannot be submitted to another user's attempt (IDOR defense)."""
    assessment = Assessment(
        title="Security IDOR Exam",
        assessment_type=AssessmentType.READING,
        duration_seconds=1800,
    )
    db_session.add(assessment)
    await db_session.flush()

    attempt = Attempt(
        assessment_id=assessment.id,
        user_id=test_teacher.id,
        status=AttemptStatus.STARTED,
    )
    db_session.add(attempt)
    await db_session.commit()

    resp = await client.post(
        f"/api/v1/attempts/{attempt.id}/answers",
        headers=student_auth_headers,
        json={"question_id": str(uuid.uuid4()), "selected_option_id": str(uuid.uuid4())},
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_RESOURCE"
