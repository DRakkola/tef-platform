"""V2.1 Regression Tests — Segmentation, Engagement, Readiness, and Feedback Loop.

These tests guard the V2.1 optimization layer against regressions.
All tests use the shared SQLite in-memory fixture (db_session / client).
No external services are hit; no PII is logged.
"""

import datetime
import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.modules.assessments.enums import AssessmentType, AttemptStatus
from app.modules.assessments.models import Assessment, Attempt, Skill, SkillCategory
from app.modules.billing.enums import BillingInterval, OrderStatus, ProductType, SubscriptionStatus
from app.modules.billing.models import Order, Product, ProductPrice, Subscription
from app.modules.learning.enums import RecommendationStatus, RecommendationType
from app.modules.learning.models import Exercise, Recommendation
from app.modules.learning.schemas import RecommendationFeedbackRequest
from app.modules.students.segmentation_service import StudentSegmentationService
from app.modules.teachers.models import TeacherBooking
from app.modules.users.models import StudentProfile, TeacherProfile, TeacherVerificationStatus, User, UserRole


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_user(
    role: UserRole = UserRole.STUDENT,
    created_days_ago: int = 0,
    last_login_days_ago: int | None = None,
) -> User:
    now = datetime.datetime.now(datetime.UTC)
    created = now - datetime.timedelta(days=created_days_ago)
    last_login = (now - datetime.timedelta(days=last_login_days_ago)) if last_login_days_ago is not None else None
    return User(
        id=uuid.uuid4(),
        email=f"v2test_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("ValidPass123!"),
        role=role,
        is_active=True,
        is_verified=True,
        created_at=created,
        last_login_at=last_login,
    )


# ---------------------------------------------------------------------------
# 1. StudentSegmentationService.evaluate_student_segment
# ---------------------------------------------------------------------------


