"""Create practice_topics and practice_participants tables, enhance practice_sessions.

Revision ID: 0015_practice_pool_enhancements
Revises: 0014_writing_and_booking_workflows
Create Date: 2026-09-18 16:30:00.000000

"""

from collections.abc import Sequence
import datetime
import json
import uuid

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0015_practice_pool_enhancements"
down_revision: str | None = "0014_writing_and_booking_workflows"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SEED_TOPICS = [
    {
        "id": uuid.uuid4(),
        "title": "La vie quotidienne et les loisirs",
        "description": "Discutez de vos habitudes quotidiennes, de la conciliation travail-vie personnelle et de vos activités de fin de semaine.",
        "level": "B1",
        "category": "daily_life",
        "prompts": json.dumps([
            "Comment organisez-vous votre journée typique en semaine ?",
            "Quelles sont vos activités préférées pour vous détendre ?",
            "Pensez-vous que les gens ont assez de temps libre aujourd'hui ?",
        ]),
        "is_active": True,
    },
    {
        "id": uuid.uuid4(),
        "title": "L'évolution du télétravail",
        "description": "Échangez sur les avantages et les limites du travail à distance pour les employés et les entreprises.",
        "level": "B2",
        "category": "work",
        "prompts": json.dumps([
            "Préférez-vous travailler en présentiel ou à distance, et pourquoi ?",
            "Quels sont les défis majeurs de la collaboration en équipe virtuelle ?",
            "Le télétravail favorise-t-il vraiment l'efficacité professionnelle ?",
        ]),
        "is_active": True,
    },
    {
        "id": uuid.uuid4(),
        "title": "Voyages et découverte culturelle",
        "description": "Partagez une expérience marquante de voyage et discutez de l'impact du tourisme de masse sur les villes historiques.",
        "level": "B1",
        "category": "travel",
        "prompts": json.dumps([
            "Quel est le voyage qui vous a le plus marqué et pour quelle raison ?",
            "Privilégiez-vous les voyages organisés ou les départs spontanés ?",
            "Comment voyager de manière plus écoresponsable selon vous ?",
        ]),
        "is_active": True,
    },
    {
        "id": uuid.uuid4(),
        "title": "La crise du logement et l'urbanisme",
        "description": "Analysez la hausse des coûts des logements dans les métropoles et proposez des solutions d'aménagement urbain.",
        "level": "B2",
        "category": "housing",
        "prompts": json.dumps([
            "Est-il plus avantageux d'être locataire ou propriétaire dans votre région ?",
            "Quelles solutions les municipalités peuvent-elles apporter au manque de logements abordables ?",
            "La vie en banlieue est-elle un compromis acceptable face au coût du centre-ville ?",
        ]),
        "is_active": True,
    },
    {
        "id": uuid.uuid4(),
        "title": "L'apprentissage des langues et les nouvelles technologies",
        "description": "Débattez du rôle des applications mobiles et de l'intelligence artificielle dans l'éducation moderne.",
        "level": "B2",
        "category": "education",
        "prompts": json.dumps([
            "Les outils numériques peuvent-ils remplacer un enseignant en classe de langue ?",
            "Quelle méthode vous a le plus aidé à progresser en français oral ?",
            "Comment encourager la lecture chez les plus jeunes à l'ère des écrans ?",
        ]),
        "is_active": True,
    },
    {
        "id": uuid.uuid4(),
        "title": "L'impact de l'intelligence artificielle au quotidien",
        "description": "Échangez vos opinions sur l'automatisation, la créativité numérique et la protection des données personnelles.",
        "level": "C1",
        "category": "technology",
        "prompts": json.dumps([
            "L'IA représente-t-elle une opportunité ou une menace pour l'emploi qualifié ?",
            "Faites-vous confiance aux algorithmes pour prendre des décisions importantes ?",
            "Comment encadrer l'utilisation de l'IA sans freiner l'innovation ?",
        ]),
        "is_active": True,
    },
    {
        "id": uuid.uuid4(),
        "title": "La transition écologique et les gestes citoyens",
        "description": "Discutez des mesures individuelles et collectives nécessaires pour lutter contre le réchauffement climatique.",
        "level": "B2",
        "category": "environment",
        "prompts": json.dumps([
            "Quels gestes concrets appliquez-vous pour réduire votre empreinte carbone ?",
            "Les transports en commun gratuits sont-ils une solution réaliste et efficace ?",
            "Les entreprises doivent-elles être plus lourdement pénalisées en cas de pollution ?",
        ]),
        "is_active": True,
    },
    {
        "id": uuid.uuid4(),
        "title": "Débat d'opinion : L'impact des réseaux sociaux",
        "description": "Exprimez votre point de vue structuré sur les réseaux sociaux comme source d'information et d'influence citoyenne.",
        "level": "B2",
        "category": "opinion_discussion",
        "prompts": json.dumps([
            "Les réseaux sociaux renforcent-ils ou affaiblissent-ils le débat démocratique ?",
            "Devrait-on imposer un âge minimum strict pour accéder aux plateformes sociales ?",
            "Comment faire la part entre information fiable et manipulation en ligne ?",
        ]),
        "is_active": True,
    },
]


def upgrade() -> None:
    # 1. practice_topics table
    practice_topics = op.create_table(
        "practice_topics",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("level", sa.String(length=10), nullable=False, server_default="B2"),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("prompts", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_practice_topics_id", "practice_topics", ["id"])
    op.create_index("ix_practice_topics_level", "practice_topics", ["level"])
    op.create_index("ix_practice_topics_category", "practice_topics", ["category"])
    op.create_index("ix_practice_topics_is_active", "practice_topics", ["is_active"])

    # 2. practice_sessions enhancements: add topic_id and update duration default
    op.add_column(
        "practice_sessions",
        sa.Column(
            "topic_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("practice_topics.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_practice_sessions_topic_id", "practice_sessions", ["topic_id"])
    op.alter_column(
        "practice_sessions",
        "duration_minutes",
        server_default="25",
    )

    # 3. practice_participants table
    op.create_table(
        "practice_participants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("practice_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("anonymous_alias", sa.String(length=100), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False, server_default="participant"),
        sa.Column(
            "is_connected", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("left_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "session_id", "user_id", name="uq_practice_participant_session_user"
        ),
    )
    op.create_index("ix_practice_participants_id", "practice_participants", ["id"])
    op.create_index(
        "ix_practice_participants_session_id", "practice_participants", ["session_id"]
    )
    op.create_index("ix_practice_participants_user_id", "practice_participants", ["user_id"])
    op.create_index(
        "ix_practice_participants_session_user",
        "practice_participants",
        ["session_id", "user_id"],
    )

    # 4. Seed initial topics
    now = datetime.datetime.now(datetime.UTC)
    topic_rows = []
    for t in SEED_TOPICS:
        topic_rows.append(
            {
                "id": t["id"],
                "title": t["title"],
                "description": t["description"],
                "level": t["level"],
                "category": t["category"],
                "prompts": json.loads(t["prompts"]),
                "is_active": t["is_active"],
                "created_at": now,
                "updated_at": now,
            }
        )
    op.bulk_insert(practice_topics, topic_rows)


def downgrade() -> None:
    op.drop_table("practice_participants")
    op.drop_index("ix_practice_sessions_topic_id", table_name="practice_sessions")
    op.drop_column("practice_sessions", "topic_id")
    op.drop_table("practice_topics")
