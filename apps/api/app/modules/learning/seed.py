"""Seed learning skills hierarchy and targeted practice exercises."""

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.assessments.enums import QuestionType
from app.modules.assessments.models import Skill
from app.modules.learning.enums import SkillCategory
from app.modules.learning.models import Exercise, ExerciseSkill

logger = structlog.get_logger("tef-api.learning.seed")


async def seed_learning_data(db: AsyncSession) -> None:
    """Idempotently seed core skill hierarchy and practice exercises."""
    # 1. Update/seed core skills
    # Check if vocabulary root exists
    existing_vocab = await db.scalar(select(Skill).where(Skill.code == "vocabulary"))
    if existing_vocab:
        logger.info("learning_skills_already_seeded")
        return

    # Update reading and listening skills with categories if present
    reading_skill = await db.scalar(select(Skill).where(Skill.code == "reading_comprehension"))
    if reading_skill and reading_skill.category is None:
        reading_skill.category = SkillCategory.READING

    listening_skill = await db.scalar(select(Skill).where(Skill.code == "listening_comprehension"))
    if listening_skill and listening_skill.category is None:
        listening_skill.category = SkillCategory.LISTENING

    # Root skills
    writing_skill = Skill(
        code="writing_expression",
        name="Expression écrite",
        description="Capacité à rédiger des textes cohérents, structurés et argumentés en français.",
        category=SkillCategory.WRITING,
    )
    speaking_skill = Skill(
        code="speaking_expression",
        name="Expression orale",
        description="Capacité à s'exprimer oralement en continu et en interaction.",
        category=SkillCategory.SPEAKING,
    )
    vocab_skill = Skill(
        code="vocabulary",
        name="Vocabulaire et Lexique",
        description="Maîtrise du vocabulaire thématique, des connecteurs et du registre de langue.",
        category=SkillCategory.VOCABULARY,
    )
    grammar_skill = Skill(
        code="grammar",
        name="Grammaire et Syntaxe",
        description="Structure des phrases, accords, pronoms et constructions grammaticales.",
        category=SkillCategory.GRAMMAR,
    )
    conjugation_skill = Skill(
        code="conjugation",
        name="Conjugaison et Modes",
        description="Maîtrise des temps verbaux (passé composé, imparfait, subjonctif, conditionnel).",
        category=SkillCategory.CONJUGATION,
    )

    db.add_all([writing_skill, speaking_skill, vocab_skill, grammar_skill, conjugation_skill])
    await db.flush()

    # Hierarchical subskills
    # Vocabulary -> connectors, collocations
    connectors_skill = Skill(
        code="connectors",
        name="Connecteurs logiques et articulation",
        description="Utilisation des mots de liaison pour structurer un discours argumentatif.",
        parent_id=vocab_skill.id,
        category=SkillCategory.VOCABULARY,
    )
    collocations_skill = Skill(
        code="collocations",
        name="Expressions idiomatiques et collocations",
        description="Associations de mots naturelles et expressions courantes en français.",
        parent_id=vocab_skill.id,
        category=SkillCategory.VOCABULARY,
    )

    # Grammar -> relative_pronouns, subjunctive
    relative_pronouns_skill = Skill(
        code="relative_pronouns",
        name="Pronoms relatifs simples et composés",
        description="Emploi de qui, que, dont, où, lequel, auquel, duquel.",
        parent_id=grammar_skill.id,
        category=SkillCategory.GRAMMAR,
    )
    subjunctive_skill = Skill(
        code="subjunctive",
        name="Subjonctif et expressions d'obligation",
        description="Emploi du subjonctif présent après les verbes de volonté, sentiment, doute.",
        parent_id=grammar_skill.id,
        category=SkillCategory.GRAMMAR,
    )

    # Conjugation -> past_tenses, conditional
    past_tenses_skill = Skill(
        code="past_tenses",
        name="Temps du passé (Imparfait vs Passé Composé)",
        description="Alternance entre action ponctuelle et description d'arrière-plan.",
        parent_id=conjugation_skill.id,
        category=SkillCategory.CONJUGATION,
    )
    conditional_skill = Skill(
        code="conditional",
        name="Conditionnel présent et passé",
        description="Expression de l'hypothèse, du souhait et de la politesse.",
        parent_id=conjugation_skill.id,
        category=SkillCategory.CONJUGATION,
    )

    db.add_all(
        [
            connectors_skill,
            collocations_skill,
            relative_pronouns_skill,
            subjunctive_skill,
            past_tenses_skill,
            conditional_skill,
        ]
    )
    await db.flush()

    # 2. Targeted practice exercises
    ex1 = Exercise(
        title="Les Pronoms Relatifs Composés (auquel, duquel, lequel)",
        category=SkillCategory.GRAMMAR,
        level="B2",
        difficulty=3,
        question_type=QuestionType.SINGLE_CHOICE,
        prompt="Choisissez le pronom relatif approprié : 'C'est une opportunité professionnelle _____ je pense souvent.'",
        options_payload=[
            {
                "id": "opt-1",
                "content": "à laquelle",
                "is_correct": True,
                "explanation": "Penser à quelque chose -> à laquelle (féminin singulier).",
            },
            {
                "id": "opt-2",
                "content": "de laquelle",
                "is_correct": False,
                "explanation": "On ne dit pas penser de dans ce contexte d'intérêt.",
            },
            {
                "id": "opt-3",
                "content": "avec laquelle",
                "is_correct": False,
                "explanation": "Incorrect avec le verbe penser.",
            },
            {
                "id": "opt-4",
                "content": "pour laquelle",
                "is_correct": False,
                "explanation": "Incorrect avec le verbe penser.",
            },
        ],
        explanation="Le verbe 'penser à' requiert la préposition 'à' : penser à une opportunité -> l'opportunité à laquelle je pense.",
        points=10,
        is_published=True,
    )
    db.add(ex1)
    await db.flush()

    ex1_skill1 = ExerciseSkill(exercise_id=ex1.id, skill_id=grammar_skill.id)
    ex1_skill2 = ExerciseSkill(exercise_id=ex1.id, skill_id=relative_pronouns_skill.id)
    db.add_all([ex1_skill1, ex1_skill2])

    ex2 = Exercise(
        title="Connecteurs Logiques d'Opposition (bien que, cependant, pourtant)",
        category=SkillCategory.VOCABULARY,
        level="B1",
        difficulty=2,
        question_type=QuestionType.SINGLE_CHOICE,
        prompt="Complétez la phrase : 'Il a accepté le poste, _____ le salaire soit inférieur à ses attentes initiales.'",
        options_payload=[
            {
                "id": "opt-1",
                "content": "bien que",
                "is_correct": True,
                "explanation": "'Bien que' est suivi du subjonctif ('soit').",
            },
            {
                "id": "opt-2",
                "content": "malgré",
                "is_correct": False,
                "explanation": "'Malgré' est suivi d'un nom, pas d'une proposition subordonnée avec verbe.",
            },
            {
                "id": "opt-3",
                "content": "pourtant",
                "is_correct": False,
                "explanation": "'Pourtant' est un adverbe coordonnant, pas une conjonction de subordination.",
            },
            {
                "id": "opt-4",
                "content": "en effet",
                "is_correct": False,
                "explanation": "'En effet' exprime la cause ou l'explication, pas l'opposition.",
            },
        ],
        explanation="'Bien que' introduit une concession et exige le mode subjonctif ('soit').",
        points=10,
        is_published=True,
    )
    db.add(ex2)
    await db.flush()

    ex2_skill1 = ExerciseSkill(exercise_id=ex2.id, skill_id=vocab_skill.id)
    ex2_skill2 = ExerciseSkill(exercise_id=ex2.id, skill_id=connectors_skill.id)
    db.add_all([ex2_skill1, ex2_skill2])

    ex3 = Exercise(
        title="Concordance des Temps : Passé Composé vs Imparfait",
        category=SkillCategory.CONJUGATION,
        level="B1",
        difficulty=2,
        question_type=QuestionType.SINGLE_CHOICE,
        prompt="Complétez la phrase : 'Pendant que je _____ mes bagages à l'aéroport, mon vol a été annoncé avec du retard.'",
        options_payload=[
            {
                "id": "opt-1",
                "content": "récupérais",
                "is_correct": True,
                "explanation": "L'imparfait exprime une action continue d'arrière-plan dans le passé.",
            },
            {
                "id": "opt-2",
                "content": "ai récupéré",
                "is_correct": False,
                "explanation": "Le passé composé exprimerait une action ponctuelle achevée.",
            },
            {
                "id": "opt-3",
                "content": "récupère",
                "is_correct": False,
                "explanation": "Temps présent incompatible avec le contexte passé.",
            },
            {
                "id": "opt-4",
                "content": "avais récupéré",
                "is_correct": False,
                "explanation": "Le plus-que-parfait exprimerait une action antérieure.",
            },
        ],
        explanation="L'imparfait s'utilise pour une action continue d'arrière-plan interrompue ou accompagnée d'un événement au passé composé.",
        points=10,
        is_published=True,
    )
    db.add(ex3)
    await db.flush()

    ex3_skill1 = ExerciseSkill(exercise_id=ex3.id, skill_id=conjugation_skill.id)
    ex3_skill2 = ExerciseSkill(exercise_id=ex3.id, skill_id=past_tenses_skill.id)
    db.add_all([ex3_skill1, ex3_skill2])

    if reading_skill:
        ex4 = Exercise(
            title="Repérage d'Informations Factuelles dans un Texte Formel",
            category=SkillCategory.READING,
            level="B2",
            difficulty=3,
            question_type=QuestionType.SINGLE_CHOICE,
            prompt="Selon le règlement intérieur mentionné, quel document le candidat doit-il présenter obligatoirement lors de l'émargement ?",
            options_payload=[
                {
                    "id": "opt-1",
                    "content": "Une pièce d'identité officielle originale avec photographie en cours de validité",
                    "is_correct": True,
                    "explanation": "Exigence formelle standard des règlements d'examen TEF.",
                },
                {
                    "id": "opt-2",
                    "content": "Une photocopie simple de son acte de naissance",
                    "is_correct": False,
                    "explanation": "Les photocopies non certifiées sont irrecevables.",
                },
                {
                    "id": "opt-3",
                    "content": "Un justificatif de domicile de moins de trois mois",
                    "is_correct": False,
                    "explanation": "Non requis pour l'émargement immédiat.",
                },
                {
                    "id": "opt-4",
                    "content": "Une attestation d'inscription sur l'honneur",
                    "is_correct": False,
                    "explanation": "Non recevable pour vérifier l'identité.",
                },
            ],
            explanation="La pièce d'identité originale avec photo en cours de validité est strictement requise.",
            points=10,
            is_published=True,
        )
        db.add(ex4)
        await db.flush()
        db.add(ExerciseSkill(exercise_id=ex4.id, skill_id=reading_skill.id))

    await db.flush()
    logger.info("learning_skills_and_exercises_seeded")