class TestStudentSegmentEvaluation:
    """Verify 8-segment priority cascade is correct and deterministic."""

    @pytest.mark.asyncio
    async def test_no_user_returns_new_student(self, db_session: AsyncSession) -> None:
        """Missing user ID yields new_student (safe default)."""
        result = await StudentSegmentationService.evaluate_student_segment(
            db_session, uuid.uuid4()
        )
        assert result == "new_student"

    @pytest.mark.asyncio
    async def test_premium_student_via_subscription(self, db_session: AsyncSession) -> None:
        user = make_user()
        db_session.add(user)
        await db_session.flush()

        product = Product(
            id=uuid.uuid4(),
            sku=f"sub_sku_{uuid.uuid4().hex[:6]}",
            name="Premium Sub",
            product_type=ProductType.SUBSCRIPTION,
        )
        price = ProductPrice(
            id=uuid.uuid4(),
            product_id=product.id,
            amount_cents=2999,
            currency="CAD",
            billing_interval=BillingInterval.MONTHLY,
        )
        db_session.add_all([product, price])
        await db_session.flush()

        now = datetime.datetime.now(datetime.UTC)
        sub = Subscription(
            id=uuid.uuid4(),
            user_id=user.id,
            product_id=product.id,
            price_id=price.id,
            provider_subscription_id=f"sub_{uuid.uuid4().hex[:8]}",
            status=SubscriptionStatus.ACTIVE,
            current_period_start=now,
            current_period_end=now + datetime.timedelta(days=30),
        )
        db_session.add(sub)
        await db_session.flush()

        result = await StudentSegmentationService.evaluate_student_segment(db_session, user.id)
        assert result == "premium_student"

    @pytest.mark.asyncio
    async def test_premium_student_via_paid_order(self, db_session: AsyncSession) -> None:
        user = make_user()
        db_session.add(user)
        await db_session.flush()

        order = Order(
            id=uuid.uuid4(),
            order_number=f"ORD-{uuid.uuid4().hex[:8]}",
            user_id=user.id,
            status=OrderStatus.PAID,
            subtotal_cents=4999,
            total_cents=4999,
            currency="CAD",
        )
        db_session.add(order)
        await db_session.flush()

        result = await StudentSegmentationService.evaluate_student_segment(db_session, user.id)
        assert result == "premium_student"

    @pytest.mark.asyncio
    async def test_teacher_engaged_student(self, db_session: AsyncSession) -> None:
        student = make_user()
        teacher_user = make_user(role=UserRole.TEACHER)
        db_session.add_all([student, teacher_user])
        await db_session.flush()

        teacher_profile = TeacherProfile(
            id=uuid.uuid4(),
            user_id=teacher_user.id,
            display_name="Professeur Martin",
            bio="Teacher bio",
            verification_status=TeacherVerificationStatus.APPROVED,
        )
        db_session.add(teacher_profile)
        await db_session.flush()

        now = datetime.datetime.now(datetime.UTC)
        booking = TeacherBooking(
            id=uuid.uuid4(),
            student_id=student.id,
            teacher_id=teacher_profile.id,
            start_time=now + datetime.timedelta(days=1),
            end_time=now + datetime.timedelta(days=1, hours=1),
        )
        db_session.add(booking)
        await db_session.flush()

        result = await StudentSegmentationService.evaluate_student_segment(db_session, student.id)
        assert result == "teacher_engaged_student"

    @pytest.mark.asyncio
    async def test_new_student_freshly_registered(self, db_session: AsyncSession) -> None:
        """A brand new user with no activity should be new_student."""
        user = make_user(created_days_ago=0, last_login_days_ago=0)
        db_session.add(user)
        await db_session.flush()

        result = await StudentSegmentationService.evaluate_student_segment(db_session, user.id)
        assert result == "new_student"

    @pytest.mark.asyncio
    async def test_activated_student_with_completed_assessment(self, db_session: AsyncSession) -> None:
        user = make_user(created_days_ago=5, last_login_days_ago=3)
        db_session.add(user)
        await db_session.flush()

        profile = StudentProfile(
            id=uuid.uuid4(),
            user_id=user.id,
            target_exam="TEF Canada",
            target_level="B2",
            onboarding_status="completed",
        )
        db_session.add(profile)

        assessment = Assessment(
            id=uuid.uuid4(),
            title="Test Assessment",
            assessment_type=AssessmentType.MIXED,
            duration_seconds=1800,
        )
        db_session.add(assessment)
        await db_session.flush()

        attempt = Attempt(
            id=uuid.uuid4(),
            user_id=user.id,
            assessment_id=assessment.id,
            status=AttemptStatus.SUBMITTED,
            submitted_at=datetime.datetime.now(datetime.UTC) - datetime.timedelta(days=1),
        )
        db_session.add(attempt)
        await db_session.flush()

        result = await StudentSegmentationService.evaluate_student_segment(db_session, user.id)
        assert result == "activated_student"


# ---------------------------------------------------------------------------
# 2. StudentSegmentationService.compute_engagement_status
# ---------------------------------------------------------------------------


