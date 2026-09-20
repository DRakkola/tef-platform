"""Learning service managing student skills, mistakes, recommendations, and exercise attempts."""

import datetime
import uuid
from typing import Any

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import AppException
from app.modules.assessments.models import (
    Assessment,
    Attempt,
    Question,
    Skill,
)
from app.modules.assessments.scoring import ScoreCalculationResult
from app.modules.learning.activity import ActivityTracker
from app.modules.learning.engine import RecommendationEngine, SkillEngine
from app.modules.learning.enums import (
    RecommendationStatus,
    RecommendationType,
    SkillCategory,
)
from app.modules.learning.levels import LevelEstimationService
from app.modules.learning.models import (
    Exercise,
    ExerciseAttempt,
    ExerciseSkill,
    Mistake,
    Recommendation,
    SkillAssessment,
    StudentSkill,
)
from app.modules.learning.readiness_engine import ReadinessEngine
from app.modules.learning.recommendations_v2 import RecommendationEngineV2
from app.modules.learning.schemas import ExerciseAttemptRequest

logger = structlog.get_logger("tef-api.learning")


class LearningService:
    """Core intelligence service connecting assessment results to skill tracking and recommendations."""

    @staticmethod
    async def process_assessment_submission(
        db: AsyncSession,
        attempt: Attempt,
        assessment: Assessment,
        score_result: ScoreCalculationResult,
    ) -> None:
        """Hook executed when an assessment is submitted:
        1. Logs Mistakes for incorrect answers.
        2. Logs immutable SkillAssessment historical snapshots.
        3. Updates StudentSkill rolling mastery estimates and confidence.
        4. Triggers deterministic RecommendationEngine.
        """
        now = datetime.datetime.now(datetime.UTC)

        # 0. Strict Idempotency: Check if this assessment attempt was already processed
        already_processed = await db.scalar(
            select(SkillAssessment.id)
            .where(
                SkillAssessment.source_id == attempt.id,
                SkillAssessment.source_type == "assessment_attempt",
            )
            .limit(1)
        )
        if already_processed:
            logger.info("assessment_submission_already_processed", attempt_id=str(attempt.id))
            return

        # 1. Map questions and identify incorrect answers
        question_map: dict[uuid.UUID, Question] = {}
        for section in assessment.sections:
            for q in section.questions:
                question_map[q.id] = q

        for ans in score_result.evaluated_answers:
            if not ans.is_correct:
                question = question_map.get(ans.question_id)
                if not question:
                    continue

                # Determine student response and correct response text
                user_ans_text = ans.text_response
                correct_ans_text = ""
                for opt in question.options:
                    if opt.is_correct:
                        correct_ans_text = opt.content
                    if ans.selected_option_id and opt.id == ans.selected_option_id:
                        user_ans_text = opt.content

                if not user_ans_text:
                    user_ans_text = "Non répondu"

                # Record mistake for each skill tag associated with this question
                for tag in question.skill_tags:
                    # Check if previous mistake exists for this question and student
                    existing_mistake = await db.scalar(
                        select(Mistake).where(
                            Mistake.user_id == attempt.user_id,
                            Mistake.question_id == question.id,
                            Mistake.skill_id == tag.skill_id,
                        )
                    )
                    if existing_mistake:
                        existing_mistake.error_count += 1
                        existing_mistake.last_occurred_at = now
                        existing_mistake.user_answer = user_ans_text
                    else:
                        mistake = Mistake(
                            user_id=attempt.user_id,
                            skill_id=tag.skill_id,
                            subskill=tag.subskill,
                            source_type="assessment",
                            source_id=attempt.id,
                            question_id=question.id,
                            user_answer=user_ans_text,
                            correct_answer=correct_ans_text,
                            explanation=question.explanation,
                            error_count=1,
                            last_occurred_at=now,
                        )
                        db.add(mistake)

        # 2. Record immutable SkillAssessments and update StudentSkills
        # Collect skills to update: skill_obj and its parent hierarchy
        skills_to_record: list[tuple[Skill, float, float, float]] = []
        for skill_code, skill_metric in score_result.skill_scores.items():
            # Resolve skill record by code or ID
            skill_obj = await db.scalar(select(Skill).where(Skill.code == skill_code))
            if not skill_obj:
                try:
                    uuid_val = uuid.UUID(skill_code)
                    skill_obj = await db.scalar(select(Skill).where(Skill.id == uuid_val))
                except ValueError, TypeError:
                    continue
            if not skill_obj:
                continue

            score_pct = float(skill_metric["percentage"])
            pts_earned = float(skill_metric["earned"])
            pts_max = float(skill_metric["max"])
            skills_to_record.append((skill_obj, score_pct, pts_earned, pts_max))

            if skill_obj.parent_id:
                parent_obj = await db.scalar(select(Skill).where(Skill.id == skill_obj.parent_id))
                if parent_obj and parent_obj.id not in [s[0].id for s in skills_to_record]:
                    skills_to_record.append((parent_obj, score_pct, pts_earned, pts_max))

        for target_skill, score_pct, pts_earned, pts_max in skills_to_record:
            snap_level = LevelEstimationService.estimate_cefr(score_pct)
            # 2a. IMMUTABLE historical snapshot
            skill_assessment = SkillAssessment(
                user_id=attempt.user_id,
                skill_id=target_skill.id,
                source_type="assessment_attempt",
                source_id=attempt.id,
                score=score_pct,
                points_earned=pts_earned,
                points_possible=pts_max,
                estimated_level=snap_level,
                confidence=0.8,
                assessed_at=now,
            )
            db.add(skill_assessment)

            # Ingest append-only SkillEvidence
            await ReadinessEngine.ingest_evidence(
                db=db,
                student_id=attempt.user_id,
                skill_id=target_skill.id,
                source_type="assessment",
                source_id=attempt.id,
                raw_score=pts_earned,
                normalized_score=score_pct,
                confidence=0.85,
                weight=1.0,
                observed_at=now,
                metadata_payload={"assessment_id": str(attempt.assessment_id), "points_possible": pts_max},
            )

            # 2b. Rolling StudentSkill estimate update
            student_skill = await db.scalar(
                select(StudentSkill).where(
                    StudentSkill.user_id == attempt.user_id,
                    StudentSkill.skill_id == target_skill.id,
                )
            )
            if student_skill:
                new_mastery, new_conf = SkillEngine.update_mastery(
                    current_mastery=student_skill.mastery_score,
                    attempts_count=student_skill.attempts_count,
                    new_score=score_pct,
                    source_type="assessment_attempt",
                )
                student_skill.mastery_score = new_mastery
                student_skill.confidence = new_conf
                student_skill.attempts_count += 1
                if score_pct >= 60.0:
                    student_skill.successful_attempts += 1
                student_skill.estimated_level = LevelEstimationService.estimate_cefr(new_mastery)
                student_skill.last_assessed_at = now
            else:
                new_mastery, new_conf = SkillEngine.update_mastery(
                    current_mastery=0.0,
                    attempts_count=0,
                    new_score=score_pct,
                    source_type="assessment_attempt",
                )
                student_skill = StudentSkill(
                    user_id=attempt.user_id,
                    skill_id=target_skill.id,
                    mastery_score=new_mastery,
                    confidence=new_conf,
                    attempts_count=1,
                    successful_attempts=1 if score_pct >= 60.0 else 0,
                    estimated_level=LevelEstimationService.estimate_cefr(new_mastery),
                    last_assessed_at=now,
                )
                db.add(student_skill)

        await db.flush()

        # 3. Deterministic Recommendation Engine V2
        await RecommendationEngineV2.generate_recommendations(
            db=db,
            user_id=attempt.user_id,
        )

        # 4. Activity Event Logging
        await ActivityTracker.record_activity(
            db=db,
            user_id=attempt.user_id,
            event_type="assessment_completed",
            title=f"Épreuve terminée : {assessment.title}",
            entity_type="assessment",
            entity_id=assessment.id,
            metadata={
                "attempt_id": str(attempt.id),
                "score_percentage": score_result.percentage,
                "passed": score_result.is_passed,
                "estimated_level": LevelEstimationService.estimate_cefr(score_result.percentage),
            },
        )

        # 4. Trigger Readiness Engine recalculation & immutable snapshot
        await ReadinessEngine.recalculate_student_readiness(db, attempt.user_id)

    @staticmethod
    async def _generate_recommendations_for_student(
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> None:
        """Evaluate student skills, find gaps below threshold, and generate targeted recommendations."""
        now = datetime.datetime.now(datetime.UTC)

        # Query all student skills below the threshold
        weak_skills = await db.execute(
            select(StudentSkill)
            .where(
                StudentSkill.user_id == user_id,
                StudentSkill.mastery_score < RecommendationEngine.MASTERY_THRESHOLD,
            )
            .options(selectinload(StudentSkill.skill))
        )
        student_skills = weak_skills.scalars().all()

        for ss in student_skills:
            # Count recent mistakes for this student on this skill
            mistake_count_stmt = select(func.sum(Mistake.error_count)).where(
                Mistake.user_id == user_id,
                Mistake.skill_id == ss.skill_id,
            )
            mistakes_total = await db.scalar(mistake_count_stmt) or 0

            # Find matching exercises (direct skill or parent skill)
            target_skill_ids = [ss.skill_id]
            if ss.skill and ss.skill.parent_id:
                target_skill_ids.append(ss.skill.parent_id)

            exercises_stmt = (
                select(Exercise)
                .join(ExerciseSkill, ExerciseSkill.exercise_id == Exercise.id)
                .where(
                    ExerciseSkill.skill_id.in_(target_skill_ids),
                    Exercise.is_published.is_(True),
                )
                .limit(5)
            )
            exercises_result = await db.execute(exercises_stmt)
            matching_exercises = exercises_result.scalars().all()

            priority = RecommendationEngine.calculate_priority(
                mastery_score=ss.mastery_score,
                mistake_count=int(mistakes_total),
            )
            reason = RecommendationEngine.build_recommendation_reason(
                skill_name=ss.skill.name,
                mastery_score=ss.mastery_score,
                mistake_count=int(mistakes_total),
            )

            for ex in matching_exercises:
                # 1. Skip if dismissed within the last 14 days (respect learner feedback)
                recently_dismissed = await db.scalar(
                    select(Recommendation).where(
                        Recommendation.user_id == user_id,
                        Recommendation.entity_id == ex.id,
                        Recommendation.status == RecommendationStatus.DISMISSED,
                        Recommendation.generated_at >= now - datetime.timedelta(days=14),
                    )
                )
                if recently_dismissed:
                    continue

                # 2. Skip if already completed
                already_completed = await db.scalar(
                    select(Recommendation).where(
                        Recommendation.user_id == user_id,
                        Recommendation.entity_id == ex.id,
                        Recommendation.status == RecommendationStatus.COMPLETED,
                    )
                )
                if already_completed:
                    continue

                # 3. Check for existing active recommendation
                existing_rec = await db.scalar(
                    select(Recommendation).where(
                        Recommendation.user_id == user_id,
                        Recommendation.entity_id == ex.id,
                        Recommendation.status == RecommendationStatus.ACTIVE,
                    )
                )
                if existing_rec:
                    # Upgrade priority and update reason if mistakes increased
                    existing_rec.priority = max(existing_rec.priority, priority)
                    existing_rec.reason = reason
                    existing_rec.generated_at = now
                else:
                    new_rec = Recommendation(
                        user_id=user_id,
                        skill_id=ss.skill_id,
                        recommendation_type=RecommendationType.EXERCISE,
                        entity_type="exercise",
                        entity_id=ex.id,
                        reason=reason,
                        priority=priority,
                        status=RecommendationStatus.ACTIVE,
                        generated_at=now,
                    )
                    db.add(new_rec)

        await db.flush()

    @staticmethod
    async def get_student_skills(
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> list[dict[str, Any]]:
        """List current skill estimates and mastery scores for a student."""
        stmt = (
            select(StudentSkill)
            .where(StudentSkill.user_id == user_id)
            .options(selectinload(StudentSkill.skill))
            .order_by(StudentSkill.mastery_score.asc())
        )
        result = await db.execute(stmt)
        skills = result.scalars().all()

        return [
            {
                "id": s.id,
                "user_id": s.user_id,
                "skill_id": s.skill_id,
                "skill_code": s.skill.code,
                "skill_name": s.skill.name,
                "category": s.skill.category,
                "mastery_score": s.mastery_score,
                "confidence": s.confidence,
                "attempts_count": s.attempts_count,
                "successful_attempts": s.successful_attempts,
                "estimated_level": s.estimated_level or LevelEstimationService.estimate_cefr(s.mastery_score),
                "last_assessed_at": s.last_assessed_at,
            }
            for s in skills
        ]

    @staticmethod
    async def get_skill_history(
        db: AsyncSession,
        user_id: uuid.UUID,
        skill_id: uuid.UUID | None = None,
    ) -> list[dict[str, Any]]:
        """Retrieve immutable historical skill assessment snapshots."""
        stmt = (
            select(SkillAssessment)
            .where(SkillAssessment.user_id == user_id)
            .options(selectinload(SkillAssessment.skill))
            .order_by(SkillAssessment.assessed_at.desc())
        )
        if skill_id:
            stmt = stmt.where(SkillAssessment.skill_id == skill_id)

        result = await db.execute(stmt)
        records = result.scalars().all()

        return [
            {
                "id": r.id,
                "user_id": r.user_id,
                "skill_id": r.skill_id,
                "skill_code": r.skill.code,
                "skill_name": r.skill.name,
                "source_type": r.source_type,
                "source_id": r.source_id,
                "score": r.score,
                "points_earned": r.points_earned,
                "points_possible": r.points_possible,
                "estimated_level": r.estimated_level or LevelEstimationService.estimate_cefr(r.score),
                "confidence": r.confidence,
                "assessed_at": r.assessed_at,
            }
            for r in records
        ]

    @staticmethod
    async def get_student_mistakes(
        db: AsyncSession,
        user_id: uuid.UUID,
        skill_id: uuid.UUID | None = None,
    ) -> list[dict[str, Any]]:
        """List student mistake history with explanations and recurrence counts."""
        stmt = (
            select(Mistake)
            .where(Mistake.user_id == user_id)
            .options(selectinload(Mistake.skill))
            .order_by(Mistake.last_occurred_at.desc())
        )
        if skill_id:
            stmt = stmt.where(Mistake.skill_id == skill_id)

        result = await db.execute(stmt)
        mistakes = result.scalars().all()

        return [
            {
                "id": m.id,
                "user_id": m.user_id,
                "skill_id": m.skill_id,
                "skill_code": m.skill.code,
                "skill_name": m.skill.name,
                "subskill": m.subskill,
                "source_type": m.source_type,
                "source_id": m.source_id,
                "question_id": m.question_id,
                "exercise_id": m.exercise_id,
                "user_answer": m.user_answer,
                "correct_answer": m.correct_answer,
                "explanation": m.explanation,
                "error_count": m.error_count,
                "last_occurred_at": m.last_occurred_at,
            }
            for m in mistakes
        ]

    @staticmethod
    async def get_student_recommendations(
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> list[dict[str, Any]]:
        """List active personalized learning recommendations sorted by priority."""
        stmt = (
            select(Recommendation)
            .where(
                Recommendation.user_id == user_id,
                Recommendation.status == RecommendationStatus.ACTIVE,
            )
            .options(selectinload(Recommendation.skill))
            .order_by(Recommendation.priority.desc(), Recommendation.generated_at.desc())
        )
        result = await db.execute(stmt)
        recs = result.scalars().all()

        return [
            {
                "id": r.id,
                "user_id": r.user_id,
                "skill_id": r.skill_id,
                "skill_code": r.skill.code,
                "skill_name": r.skill.name,
                "recommendation_type": r.recommendation_type,
                "entity_type": r.entity_type,
                "entity_id": r.entity_id,
                "reason": r.reason,
                "priority": r.priority,
                "status": r.status,
                "generated_at": r.generated_at,
            }
            for r in recs
        ]

    @staticmethod
    async def update_recommendation_status(
        db: AsyncSession,
        recommendation_id: uuid.UUID,
        user_id: uuid.UUID,
        new_status: RecommendationStatus,
    ) -> dict[str, Any]:
        """Update status of a recommendation (e.g. dismissed or completed)."""
        rec = await db.scalar(
            select(Recommendation)
            .where(
                Recommendation.id == recommendation_id,
                Recommendation.user_id == user_id,
            )
            .options(selectinload(Recommendation.skill))
        )
        if not rec:
            raise AppException(
                message="Recommendation not found",
                code="RECOMMENDATION_NOT_FOUND",
                status_code=404,
            )
        rec.status = new_status
        await db.flush()
        return {
            "id": rec.id,
            "user_id": rec.user_id,
            "skill_id": rec.skill_id,
            "skill_code": rec.skill.code if rec.skill else "",
            "skill_name": rec.skill.name if rec.skill else "",
            "recommendation_type": rec.recommendation_type,
            "entity_type": rec.entity_type,
            "entity_id": rec.entity_id,
            "reason": rec.reason,
            "priority": rec.priority,
            "status": rec.status,
            "generated_at": rec.generated_at,
        }

    @staticmethod
    async def submit_recommendation_feedback(
        db: AsyncSession,
        recommendation_id: uuid.UUID,
        user_id: uuid.UUID,
        relevance_rating: int,
        reason: str | None = None,
        dismiss_recommendation: bool = False,
    ) -> dict[str, Any]:
        """Record feedback on a recommendation, adjusting its status if dismissed or low-relevance."""
        rec = await db.scalar(
            select(Recommendation)
            .where(
                Recommendation.id == recommendation_id,
                Recommendation.user_id == user_id,
            )
            .options(selectinload(Recommendation.skill))
        )
        if not rec:
            raise AppException(
                message="Recommendation not found",
                code="RECOMMENDATION_NOT_FOUND",
                status_code=404,
            )

        from app.modules.analytics.models import UserFeedback
        from app.modules.analytics.enums import FeedbackCategory

        feedback = UserFeedback(
            user_id=user_id,
            category=FeedbackCategory.CONTENT,
            rating=relevance_rating,
            message=reason or f"Recommendation relevance rating: {relevance_rating}/5",
            context_url=f"/recommendations/{recommendation_id}",
            metadata_payload={
                "recommendation_id": str(recommendation_id),
                "entity_type": rec.entity_type,
                "entity_id": str(rec.entity_id),
                "skill_id": str(rec.skill_id),
                "rating": relevance_rating,
            },
        )
        db.add(feedback)

        if dismiss_recommendation or relevance_rating <= 2:
            rec.status = RecommendationStatus.DISMISSED

        await db.flush()
        return {
            "recommendation_id": rec.id,
            "relevance_rating": relevance_rating,
            "reason": reason,
            "status": rec.status,
            "message": "Feedback recorded and recommendation dismissed" if rec.status == RecommendationStatus.DISMISSED else "Feedback recorded successfully",
        }

    @staticmethod
    async def list_exercises(
        db: AsyncSession,
        category: SkillCategory | None = None,
        skill_id: uuid.UUID | None = None,
        level: str | None = None,
    ) -> list[dict[str, Any]]:
        """List exercises for practice with optional skill and level filtering."""
        stmt = (
            select(Exercise)
            .where(Exercise.is_published.is_(True))
            .options(selectinload(Exercise.skills).selectinload(ExerciseSkill.skill))
            .order_by(Exercise.created_at.desc())
        )
        if category:
            stmt = stmt.where(Exercise.category == category)
        if level:
            stmt = stmt.where(Exercise.level == level)
        if skill_id:
            stmt = stmt.join(ExerciseSkill, ExerciseSkill.exercise_id == Exercise.id).where(
                ExerciseSkill.skill_id == skill_id
            )

        result = await db.execute(stmt)
        exercises = result.scalars().all()

        output: list[dict[str, Any]] = []
        for ex in exercises:
            opts = [
                {"content": opt.get("content", ""), "order_index": idx}
                for idx, opt in enumerate(ex.options_payload)
            ]
            output.append(
                {
                    "id": ex.id,
                    "title": ex.title,
                    "instructions": ex.instructions,
                    "category": ex.category,
                    "level": ex.level,
                    "difficulty": ex.difficulty,
                    "question_type": ex.question_type,
                    "prompt": ex.prompt,
                    "points": ex.points,
                    "options": opts,
                    "skills": [es.skill.name for es in ex.skills if es.skill],
                }
            )
        return output

    @staticmethod
    async def get_exercise_for_practice(
        db: AsyncSession,
        exercise_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Fetch exercise for taking (concealing correct answers)."""
        stmt = (
            select(Exercise)
            .where(Exercise.id == exercise_id, Exercise.is_published.is_(True))
            .options(selectinload(Exercise.skills).selectinload(ExerciseSkill.skill))
        )
        result = await db.execute(stmt)
        ex = result.scalar_one_or_none()
        if not ex:
            raise AppException(
                message="Exercise not found",
                code="EXERCISE_NOT_FOUND",
                status_code=404,
            )

        opts = [
            {"content": opt.get("content", ""), "order_index": idx}
            for idx, opt in enumerate(ex.options_payload)
        ]
        return {
            "id": ex.id,
            "title": ex.title,
            "instructions": ex.instructions,
            "category": ex.category,
            "level": ex.level,
            "difficulty": ex.difficulty,
            "question_type": ex.question_type,
            "prompt": ex.prompt,
            "points": ex.points,
            "options": opts,
            "skills": [es.skill.name for es in ex.skills if es.skill],
        }

    @staticmethod
    async def submit_exercise_attempt(
        db: AsyncSession,
        exercise_id: uuid.UUID,
        user_id: uuid.UUID,
        req: ExerciseAttemptRequest,
    ) -> dict[str, Any]:
        """Submit practice answer, evaluate correctness, update skills, and resolve recommendations."""
        stmt = (
            select(Exercise)
            .where(Exercise.id == exercise_id, Exercise.is_published.is_(True))
            .options(selectinload(Exercise.skills).selectinload(ExerciseSkill.skill))
        )
        result = await db.execute(stmt)
        ex = result.scalar_one_or_none()
        if not ex:
            raise AppException(
                message="Exercise not found",
                code="EXERCISE_NOT_FOUND",
                status_code=404,
            )

        now = datetime.datetime.now(datetime.UTC)
        is_correct = False
        correct_content = ""
        user_response_str = req.user_response

        # Evaluate correctness from options_payload
        for idx, opt in enumerate(ex.options_payload):
            if opt.get("is_correct"):
                correct_content = opt.get("content", "")
            if req.selected_option_index is not None and req.selected_option_index == idx:
                user_response_str = opt.get("content", "")
                if opt.get("is_correct"):
                    is_correct = True

        pts_awarded = float(ex.points) if is_correct else 0.0

        attempt = ExerciseAttempt(
            user_id=user_id,
            exercise_id=exercise_id,
            is_correct=is_correct,
            points_awarded=pts_awarded,
            user_response=user_response_str,
            attempted_at=now,
        )
        db.add(attempt)
        await db.flush()

        # Update associated StudentSkills and record immutable SkillAssessments
        score_pct = 100.0 if is_correct else 0.0
        for es in ex.skills:
            snap_level = LevelEstimationService.estimate_cefr(score_pct)
            # Historical snapshot
            snap = SkillAssessment(
                user_id=user_id,
                skill_id=es.skill_id,
                source_type="exercise_attempt",
                source_id=attempt.id,
                score=score_pct,
                points_earned=pts_awarded,
                points_possible=float(ex.points),
                estimated_level=snap_level,
                confidence=0.5,
                assessed_at=now,
            )
            db.add(snap)

            # Ingest append-only SkillEvidence
            await ReadinessEngine.ingest_evidence(
                db=db,
                student_id=user_id,
                skill_id=es.skill_id,
                source_type="exercise",
                source_id=attempt.id,
                raw_score=pts_awarded,
                normalized_score=score_pct,
                confidence=0.70,
                weight=0.70,
                observed_at=now,
                metadata_payload={"exercise_id": str(ex.id), "is_correct": is_correct},
            )

            # Rolling student skill
            student_skill = await db.scalar(
                select(StudentSkill).where(
                    StudentSkill.user_id == user_id,
                    StudentSkill.skill_id == es.skill_id,
                )
            )
            if student_skill:
                new_mastery, new_conf = SkillEngine.update_mastery(
                    current_mastery=student_skill.mastery_score,
                    attempts_count=student_skill.attempts_count,
                    new_score=score_pct,
                    source_type="exercise_attempt",
                )
                student_skill.mastery_score = new_mastery
                student_skill.confidence = new_conf
                student_skill.attempts_count += 1
                if is_correct:
                    student_skill.successful_attempts += 1
                student_skill.estimated_level = LevelEstimationService.estimate_cefr(new_mastery)
                student_skill.last_assessed_at = now
            else:
                new_mastery, new_conf = SkillEngine.update_mastery(
                    current_mastery=0.0,
                    attempts_count=0,
                    new_score=score_pct,
                    source_type="exercise_attempt",
                )
                student_skill = StudentSkill(
                    user_id=user_id,
                    skill_id=es.skill_id,
                    mastery_score=new_mastery,
                    confidence=new_conf,
                    attempts_count=1,
                    successful_attempts=1 if is_correct else 0,
                    estimated_level=LevelEstimationService.estimate_cefr(new_mastery),
                    last_assessed_at=now,
                )
                db.add(student_skill)

            # If incorrect, record mistake
            if not is_correct:
                mistake = Mistake(
                    user_id=user_id,
                    skill_id=es.skill_id,
                    subskill=es.subskill,
                    source_type="exercise",
                    source_id=attempt.id,
                    exercise_id=exercise_id,
                    user_answer=user_response_str,
                    correct_answer=correct_content,
                    explanation=ex.explanation,
                    error_count=1,
                    last_occurred_at=now,
                )
                db.add(mistake)

        # If correct, mark linked active recommendation as completed
        if is_correct:
            active_rec = await db.scalar(
                select(Recommendation).where(
                    Recommendation.user_id == user_id,
                    Recommendation.entity_id == exercise_id,
                    Recommendation.status.in_(
                        [
                            RecommendationStatus.ACTIVE,
                            RecommendationStatus.STARTED,
                            RecommendationStatus.PENDING,
                        ]
                    ),
                )
            )
            if active_rec:
                active_rec.status = RecommendationStatus.COMPLETED

        # Activity Event Logging
        await ActivityTracker.record_activity(
            db=db,
            user_id=user_id,
            event_type="exercise_completed",
            title=f"Exercice : {ex.title}",
            entity_type="exercise",
            entity_id=exercise_id,
            metadata={
                "attempt_id": str(attempt.id),
                "is_correct": is_correct,
                "points_awarded": pts_awarded,
            },
        )

        await db.flush()

        # Recalculate student readiness
        await ReadinessEngine.recalculate_student_readiness(db, user_id)

        return {
            "id": attempt.id,
            "user_id": attempt.user_id,
            "exercise_id": attempt.exercise_id,
            "is_correct": attempt.is_correct,
            "points_awarded": attempt.points_awarded,
            "user_response": attempt.user_response,
            "correct_answer": correct_content,
            "explanation": ex.explanation,
            "attempted_at": attempt.attempted_at,
        }

    @staticmethod
    async def get_exercise_attempts(
        db: AsyncSession,
        exercise_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> list[dict[str, Any]]:
        """Retrieve historical attempts by the student for a specific exercise."""
        stmt = (
            select(ExerciseAttempt)
            .where(
                ExerciseAttempt.exercise_id == exercise_id,
                ExerciseAttempt.user_id == user_id,
            )
            .order_by(ExerciseAttempt.attempted_at.desc())
        )
        res = await db.execute(stmt)
        attempts = res.scalars().all()

        ex_stmt = select(Exercise).where(Exercise.id == exercise_id)
        ex_res = await db.execute(ex_stmt)
        ex = ex_res.scalar_one_or_none()
        correct_content = ""
        if ex:
            for opt in ex.options_payload:
                if opt.get("is_correct"):
                    correct_content = opt.get("content", "")
                    break

        return [
            {
                "id": att.id,
                "user_id": att.user_id,
                "exercise_id": att.exercise_id,
                "is_correct": att.is_correct,
                "points_awarded": att.points_awarded,
                "user_response": att.user_response,
                "correct_answer": correct_content,
                "explanation": ex.explanation if ex else None,
                "attempted_at": att.attempted_at,
            }
            for att in attempts
        ]

    @staticmethod
    async def get_exercise_attempt(
        db: AsyncSession,
        attempt_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Retrieve a specific exercise attempt with strict user isolation."""
        stmt = (
            select(ExerciseAttempt)
            .where(
                ExerciseAttempt.id == attempt_id,
                ExerciseAttempt.user_id == user_id,
            )
        )
        res = await db.execute(stmt)
        attempt = res.scalar_one_or_none()
        if not attempt:
            raise AppException(
                message="Exercise attempt not found",
                code="ATTEMPT_NOT_FOUND",
                status_code=404,
            )

        ex_stmt = select(Exercise).where(Exercise.id == attempt.exercise_id)
        ex_res = await db.execute(ex_stmt)
        ex = ex_res.scalar_one_or_none()
        correct_content = ""
        if ex:
            for opt in ex.options_payload:
                if opt.get("is_correct"):
                    correct_content = opt.get("content", "")
                    break

        return {
            "id": attempt.id,
            "user_id": attempt.user_id,
            "exercise_id": attempt.exercise_id,
            "is_correct": attempt.is_correct,
            "points_awarded": attempt.points_awarded,
            "user_response": attempt.user_response,
            "correct_answer": correct_content,
            "explanation": ex.explanation if ex else None,
            "attempted_at": attempt.attempted_at,
        }

    @staticmethod
    async def record_external_skill_assessment(
        db: AsyncSession,
        user_id: uuid.UUID,
        skill_id: uuid.UUID,
        source_type: str,
        source_id: uuid.UUID,
        score: float,
        points_earned: float = 0.0,
        points_possible: float = 100.0,
    ) -> None:
        """Record external score snapshot and update rolling StudentSkill (e.g. AI writing, teacher review)."""
        now = datetime.datetime.now(datetime.UTC)
        score_pct = max(0.0, min(100.0, score))
        est_level = LevelEstimationService.estimate_cefr(score_pct)

        snap = SkillAssessment(
            user_id=user_id,
            skill_id=skill_id,
            source_type=source_type,
            source_id=source_id,
            score=score_pct,
            points_earned=points_earned,
            points_possible=points_possible,
            estimated_level=est_level,
            confidence=0.85,
            assessed_at=now,
        )
        db.add(snap)

        student_skill = await db.scalar(
            select(StudentSkill).where(
                StudentSkill.user_id == user_id,
                StudentSkill.skill_id == skill_id,
            )
        )
        if student_skill:
            new_m, new_c = SkillEngine.update_mastery(
                current_mastery=student_skill.mastery_score,
                attempts_count=student_skill.attempts_count,
                new_score=score_pct,
                source_type=source_type,
            )
            student_skill.mastery_score = new_m
            student_skill.confidence = new_c
            student_skill.attempts_count += 1
            if score_pct >= 60.0:
                student_skill.successful_attempts += 1
            student_skill.estimated_level = LevelEstimationService.estimate_cefr(new_m)
            student_skill.last_assessed_at = now
        else:
            new_m, new_c = SkillEngine.update_mastery(
                current_mastery=0.0,
                attempts_count=0,
                new_score=score_pct,
                source_type=source_type,
            )
            student_skill = StudentSkill(
                user_id=user_id,
                skill_id=skill_id,
                mastery_score=new_m,
                confidence=new_c,
                attempts_count=1,
                successful_attempts=1 if score_pct >= 60.0 else 0,
                estimated_level=LevelEstimationService.estimate_cefr(new_m),
                last_assessed_at=now,
            )
            db.add(student_skill)

        await db.flush()

