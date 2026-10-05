import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  BookOpen,
  ShieldCheck,
  RefreshCw,
  Brain,
  Sliders,
  Check,
  X,
  ArrowRight,
  ArrowLeft,
  Edit3,
  Layers,
  Save,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  fetchSkills,
  generateQuestionCandidates,
  reviewQuestionCandidate,
  createDraftFromCandidate,
  generateStimulusCandidate,
  persistStimulusCandidate,
} from "../api";
import { fetchTaskTypes } from "../skills/api";
import type { TaskType } from "../skills/types";
import type {
  SkillItem,
  GeneratedQuestionCandidate,
  AIQuestionGenerationRequest,
  AIStimulusCandidate,
} from "../types";
import { StimulusRenderer } from "./components/StimulusRenderer";

// Task type specifications for TEF compliance & document requirements
const TASK_TYPE_SPECS: Record<
  string,
  {
    label: string;
    badge: string;
    docDesc: string;
    stimulusRequired: boolean;
  }
> = {
  document_matching: {
    label: "Faisceau multi-documents (Documents A, B, C, D)",
    badge: "Multi-docs A/B/C/D",
    docDesc:
      "Nécessite 4 documents courts distincts (offres, ateliers, stages). Les items testent l'adéquation d'un besoin avec le bon document.",
    stimulusRequired: true,
  },
  press_article: {
    label: "Article de presse / extrait journalistique",
    badge: "Article suivi",
    docDesc:
      "Article suivi d'actualité ou d'analyse. Évalue l'identification de la thèse, des arguments et des nuances implicites.",
    stimulusRequired: true,
  },
  sentence_gap: {
    label: "Phrases à trou (Syntaxe & Lexique)",
    badge: "Sans document externe",
    docDesc:
      "Aucun document externe requis. L'énoncé contient directement la phrase avec l'espace lacunaire '______'.",
    stimulusRequired: false,
  },
  text_gap: {
    label: "Texte à trou (Cloze / Connecteurs)",
    badge: "Texte à lacune",
    docDesc:
      "Paragraphe suivi avec un connecteur logique manquant (______). Évalue la maîtrise de la cohésion textuelle.",
    stimulusRequired: true,
  },
  graph_matching: {
    label: "Tableau ou graphique statistique",
    badge: "Données / Tableau",
    docDesc:
      "Tableau ou données chiffrées en pourcentages. Évalue la lecture et l'interprétation d'informations quantitatives.",
    stimulusRequired: true,
  },
  short_announcement: {
    label: "Message court / Annonce sonore",
    badge: "Audio court",
    docDesc:
      "Transcription audio d'annonces en gare, magasin ou message téléphonique avec bruitages acoustiques de contexte.",
    stimulusRequired: true,
  },
  radio_broadcast: {
    label: "Chronique / Émission de radio",
    badge: "Chronique radio",
    docDesc:
      "Dialogue ou chronique journalistique avec repérage de points de vue contradictoires et arguments nuancés.",
    stimulusRequired: true,
  },
  public_survey: {
    label: "Micro-trottoir / Sondage d'opinion",
    badge: "Opinions multiples",
    docDesc:
      "Recueil de 4 locuteurs distincts exprimant des points de vue variés sur un aménagement urbain ou sujet de société.",
    stimulusRequired: true,
  },
  phonological_recognition: {
    label: "Discrimination phonologique & intonation",
    badge: "Intonation & Acte",
    docDesc:
      "Énoncé court mettant en jeu l'intonation (montante, descendante) et l'intention communicative du locuteur.",
    stimulusRequired: true,
  },
  fait_divers: {
    label: "Fait divers (Narration)",
    badge: "Écrit - Narration",
    docDesc:
      "Court paragraphe relatant un fait insolite servant de point de départ pour une rédaction au passé (min. 80 mots).",
    stimulusRequired: true,
  },
  opinion_letter: {
    label: "Lettre d'opinion / Débat citoyen",
    badge: "Écrit - Argumentation",
    docDesc:
      "Présentation d'une problématique citoyenne demandant une lettre formelle argumentée au maire (min. 200 mots).",
    stimulusRequired: true,
  },
  information_gathering: {
    label: "Prise de renseignements (Section A)",
    badge: "Oral - Questions",
    docDesc:
      "Petite annonce support pour formuler des questions pertinentes lors d'un appel téléphonique (5 minutes).",
    stimulusRequired: true,
  },
  persuasive_argumentation: {
    label: "Argumentation persuasive (Section B)",
    badge: "Oral - Persuasion",
    docDesc:
      "Brochure ou proposition d'activité servant à convaincre un interlocuteur réticent (10 minutes).",
    stimulusRequired: true,
  },
};