class TestComputeEngagementStatus:
    """Verify engagement classification thresholds."""

    @pytest.mark.asyncio
    async def test_no_user_returns_new_status(self, db_session: AsyncSession) -> None:
        result = await StudentSegmentationService.compute_engagement_status(
            db_session, uuid.uuid4()
        )
        assert result["status"] == "new"
        assert result["days_inactive"] == 0

    @pytest.mark.asyncio
    async def test_fresh_user_is_new(self, db_session: AsyncSession) -> None:
        user = make_user(created_days_ago=1, last_login_days_ago=0)
        db_session.add(user)
        await db_session.flush()

        result = await StudentSegmentationService.compute_engagement_status(db_session, user.id)
        assert result["status"] in ("new", "on_track")
        assert result["days_inactive"] <= 1

    @pytest.mark.asyncio
    async def test_dormant_after_14_days_inactive(self, db_session: AsyncSession) -> None:
        user = make_user(created_days_ago=30, last_login_days_ago=15)
        db_session.add(user)
        await db_session.flush()

        result = await StudentSegmentationService.compute_engagement_status(db_session, user.id)
        assert result["status"] == "dormant"
        assert result["days_inactive"] >= 14

    @pytest.mark.asyncio
    async def test_at_risk_5_to_13_days_inactive(self, db_session: AsyncSession) -> None:
        user = make_user(created_days_ago=20, last_login_days_ago=6)
        db_session.add(user)
        await db_session.flush()

        result = await StudentSegmentationService.compute_engagement_status(db_session, user.id)
        assert result["status"] in ("at_risk", "needs_reengagement")
        assert result["days_inactive"] >= 5

    @pytest.mark.asyncio
    async def test_on_track_recent_activity(self, db_session: AsyncSession) -> None:
        user = make_user(created_days_ago=10, last_login_days_ago=0)
        db_session.add(user)
        await db_session.flush()

        result = await StudentSegmentationService.compute_engagement_status(db_session, user.id)
        # Should be on_track or new; never dormant/at_risk/needs_reengagement
        assert result["status"] not in ("dormant", "at_risk")
        assert result["days_inactive"] == 0

    @pytest.mark.asyncio
    async def test_risk_factors_included_when_inactive(self, db_session: AsyncSession) -> None:
        user = make_user(created_days_ago=30, last_login_days_ago=8)
        db_session.add(user)
        await db_session.flush()

        result = await StudentSegmentationService.compute_engagement_status(db_session, user.id)
        assert isinstance(result["risk_factors"], list)
        assert len(result["risk_factors"]) >= 1

    @pytest.mark.asyncio
    async def test_response_has_required_keys(self, db_session: AsyncSession) -> None:
        user = make_user()
        db_session.add(user)
        await db_session.flush()

        result = await StudentSegmentationService.compute_engagement_status(db_session, user.id)
        for key in ("status", "label_fr", "days_inactive", "pending_writing_corrections",
                    "incomplete_recommendations", "unresolved_blockers", "risk_factors"):
            assert key in result, f"Missing key: {key}"


# ---------------------------------------------------------------------------
# 3. RecommendationFeedbackRequest schema validation
# ---------------------------------------------------------------------------


class TestRecommendationFeedbackSchema:
    """Pydantic schema guards on rating bounds."""

    def test_valid_rating_accepted(self) -> None:
        for rating in (1, 2, 3, 4, 5):
            req = RecommendationFeedbackRequest(relevance_rating=rating)
            assert req.relevance_rating == rating

    def test_rating_below_1_rejected(self) -> None:
        import pydantic
        with pytest.raises(pydantic.ValidationError):
            RecommendationFeedbackRequest(relevance_rating=0)

    def test_rating_above_5_rejected(self) -> None:
        import pydantic
        with pytest.raises(pydantic.ValidationError):
            RecommendationFeedbackRequest(relevance_rating=6)

    def test_optional_reason_defaults_none(self) -> None:
        req = RecommendationFeedbackRequest(relevance_rating=3)
        assert req.reason is None

    def test_dismiss_defaults_false(self) -> None:
        req = RecommendationFeedbackRequest(relevance_rating=4)
        assert req.dismiss_recommendation is False


# ---------------------------------------------------------------------------
# 4. Recommendation feedback -> auto-dismiss on low rating
# ---------------------------------------------------------------------------


