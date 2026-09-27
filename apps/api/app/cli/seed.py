"""Unified Database Seeder CLI.

Seeds foundational skills, assessments, exercises, writing tasks, oral scenarios,
practice topics, and default user accounts idempotently.
"""

import asyncio
import datetime
import os
import sys
import uuid
import structlog
from sqlalchemy import select

# Ensure all models are registered in metadata
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
from app.core.database import async_session_factory
from app.core.security import hash_password
from app.modules.admin.ai_sandbox_service import AISandboxService
from app.modules.assessments.seed import seed_demo_assessments
from app.modules.learning.seed import seed_learning_data
from app.modules.practice_pool.models import PracticeTopic
from app.modules.users.models import (
    StudentProfile,
    TeacherProfile,
    TeacherVerificationStatus,
    User,
    UserRole,
)
from app.modules.writing.seed import seed_writing_tasks

logger = structlog.get_logger("tef-api.seed")


async def seed_practice_topics(db) -> None:
    """Seed sample roleplays and discussion topics for student practice pool."""
    existing = await db.scalar(select(PracticeTopic).limit(1))
    if existing:
        return

    topics = [
        PracticeTopic(
            title="Préparer un voyage à Montréal",
            description="Discussion informelle sur les démarches, le climat et les incontournables d'un premier séjour à Montréal.",
            level="B1",
            category="casual",
            prompts=[
                "Quelle est la meilleure saison pour visiter le Québec selon vous ?",
                "Quels vêtements et équipements préparez-vous pour l'hiver québécois ?",
                "Quelles différences culturelles anticipez-vous par rapport à votre pays d'origine ?",
            ],
            is_active=True,
        ),
        PracticeTopic(
            title="Le télétravail obligatoire : Pour ou contre ?",
            description="Débat argumenté simulant l'épreuve d'expression orale Section B du TEF.",
            level="B2",
            category="debate",
            prompts=[
                "Quels sont les principaux bénéfices du travail à distance pour la qualité de vie ?",
                "Quels risques le télétravail fait-il peser sur la cohésion d'équipe et la vie sociale ?",
                "Comment une entreprise peut-elle trouver le juste équilibre ?",
            ],
            is_active=True,
        ),
        PracticeTopic(
            title="Renseignements sur un abonnement de transport urbain",
            description="Jeu de rôle simulant la Section A : poser des questions pertinentes et précises à un conseiller.",
            level="B1",
            category="roleplay",
            prompts=[
                "Demandez les tarifs mensuels et les réductions possibles pour étudiants ou nouveaux arrivants.",
                "Informez-vous sur les zones couvertes par l'abonnement.",
                "Renseignez-vous sur les modalités de résiliation ou de suspension.",
            ],
            is_active=True,
        ),
    ]
    db.add_all(topics)
    await db.commit()
    logger.info("practice_topics_seeded", count=len(topics))


async def seed_default_users(db) -> None:
    """Seed initial administrator and demonstration accounts if none exist."""
    admin_email = os.getenv("ADMIN_EMAIL", "admin@tefprep.com")
    admin_password = os.getenv("ADMIN_PASSWORD", "AdminPassword123!")

    existing_admin = await db.scalar(select(User).where(User.email == admin_email))
    if not existing_admin:
        admin_user = User(
            id=uuid.uuid4(),
            email=admin_email,
            password_hash=hash_password(admin_password),
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
        )
        db.add(admin_user)
        await db.commit()
        logger.info("admin_user_seeded", email=admin_email)

    # Demo teacher
    teacher_email = os.getenv("DEMO_TEACHER_EMAIL", "teacher.claire@tefprep.com")
    existing_teacher = await db.scalar(select(User).where(User.email == teacher_email))
    if not existing_teacher:
        teacher_id = uuid.uuid4()
        teacher_user = User(
            id=teacher_id,
            email=teacher_email,
            password_hash=hash_password("TeacherPassword123!"),
            role=UserRole.TEACHER,
            is_active=True,
            is_verified=True,
        )
        db.add(teacher_user)
        await db.flush()

        profile = TeacherProfile(
            id=uuid.uuid4(),
            user_id=teacher_id,
            display_name="Claire Delacroix",
            bio="Diplômée de la Sorbonne en Français Langue Étrangère avec 8 ans d'accompagnement spécifique vers l'immigration Canada (NCLC 7+).",
            expertise=["Préparation TEF Canada", "Expression Orale", "Expression Écrite"],
            teaching_levels=["B1", "B2", "C1"],
            hourly_price=4500,
            verification_status=TeacherVerificationStatus.APPROVED,
            timezone="Europe/Paris",
        )
        db.add(profile)
        await db.commit()
        logger.info("demo_teacher_seeded", email=teacher_email)


async def run_seed() -> None:
    """Execute all seeders in safe dependency order."""
    print("==================================================")
    print(" TEF Platform — Database Seeding Pipeline         ")
    print("==================================================")

    async with async_session_factory() as session:
        print("[1/6] Seeding core assessments and skills...")
        await seed_demo_assessments(session)

        print("[2/6] Seeding learning intelligence hierarchy & exercises...")
        await seed_learning_data(session)

        print("[3/6] Seeding writing examination tasks...")
        await seed_writing_tasks(session)

        print("[4/6] Seeding AI oral examiner configurations...")
        await AISandboxService.seed_system_templates(session)

        print("[5/6] Seeding authentic speaking exam scenarios...")
        await AISandboxService.seed_default_scenarios(session, None)

        print("[6/6] Seeding practice pool topics & initial accounts...")
        await seed_practice_topics(session)
        await seed_default_users(session)

    print("==================================================")
    print(" Database seeding completed successfully!         ")
    print("==================================================")


def main() -> None:
    """CLI entrypoint."""
    asyncio.run(run_seed())


if __name__ == "__main__":
    main()
