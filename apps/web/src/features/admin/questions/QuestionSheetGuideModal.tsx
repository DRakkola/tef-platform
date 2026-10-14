import React, { useEffect, useState } from "react";
import {
  BookOpen,
  X,
  Download,
  Copy,
  Check,
  Search,
  Layers,
  Tag,
  HelpCircle,
  Table2,
  Info,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadImportTemplateCsv } from "../api";

interface QuestionSheetGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type GuideTab = "question_types" | "task_types" | "columns" | "enums" | "skills";

const COLUMNS_GUIDE = [
  {
    name: "prompt",
    aliases: "question, enonce, énoncé",
    required: true,
    defaultVal: "—",
    description: "Énoncé principal de la question ou consigne posée au candidat.",
  },
  {
    name: "task_type_code",
    aliases: "task_type, type_tache, type_de_tache",
    required: false,
    defaultVal: "Auto-inféré",
    description:
      "Format de tâche canonique TEF (ex: daily_document, press_article, sentence_gap, opinion_letter...). Restreint et valide les compétences admissibles.",
  },
  {
    name: "question_type",
    aliases: "response_type",
    required: false,
    defaultVal: "single_choice",
    description:
      "Format de la question (single_choice, multiple_choice, gap_fill, short_text, matching, ordering, long_text, spoken_response, interaction).",
  },
  {
    name: "modality",
    aliases: "modalite, modalité",
    required: false,
    defaultVal: "reading",
    description:
      "Section TEF cible : reading, listening, lexique_structure, writing, speaking.",
  },
  {
    name: "level",
    aliases: "target_cefr, cefr, niveau",
    required: false,
    defaultVal: "B1",
    description: "Niveau CECRL cible : A1, A2, B1, B2, C1, C2.",
  },
  {
    name: "difficulty",
    aliases: "difficulte",
    required: false,
    defaultVal: "3",
    description:
      "Difficulté intra-niveau de 1 (très facile) à 5 (très difficile). Calcule automatiquement le score psychométrique [100–699].",
  },
  {
    name: "cognitive_complexity",
    aliases: "—",
    required: false,
    defaultVal: "interpretation",
    description:
      "Complexité cognitive : recall_recognition, interpretation, inferencing_synthesis, critical_evaluation.",
  },
  {
    name: "option_a .. option_d",
    aliases: "opt_a..d, choice_a..d, option_1..4",
    required: false,
    defaultVal: "—",
    description:
      "Propositions de réponse (obligatoires pour QCM, appariement, ordonnancement, texte à trous).",
  },
  {
    name: "correct_option",
    aliases: "correct_answer, reponse_correcte",
    required: false,
    defaultVal: "A",
    description:
      "Clé de correction : lettre (A, B, C, D), numéro (1..4), texte exact, ou liste séparée par virgule (ex: A,C).",
  },
  {
    name: "misconception_a .. misconception_d",
    aliases: "misconception_type_a..d, piege_a..d",
    required: false,
    defaultVal: "—",
    description:
      "Code du piège cognitif du distracteur (ex: surface_association, negation_trap, literal_trap, overgeneralization...).",
  },
  {
    name: "rationale_a .. rationale_d",
    aliases: "distractor_rationale_a..d, justification_a..d",
    required: false,
    defaultVal: "—",
    description:
      "Justification pédagogique spécifique expliquant pourquoi cette option est un piège / incorrecte.",
  },
  {
    name: "gaps",
    aliases: "trous, lacunes",
    required: false,
    defaultVal: "—",
    description:
      "JSON structuré pour textes à trous multi-lacunes. Tableau d'objets décrivant chaque trou [1], [2]... avec ses 4 options (A, B, C, D), sa réponse correcte et ses pièges didactiques. Le texte et l'ensemble de ses trous forment une question unique indivisible.",
  },
  {
    name: "stimulus_title",
    aliases: "titre_document",
    required: false,
    defaultVal: "—",
    description: "Titre du document support (article, annonce, courriel, transcription).",
  },
  {
    name: "stimulus_text",
    aliases: "texte_document, passage",
    required: false,
    defaultVal: "—",
    description: "Contenu textuel du document support (accepte le texte brut ou Markdown, avec [1], [2]... pour les textes à trous).",
  },
  {
    name: "media_url",
    aliases: "audio_url",
    required: false,
    defaultVal: "—",
    description: "URL du fichier audio/média (recommandé pour la modalité listening).",
  },
  {
    name: "explanation",
    aliases: "explication",
    required: false,
    defaultVal: "—",
    description:
      "Explication pédagogique globale affichée lors de la correction détaillée.",
  },
  {
    name: "skill_codes",
    aliases: "skills, competences, compétences",
    required: false,
    defaultVal: "Auto-inféré",
    description:
      "Codes de compétences Taxonomy V1 séparés par virgule ou point-virgule (ex: identify_main_idea,locate_information).",
  },
  {
    name: "points / penalty_points",
    aliases: "—",
    required: false,
    defaultVal: "1 / 0",
    description: "Pondération positive et pénalité éventuelle de l'item.",
  },
];

