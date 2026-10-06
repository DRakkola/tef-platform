"""Lifecycle tests for asynchronous AI question-generation jobs."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException
from app.modules.admin.ai_question_schemas import (
    AIGenerationJobCreateRequest,
    AIQuestionGenerationRequest,
)
from app.modules.admin.ai_question_service import AIQuestionGenerationService
from app.modules.admin.enums import AIGenerationJobStatus

JOBS_ENDPOINT = "/api/v1/admin/content/generation/jobs"


async def _make_job(db_session: AsyncSession, **overrides) -> object:
    payload = {
        "modality": "reading",
        "task_type_code": "press_article",
        "count": 2,
        "force_simulation": True,
    }
    payload.update(overrides)
    request = AIGenerationJobCreateRequest(**payload)
    return await AIQuestionGenerationService.create_generation_job(
        db=db_session,
        request=request,
        actor_id=uuid.uuid4(),
    )


@pytest.mark.asyncio
class TestGenerationJobCreation:
    async def test_starts_queued_with_sanitized_payload(self, db_session: AsyncSession) -> None:
        job = await _make_job(db_session)

        assert job.status == AIGenerationJobStatus.QUEUED.value
        assert job.modality == "reading"
        assert job.task_type_code == "press_article"
        assert job.requested_count == 2
        assert job.started_at is None
        assert job.completed_at is None

    async def test_never_persists_api_key_override(self, db_session: AsyncSession) -> None:
        """A secret must never reach the jobs table."""
        job = await _make_job(db_session, api_key_override="sk-super-secret-value")

        assert "sk-super-secret-value" not in str(job.request_payload)
        assert "api_key_override" not in job.request_payload

    async def test_stored_payload_round_trips_into_a_request(
        self, db_session: AsyncSession
    ) -> None:
        job = await _make_job(db_session)

        request = AIQuestionGenerationRequest.model_validate(job.request_payload)
        assert request.task_type_code == "press_article"
        assert request.count == 2
        assert request.force_simulation is True


@pytest.mark.asyncio
class TestGenerationJobExecution:
    async def test_runs_batch_and_persists_result(self, db_session: AsyncSession) -> None:
        job = await _make_job(db_session, count=3)

        completed = await AIQuestionGenerationService.run_generation_job(
            db=db_session, job_id=job.id
        )

        assert completed.status == AIGenerationJobStatus.SUCCEEDED.value
        assert completed.started_at is not None
        assert completed.completed_at is not None
        assert completed.error_message is None
        assert completed.result_payload is not None
        assert completed.result_payload["total_generated"] == 3

    async def test_result_is_serialisable_into_the_poll_contract(
        self, db_session: AsyncSession
    ) -> None:
        job = await _make_job(db_session, count=1)
        completed = await AIQuestionGenerationService.run_generation_job(
            db=db_session, job_id=job.id
        )

        response = AIQuestionGenerationService._serialize_job(completed)
        assert response.status == AIGenerationJobStatus.SUCCEEDED
        assert response.is_terminal is True
        assert response.result is not None
        assert response.result.total_generated == 1

    async def test_never_commits_questions_as_drafts(self, db_session: AsyncSession) -> None:
        """A background job produces candidates only; publication stays manual."""
        from sqlalchemy import func, select

        from app.modules.assessments.models import Question

        job = await _make_job(db_session, count=2)
        await AIQuestionGenerationService.run_generation_job(db=db_session, job_id=job.id)

        count = await db_session.scalar(
            select(func.count()).select_from(Question).where(
                Question.created_by_user_id == job.created_by_user_id
            )
        )
        assert count == 0

    async def test_rerunning_a_finished_job_is_a_noop(self, db_session: AsyncSession) -> None:
        """Celery redelivery must not re-run or clobber a finished batch."""
        job = await _make_job(db_session, count=2)
        first = await AIQuestionGenerationService.run_generation_job(
            db=db_session, job_id=job.id
        )
        first_completed_at = first.completed_at

        second = await AIQuestionGenerationService.run_generation_job(
            db=db_session, job_id=job.id
        )

        assert second.status == AIGenerationJobStatus.SUCCEEDED.value
        assert second.completed_at == first_completed_at

    async def test_failure_marks_job_failed_without_leaking_internals(
        self, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        async def _boom(*args, **kwargs):
            raise RuntimeError("secret internal detail: db password hunter2")

        monkeypatch.setattr(
            AIQuestionGenerationService, "generate_candidates", _boom, raising=True
        )

        job = await _make_job(db_session)
        failed = await AIQuestionGenerationService.run_generation_job(
            db=db_session, job_id=job.id
        )

        assert failed.status == AIGenerationJobStatus.FAILED.value
        assert failed.completed_at is not None
        assert failed.result_payload is None
        assert failed.error_message is not None
        assert "hunter2" not in failed.error_message
        assert "RuntimeError" in failed.error_message

    async def test_missing_job_raises_not_found(self, db_session: AsyncSession) -> None:
        with pytest.raises(AppException) as exc_info:
            await AIQuestionGenerationService.run_generation_job(
                db=db_session, job_id=uuid.uuid4()
            )

        assert exc_info.value.status_code == 404


@pytest.mark.asyncio
class TestGenerationJobAuthorization:
    async def test_owner_can_read_own_job(self, db_session: AsyncSession) -> None:
        actor = uuid.uuid4()
        job = await AIQuestionGenerationService.create_generation_job(
            db=db_session,
            request=AIGenerationJobCreateRequest(force_simulation=True),
            actor_id=actor,
        )

        fetched = await AIQuestionGenerationService.get_generation_job(
            db=db_session, job_id=job.id, actor_id=actor, is_admin=False
        )
        assert fetched.id == job.id

    async def test_other_actor_gets_404_not_403(self, db_session: AsyncSession) -> None:
        """Do not disclose that another admin's job exists."""
        job = await _make_job(db_session)

        with pytest.raises(AppException) as exc_info:
            await AIQuestionGenerationService.get_generation_job(
                db=db_session, job_id=job.id, actor_id=uuid.uuid4(), is_admin=False
            )

        assert exc_info.value.status_code == 404

    async def test_admin_may_read_any_job(self, db_session: AsyncSession) -> None:
        job = await _make_job(db_session)

        fetched = await AIQuestionGenerationService.get_generation_job(
            db=db_session, job_id=job.id, actor_id=uuid.uuid4(), is_admin=True
        )
        assert fetched.id == job.id


