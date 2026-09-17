"""Seed sample TEF Expression Écrite tasks."""

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.writing.enums import WritingTaskType
from app.modules.writing.models import WritingTask

logger = structlog.get_logger("tef-api.writing.seed")


async def seed_writing_tasks(db: AsyncSession) -> None:
    """Seed authentic TEF-style Section A and Section B tasks idempotently."""
    existing_a = await db.scalar(
        select(WritingTask).where(WritingTask.task_type == WritingTaskType.SECTION_A).limit(1)
    )
    if not existing_a:
        task_a = WritingTask(
            title="TEF Expression Écrite — Section A : Le cambriolage insolite",
            task_type=WritingTaskType.SECTION_A,
            prompt=(
                "Vous avez lu le début d'un fait divers dans un quotidien francophone. "
                "Rédigez la suite de l'article en racontant les faits de manière vivante et détaillée : "
                "ce qui s'est passé ensuite, comment la situation s'est résolue et les réactions suscitées."
            ),
            stimulus_text=(
                "Paris — Hier soir, peu avant la fermeture, un individu déguisé en technicien de maintenance "
                "s'est introduit dans l'aile ouest du célèbre musée..."
            ),
            min_words=80,
            max_words=120,
            duration_minutes=30,
            target_level="B1",
            is_published=True,
        )
        db.add(task_a)

    existing_b = await db.scalar(
        select(WritingTask).where(WritingTask.task_type == WritingTaskType.SECTION_B).limit(1)
    )
    if not existing_b:
        task_b = WritingTask(
            title="TEF Expression Écrite — Section B : La piétonnisation du centre-ville",
            task_type=WritingTaskType.SECTION_B,
            prompt=(
                "Dans le journal de votre ville, vous lisez un article annonçant que la municipalité prévoit "
                "d'interdire complètement la circulation automobile dans tout le centre-ville dès l'automne. "
                "Écrivez une lettre argumentée au rédacteur en chef pour exprimer votre point de vue. "
                "Développez au moins deux arguments solides illustrés d'exemples précis pour convaincre les lecteurs."
            ),
            stimulus_text=(
                "Tribune locale : 'La ville de demain doit-elle être 100% piétonne ? Donnez votre avis "
                "avant le vote du conseil municipal le mois prochain.'"
            ),
            min_words=200,
            max_words=250,
            duration_minutes=40,
            target_level="B2",
            is_published=True,
        )
        db.add(task_b)

    await db.flush()
    logger.info("writing_tasks_seeded")