const QUESTION_TYPES_GUIDE = [
  {
    code: "single_choice",
    label: "QCM à choix unique",
    optionsRule: "Au moins 2 options (recommandé : 4 options A..D)",
    correctRule: "Une seule lettre : A, B, C ou D (ou 1..4)",
    examplePrompt: "Quel est le thème principal de cette annonce ?",
    exampleOptions: "option_a: Ouverture | option_b: Fermeture | option_c: Festival | option_d: Grève",
    exampleCorrect: "B",
  },
  {
    code: "multiple_choice",
    label: "QCM à choix multiple",
    optionsRule: "Au moins 2 options (option_a..option_d)",
    correctRule: "Lettres séparées par virgule ou point-virgule : A,C ou A;C",
    examplePrompt: "Quelles conditions permettent d'obtenir le tarif réduit ?",
    exampleOptions: "option_a: Moins de 26 ans | option_b: Hors UE | option_c: Carte étudiant | option_d: Réservation 30j",
    exampleCorrect: "A,C",
  },
  {
    code: "gap_fill",
    label: "Texte à trous / Cloze (Multi-lacunes indivisible)",
    optionsRule: "4 options par trou (ou champ gaps JSON). Le texte et l'ensemble de ses trous forment UNE SEULE question indivisible.",
    correctRule: "Une réponse correcte par trou. Notation proportionnelle TEF sans pénalité.",
    examplePrompt: "Complétez le texte en sélectionnant la bonne réponse pour chaque trou [1], [2]...",
    exampleOptions: "Trou [1]: Néanmoins (V), De plus (F), En fait (F) | Trou [2]: stabiliser (V), aggraver (F)",
    exampleCorrect: "1: A, 2: B (ou tableau gaps)",
  },
  {
    code: "short_text",
    label: "Réponse courte ouverte (alias : text_input)",
    optionsRule: "Réponses acceptées dans option_a, option_b... (ou directement dans correct_option)",
    correctRule: "A,B (toutes les variantes acceptées)",
    examplePrompt: "Quel mot du texte est synonyme de « amélioration » ?",
    exampleOptions: "option_a: modernisation | option_b: perfectionnement",
    exampleCorrect: "A,B",
  },
  {
    code: "matching",
    label: "Appariement de paires",
    optionsRule: "Au moins 2 paires au format « Élément gauche -> Élément droit » dans option_a..d",
    correctRule: "A,B,C,D (ou laisser vide : toutes les paires sont validées)",
    examplePrompt: "Associez chaque annonce au profil correspondant.",
    exampleOptions: "option_a: Annonce 1 -> Stagiaire | option_b: Annonce 2 -> Famille",
    exampleCorrect: "A,B,C,D",
  },
  {
    code: "ordering",
    label: "Ordonnancement chronologique / logique",
    optionsRule: "Au moins 2 étapes saisies dans l'ordre attendu de option_a à option_d",
    correctRule: "A,B,C,D (l'ordre A -> B -> C -> D fait foi)",
    examplePrompt: "Remettez dans l'ordre les étapes d'inscription.",
    exampleOptions: "option_a: Créer un compte | option_b: Joindre les pièces | option_c: Payer | option_d: Convocation",
    exampleCorrect: "A,B,C,D",
  },
  {
    code: "long_text",
    label: "Production écrite longue (Expression écrite)",
    optionsRule: "Aucune option requise (laisser option_a..d vides)",
    correctRule: "Laisser vide (évaluation par grille critériée IA / enseignant)",
    examplePrompt: "Rédigez une lettre argumentée au maire (180 mots min.) sur les pistes cyclables.",
    exampleOptions: "(vide)",
    exampleCorrect: "(vide)",
  },
  {
    code: "spoken_response",
    label: "Production orale — Monologue suivi",
    optionsRule: "Aucune option requise (laisser option_a..d vides)",
    correctRule: "Laisser vide (évaluation orale)",
    examplePrompt: "Présentez les avantages et inconvénients du télétravail (2 à 3 min).",
    exampleOptions: "(vide)",
    exampleCorrect: "(vide)",
  },
  {
    code: "interaction",
    label: "Interaction orale — Jeu de rôle (Section A/B)",
    optionsRule: "Aucune option requise (laisser option_a..d vides)",
    correctRule: "Laisser vide (évaluation orale interactive)",
    examplePrompt: "Appelez l'organisateur du séjour linguistique pour poser une dizaine de questions.",
    exampleOptions: "(vide)",
    exampleCorrect: "(vide)",
  },
];

