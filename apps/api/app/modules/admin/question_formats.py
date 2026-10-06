"""Authoritative registry of TEF question formats (item families).

This module is the single source of truth for the AI question generation pipeline.
It replaces the previous hardcoded ``TASK_PROMPT_CONFIGS`` dictionary and the
hand-maintained ``PROMPT_TEMPLATE_VERSIONS`` mapping inside
``ai_question_service.py``.

Design rules:
- The registry is *declarative data only*. It contains no I/O, no database access
  and no prompt assembly logic, so it can be safely serialised to JSON and served
  to the admin frontend (which therefore can never drift from the backend).
- Every TEF item family of the five official modules is represented:
  comprehension écrite, compréhension orale, lexique et structure,
  expression écrite and expression orale.
- Each entry declares which response formats the generator is allowed to emit and
  how many answer options the real exam uses, so the "exactly 4 options" assumption
  that previously lived in the validation engine can be driven from data.
"""

from __future__ import annotations

from typing import Any, Final

# Response-format identifiers are duplicated as plain strings rather than imported
# from app.modules.assessments.enums: the validation engine needs this catalogue and
# lives in the assessments package, so importing the enum here would create an
# import cycle. tests/test_question_formats_registry.py asserts these stay in sync
# with QuestionResponseType.

RESPONSE_SINGLE_CHOICE: Final = "single_choice"
RESPONSE_MULTIPLE_CHOICE: Final = "multiple_choice"
RESPONSE_MATCHING: Final = "matching"
RESPONSE_ORDERING: Final = "ordering"
RESPONSE_GAP_FILL: Final = "gap_fill"
RESPONSE_SHORT_TEXT: Final = "short_text"
RESPONSE_LONG_TEXT: Final = "long_text"
RESPONSE_SPOKEN_RESPONSE: Final = "spoken_response"

# Response formats that render discrete answer options.
OPTION_BEARING_RESPONSE_TYPES: Final = frozenset(
    {RESPONSE_SINGLE_CHOICE, RESPONSE_MULTIPLE_CHOICE, RESPONSE_ORDERING}
)

MODULE_READING: Final = "reading"
MODULE_LISTENING: Final = "listening"
MODULE_LEXIQUE_STRUCTURE: Final = "lexique_structure"
MODULE_WRITING: Final = "writing"
MODULE_SPEAKING: Final = "speaking"

MODULE_LABELS: Final[dict[str, str]] = {
    MODULE_READING: "Compréhension écrite",
    MODULE_LISTENING: "Compréhension orale",
    MODULE_LEXIQUE_STRUCTURE: "Lexique et structure",
    MODULE_WRITING: "Expression écrite",
    MODULE_SPEAKING: "Expression orale",
}

STIMULUS_NONE: Final = "none"
STIMULUS_SINGLE_DOCUMENT: Final = "single_document"
STIMULUS_MULTI_DOCUMENT: Final = "multi_document"
STIMULUS_TABLE: Final = "table"
STIMULUS_AUDIO_TRANSCRIPT: Final = "audio_transcript"
STIMULUS_PROMPT_LEAD: Final = "prompt_lead"
STIMULUS_BROCHURE: Final = "brochure"

STIMULUS_KIND_LABELS: Final[dict[str, str]] = {
    STIMULUS_NONE: "Sans document",
    STIMULUS_SINGLE_DOCUMENT: "Un document",
    STIMULUS_MULTI_DOCUMENT: "Plusieurs documents (A/B/C/D)",
    STIMULUS_TABLE: "Tableau de données",
    STIMULUS_AUDIO_TRANSCRIPT: "Enregistrement sonore",
    STIMULUS_PROMPT_LEAD: "Amorce d'énoncé",
    STIMULUS_BROCHURE: "Brochure / annonce",
}

