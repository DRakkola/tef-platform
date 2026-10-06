import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { AdminLayout } from "../AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  fetchSkills,
  fetchGenerationFormats,
  createGenerationJob,
  getGenerationJob,
  reviewQuestionCandidate,
  createDraftFromCandidate,
  generateStimulusCandidate,
  persistStimulusCandidate,
} from "../api";
import type {
  SkillItem,
  TaskFormatCatalogResponse,
  TaskFormatCatalogEntry,
  AIGenerationJobResponse,
  GeneratedQuestionCandidate,
  AIQuestionGenerationRequest,
  AIStimulusCandidate,
} from "../types";
import { StimulusRenderer } from "./components/StimulusRenderer";

type WizardStep = "format" | "stimulus" | "generate" | "review";

const STEPS: Array<{ id: WizardStep; label: string }> = [
  { id: "format", label: "Format TEF" },
  { id: "stimulus", label: "Support documentaire" },
  { id: "generate", label: "Génération asynchrone" },
  { id: "review", label: "Revue & brouillon" },
];

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

const COMPLEXITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "recall_recognition", label: "Rappel / Reconnaissance factuelle" },
  { value: "interpretation", label: "Compréhension / Interprétation" },
  { value: "inferencing_synthesis", label: "Inférence / Déduction / Synthèse" },
  { value: "critical_evaluation", label: "Évaluation critique / Nuance implicite" },
];

const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 400;

type Feedback = { type: "success" | "error" | "info"; text: string } | null;

