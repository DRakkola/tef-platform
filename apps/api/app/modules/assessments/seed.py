"""Original placeholder demo assessments and skills for testing and local development."""

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.assessments.enums import (
    AssessmentType,
    NavigationPolicy,
    QuestionType,
    ScoringPolicy,
)
from app.modules.assessments.models import (
    Assessment,
    AssessmentSection,
    Question,
    QuestionOption,
    QuestionSkillTag,
    Skill,
)

logger = structlog.get_logger("tef-api.assessments.seed")


async def seed_demo_assessments(db: AsyncSession) -> None:
    """Idempotently seed skills and sample Reading and Listening demo assessments."""
    # 1. Skills
    existing_skill = await db.scalar(select(Skill).where(Skill.code == "reading_comprehension"))
    if existing_skill:
        logger.info("demo_assessments_already_seeded")
        return

    # Create root skills
    reading_skill = Skill(
        code="reading_comprehension",
        name="Compréhension écrite",
        description="Capacité à lire et comprendre des documents de la vie quotidienne et professionnelle.",
    )
    listening_skill = Skill(
        code="listening_comprehension",
        name="Compréhension orale",
        description="Capacité à écouter et comprendre des annonces, conversations et émissions en français.",
    )
    db.add_all([reading_skill, listening_skill])
    await db.flush()

    # Create subskills
    reading_gist = Skill(
        code="reading_gist",
        name="Identification du sens global",
        parent_id=reading_skill.id,
    )
    reading_detail = Skill(
        code="reading_detail",
        name="Repérage d'informations factuelles",
        parent_id=reading_skill.id,
    )
    reading_inference = Skill(
        code="reading_inference",
        name="Compréhension de l'implicite",
        parent_id=reading_skill.id,
    )

    listening_announcement = Skill(
        code="listening_announcement",
        name="Compréhension d'annonces publiques",
        parent_id=listening_skill.id,
    )
    listening_interview = Skill(
        code="listening_interview",
        name="Suivi d'un entretien thématique",
        parent_id=listening_skill.id,
    )

    db.add_all(
        [
            reading_gist,
            reading_detail,
            reading_inference,
            listening_announcement,
            listening_interview,
        ]
    )
    await db.flush()

    # 2. Reading Assessment
    reading_assessment = Assessment(
        title="TEF Compréhension Écrite — Test Démo",
        description="Évaluation représentative des formats de lecture TEF (annonces, textes informatifs et argumentatifs).",
        assessment_type=AssessmentType.READING,
        duration_seconds=3600,  # 60 minutes
        navigation_policy=NavigationPolicy.FREE,
        scoring_policy=ScoringPolicy.STANDARD_POINTS,
        pass_percentage=70.0,
        is_published=True,
    )
    db.add(reading_assessment)
    await db.flush()

    # Section A: Annonces du quotidien
    sec_read_a = AssessmentSection(
        assessment_id=reading_assessment.id,
        title="Section A — Documents de la vie quotidienne",
        instructions="Lisez les documents suivants et choisissez l'unique réponse correcte pour chaque question.",
        order_index=0,
        passage_text="AVIS DE LA BIBLIOTHÈQUE MUNICIPALE : En raison de travaux de rénovation énergétique, les salles d'étude du deuxième étage seront fermées du 1er au 15 octobre. Le service d'emprunt au rez-de-chaussée reste accessible aux horaires habituels.",
    )
    db.add(sec_read_a)
    await db.flush()

    # Question 1 (Reading Sec A)
    q1_r = Question(
        section_id=sec_read_a.id,
        prompt="Que pouvez-vous faire à la bibliothèque pendant la première quinzaine d'octobre ?",
        question_type=QuestionType.SINGLE_CHOICE,
        order_index=0,
        level="A2",
        difficulty=2,
        points=1,
        explanation="Le texte précise que le service d'emprunt reste accessible au rez-de-chaussée, alors que les salles d'étude sont fermées.",
    )
    db.add(q1_r)
    await db.flush()

    db.add_all(
        [
            QuestionOption(
                question_id=q1_r.id,
                content="Emprunter des livres au rez-de-chaussée.",
                order_index=0,
                is_correct=True,
                explanation="Correct : le service d'emprunt demeure ouvert aux horaires réguliers.",
            ),
            QuestionOption(
                question_id=q1_r.id,
                content="Travailler dans les salles d'étude du deuxième étage.",
                order_index=1,
                is_correct=False,
                explanation="Faux : ces salles sont spécifiquement fermées pour rénovation.",
            ),
            QuestionOption(
                question_id=q1_r.id,
                content="Participer à une réunion d'information énergétique.",
                order_index=2,
                is_correct=False,
                explanation="Faux : aucune réunion n'est mentionnée.",
            ),
            QuestionOption(
                question_id=q1_r.id,
                content="Visiter les nouveaux locaux rénovés.",
                order_index=3,
                is_correct=False,
                explanation="Faux : les travaux débutent à peine.",
            ),
        ]
    )

    db.add(
        QuestionSkillTag(
            question_id=q1_r.id,
            skill_id=reading_detail.id,
            subskill="reading_detail",
            weight=1.0,
        )
    )

    # Section B: Article de société
    sec_read_b = AssessmentSection(
        assessment_id=reading_assessment.id,
        title="Section B — Article de presse et faits de société",
        instructions="Lisez l'extrait d'article et répondez aux questions correspondantes.",
        order_index=1,
        passage_text="La municipalité de Saint-Denis a inauguré un nouveau réseau de pistes cyclables protégées reliant le centre-ville aux zones d'activités périphériques. L'objectif avoué est de réduire le recours à l'automobile individuelle de 25% d'ici cinq ans. Si les associations d'usagers saluent unanimement une avancée sécuritaire majeure, certains commerçants craignent une raréfaction des places de stationnement.",
    )
    db.add(sec_read_b)
    await db.flush()

    # Question 2 (Reading Sec B)
    q2_r = Question(
        section_id=sec_read_b.id,
        prompt="Quel est l'objectif principal visé par la municipalité à travers ce nouvel aménagement ?",
        question_type=QuestionType.SINGLE_CHOICE,
        order_index=0,
        level="B1",
        difficulty=3,
        points=2,
        explanation="L'article mentionne explicitement : 'L'objectif avoué est de réduire le recours à l'automobile individuelle de 25% d'ici cinq ans'.",
    )
    db.add(q2_r)
    await db.flush()

    db.add_all(
        [
            QuestionOption(
                question_id=q2_r.id,
                content="Diminuer l'utilisation des véhicules personnels de 25%.",
                order_index=0,
                is_correct=True,
            ),
            QuestionOption(
                question_id=q2_r.id,
                content="Créer de nouvelles places de parking pour les commerces.",
                order_index=1,
                is_correct=False,
            ),
            QuestionOption(
                question_id=q2_r.id,
                content="Augmenter les tarifs de transport en commun.",
                order_index=2,
                is_correct=False,
            ),
            QuestionOption(
                question_id=q2_r.id,
                content="Fermer l'accès du centre-ville à tous les cyclistes.",
                order_index=3,
                is_correct=False,
            ),
        ]
    )

    db.add(
        QuestionSkillTag(
            question_id=q2_r.id,
            skill_id=reading_gist.id,
            subskill="reading_gist",
            weight=1.0,
        )
    )

    # 3. Listening Assessment
    listening_assessment = Assessment(
        title="TEF Compréhension Orale — Test Démo",
        description="Évaluation de la compréhension de messages oraux, annonces publiques et émissions de radio.",
        assessment_type=AssessmentType.LISTENING,
        duration_seconds=2400,  # 40 minutes
        navigation_policy=NavigationPolicy.FREE,
        scoring_policy=ScoringPolicy.STANDARD_POINTS,
        pass_percentage=70.0,
        is_published=True,
    )
    db.add(listening_assessment)
    await db.flush()

    # Section A: Annonce publique sonore
    sec_listen_a = AssessmentSection(
        assessment_id=listening_assessment.id,
        title="Section A — Messages et annonces publiques",
        instructions="Écoutez l'extrait audio et choisissez l'unique réponse correcte.",
        order_index=0,
        media_url="https://storage.tef-platform.local/audio/demo_announcement_gare.mp3",
        passage_text="[Transcription de l'annonce] 'Mesdames, messieurs, le train Intercités numéro 4512 à destination de Bordeaux Saint-Jean, départ initialement prévu à 14h15 voie 4, partira exceptionnellement voie 9 à 14h25. Veuillez vous diriger vers le passage souterrain B.'",
    )
    db.add(sec_listen_a)
    await db.flush()

    q1_l = Question(
        section_id=sec_listen_a.id,
        prompt="Quelle modification est communiquée aux voyageurs de ce train ?",
        question_type=QuestionType.SINGLE_CHOICE,
        order_index=0,
        level="A2",
        difficulty=2,
        points=1,
        explanation="L'annonce indique un changement de voie (voie 9 au lieu de 4) et un léger retard (14h25 au lieu de 14h15).",
    )
    db.add(q1_l)
    await db.flush()

    db.add_all(
        [
            QuestionOption(
                question_id=q1_l.id,
                content="Le train changera de quai et partira avec dix minutes de retard.",
                order_index=0,
                is_correct=True,
            ),
            QuestionOption(
                question_id=q1_l.id,
                content="Le voyage est annulé en raison de problèmes techniques.",
                order_index=1,
                is_correct=False,
            ),
            QuestionOption(
                question_id=q1_l.id,
                content="Le train partira en avance depuis la voie 4.",
                order_index=2,
                is_correct=False,
            ),
            QuestionOption(
                question_id=q1_l.id,
                content="Tous les billets doivent être échangés au guichet principal.",
                order_index=3,
                is_correct=False,
            ),
        ]
    )

    db.add(
        QuestionSkillTag(
            question_id=q1_l.id,
            skill_id=listening_announcement.id,
            subskill="listening_announcement",
            weight=1.0,
        )
    )

    await db.commit()
    logger.info("demo_assessments_seeded_successfully")