_CHOICE_FEW_SHOT: Final[dict[str, object]] = {
    "prompt": "Quelle est la principale raison de cet appel ?",
    "options": [
        {
            "content": "Demander un rendez-vous",
            "is_correct": True,
            "explanation": "L'appel est explicitement lié a une prise de rendez-vous.",
            "misconception_type": None,
            "distractor_rationale": None,
        },
        {
            "content": "Commander un projet",
            "is_correct": False,
            "explanation": "Aucun element du support ne mentionne une commande.",
            "misconception_type": "extrapolation",
            "distractor_rationale": "Le mot 'projet' apparait ailleurs dans le document.",
        },
    ],
}


class TaskFormatSpec:
    """Declarative description of one TEF item family.

    Attributes:
        code: Stable ``task_types.code`` value. Must match the seeded taxonomy row.
        module: One of the ``MODULE_*`` constants.
        name: Official French label used by the admin UI.
        admin_hint: Plain-language explanation of what the item asks the candidate
            to do. Deliberately non-technical: it is shown verbatim in the UI.
        stimulus_kind: See the ``STIMULUS_*`` constants.
        allowed_response_types: Response formats the generator may emit. The first
            entry is the default.
        option_count: Inclusive ``(minimum, maximum)`` number of answer options for
            choice-based response types. ``(0, 0)`` means "not applicable".
        prompt_guidance: Authoring instructions injected into the system prompt.
        few_shot: Minimal worked example handed to the model as a JSON template.
    """

    __slots__ = (
        "admin_hint",
        "allowed_response_types",
        "code",
        "few_shot",
        "module",
        "name",
        "option_count",
        "prompt_guidance",
        "stimulus_kind",
    )

    def __init__(
        self,
        *,
        code: str,
        module: str,
        name: str,
        admin_hint: str,
        stimulus_kind: str,
        allowed_response_types: tuple[str, ...],
        option_count: tuple[int, int] = (0, 0),
        prompt_guidance: str = "",
        few_shot: dict[str, object] | None = None,
    ) -> None:
        self.code = code
        self.module = module
        self.name = name
        self.admin_hint = admin_hint
        self.stimulus_kind = stimulus_kind
        self.allowed_response_types = allowed_response_types or (
            RESPONSE_SINGLE_CHOICE,
        )
        self.option_count = option_count
        self.prompt_guidance = prompt_guidance
        self.few_shot = few_shot or {}

    @property
    def default_response_type(self) -> str:
        """Response format used when the admin does not pick one explicitly."""
        return self.allowed_response_types[0]

    @property
    def requires_stimulus(self) -> bool:
        """Whether the item family is invalid without an attached source document."""
        return self.stimulus_kind != STIMULUS_NONE

    @property
    def uses_options(self) -> bool:
        """Whether this family renders discrete answer options."""
        return any(response_type_uses_options(rt) for rt in self.allowed_response_types)

    @property
    def prompt_template_version(self) -> str:
        """Deterministic prompt-template version recorded in provenance."""
        return f"tef_{self.code}_gen_v3.0"

    def accepts(self, response_type: str | None) -> bool:
        """Return whether ``response_type`` is a valid format for this family."""
        return bool(response_type) and response_type in self.allowed_response_types

    def coerce_response_type(self, requested: str | None) -> str:
        """Resolve an admin-requested response type against this family.

        Falls back to the family default rather than raising, so a stale client
        can never break generation outright.
        """
        if self.accepts(requested):
            return str(requested)
        return self.default_response_type

    def coerce_option_count(self, requested: int | None) -> int | None:
        """Clamp an admin-requested option count into the family's valid range.

        Returns ``None`` when the family does not use discrete options.
        """
        minimum, maximum = self.option_count
        if maximum == 0:
            return None
        if requested is None:
            return maximum
        return max(minimum, min(maximum, requested))


    def as_dict(self) -> dict[str, Any]:
        """Serialisable projection consumed by the admin frontend."""
        minimum, maximum = self.option_count
        return {
            "code": self.code,
            "module": self.module,
            "module_label": MODULE_LABELS.get(self.module, self.module),
            "name": self.name,
            "admin_hint": self.admin_hint,
            "stimulus_kind": self.stimulus_kind,
            "stimulus_kind_label": STIMULUS_KIND_LABELS.get(
                self.stimulus_kind, self.stimulus_kind
            ),
            "requires_stimulus": self.requires_stimulus,
            "allowed_response_types": list(self.allowed_response_types),
            "default_response_type": self.default_response_type,
            "option_count_min": minimum,
            "option_count_max": maximum,
            "prompt_guidance": self.prompt_guidance,
        }