export const AIGenerationPage: React.FC = () => {
  const navigate = useNavigate();

  // Wizard state
  const [step, setStep] = useState<WizardStep>("format");
  const [catalog, setCatalog] = useState<TaskFormatCatalogResponse | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [feedback, setFeedback] = useState<Feedback>(null);

  // Format parameters (server-driven from the catalogue)
  const [moduleCode, setModuleCode] = useState("reading");
  const [formatCode, setFormatCode] = useState("");
  const [responseType, setResponseType] = useState("");
  const [targetCefr, setTargetCefr] = useState("B2");
  const [cognitiveComplexity, setCognitiveComplexity] = useState("interpretation");
  const [topic, setTopic] = useState("");
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [count, setCount] = useState(1);
  const [temperature, setTemperature] = useState(0.7);
  const [forceSimulation, setForceSimulation] = useState(false);

  // Stimulus studio state
  const [stimulusMode, setStimulusMode] = useState<"generate_new" | "supplied_text">("generate_new");
  const [suppliedStimulusText, setSuppliedStimulusText] = useState("");
  const [isGeneratingStimulus, setIsGeneratingStimulus] = useState(false);
  const [isPersistingStimulus, setIsPersistingStimulus] = useState(false);
  const [stimulusCandidate, setStimulusCandidate] = useState<AIStimulusCandidate | null>(null);
  const [persistedStimulusId, setPersistedStimulusId] = useState<string | null>(null);
  const [isEditingStimulus, setIsEditingStimulus] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [editedSource, setEditedSource] = useState("");

  // Async job state
  const [isSubmittingJob, setIsSubmittingJob] = useState(false);
  const [job, setJob] = useState<AIGenerationJobResponse | null>(null);

  // Review state
  const [candidates, setCandidates] = useState<GeneratedQuestionCandidate[]>([]);
  const [selectedCandidateIdx, setSelectedCandidateIdx] = useState(0);
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false);
  const [isAuditingCandidate, setIsAuditingCandidate] = useState(false);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load the server-driven catalogue and the skill list once.
  useEffect(() => {
    fetchGenerationFormats()
      .then((cat) => {
        setCatalog(cat);
        const fallbackModule = cat.modules[0]?.code || "reading";
        const activeModule = cat.formats.some((f) => f.module === moduleCode)
          ? moduleCode
          : fallbackModule;
        setModuleCode(activeModule);
        if (!formatCode) {
          const first = cat.formats.find((f) => f.module === activeModule);
          if (first) applyFormat(first);
        }
      })
      .catch((err: unknown) => {
        setCatalogError(
          err instanceof Error
            ? err.message
            : "Impossible de charger le catalogue de formats TEF."
        );
      });

    fetchSkills()
      .then((sks) => setSkills(sks.filter((s) => s.is_active)))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeFormat = useMemo(
    () => catalog?.formats.find((f) => f.code === formatCode) || null,
    [catalog, formatCode]
  );
  const moduleFormats = useMemo(
    () => (catalog ? catalog.formats.filter((f) => f.module === moduleCode) : []),
    [catalog, moduleCode]
  );
  const requiresStimulus = activeFormat?.requires_stimulus ?? true;
  const activeCandidate = candidates[selectedCandidateIdx];

  // Selecting a format resets every downstream artefact so a format switch can
  // never leak a stale stimulus or candidate into a different task type.
  const applyFormat = (entry: TaskFormatCatalogEntry) => {
    setFormatCode(entry.code);
    setResponseType(entry.default_response_type);
    setStimulusCandidate(null);
    setPersistedStimulusId(null);
    setStimulusMode("generate_new");
    setSuppliedStimulusText("");
    setIsEditingStimulus(false);
    setCandidates([]);
    setSelectedCandidateIdx(0);
    setJob(null);
    setFeedback(null);
  };

  const handleModuleChange = (code: string) => {
    setModuleCode(code);
    const first = catalog?.formats.find((f) => f.module === code);
    if (first) applyFormat(first);
    setStep("format");
  };

  const handleFormatChange = (code: string) => {
    const entry = catalog?.formats.find((f) => f.code === code);
    if (!entry) return;
    applyFormat(entry);
    setStep("format");
  };

  // -------------------------------------------------------------------------
  // Stimulus studio
  // -------------------------------------------------------------------------

  const handleGenerateStimulus = async () => {
    if (!activeFormat) return;
    setIsGeneratingStimulus(true);
    setFeedback(null);
    try {
      const res = await generateStimulusCandidate({
        modality: activeFormat.module,
        task_type_code: activeFormat.code,
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
        text: `Support "${res.title}" généré. Retouchez-le ou continuez directement.`,
      });
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Échec de génération du support.",
      });
    } finally {
      setIsGeneratingStimulus(false);
    }
  };

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
    setFeedback({ type: "info", text: "Modifications du support appliquées." });
  };

  const handlePersistStimulus = async () => {
    if (!stimulusCandidate) return;
    setIsPersistingStimulus(true);
    setFeedback(null);
    try {
      const persisted = await persistStimulusCandidate(stimulusCandidate);
      setPersistedStimulusId(persisted.id);
      setFeedback({
        type: "success",
        text: `Support "${persisted.title}" enregistré et rattaché.`,
      });
      setStep("generate");
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Erreur lors de l'enregistrement du support.",
      });
    } finally {
      setIsPersistingStimulus(false);
    }
  };

  // -------------------------------------------------------------------------
  // Async generation job
  // -------------------------------------------------------------------------

  const buildPayload = (): AIQuestionGenerationRequest => ({
    modality: activeFormat?.module,
    task_type_code: activeFormat?.code,
    response_type: responseType || undefined,
    target_cefr: targetCefr,
    cognitive_complexity: cognitiveComplexity,
    topic: topic.trim() || undefined,
    stimulus_mode: !requiresStimulus
      ? "none"
      : persistedStimulusId
      ? "existing_stimulus"
      : stimulusCandidate?.content_text
      ? "supplied_text"
      : stimulusMode,
    stimulus_id: requiresStimulus && persistedStimulusId ? persistedStimulusId : undefined,
    supplied_stimulus_text: !requiresStimulus || persistedStimulusId
      ? undefined
      : stimulusCandidate?.content_text
      ? stimulusCandidate.content_text
      : stimulusMode === "supplied_text"
      ? suppliedStimulusText
      : undefined,
    target_skill_ids: selectedSkillIds.length > 0 ? selectedSkillIds : undefined,
    count,
    temperature,
    force_simulation: forceSimulation,
  });

  const handleGenerateQuestions = async () => {
    if (!activeFormat) return;
    setIsSubmittingJob(true);
    setJob(null);
    setFeedback(null);
    try {
      const created = await createGenerationJob(buildPayload());
      let current = created.job;
      setJob(current);

      let attempts = 0;
      while (
        !current.is_terminal &&
        isMountedRef.current &&
        attempts < MAX_POLL_ATTEMPTS
      ) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        if (!isMountedRef.current) return;
        attempts += 1;
        current = await getGenerationJob(current.id);
        if (!isMountedRef.current) return;
        setJob(current);
      }

      if (!isMountedRef.current) return;
      if (!current.is_terminal) {
        setFeedback({
          type: "error",
          text: "La tâche de génération prend trop de temps. Rechargez la page pour consulter son état.",
        });
        return;
      }
      if (current.status !== "succeeded" || !current.result) {
        setFeedback({
          type: "error",
          text:
            current.error_message ||
            "La tâche de génération a échoué. Vérifiez les paramètres et relancez.",
        });
        return;
      }

      setCandidates(current.result.candidates);
      setSelectedCandidateIdx(0);
      setStep("review");
      setFeedback({
        type: "success",
        text: `${current.result.candidates.length} candidat(s) généré(s) — ${current.result.valid_candidates_count} conforme(s) aux règles V2.`,
      });
    } catch (err: unknown) {
      if (isMountedRef.current) {
        setFeedback({
          type: "error",
          text: err instanceof Error ? err.message : "Erreur lors de la génération par IA.",
        });
      }
    } finally {
      if (isMountedRef.current) setIsSubmittingJob(false);
    }
  };

  // -------------------------------------------------------------------------
  // Review actions
  // -------------------------------------------------------------------------

  const handleSecondPassAudit = async (cand: GeneratedQuestionCandidate, idx: number) => {
    setIsAuditingCandidate(true);
    setFeedback(null);
    try {
      const review = await reviewQuestionCandidate({
        candidate: cand,
        force_simulation: forceSimulation,
      });
      const updated = [...candidates];
      updated[idx] = { ...cand, ai_review: review };
      setCandidates(updated);
      setFeedback({
        type: "success",
        text: `Audit pédagogique complété. Score qualité : ${review.quality_score}/100.`,
      });
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Échec de l'audit 2e passe.",
      });
    } finally {
      setIsAuditingCandidate(false);
    }
  };

  const handleDismissCandidate = (idx: number) => {
    const updated = candidates.filter((_, i) => i !== idx);
    setCandidates(updated);
    setSelectedCandidateIdx(0);
    if (updated.length === 0) setStep("generate");
  };

  const handleCreateDraft = async (cand: GeneratedQuestionCandidate) => {
    setIsSubmittingDraft(true);
    setFeedback(null);
    try {
      const q = await createDraftFromCandidate({ candidate: cand });
      setFeedback({
        type: "success",
        text: `Brouillon #${q.id.slice(0, 8)} créé avec succès.`,
      });
      navigate(`/admin/questions/${q.id}?tab=content`);
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Échec de création du brouillon.",
      });
    } finally {
      setIsSubmittingDraft(false);
    }
  };

  // Derive the active document key when the prompt references Document A-D.
  const detectedActiveDocKey = useMemo(() => {
    if (!activeCandidate) return null;
    const combinedText = `${activeCandidate.prompt} ${activeCandidate.options
      .map((o) => o.content)
      .join(" ")}`;
    const match = combinedText.match(/Document\s+([A-D])/i);
    return match ? `Document ${match[1].toUpperCase()}` : null;
  }, [activeCandidate]);

  // Highlight lacunar blanks in prompts.
  const renderPromptText = (promptText: string) => {
    if (!promptText.includes("______")) {
      return (
        <span className="font-bold text-sm text-foreground leading-relaxed">{promptText}</span>
      );
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

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const visibleSteps = STEPS.filter((s) => s.id !== "stimulus" || requiresStimulus);

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <span className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Sparkles className="h-5 w-5" />
              </span>
              Générateur de questions par IA
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Assistant en 4 étapes, piloté par le catalogue officiel des formats TEF. Tout contenu
              généré est persisté en statut <strong>Brouillon</strong> avec provenance IA.
            </p>
          </div>
          <Link to="/admin/questions">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Retour à la banque
            </Button>
          </Link>
        </div>

        {/* Wizard stepper */}
        <div className="flex flex-wrap items-center gap-2 border border-border rounded-xl bg-card p-3">
          {visibleSteps.map((s, idx) => {
            const isActive = s.id === step;
            const isDone =
              !isActive && visibleSteps.findIndex((x) => x.id === step) > idx;
            return (
              <React.Fragment key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (s.id === "stimulus" && !requiresStimulus) return;
                    if (idx > stepIndex) return;
                    setStep(s.id);
                  }}
                  disabled={idx > stepIndex}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-2 text-xs disabled:cursor-not-allowed ${
                    isActive
                      ? "bg-purple-600 text-white shadow-xs"
                      : isDone
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                      : "bg-muted/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-2xs font-bold">
                    {isDone ? <Check className="h-3 w-3" /> : idx + 1}
                  </span>
                  <span>{s.label}</span>
                </button>
                {idx < visibleSteps.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground/60" />
                )}
              </React.Fragment>
            );
          })}

          {persistedStimulusId && (
            <span className="ml-auto font-mono text-2xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
              Support lié : #{persistedStimulusId.slice(0, 8)}
            </span>
          )}
        </div>

        {/* Feedback banner */}
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
              type="button"
              onClick={() => setFeedback(null)}
              className="text-muted-foreground hover:text-foreground font-semibold px-1"
            >
              ✕
            </button>
          </div>
        )}

        {catalogError && (
          <div className="p-3 rounded-lg text-xs bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {catalogError}
          </div>
        )}

        {/* ===================================================================== */}
        {/* STEP 1 — FORMAT (server-driven catalogue)                             */}
        {/* ===================================================================== */}
        {step === "format" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-4 border-r border-border pr-4 text-xs">
              <div className="font-semibold text-sm flex items-center gap-1.5 text-foreground">
                <Layers className="h-4 w-4 text-purple-600" /> Paramètres du format
              </div>

              <div>
                <label className="font-medium text-muted-foreground block mb-1">Module</label>
                <select
                  value={moduleCode}
                  onChange={(e) => handleModuleChange(e.target.value)}
                  className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs"
                >
                  {(catalog?.modules || []).map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-medium text-muted-foreground block mb-1">
                  Type de tâche TEF
                </label>
                <select
                  value={formatCode}
                  onChange={(e) => handleFormatChange(e.target.value)}
                  className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs"
                >
                  {moduleFormats.map((f) => (
                    <option key={f.code} value={f.code}>
                      {f.name}
                    </option>
                  ))}
                </select>
                {activeFormat && (
                  <p className="text-2xs text-muted-foreground mt-1 leading-snug">
                    {activeFormat.admin_hint}
                  </p>
                )}
              </div>

              <div>
                <label className="font-medium text-muted-foreground block mb-1">
                  Nature de la réponse
                </label>
                <select
                  value={responseType}
                  onChange={(e) => setResponseType(e.target.value)}
                  className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs"
                >
                  {(activeFormat?.allowed_response_types || []).map((rt) => (
                    <option key={rt} value={rt}>
                      {rt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-medium text-muted-foreground block mb-1">
                  Niveau CECRL visé
                </label>
                <div className="grid grid-cols-6 gap-1">
                  {CEFR_LEVELS.map((lvl) => (
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

              <Button
                onClick={() => setStep(requiresStimulus ? "stimulus" : "generate")}
                disabled={!activeFormat}
                className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs h-9"
              >
                Continuer <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="lg:col-span-8 space-y-4 text-xs">
              {!activeFormat ? (
                <div className="h-full min-h-[320px] flex flex-col items-center justify-center border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mb-3" />
                  <p>Chargement du catalogue de formats…</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-purple-600 text-white font-bold text-2xs">
                        {activeFormat.module_label}
                      </Badge>
                      <Badge variant="outline" className="text-2xs">
                        {activeFormat.stimulus_kind_label}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-2xs ${
                          requiresStimulus
                            ? "text-amber-600 border-amber-500/40"
                            : "text-emerald-600 border-emerald-500/40"
                        }`}
                      >
                        {requiresStimulus ? "Support requis" : "Sans support externe"}
                      </Badge>
                    </div>
                    <h3 className="font-bold text-base text-foreground">{activeFormat.name}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {activeFormat.admin_hint}
                    </p>
                    <p className="text-2xs text-muted-foreground italic border-t border-border/40 pt-2">
                      {activeFormat.prompt_guidance}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="p-2.5 rounded-lg bg-muted/40 border border-border">
                      <div className="text-2xs text-muted-foreground">Code format</div>
                      <div className="font-mono font-semibold text-xs">{activeFormat.code}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/40 border border-border">
                      <div className="text-2xs text-muted-foreground">Réponses acceptées</div>
                      <div className="font-semibold text-xs">
                        {activeFormat.allowed_response_types.length}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/40 border border-border">
                      <div className="text-2xs text-muted-foreground">Options</div>
                      <div className="font-semibold text-xs">
                        {activeFormat.option_count_min > 0
                          ? `${activeFormat.option_count_min}–${activeFormat.option_count_max}`
                          : "—"}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/40 border border-border">
                      <div className="text-2xs text-muted-foreground">Support</div>
                      <div className="font-semibold text-xs capitalize">
                        {activeFormat.stimulus_kind}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 text-2xs text-purple-800 dark:text-purple-200 flex items-start gap-2">
                    <Brain className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      La génération est exécutée en tâche de fond (Celery) : vous soumettez une
                      tâche puis suivez son avancement en temps réel à l'étape suivante. Seuls des
                      brouillons sont créés — rien n'est publié automatiquement.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* STEP 2 — STIMULUS STUDIO (only when the format requires a document)  */}
        {/* ===================================================================== */}
        {step === "stimulus" && requiresStimulus && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-4 border-r border-border pr-4 text-xs">
              <div className="font-semibold text-sm flex items-center gap-1.5 text-foreground">
                <BookOpen className="h-4 w-4 text-purple-600" /> Support documentaire
              </div>

              <div>
                <label className="font-medium text-muted-foreground block mb-1">
                  Origine du support
                </label>
                <select
                  value={stimulusMode}
                  onChange={(e) => setStimulusMode(e.target.value as "generate_new" | "supplied_text")}
                  disabled={!!persistedStimulusId}
                  className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs disabled:opacity-60"
                >
                  <option value="generate_new">Générer un support par IA</option>
                  <option value="supplied_text">Coller un texte de référence</option>
                </select>
                {stimulusMode === "supplied_text" && !persistedStimulusId && (
                  <Textarea
                    placeholder="Collez ici le support documentaire…"
                    value={suppliedStimulusText}
                    onChange={(e) => setSuppliedStimulusText(e.target.value)}
                    className="text-xs h-24 mt-1.5"
                  />
                )}
              </div>

              <div>
                <label className="font-medium text-muted-foreground block mb-1">
                  Thématique ou contexte ciblé (optionnel)
                </label>
                <Input
                  placeholder="Ex. Formation professionnelle, transition écologique…"
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

              {stimulusMode === "generate_new" && (
                <Button
                  onClick={handleGenerateStimulus}
                  disabled={isGeneratingStimulus}
                  className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs h-9"
                >
                  {isGeneratingStimulus ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Génération du support…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" /> Générer le support par IA
                    </>
                  )}
                </Button>
              )}

              <div className="pt-2 border-t border-border space-y-2">
                <Button
                  variant="outline"
                  onClick={() => setStep("format")}
                  className="w-full gap-2 text-xs h-8"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Retour au format
                </Button>
                <Button
                  onClick={() => setStep("generate")}
                  disabled={
                    stimulusMode === "supplied_text" &&
                    !suppliedStimulusText.trim() &&
                    !stimulusCandidate &&
                    !persistedStimulusId
                  }
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8"
                >
                  Passer à la génération <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-4">
              {!stimulusCandidate && (
                <div className="h-full min-h-[360px] flex flex-col items-center justify-center border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground">
                  <Layers className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <h4 className="font-semibold text-sm text-foreground">
                    Aucun support généré pour l'instant
                  </h4>
                  <p className="text-xs max-w-md mt-1">
                    Choisissez l'origine du support à gauche, puis lancez la génération. Le rendu
                    officiel (onglets A/B/C/D, tableau ou audio) s'affichera ici.
                  </p>
                </div>
              )}

              {stimulusCandidate && (
                <div className="space-y-4">
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
                        className="h-7 text-xs gap-1"
                      >
                        <Edit3 className="h-3 w-3" />
                        {isEditingStimulus ? "Fermer l'éditeur" : "Retoucher le texte"}
                      </Button>
                      <Button
                        size="sm"
                        onClick={handlePersistStimulus}
                        disabled={isPersistingStimulus}
                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5"
                      >
                        {isPersistingStimulus ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        Enregistrer & continuer
                      </Button>
                    </div>
                  </div>

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
                          <Save className="h-3 w-3" /> Appliquer les modifications
                        </Button>
                      </div>
                    </div>
                  ) : (
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

        {/* ===================================================================== */}
        {/* STEP 3 — ASYNC GENERATION                                             */}
        {/* ===================================================================== */}
        {step === "generate" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-4 border-r border-border pr-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm flex items-center gap-1.5 text-foreground">
                  <Sliders className="h-4 w-4 text-purple-600" /> Paramètres d'évaluation
                </span>
                {requiresStimulus && (
                  <button
                    type="button"
                    onClick={() => setStep("stimulus")}
                    className="text-3xs text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-1"
                  >
                    <ArrowLeft className="h-3 w-3" /> Support
                  </button>
                )}
              </div>

              <div className="p-2.5 rounded-lg bg-muted/40 border border-border space-y-1">
                <div className="flex items-center justify-between text-2xs">
                  <span className="text-muted-foreground">Format :</span>
                  <span className="font-bold text-foreground">{activeFormat?.name}</span>
                </div>
                <div className="flex items-center justify-between text-2xs">
                  <span className="text-muted-foreground">Réponse :</span>
                  <span className="font-mono font-semibold">{responseType || "—"}</span>
                </div>
                <div className="flex items-center justify-between text-2xs">
                  <span className="text-muted-foreground">Niveau :</span>
                  <Badge className="bg-purple-600 text-white font-bold text-3xs h-4">
                    {targetCefr}
                  </Badge>
                </div>
              </div>

              <div>
                <label className="font-medium text-muted-foreground block mb-1">
                  Complexité cognitive
                </label>
                <select
                  value={cognitiveComplexity}
                  onChange={(e) => setCognitiveComplexity(e.target.value)}
                  className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs"
                >
                  {COMPLEXITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-medium text-muted-foreground block mb-1">
                  Thématique (optionnel)
                </label>
                <Input
                  placeholder="Ex. Mobilités douces, formation…"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              {requiresStimulus && !persistedStimulusId && (
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-2xs text-amber-700 dark:text-amber-300">
                  Aucun support enregistré : la génération partira sans support rattaché (le serveur
                  fabriquera ou utilisera le texte fourni selon le mode choisi).
                </div>
              )}

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

              <div>
                <label className="font-medium text-muted-foreground block mb-1">
                  Créativité : {temperature}
                </label>
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

              <div className="pt-2 border-t border-border flex items-center justify-between">
                <div>
                  <label className="font-medium text-muted-foreground block">Nombre d'items</label>
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
                disabled={isSubmittingJob}
                className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs h-9"
              >
                {isSubmittingJob ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Génération en cours…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Lancer la génération asynchrone
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={() => setStep(requiresStimulus ? "stimulus" : "format")}
                disabled={isSubmittingJob}
                className="w-full gap-2 text-xs h-8"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Retour
              </Button>
            </div>

            <div className="lg:col-span-8 space-y-4">
              {!job ? (
                <div className="h-full min-h-[380px] flex flex-col items-center justify-center border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground">
                  <Brain className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <h4 className="font-semibold text-sm text-foreground">Aucune tâche lancée</h4>
                  <p className="text-xs max-w-sm mt-1">
                    Configurez les paramètres à gauche puis lancez la génération. La tâche s'exécute
                    en arrière-plan et son état est interrogé automatiquement.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`p-1.5 rounded-lg ${
                            job.status === "succeeded"
                              ? "bg-emerald-500/10 text-emerald-600"
                              : job.status === "failed"
                              ? "bg-rose-500/10 text-rose-600"
                              : "bg-purple-500/10 text-purple-600"
                          }`}
                        >
                          {job.status === "succeeded" ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : job.status === "failed" ? (
                            <AlertTriangle className="h-4 w-4" />
                          ) : (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                        </span>
                        <div>
                          <div className="text-xs font-semibold">
                            Tâche #{job.id.slice(0, 8)} — {job.status}
                          </div>
                          <div className="text-2xs text-muted-foreground font-mono">
                            {job.modality} / {job.task_type_code || "—"} / {job.target_cefr} —{" "}
                            {job.requested_count} item(s) demandé(s)
                          </div>
                        </div>
                      </div>
                      {!job.is_terminal && (
                        <span className="text-2xs text-muted-foreground animate-pulse">
                          Interrogation du serveur toutes les {POLL_INTERVAL_MS / 1000}s…
                        </span>
                      )}
                    </div>

                    {job.status === "failed" && job.error_message && (
                      <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-2xs text-rose-700 dark:text-rose-300">
                        {job.error_message}
                      </div>
                    )}

                    {job.result && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                        <div className="p-2 rounded bg-muted/40 border border-border">
                          <div className="text-2xs text-muted-foreground">Générés</div>
                          <div className="font-bold text-xs">
                            {job.result.total_generated}/{job.result.total_requested}
                          </div>
                        </div>
                        <div className="p-2 rounded bg-muted/40 border border-border">
                          <div className="text-2xs text-muted-foreground">Conformes</div>
                          <div className="font-bold text-xs text-emerald-600">
                            {job.result.valid_candidates_count}
                          </div>
                        </div>
                        <div className="p-2 rounded bg-muted/40 border border-border">
                          <div className="text-2xs text-muted-foreground">Non conformes</div>
                          <div className="font-bold text-xs text-amber-600">
                            {job.result.invalid_candidates_count}
                          </div>
                        </div>
                        <div className="p-2 rounded bg-muted/40 border border-border">
                          <div className="text-2xs text-muted-foreground">Durée</div>
                          <div className="font-bold text-xs">
                            {(job.result.generation_time_ms / 1000).toFixed(1)}s
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 text-2xs text-purple-800 dark:text-purple-200 flex items-start gap-2">
                    <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      {job.result?.summary ||
                        "La tâche est exécutée par un worker Celery. Aucun secret n'est stocké avec la tâche et les erreurs internes ne sont jamais exposées au client."}
                    </span>
                  </div>

                  {job.status === "succeeded" && candidates.length > 0 && (
                    <Button
                      onClick={() => setStep("review")}
                      className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9"
                    >
                      Ouvrir la revue des candidats <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* STEP 4 — REVIEW (split-screen exam preview)                           */}
        {/* ===================================================================== */}
        {step === "review" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-4 border-r border-border pr-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm flex items-center gap-1.5 text-foreground">
                  <Sliders className="h-4 w-4 text-purple-600" /> Revue des candidats
                </span>
                <button
                  type="button"
                  onClick={() => setStep("generate")}
                  className="text-3xs text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3" /> Paramètres
                </button>
              </div>

              <div className="p-2.5 rounded-lg bg-muted/40 border border-border space-y-1">
                <div className="flex items-center justify-between text-2xs">
                  <span className="text-muted-foreground">Format :</span>
                  <span className="font-bold text-foreground">{activeFormat?.name}</span>
                </div>
                <div className="flex items-center justify-between text-2xs">
                  <span className="text-muted-foreground">Niveau :</span>
                  <Badge className="bg-purple-600 text-white font-bold text-3xs h-4">
                    {targetCefr}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-2xs">
                  <span className="text-muted-foreground">Tâche :</span>
                  <span className="font-mono">{job ? `#${job.id.slice(0, 8)}` : "—"}</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border border-border text-2xs text-muted-foreground leading-relaxed">
                Relancez la génération pour produire de nouveaux candidats, ou créez directement un
                brouillon éditable dans l'atelier de questions.
              </div>

              <Button
                onClick={() => setStep("generate")}
                variant="outline"
                className="w-full gap-2 text-xs h-8"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Régénérer
              </Button>
            </div>

            <div className="lg:col-span-8 space-y-4">
              {candidates.length === 0 ? (
                <div className="h-full min-h-[380px] flex flex-col items-center justify-center border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground">
                  <Brain className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <h4 className="font-semibold text-sm text-foreground">Aucune question générée</h4>
                  <p className="text-xs max-w-sm mt-1">
                    Relancez la génération. Les candidats apparaîtront en écran partagé avec le
                    support à gauche et l'item avec ses distracteurs à droite.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 text-xs">
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
                    <div className="space-y-4">
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
                              <AlertTriangle className="h-3 w-3" /> Doublon (
                              {Math.round(activeCandidate.duplicate_check.similarity_score * 100)}
                              %)
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

                      <div
                        className={`grid gap-4 ${
                          activeCandidate.stimulus_content
                            ? "grid-cols-1 md:grid-cols-12"
                            : "grid-cols-1"
                        }`}
                      >
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

                        <div
                          className={`${
                            activeCandidate.stimulus_content ? "md:col-span-7" : "col-span-1"
                          } space-y-3`}
                        >
                          <div className="p-3.5 rounded-xl border border-border bg-card shadow-2xs space-y-1.5">
                            <div className="font-semibold text-2xs text-muted-foreground uppercase tracking-wider">
                              Énoncé de la question :
                            </div>
                            <div>{renderPromptText(activeCandidate.prompt)}</div>
                            {activeCandidate.instructions && (
                              <div className="text-muted-foreground italic text-2xs pt-1 border-t border-border/40">
                                {activeCandidate.instructions}
                              </div>
                            )}
                          </div>

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

                          {activeCandidate.skill_mappings &&
                            activeCandidate.skill_mappings.length > 0 && (
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
                                          {sk.skill_code ||
                                            sk.skill_name ||
                                            sk.skill_id.slice(0, 8)}
                                        </span>
                                        <span
                                          className={`px-1 py-0 rounded text-3xs font-extrabold ${
                                            isPrimary
                                              ? "bg-purple-600 text-white"
                                              : "bg-blue-600 text-white"
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

                          {activeCandidate.ai_review && (
                            <div className="p-3 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 space-y-1.5">
                              <div className="flex items-center justify-between text-2xs font-bold text-purple-700 dark:text-purple-300">
                                <span className="flex items-center gap-1">
                                  <Brain className="h-3.5 w-3.5" /> Rapport d'audit IA (2e passe)
                                </span>
                                <span>
                                  Qualité : {activeCandidate.ai_review.quality_score}/100 •
                                  Naturel : {activeCandidate.ai_review.naturalness_score}/100
                                </span>
                              </div>
                              {activeCandidate.ai_review.strengths?.length > 0 && (
                                <p className="text-3xs text-foreground/80">
                                  <strong>Forces :</strong>{" "}
                                  {activeCandidate.ai_review.strengths.join(", ")}
                                </p>
                              )}
                              {activeCandidate.ai_review.suggested_improvements?.length > 0 && (
                                <p className="text-3xs text-purple-800 dark:text-purple-200">
                                  <strong>Pistes :</strong>{" "}
                                  {activeCandidate.ai_review.suggested_improvements.join(", ")}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-border">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isAuditingCandidate}
                          onClick={() =>
                            handleSecondPassAudit(activeCandidate, selectedCandidateIdx)
                          }
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
                            onClick={() => handleDismissCandidate(selectedCandidateIdx)}
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
      </div>
    </AdminLayout>
  );
};
