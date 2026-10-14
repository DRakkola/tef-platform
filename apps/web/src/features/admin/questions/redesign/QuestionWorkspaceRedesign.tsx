import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  FileEdit,
  UserCheck,
  Award,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { AdminLayout } from "../../AdminLayout";
import { QuestionWorkspaceActionBar } from "./QuestionWorkspaceActionBar";
import { QuestionMainEditorTab } from "./QuestionMainEditorTab";
import { QuestionStudentSimulatorTab } from "./QuestionStudentSimulatorTab";
import { QuestionMetadataQualityTab } from "./QuestionMetadataQualityTab";
import {
  getQuestion,
  createQuestion,
  updateQuestion,
  validateQuestion,
  submitQuestionForReview,
  approveQuestion,
  rejectQuestion,
  publishQuestion,
  createDraftVersion,
} from "@/features/admin/api";
import { Button } from "@/components/ui/button";
import type {
  QuestionItem,
  ContentStatus,
  CognitiveComplexityLevel,
  QuestionValidationResult,
} from "../../types";

interface QuestionWorkspaceRedesignProps {
  mode: "create" | "edit";
}

const DEFAULT_NEW_QUESTION: Partial<QuestionItem> = {
  question_type: "single_choice",
  prompt: "",
  target_cefr: "B1",
  level: "B1",
  difficulty: 3,
  item_difficulty: 3,
  cognitive_complexity: "understand",
  points: 1,
  penalty_points: 0,
  status: "draft",
  version: 1,
  options: [
    { content: "Option A", is_correct: true, order_index: 0, explanation: "" },
    { content: "Option B", is_correct: false, order_index: 1, explanation: "" },
    { content: "Option C", is_correct: false, order_index: 2, explanation: "" },
    { content: "Option D", is_correct: false, order_index: 3, explanation: "" },
  ],
  skill_tags: [],
};

