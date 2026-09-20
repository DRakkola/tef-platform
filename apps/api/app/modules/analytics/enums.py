"""Enumerations and controlled taxonomy for analytics, feedback, and experiments."""

import enum


class EventType(str, enum.Enum):
    """Standardized event taxonomy for platform operations and student telemetry."""

    # AUTH
    USER_REGISTERED = "user_registered"
    EMAIL_VERIFIED = "email_verified"
    LOGIN_SUCCEEDED = "login_succeeded"
    LOGIN_FAILED = "login_failed"

    # ONBOARDING
    ONBOARDING_STARTED = "onboarding_started"
    ONBOARDING_STEP_COMPLETED = "onboarding_step_completed"
    ONBOARDING_COMPLETED = "onboarding_completed"
    ONBOARDING_SKIPPED = "onboarding_skipped"
    TARGET_SET = "target_set"

    # ASSESSMENT
    ASSESSMENT_VIEWED = "assessment_viewed"
    ASSESSMENT_STARTED = "assessment_started"
    QUESTION_ANSWERED = "question_answered"
    ASSESSMENT_SUBMITTED = "assessment_submitted"
    ASSESSMENT_EXPIRED = "assessment_expired"
    RESULT_VIEWED = "result_viewed"

    # LEARNING
    EXERCISE_STARTED = "exercise_started"
    EXERCISE_COMPLETED = "exercise_completed"
    EXERCISE_FAILED = "exercise_failed"
    RECOMMENDATION_VIEWED = "recommendation_viewed"
    RECOMMENDATION_STARTED = "recommendation_started"
    RECOMMENDATION_COMPLETED = "recommendation_completed"
    DAILY_PLAN_VIEWED = "daily_plan_viewed"

    # WRITING
    WRITING_VIEWED = "writing_viewed"
    WRITING_STARTED = "writing_started"
    WRITING_SUBMITTED = "writing_submitted"
    WRITING_CORRECTION_VIEWED = "writing_correction_viewed"

    # SPEAKING
    SPEAKING_VIEWED = "speaking_viewed"
    AI_SPEAKING_STARTED = "ai_speaking_started"
    AI_SPEAKING_COMPLETED = "ai_speaking_completed"
    TEACHER_SPEAKING_STARTED = "teacher_speaking_started"
    TEACHER_SPEAKING_COMPLETED = "teacher_speaking_completed"

    # PRACTICE POOL
    PRACTICE_POOL_VIEWED = "practice_pool_viewed"
    PRACTICE_QUEUE_JOINED = "practice_queue_joined"
    PRACTICE_MATCH_CREATED = "practice_match_created"
    PRACTICE_SESSION_STARTED = "practice_session_started"
    PRACTICE_SESSION_COMPLETED = "practice_session_completed"

    # TEACHERS
    TEACHER_VIEWED = "teacher_viewed"
    TEACHER_AVAILABILITY_VIEWED = "teacher_availability_viewed"
    BOOKING_STARTED = "booking_started"
    BOOKING_CREATED = "booking_created"
    BOOKING_COMPLETED = "booking_completed"
    BOOKING_CANCELLED = "booking_cancelled"

    # BILLING
    PRICING_VIEWED = "pricing_viewed"
    BILLING_PAYWALL_VIEWED = "pricing_viewed"
    CHECKOUT_STARTED = "checkout_started"
    PURCHASE_COMPLETED = "purchase_completed"
    PURCHASE_FAILED = "purchase_failed"
    SUBSCRIPTION_STARTED = "subscription_started"
    SUBSCRIPTION_CANCELLED = "subscription_cancelled"
    CREDIT_CONSUMED = "credit_consumed"

    # ENGAGEMENT
    DASHBOARD_VIEWED = "dashboard_viewed"
    PROGRESS_VIEWED = "progress_viewed"
    READINESS_VIEWED = "readiness_viewed"
    FEEDBACK_SUBMITTED = "feedback_submitted"
    SUPPORT_TICKET_CREATED = "support_ticket_created"

    # EXPERIMENTS
    EXPERIMENT_VIEWED = "experiment_viewed"
    EXPERIMENT_ACTION = "experiment_action"
    EXPERIMENT_ASSIGNED = "experiment_assigned"
    EXPERIMENT_CONVERTED = "experiment_converted"


class FeedbackCategory(str, enum.Enum):
    """Categorization for student and user feedback."""

    TECHNICAL = "technical"
    CONTENT = "content"
    AI = "ai"
    TEACHER = "teacher"
    BOOKING = "booking"
    BILLING = "billing"
    PRACTICE_POOL = "practice_pool"
    GENERAL = "general"


class SupportTicketStatus(str, enum.Enum):
    """Lifecycle statuses for support tickets."""

    OPEN = "open"
    IN_PROGRESS = "in_progress"
    WAITING_USER = "waiting_user"
    RESOLVED = "resolved"
    CLOSED = "closed"


class SupportTicketPriority(str, enum.Enum):
    """Priority level for support ticket triage."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class ExperimentStatus(str, enum.Enum):
    """Lifecycle states for product A/B experiments."""

    DRAFT = "draft"
    RUNNING = "running"
    ACTIVE = "running"
    PAUSED = "paused"
    CONCLUDED = "concluded"


class OnboardingStatus(str, enum.Enum):
    """Student onboarding lifecycle state."""

    INCOMPLETE = "incomplete"
    COMPLETED = "completed"
    SKIPPED = "skipped"
