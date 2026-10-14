import React, { useEffect, useRef, useState } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  Loader2,
  ArrowRight,
  BookOpen,
  Code2,
  Trash2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Copy,
  CopyMinus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  bulkParseQuestionFile,
  aiAutoTagAndFormatQuestions,
  commitBulkQuestionImport,
  downloadImportTemplateCsv,
} from "../api";
import type { BulkImportQuestionItem } from "../types";
import { QuestionSheetGuideModal } from "./QuestionSheetGuideModal";
import {
  normalizePastedQuestionsJson,
  validateQuestionItemsClientSide,
} from "./jsonValidation";

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "preview" | "success">("upload");
  const [uploadMode, setUploadMode] = useState<"file" | "paste">("file");
  const [jsonText, setJsonText] = useState("");
  const [jsonSyntaxError, setJsonSyntaxError] = useState<string | null>(null);
  const [previewFilter, setPreviewFilter] = useState<"all" | "valid" | "duplicate" | "invalid">("all");
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());

  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [parsedItems, setParsedItems] = useState<BulkImportQuestionItem[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [targetStatus, setTargetStatus] = useState("draft");
  const [committedCount, setCommittedCount] = useState(0);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep("upload");
      setUploadMode("file");
      setJsonText("");
      setJsonSyntaxError(null);
      setPreviewFilter("all");
      setExpandedIndices(new Set());
      setIsDragging(false);
      setIsParsing(false);
      setIsEnriching(false);
      setIsCommitting(false);
      setParsedItems([]);
      setParseErrors([]);
      setTargetStatus("draft");
      setCommittedCount(0);
      setGlobalError(null);
      setIsGuideOpen(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = async (file: File) => {
    setIsParsing(true);
    setGlobalError(null);
    setParseErrors([]);
    try {
      const res = await bulkParseQuestionFile(file);
      setParsedItems(res.items || []);
      setParseErrors(res.parse_errors || []);
      if (res.items && res.items.length > 0) {
        setStep("preview");
      } else {
        const firstErr = res.parse_errors?.[0];
        setGlobalError(
          firstErr || "Aucune question valide n'a pu être extraite de ce fichier."
        );
      }
    } catch (err: any) {
      setGlobalError(err.message || "Erreur lors de la lecture du fichier.");
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFormatJson = () => {
    if (!jsonText.trim()) return;
    try {
      const parsed = JSON.parse(jsonText);
      setJsonText(JSON.stringify(parsed, null, 2));
      setJsonSyntaxError(null);
    } catch (err: any) {
      setJsonSyntaxError(`Erreur de syntaxe JSON : ${err.message}`);
    }
  };

  const handleLoadSampleJson = () => {
    const sample = [
      {
        stimulus_title: "Note d'information - Transports urbains",
        stimulus_text: "En raison de travaux de maintenance sur la ligne B du tramway, le trafic sera interrompu entre les stations Gare Centrale et Université du lundi 15 au vendredi 19 octobre. Des bus de substitution circuleront toutes les 10 minutes avec les mêmes titres de transport.",
        prompt: "Quel est l'impact principal des travaux annoncés ?",
        task_type_code: "daily_document",
        modality: "reading",
        level: "B1",
        difficulty: 2,
        cognitive_complexity: "recall_recognition",
        question_type: "single_choice",
        response_type: "single_choice",
        points: 1,
        explanation: "Le texte précise que le trafic sera interrompu sur une portion de la ligne et remplacé par des bus de substitution.",
        options: [
          { content: "Une hausse temporaire du tarif des billets", is_correct: false, order_index: 0 },
          { content: "La mise en place de bus de remplacement", is_correct: true, order_index: 1 },
          { content: "L'annulation définitive de la ligne B", is_correct: false, order_index: 2 },
          { content: "Une modification des horaires de la Gare Centrale", is_correct: false, order_index: 3 }
        ],
        skill_codes: ["identify_main_idea", "locate_information"]
      },
      {
        stimulus_title: "Conditions de souscription - Pass Culture",
        stimulus_text: "Le Pass Culture annuel s'adresse aux résidents de la métropole. Pour en bénéficier au tarif préférentiel de 15 euros par mois, le demandeur doit soit justifier du statut d'étudiant de moins de 28 ans, soit être demandeur d'emploi inscrit depuis plus de six mois.",
        prompt: "Quelles conditions permettent de bénéficier du tarif préférentiel ? (2 réponses attendues)",
        task_type_code: "administrative_document",
        modality: "reading",
        level: "B1",
        difficulty: 3,
        cognitive_complexity: "interpretation",
        question_type: "multiple_choice",
        response_type: "multiple_choice",
        points: 1,
        explanation: "Le texte stipule deux critères : étudiants de moins de 28 ans et demandeurs d'emploi inscrits depuis plus de six mois.",
        options: [
          { content: "Être étudiant âgé de moins de 28 ans", is_correct: true, order_index: 0 },
          { content: "Être propriétaire de son logement", is_correct: false, order_index: 1 },
          { content: "Être demandeur d'emploi depuis plus de six mois", is_correct: true, order_index: 2 },
          { content: "Résider depuis plus de 5 ans dans la commune", is_correct: false, order_index: 3 }
        ],
        skill_codes: ["identify_specific_detail", "locate_information"]
      },
      {
        stimulus_title: "Aménagement urbain : Les nouvelles pistes cyclables",
        stimulus_text: "La transition vers les mobilités douces s'accélère. [1], de nombreux usagers privilégient désormais le vélo. Cette évolution a été [2] par la multiplication des pistes sécurisées. Cependant, certains commerçants redoutent que la piétonnisation vienne [3] leur chiffre d'affaires. La mairie a mis en place des mesures afin de [4] leurs inquiétudes.",
        prompt: "Complétez le texte en choisissant l'option appropriée pour chaque trou numéroté.",
        task_type_code: "text_gap",
        modality: "reading",
        level: "B2",
        difficulty: 3,
        cognitive_complexity: "inferencing_synthesis",
        question_type: "text_input",
        response_type: "gap_fill",
        points: 1,
        explanation: "Ce texte à trous évalue la cohésion textuelle et la précision lexicale : [1] En effet (illustration), [2] facilitée (accord logique), [3] affecter (risque), [4] dissiper (collocation avec inquiétudes).",
        gaps: [
          {
            gap_id: "1",
            order_index: 0,
            cue_text: "Connecteur logique d'illustration",
            options: [
              { content: "En effet", is_correct: true, order_index: 0, explanation: "Illustre l'accélération annoncée." },
              { content: "Néanmoins", is_correct: false, order_index: 1, misconception_type: "contradiction", distractor_rationale: "Marque une opposition non voulue." },
              { content: "Par conséquent", is_correct: false, order_index: 2, misconception_type: "false_friend", distractor_rationale: "Exprime une conséquence." },
              { content: "Bien que", is_correct: false, order_index: 3, misconception_type: "morphosyntax", distractor_rationale: "Exige le subjonctif." }
            ]
          },
          {
            gap_id: "2",
            order_index: 1,
            cue_text: "Participe passé / cause favorable",
            options: [
              { content: "facilitée", is_correct: true, order_index: 0, explanation: "Sens positif cohérent avec l'aménagement." },
              { content: "retardée", is_correct: false, order_index: 1, misconception_type: "contradiction", distractor_rationale: "Contredit l'accélération." },
              { content: "contestée", is_correct: false, order_index: 2, misconception_type: "literal_interpretation", distractor_rationale: "Incohérent avec le contexte favorable." },
              { content: "négligée", is_correct: false, order_index: 3, misconception_type: "contradiction", distractor_rationale: "Sens opposé." }
            ]
          },
          {
            gap_id: "3",
            order_index: 2,
            cue_text: "Verbe infinitif de risque",
            options: [
              { content: "affecter", is_correct: true, order_index: 0, explanation: "Crainte d'un impact négatif." },
              { content: "stimuler", is_correct: false, order_index: 1, misconception_type: "contradiction", distractor_rationale: "Un commerçant ne redoute pas une stimulation." },
              { content: "maintenir", is_correct: false, order_index: 2, misconception_type: "false_friend", distractor_rationale: "Sens neutre incompatible avec 'redouter'." },
              { content: "ignorer", is_correct: false, order_index: 3, misconception_type: "literal_interpretation", distractor_rationale: "Incompatible avec chiffre d'affaires." }
            ]
          },
          {
            gap_id: "4",
            order_index: 3,
            cue_text: "Collocation avec inquiétudes",
            options: [
              { content: "dissiper", is_correct: true, order_index: 0, explanation: "Collocation 'dissiper les inquiétudes'." },
              { content: "accentuer", is_correct: false, order_index: 1, misconception_type: "contradiction", distractor_rationale: "Les mesures cherchent à apaiser." },
              { content: "prolonger", is_correct: false, order_index: 2, misconception_type: "contradiction", distractor_rationale: "Sens opposé." },
              { content: "aggraver", is_correct: false, order_index: 3, misconception_type: "contradiction", distractor_rationale: "Opposé à l'accompagnement municipal." }
            ]
          }
        ],
        skill_codes: ["discourse_connectors", "vocabulary_in_context"]
      },
      {
        stimulus_title: "Appariement d'offres de stages",
        stimulus_text: "Offre 1 : Stage communication digitale et réseaux sociaux.\nOffre 2 : Stage comptabilité et gestion des paies.\nOffre 3 : Stage relations internationales et traduction.",
        prompt: "Associez chaque offre au profil de candidat correspondant.",
        task_type_code: "document_matching",
        modality: "reading",
        level: "B1",
        difficulty: 2,
        cognitive_complexity: "interpretation",
        question_type: "multiple_choice",
        response_type: "matching",
        points: 1,
        explanation: "Chaque offre est appariée aux compétences académiques requises du candidat.",
        options: [
          { content: "Offre 1 -> Étudiant en journalisme et multimédia", is_correct: true, order_index: 0 },
          { content: "Offre 2 -> Étudiant en gestion et finances", is_correct: true, order_index: 1 },
          { content: "Offre 3 -> Étudiant trilingue en langues étrangères appliquées", is_correct: true, order_index: 2 }
        ],
        skill_codes: ["compare_information", "locate_information"]
      },
      {
        stimulus_title: "Procédure d'examen",
        stimulus_text: "Instructions officielles pour le déroulement de la session d'évaluation.",
        prompt: "Remettez dans l'ordre chronologique les étapes de la journée d'examen.",
        task_type_code: "text_ordering",
        modality: "reading",
        level: "B1",
        difficulty: 3,
        cognitive_complexity: "interpretation",
        question_type: "multiple_choice",
        response_type: "ordering",
        points: 1,
        explanation: "La chronologie impose l'émargement, l'installation, les consignes puis la remise des copies.",
        options: [
          { content: "Émarger la feuille de présence et présenter sa pièce d'identité", is_correct: true, order_index: 0 },
          { content: "Prendre place à la table désignée par les surveillants", is_correct: true, order_index: 1 },
          { content: "Écouter attentivement les consignes de passation", is_correct: true, order_index: 2 },
          { content: "Remettre son livret et signer le registre de fin d'épreuve", is_correct: true, order_index: 3 }
        ],
        skill_codes: ["understand_sequence", "discourse_connectors"]
      }
    ];
    setJsonText(JSON.stringify(sample, null, 2));
    setJsonSyntaxError(null);
  };

  const handleParsePastedJson = () => {
    setJsonSyntaxError(null);
    setGlobalError(null);
    if (!jsonText.trim()) {
      setJsonSyntaxError("Veuillez coller un contenu JSON avant de lancer l'analyse.");
      return;
    }

    const { items, error } = normalizePastedQuestionsJson(jsonText);
    if (error) {
      setJsonSyntaxError(error);
      return;
    }

    if (!items || items.length === 0) {
      setJsonSyntaxError("Aucune question valide n'a pu être extraite du JSON collé.");
      return;
    }

    // Run client-side pre-flight check to detect multi-gap and structural errors early
    const clientValidation = validateQuestionItemsClientSide(items);
    if (!clientValidation.is_valid && clientValidation.errors.length > 0) {
      setJsonSyntaxError(clientValidation.errors[0].message);
      return;
    }

    const normalizedContent = JSON.stringify({ items }, null, 2);
    const file = new File([new Blob([normalizedContent], { type: "application/json" })], "pasted_questions.json", {
      type: "application/json",
    });
    handleFileUpload(file);
  };

  const handleDeleteItem = (indexToDelete: number) => {
    setParsedItems((prev) => prev.filter((_, idx) => idx !== indexToDelete));
  };

  const toggleExpandRow = (idx: number) => {
    setExpandedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const handleRemoveAllInvalid = () => {
    setParsedItems((prev) => prev.filter((item) => item.is_valid));
  };

  const handleRemoveAllDuplicates = () => {
    setParsedItems((prev) => prev.filter((item) => !item.is_duplicate));
    if (previewFilter === "duplicate") {
      setPreviewFilter("all");
    }
  };

  const handleRunAiEnrichment = async () => {
    if (parsedItems.length === 0) return;
    setIsEnriching(true);
    setGlobalError(null);
    try {
      const res = await aiAutoTagAndFormatQuestions(parsedItems, true, true);
      setParsedItems(res.items);
    } catch (err: any) {
      setGlobalError(err.message || "Échec de l'enrichissement par IA.");
    } finally {
      setIsEnriching(false);
    }
  };

  const handleCommit = async () => {
    const validItems = parsedItems.filter((item) => item.is_valid);
    if (validItems.length === 0) {
      setGlobalError("Aucune question valide prête pour l'import.");
      return;
    }
    setIsCommitting(true);
    setGlobalError(null);
    try {
      const res = await commitBulkQuestionImport(validItems, targetStatus);
      if (res.created_count === 0 && res.errors?.length > 0) {
        setGlobalError(
          `Échec de l'importation (${res.errors.length} erreur(s)) : ${res.errors[0].error || "erreur de validation"}`
        );
        return;
      }
      setCommittedCount(res.created_count);
      setStep("success");
      onSuccess(res.created_count);
    } catch (err: any) {
      setGlobalError(err.message || "Échec de l'importation en base de données.");
    } finally {
      setIsCommitting(false);
    }
  };

  const downloadJsonTemplate = () => {
    const sample = [
      {
        prompt: "Quel est l'objectif principal de ce message ?",
        question_type: "single_choice",
        modality: "reading",
        level: "B1",
        difficulty: 2,
        options: [
          { content: "Informer d'un retard", is_correct: true },
          { content: "Annuler une réunion", is_correct: false },
          { content: "Féliciter un collègue", is_correct: false },
          { content: "Modifier un contrat", is_correct: false },
        ],
        stimulus_title: "Note de service",
        stimulus_text: "En raison d'un problème technique, le train aura 20 minutes de retard.",
        skill_codes: ["identify_main_idea"],
      },
      {
        prompt: "Quelles conditions permettent d'obtenir le tarif réduit ?",
        question_type: "multiple_choice",
        modality: "reading",
        level: "B2",
        difficulty: 3,
        options: [
          { content: "Avoir moins de 26 ans", is_correct: true },
          { content: "Habiter hors de l'UE", is_correct: false },
          { content: "Présenter un justificatif étudiant", is_correct: true },
          { content: "Réserver 30 jours à l'avance", is_correct: false },
        ],
        stimulus_title: "Conditions tarifaires",
        stimulus_text: "Le tarif réduit est accordé aux moins de 26 ans et aux étudiants sur justificatif.",
        skill_codes: ["identify_specific_detail", "locate_information"],
      },
      {
        prompt: "Complétez : « Bien qu'il ___ très tard, le directeur a relu le rapport. »",
        question_type: "gap_fill",
        modality: "lexique_structure",
        level: "B2",
        difficulty: 3,
        options: [
          { content: "soit", is_correct: true },
          { content: "est", is_correct: false },
          { content: "sera", is_correct: false },
          { content: "était", is_correct: false },
        ],
        stimulus_title: "Exercice de grammaire",
        stimulus_text: "Emploi du subjonctif après « bien que ».",
        skill_codes: ["mood_selection", "subordination_and_coordination"],
      },
      {
        stimulus_title: "Aménagement urbain : Les nouvelles pistes cyclables",
        stimulus_text: "La transition vers les mobilités douces s'accélère. [1], de nombreux usagers privilégient désormais le vélo. Cette évolution a été [2] par la multiplication des pistes sécurisées. Cependant, certains commerçants redoutent que la piétonnisation vienne [3] leur chiffre d'affaires. La mairie a mis en place des mesures afin de [4] leurs inquiétudes.",
        prompt: "Complétez le texte en choisissant l'option appropriée pour chaque trou numéroté.",
        task_type_code: "text_gap",
        modality: "reading",
        level: "B2",
        difficulty: 3,
        cognitive_complexity: "inferencing_synthesis",
        question_type: "text_input",
        response_type: "gap_fill",
        points: 1,
        explanation: "Ce texte à trous évalue la cohésion textuelle et la précision lexicale : [1] En effet, [2] facilitée, [3] affecter, [4] dissiper.",
        gaps: [
          {
            gap_id: "1",
            order_index: 0,
            cue_text: "Connecteur logique d'illustration",
            options: [
              { content: "En effet", is_correct: true, order_index: 0, explanation: "Preuve factuelle." },
              { content: "Néanmoins", is_correct: false, order_index: 1, misconception_type: "contradiction", distractor_rationale: "Opposition illogique." },
              { content: "Par conséquent", is_correct: false, order_index: 2, misconception_type: "false_friend", distractor_rationale: "Exprime une conséquence." },
              { content: "Bien que", is_correct: false, order_index: 3, misconception_type: "morphosyntax", distractor_rationale: "Exige le subjonctif." }
            ]
          },
          {
            gap_id: "2",
            order_index: 1,
            cue_text: "Participe passé / cause favorable",
            options: [
              { content: "facilitée", is_correct: true, order_index: 0, explanation: "Accord cohérent." },
              { content: "retardée", is_correct: false, order_index: 1, misconception_type: "contradiction", distractor_rationale: "Contredit l'accélération." },
              { content: "contestée", is_correct: false, order_index: 2, misconception_type: "literal_interpretation", distractor_rationale: "Incohérent." },
              { content: "négligée", is_correct: false, order_index: 3, misconception_type: "contradiction", distractor_rationale: "Sens opposé." }
            ]
          },
          {
            gap_id: "3",
            order_index: 2,
            cue_text: "Verbe infinitif de risque",
            options: [
              { content: "affecter", is_correct: true, order_index: 0, explanation: "Crainte d'un impact négatif." },
              { content: "stimuler", is_correct: false, order_index: 1, misconception_type: "contradiction", distractor_rationale: "Un commerçant ne craint pas la stimulation." },
              { content: "maintenir", is_correct: false, order_index: 2, misconception_type: "false_friend", distractor_rationale: "Sens neutre." },
              { content: "ignorer", is_correct: false, order_index: 3, misconception_type: "literal_interpretation", distractor_rationale: "Incompatible sémantiquement." }
            ]
          },
          {
            gap_id: "4",
            order_index: 3,
            cue_text: "Collocation avec inquiétudes",
            options: [
              { content: "dissiper", is_correct: true, order_index: 0, explanation: "Collocation consacrée." },
              { content: "accentuer", is_correct: false, order_index: 1, misconception_type: "contradiction", distractor_rationale: "Opposé à l'apaisement." },
              { content: "prolonger", is_correct: false, order_index: 2, misconception_type: "contradiction", distractor_rationale: "Sens opposé." },
              { content: "aggraver", is_correct: false, order_index: 3, misconception_type: "contradiction", distractor_rationale: "Opposé à l'accompagnement." }
            ]
          }
        ],
        skill_codes: ["discourse_connectors", "vocabulary_in_context"]
      },
      {
        prompt: "Quel mot du texte est synonyme de « amélioration » ?",
        question_type: "short_text",
        modality: "reading",
        level: "B2",
        difficulty: 3,
        options: [
          { content: "modernisation", is_correct: true },
          { content: "perfectionnement", is_correct: true },
        ],
        stimulus_title: "Modernisation du réseau",
        stimulus_text: "Le plan quinquennal prévoit une modernisation progressive des infrastructures.",
        skill_codes: ["paraphrase_and_synonym_recognition", "vocabulary_in_context"],
      },
      {
        prompt: "Associez chaque annonce au profil de lecteur correspondant.",
        question_type: "matching",
        modality: "reading",
        level: "B1",
        difficulty: 2,
        options: [
          { content: "Annonce 1 -> Jeune diplômé cherchant un stage", is_correct: true },
          { content: "Annonce 2 -> Famille recherchant un appartement", is_correct: true },
        ],
        stimulus_title: "Petites annonces",
        stimulus_text: "1. Cabinet recrute stagiaire. 2. Loue T4 proche écoles.",
        skill_codes: ["compare_information", "locate_information"],
      },
      {
        prompt: "Remettez dans l'ordre chronologique les étapes de la procédure d'inscription.",
        question_type: "ordering",
        modality: "reading",
        level: "B1",
        difficulty: 3,
        options: [
          { content: "Créer un compte en ligne", is_correct: true },
          { content: "Téléverser les pièces justificatives", is_correct: true },
          { content: "Valider le paiement", is_correct: true },
          { content: "Télécharger la convocation", is_correct: true },
        ],
        stimulus_title: "Guide d'inscription",
        stimulus_text: "Commencez par créer votre compte, déposez vos pièces, payez puis téléchargez la convocation.",
        skill_codes: ["understand_sequence", "discourse_connectors"],
      },
      {
        prompt: "Rédigez une lettre argumentée au maire (180 mots min.) sur l'aménagement de pistes cyclables.",
        question_type: "long_text",
        modality: "writing",
        level: "B2",
        difficulty: 4,
        options: [],
        stimulus_title: "Section B — Lettre ouverte",
        stimulus_text: "Faut-il limiter la place des voitures en centre-ville ?",
        skill_codes: ["identify_claim", "discourse_connectors", "register_and_formality"],
      },
      {
        prompt: "Présentez les avantages et les inconvénients du télétravail (2 à 3 minutes).",
        question_type: "spoken_response",
        modality: "speaking",
        level: "B2",
        difficulty: 3,
        options: [],
        stimulus_title: "Exposé oral",
        stimulus_text: "Le télétravail s'est largement généralisé dans les entreprises de services.",
        skill_codes: ["identify_supporting_reason", "discourse_connectors", "phonological_control"],
      },
      {
        prompt: "Appelez l'organisateur du séjour linguistique à Montréal pour poser une dizaine de questions.",
        question_type: "interaction",
        modality: "speaking",
        level: "B1",
        difficulty: 2,
        options: [],
        stimulus_title: "Section A — Prise d'informations",
        stimulus_text: "Séjour intensif de français à Montréal : cours le matin, activités l'après-midi.",
        skill_codes: ["identify_communicative_intention", "register_and_formality", "sentence_structure"],
      },
    ];
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tef_question_import_sample.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const validCount = parsedItems.filter((i) => i.is_valid).length;
  const invalidCount = parsedItems.length - validCount;
  const duplicateCount = parsedItems.filter((i) => i.is_duplicate).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Importation de questions en masse
            </h2>
            <p className="text-xs text-muted-foreground">
              Intégrez rapidement vos séries d'items via CSV, Excel ou JSON avec auto-tagging et formatage IA.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsGuideOpen(true)}
              className="text-xs gap-1.5 h-8"
            >
              <BookOpen className="h-3.5 w-3.5 text-primary" />
              Guide de remplissage
            </Button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {globalError && (
          <div className="p-3 mx-4 mt-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl text-xs flex items-center gap-2">
            <XCircle className="h-4 w-4 shrink-0" />
            <span>{globalError}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === "upload" && (
            <div className="space-y-5">
              {/* Mode Switcher Tabs */}
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <button
                  type="button"
                  onClick={() => {
                    setUploadMode("file");
                    setJsonSyntaxError(null);
                  }}
                  className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                    uploadMode === "file"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <UploadCloud className="h-4 w-4" />
                  Téléverser un fichier (CSV, Excel, JSON)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUploadMode("paste");
                    setGlobalError(null);
                  }}
                  className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                    uploadMode === "paste"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Code2 className="h-4 w-4" />
                  Coller du code JSON
                </button>
              </div>

              {uploadMode === "file" ? (
                /* Dropzone */
                <div
                  onClick={() => !isParsing && fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!isParsing) setIsDragging(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(false);
                    const droppedFile = e.dataTransfer.files?.[0];
                    if (droppedFile && !isParsing) {
                      handleFileUpload(droppedFile);
                    }
                  }}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                    isDragging
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary bg-card/60 hover:bg-primary/5"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls,.json"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                    className="hidden"
                    disabled={isParsing}
                  />
                  {isParsing ? (
                    <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <span>Analyse du fichier et validation des schémas...</span>
                    </div>
                  ) : (
                    <>
                      <div className="p-3.5 rounded-full bg-primary/10 text-primary">
                        <UploadCloud className="h-8 w-8" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground">
                          Glissez-déposez votre fichier ici, ou <span className="text-primary underline">parcourir</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Formats pris en charge : <strong>CSV</strong>, <strong>Excel (.xlsx)</strong>, <strong>JSON</strong>
                        </p>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* JSON Paste Editor */
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="json-paste-area" className="font-semibold text-foreground flex items-center gap-1.5">
                      <Code2 className="h-4 w-4 text-primary" />
                      Collez le code JSON généré (ex: Gemini Web, Google AI Studio) :
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleFormatJson}
                        disabled={!jsonText.trim() || isParsing}
                        className="text-2xs text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50"
                      >
                        Formater le JSON
                      </button>
                      <span className="text-muted-foreground/40">•</span>
                      <button
                        type="button"
                        onClick={handleLoadSampleJson}
                        disabled={isParsing}
                        className="text-2xs text-primary hover:underline font-semibold disabled:opacity-50"
                      >
                        Charger un exemple
                      </button>
                      {jsonText.trim() && (
                        <>
                          <span className="text-muted-foreground/40">•</span>
                          <button
                            type="button"
                            onClick={() => {
                              setJsonText("");
                              setJsonSyntaxError(null);
                            }}
                            className="text-2xs text-rose-500 hover:underline"
                          >
                            Effacer
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="relative">
                    <textarea
                      id="json-paste-area"
                      value={jsonText}
                      onChange={(e) => {
                        setJsonText(e.target.value);
                        if (jsonSyntaxError) setJsonSyntaxError(null);
                      }}
                      placeholder={`[\n  {\n    "stimulus_title": "Note d'information",\n    "stimulus_text": "Texte du document...",\n    "prompt": "Quel est l'objet de cette note ?",\n    "task_type_code": "daily_document",\n    "modality": "reading",\n    "level": "B1",\n    "difficulty": 2,\n    "options": [\n      { "content": "Option 1", "is_correct": true },\n      { "content": "Option 2", "is_correct": false }\n    ],\n    "skill_codes": ["identify_main_idea"]\n  }\n]`}
                      rows={12}
                      className={`w-full font-mono text-xs p-3.5 rounded-xl border bg-card/90 text-foreground transition focus:outline-hidden focus:ring-2 resize-y ${
                        jsonSyntaxError
                          ? "border-rose-500/50 focus:ring-rose-500/20"
                          : "border-border focus:ring-primary/20"
                      }`}
                      disabled={isParsing}
                      spellCheck={false}
                    />
                  </div>

                  {jsonSyntaxError && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl text-xs flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{jsonSyntaxError}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-2xs text-muted-foreground">
                      {jsonText.length > 0
                        ? `${jsonText.length} caractères`
                        : "Accepte un tableau direct [...] ou enveloppe { \"items\": [...] } / { \"questions\": [...] }"}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleParsePastedJson}
                      disabled={isParsing || !jsonText.trim()}
                      className="gap-2 font-semibold"
                    >
                      {isParsing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )}
                      Analyser et Prévisualiser
                    </Button>
                  </div>
                </div>
              )}

              {/* Download templates & Reference Guide */}
              <div className="p-4 rounded-xl border border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-foreground">
                    Besoin d'un modèle d'import ou de la liste des valeurs ENUMS ?
                  </div>
                  <div className="text-2xs text-muted-foreground">
                    Nos gabarits incluent un exemple pour chaque type de question (`single_choice`, `multiple_choice`, `gap_fill`, `short_text`, `matching`, `ordering`, `long_text`, `spoken_response`, `interaction`).
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsGuideOpen(true)}
                    className="text-xs gap-1.5 h-8 border-primary/30 text-primary hover:bg-primary/5 font-semibold"
                  >
                    <BookOpen className="h-3.5 w-3.5" /> Guide & Enums
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadImportTemplateCsv}
                    className="text-xs gap-1.5 h-8"
                  >
                    <Download className="h-3.5 w-3.5" /> Modèle CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadJsonTemplate}
                    className="text-xs gap-1.5 h-8"
                  >
                    <Download className="h-3.5 w-3.5" /> Modèle JSON
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              {/* Stats & AI Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl border border-border bg-muted/20">
                <div className="flex items-center gap-3 text-xs flex-wrap">
                  <span className="font-semibold text-foreground">
                    {parsedItems.length} question{parsedItems.length > 1 ? "s" : ""}
                  </span>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-background">
                    <button
                      type="button"
                      onClick={() => setPreviewFilter("all")}
                      className={`px-2 py-0.5 rounded text-2xs font-semibold transition ${
                        previewFilter === "all"
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Toutes ({parsedItems.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFilter("valid")}
                      className={`px-2 py-0.5 rounded text-2xs font-semibold transition ${
                        previewFilter === "valid"
                          ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Valides ({validCount})
                    </button>
                    {duplicateCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setPreviewFilter("duplicate")}
                        className={`px-2 py-0.5 rounded text-2xs font-semibold transition ${
                          previewFilter === "duplicate"
                            ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Doublons ({duplicateCount})
                      </button>
                    )}
                    {invalidCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setPreviewFilter("invalid")}
                        className={`px-2 py-0.5 rounded text-2xs font-semibold transition ${
                          previewFilter === "invalid"
                            ? "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Invalides ({invalidCount})
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRunAiEnrichment}
                    disabled={isEnriching || isCommitting}
                    className="gap-1.5 text-xs text-purple-600 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/20 font-semibold"
                  >
                    {isEnriching ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Auto-tagger & Formater par IA
                  </Button>
                </div>
              </div>

              {duplicateCount > 0 && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Copy className="h-4 w-4 shrink-0 text-amber-600" />
                    <span>
                      <strong>{duplicateCount}</strong> question{duplicateCount > 1 ? "s sont identifiées comme des doublons" : " est identifiée comme un doublon"} (énoncés identiques ou déjà présents).
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveAllDuplicates}
                    className="text-2xs h-7 text-amber-600 border-amber-200 dark:border-amber-900 hover:bg-amber-50 dark:hover:bg-amber-950/20 shrink-0 gap-1.5 font-semibold"
                  >
                    <CopyMinus className="h-3 w-3" />
                    Supprimer les doublons ({duplicateCount})
                  </Button>
                </div>
              )}

              {invalidCount > 0 && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span>
                      <strong>{invalidCount}</strong> question{invalidCount > 1 ? "s comportent" : " comporte"} des erreurs. Seules les <strong>{validCount}</strong> question{validCount > 1 ? "s" : ""} valide{validCount > 1 ? "s" : ""} seront créées en base.
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveAllInvalid}
                    className="text-2xs h-7 text-rose-600 border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/20 shrink-0 gap-1.5 font-semibold"
                  >
                    <Trash2 className="h-3 w-3" />
                    Retirer tous les invalides
                  </Button>
                </div>
              )}

              {parseErrors.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                  <span className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" /> Avertissements de lecture :
                  </span>
                  <ul className="list-disc list-inside space-y-0.5 text-2xs">
                    {parseErrors.slice(0, 3).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {parseErrors.length > 3 && (
                      <li>... et {parseErrors.length - 3} autres remarques.</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Preview Table */}
              <div className="rounded-xl border border-border overflow-hidden bg-card text-xs">
                <div className="max-h-[360px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-muted/50 border-b border-border text-2xs text-muted-foreground uppercase sticky top-0">
                      <tr>
                        <th className="p-2.5">#</th>
                        <th className="p-2.5">Énoncé</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Modalité</th>
                        <th className="p-2.5">Niveau</th>
                        <th className="p-2.5">Diff.</th>
                        <th className="p-2.5">Document support</th>
                        <th className="p-2.5">Options</th>
                        <th className="p-2.5">État</th>
                        <th className="p-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {parsedItems
                        .map((item, originalIndex) => ({ item, originalIndex }))
                        .filter(({ item }) => {
                          if (previewFilter === "valid") return item.is_valid && !item.is_duplicate;
                          if (previewFilter === "duplicate") return item.is_duplicate;
                          if (previewFilter === "invalid") return !item.is_valid;
                          return true;
                        })
                        .map(({ item, originalIndex }) => (
                          <React.Fragment key={originalIndex}>
                            <tr className={`transition ${item.is_duplicate ? "bg-amber-500/5 hover:bg-amber-500/10" : "hover:bg-muted/30"}`}>
                              <td className="p-2.5 text-2xs font-mono text-muted-foreground">
                                <button
                                  type="button"
                                  onClick={() => toggleExpandRow(originalIndex)}
                                  className="inline-flex items-center gap-1 hover:text-foreground transition p-0.5 rounded hover:bg-muted/60 cursor-pointer"
                                  title={expandedIndices.has(originalIndex) ? "Replier les détails" : "Déplier les détails"}
                                >
                                  {expandedIndices.has(originalIndex) ? (
                                    <ChevronDown className="h-3 w-3 text-primary" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                  )}
                                  <span>{originalIndex + 1}</span>
                                </button>
                              </td>
                              <td className="p-2.5 font-medium text-foreground max-w-xs truncate" title={item.prompt}>
                                <div className="flex items-center gap-1.5 truncate">
                                  {item.is_duplicate && (
                                    <span
                                      className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-3xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 shrink-0"
                                      title={item.duplicate_reason || "Doublon identifié"}
                                    >
                                      <Copy className="h-2.5 w-2.5" /> Doublon
                                    </span>
                                  )}
                                  <span className="truncate">
                                    {item.prompt || <span className="text-rose-500 italic">Énoncé manquant</span>}
                                  </span>
                                </div>
                              </td>
                              <td className="p-2.5 font-mono text-2xs text-primary">
                                {item.task_type_code || item.response_type || item.question_type}
                              </td>
                              <td className="p-2.5 capitalize text-2xs text-muted-foreground">
                                {item.modality}
                              </td>
                              <td className="p-2.5">
                                <span className="px-1.5 py-0.5 rounded bg-muted font-mono font-bold text-2xs">
                                  {item.target_cefr || item.level}
                                </span>
                              </td>
                              <td className="p-2.5 text-2xs text-muted-foreground">
                                {item.difficulty}/5
                              </td>
                              <td className="p-2.5 text-2xs text-muted-foreground max-w-[120px] truncate" title={item.stimulus_title || item.stimulus_text || ""}>
                                {item.stimulus_title || (item.stimulus_text ? "Document inclus" : "—")}
                              </td>
                              <td className="p-2.5 text-2xs">
                                {item.gaps && item.gaps.length > 0 ? (
                                  <span className="font-semibold text-primary" title={`${item.gaps.length} trous numérotés`}>
                                    <span className="font-mono">{item.gaps.length}</span> trou{item.gaps.length > 1 ? "s" : ""} ({item.options?.length || 0} choix)
                                  </span>
                                ) : (
                                  <span>
                                    <span className="font-mono">{item.options?.length || 0}</span> choix
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5">
                                {item.is_duplicate ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleExpandRow(originalIndex)}
                                    className="flex items-center gap-1 text-2xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                                    title={item.duplicate_reason || "Identifié comme doublon"}
                                  >
                                    <Copy className="h-3 w-3" /> Doublon
                                    {expandedIndices.has(originalIndex) ? (
                                      <ChevronDown className="h-2.5 w-2.5" />
                                    ) : (
                                      <ChevronRight className="h-2.5 w-2.5 opacity-60" />
                                    )}
                                  </button>
                                ) : item.is_valid ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleExpandRow(originalIndex)}
                                    className="flex items-center gap-1 text-2xs font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                                    title="Cliquer pour inspecter les détails"
                                  >
                                    <CheckCircle2 className="h-3 w-3" /> Valide
                                    {expandedIndices.has(originalIndex) ? (
                                      <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />
                                    ) : (
                                      <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/60" />
                                    )}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => toggleExpandRow(originalIndex)}
                                    className="flex items-center gap-1 text-2xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-500/10 hover:bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-500/20 cursor-pointer"
                                    title="Cliquer pour afficher le détail des erreurs"
                                  >
                                    <XCircle className="h-3 w-3" />
                                    <span>{item.validation_errors?.length || 1} erreur(s)</span>
                                    {expandedIndices.has(originalIndex) ? (
                                      <ChevronDown className="h-3 w-3" />
                                    ) : (
                                      <ChevronRight className="h-3 w-3" />
                                    )}
                                  </button>
                                )}
                              </td>
                              <td className="p-2.5 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleExpandRow(originalIndex)}
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                    title={expandedIndices.has(originalIndex) ? "Replier les détails" : "Déplier les détails"}
                                  >
                                    {expandedIndices.has(originalIndex) ? (
                                      <ChevronDown className="h-3.5 w-3.5 text-primary" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteItem(originalIndex)}
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"
                                    title="Retirer cette question du lot"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                            {expandedIndices.has(originalIndex) && (
                              <tr className="bg-muted/15 border-b border-border/80">
                                <td colSpan={10} className="p-4 space-y-3">
                                  {/* 1. Validation Errors if present */}
                                  {(!item.is_valid || (item.validation_errors && item.validation_errors.length > 0)) && (
                                    <div className="p-3 bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-400 rounded-xl text-xs space-y-1">
                                      <div className="font-bold flex items-center gap-1.5">
                                        <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                                        <span>Problèmes de validation détectés pour cette question :</span>
                                      </div>
                                      <ul className="list-disc list-inside space-y-0.5 text-2xs pl-5">
                                        {item.validation_errors && item.validation_errors.length > 0 ? (
                                          item.validation_errors.map((err, eIdx) => <li key={eIdx}>{err}</li>)
                                        ) : (
                                          <li>Données de question incomplètes ou invalides.</li>
                                        )}
                                      </ul>
                                    </div>
                                  )}

                                  {/* 2. Duplicate Warning if present */}
                                  {item.is_duplicate && item.duplicate_reason && (
                                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-xl text-xs flex items-center gap-2">
                                      <Copy className="h-4 w-4 shrink-0 text-amber-600" />
                                      <span><strong>Raison du doublon :</strong> {item.duplicate_reason}</span>
                                    </div>
                                  )}

                                  {/* 3. Stimulus & Full Prompt */}
                                  {(item.stimulus_text || item.prompt) && (
                                    <div className="p-3 bg-card rounded-xl border border-border/70 space-y-2">
                                      {item.stimulus_title && (
                                        <div className="text-2xs font-bold text-muted-foreground uppercase tracking-wide">
                                          Document : {item.stimulus_title}
                                        </div>
                                      )}
                                      {item.stimulus_text && (
                                        <div className="p-2.5 rounded-lg bg-muted/40 font-mono text-2xs text-foreground whitespace-pre-wrap border border-border/40">
                                          {item.stimulus_text}
                                        </div>
                                      )}
                                      <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                        <span className="text-primary font-bold">Consigne :</span> {item.prompt}
                                      </div>
                                    </div>
                                  )}

                                  {/* 4. Multi-Gap Cloze Inspector (if item.gaps exists and has entries) */}
                                  {item.gaps && item.gaps.length > 0 ? (
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-foreground flex items-center gap-2">
                                          <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-2xs font-mono">
                                            {item.gaps.length} trou{item.gaps.length > 1 ? "s" : ""}
                                          </span>
                                          Aperçu didactique des lacunes (Question indivisible TEF)
                                        </span>
                                        <span className="text-2xs text-muted-foreground">
                                          Notation proportionnelle / scoring unifié
                                        </span>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {item.gaps.map((gap, gIdx) => (
                                          <div
                                            key={gap.gap_id || gIdx}
                                            className="p-3 rounded-xl border border-border bg-card shadow-2xs space-y-2"
                                          >
                                            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5">
                                              <div className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 rounded bg-primary text-primary-foreground font-mono text-2xs font-bold">
                                                  Trou [{gap.gap_id}]
                                                </span>
                                                {gap.cue_text && (
                                                  <span className="text-2xs font-medium text-muted-foreground truncate" title={gap.cue_text}>
                                                    {gap.cue_text}
                                                  </span>
                                                )}
                                              </div>
                                              <span className="text-3xs text-muted-foreground font-mono">
                                                {gap.options?.length || 0} choix
                                              </span>
                                            </div>

                                            <div className="space-y-1.5">
                                              {gap.options && gap.options.length > 0 ? (
                                                gap.options.map((opt, oIdx) => {
                                                  const letter = String.fromCharCode(65 + oIdx);
                                                  return (
                                                    <div
                                                      key={oIdx}
                                                      className={`p-2 rounded-lg border text-2xs transition flex flex-col gap-1 ${
                                                        opt.is_correct
                                                          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-950 dark:text-emerald-200"
                                                          : "bg-muted/30 border-border/60 text-muted-foreground"
                                                      }`}
                                                    >
                                                      <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-1.5">
                                                          <span className={`font-mono font-bold px-1.5 py-0.2 rounded text-3xs ${
                                                            opt.is_correct
                                                              ? "bg-emerald-500 text-white"
                                                              : "bg-muted text-muted-foreground"
                                                          }`}>
                                                            {letter}
                                                          </span>
                                                          <span className={`font-medium ${opt.is_correct ? "text-emerald-800 dark:text-emerald-300 font-semibold" : "text-foreground"}`}>
                                                            {opt.content}
                                                          </span>
                                                        </div>
                                                        {opt.is_correct && (
                                                          <span className="text-3xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">
                                                            ✓ Bonne réponse
                                                          </span>
                                                        )}
                                                      </div>

                                                      {/* Pedagogical distractor reasoning */}
                                                      {!opt.is_correct && (opt.misconception_type || opt.distractor_rationale) && (
                                                        <div className="mt-0.5 pt-1 border-t border-border/40 text-3xs flex flex-wrap items-center gap-1.5">
                                                          {opt.misconception_type && (
                                                            <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 font-medium">
                                                              Piège : {opt.misconception_type}
                                                            </span>
                                                          )}
                                                          {opt.distractor_rationale && (
                                                            <span className="text-muted-foreground italic truncate" title={opt.distractor_rationale}>
                                                              {opt.distractor_rationale}
                                                            </span>
                                                          )}
                                                        </div>
                                                      )}

                                                      {/* Correct option rationale */}
                                                      {opt.is_correct && opt.explanation && (
                                                        <div className="mt-0.5 pt-1 border-t border-emerald-500/20 text-3xs text-emerald-700 dark:text-emerald-400 italic">
                                                          {opt.explanation}
                                                        </div>
                                                      )}
                                                    </div>
                                                  );
                                                })
                                              ) : gap.expected_answers && gap.expected_answers.length > 0 ? (
                                                <div className="p-2 rounded-lg bg-muted/40 border border-border/60 text-2xs space-y-1">
                                                  <span className="font-semibold text-foreground">Réponses attendues :</span>
                                                  <div className="flex flex-wrap gap-1">
                                                    {gap.expected_answers.map((ans, aIdx) => (
                                                      <span key={aIdx} className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-mono text-3xs">
                                                        {ans}
                                                      </span>
                                                    ))}
                                                  </div>
                                                </div>
                                              ) : (
                                                <span className="text-2xs text-rose-500 italic">Aucune option configurée pour ce trou.</span>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : item.options && item.options.length > 0 ? (
                                    /* Standard Options Inspector */
                                    <div className="space-y-2">
                                      <span className="text-xs font-bold text-foreground">
                                        Options de réponse ({item.options.length})
                                      </span>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {item.options.map((opt, oIdx) => {
                                          const letter = String.fromCharCode(65 + oIdx);
                                          return (
                                            <div
                                              key={oIdx}
                                              className={`p-2 rounded-lg border text-2xs flex flex-col gap-1 ${
                                                opt.is_correct
                                                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-950 dark:text-emerald-200"
                                                  : "bg-muted/30 border-border/60 text-muted-foreground"
                                              }`}
                                            >
                                              <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-1.5">
                                                  <span className={`font-mono font-bold px-1.5 py-0.2 rounded text-3xs ${
                                                    opt.is_correct
                                                      ? "bg-emerald-500 text-white"
                                                      : "bg-muted text-muted-foreground"
                                                  }`}>
                                                    {letter}
                                                  </span>
                                                  <span className={`font-medium ${opt.is_correct ? "text-emerald-800 dark:text-emerald-300 font-semibold" : "text-foreground"}`}>
                                                    {opt.content}
                                                  </span>
                                                </div>
                                                {opt.is_correct && (
                                                  <span className="text-3xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">
                                                    ✓ Correct
                                                  </span>
                                                )}
                                              </div>
                                              {opt.distractor_rationale && (
                                                <div className="text-3xs text-muted-foreground italic mt-0.5">
                                                  {opt.distractor_rationale}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ) : null}

                                  {/* 5. General Explanation & Skill Codes */}
                                  {(item.explanation || (item.skill_codes && item.skill_codes.length > 0)) && (
                                    <div className="pt-2 border-t border-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-2xs">
                                      {item.explanation && (
                                        <div className="text-muted-foreground">
                                          <strong className="text-foreground">Explication générale :</strong> {item.explanation}
                                        </div>
                                      )}
                                      {item.skill_codes && item.skill_codes.length > 0 && (
                                        <div className="flex items-center gap-1 flex-wrap shrink-0">
                                          <span className="text-muted-foreground">Compétences :</span>
                                          {item.skill_codes.map((sc, scIdx) => (
                                            <span key={scIdx} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono text-3xs">
                                              {sc}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Status target selector */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card text-xs">
                <span className="font-semibold text-foreground">
                  Statut initial des questions créées :
                </span>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className="rounded-md border border-border bg-background p-1.5 text-xs text-foreground font-semibold"
                >
                  <option value="draft">Brouillon (Recommandé pour relecture)</option>
                  <option value="in_review">En révision éditoriale</option>
                  <option value="approved">Approuvé</option>
                  <option value="published">Publié immédiatement</option>
                </select>
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="py-12 text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-500/20">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Importation terminée avec succès !
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  <strong>{committedCount}</strong> question{committedCount > 1 ? "s ont" : " a"} été créée{committedCount > 1 ? "s" : ""} dans la banque avec le statut « {targetStatus} ».
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between">
          {step === "upload" && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Annuler
            </Button>
          )}

          {step === "preview" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep("upload")}
                disabled={isCommitting}
              >
                Retour
              </Button>
              <Button
                size="sm"
                onClick={handleCommit}
                disabled={isCommitting || validCount === 0}
                className="gap-1.5 font-semibold"
              >
                {isCommitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {invalidCount > 0
                  ? `Importer ${validCount} question${validCount > 1 ? "s" : ""} valide${validCount > 1 ? "s" : ""}`
                  : `Confirmer l'import (${validCount} question${validCount > 1 ? "s" : ""})`}
              </Button>
            </>
          )}

          {step === "success" && (
            <div className="w-full flex justify-end">
              <Button size="sm" onClick={onClose} className="font-semibold">
                Fermer et voir les questions
              </Button>
            </div>
          )}
        </div>
      </div>

      <QuestionSheetGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
};