export const QuestionWorkspaceRedesign: React.FC<QuestionWorkspaceRedesignProps> = ({ mode }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Normalize legacy tab names (e.g. "content" -> "editor")
  const rawTab = searchParams.get("tab");
  const normalizedTab = (rawTab === "content" ? "editor" : rawTab) || "editor";
  const activeTab = ["editor", "simulator", "metadata"].includes(normalizedTab)
    ? normalizedTab
    : "editor";

  const [question, setQuestion] = useState<Partial<QuestionItem>>(DEFAULT_NEW_QUESTION);
  const [originalQuestion, setOriginalQuestion] = useState<Partial<QuestionItem>>(DEFAULT_NEW_QUESTION);
  const [isLoading, setIsLoading] = useState(mode === "edit");
  const [isSaving, setIsSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [validationReport, setValidationReport] = useState<QuestionValidationResult | null>(null);
  const [isValidationPanelOpen, setIsValidationPanelOpen] = useState(false);

  useEffect(() => {
    if (mode === "edit" && id) {
      loadQuestion(id);
    } else {
      setQuestion(DEFAULT_NEW_QUESTION);
      setOriginalQuestion(DEFAULT_NEW_QUESTION);
      setIsLoading(false);
    }
  }, [mode, id]);

  const loadQuestion = async (qId: string) => {
    setIsLoading(true);
    try {
      const data = await getQuestion(qId);
      setQuestion(data);
      setOriginalQuestion(data);
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Impossible de charger la question." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = (tabKey: string) => {
    setSearchParams({ tab: tabKey });
  };

  const handlePatch = (patch: Partial<QuestionItem>) => {
    setQuestion((prev) => ({ ...prev, ...patch }));
  };

  const isDirty = JSON.stringify(question) !== JSON.stringify(originalQuestion);

  // SAVE ACTION
  const handleSave = async () => {
    if (!question.prompt?.trim()) {
      setAlertMsg({ type: "error", text: "Veuillez renseigner l'énoncé de la question." });
      handleTabChange("editor");
      return;
    }

    setIsSaving(true);
    setAlertMsg(null);
    try {
      if (mode === "create" || !question.id) {
        const created = await createQuestion({
          prompt: question.prompt.trim(),
          question_type: question.question_type || "single_choice",
          response_type: question.response_type,
          stimulus_id: question.stimulus_id || undefined,
          stimulus_text: question.stimulus_text || undefined,
          audio_url: question.audio_url || undefined,
          media_url: question.media_url || undefined,
          target_cefr: question.target_cefr || question.level || "B1",
          level: question.target_cefr || question.level || "B1",
          item_difficulty: question.difficulty ?? 3,
          difficulty: question.difficulty ?? 3,
          cognitive_complexity: (question.cognitive_complexity as CognitiveComplexityLevel) || "understand",
          task_type_id: question.task_type_id || undefined,
          explanation: question.explanation || undefined,
          points: question.points ?? 1,
          penalty_points: question.penalty_points ?? 0,
          options: question.options,
          skill_tags: question.skill_tags?.map((t) => ({
            skill_id: t.skill_id,
            role: t.role || "primary",
            weight: t.weight || 1.0,
          })),
          scoring_payload: question.scoring_payload,
        });
        setAlertMsg({ type: "success", text: "Question créée avec succès en brouillon." });
        navigate(`/admin/questions/${created.id}?tab=editor`, { replace: true });
      } else {
        const updated = await updateQuestion(question.id, {
          prompt: question.prompt.trim(),
          question_type: question.question_type,
          response_type: question.response_type,
          stimulus_id: question.stimulus_id,
          stimulus_text: question.stimulus_text,
          audio_url: question.audio_url,
          media_url: question.media_url,
          target_cefr: question.target_cefr || question.level,
          level: question.target_cefr || question.level,
          item_difficulty: question.difficulty,
          difficulty: question.difficulty,
          cognitive_complexity: question.cognitive_complexity as CognitiveComplexityLevel,
          task_type_id: question.task_type_id,
          explanation: question.explanation,
          points: question.points,
          penalty_points: question.penalty_points,
          options: question.options,
          skill_tags: question.skill_tags,
          scoring_payload: question.scoring_payload,
          status: question.status as ContentStatus,
          expected_version: question.version,
        });
        setQuestion(updated);
        setOriginalQuestion(updated);
        setAlertMsg({ type: "success", text: "Modifications enregistrées avec succès." });
      }
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Erreur lors de l'enregistrement." });
    } finally {
      setIsSaving(false);
    }
  };

  // VALIDATE ACTION
  const handleValidate = async () => {
    if (!question.id) return;
    setIsValidating(true);
    setAlertMsg(null);
    try {
      const res = await validateQuestion(question.id);
      setValidationReport(res);
      if (res.is_valid) {
        setAlertMsg({
          type: "success",
          text: "Contrôle de conformité TEF : la question satisfait 100% des exigences didactiques.",
        });
        setIsValidationPanelOpen(false);
      } else {
        const blkCount = res.errors?.length || 0;
        const wrnCount = res.warnings?.length || 0;
        setAlertMsg({
          type: "error",
          text: `Audit qualité : ${blkCount} anomalie(s) bloquante(s), ${wrnCount} avertissement(s).`,
        });
        setIsValidationPanelOpen(true);
      }
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Échec de l'audit qualité." });
    } finally {
      setIsValidating(false);
    }
  };

  // LIFECYCLE WORKFLOW ACTIONS
  const handleSubmitReview = async () => {
    if (!question.id) return;
    setIsSaving(true);
    try {
      const updated = await submitQuestionForReview(question.id);
      setQuestion(updated);
      setOriginalQuestion(updated);
      setAlertMsg({ type: "success", text: "Question soumise pour révision éditoriale avec succès." });
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Impossible de soumettre pour révision." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!question.id) return;
    setIsSaving(true);
    try {
      const updated = await approveQuestion(question.id);
      setQuestion(updated);
      setOriginalQuestion(updated);
      setAlertMsg({ type: "success", text: "Question validée et approuvée avec succès." });
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Impossible d'approuver la question." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = async () => {
    if (!question.id) return;
    setIsSaving(true);
    try {
      const updated = await rejectQuestion(question.id, "Modifications didactiques requises");
      setQuestion(updated);
      setOriginalQuestion(updated);
      setAlertMsg({ type: "success", text: "Question renvoyée à l'auteur pour modifications." });
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Impossible de rejeter la question." });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!question.id) return;
    setIsSaving(true);
    try {
      const updated = await publishQuestion(question.id);
      setQuestion(updated);
      setOriginalQuestion(updated);
      setAlertMsg({ type: "success", text: "Question publiée dans la banque d'évaluation officielle." });
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Impossible de publier la question." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateDraftVersion = async () => {
    if (!question.id) return;
    setIsSaving(true);
    try {
      const newDraft = await createDraftVersion(question.id);
      setAlertMsg({ type: "success", text: `Nouvelle version brouillon v${newDraft.version} créée.` });
      navigate(`/admin/questions/${newDraft.id}?tab=editor`);
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Impossible de créer une version brouillon." });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="py-24 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Chargement de l'atelier d'édition...
        </div>
      </AdminLayout>
    );
  }

  const isReadOnly = question.status === "published" || question.status === "archived";

  const tabsConfig = [
    { key: "editor", label: "Éditeur Principal", icon: FileEdit },
    { key: "simulator", label: "Aperçu Candidat & Correction", icon: UserCheck },
    { key: "metadata", label: "Métadonnées, Compétences & Qualité", icon: Award },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-6xl mx-auto pb-16">
        {/* Unified Action Bar with Lifecycle Controls */}
        <QuestionWorkspaceActionBar
          question={question}
          isNew={mode === "create"}
          isSaving={isSaving}
          isValidating={isValidating}
          isDirty={isDirty}
          onSave={handleSave}
          onValidate={handleValidate}
          onSubmitReview={handleSubmitReview}
          onApprove={handleApprove}
          onReject={handleReject}
          onPublish={handlePublish}
          onCreateDraftVersion={handleCreateDraftVersion}
        />

        {/* Global Feedback Banner */}
        {alertMsg && (
          <div
            className={`p-3.5 rounded-2xl text-xs flex items-center justify-between shadow-xs ${
              alertMsg.type === "success"
                ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-200"
                : "bg-rose-500/10 border border-rose-500/25 text-rose-800 dark:text-rose-200"
            }`}
          >
            <span className="flex items-center gap-2">
              {alertMsg.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              )}
              {alertMsg.text}
            </span>
            <button
              onClick={() => setAlertMsg(null)}
              className="text-muted-foreground hover:text-foreground font-semibold px-2 py-0.5"
            >
              ✕
            </button>
          </div>
        )}

        {/* Retractable Validation Audit Panel */}
        {validationReport && validationReport.issues && validationReport.issues.length > 0 && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 shadow-xs overflow-hidden">
            <div className="flex items-center justify-between p-3.5 bg-rose-500/10 border-b border-rose-500/20">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span className="text-xs font-bold text-rose-900 dark:text-rose-100">
                  Rapport d'audit qualité TEF : {validationReport.errors?.length || 0} erreur(s) bloquante(s), {validationReport.warnings?.length || 0} avertissement(s)
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsValidationPanelOpen(!isValidationPanelOpen)}
                className="text-2xs h-7 font-bold text-rose-900 dark:text-rose-100 hover:bg-rose-500/20"
              >
                {isValidationPanelOpen ? "Masquer le détail" : "Afficher le détail"}
              </Button>
            </div>

            {isValidationPanelOpen && (
              <div className="p-3.5 space-y-2 text-xs">
                {validationReport.issues.map((iss, i) => {
                  const targetTab =
                    iss.field === "prompt" || iss.field?.startsWith("options") || iss.field === "stimulus"
                      ? "editor"
                      : "metadata";
                  return (
                    <div
                      key={i}
                      className="p-2.5 rounded-xl border border-rose-500/20 bg-background/60 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-2xs uppercase font-bold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300">
                          {iss.code}
                        </span>
                        <span className="text-foreground">{iss.message}</span>
                        {iss.field && (
                          <span className="text-2xs text-muted-foreground font-mono">
                            ({iss.field})
                          </span>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleTabChange(targetTab)}
                        className="text-2xs h-6 px-2 shrink-0 font-semibold"
                      >
                        Aller à l'onglet
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 3 Master Tabs Navigation Bar */}
        <div className="flex border-b border-border gap-1 overflow-x-auto text-xs font-semibold">
          {tabsConfig.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            const tabHasIssues =
              (tab.key === "editor" &&
                validationReport?.issues?.some(
                  (i) => i.field === "prompt" || i.field?.startsWith("options") || i.field === "stimulus"
                )) ||
              (tab.key === "metadata" &&
                validationReport?.issues?.some(
                  (i) => i.field === "skill_tags" || i.field === "level" || i.field === "task_type_id"
                ));
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={`flex items-center gap-2 py-3 px-4 border-b-2 transition whitespace-nowrap ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {tabHasIssues && (
                  <span className="h-2 w-2 rounded-full bg-rose-600 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        {/* Tabs Content */}
        {activeTab === "editor" && (
          <QuestionMainEditorTab
            question={question}
            onPatch={handlePatch}
            disabled={isReadOnly || isSaving}
          />
        )}

        {activeTab === "simulator" && (
          <QuestionStudentSimulatorTab question={question} />
        )}

        {activeTab === "metadata" && (
          <QuestionMetadataQualityTab
            question={question}
            onPatch={handlePatch}
            validationReport={validationReport}
            disabled={isReadOnly || isSaving}
          />
        )}
      </div>
    </AdminLayout>
  );
};
