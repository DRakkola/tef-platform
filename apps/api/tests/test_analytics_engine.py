"""Tests for the Beta Operations and Analytics telemetry engine."""

import datetime
import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.analytics.enums import (
    EventType,
    FeedbackCategory,
    SupportTicketPriority,
    SupportTicketStatus,
)
from app.modules.analytics.models import AnalyticsEvent, SupportTicket, UserFeedback
from app.modules.analytics.schemas import (
    AnalyticsEventIngestItem,
    SupportTicketCreateRequest,
    SupportTicketUpdateRequest,
    UserFeedbackCreateRequest,
)
from app.modules.analytics.service import AnalyticsService, sanitize_analytics_metadata
from app.modules.users.models import User, UserRole


@pytest.mark.asyncio
async def test_zero_pii_sanitizer():
    """Verify sensitive PII, passwords, audio, and draft text are redacted or truncated."""
    payload = {
        "user_action": "submit_draft",
        "password": "super-secret-password-123",
        "auth_token": "bearer eyJhbGciOi...",
        "credit_card": "4111222233334444",
        "speech_transcript": "Bonjour, je voudrais parler de l'immigration au Canada...",
        "essay_text": "Mon essai complet de 400 mots...",
        "safe_score": 85,
        "nested": {
            "cvv": "123",
            "device": "desktop",
            "long_text": "A" * 600,
        },
    }

    sanitized = sanitize_analytics_metadata(payload)

    assert sanitized["user_action"] == "submit_draft"
    assert sanitized["safe_score"] == 85
    assert sanitized["password"] == "[REDACTED]"
    assert sanitized["auth_token"] == "[REDACTED]"
    assert sanitized["credit_card"] == "[REDACTED]"
    assert sanitized["speech_transcript"] == "[REDACTED]"
    assert sanitized["essay_text"] == "[REDACTED]"
    assert sanitized["nested"]["cvv"] == "[REDACTED]"
    assert sanitized["nested"]["device"] == "desktop"
    assert sanitized["nested"]["long_text"].endswith("... [TRUNCATED]")


@pytest.mark.asyncio
async def test_analytics_tracking_idempotency_and_fail_safe(db_session: AsyncSession, test_student: User):
    """Verify event tracking records events with idempotency and never crashes on duplicate inserts."""
    event_id = uuid.uuid4()

    # 1. First track call succeeds
    ev1 = await AnalyticsService.track(
        db=db_session,
        event_type=EventType.ASSESSMENT_STARTED.value,
        actor_id=test_student.id,
        session_id="sess-abc-123",
        entity_type="assessment",
        entity_id=uuid.uuid4(),
        metadata={"target_level": "B2", "password": "sensitive_password"},
        event_id=event_id,
    )
    assert ev1 is not None
    assert ev1.id == event_id
    assert ev1.metadata_payload["password"] == "[REDACTED]"
    assert ev1.metadata_payload["target_level"] == "B2"

    # 2. Duplicate insert with same event_id is safely ignored (returns None, no error)
    ev2 = await AnalyticsService.track(
        db=db_session,
        event_type=EventType.ASSESSMENT_STARTED.value,
        actor_id=test_student.id,
        event_id=event_id,
    )
    assert ev2 is None


@pytest.mark.asyncio
async def test_analytics_batch_tracking(db_session: AsyncSession, test_student: User):
    """Verify batch ingestion handles multiple events efficiently."""
    id1, id2 = uuid.uuid4(), uuid.uuid4()
    batch = [
        AnalyticsEventIngestItem(
            event_id=id1,
            event_type=EventType.ONBOARDING_STARTED.value,
            actor_id=test_student.id,
            session_id="sess-1",
        ),
        AnalyticsEventIngestItem(
            event_id=id2,
            event_type=EventType.ONBOARDING_STEP_COMPLETED.value,
            actor_id=test_student.id,
            session_id="sess-1",
            metadata={"step": 1},
        ),
    ]

    accepted = await AnalyticsService.track_batch(db=db_session, items=batch)
    assert len(accepted) == 2
    assert id1 in accepted
    assert id2 in accepted