def _spec(
    code: str,
    module: str,
    name: str,
    admin_hint: str,
    stimulus_kind: str,
    allowed_response_types: tuple[str, ...],
    prompt_guidance: str,
    *,
    option_count: tuple[int, int] = (0, 0),
    few_shot: dict[str, object] | None = None,
) -> TaskFormatSpec:
    """Positional constructor keeping the specification table readable."""
    return TaskFormatSpec(
        code=code,
        module=module,
        name=name,
        admin_hint=admin_hint,
        stimulus_kind=stimulus_kind,
        allowed_response_types=allowed_response_types,
        option_count=option_count,
        prompt_guidance=prompt_guidance,
        few_shot=few_shot,
    )


_SINGLE = RESPONSE_SINGLE_CHOICE
_MULTI = RESPONSE_MULTIPLE_CHOICE
_MATCHING = RESPONSE_MATCHING
_ORDERING = RESPONSE_ORDERING
_GAP_FILL = RESPONSE_GAP_FILL
_SHORT_TEXT = RESPONSE_SHORT_TEXT
_LONG_TEXT = RESPONSE_LONG_TEXT
_SPOKEN = RESPONSE_SPOKEN_RESPONSE


_SPEC_LIST: Final[tuple[TaskFormatSpec, ...]] = (
    # --- Comprehension ecrite ------------------------------------------------
    _spec(
        "daily_document",
        MODULE_READING,
        "Documents de la vie quotidienne",
        "Annonces, affiches, menus, horaires, prospectus. Le candidat repere une "
        "information factuelle precise dans un document court.",
        STIMULUS_SINGLE_DOCUMENT,
        (_SINGLE, _MULTI),
        "La question porte sur une information factuelle explicite (prix, horaire, "
        "condition, public vise). Les distracteurs reprennent des elements presents "
        "dans le document mais associes au mauvais champ.",
        option_count=(2, 4),
        few_shot=_CHOICE_FEW_SHOT,
    ),
    _spec(
        "sentence_gap",
        MODULE_READING,
        "Phrases a completer",
        "Une phrase isolee avec un blanc. Le candidat choisit le mot ou le groupe de "
        "mots qui complete la phrase. Aucun document externe.",
        STIMULUS_NONE,
        (_SINGLE,),
        "NE GENERE AUCUN STIMULUS (stimulus_title et stimulus_content doivent etre "
        "null). Le prompt doit etre une phrase complete contenant un blanc represente "
        "par '______'. Les options sont 4 mots ou locutions grammaticales de longueur "
        "comparable.",
        option_count=(4, 4),
        few_shot=_CHOICE_FEW_SHOT,
    ),
    _spec(
        "text_gap",
        MODULE_READING,
        "Textes a trous",
        "Un paragraphe suivi d'un blanc. Le candidat choisit le connecteur ou le mot qui "
        "assure la cohesion du texte. Variante : plusieurs blancs a remplir librement.",
        STIMULUS_SINGLE_DOCUMENT,
        (_SINGLE, _GAP_FILL),
        "Le stimulus est un texte suivi comportant une lacune identifiee par '______'. "
        "En mode gap_fill, declare chaque lacune dans 'gaps' avec ses variantes "
        "acceptees et marque-les dans le texte avec [gap:gap_1].",
        option_count=(4, 4),
        few_shot=_CHOICE_FEW_SHOT,
    ),
    _spec(
        "document_matching",
        MODULE_READING,
        "Appariement de documents",
        "Quatre documents courts A, B, C, D. Le candidat associe chaque besoin au "
        "document qui lui correspond. Le bon format est l'appariement.",
        STIMULUS_MULTI_DOCUMENT,
        (_MATCHING,),
        "Le stimulus est compose de 4 documents distincts libelles '### Document A : ...', "
        "'### Document B : ...', '### Document C : ...', '### Document D : ...'. La "
        "question decrit autant de profils ou besoins que de documents. L'appariement "
        "doit etre bijectif : chaque document est utilise exactement une fois.",
        option_count=(4, 4),
        few_shot={
            "prompt": "Pour chaque besoin, indiquez le document correspondant.",
            "sources": [
                {"id": "besoin_1", "text": "Souhaite se former le week-end"},
                {"id": "besoin_2", "text": "Recherche des soins a distance"},
            ],
            "targets": [
                {"id": "doc_a", "text": "Document A"},
                {"id": "doc_b", "text": "Document B"},
            ],
            "pairs": [
                {"source_id": "besoin_1", "target_id": "doc_a"},
                {"source_id": "besoin_2", "target_id": "doc_b"},
            ],
        },
    ),
    _spec(
        "graph_matching",
        MODULE_READING,
        "Appariement graphiques et enonces",
        "Un tableau de donnees chiffrees. Le candidat associe chaque enonce "
        "d'interpretation a la bonne serie. Le bon format est l'appariement.",
        STIMULUS_TABLE,
        (_MATCHING,),
        "Le stimulus est un tableau Markdown avec entetes claires et valeurs chiffrees "
        "precises. Les enonces doivent chacun correspondre a une seule lecture du "
        "tableau. L'appariement doit etre bijectif.",
        option_count=(4, 4),
        few_shot={
            "prompt": "Associez chaque enonce a la serie correspondante.",
            "sources": [
                {"id": "enonce_1", "text": "Les transports en commun progressent"},
                {"id": "enonce_2", "text": "La voiture individuelle recule"},
            ],
            "targets": [
                {"id": "serie_1", "text": "Transports en commun"},
                {"id": "serie_2", "text": "Voiture individuelle"},
            ],
            "pairs": [
                {"source_id": "enonce_1", "target_id": "serie_1"},
                {"source_id": "enonce_2", "target_id": "serie_2"},
            ],
        },
    ),
    _spec(
        "administrative_document",
        MODULE_READING,
        "Documents administratifs et reglementaires",
        "Formulaires, notices, reglements, consignes officielles. Le candidat identifie "
        "une regle, une condition d'eligibilite ou une procedure.",
        STIMULUS_SINGLE_DOCUMENT,
        (_SINGLE, _MULTI),
        "Le support presente des regles, conditions d'eligibilite ou procedures "
        "administratives dans un ton formel. La bonne reponse doit etre la seule "
        "veritablement conforme au texte.",
        option_count=(4, 4),
        few_shot=_CHOICE_FEW_SHOT,
    ),
    _spec(
        "professional_document",
        MODULE_READING,
        "Communications professionnelles",
        "Notes de service, comptes rendus, courriels internes. Le candidat repere une "
        "directive, une contrainte ou une echeance metier.",
        STIMULUS_SINGLE_DOCUMENT,
        (_SINGLE, _MULTI),
        "Le support simule une communication d'entreprise sur une directive interne. Les "
        "distracteurs reprennent un element reel du document en lui attribuant une portee "
        "fausse.",
        option_count=(4, 4),
        few_shot=_CHOICE_FEW_SHOT,
    ),
    _spec(
        "press_article",
        MODULE_READING,
        "Articles de presse et analyses",
        "Article de fond, tribune, analyse. Le candidat identifie la these, l'implicite, "
        "le ton ou la nuance de l'auteur.",
        STIMULUS_SINGLE_DOCUMENT,
        (_SINGLE, _MULTI),
        "Le support est un article journalistique elabore presentant une problematique "
        "avec arguments et contre-arguments. La question evalue la these, l'implicite ou "
        "l'attitude de l'auteur plutot qu'un simple reperage.",
        option_count=(4, 4),
        few_shot=_CHOICE_FEW_SHOT,
    ),
    _spec(
        "text_ordering",
        MODULE_READING,
        "Textes dans le desordre",
        "Un texte decoupe en segments que le candidat doit remettre dans l'ordre "
        "chronologique ou logique. Le bon format est l'ordonnancement.",
        STIMULUS_SINGLE_DOCUMENT,
        (_ORDERING,),
        "Le stimulus est un texte coherent. Les segments sont des blocs de 15 a 40 mots "
        "dont l'ordre correct est non ambigu et verifiable par les connecteurs temporels "
        "ou causaux. 'correct_position' commence a 1. Les 'keys' doivent etre uniques et "
        "stables (seg_1, seg_2, ...).",
        option_count=(4, 6),
        few_shot={
            "prompt": "Remettez les segments dans l'ordre logique du recit.",
            "items": [
                {"key": "seg_1", "text": "...", "correct_position": 1},
                {"key": "seg_2", "text": "...", "correct_position": 2},
            ],
        },
    ),
    _spec(
        "reformulation",
        MODULE_READING,
        "Phrases a reformuler",
        "Le candidat reformule une phrase du texte avec ses propres mots. Correction par "
        "variantes de reponse acceptees.",
        STIMULUS_SINGLE_DOCUMENT,
        (_SHORT_TEXT,),
        "Le stimulus est un court texte. Le prompt demande de reformuler une phrase "
        "precise. Declare 3 a 6 formulations acceptees, realistes pour un candidat du "
        "niveau vise. Active ignore_accents quand la reformulation tolere les accents.",
        few_shot={
            "prompt": "Reformulez la phrase encadree avec vos propres mots.",
            "accepted_answers": ["exemple de reformulation"],
            "ignore_case": True,
            "ignore_accents": False,
        },
    ),
    # --- Comprehension orale -------------------------------------------------
    _spec(
        "short_announcement",
        MODULE_LISTENING,
        "Annonces et messages courts",
        "Annonce en gare, message sur repondeur, publicite. Le candidat capte "
        "l'intention et le cadre d'un message bref.",
        STIMULUS_AUDIO_TRANSCRIPT,
        (_SINGLE, _MULTI),
        "Le stimulus est la transcription d'un message oral court (30 a 60 mots) avec "
        "indications sonores entre crochets, par exemple '[Bip sonore]'.",
        option_count=(2, 4),
        few_shot=_CHOICE_FEW_SHOT,
    ),
    _spec(
        "radio_broadcast",
        MODULE_LISTENING,
        "Emissions et chroniques radiophoniques",
        "Reportage ou chronique radio. Le candidat suit un expose argumente avec "
        "journaliste et intervenant.",
        STIMULUS_AUDIO_TRANSCRIPT,
        (_SINGLE, _MULTI),
        "Le stimulus est la transcription d'une emission radio (100 a 200 mots) avec un "
        "journaliste et au moins un intervenant identifie.",
        option_count=(4, 4),
        few_shot=_CHOICE_FEW_SHOT,
    ),
    _spec(
        "public_survey",
        MODULE_LISTENING,
        "Micro-trottoirs et sondages d'opinion",
        "Plusieurs personnes s'expriment sur un meme sujet. Le candidat identifie la "
        "position de chaque locuteur.",
        STIMULUS_AUDIO_TRANSCRIPT,
        (_SINGLE, _MULTI),
        "Le stimulus comporte les avis successifs de 4 personnes identifiees "
        "('Locuteur 1 : ...', 'Locuteur 2 : ...', ...) exprimant des opinions divergentes "
        "ou nuancees. La question porte sur qui est pour, contre, ou favorable avec reserve.",
        option_count=(4, 4),
        few_shot=_CHOICE_FEW_SHOT,
    ),
    _spec(
        "message_association",
        MODULE_LISTENING,
        "Appariement de messages",
        "Le candidat classe plusieurs messages entendus selon leur nature (familial, "
        "amical, professionnel, publicitaire). Le bon format est l'appariement.",
        STIMULUS_AUDIO_TRANSCRIPT,
        (_MATCHING,),
        "Le stimulus transcrit plusieurs messages distincts numerotes ('Message 1 : "
        "...'). Les cibles sont les categories de nature. L'appariement doit etre "
        "bijectif : chaque message releve d'une seule categorie.",
        option_count=(4, 4),
        few_shot={
            "prompt": "Indiquez la nature de chaque message.",
            "sources": [
                {"id": "msg_1", "text": "Message 1"},
                {"id": "msg_2", "text": "Message 2"},
            ],
            "targets": [
                {"id": "familial", "text": "Familial"},
                {"id": "publicitaire", "text": "Publicitaire"},
            ],
            "pairs": [
                {"source_id": "msg_1", "target_id": "familial"},
                {"source_id": "msg_2", "target_id": "publicitaire"},
            ],
        },
    ),
    _spec(
        "conversation_extract",
        MODULE_LISTENING,
        "Dialogues et entretiens longs",
        "Echange formel entre deux personnes, ou interview. Le candidat suit une "
        "information a travers plusieurs tours de parole.",
        STIMULUS_AUDIO_TRANSCRIPT,
        (_SINGLE, _MULTI),
        "Le stimulus est la transcription d'un dialogue formel (150 a 250 mots) avec deux "
        "locuteurs clairement identifies. La question exige de croiser plusieurs tours de "
        "parole plutot qu'un seul extrait.",
        option_count=(4, 4),
        few_shot=_CHOICE_FEW_SHOT,
    ),
    _spec(
        "phonological_recognition",
        MODULE_LISTENING,
        "Discrimination phonetique et intonation",
        "Enonce court. Le candidat distingue des sons proches ou identifie l'intonation "
        "et l'acte de communication.",
        STIMULUS_AUDIO_TRANSCRIPT,
        (_SINGLE,),
        "Le stimulus transcrit une phrase orale courte. La question porte sur l'intonation "
        "(affirmation, question, surprise) ou la distinction phonetique entre deux termes "
        "proches. Les options doivent etre tres courtes (2 a 4 mots).",
        option_count=(2, 3),
        few_shot=_CHOICE_FEW_SHOT,
    ),
    # --- Lexique et structure ------------------------------------------------
    _spec(
        "word_formation",
        MODULE_LEXIQUE_STRUCTURE,
        "Formation des mots",
        "Trouver le prefixe, le suffixe ou la base qui complete un mot. Teste la maitrise "
        "de la morphologie derivationnelle.",
        STIMULUS_NONE,
        (_SINGLE,),
        "NE GENERE AUCUN STIMULUS. L'item porte sur un seul mot ou radical. Toutes les "
        "options doivent etre de meme nature morphologique (tous des prefixes, ou tous des "
        "suffixes) et chaque distracteur doit produire un mot reellement atteste en "
        "francais.",
        option_count=(4, 5),
        few_shot=_CHOICE_FEW_SHOT,
    ),
    _spec(
        "adjective_agreement",
        MODULE_LEXIQUE_STRUCTURE,
        "Accord et place de l'adjectif",
        "Le candidat choisit la forme d'adjectif correcte : accord en genre et nombre, ou "
        "position avant/apres le nom.",
        STIMULUS_NONE,
        (_SINGLE,),
        "NE GENERE AUCUN STIMULUS. Le prompt est une phrase complete. Les options sont des "
        "formes d'adjectifs. Les distracteurs sont des erreurs d'accord ou de placement "
        "plausibles pour un locuteur non natif.",
        option_count=(4, 5),
        few_shot=_CHOICE_FEW_SHOT,
    ),
    _spec(
        "pronoun_reference",
        MODULE_LEXIQUE_STRUCTURE,
        "Reprise anaphorique et mots outils",
        "Le candidat choisit le pronom ou connecteur qui evite une repetition et designe "
        "correctement le bon antecedent.",
        STIMULUS_SINGLE_DOCUMENT,
        (_SINGLE, _MULTI),
        "Le stimulus est un court paragraphe de 60 a 100 mots comportant au moins deux "
        "antecedents de genre et de nombre distincts. Les options sont uniquement des "
        "pronoms ou connecteurs. Le distracteur correct pointe vers le mauvais antecedent.",
        option_count=(4, 5),
        few_shot=_CHOICE_FEW_SHOT,
    ),
    _spec(
        "syntax_construction",
        MODULE_LEXIQUE_STRUCTURE,
        "Construction et syntaxe",
        "Le candidat choisit la construction correcte : subordonnee, complement du nom, "
        "ordre des mots, negation ou hypothese.",
        STIMULUS_SINGLE_DOCUMENT,
        (_SINGLE, _MULTI),
        "Le stimulus est un court texte de 60 a 120 mots. Les options sont des variantes "
        "syntaxiques de la meme phrase. Une seule est correcte ; les autres sont des "
        "erreurs d'accord, de zeugme ou de placement.",
        option_count=(4, 5),
        few_shot=_CHOICE_FEW_SHOT,
    ),
    # --- Expression ecrite ---------------------------------------------------
    _spec(
        "fait_divers",
        MODULE_WRITING,
        "Redaction d'un fait divers",
        "Section A. Le candidat raconte la suite d'un evenement insolite en employant les "
        "temps du passe. 80 mots minimum.",
        STIMULUS_PROMPT_LEAD,
        (_LONG_TEXT,),
        "Le stimulus est une amorce journalistique de 2 a 3 lignes. La consigne invite a "
        "rediger la suite des evenements au passe. NE PRODUIS AUCUNE liste de reponses : il "
        "n'y a pas de bonne reponse unique. Le champ 'scoring_payload.rubric' decrit les "
        "criteres evalues (recit au passe, coherence narrative, vocabulaire).",
        few_shot={
            "prompt": "Racontez la suite des evenements (80 a 120 mots).",
            "rubric": [
                "Emploi correct du passe compose et de l'imparfait",
                "Coherence narrative",
            ],
        },
    ),
    _spec(
        "opinion_letter",
        MODULE_WRITING,
        "Lettre d'argumentation et d'opinion",
        "Section B. Le candidat exprime et defend son point de vue dans un ecrit argumente. "
        "200 mots minimum.",
        STIMULUS_PROMPT_LEAD,
        (_LONG_TEXT,),
        "Le stimulus enonce une situation litigieuse. La consigne demande d'ecrire au "
        "journal ou a une autorite pour defendre un point de vue argumente (200 a 250 "
        "mots). NE PRODUIS AUCUNE liste de reponses. Le champ 'scoring_payload.rubric' "
        "decrit les criteres evalues.",
        few_shot={
            "prompt": "Redigez votre reponse argumentee (200 a 250 mots).",
            "rubric": [
                "Prise de position explicite",
                "Arguments illustres",
                "Registre formel adapte au destinataire",
            ],
        },
    ),
    # --- Expression orale ----------------------------------------------------
    _spec(
        "information_gathering",
        MODULE_SPEAKING,
        "Recueil d'informations",
        "Section A. Jeu de role formel de 5 minutes : le candidat pose une dizaine de "
        "questions precises pour obtenir des informations.",
        STIMULUS_BROCHURE,
        (_SPOKEN,),
        "Le stimulus presente une petite annonce detaillee (voyage, logement, offre "
        "d'emploi). La consigne invite le candidat a poser des questions et a relever une "
        "information. NE PRODUIS AUCUNE liste de reponses. Le champ "
        "'scoring_payload.rubric' decrit les criteres evalues par l'examinateur.",
        few_shot={
            "prompt": "Renseignez-vous sur cette offre (5 minutes).",
            "rubric": [
                "Questions pertinentes et variees",
                "Releve correcte des informations",
            ],
        },
    ),
    _spec(
        "persuasive_argumentation",
        MODULE_SPEAKING,
        "Argumentation persuasive",
        "Section B. Le candidat presente puis defend une proposition face a un "
        "interlocuteur reticent (10 minutes).",
        STIMULUS_BROCHURE,
        (_SPOKEN,),
        "Le stimulus est une brochure ou une proposition d'activite. La consigne invite a "
        "convaincre un ami reticent. NE PRODUIS AUCUNE liste de reponses. Le champ "
        "'scoring_payload.rubric' decrit les criteres evalues.",
        few_shot={
            "prompt": "Convainquez votre interlocuteur (10 minutes).",
            "rubric": [
                "Argumentation structuree",
                "Traitement de l'objection",
            ],
        },
    ),
)


