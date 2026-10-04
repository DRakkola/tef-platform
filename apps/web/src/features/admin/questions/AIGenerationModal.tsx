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
      "Article suivi d'actualité ou d'analyse. Évalue l'identification de la thèse, des arguments et des intentions implicites.",
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

  // Stimulus pre-generation state
  const [isGeneratingStimulus, setIsGeneratingStimulus] = useState(false);
  const [isPersistingStimulus, setIsPersistingStimulus] = useState(false);
  const [stimulusCandidate, setStimulusCandidate] = useState<AIStimulusCandidate | null>(null);
  const [persistedStimulusId, setPersistedStimulusId] = useState<string | null>(null);
  const [showStimulusStudio, setShowStimulusStudio] = useState(false);

  // Execution state
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

  // Handle independent stimulus generation
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
      setPersistedStimulusId(null);
      setFeedback({
        type: "success",
        text: `Support "${res.title}" généré avec succès (${
          res.text_format === "multi_doc" ? "4 documents A/B/C/D" : res.text_format
        }).`,
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "Échec de génération du support / stimulus.",
      });
    } finally {
      setIsGeneratingStimulus(false);
    }
  };

  // Persist generated stimulus to database
  const handlePersistStimulus = async () => {
    if (!stimulusCandidate) return;
    setIsPersistingStimulus(true);
    try {
      const persisted = await persistStimulusCandidate(stimulusCandidate);
      setPersistedStimulusId(persisted.id);
      setStimulusMode("existing_stimulus");
      setFeedback({
        type: "success",
        text: `Support "${persisted.title}" enregistré dans la base ! Les questions générées y seront automatiquement rattachées.`,
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
  const handleGenerate = async () => {
    setIsGenerating(true);
    setFeedback(null);
    try {
      const payload: AIQuestionGenerationRequest = {
        modality,
        task_type_id: taskTypeId ? taskTypeId : undefined,
        task_type_code: currentTaskCode || undefined,
        target_cefr: targetCefr,
        cognitive_complexity: cognitiveComplexity,
        topic: topic.trim() || undefined,
        stimulus_mode: isSentenceGap
          ? "none"
          : persistedStimulusId
          ? "existing_stimulus"
          : stimulusMode,
        stimulus_id: isSentenceGap ? undefined : persistedStimulusId || undefined,
        supplied_stimulus_text:
          !isSentenceGap && stimulusMode === "supplied_text"
            ? suppliedStimulusText
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

  // Helper to render stimulus preview content with multi-document & table support
  const renderStimulusPreview = (content: string) => {
    // 1. Multi-document bundle check (Documents A, B, C, D)
    if (
      content.includes("### Document") ||
      (content.includes("Document A") && content.includes("Document B"))
    ) {
      const rawDocs = content
        .split(/(?=### Document [A-D]|Document [A-D] :)/g)
        .filter(Boolean);
      if (rawDocs.length > 1) {
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-2">
            {rawDocs.map((doc, idx) => {
              const lines = doc.trim().split("\n");
              const header = lines[0].replace(/###\s*/, "");
              const body = lines.slice(1).join("\n").trim();
              const colors = [
                "border-emerald-500/30 bg-emerald-500/5 text-emerald-950 dark:text-emerald-200",
                "border-blue-500/30 bg-blue-500/5 text-blue-950 dark:text-blue-200",
                "border-amber-500/30 bg-amber-500/5 text-amber-950 dark:text-amber-200",
                "border-purple-500/30 bg-purple-500/5 text-purple-950 dark:text-purple-200",
              ];
              const badgeColors = [
                "bg-emerald-600 text-white",
                "bg-blue-600 text-white",
                "bg-amber-600 text-white",
                "bg-purple-600 text-white",
              ];
              return (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border flex flex-col gap-1.5 ${colors[idx % 4]}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-2xs font-bold ${
                        badgeColors[idx % 4]
                      }`}
                    >
                      {header.split(":")[0]?.trim() || `Document ${String.fromCharCode(65 + idx)}`}
                    </span>
                    <span className="font-semibold text-xs text-foreground truncate">
                      {header.split(":")[1]?.trim() || ""}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-foreground/90 whitespace-pre-line">
                    {body || doc}
                  </p>
                </div>
              );
            })}
          </div>
        );
      }
    }

    // 2. Markdown Table check
    if (
      content.includes("|") &&
      content.split("\n").some((l) => l.trim().startsWith("|"))
    ) {
      const lines = content
        .split("\n")
        .filter((l) => l.trim().startsWith("|"));
      if (lines.length >= 2) {
        const headerCells = lines[0]
          .split("|")
          .map((c) => c.trim())
          .filter(Boolean);
        const dataRows = lines.slice(lines[1].includes("---") ? 2 : 1);
        return (
          <div className="overflow-x-auto my-2 rounded-lg border border-border">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/70 text-foreground font-semibold border-b border-border">
                <tr>
                  {headerCells.map((h, i) => (
                    <th
                      key={i}
                      className="px-3 py-2 border-r border-border last:border-r-0"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dataRows.map((r, rIdx) => {
                  const cells = r
                    .split("|")
                    .map((c) => c.trim())
                    .filter(Boolean);
                  return (
                    <tr key={rIdx} className="hover:bg-muted/30">
                      {cells.map((c, cIdx) => (
                        <td
                          key={cIdx}
                          className="px-3 py-1.5 border-r border-border last:border-r-0 font-mono text-2xs"
                        >
                          {c}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }
    }

    // 3. Audio / Dialog transcript check
    if (
      content.includes("[Sonnerie") ||
      content.includes("[Micro-trottoir") ||
      content.includes("Locuteur") ||
      content.includes("[Audio")
    ) {
      return (
        <div className="p-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 font-mono text-xs text-foreground/90 space-y-1.5 whitespace-pre-line">
          {content}
        </div>
      );
    }

    // 4. Default standard passage
    return (
      <p className="italic text-foreground/80 leading-relaxed bg-background/50 p-2.5 rounded border border-border whitespace-pre-line">
        {content}
      </p>
    );
  };

  // Helper to highlight sentence_gap blanks
  const renderPromptText = (promptText: string) => {
    if (!promptText.includes("______")) {
      return <span className="font-bold text-sm text-foreground">{promptText}</span>;
    }
    const parts = promptText.split("______");
    return (
      <span className="font-bold text-sm text-foreground leading-relaxed">
        {parts.map((part, i) => (
          <React.Fragment key={i}>
            {part}
            {i < parts.length - 1 && (
              <span className="inline-flex items-center px-2 py-0.5 mx-1 rounded bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700 font-mono font-bold text-xs tracking-wider shadow-2xs">
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
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-6">
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
            Générez des items d'évaluation supervisés conformes aux standards officiels du TEF.
            Les questions sont strictement persistées en statut <strong>Brouillon</strong> avec
            provenance IA auditable.
          </DialogDescription>
        </DialogHeader>

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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-2">
          {/* LEFT: Generation Parameters (4 cols) */}
          <div className="lg:col-span-4 space-y-4 border-r border-border pr-4 text-xs">
            <div className="font-semibold text-sm flex items-center gap-1.5 text-foreground">
              <Sliders className="h-4 w-4 text-muted-foreground" /> Paramètres d'évaluation
            </div>

            {/* Modality */}
            <div>
              <label className="font-medium text-muted-foreground block mb-1">
                Modalité TEF
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

            {/* CEFR Level */}
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

            {/* Task Type */}
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
                Thématique ou contexte (optionnel)
              </label>
              <Input
                placeholder="Ex. Transition écologique, ateliers de formation, mobilités..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            {/* Stimulus Management Section */}
            <div className="pt-2 border-t border-border space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-foreground flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-purple-600" />
                  Gestion du support / document
                </label>
                {!isSentenceGap && (
                  <button
                    type="button"
                    onClick={() => setShowStimulusStudio(!showStimulusStudio)}
                    className="text-2xs text-purple-600 hover:text-purple-700 font-medium underline"
                  >
                    {showStimulusStudio ? "Masquer studio support" : "Studio support (2 étapes)"}
                  </button>
                )}
              </div>

              {isSentenceGap ? (
                <div className="p-2.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 text-xs">
                  <div className="font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1.5 mb-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-purple-600" />
                    Aucun document externe requis
                  </div>
                  <p className="text-muted-foreground text-2xs leading-relaxed">
                    Pour la tâche <strong>Phrases à trou</strong>, le texte avec l'espace lacunaire
                    (<code>______</code>) est intégré directement à l'énoncé.
                  </p>
                </div>
              ) : (
                <>
                  {persistedStimulusId ? (
                    <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 text-2xs space-y-1">
                      <div className="font-semibold text-emerald-800 dark:text-emerald-200 flex items-center justify-between">
                        <span>Support dédié prêt et rattaché</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPersistedStimulusId(null);
                            setStimulusCandidate(null);
                          }}
                          className="h-5 px-1 text-2xs text-muted-foreground hover:text-rose-600"
                        >
                          Détacher
                        </Button>
                      </div>
                      <p className="text-emerald-700 dark:text-emerald-300 truncate">
                        ID: {persistedStimulusId.slice(0, 12)}...
                      </p>
                    </div>
                  ) : (
                    <div>
                      <select
                        value={stimulusMode}
                        onChange={(e: any) => setStimulusMode(e.target.value)}
                        className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs"
                      >
                        <option value="generate_new">Générer un support en même temps</option>
                        <option value="supplied_text">Fournir le texte de référence</option>
                      </select>

                      {stimulusMode === "supplied_text" && (
                        <div className="mt-2">
                          <Textarea
                            placeholder="Collez ici le document, tableau ou transcription..."
                            value={suppliedStimulusText}
                            onChange={(e) => setSuppliedStimulusText(e.target.value)}
                            className="text-xs h-20"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pre-generation Studio Panel */}
                  {showStimulusStudio && !persistedStimulusId && (
                    <div className="p-2.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/40 dark:bg-purple-950/20 space-y-2 mt-2">
                      <div className="font-semibold text-purple-800 dark:text-purple-300 text-2xs flex items-center justify-between">
                        <span>Studio : Pré-génération de document TEF</span>
                        <Badge variant="outline" className="text-2xs">
                          Étape 1 sur 2
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-2xs">
                        Générez d'abord un support authentique adapté ({currentTaskSpec?.label || "TEF"})
                        puis générez des questions associées.
                      </p>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleGenerateStimulus}
                        disabled={isGeneratingStimulus}
                        className="w-full h-7 text-xs border-purple-300 hover:bg-purple-100 text-purple-700 dark:text-purple-300 gap-1.5"
                      >
                        {isGeneratingStimulus ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        Générer support authentique
                      </Button>

                      {stimulusCandidate && (
                        <div className="p-2 rounded bg-background border border-border space-y-1.5 mt-2">
                          <div className="font-bold text-xs truncate">
                            {stimulusCandidate.title}
                          </div>
                          <div className="text-2xs text-muted-foreground">
                            Format : <strong>{stimulusCandidate.text_format}</strong> • {stimulusCandidate.word_count} mots
                          </div>
                          <Button
                            size="sm"
                            onClick={handlePersistStimulus}
                            disabled={isPersistingStimulus}
                            className="w-full h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1"
                          >
                            {isPersistingStimulus ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                            Enregistrer & lier aux questions
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

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
                  <option value="">Sélection automatique par IA (Multidimensionnel)</option>
                  {skills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Temperature Slider */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-medium text-muted-foreground">
                  Créativité (Température) : {temperature}
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

            {/* Count & Simulation Mode */}
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <div>
                <label className="font-medium text-muted-foreground block">
                  Nombre de candidats
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
                <label className="font-medium text-muted-foreground block">Mode simulation</label>
                <input
                  type="checkbox"
                  checked={forceSimulation}
                  onChange={(e) => setForceSimulation(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded accent-purple-600"
                />
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold mt-4 shadow-sm"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Génération en cours...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Lancer la génération IA
                </>
              )}
            </Button>
          </div>

          {/* RIGHT: Candidate Inspection & Review Workspace (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {candidates.length === 0 ? (
              <div className="h-full min-h-[380px] flex flex-col items-center justify-center border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground">
                <Brain className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <h4 className="font-semibold text-sm text-foreground">Aucun candidat généré</h4>
                <p className="text-xs max-w-sm mt-1">
                  Configurez les paramètres à gauche et cliquez sur "Lancer la génération IA".
                  Les items respecteront les critères officiels de la tâche sélectionnée.
                </p>
                {currentTaskSpec && (
                  <div className="mt-4 p-3 rounded-lg bg-muted/40 border border-border text-2xs max-w-md text-left">
                    <span className="font-bold text-foreground">Exigence pour {currentTaskSpec.label} :</span>
                    <p className="text-muted-foreground mt-0.5">{currentTaskSpec.docDesc}</p>
                  </div>
                )}
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
                        <span>Candidat #{idx + 1}</span>
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
                    {/* Header Badges & Quality Indicators */}
                    <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-border bg-card">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-purple-600 text-white font-bold">
                          {activeCandidate.target_cefr}
                        </Badge>
                        <Badge variant="outline">
                          {activeCandidate.cognitive_complexity}
                        </Badge>
                        <Badge variant="outline">
                          {activeCandidate.response_type}
                        </Badge>
                        {activeCandidate.task_type_code && (
                          <Badge variant="secondary" className="font-mono text-2xs">
                            {activeCandidate.task_type_code}
                          </Badge>
                        )}
                      </div>

                      {/* Duplicate & Validation Badges */}
                      <div className="flex items-center gap-2">
                        {activeCandidate.duplicate_check?.is_duplicate ? (
                          <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Doublon (
                            {Math.round(activeCandidate.duplicate_check.similarity_score * 100)}%)
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

                    {/* Stimulus Section if present */}
                    {activeCandidate.stimulus_content && (
                      <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-2">
                        <div className="font-semibold text-muted-foreground flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <BookOpen className="h-3.5 w-3.5 text-purple-600" /> Support / Document (
                            {activeCandidate.stimulus_title || "Texte d'accompagnement"})
                          </span>
                          {activeCandidate.source_attribution && (
                            <span className="text-2xs text-muted-foreground font-normal italic">
                              Source : {activeCandidate.source_attribution}
                            </span>
                          )}
                        </div>
                        {renderStimulusPreview(activeCandidate.stimulus_content)}
                      </div>
                    )}

                    {/* Question Prompt */}
                    <div className="p-3.5 rounded-lg border border-border bg-card space-y-2">
                      <div className="font-semibold text-muted-foreground">Énoncé de l'item :</div>
                      <div className="text-foreground">
                        {renderPromptText(activeCandidate.prompt)}
                      </div>
                      {activeCandidate.instructions && (
                        <div className="text-muted-foreground italic text-2xs">
                          Consignes : {activeCandidate.instructions}
                        </div>
                      )}
                    </div>

                    {/* Options List (Single Choice / Multiple Choice) */}
                    {activeCandidate.options && activeCandidate.options.length > 0 && (
                      <div className="space-y-2">
                        <div className="font-semibold text-muted-foreground">
                          Options de réponse & Justifications :
                        </div>
                        <div className="space-y-2">
                          {activeCandidate.options.map((opt, oIdx) => (
                            <div
                              key={oIdx}
                              className={`p-2.5 rounded-lg border flex flex-col gap-1 ${
                                opt.is_correct
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100"
                                  : "bg-card border-border text-foreground"
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
                                  {opt.content}
                                </span>
                                {opt.is_correct && (
                                  <Badge className="bg-emerald-600 text-white font-bold text-2xs">
                                    Bonne réponse
                                  </Badge>
                                )}
                              </div>
                              {opt.explanation && (
                                <div className="text-2xs text-muted-foreground pl-7 italic">
                                  Explication : {opt.explanation}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Granular Skills Tagging Preview (Primary & Secondary across dimensions) */}
                    {activeCandidate.skill_mappings && activeCandidate.skill_mappings.length > 0 && (
                      <div className="space-y-1.5 pt-1 border-t border-border">
                        <div className="font-semibold text-muted-foreground">
                          Balises de compétences (Moteur de compétences TEF) :
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {activeCandidate.skill_mappings.map((sk) => {
                            const isPrimary = sk.role === "primary";
                            const weightPct = Math.round(sk.weight * 100);
                            return (
                              <div
                                key={sk.skill_id}
                                className={`px-2 py-1 rounded-md border text-2xs flex items-center gap-1.5 ${
                                  isPrimary
                                    ? "bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300 font-semibold"
                                    : "bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300"
                                }`}
                              >
                                <span className="font-mono">
                                  {sk.skill_code || sk.skill_name || sk.skill_id.slice(0, 8)}
                                </span>
                                <Badge
                                  variant="secondary"
                                  className={`text-3xs px-1 py-0 h-4 ${
                                    isPrimary
                                      ? "bg-purple-600 text-white"
                                      : "bg-indigo-600 text-white"
                                  }`}
                                >
                                  {isPrimary ? "Primaire" : "Secondaire"} ({weightPct}%)
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Second-pass AI Review Report if available */}
                    {activeCandidate.ai_review && (
                      <div className="p-3 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                            <Brain className="h-4 w-4" /> Rapport d'audit IA (2e passe)
                          </span>
                          <span className="text-2xs font-bold text-purple-600">
                            Qualité : {activeCandidate.ai_review.quality_score}/100 • Naturel français :{" "}
                            {activeCandidate.ai_review.naturalness_score}/100
                          </span>
                        </div>
                        {activeCandidate.ai_review.strengths?.length > 0 && (
                          <div className="text-2xs text-foreground/80">
                            <strong>Points forts :</strong> {activeCandidate.ai_review.strengths.join(", ")}
                          </div>
                        )}
                        {activeCandidate.ai_review.suggested_improvements?.length > 0 && (
                          <div className="text-2xs text-purple-800 dark:text-purple-200">
                            <strong>Pistes d'amélioration :</strong>{" "}
                            {activeCandidate.ai_review.suggested_improvements.join(", ")}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions Bar */}
                    <div className="flex items-center justify-between pt-4 border-t border-border">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isAuditingCandidate}
                        onClick={() => handleSecondPassAudit(activeCandidate, selectedCandidateIdx)}
                        className="gap-1.5 text-xs"
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
                          className="text-xs text-muted-foreground hover:text-rose-600"
                        >
                          <X className="h-3.5 w-3.5 mr-1" /> Écarter ce candidat
                        </Button>

                        <Button
                          size="sm"
                          disabled={isSubmittingDraft}
                          onClick={() => handleCreateDraft(activeCandidate)}
                          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
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
      </DialogContent>
    </Dialog>
  );
};