const TASK_TYPES_GUIDE = [
  // READING (10)
  {
    code: "daily_document",
    modality: "reading",
    modalityLabel: "Compréhension écrite",
    label: "Document de la vie quotidienne",
    description: "Petites annonces, courriels courts, menus, horaires, prospectus pratiques.",
    defaultCefr: "A1–B1",
    typicalSkills: "locate_information, identify_specific_detail, vocabulary_in_context",
  },
  {
    code: "press_article",
    modality: "reading",
    modalityLabel: "Compréhension écrite",
    label: "Article d'information / opinion",
    description: "Articles de presse généraliste ou spécialisée présentant un fait d'actualité ou un débat d'idées.",
    defaultCefr: "B1–C1",
    typicalSkills: "identify_main_idea, identify_stance_and_perspective, infer_implicit_information",
  },
  {
    code: "administrative_document",
    modality: "reading",
    modalityLabel: "Compréhension écrite",
    label: "Document administratif / formulaire",
    description: "Règlements, démarches officielles, avis municipaux, fiches de consignes.",
    defaultCefr: "A2–B2",
    typicalSkills: "locate_information, identify_specific_detail, understand_sequence",
  },
  {
    code: "professional_document",
    modality: "reading",
    modalityLabel: "Compréhension écrite",
    label: "Document professionnel / entreprise",
    description: "Comptes-rendus, notes internes, consignes de sécurité, courriels de collègues.",
    defaultCefr: "B1–B2",
    typicalSkills: "locate_information, understand_context, identify_communicative_intention",
  },
  {
    code: "sentence_gap",
    modality: "reading",
    modalityLabel: "Compréhension écrite",
    label: "Phrase lacunaire (choix ciblé)",
    description: "Phrase isolée où un mot pivot, un connecteur ou une forme verbale manque.",
    defaultCefr: "A2–B2",
    typicalSkills: "vocabulary_in_context, paraphrase_and_synonym_recognition, discourse_connectors",
  },
  {
    code: "text_gap",
    modality: "reading",
    modalityLabel: "Compréhension écrite",
    label: "Texte à trous suivi",
    description: "Paragraphe continu avec plusieurs trous testant la cohérence textuelle globale.",
    defaultCefr: "B1–C1",
    typicalSkills: "textual_cohesion_and_coherence, discourse_connectors, reference_resolution",
  },
  {
    code: "document_matching",
    modality: "reading",
    modalityLabel: "Compréhension écrite",
    label: "Appariement de documents / annonces",
    description: "Association de profils, besoins ou critères avec plusieurs textes courts.",
    defaultCefr: "A2–B2",
    typicalSkills: "compare_information, locate_information, synthesize_information",
  },
  {
    code: "graph_matching",
    modality: "reading",
    modalityLabel: "Compréhension écrite",
    label: "Graphique & infographie",
    description: "Analyse de données chiffrées, graphiques de tendances et mise en relation avec le texte.",
    defaultCefr: "B2–C1",
    typicalSkills: "interpret_data_trends, correlate_data_and_text, synthesize_information",
  },
  {
    code: "text_ordering",
    modality: "reading",
    modalityLabel: "Compréhension écrite",
    label: "Reconstitution chronologique / logique",
    description: "Paragraphes ou phrases désordonnés à réagencer selon la progression discursive.",
    defaultCefr: "B1–B2",
    typicalSkills: "understand_sequence, textual_cohesion_and_coherence, reference_resolution",
  },
  {
    code: "reformulation",
    modality: "reading",
    modalityLabel: "Compréhension écrite",
    label: "Paraphrase & reformulation fidèle",
    description: "Identification de la phrase qui exprime exactement la même idée sans déformation.",
    defaultCefr: "B1–C1",
    typicalSkills: "paraphrase_and_synonym_recognition, identify_stance_and_perspective",
  },

  // LISTENING (6)
  {
    code: "short_announcement",
    modality: "listening",
    modalityLabel: "Compréhension orale",
    label: "Annonce publique courte",
    description: "Messages de sonorisation en gare, aéroport, magasin, messages téléphoniques.",
    defaultCefr: "A1–B1",
    typicalSkills: "locate_information, identify_specific_detail, identify_communicative_intention",
  },
  {
    code: "radio_broadcast",
    modality: "listening",
    modalityLabel: "Compréhension orale",
    label: "Chronique radiophonique",
    description: "Émissions radio, reportages, chroniques météo ou culturelles.",
    defaultCefr: "B1–C1",
    typicalSkills: "identify_main_idea, infer_implicit_information, identify_tone",
  },
  {
    code: "public_survey",
    modality: "listening",
    modalityLabel: "Compréhension orale",
    label: "Micro-trottoir / sondage",
    description: "Multiples avis de personnes interrogées sur un sujet de société.",
    defaultCefr: "B1–B2",
    typicalSkills: "compare_information, identify_stance_and_perspective, identify_tone",
  },
  {
    code: "conversation_extract",
    modality: "listening",
    modalityLabel: "Compréhension orale",
    label: "Échange informel / professionnel",
    description: "Dialogue entre deux ou plusieurs locuteurs (amis, collègues, commerçant).",
    defaultCefr: "A2–B2",
    typicalSkills: "understand_context, infer_pragmatic_meaning, identify_tone",
  },
  {
    code: "phonological_recognition",
    modality: "listening",
    modalityLabel: "Compréhension orale",
    label: "Discrimination phonologique",
    description: "Différenciation de sonorités proches, liaisons ou intonations déclarative/interrogative.",
    defaultCefr: "A1–A2",
    typicalSkills: "phonological_control, register_and_formality",
  },
  {
    code: "message_association",
    modality: "listening",
    modalityLabel: "Compréhension orale",
    label: "Association message audio / situation",
    description: "Identification du lieu, de la relation entre interlocuteurs ou du but de l'appel.",
    defaultCefr: "A2–B1",
    typicalSkills: "identify_communicative_intention, understand_context",
  },

  // LEXIQUE & STRUCTURE (4)
  {
    code: "word_formation",
    modality: "lexique_structure",
    modalityLabel: "Lexique et structure",
    label: "Dérivation et morphologie",
    description: "Suffixes, préfixes, nominalisations et familles de mots.",
    defaultCefr: "B1–C1",
    typicalSkills: "word_formation, lexical_precision",
  },
  {
    code: "adjective_agreement",
    modality: "lexique_structure",
    modalityLabel: "Lexique et structure",
    label: "Accords adjectivaux et nominaux",
    description: "Accord en genre et en nombre dans des contextes complexes (adjectifs de couleur, composés).",
    defaultCefr: "A2–B2",
    typicalSkills: "grammatical_agreement, orthography",
  },
  {
    code: "pronoun_reference",
    modality: "lexique_structure",
    modalityLabel: "Lexique et structure",
    label: "Substitution pronominale (y, en, relatifs)",
    description: "Choix du pronom complément approprié ou du pronom relatif simple / composé.",
    defaultCefr: "B1–B2",
    typicalSkills: "pronoun_usage, relative_clauses, reference_resolution",
  },
  {
    code: "syntax_construction",
    modality: "lexique_structure",
    modalityLabel: "Lexique et structure",
    label: "Structure propositionnelle & subordonnées",
    description: "Subjonctif, concordance des temps, hypothèses, connecteurs et inversion du sujet.",
    defaultCefr: "B2–C2",
    typicalSkills: "mood_selection, conditional_structures, subordination_and_coordination",
  },

  // WRITING (2)
  {
    code: "fait_divers",
    modality: "writing",
    modalityLabel: "Expression écrite",
    label: "Fait divers — Section A",
    description: "Récit d'un événement insolite ou dramatique au passé (80 mots min.).",
    defaultCefr: "A2–B1",
    typicalSkills: "tense_selection, sentence_structure, textual_cohesion_and_coherence",
  },
  {
    code: "opinion_letter",
    modality: "writing",
    modalityLabel: "Expression écrite",
    label: "Lettre d'opinion / argumentation — Section B",
    description: "Prise de position argumentée et persuasive avec concessions et propositions (200 mots min.).",
    defaultCefr: "B2–C1",
    typicalSkills: "identify_claim, identify_supporting_reason, handle_counterargument, discourse_connectors",
  },

  // SPEAKING (2)
  {
    code: "information_gathering",
    modality: "speaking",
    modalityLabel: "Expression orale",
    label: "Collecte d'informations — Section A",
    description: "Appel téléphonique / échange pour poser 10 questions précises sur une annonce.",
    defaultCefr: "A2–B1",
    typicalSkills: "identify_communicative_intention, sentence_structure, register_and_formality",
  },
  {
    code: "persuasive_argumentation",
    modality: "speaking",
    modalityLabel: "Expression orale",
    label: "Argumentation persuasive — Section B",
    description: "Convaincre un ami ou un collègue d'adhérer à une activité ou un projet.",
    defaultCefr: "B2–C1",
    typicalSkills: "identify_claim, handle_counterargument, register_and_formality, phonological_control",
  },
];