QUESTION_FORMAT_SPECS: Final[dict[str, TaskFormatSpec]] = {
    spec.code: spec for spec in _SPEC_LIST
}


def get_spec(code: str | None) -> TaskFormatSpec | None:
    """Return the registry entry for ``code``, or ``None`` when unknown."""
    if not code:
        return None
    return QUESTION_FORMAT_SPECS.get(code)


def specs_for_module(module: str) -> list[TaskFormatSpec]:
    """Return every registry entry belonging to ``module``, in declaration order."""
    return [spec for spec in _SPEC_LIST if spec.module == module]


def prompt_template_version_for(code: str | None, fallback: str = "tef_qgen_v3.0") -> str:
    """Resolve the provenance-recorded prompt template version for a task type."""
    spec = get_spec(code)
    return spec.prompt_template_version if spec else fallback


def standard_option_count_for(response_type: str | None) -> tuple[int, int]:
    """Return the prevailing ``(min, max)`` option range for a response format.

    Used by the validation engine, which sees a response format but not always a
    task type. The most common range across every family that allows the format
    wins, which keeps the familiar "four choices" expectation for single choice
    while still allowing the 2-3 and 4-5 families to pass untouched.
    """
    default = (4, 4)
    if not response_type:
        return default
    tally: dict[tuple[int, int], int] = {}
    for spec in _SPEC_LIST:
        if response_type not in spec.allowed_response_types:
            continue
        if spec.option_count[1] == 0:
            continue
        tally[spec.option_count] = tally.get(spec.option_count, 0) + 1
    if not tally:
        return default
    return max(tally.items(), key=lambda entry: (entry[1], entry[0]))[0]