interface AIGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQuestionCreated?: (questionId: string) => void;
  defaultModality?: string;
  defaultTaskTypeId?: string;
}

export const AIGenerationModal: React.FC<AIGenerationModalProps> = ({
  isOpen,
  onClose,
  onQuestionCreated,
  defaultModality = "reading",
  defaultTaskTypeId,
}) => {
  const navigate = useNavigate();

  // Stepper state
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<"step1_stimulus" | "step2_questions">("step2_questions");

  // Reference data
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [skills, setSkills] = useState<SkillItem[]>([]);

  // Generation parameters
  const [modality, setModality] = useState(defaultModality);
  const [taskTypeId, setTaskTypeId] = useState(defaultTaskTypeId || "");
  const [targetCefr, setTargetCefr] = useState("B2");
  const [cognitiveComplexity, setCognitiveComplexity] = useState("interpretation");
  const [topic, setTopic] = useState("");
  const [stimulusMode, setStimulusMode] = useState<"generate_new" | "existing_stimulus" | "supplied_text">("generate_new");
  const [suppliedStimulusText, setSuppliedStimulusText] = useState("");
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [count, setCount] = useState(1);
  const [temperature, setTemperature] = useState(0.7);
  const [forceSimulation, setForceSimulation] = useState(false);

  // Stimulus studio state
  const [isGeneratingStimulus, setIsGeneratingStimulus] = useState(false);
  const [isPersistingStimulus, setIsPersistingStimulus] = useState(false);
  const [stimulusCandidate, setStimulusCandidate] = useState<AIStimulusCandidate | null>(null);
  const [persistedStimulusId, setPersistedStimulusId] = useState<string | null>(null);
  const [isEditingStimulus, setIsEditingStimulus] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [editedSource, setEditedSource] = useState("");

  // Question execution state
  const [isGenerating, setIsGenerating] = useState(false);
  const [candidates, setCandidates] = useState<GeneratedQuestionCandidate[]>([]);
  const [selectedCandidateIdx, setSelectedCandidateIdx] = useState<number>(0);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false);
  const [isAuditingCandidate, setIsAuditingCandidate] = useState(false);

  // Current selected task type spec
  const currentTaskType = useMemo(
    () => taskTypes.find((t) => t.id === taskTypeId),
    [taskTypes, taskTypeId]
  );
  const currentTaskCode = currentTaskType?.code || "";
  const currentTaskSpec = TASK_TYPE_SPECS[currentTaskCode];
  const isSentenceGap = currentTaskCode === "sentence_gap";

  // Load task types and skills
  useEffect(() => {
    if (!isOpen) return;

    fetchTaskTypes(modality)
      .then((tts) => {
        setTaskTypes(tts);
        if (tts.length > 0 && !taskTypeId) {
          setTaskTypeId(tts[0].id);
        }
      })
      .catch(() => {});

    fetchSkills()
      .then((sks) => {
        setSkills(sks.filter((s) => s.is_active));
      })
      .catch(() => {});
  }, [isOpen, modality]);

  // Adjust active step if sentence_gap selected
  useEffect(() => {
    if (isSentenceGap && activeWorkflowStep === "step1_stimulus") {
      setActiveWorkflowStep("step2_questions");
    }
  }, [isSentenceGap, activeWorkflowStep]);

  // Handle independent stimulus generation in Step 1
  const handleGenerateStimulus = async () => {
    setIsGeneratingStimulus(true);
    setFeedback(null);
    try {
      const res = await generateStimulusCandidate({
        modality,
        task_type_code: currentTaskCode || undefined,
        target_cefr: targetCefr,
        topic: topic.trim() || undefined,
        force_simulation: forceSimulation,
      });
      setStimulusCandidate(res);
      setEditedTitle(res.title);
      setEditedContent(res.content_text);
      setEditedSource(res.source_attribution || "");
      setPersistedStimulusId(null);
      setIsEditingStimulus(false);
      setFeedback({
        type: "success",
        text: `Support "${res.title}" généré avec succès. Vous pouvez le retoucher ou passer directement aux questions.`,
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "Échec de génération du support.",
      });
    } finally {
      setIsGeneratingStimulus(false);
    }
  };

  // Save edits made to the stimulus candidate
  const handleSaveStimulusEdits = () => {
    if (!stimulusCandidate) return;
    setStimulusCandidate({
      ...stimulusCandidate,
      title: editedTitle.trim() || stimulusCandidate.title,
      content_text: editedContent.trim() || stimulusCandidate.content_text,
      source_attribution: editedSource.trim() || stimulusCandidate.source_attribution,
      word_count: editedContent.trim().split(/\s+/).filter(Boolean).length,
    });
    setIsEditingStimulus(false);
    setFeedback({
      type: "info",
      text: "Modifications du support appliquées avec succès.",
    });
  };

  // Persist generated stimulus to database and advance to Step 2
  const handlePersistAndProceed = async () => {
    if (!stimulusCandidate) return;
    setIsPersistingStimulus(true);
    try {
      const persisted = await persistStimulusCandidate(stimulusCandidate);
      setPersistedStimulusId(persisted.id);
      setStimulusMode("existing_stimulus");
      setActiveWorkflowStep("step2_questions");
      setFeedback({
        type: "success",
        text: `Support "${persisted.title}" enregistré et rattaché ! Vous pouvez maintenant générer les questions associées.`,
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "Erreur lors de l'enregistrement du support.",
      });
    } finally {
      setIsPersistingStimulus(false);
    }
  };

  // Handle candidate question generation
  const handleGenerateQuestions = async () => {
    setIsGenerating(true);
    setFeedback(null);
    try {
      const payload: AIQuestionGenerationRequest = {
        modality,
        task_type_id: taskTypeId ? taskTypeId : undefined,
        task_type_code: currentTaskCode || undefined,
        target_cefr: targetCefr,
        cognitive_complexity: cognitiveComplexity,
        stimulus_mode: isSentenceGap
          ? "none"
          : persistedStimulusId
          ? "existing_stimulus"
          : stimulusCandidate?.content_text
          ? "supplied_text"
          : stimulusMode,
        stimulus_id: isSentenceGap ? undefined : persistedStimulusId || undefined,
        supplied_stimulus_text:
          !isSentenceGap
            ? persistedStimulusId
              ? undefined
              : stimulusCandidate?.content_text
              ? stimulusCandidate.content_text
              : stimulusMode === "supplied_text"
              ? suppliedStimulusText
              : undefined
            : undefined,
        target_skill_ids: selectedSkillIds.length > 0 ? selectedSkillIds : undefined,
        count,
        temperature,
        force_simulation: forceSimulation,
      };

      const res = await generateQuestionCandidates(payload);
      setCandidates(res.candidates);
      setSelectedCandidateIdx(0);
      setFeedback({
        type: "success",
        text: `${res.candidates.length} candidat(s) généré(s) (${res.valid_candidates_count} conforme(s) aux règles psychométriques).`,
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "Erreur lors de la génération par IA.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSecondPassAudit = async (cand: GeneratedQuestionCandidate, idx: number) => {
    setIsAuditingCandidate(true);
    try {
      const review = await reviewQuestionCandidate({
        candidate: cand,
        force_simulation: forceSimulation,
      });

      const updated = [...candidates];
      updated[idx] = {
        ...cand,
        ai_review: review,
      };
      setCandidates(updated);
      setFeedback({
        type: "success",
        text: `Audit pédagogique complété. Score qualité : ${review.quality_score}/100.`,
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "Échec de l'audit 2e passe.",
      });
    } finally {
      setIsAuditingCandidate(false);
    }
  };

  const handleCreateDraft = async (cand: GeneratedQuestionCandidate) => {
    setIsSubmittingDraft(true);
    try {
      const q = await createDraftFromCandidate({ candidate: cand });
      setFeedback({
        type: "success",
        text: `Brouillon #${q.id.slice(0, 8)} créé avec succès ! Statut : Brouillon garanti.`,
      });
      if (onQuestionCreated) {
        onQuestionCreated(q.id);
      }
      navigate(`/admin/questions/${q.id}?tab=content`);
      onClose();
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "Échec de création du brouillon.",
      });
    } finally {
      setIsSubmittingDraft(false);
    }
  };

  const activeCandidate = candidates[selectedCandidateIdx];

  // Derive active document key if question mentions a specific Document (e.g. Document B)
  const detectedActiveDocKey = useMemo(() => {
    if (!activeCandidate) return null;
    const combinedText = `${activeCandidate.prompt} ${activeCandidate.options.map((o) => o.content).join(" ")}`;
    const match = combinedText.match(/Document\s+([A-D])/i);
    return match ? `Document ${match[1].toUpperCase()}` : null;
  }, [activeCandidate]);

  // Helper to highlight sentence_gap blanks
  const renderPromptText = (promptText: string) => {
    if (!promptText.includes("______")) {
      return <span className="font-bold text-sm text-foreground leading-relaxed">{promptText}</span>;
    }
    const parts = promptText.split("______");
    return (
      <span className="font-bold text-sm text-foreground leading-relaxed">
        {parts.map((part, i) => (
          <React.Fragment key={i}>
            {part}
            {i < parts.length - 1 && (
              <span className="inline-flex items-center px-2.5 py-0.5 mx-1 rounded-md bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700 font-mono font-extrabold text-xs tracking-widest shadow-2xs">
                ______
              </span>
            )}
          </React.Fragment>
        ))}
      </span>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[94vh] overflow-y-auto p-6">
        <DialogHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Sparkles className="h-5 w-5" />
              </div>
              <DialogTitle className="text-xl font-bold">
                Atelier de génération de questions par IA
              </DialogTitle>
            </div>
            <Badge
              variant="outline"
              className="text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30"
            >
              Conformité TEF stricte & Invariants V2
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Générez des items d'évaluation supervisés selon les standards officiels du TEF.
            Tout contenu généré est obligatoirement persisté en statut <strong>Brouillon</strong> avec
            provenance IA vérifiable.
          </DialogDescription>
        </DialogHeader>

        {/* Workflow Stepper Navigation */}
        <div className="flex items-center justify-between border-b border-border pb-2 pt-1 text-xs">
          <div className="flex items-center gap-2">
            {!isSentenceGap ? (
              <>
                <button
                  type="button"
                  onClick={() => setActiveWorkflowStep("step1_stimulus")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-2 ${
                    activeWorkflowStep === "step1_stimulus"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "bg-muted/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-2xs font-bold">
                    1
                  </span>
                  <span>Conception du Support (Stimulus)</span>
                  {persistedStimulusId && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                  )}
                </button>

                <ArrowRight className="h-4 w-4 text-muted-foreground/60" />

                <button
                  type="button"
                  onClick={() => setActiveWorkflowStep("step2_questions")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-2 ${
                    activeWorkflowStep === "step2_questions"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "bg-muted/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-2xs font-bold">
                    2
                  </span>
                  <span>Évaluation & Questions</span>
                  {candidates.length > 0 && (
                    <Badge variant="secondary" className="text-3xs px-1.5 py-0 h-4">
                      {candidates.length}
                    </Badge>
                  )}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 p-1.5 rounded-lg bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                <span>Tâche sans document externe (Phrases à trou) — Étape directe Questions</span>
              </div>
            )}
          </div>

          {persistedStimulusId && (
            <div className="flex items-center gap-2">
              <span className="text-3xs font-mono text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                Support lié : #{persistedStimulusId.slice(0, 8)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPersistedStimulusId(null);
                  setStimulusCandidate(null);
                }}
                className="h-6 px-1.5 text-2xs text-muted-foreground hover:text-rose-600"
              >
                Détacher
              </Button>
            </div>
          )}
        </div>

        {/* Global Feedback Banner */}
        {feedback && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center justify-between ${
              feedback.type === "success"
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                : feedback.type === "error"
                ? "bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300"
                : "bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300"
            }`}
          >
            <span className="flex items-center gap-2">
              {feedback.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              )}
              {feedback.text}
            </span>
            <button
              onClick={() => setFeedback(null)}
              className="text-muted-foreground hover:text-foreground font-semibold px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 1: STIMULUS STUDIO (SUPPORT DOCUMENTAIRE)                            */}
        {/* ========================================================================= */}
        {activeWorkflowStep === "step1_stimulus" && !isSentenceGap && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-2">
            {/* Step 1 Settings (4 cols) */}
            <div className="lg:col-span-4 space-y-4 border-r border-border pr-4 text-xs">
              <div className="font-semibold text-sm flex items-center gap-1.5 text-foreground">
                <BookOpen className="h-4 w-4 text-purple-600" /> Paramètres du support TEF
              </div>

              {/* Modality */}
              <div>
                <label className="font-medium text-muted-foreground block mb-1">
                  Modalité
                </label>
                <select
                  value={modality}
                  onChange={(e) => setModality(e.target.value)}
                  className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs capitalize"
                >
                  <option value="reading">Compréhension écrite (reading)</option>
                  <option value="listening">Compréhension orale (listening)</option>
                  <option value="writing">Expression écrite (writing)</option>
                  <option value="speaking">Expression orale (speaking)</option>
                </select>
              </div>

              {/* Target CEFR */}
              <div>
                <label className="font-medium text-muted-foreground block mb-1">
                  Niveau CECRL visé
                </label>
                <div className="grid grid-cols-6 gap-1">
                  {["A1", "A2", "B1", "B2", "C1", "C2"].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setTargetCefr(lvl)}
                      className={`py-1 rounded font-bold text-center border text-xs transition ${
                        targetCefr === lvl
                          ? "bg-purple-600 text-white border-purple-600 shadow-2xs"
                          : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Task Type Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-medium text-muted-foreground">Type de tâche TEF</label>
                  {currentTaskSpec && (
                    <Badge variant="secondary" className="text-2xs font-semibold">
                      {currentTaskSpec.badge}
                    </Badge>
                  )}
                </div>
                <select
                  value={taskTypeId}
                  onChange={(e) => setTaskTypeId(e.target.value)}
                  className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs"
                >
                  {taskTypes.map((tt) => (
                    <option key={tt.id} value={tt.id}>
                      {tt.code} — {tt.name}
                    </option>
                  ))}
                </select>
                {currentTaskSpec && (
                  <p className="text-2xs text-muted-foreground mt-1 leading-snug">
                    {currentTaskSpec.docDesc}
                  </p>
                )}
              </div>

              {/* Topic / Context */}
              <div>
                <label className="font-medium text-muted-foreground block mb-1">
                  Thématique ou contexte ciblé (optionnel)
                </label>
                <Input
                  placeholder="Ex. Formation professionnelle, transition écologique..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="font-medium text-muted-foreground">Mode simulation</span>
                <input
                  type="checkbox"
                  checked={forceSimulation}
                  onChange={(e) => setForceSimulation(e.target.checked)}
                  className="h-4 w-4 rounded accent-purple-600"
                />
              </div>

              <Button
                onClick={handleGenerateStimulus}
                disabled={isGeneratingStimulus}
                className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold mt-2 shadow-sm text-xs h-9"
              >
                {isGeneratingStimulus ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Génération du support en cours...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Générer le support par IA
                  </>
                )}
              </Button>
            </div>

            {/* Step 1 Preview & Edit Studio (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              {!stimulusCandidate ? (
                <div className="h-full min-h-[360px] flex flex-col items-center justify-center border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground">
                  <Layers className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <h4 className="font-semibold text-sm text-foreground">
                    Aucun support généré pour l'instant
                  </h4>
                  <p className="text-xs max-w-md mt-1">
                    Choisissez le format désiré à gauche et lancez la génération.
                    Le support généré s'affichera ici avec son rendu officiel (onglets A/B/C/D, tableau ou audio).
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Actions Bar for Stimulus */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5 text-purple-600" />
                      Aperçu du support généré
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingStimulus(!isEditingStimulus)}
                        className="h-7 text-xs gap-1 border-border"
                      >
                        <Edit3 className="h-3 w-3" />
                        {isEditingStimulus ? "Fermer l'éditeur" : "Retoucher le texte"}
                      </Button>
                      <Button
                        size="sm"
                        onClick={handlePersistAndProceed}
                        disabled={isPersistingStimulus}
                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5"
                      >
                        {isPersistingStimulus ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        Valider & Passer aux questions
                      </Button>
                    </div>
                  </div>

                  {/* Inline Editor if active */}
                  {isEditingStimulus ? (
                    <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/20 dark:bg-purple-950/10 space-y-3">
                      <div>
                        <label className="text-2xs font-semibold text-muted-foreground block mb-1">
                          Titre du support
                        </label>
                        <Input
                          value={editedTitle}
                          onChange={(e) => setEditedTitle(e.target.value)}
                          className="h-8 text-xs bg-background"
                        />
                      </div>
                      <div>
                        <label className="text-2xs font-semibold text-muted-foreground block mb-1">
                          Contenu textuel (Markdown, tableaux ou balises A/B/C/D)
                        </label>
                        <Textarea
                          value={editedContent}
                          onChange={(e) => setEditedContent(e.target.value)}
                          rows={10}
                          className="text-xs font-mono bg-background"
                        />
                      </div>
                      <div>
                        <label className="text-2xs font-semibold text-muted-foreground block mb-1">
                          Attribution / Source
                        </label>
                        <Input
                          value={editedSource}
                          onChange={(e) => setEditedSource(e.target.value)}
                          className="h-8 text-xs bg-background"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsEditingStimulus(false)}
                          className="h-7 text-xs"
                        >
                          Annuler
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveStimulusEdits}
                          className="h-7 text-xs bg-purple-600 text-white font-semibold gap-1"
                        >
                          <Save className="h-3 w-3" />
                          Appliquer les modifications
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Rich Renderer Display */
                    <StimulusRenderer
                      title={stimulusCandidate.title}
                      content={stimulusCandidate.content_text}
                      modality={stimulusCandidate.modality}
                      textFormat={stimulusCandidate.text_format}
                      sourceCitation={stimulusCandidate.source_attribution}
                      cefrLevel={stimulusCandidate.target_cefr}
                      wordCount={stimulusCandidate.word_count}
                      viewMode="full"
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: QUESTIONS WORKSPACE (SPLIT-SCREEN EXAM PREVIEW)                   */}
        {/* ========================================================================= */}
        {(activeWorkflowStep === "step2_questions" || isSentenceGap) && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-2">
            {/* Left Column: Generation Parameters (4 cols) */}
            <div className="lg:col-span-4 space-y-4 border-r border-border pr-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm flex items-center gap-1.5 text-foreground">
                  <Sliders className="h-4 w-4 text-purple-600" /> Paramètres d'évaluation
                </span>
                {!isSentenceGap && (
                  <button
                    type="button"
                    onClick={() => setActiveWorkflowStep("step1_stimulus")}
                    className="text-3xs text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-1"
                  >
                    <ArrowLeft className="h-3 w-3" /> Retour Support
                  </button>
                )}
              </div>

              {/* Modality & Task Type (Summary) */}
              <div className="p-2.5 rounded-lg bg-muted/40 border border-border space-y-1">
                <div className="flex items-center justify-between text-2xs">
                  <span className="text-muted-foreground">Tâche :</span>
                  <span className="font-bold text-foreground capitalize">
                    {currentTaskType?.name || currentTaskCode}
                  </span>
                </div>
                <div className="flex items-center justify-between text-2xs">
                  <span className="text-muted-foreground">Niveau :</span>
                  <Badge className="bg-purple-600 text-white font-bold text-3xs h-4">
                    {targetCefr}
                  </Badge>
                </div>
              </div>

              {/* Cognitive Complexity */}
              <div>
                <label className="font-medium text-muted-foreground block mb-1">
                  Complexité cognitive
                </label>
                <select
                  value={cognitiveComplexity}
                  onChange={(e) => setCognitiveComplexity(e.target.value)}
                  className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs"
                >
                  <option value="recall_recognition">Rappel / Reconnaissance factuelle</option>
                  <option value="interpretation">Compréhension / Interprétation</option>
                  <option value="inferencing_synthesis">Inférence / Déduction / Synthèse</option>
                  <option value="critical_evaluation">Évaluation critique / Nuance implicite</option>
                </select>
              </div>

              {/* Topic */}
              <div>
                <label className="font-medium text-muted-foreground block mb-1">
                  Thématique (optionnel)
                </label>
                <Input
                  placeholder="Ex. Mobilités douces, formation..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              {/* Stimulus Attachment Status */}
              {!isSentenceGap && (
                <div>
                  <label className="font-medium text-muted-foreground block mb-1">
                    Support documentaire rattaché
                  </label>
                  {persistedStimulusId ? (
                    <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 text-2xs flex items-center justify-between">
                      <span className="text-emerald-800 dark:text-emerald-200 font-medium">
                        Support actif (#{persistedStimulusId.slice(0, 8)})
                      </span>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                  ) : (
                    <div>
                      <select
                        value={stimulusMode}
                        onChange={(e: any) => setStimulusMode(e.target.value)}
                        className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs"
                      >
                        <option value="generate_new">Générer un support en même temps</option>
                        <option value="supplied_text">Coller un texte de référence</option>
                      </select>
                      {stimulusMode === "supplied_text" && (
                        <Textarea
                          placeholder="Collez ici le support documentaire..."
                          value={suppliedStimulusText}
                          onChange={(e) => setSuppliedStimulusText(e.target.value)}
                          className="text-xs h-16 mt-1.5"
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Target Skill Selection */}
              {skills.length > 0 && (
                <div>
                  <label className="font-medium text-muted-foreground block mb-1">
                    Compétence ciblée (optionnel)
                  </label>
                  <select
                    value={selectedSkillIds[0] || ""}
                    onChange={(e) => setSelectedSkillIds(e.target.value ? [e.target.value] : [])}
                    className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs"
                  >
                    <option value="">Sélection automatique (Multidimensionnel TEF)</option>
                    {skills.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Temperature */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-medium text-muted-foreground">
                    Créativité : {temperature}
                  </label>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="1.2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full h-1.5 accent-purple-600 cursor-pointer"
                />
              </div>

              {/* Count & Simulation */}
              <div className="pt-2 border-t border-border flex items-center justify-between">
                <div>
                  <label className="font-medium text-muted-foreground block">
                    Nombre d'items
                  </label>
                  <select
                    value={count}
                    onChange={(e) => setCount(parseInt(e.target.value, 10))}
                    className="h-7 px-2 rounded-md border border-input bg-background text-xs mt-1"
                  >
                    <option value={1}>1 candidat</option>
                    <option value={2}>2 candidats</option>
                    <option value={3}>3 candidats</option>
                  </select>
                </div>

                <div className="flex flex-col items-end">
                  <label className="font-medium text-muted-foreground block">Simulation</label>
                  <input
                    type="checkbox"
                    checked={forceSimulation}
                    onChange={(e) => setForceSimulation(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded accent-purple-600"
                  />
                </div>
              </div>

              <Button
                onClick={handleGenerateQuestions}
                disabled={isGenerating}
                className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold mt-2 shadow-sm text-xs h-9"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Génération des questions...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Générer les questions IA
                  </>
                )}
              </Button>
            </div>

            {/* Right Column: Split-Screen Exam Preview (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              {candidates.length === 0 ? (
                <div className="h-full min-h-[380px] flex flex-col items-center justify-center border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground">
                  <Brain className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <h4 className="font-semibold text-sm text-foreground">Aucune question générée</h4>
                  <p className="text-xs max-w-sm mt-1">
                    Lancez la génération des questions. Elles apparaîtront en écran partagé avec le
                    support à gauche et l'item avec ses distracteurs à droite.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Candidate Selector Tabs */}
                  {candidates.length > 1 && (
                    <div className="flex items-center gap-2 border-b border-border pb-2">
                      {candidates.map((cand, idx) => (
                        <button
                          key={cand.candidate_id}
                          type="button"
                          onClick={() => setSelectedCandidateIdx(idx)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                            selectedCandidateIdx === idx
                              ? "bg-purple-600 text-white shadow-xs"
                              : "bg-muted/50 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <span>Item #{idx + 1}</span>
                          {cand.validation_report?.is_valid ? (
                            <Check className="h-3 w-3 text-emerald-300" />
                          ) : (
                            <AlertTriangle className="h-3 w-3 text-amber-300" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {activeCandidate && (
                    <div className="space-y-4 text-xs">
                      {/* Quality & Validation Banner */}
                      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border border-border bg-card">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-purple-600 text-white font-bold text-2xs">
                            {activeCandidate.target_cefr}
                          </Badge>
                          <Badge variant="outline" className="text-2xs capitalize">
                            {activeCandidate.cognitive_complexity}
                          </Badge>
                          <Badge variant="outline" className="text-2xs font-mono">
                            {activeCandidate.response_type}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2">
                          {activeCandidate.duplicate_check?.is_duplicate ? (
                            <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Doublon ({Math.round(activeCandidate.duplicate_check.similarity_score * 100)}%)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
                              <ShieldCheck className="h-3 w-3" /> Unique
                            </span>
                          )}

                          {activeCandidate.validation_report?.is_valid ? (
                            <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-teal-500/10 text-teal-600 border border-teal-500/20 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Conforme règles V2
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Avertissements
                            </span>
                          )}
                        </div>
                      </div>

                      {/* --- SPLIT-SCREEN EXAM LAYOUT --- */}
                      <div className={`grid gap-4 ${activeCandidate.stimulus_content ? "grid-cols-1 md:grid-cols-12" : "grid-cols-1"}`}>
                        {/* Left Side: Stimulus Document Viewer (5 cols if present) */}
                        {activeCandidate.stimulus_content && (
                          <div className="md:col-span-5">
                            <StimulusRenderer
                              title={activeCandidate.stimulus_title}
                              content={activeCandidate.stimulus_content}
                              modality={activeCandidate.modality}
                              sourceCitation={activeCandidate.source_attribution}
                              cefrLevel={activeCandidate.target_cefr}
                              viewMode="split"
                              activeDocumentKey={detectedActiveDocKey}
                            />
                          </div>
                        )}

                        {/* Right Side: Question Item, Options & Rationales (7 cols or 12 cols) */}
                        <div className={`${activeCandidate.stimulus_content ? "md:col-span-7" : "col-span-1"} space-y-3`}>
                          {/* Question Prompt */}
                          <div className="p-3.5 rounded-xl border border-border bg-card shadow-2xs space-y-1.5">
                            <div className="font-semibold text-2xs text-muted-foreground uppercase tracking-wider">
                              Énoncé de la question :
                            </div>
                            <div>
                              {renderPromptText(activeCandidate.prompt)}
                            </div>
                            {activeCandidate.instructions && (
                              <div className="text-muted-foreground italic text-2xs pt-1 border-t border-border/40">
                                {activeCandidate.instructions}
                              </div>
                            )}
                          </div>

                          {/* Options List */}
                          {activeCandidate.options && activeCandidate.options.length > 0 && (
                            <div className="space-y-2">
                              <div className="font-semibold text-2xs text-muted-foreground uppercase tracking-wider">
                                Choix de réponse & Explications didactiques :
                              </div>
                              <div className="space-y-2">
                                {activeCandidate.options.map((opt, oIdx) => (
                                  <div
                                    key={oIdx}
                                    className={`p-3 rounded-xl border flex flex-col gap-1 transition-all ${
                                      opt.is_correct
                                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-950 dark:text-emerald-100 shadow-2xs"
                                        : "bg-card border-border text-foreground hover:bg-muted/20"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between font-medium">
                                      <span className="flex items-center gap-2">
                                        <span
                                          className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                                            opt.is_correct
                                              ? "bg-emerald-600 text-white"
                                              : "bg-muted text-muted-foreground"
                                          }`}
                                        >
                                          {String.fromCharCode(65 + oIdx)}
                                        </span>
                                        <span className="text-xs font-semibold">{opt.content}</span>
                                      </span>
                                      {opt.is_correct && (
                                        <Badge className="bg-emerald-600 text-white font-bold text-3xs">
                                          Bonne réponse
                                        </Badge>
                                      )}
                                    </div>
                                    {opt.explanation && (
                                      <div className="text-2xs text-muted-foreground pl-7 italic">
                                        Justification : {opt.explanation}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Granular Competencies Tagging */}
                          {activeCandidate.skill_mappings && activeCandidate.skill_mappings.length > 0 && (
                            <div className="p-3 rounded-xl border border-border bg-card/60 space-y-1.5">
                              <div className="font-semibold text-2xs text-muted-foreground uppercase tracking-wider">
                                Balises de compétences TEF V2 :
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {activeCandidate.skill_mappings.map((sk) => {
                                  const isPrimary = sk.role === "primary";
                                  const weightPct = Math.round(sk.weight * 100);
                                  return (
                                    <div
                                      key={sk.skill_id}
                                      className={`px-2 py-0.5 rounded-md border text-2xs flex items-center gap-1.5 ${
                                        isPrimary
                                          ? "bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300 font-semibold"
                                          : "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300"
                                      }`}
                                    >
                                      <span className="font-mono">
                                        {sk.skill_code || sk.skill_name || sk.skill_id.slice(0, 8)}
                                      </span>
                                      <span
                                        className={`px-1 py-0 rounded text-3xs font-extrabold ${
                                          isPrimary ? "bg-purple-600 text-white" : "bg-blue-600 text-white"
                                        }`}
                                      >
                                        {isPrimary ? "Primaire" : "Secondaire"} ({weightPct}%)
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* AI Review Report 2nd Pass */}
                          {activeCandidate.ai_review && (
                            <div className="p-3 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 space-y-1.5">
                              <div className="flex items-center justify-between text-2xs font-bold text-purple-700 dark:text-purple-300">
                                <span className="flex items-center gap-1">
                                  <Brain className="h-3.5 w-3.5" /> Rapport d'audit IA (2e passe)
                                </span>
                                <span>
                                  Qualité : {activeCandidate.ai_review.quality_score}/100 • Naturel : {activeCandidate.ai_review.naturalness_score}/100
                                </span>
                              </div>
                              {activeCandidate.ai_review.strengths?.length > 0 && (
                                <p className="text-3xs text-foreground/80">
                                  <strong>Forces :</strong> {activeCandidate.ai_review.strengths.join(", ")}
                                </p>
                              )}
                              {activeCandidate.ai_review.suggested_improvements?.length > 0 && (
                                <p className="text-3xs text-purple-800 dark:text-purple-200">
                                  <strong>Pistes :</strong> {activeCandidate.ai_review.suggested_improvements.join(", ")}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between pt-4 border-t border-border">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isAuditingCandidate}
                          onClick={() => handleSecondPassAudit(activeCandidate, selectedCandidateIdx)}
                          className="gap-1.5 text-xs h-8"
                        >
                          {isAuditingCandidate ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                          Auditer (2e passe IA)
                        </Button>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updated = candidates.filter((_, i) => i !== selectedCandidateIdx);
                              setCandidates(updated);
                              setSelectedCandidateIdx(0);
                            }}
                            className="text-xs text-muted-foreground hover:text-rose-600 h-8"
                          >
                            <X className="h-3.5 w-3.5 mr-1" /> Écarter cet item
                          </Button>

                          <Button
                            size="sm"
                            disabled={isSubmittingDraft}
                            onClick={() => handleCreateDraft(activeCandidate)}
                            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs h-8"
                          >
                            {isSubmittingDraft ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            Créer le brouillon & ouvrir dans l'atelier
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
