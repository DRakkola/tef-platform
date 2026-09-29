"""Database seeder creating a rich demo student with learning loop metrics."""

import asyncio
import datetime
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import app.modules.admin.ai_sandbox_models  # noqa: F401
import app.modules.admin.beta_models  # noqa: F401
import app.modules.admin.models  # noqa: F401
import app.modules.admin.speaking_config_models  # noqa: F401
import app.modules.admin.speaking_scenario_models  # noqa: F401
import app.modules.analytics.models  # noqa: F401
import app.modules.assessments.models  # noqa: F401
import app.modules.billing.models  # noqa: F401
import app.modules.learning.models  # noqa: F401
import app.modules.practice_pool.models  # noqa: F401
import app.modules.speaking.models  # noqa: F401
import app.modules.teachers.models  # noqa: F401
import app.modules.users.models  # noqa: F401
import app.modules.writing.models  # noqa: F401

from app.core.config import settings
from app.core.security import hash_password
from app.modules.assessments.enums import AssessmentType, AttemptStatus, QuestionType
from app.modules.assessments.models import (
    Assessment,
    AssessmentSection,
    Attempt,
    AttemptScore,
    Question,
    QuestionOption,
    QuestionSkillTag,
    Skill,
)
from app.modules.learning.enums import RecommendationStatus, RecommendationType, SkillCategory
from app.modules.learning.models import Exercise, Recommendation, SkillAssessment, StudentSkill
from app.modules.teachers.enums import BookingStatus
from app.modules.teachers.models import TeacherBooking
from app.modules.users.models import StudentProfile, TeacherProfile, TeacherVerificationStatus, User, UserRole

DEMO_EMAIL = "student.demo@example.com"
DEMO_PASSWORD = "DemoStudent2026!"
TEACHER_EMAIL = "teacher.jean@example.com"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "AdminPass2026!"