def response_type_uses_options(response_type: str | None) -> bool:
    """Return whether a *specific* response format renders answer options.

    This is deliberately narrower than :attr:`TaskFormatSpec.uses_options`.
    A family may offer both a choice variant and a free-response variant -- for
    example ``text_gap`` allows ``single_choice`` *and* ``gap_fill`` -- so code
    acting on one concrete question must consult the item's own response type
    instead of the family's capabilities.
    """
    return bool(response_type) and response_type in OPTION_BEARING_RESPONSE_TYPES


def accepts_response_type(code: str | None, response_type: str | None) -> bool:
    """Return whether ``response_type`` is a valid format for task type ``code``.

    Unknown task types are permissive so that pre-registry content still validates.
    """
    if not response_type:
        return False
    spec = get_spec(code)
    if spec is None:
        return True
    return spec.accepts(response_type)


def catalog_payload() -> dict[str, Any]:
    """Serialisable catalogue served to the admin frontend."""
    return {
        "modules": [
            {"code": code, "label": label} for code, label in MODULE_LABELS.items()
        ],
        "stimulus_kinds": [
            {"code": code, "label": label} for code, label in STIMULUS_KIND_LABELS.items()
        ],
        "formats": [spec.as_dict() for spec in _SPEC_LIST],
    }