const MISCONCEPTIONS_GUIDE = [
  {
    code: "surface_association",
    label: "Association de surface",
    desc: "Mot ou syntagme présent tel quel dans le document mais détourné de son contexte réel.",
  },
  {
    code: "negation_trap",
    label: "Piège de la négation",
    desc: "Inversion entre affirmation et négation (ex: « ne pas pouvoir » confondu avec « pouvoir »).",
  },
  {
    code: "overgeneralization",
    label: "Généralisation abusive",
    desc: "Extension indue d'un cas particulier à une règle générale (« toujours », « tous les cas »).",
  },
  {
    code: "literal_trap",
    label: "Piège de la littéralité",
    desc: "Interprétation au premier degré d'une métaphore, d'un idiotisme ou d'une hyperbole.",
  },
  {
    code: "opposite_meaning",
    label: "Antinomie / Contresens",
    desc: "Affirmation du contraire exact de ce qui est énoncé dans le document support.",
  },
  {
    code: "unsupported_inference",
    label: "Inférence non étayée",
    desc: "Proposition plausible dans le monde réel mais impossible à déduire du document.",
  },
  {
    code: "detail_confusion",
    label: "Confusion de détails",
    desc: "Mélange entre deux dates, deux pourcentages, deux lieux ou deux personnes citées.",
  },
  {
    code: "chronology_inversion",
    label: "Inversion chronologique",
    desc: "Inversion entre l'antériorité et la postériorité, ou entre la cause et l'effet.",
  },
  {
    code: "register_mismatch",
    label: "Incohérence de registre",
    desc: "Formulation inadaptée au contexte sociolinguistique ou formalité requise par la situation.",
  },
];

const REASONING_SKILLS = [
  { code: "locate_information", category: "Repérage", label: "Localiser une information explicite" },
  { code: "identify_specific_detail", category: "Repérage", label: "Identifier un détail précis" },
  { code: "identify_main_idea", category: "Compréhension", label: "Identifier l'idée principale" },
  { code: "understand_context", category: "Compréhension", label: "Comprendre le contexte" },
  { code: "understand_sequence", category: "Compréhension", label: "Comprendre la chronologie / séquence" },
  { code: "understand_cause_consequence", category: "Compréhension", label: "Comprendre la cause et la conséquence" },
  { code: "compare_information", category: "Intégration", label: "Comparer des informations" },
  { code: "synthesize_information", category: "Intégration", label: "Synthétiser des informations" },
  { code: "infer_implicit_information", category: "Inférence", label: "Inférer l'implicite" },
  { code: "infer_pragmatic_meaning", category: "Inférence", label: "Inférer le sens pragmatique" },
  { code: "identify_stance_and_perspective", category: "Discours", label: "Identifier la prise de position" },
  { code: "identify_tone", category: "Discours", label: "Identifier le ton / registre émotionnel" },
  { code: "identify_communicative_intention", category: "Discours", label: "Identifier l'intention communicative" },
  { code: "identify_claim", category: "Argumentation", label: "Identifier une thèse" },
  { code: "identify_supporting_reason", category: "Argumentation", label: "Identifier un argument" },
  { code: "handle_counterargument", category: "Argumentation", label: "Traiter une concession ou objection" },
  { code: "interpret_data_trends", category: "Données", label: "Interpréter des données et tendances" },
  { code: "correlate_data_and_text", category: "Données", label: "Croiser données et texte" },
];

