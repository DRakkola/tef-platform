import React, { useEffect, useState } from "react";
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
} from "../api";
import { fetchTaskTypes } from "../skills/api";
import type { TaskType } from "../skills/types";
import type {
  SkillItem,
  GeneratedQuestionCandidate,
  AIQuestionGenerationRequest,
} from "../types";

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

  // Execution state
  const [isGenerating, setIsGenerating] = useState(false);
  const [candidates, setCandidates] = useState<GeneratedQuestionCandidate[]>([]);
  const [selectedCandidateIdx, setSelectedCandidateIdx] = useState<number>(0);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false);
  const [isAuditingCandidate, setIsAuditingCandidate] = useState(false);

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

  const handleGenerate = async () => {
    setIsGenerating(true);
    setFeedback(null);
    try {
      const payload: AIQuestionGenerationRequest = {
        modality,
        task_type_id: taskTypeId ? taskTypeId : undefined,
        target_cefr: targetCefr,
        cognitive_complexity: cognitiveComplexity,
        topic: topic.trim() || undefined,
        stimulus_mode: stimulusMode,
        supplied_stimulus_text: stimulusMode === "supplied_text" ? suppliedStimulusText : undefined,
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
        text: `${res.candidates.length} candidat(s) généré(s) avec succès (${res.valid_candidates_count} conforme(s) aux règles psychométriques).`,
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
        text: `Audit pédagogique 2e passe complété. Score qualité : ${review.quality_score}/100.`,
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
      // Redirect directly to the workspace for human editing/review
      navigate(`/admin/questions/${q.id}?tab=content`);
      onClose();
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "Échec de création du brouillon à partir du candidat.",
      });
    } finally {
      setIsSubmittingDraft(false);
    }
  };

  const activeCandidate = candidates[selectedCandidateIdx];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-6">
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
            <Badge variant="outline" className="text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30">
              Conformité TEF stricte & Invariants V2
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Générez des items d'évaluation supervisés selon les standards psychométriques TEF.
            Toute génération est obligatoirement persistée en statut <strong>Brouillon</strong> avec traçabilité d'auteur IA complète.
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
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
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
              <label className="font-medium text-muted-foreground block mb-1">Modalité TEF</label>
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
              <label className="font-medium text-muted-foreground block mb-1">Niveau CECRL visé</label>
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
              <label className="font-medium text-muted-foreground block mb-1">Type de tâche TEF</label>
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
            </div>

            {/* Cognitive Complexity */}
            <div>
              <label className="font-medium text-muted-foreground block mb-1">Complexité cognitive</label>
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
                placeholder="Ex. Transition écologique, télétravail..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            {/* Stimulus Mode */}
            <div>
              <label className="font-medium text-muted-foreground block mb-1">Gestion du document / stimulus</label>
              <select
                value={stimulusMode}
                onChange={(e: any) => setStimulusMode(e.target.value)}
                className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs"
              >
                <option value="generate_new">Générer nouveau stimulus par IA</option>
                <option value="supplied_text">Fournir le texte de référence</option>
              </select>
            </div>

            {stimulusMode === "supplied_text" && (
              <div>
                <label className="font-medium text-muted-foreground block mb-1">Texte de référence</label>
                <Textarea
                  placeholder="Collez ici le document ou l'article support..."
                  value={suppliedStimulusText}
                  onChange={(e) => setSuppliedStimulusText(e.target.value)}
                  className="text-xs h-20"
                />
              </div>
            )}

            {/* Target Skill Selection */}
            {skills.length > 0 && (
              <div>
                <label className="font-medium text-muted-foreground block mb-1">Compétence ciblée (optionnel)</label>
                <select
                  value={selectedSkillIds[0] || ""}
                  onChange={(e) => setSelectedSkillIds(e.target.value ? [e.target.value] : [])}
                  className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs"
                >
                  <option value="">Sélection automatique par IA</option>
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
                <label className="font-medium text-muted-foreground">Créativité (Température) : {temperature}</label>
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
                <label className="font-medium text-muted-foreground block">Nombre de candidats</label>
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
              <div className="h-full min-h-[350px] flex flex-col items-center justify-center border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground">
                <Brain className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <h4 className="font-semibold text-sm text-foreground">Aucun candidat généré</h4>
                <p className="text-xs max-w-sm mt-1">
                  Configurez les paramètres psychométriques à gauche et cliquez sur "Lancer la génération IA".
                  Les items passeront automatiquement les filtres de doublons et le moteur de validation.
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
                    {/* Header Badges & Audit findings */}
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
                      </div>

                      {/* Duplicate & Validation Badges */}
                      <div className="flex items-center gap-2">
                        {activeCandidate.duplicate_check?.is_duplicate ? (
                          <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Doublon potentiel ({Math.round(activeCandidate.duplicate_check.similarity_score * 100)}%)
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
                            <AlertTriangle className="h-3 w-3" /> Avertissements ({activeCandidate.validation_report?.issues?.length || 0})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stimulus Section if present */}
                    {activeCandidate.stimulus_content && (
                      <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1.5">
                        <div className="font-semibold text-muted-foreground flex items-center gap-1.5">
                          <BookOpen className="h-3.5 w-3.5" /> Support / Document ({activeCandidate.stimulus_title || "Texte d'accompagnement"})
                        </div>
                        <p className="italic text-foreground/80 leading-relaxed bg-background/50 p-2.5 rounded border border-border">
                          {activeCandidate.stimulus_content}
                        </p>
                      </div>
                    )}

                    {/* Question Prompt */}
                    <div className="p-3.5 rounded-lg border border-border bg-card space-y-2">
                      <div className="font-semibold text-muted-foreground">Énoncé de la question :</div>
                      <div className="font-bold text-sm text-foreground">
                        {activeCandidate.prompt}
                      </div>
                      {activeCandidate.instructions && (
                        <div className="text-muted-foreground italic">
                          Consignes : {activeCandidate.instructions}
                        </div>
                      )}
                    </div>

                    {/* Options List */}
                    <div className="space-y-2">
                      <div className="font-semibold text-muted-foreground">Options de réponse & Distracteurs :</div>
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
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                                  opt.is_correct ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"
                                }`}>
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
                            {opt.distractor_rationale && !opt.is_correct && (
                              <div className="text-2xs text-muted-foreground pl-7 italic">
                                Justification pédagogique : {opt.distractor_rationale}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Skills Competencies */}
                    {activeCandidate.skill_mappings?.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="font-medium text-muted-foreground">Compétences ciblées :</span>
                        {activeCandidate.skill_mappings.map((sk) => (
                          <Badge key={sk.skill_id} variant="secondary" className="text-2xs font-mono">
                            {sk.skill_code || sk.skill_name || sk.skill_id.slice(0, 8)} (poids : {sk.weight})
                          </Badge>
                        ))}
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
                            Qualité : {activeCandidate.ai_review.quality_score}/100 • Naturel français : {activeCandidate.ai_review.naturalness_score}/100
                          </span>
                        </div>
                        {activeCandidate.ai_review.strengths?.length > 0 && (
                          <div className="text-2xs text-foreground/80">
                            <strong>Points forts :</strong> {activeCandidate.ai_review.strengths.join(", ")}
                          </div>
                        )}
                        {activeCandidate.ai_review.suggested_improvements?.length > 0 && (
                          <div className="text-2xs text-purple-800 dark:text-purple-200">
                            <strong>Pistes d'amélioration :</strong> {activeCandidate.ai_review.suggested_improvements.join(", ")}
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