class TestRecommendationFeedbackAutoDismiss:
    """Low-relevance feedback (<=2) auto-dismisses the recommendation."""

    @pytest.mark.asyncio
    async def test_rating_le2_dismisses_recommendation(self, db_session: AsyncSession) -> None:
        from app.modules.learning.service import LearningService

        user = make_user()
        db_session.add(user)

        skill = Skill(
            id=uuid.uuid4(),
            name="Test Skill",
            code=f"TSK_{uuid.uuid4().hex[:4]}",
            category=SkillCategory.GRAMMAR,
        )
        exercise = Exercise(
            id=uuid.uuid4(),
            title="Test Exercise",
            category=SkillCategory.GRAMMAR,
            level="B1",
            prompt="Complétez la phrase test.",
            is_published=True,
        )
        db_session.add_all([skill, exercise])
        await db_session.flush()

        rec = Recommendation(
            id=uuid.uuid4(),
            user_id=user.id,
            skill_id=skill.id,
            entity_id=exercise.id,
            entity_type="exercise",
            recommendation_type=RecommendationType.EXERCISE,
            reason="Targeted grammar practice",
            status=RecommendationStatus.ACTIVE,
        )
        db_session.add(rec)
        await db_session.flush()

        result = await LearningService.submit_recommendation_feedback(
            db=db_session,
            recommendation_id=rec.id,
            user_id=user.id,
            relevance_rating=1,
        )
        assert result["status"] == RecommendationStatus.DISMISSED

    @pytest.mark.asyncio
    async def test_rating_ge3_keeps_recommendation_active(self, db_session: AsyncSession) -> None:
        from app.modules.learning.service import LearningService

        user = make_user()
        db_session.add(user)

        skill = Skill(
            id=uuid.uuid4(),
            name="Test Skill 2",
            code=f"TSK_{uuid.uuid4().hex[:4]}",
            category=SkillCategory.GRAMMAR,
        )
        exercise = Exercise(
            id=uuid.uuid4(),
            title="Test Exercise 2",
            category=SkillCategory.GRAMMAR,
            level="B1",
            prompt="Complétez la phrase test 2.",
            is_published=True,
        )
        db_session.add_all([skill, exercise])
        await db_session.flush()

        rec = Recommendation(
            id=uuid.uuid4(),
            user_id=user.id,
            skill_id=skill.id,
            entity_id=exercise.id,
            entity_type="exercise",
            recommendation_type=RecommendationType.EXERCISE,
            reason="Targeted grammar practice 2",
            status=RecommendationStatus.ACTIVE,
        )
        db_session.add(rec)
        await db_session.flush()

        result = await LearningService.submit_recommendation_feedback(
            db=db_session,
            recommendation_id=rec.id,
            user_id=user.id,
            relevance_rating=4,
        )
        assert result["status"] == RecommendationStatus.ACTIVE

    @pytest.mark.asyncio
    async def test_explicit_dismiss_flag_overrides_rating(self, db_session: AsyncSession) -> None:
        from app.modules.learning.service import LearningService

        user = make_user()
        db_session.add(user)

        skill = Skill(
            id=uuid.uuid4(),
            name="Test Skill 3",
            code=f"TSK_{uuid.uuid4().hex[:4]}",
            category=SkillCategory.GRAMMAR,
        )
        exercise = Exercise(
            id=uuid.uuid4(),
            title="Test Exercise 3",
            category=SkillCategory.GRAMMAR,
            level="B2",
            prompt="Complétez la phrase test 3.",
            is_published=True,
        )
        db_session.add_all([skill, exercise])
        await db_session.flush()

        rec = Recommendation(
            id=uuid.uuid4(),
            user_id=user.id,
            skill_id=skill.id,
            entity_id=exercise.id,
            entity_type="exercise",
            recommendation_type=RecommendationType.EXERCISE,
            reason="Targeted grammar practice 3",
            status=RecommendationStatus.ACTIVE,
        )
        db_session.add(rec)
        await db_session.flush()

        # High rating + explicit dismiss flag -> should still dismiss
        result = await LearningService.submit_recommendation_feedback(
            db=db_session,
            recommendation_id=rec.id,
            user_id=user.id,
            relevance_rating=5,
            dismiss_recommendation=True,
        )
        assert result["status"] == RecommendationStatus.DISMISSED


# ---------------------------------------------------------------------------
# 5. Dashboard endpoint smoke test — segment/engagement_status in response
# ---------------------------------------------------------------------------


class TestDashboardSegmentAndEngagementFields:
    """Dashboard response includes V2.1 segment and engagement_status fields."""

    @pytest.mark.asyncio
    async def test_dashboard_has_segment_field(
        self,
        client,
        test_student: User,
        student_auth_headers: dict[str, str],
    ) -> None:
        res = await client.get("/api/v1/students/me/dashboard", headers=student_auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert "segment" in data
        assert isinstance(data["segment"], str)
        assert data["segment"] in StudentSegmentationService.SEGMENTS

    @pytest.mark.asyncio
    async def test_dashboard_has_engagement_status_field(
        self,
        client,
        test_student: User,
        student_auth_headers: dict[str, str],
    ) -> None:
        res = await client.get("/api/v1/students/me/dashboard", headers=student_auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert "engagement_status" in data
        es = data["engagement_status"]
        assert isinstance(es, dict)
        assert "status" in es
        assert "label_fr" in es
        assert es["status"] in ("new", "on_track", "needs_reengagement", "at_risk", "dormant")