const LANGUAGE_SKILLS = [
  { code: "vocabulary_in_context", category: "Lexique", label: "Vocabulaire en contexte" },
  { code: "paraphrase_and_synonym_recognition", category: "Lexique", label: "Synonymie et paraphrase" },
  { code: "collocations", category: "Lexique", label: "Collocations et expressions figées" },
  { code: "word_formation", category: "Lexique", label: "Formation des mots" },
  { code: "lexical_precision", category: "Lexique", label: "Précision lexicale" },
  { code: "register_and_formality", category: "Lexique", label: "Registre de langue" },
  { code: "grammatical_agreement", category: "Grammaire", label: "Accords grammaticaux" },
  { code: "articles_and_determiners", category: "Grammaire", label: "Articles et déterminants" },
  { code: "pronoun_usage", category: "Grammaire", label: "Pronoms" },
  { code: "preposition_usage", category: "Grammaire", label: "Prépositions" },
  { code: "negation_structures", category: "Grammaire", label: "Structures négatives" },
  { code: "verb_conjugation", category: "Système verbal", label: "Conjugaison" },
  { code: "tense_selection", category: "Système verbal", label: "Choix des temps" },
  { code: "mood_selection", category: "Système verbal", label: "Choix des modes (indicatif, subjonctif, conditionnel)" },
  { code: "sentence_structure", category: "Syntaxe", label: "Structure de la phrase" },
  { code: "relative_clauses", category: "Syntaxe", label: "Propositions relatives" },
  { code: "subordination_and_coordination", category: "Syntaxe", label: "Subordination et coordination" },
  { code: "conditional_structures", category: "Syntaxe", label: "Hypothèse et condition" },
  { code: "discourse_connectors", category: "Discours", label: "Connecteurs logiques et discursifs" },
  { code: "reference_resolution", category: "Discours", label: "Anaphores et reprises pronominales" },
  { code: "textual_cohesion_and_coherence", category: "Discours", label: "Cohésion et cohérence textuelle" },
  { code: "orthography", category: "Mécanique", label: "Orthographe" },
  { code: "punctuation", category: "Mécanique", label: "Ponctuation" },
  { code: "phonological_control", category: "Mécanique", label: "Maîtrise phonologique" },
];