@pytest.mark.asyncio
class TestGenerationJobEndpoints:
    async def test_create_requires_admin(
        self,
        client: AsyncClient,
        student_auth_headers: dict[str, str],
    ) -> None:
        response = await client.post(
            JOBS_ENDPOINT, json={"count": 1}, headers=student_auth_headers
        )
        assert response.status_code == 403

    async def test_create_returns_pollable_handle(
        self,
        client: AsyncClient,
        admin_auth_headers: dict[str, str],
    ) -> None:
        response = await client.post(
            JOBS_ENDPOINT,
            json={"modality": "reading", "task_type_code": "press_article", "count": 1},
            headers=admin_auth_headers,
        )

        assert response.status_code == 202
        body = response.json()
        assert body["job"]["status"] == "queued"
        assert body["job"]["is_terminal"] is False
        assert body["poll_url"].endswith(body["job"]["id"])

    async def test_poll_returns_terminal_result(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        admin_auth_headers: dict[str, str],
    ) -> None:
        created = await client.post(
            JOBS_ENDPOINT,
            json={
                "modality": "reading",
                "task_type_code": "press_article",
                "count": 2,
                "force_simulation": True,
            },
            headers=admin_auth_headers,
        )
        job_id = uuid.UUID(created.json()["job"]["id"])

        # The worker core is driven directly; no broker is required in tests.
        await AIQuestionGenerationService.run_generation_job(db=db_session, job_id=job_id)

        polled = await client.get(f"{JOBS_ENDPOINT}/{job_id}", headers=admin_auth_headers)
        assert polled.status_code == 200

        body = polled.json()
        assert body["status"] == "succeeded"
        assert body["is_terminal"] is True
        assert body["result"]["total_generated"] == 2
        assert body["error_message"] is None

    async def test_poll_unknown_job_is_404(
        self,
        client: AsyncClient,
        admin_auth_headers: dict[str, str],
    ) -> None:
        response = await client.get(f"{JOBS_ENDPOINT}/{uuid.uuid4()}", headers=admin_auth_headers)
        assert response.status_code == 404

    async def test_poll_requires_admin(
        self,
        client: AsyncClient,
        teacher_auth_headers: dict[str, str],
    ) -> None:
        response = await client.get(f"{JOBS_ENDPOINT}/{uuid.uuid4()}", headers=teacher_auth_headers)
        assert response.status_code == 403


def test_celery_task_is_registered() -> None:
    import app.workers.tasks  # noqa: F401
    from app.core.celery_app import celery_app

    assert "tasks.run_ai_question_generation_job" in celery_app.tasks