@pytest.mark.asyncio
async def test_user_feedback_and_support_tickets(db_session: AsyncSession, test_student: User):
    """Verify submission and administrative lifecycle for feedback and support tickets."""
    # 1. Create feedback
    fb_req = UserFeedbackCreateRequest(
        category=FeedbackCategory.CONTENT,
        rating=5,
        message="Excellent diagnostic test, very realistic TEF questions!",
        context_url="/assessments/diagnostic",
    )
    feedback = await AnalyticsService.create_feedback(db=db_session, user_id=test_student.id, req=fb_req)
    assert feedback.id is not None
    assert feedback.rating == 5

    feedbacks = await AnalyticsService.list_feedback(db=db_session)
    assert len(feedbacks) >= 1
    assert any(f.id == feedback.id for f in feedbacks)

    # 2. Create support ticket
    ticket_req = SupportTicketCreateRequest(
        category="audio_recording",
        subject="Microphone permission issue on iOS Safari",
        description="I am unable to record my audio response in Safari on iPhone.",
        priority=SupportTicketPriority.HIGH,
        context={"browser": "Mobile Safari", "os": "iOS 18"},
    )
    ticket = await AnalyticsService.create_support_ticket(db=db_session, user_id=test_student.id, req=ticket_req)
    assert ticket.id is not None
    assert ticket.status == SupportTicketStatus.OPEN
    assert ticket.priority == SupportTicketPriority.HIGH

    # 3. Triage ticket
    update_req = SupportTicketUpdateRequest(
        status=SupportTicketStatus.IN_PROGRESS,
        internal_notes="Investigating WebRTC audio constraints for Safari 18.",
    )
    updated_ticket = await AnalyticsService.update_support_ticket(
        db=db_session, ticket_id=ticket.id, req=update_req
    )
    assert updated_ticket is not None
    assert updated_ticket.status == SupportTicketStatus.IN_PROGRESS
    assert "Safari 18" in updated_ticket.internal_notes


@pytest.mark.asyncio
async def test_admin_analytics_aggregations(db_session: AsyncSession, test_student: User):
    """Verify all 9 administrative cockpit aggregation methods execute valid SQL and return structured data."""
    # 1. Overview
    overview = await AnalyticsService.get_overview_metrics(db=db_session)
    assert overview.total_registered_users >= 1
    assert isinstance(overview.activation_rate, float)
    assert overview.ai_estimated_cost >= 0.0

    # 2. Funnel
    funnel = await AnalyticsService.get_funnel_metrics(db=db_session)
    assert len(funnel.stages) == 11
    assert funnel.stages[0].stage == "visitor"
    assert funnel.stages[-1].stage == "purchase_completed"

    # 3. Retention
    retention = await AnalyticsService.get_retention_cohorts(db=db_session, weeks=4)
    assert len(retention.cohorts) == 4
    for c in retention.cohorts:
        assert c.d1_rate >= c.d7_rate

    # 4. Learning
    learning = await AnalyticsService.get_learning_analytics(db=db_session)
    assert isinstance(learning.insufficient_data, bool)

    # 5. Content
    content = await AnalyticsService.get_content_analytics(db=db_session)
    assert isinstance(content.average_completion_rate, float)

    # 6. Teachers
    teachers = await AnalyticsService.get_teacher_analytics(db=db_session)
    assert teachers.slot_utilization_rate >= 0.0

    # 7. AI
    ai = await AnalyticsService.get_ai_analytics(db=db_session)
    assert ai.cost_per_active_student_usd >= 0.0
    assert ai.average_latency_seconds > 0.0

    # 8. Billing
    billing = await AnalyticsService.get_billing_analytics(db=db_session)
    assert billing.checkout_conversion_rate >= 0.0

    # 9. Practice Pool
    practice = await AnalyticsService.get_practice_pool_analytics(db=db_session)
    assert practice.liquidity_status in ["optimal", "moderate", "low"]