async def seed():
    from app.core.database import async_session_factory, engine

    async with async_session_factory() as session:
        # 0. Admin User
        admin_res = await session.execute(select(User).where(User.email == ADMIN_EMAIL))
        admin_user = admin_res.scalar_one_or_none()
        if not admin_user:
            admin_user = User(
                email=ADMIN_EMAIL,
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
            )
            session.add(admin_user)
            await session.flush()
            print(f"Created admin user: {admin_user.email}")
        else:
            print(f"Admin user already exists: {admin_user.email}")

        # 1. Demo Student User
        res = await session.execute(select(User).where(User.email == DEMO_EMAIL))
        user = res.scalar_one_or_none()

        if not user:
            user = User(
                email=DEMO_EMAIL,
                role=UserRole.STUDENT,
                is_active=True,
                is_verified=True,
            )
            session.add(user)
            await session.flush()

            profile = StudentProfile(
                user_id=user.id,
                target_exam="TEF Canada",
                target_level="B2",
                timezone="UTC",
            )
            session.add(profile)
            await session.flush()
            print(f"Created demo student: {user.email}")
        else:
            print(f"Demo student already exists: {user.email}")

        # 2. Teacher User & Profile
        teacher_res = await session.execute(select(User).where(User.email == TEACHER_EMAIL))
        teacher_user = teacher_res.scalar_one_or_none()
        if not teacher_user:
            teacher_user = User(
                email=TEACHER_EMAIL,
                role=UserRole.TEACHER,
                is_active=True,
                is_verified=True,
            )
            session.add(teacher_user)
            await session.flush()

            teacher_profile = TeacherProfile(
                user_id=teacher_user.id,
                display_name="Professeur Jean Dupont",
                bio="Plus de 10 ans d'expérience dans la préparation intensive aux épreuves du TEF Canada.",
                expertise=["Expression Orale", "Compréhension Écrite", "TEF Canada"],
                teaching_levels=["B1", "B2", "C1"],
                hourly_price=4500,
                verification_status=TeacherVerificationStatus.APPROVED,
                timezone="UTC",
            )
            session.add(teacher_profile)
            await session.flush()
        else:
            tp_res = await session.execute(
                select(TeacherProfile).where(TeacherProfile.user_id == teacher_user.id)
            )
            teacher_profile = tp_res.scalar_one()

        # 3. Skills
        skills_data = [
            ("GRAM_SUBJ", "Subjonctif et Connecteurs Logiques", SkillCategory.GRAMMAR, "Grammaire complexe et argumentation"),
            ("LIST_RADIO", "Compréhension Orale Rapide", SkillCategory.LISTENING, "Documents audio natifs et chroniques radio"),
            ("READ_FAITS", "Compréhension Écrite — Faits Divers", SkillCategory.READING, "Articles de presse et notes administratives"),
            ("WRIT_SECTB", "Expression Écrite — Section B", SkillCategory.WRITING, "Lettre formelle argumentative et plaidoyer"),
        ]

        created_skills = []
        for code, name, category, desc in skills_data:
            s_res = await session.execute(select(Skill).where(Skill.code == code))
            sk = s_res.scalar_one_or_none()
            if not sk:
                sk = Skill(code=code, name=name, category=category, description=desc)
                session.add(sk)
                await session.flush()
            created_skills.append(sk)

        # 4. StudentSkills & SkillAssessment logs
        now = datetime.datetime.now(datetime.UTC)
        scores = [
            (created_skills[0], 58.5, 52.0, 0.85, 6),
            (created_skills[1], 76.0, 71.5, 0.78, 5),
            (created_skills[2], 84.0, 80.0, 0.90, 8),
            (created_skills[3], 69.5, 64.0, 0.72, 4),
        ]

        for sk, current, prev, conf, attempts_cnt in scores:
            ss_res = await session.execute(
                select(StudentSkill).where(
                    StudentSkill.user_id == user.id, StudentSkill.skill_id == sk.id
                )
            )
            ss = ss_res.scalar_one_or_none()
            if not ss:
                ss = StudentSkill(
                    user_id=user.id,
                    skill_id=sk.id,
                    mastery_score=current,
                    confidence=conf,
                    attempts_count=attempts_cnt,
                    last_assessed_at=now - datetime.timedelta(days=1),
                )
                session.add(ss)

                source_dummy_id = uuid.uuid4()
                session.add(
                    SkillAssessment(
                        user_id=user.id,
                        skill_id=sk.id,
                        source_type="assessment",
                        source_id=source_dummy_id,
                        score=prev,
                        points_earned=prev,
                        points_possible=100.0,
                        assessed_at=now - datetime.timedelta(days=7),
                    )
                )
                session.add(
                    SkillAssessment(
                        user_id=user.id,
                        skill_id=sk.id,
                        source_type="assessment",
                        source_id=source_dummy_id,
                        score=current,
                        points_earned=current,
                        points_possible=100.0,
                        assessed_at=now - datetime.timedelta(days=1),
                    )
                )

        # 5. Exercises & Recommendations
        ex_res = await session.execute(select(Exercise).limit(1))
        exercise = ex_res.scalar_one_or_none()
        if not exercise:
            exercise = Exercise(
                title="Exercice ciblé — Le subjonctif et l'expression de l'opinion",
                prompt="Il est nécessaire que vous ____ (savoir) argumenter vos idées lors de l'épreuve d'expression orale.",
                category=SkillCategory.GRAMMAR,
                difficulty=3,
                level="B2",
                instructions="Complétez les phrases avec le subjonctif approprié.",
                explanation="Après les expressions d'obligation impersonnelles ('il est nécessaire que'), le verbe subordonné requiert le subjonctif : 'que vous sachiez'.",
                points=5,
                options_payload=[
                    {"content": "sachiez", "is_correct": True, "order_index": 1},
                    {"content": "savez", "is_correct": False, "order_index": 2},
                    {"content": "sussiez", "is_correct": False, "order_index": 3},
                    {"content": "sauriez", "is_correct": False, "order_index": 4},
                ],
            )
            session.add(exercise)
            await session.flush()
            session.add(
                ExerciseSkill(
                    exercise_id=exercise.id,
                    skill_id=created_skills[0].id,
                    subskill="Subjonctif Présent",
                    weight=1.0,
                )
            )
        elif not exercise.options_payload:
            exercise.options_payload = [
                {"content": "sachiez", "is_correct": True, "order_index": 1},
                {"content": "savez", "is_correct": False, "order_index": 2},
                {"content": "sussiez", "is_correct": False, "order_index": 3},
                {"content": "sauriez", "is_correct": False, "order_index": 4},
            ]
            exercise.points = 5
            exercise.explanation = "Après les expressions d'obligation impersonnelles ('il est nécessaire que'), le verbe subordonné requiert le subjonctif : 'que vous sachiez'."
            await session.flush()

        rec_res = await session.execute(
            select(Recommendation).where(Recommendation.user_id == user.id)
        )
        if not rec_res.scalar_one_or_none():
            rec = Recommendation(
                user_id=user.id,
                skill_id=created_skills[0].id,
                entity_type="exercise",
                entity_id=exercise.id,
                recommendation_type=RecommendationType.EXERCISE,
                status=RecommendationStatus.ACTIVE,
                priority=85,
                reason="Score inférieur au seuil B2 (58.5%). Consolidez vos connecteurs argumentatifs.",
                generated_at=now,
            )
            session.add(rec)

        # 6. Upcoming Teacher Booking
        book_res = await session.execute(
            select(TeacherBooking).where(TeacherBooking.student_id == user.id)
        )
        if not book_res.scalar_one_or_none():
            booking = TeacherBooking(
                teacher_id=teacher_profile.id,
                student_id=user.id,
                start_time=now + datetime.timedelta(days=2, hours=3),
                end_time=now + datetime.timedelta(days=2, hours=3, minutes=50),
                status=BookingStatus.CONFIRMED,
                meeting_link="https://meet.jit.si/tef-prep-jean-dupont",
            )
            session.add(booking)

        # 7. Recent Assessment Attempt & Sections
        asmt_res = await session.execute(
            select(Assessment).where(Assessment.title == "Compréhension Écrite — Blanc 1")
        )
        asmt = asmt_res.scalar_one_or_none()
        if not asmt:
            asmt = Assessment(
                title="Compréhension Écrite — Blanc 1",
                description="Épreuve complète de compréhension écrite TEF Canada comprenant des textes journalistiques et argumentatifs.",
                assessment_type=AssessmentType.READING,
                duration_seconds=3600,
                status="published",
                version=1,
                is_published=True,
            )
            session.add(asmt)
            await session.flush()

        sec_res = await session.execute(
            select(AssessmentSection).where(AssessmentSection.assessment_id == asmt.id)
        )
        sec = sec_res.scalar_one_or_none()
        if not sec:
            sec = AssessmentSection(
                assessment_id=asmt.id,
                title="Section 1 — Compréhension de textes informatifs et d'opinion",
                instructions="Lisez attentivement les documents et sélectionnez la meilleure réponse.",
                order_index=1,
                passage_text="Une étude récente montre que l'adoption croissante du travail à distance est portée par le souhait des employés d'éviter les embouteillages quotidiens et d'obtenir une meilleure conciliation vie professionnelle et vie personnelle.",
            )
            session.add(sec)
            await session.flush()

            # Question 1
            q1 = Question(
                section_id=sec.id,
                question_type=QuestionType.SINGLE_CHOICE,
                prompt="Selon l'analyse présentée, quel est le principal facteur du développement du télétravail dans les grandes métropoles ?",
                difficulty=3,
                order_index=1,
                points=10,
                explanation="Le texte précise expressément le souhait d'éviter les trajets quotidiens et la conciliation des temps de vie.",
            )
            session.add(q1)
            await session.flush()

            session.add_all([
                QuestionOption(question_id=q1.id, content="La diminution globale des coûts des transports en commun.", is_correct=False, order_index=1),
                QuestionOption(question_id=q1.id, content="La recherche d'une meilleure conciliation vie professionnelle-personnelle et la réduction des trajets.", is_correct=True, order_index=2),
                QuestionOption(question_id=q1.id, content="La fermeture définitive de l'ensemble des locaux d'entreprise.", is_correct=False, order_index=3),
                QuestionOption(question_id=q1.id, content="Une obligation légale et sanitaire permanente.", is_correct=False, order_index=4),
                QuestionSkillTag(question_id=q1.id, skill_id=created_skills[2].id, weight=1.0),
            ])

            # Question 2
            q2 = Question(
                section_id=sec.id,
                question_type=QuestionType.SINGLE_CHOICE,
                prompt="Quel risque majeur est souligné par l'auteur concernant la généralisation des outils numériques ?",
                difficulty=3,
                order_index=2,
                points=10,
                explanation="L'auteur met en garde contre l'isolement social des collaborateurs.",
            )
            session.add(q2)
            await session.flush()

            session.add_all([
                QuestionOption(question_id=q2.id, content="Une baisse irrémédiable de la vitesse de connexion internet.", is_correct=False, order_index=1),
                QuestionOption(question_id=q2.id, content="L'effritement du lien social et le risque d'isolement des collaborateurs.", is_correct=True, order_index=2),
                QuestionOption(question_id=q2.id, content="L'augmentation injustifiée des salaires dans le secteur numérique.", is_correct=False, order_index=3),
                QuestionOption(question_id=q2.id, content="Une incompatibilité totale avec les objectifs écologiques.", is_correct=False, order_index=4),
                QuestionSkillTag(question_id=q2.id, skill_id=created_skills[2].id, weight=1.0),
            ])
            await session.flush()

            attempt = Attempt(
                assessment_id=asmt.id,
                user_id=user.id,
                status=AttemptStatus.SUBMITTED,
                started_at=now - datetime.timedelta(days=3, hours=1),
                submitted_at=now - datetime.timedelta(days=3),
            )
            session.add(attempt)
            await session.flush()

            score = AttemptScore(
                attempt_id=attempt.id,
                total_points=25.0,
                max_points=30.0,
                percentage=83.3,
                is_passed=True,
                estimated_level="B2",
                skill_scores={},
                scored_at=now - datetime.timedelta(days=3),
            )
            session.add(score)

        await session.commit()
        print("Demo seed completed successfully!")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())