export const QuestionSheetGuideModal: React.FC<QuestionSheetGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<GuideTab>("question_types");
  const [skillSearch, setSkillSearch] = useState("");
  const [taskTypeSearch, setTaskTypeSearch] = useState("");
  const [taskTypeModalityFilter, setTaskTypeModalityFilter] = useState<string>("all");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiedCode(code);
    setTimeout(() => {
      setCopiedCode((prev) => (prev === code ? null : prev));
    }, 1500);
  };

  const q = skillSearch.trim().toLowerCase();
  const filteredReasoning = REASONING_SKILLS.filter(
    (s) =>
      !q ||
      s.code.toLowerCase().includes(q) ||
      s.label.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q)
  );
  const filteredLanguage = LANGUAGE_SKILLS.filter(
    (s) =>
      !q ||
      s.code.toLowerCase().includes(q) ||
      s.label.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q)
  );

  const tq = taskTypeSearch.trim().toLowerCase();
  const filteredTaskTypes = TASK_TYPES_GUIDE.filter((tt) => {
    if (taskTypeModalityFilter !== "all" && tt.modality !== taskTypeModalityFilter) {
      return false;
    }
    if (!tq) return true;
    return (
      tt.code.toLowerCase().includes(tq) ||
      tt.label.toLowerCase().includes(tq) ||
      tt.description.toLowerCase().includes(tq) ||
      tt.typicalSkills.toLowerCase().includes(tq) ||
      tt.modalityLabel.toLowerCase().includes(tq)
    );
  });

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="question-sheet-guide-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
          <div>
            <h2
              id="question-sheet-guide-title"
              className="text-base font-bold text-foreground flex items-center gap-2"
            >
              <BookOpen className="h-5 w-5 text-primary" />
              Guide de référence — Remplissage de la feuille d'import (CSV / Excel)
            </h2>
            <p className="text-xs text-muted-foreground">
              Documentation complète des colonnes, formats de tâches (`task_type_code`), types de questions (`question_type`), valeurs ENUM et référentiel Taxonomy V1.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
            aria-label="Fermer le guide"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 px-5 pt-3 border-b border-border bg-muted/10 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("question_types")}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "question_types"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <HelpCircle className="h-3.5 w-3.5" />
            1. Types de questions (question_type)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("task_types")}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "task_types"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            2. Formats de tâches TEF (task_type_code)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("columns")}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "columns"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Table2 className="h-3.5 w-3.5" />
            3. Colonnes & Structure CSV
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("enums")}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "enums"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            4. Valeurs ENUMS & Pièges
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("skills")}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "skills"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Tag className="h-3.5 w-3.5" />
            5. Compétences Taxonomy V1 (skill_codes)
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* TAB 1: QUESTION TYPES */}
          {activeTab === "question_types" && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-2.5">
                <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="text-2xs text-muted-foreground leading-relaxed">
                  Le modèle CSV téléchargeable inclut <strong>un exemple prêt à l'emploi pour chacun des 9 types de questions</strong> ci-dessous. Cliquez sur un code pour le copier dans votre presse-papiers.
                </div>
              </div>

              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-muted/50 border-b border-border text-2xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-2.5">Code `question_type`</th>
                      <th className="p-2.5">Format & Usage</th>
                      <th className="p-2.5">Remplissage `option_a`..`option_d`</th>
                      <th className="p-2.5">Remplissage `correct_option`</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {QUESTION_TYPES_GUIDE.map((qt) => (
                      <tr key={qt.code} className="hover:bg-muted/20 align-top">
                        <td className="p-2.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleCopy(qt.code)}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 text-primary font-mono font-bold text-2xs hover:bg-primary/20 transition"
                            title="Cliquer pour copier"
                          >
                            {qt.code}
                            {copiedCode === qt.code ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Copy className="h-3 w-3 opacity-70" />
                            )}
                          </button>
                        </td>
                        <td className="p-2.5">
                          <div className="font-semibold text-foreground">{qt.label}</div>
                          <div className="text-2xs text-muted-foreground mt-0.5 italic">
                            Ex : « {qt.examplePrompt} »
                          </div>
                        </td>
                        <td className="p-2.5 text-2xs">
                          <div className="font-medium text-foreground">{qt.optionsRule}</div>
                          <div className="text-muted-foreground font-mono mt-0.5">{qt.exampleOptions}</div>
                        </td>
                        <td className="p-2.5 text-2xs">
                          <div className="font-medium text-foreground">{qt.correctRule}</div>
                          <div className="mt-0.5">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono font-bold">
                              {qt.exampleCorrect}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: TASK TYPES */}
          {activeTab === "task_types" && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-2.5">
                <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="text-2xs text-muted-foreground leading-relaxed">
                  Le champ <code className="font-mono text-primary font-bold">task_type_code</code> identifie l'un des <strong>24 formats d'épreuves canoniques du TEF</strong>. Renseigner ce code active le contrôle de conformité strict, restreint les compétences admissibles et calibre la complexité cognitive. Cliquez sur un code pour le copier.
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={taskTypeSearch}
                    onChange={(e) => setTaskTypeSearch(e.target.value)}
                    placeholder="Rechercher une tâche (ex: daily_document, fait_divers, article, annonce)..."
                    className="pl-8 h-8 text-xs"
                  />
                </div>
                <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                  {[
                    { id: "all", label: "Tous (24)" },
                    { id: "reading", label: "CE (10)" },
                    { id: "listening", label: "CO (6)" },
                    { id: "lexique_structure", label: "LS (4)" },
                    { id: "writing", label: "EE (2)" },
                    { id: "speaking", label: "EO (2)" },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setTaskTypeModalityFilter(filter.id)}
                      className={`px-2.5 py-1 rounded-md text-2xs font-semibold whitespace-nowrap transition ${
                        taskTypeModalityFilter === filter.id
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Task Types Table */}
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-muted/50 border-b border-border text-2xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-2.5">Code `task_type_code`</th>
                      <th className="p-2.5">Modalité & Niveau</th>
                      <th className="p-2.5">Intitulé & Description</th>
                      <th className="p-2.5">Compétences typiques</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredTaskTypes.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-muted-foreground text-xs">
                          Aucun format de tâche correspondant aux critères.
                        </td>
                      </tr>
                    ) : (
                      filteredTaskTypes.map((tt) => (
                        <tr key={tt.code} className="hover:bg-muted/20 align-top">
                          <td className="p-2.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleCopy(tt.code)}
                              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 text-primary font-mono font-bold text-2xs hover:bg-primary/20 transition"
                              title="Cliquer pour copier"
                            >
                              {tt.code}
                              {copiedCode === tt.code ? (
                                <Check className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <Copy className="h-3 w-3 opacity-70" />
                              )}
                            </button>
                          </td>
                          <td className="p-2.5 text-2xs whitespace-nowrap">
                            <span className="px-1.5 py-0.5 rounded font-medium bg-muted text-foreground">
                              {tt.modalityLabel}
                            </span>
                            <div className="text-muted-foreground font-mono mt-1">
                              {tt.defaultCefr}
                            </div>
                          </td>
                          <td className="p-2.5">
                            <div className="font-semibold text-foreground">{tt.label}</div>
                            <div className="text-2xs text-muted-foreground mt-0.5 leading-relaxed">
                              {tt.description}
                            </div>
                          </td>
                          <td className="p-2.5 text-2xs">
                            <div className="flex flex-wrap gap-1">
                              {tt.typicalSkills.split(",").map((s) => {
                                const trimmed = s.trim();
                                return (
                                  <button
                                    key={trimmed}
                                    type="button"
                                    onClick={() => handleCopy(trimmed)}
                                    className="font-mono text-2xs px-1.5 py-0.5 rounded bg-muted/80 text-muted-foreground hover:text-primary hover:bg-primary/10 transition"
                                    title="Cliquer pour copier ce code"
                                  >
                                    {trimmed}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: COLUMNS */}
          {activeTab === "columns" && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-muted/30 border border-border text-2xs text-muted-foreground space-y-1">
                <div className="font-semibold text-foreground">
                  Compatibilité Excel & CSV (UTF-8 / Windows-1252)
                </div>
                <p>
                  L'importateur détecte automatiquement le séparateur <strong>virgule (`,`)</strong>, <strong>point-virgule (`;`)</strong> (standard Excel FR) ou <strong>tabulation</strong>, ainsi que les encodages UTF-8 (avec ou sans BOM) et Windows-1252.
                </p>
              </div>

              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-muted/50 border-b border-border text-2xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-2.5">Colonne standard</th>
                      <th className="p-2.5">Alias acceptés</th>
                      <th className="p-2.5">Statut</th>
                      <th className="p-2.5">Valeur par défaut</th>
                      <th className="p-2.5">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {COLUMNS_GUIDE.map((col) => (
                      <tr key={col.name} className="hover:bg-muted/20">
                        <td className="p-2.5 font-mono font-bold text-primary whitespace-nowrap">
                          {col.name}
                        </td>
                        <td className="p-2.5 font-mono text-2xs text-muted-foreground">
                          {col.aliases}
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          {col.required ? (
                            <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                              Obligatoire
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-2xs font-medium bg-muted text-muted-foreground">
                              Optionnel
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-mono text-2xs text-foreground whitespace-nowrap">
                          {col.defaultVal}
                        </td>
                        <td className="p-2.5 text-2xs text-muted-foreground">
                          {col.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: ENUMS & PIÈGES */}
          {activeTab === "enums" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Modality */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-2.5">
                <h3 className="font-bold text-foreground flex items-center justify-between">
                  <span>1. Modalité (`modality`)</span>
                  <span className="text-2xs font-mono text-muted-foreground">Défaut : reading</span>
                </h3>
                <div className="divide-y divide-border/60 text-2xs">
                  {[
                    { code: "reading", label: "Compréhension écrite (CE)" },
                    { code: "listening", label: "Compréhension orale (CO) — utilise media_url" },
                    { code: "lexique_structure", label: "Lexique et structure (LS)" },
                    { code: "writing", label: "Expression écrite (EE)" },
                    { code: "speaking", label: "Expression orale (EO)" },
                  ].map((m) => (
                    <div key={m.code} className="py-1.5 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(m.code)}
                        className="font-mono font-bold text-primary hover:underline flex items-center gap-1"
                      >
                        {m.code}
                        {copiedCode === m.code ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-2.5 w-2.5 opacity-60" />}
                      </button>
                      <span className="text-muted-foreground text-right">{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CEFR Level & Difficulty Rating */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-2.5">
                <h3 className="font-bold text-foreground flex items-center justify-between">
                  <span>2. Niveau CECRL (`level`) & Difficulté (`1`–`5`)</span>
                  <span className="text-2xs font-mono text-muted-foreground">Défaut : B1 / 3</span>
                </h3>
                <div className="divide-y divide-border/60 text-2xs">
                  {[
                    { level: "A1", band: "110 – 190", desc: "Débutant (1=110, 2=130, 3=150, 4=170, 5=190)" },
                    { level: "A2", band: "210 – 290", desc: "Élémentaire (1=210 .. 5=290)" },
                    { level: "B1", band: "310 – 390", desc: "Seuil / Intermédiaire (1=310 .. 5=390)" },
                    { level: "B2", band: "410 – 490", desc: "Avancé / Indépendant (1=410 .. 5=490)" },
                    { level: "C1", band: "510 – 590", desc: "Autonome (1=510 .. 5=590)" },
                    { level: "C2", band: "610 – 690", desc: "Maîtrise (1=610 .. 5=690)" },
                  ].map((lv) => (
                    <div key={lv.level} className="py-1.5 flex items-center justify-between gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-muted font-mono font-bold text-foreground">
                        {lv.level}
                      </span>
                      <span className="font-mono text-primary font-semibold">{lv.band}</span>
                      <span className="text-muted-foreground text-right">{lv.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cognitive Complexity */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-2.5">
                <h3 className="font-bold text-foreground flex items-center justify-between">
                  <span>3. Complexité cognitive (`cognitive_complexity`)</span>
                  <span className="text-2xs font-mono text-muted-foreground">Optionnel</span>
                </h3>
                <div className="divide-y divide-border/60 text-2xs">
                  {[
                    {
                      code: "recall_recognition",
                      aliases: "recall, locate",
                      desc: "Repérage direct d'informations explicites",
                    },
                    {
                      code: "interpretation",
                      aliases: "understand, apply",
                      desc: "Compréhension et reformulation (défaut)",
                    },
                    {
                      code: "inferencing_synthesis",
                      aliases: "infer, analyze",
                      desc: "Inférence implicite et synthèse",
                    },
                    {
                      code: "critical_evaluation",
                      aliases: "evaluate, critical",
                      desc: "Évaluation critique du ton et de l'argumentation",
                    },
                  ].map((cc) => (
                    <div key={cc.code} className="py-1.5 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => handleCopy(cc.code)}
                          className="font-mono font-bold text-primary hover:underline flex items-center gap-1"
                        >
                          {cc.code}
                          {copiedCode === cc.code ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-2.5 w-2.5 opacity-60" />}
                        </button>
                        <span className="font-mono text-muted-foreground">Alias : {cc.aliases}</span>
                      </div>
                      <div className="text-muted-foreground">{cc.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Correct Option Format */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-2.5">
                <h3 className="font-bold text-foreground">
                  4. Formats acceptés pour `correct_option`
                </h3>
                <div className="divide-y divide-border/60 text-2xs">
                  <div className="py-1.5 flex items-center justify-between">
                    <span className="font-mono font-bold text-foreground">A, B, C, D</span>
                    <span className="text-muted-foreground">Lettre de la colonne (insensible à la casse)</span>
                  </div>
                  <div className="py-1.5 flex items-center justify-between">
                    <span className="font-mono font-bold text-foreground">1, 2, 3, 4</span>
                    <span className="text-muted-foreground">Indice numérique (1 = option_a, 2 = option_b...)</span>
                  </div>
                  <div className="py-1.5 flex items-center justify-between">
                    <span className="font-mono font-bold text-foreground">A,C ou A;C</span>
                    <span className="text-muted-foreground">Réponses multiples (pour `multiple_choice`, `short_text`, etc.)</span>
                  </div>
                  <div className="py-1.5 flex items-center justify-between">
                    <span className="font-mono font-bold text-foreground">Texte exact</span>
                    <span className="text-muted-foreground">Contenu exact de la bonne option ou réponse courte</span>
                  </div>
                </div>
              </div>

              {/* Misconceptions & Distractor Traps */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-2.5 md:col-span-2">
                <h3 className="font-bold text-foreground flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    5. Codes de Pièges cognitifs (`misconception_a..d`)
                  </span>
                  <span className="text-2xs font-mono text-muted-foreground">9 codes canoniques</span>
                </h3>
                <p className="text-2xs text-muted-foreground">
                  Utilisez ces codes pour qualifier le type de piège des distracteurs de vos QCM dans les colonnes optionnelles <code className="font-mono text-foreground bg-muted px-1 rounded">misconception_a</code> à <code className="font-mono text-foreground bg-muted px-1 rounded">misconception_d</code>.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-2xs pt-1">
                  {MISCONCEPTIONS_GUIDE.map((m) => (
                    <div key={m.code} className="p-2.5 rounded-lg border border-border/80 bg-muted/20 space-y-1">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => handleCopy(m.code)}
                          className="font-mono font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                          title="Cliquer pour copier"
                        >
                          {m.code}
                          {copiedCode === m.code ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-2.5 w-2.5 opacity-60" />}
                        </button>
                      </div>
                      <div className="font-medium text-foreground">{m.label}</div>
                      <div className="text-muted-foreground text-2xs leading-relaxed">{m.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SKILLS */}
          {activeTab === "skills" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={skillSearch}
                    onChange={(e) => setSkillSearch(e.target.value)}
                    placeholder="Rechercher un code de compétence (ex: identify_main_idea, grammaire, lexique)..."
                    className="pl-8 h-8 text-xs"
                  />
                </div>
                <div className="text-2xs text-muted-foreground">
                  Séparez plusieurs codes par une virgule : <code className="font-mono text-foreground bg-muted px-1.5 py-0.5 rounded">identify_main_idea,vocabulary_in_context</code>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Reasoning Dimension */}
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="bg-muted/50 px-3 py-2 border-b border-border font-bold text-foreground flex items-center justify-between">
                    <span>Compétences de Raisonnement (`reasoning`)</span>
                    <span className="text-2xs font-mono text-muted-foreground">{filteredReasoning.length} codes</span>
                  </div>
                  <div className="divide-y divide-border/60 max-h-[320px] overflow-y-auto">
                    {filteredReasoning.map((sk) => (
                      <div key={sk.code} className="p-2.5 hover:bg-muted/20 flex items-center justify-between gap-2">
                        <div>
                          <button
                            type="button"
                            onClick={() => handleCopy(sk.code)}
                            className="font-mono font-bold text-primary hover:underline flex items-center gap-1.5 text-2xs"
                            title="Cliquer pour copier"
                          >
                            {sk.code}
                            {copiedCode === sk.code ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Copy className="h-3 w-3 opacity-60" />
                            )}
                          </button>
                          <div className="text-2xs text-muted-foreground">{sk.label}</div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-muted text-2xs text-muted-foreground shrink-0">
                          {sk.category}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Language Dimension */}
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="bg-muted/50 px-3 py-2 border-b border-border font-bold text-foreground flex items-center justify-between">
                    <span>Compétences Linguistiques (`language`)</span>
                    <span className="text-2xs font-mono text-muted-foreground">{filteredLanguage.length} codes</span>
                  </div>
                  <div className="divide-y divide-border/60 max-h-[320px] overflow-y-auto">
                    {filteredLanguage.map((sk) => (
                      <div key={sk.code} className="p-2.5 hover:bg-muted/20 flex items-center justify-between gap-2">
                        <div>
                          <button
                            type="button"
                            onClick={() => handleCopy(sk.code)}
                            className="font-mono font-bold text-primary hover:underline flex items-center gap-1.5 text-2xs"
                            title="Cliquer pour copier"
                          >
                            {sk.code}
                            {copiedCode === sk.code ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Copy className="h-3 w-3 opacity-60" />
                            )}
                          </button>
                          <div className="text-2xs text-muted-foreground">{sk.label}</div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-muted text-2xs text-muted-foreground shrink-0">
                          {sk.category}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={downloadImportTemplateCsv}
            className="text-xs gap-1.5 h-8"
          >
            <Download className="h-3.5 w-3.5" />
            Télécharger le modèle CSV (avec exemples & formats de tâches)
          </Button>
          <Button size="sm" onClick={onClose} className="text-xs font-semibold h-8">
            Fermer le guide
          </Button>
        </div>
      </div>
    </div>
  );
};
