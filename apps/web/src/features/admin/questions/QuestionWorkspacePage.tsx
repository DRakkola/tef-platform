import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  FileText,
  Sliders,
  Award,
  ShieldCheck,
  GitBranch,
  History,
  Eye,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { AdminLayout } from "../AdminLayout";
import { QuestionWorkspaceHeader } from "./QuestionWorkspaceHeader";
import { ContentTab } from "./ContentTab";
import { AssessmentProfileTab } from "./AssessmentProfileTab";
import { SkillsTab } from "./SkillsTab";
import { QualityTab } from "./QualityTab";
import { ProvenanceTab } from "./ProvenanceTab";
import { HistoryTab } from "./HistoryTab";
import { PreviewTab } from "./PreviewTab";
import {
  getQuestion,
  createQuestion,
  updateQuestion,
  validateQuestion,
  submitQuestionForReview,
  approveQuestion,
  rejectQuestion,
  revertQuestionToDraft,
  publishQuestion,
  archiveQuestion,
  createDraftVersion,
  forkQuestion,
} from "../api";
import type { QuestionItem, QuestionValidationResult } from "../types";

interface QuestionWorkspacePageProps {
  mode: "create" | "edit";
}

const DEFAULT_BLANK_QUESTION: Partial<QuestionItem> = {
  question_type: "single_choice",
  prompt: "",
  target_cefr: "B1",
  level: "B1",
  item_difficulty: 3,
  difficulty: 3,
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
  provenance: {
    author_type: "human",
    human_verified: true,
  },
};

export const QuestionWorkspacePage: React.FC<QuestionWorkspacePageProps> = ({ mode }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = searchParams.get("tab") || "content";

  const [question, setQuestion] = useState<Partial<QuestionItem>>(DEFAULT_BLANK_QUESTION);
  const [originalQuestion, setOriginalQuestion] = useState<Partial<QuestionItem>>(DEFAULT_BLANK_QUESTION);
  const [isLoading, setIsLoading] = useState(mode === "edit");
  const [isSaving, setIsSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [validationResult, setValidationResult] = useState<QuestionValidationResult | null>(null);
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (mode === "edit" && id) {
      loadQuestionData(id);
    } else {
      setQuestion(DEFAULT_BLANK_QUESTION);
      setOriginalQuestion(DEFAULT_BLANK_QUESTION);
      setIsLoading(false);
    }
  }, [mode, id]);

  const loadQuestionData = async (questionId: string) => {
    setIsLoading(true);
    setIsStale(false);
    try {
      const data = await getQuestion(questionId);
      setQuestion(data);
      setOriginalQuestion(data);
      if (data.validation_status) {
        setValidationResult({
          is_valid: data.validation_status === "valid",
          status: data.validation_status,
          issues: data.validation_issues || [],
        });
      }
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Impossible de charger la question." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = (tabKey: string) => {
    setSearchParams({ tab: tabKey });
  };

  const handleFieldPatch = (patch: Partial<QuestionItem>) => {
    setQuestion((prev) => ({ ...prev, ...patch }));
  };

  const isDirty = JSON.stringify(question) !== JSON.stringify(originalQuestion);

  // SAVE ACTION
  const handleSave = async () => {
    if (!question.prompt?.trim()) {
      setAlertMsg({ type: "error", text: "Veuillez renseigner l'énoncé de la question." });
      handleTabChange("content");
      return;
    }

    setIsSaving(true);
    try {
      if (mode === "create" || !question.id) {
        const created = await createQuestion({
          prompt: question.prompt.trim(),
          question_type: question.question_type || "single_choice",
          stimulus_id: question.stimulus_id || undefined,
          stimulus_text: question.stimulus_text || undefined,
          audio_url: question.audio_url || undefined,
          media_url: question.media_url || undefined,
          target_cefr: question.target_cefr || question.level || "B1",
          level: question.target_cefr || question.level || "B1",
          item_difficulty: question.item_difficulty ?? question.difficulty ?? 3,
          difficulty: question.item_difficulty ?? question.difficulty ?? 3,
          cognitive_complexity: question.cognitive_complexity || "understand",
          task_type_id: question.task_type_id || undefined,
          explanation: question.explanation || undefined,
          points: question.points ?? 1,
          penalty_points: question.penalty_points ?? 0,
          options: question.options,
          skill_tags: question.skill_tags?.map((t) => ({
            skill_id: t.skill_id,
            role: t.role || "primary",
            subskill_id: t.subskill_id || undefined,
            subskill: t.subskill || undefined,
            weight: t.weight,
            context: t.context,
          })),
          response_metadata: question.response_metadata,
          scoring_payload: question.scoring_payload,
          provenance: question.provenance,
        });
        setAlertMsg({ type: "success", text: "Question créée avec succès en brouillon." });
        navigate(`/admin/questions/${created.id}?tab=content`, { replace: true });
      } else {
        const updated = await updateQuestion(question.id, {
          prompt: question.prompt.trim(),
          question_type: question.question_type,
          stimulus_id: question.stimulus_id,
          stimulus_text: question.stimulus_text,
          audio_url: question.audio_url,
          media_url: question.media_url,
          target_cefr: question.target_cefr || question.level,
          level: question.target_cefr || question.level,
          item_difficulty: question.item_difficulty ?? question.difficulty,
          difficulty: question.item_difficulty ?? question.difficulty,
          cognitive_complexity: question.cognitive_complexity,
          task_type_id: question.task_type_id,
          explanation: question.explanation,
          points: question.points,
          penalty_points: question.penalty_points,
          options: question.options,
          skill_tags: question.skill_tags,
          response_metadata: question.response_metadata,
          scoring_payload: question.scoring_payload,
          provenance: question.provenance,
          expected_version: question.version,
        });
        setQuestion(updated);
        setOriginalQuestion(updated);
        setAlertMsg({ type: "success", text: "Modifications enregistrées avec succès." });
      }
    } catch (err: any) {
      if (err.status === 409 || err.message?.includes("concurrency") || err.message?.includes("version")) {
        setIsStale(true);
        setAlertMsg({
          type: "error",
          text: "Conflit d'édition : cet item a été modifié sur le serveur. Veuillez recharger.",
        });
      } else {
        setAlertMsg({ type: "error", text: err.message || "Erreur lors de l'enregistrement." });
      }
    } finally {
      setIsSaving(false);
    }
  };

  // VALIDATION ACTION
  const handleValidate = async () => {
    if (!question.id) return;
    setIsValidating(true);
    try {
      const res = await validateQuestion(question.id);
      setValidationResult(res);
      setQuestion((prev) => ({
        ...prev,
        validation_status: res.status,
        validation_issues: res.issues,
      }));
      setAlertMsg({
        type: res.is_valid ? "success" : "error",
        text: res.is_valid
          ? "Contrôle de validation réussi sans erreur bloquante."
          : `Validation : ${res.issues.filter((i) => i.severity === "blocking").length} anomalie(s) bloquante(s).`,
      });
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Échec de la validation." });
    } finally {
      setIsValidating(false);
    }
  };

  // LIFECYCLE ACTION HANDLERS
  const handleSubmitReview = async (comments?: string) => {
    if (!question.id) return;
    setIsActionLoading(true);
    try {
      const res = await submitQuestionForReview(question.id, comments);
      setQuestion(res);
      setOriginalQuestion(res);
      setAlertMsg({ type: "success", text: "Item soumis pour relecture éditoriale avec succès." });
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Échec de la soumission." });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleApprove = async (notes?: string) => {
    if (!question.id) return;
    setIsActionLoading(true);
    try {
      const res = await approveQuestion(question.id, notes);
      setQuestion(res);
      setOriginalQuestion(res);
      setAlertMsg({ type: "success", text: "Item approuvé avec succès." });
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Échec de l'approbation." });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReject = async (notes?: string) => {
    if (!question.id) return;
    setIsActionLoading(true);
    try {
      const res = await rejectQuestion(question.id, notes);
      setQuestion(res);
      setOriginalQuestion(res);
      setAlertMsg({ type: "success", text: "Item rejeté." });
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Échec du rejet." });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRevertDraft = async (reason?: string) => {
    if (!question.id) return;
    setIsActionLoading(true);
    try {
      const res = await revertQuestionToDraft(question.id, reason);
      setQuestion(res);
      setOriginalQuestion(res);
      setAlertMsg({ type: "success", text: "Item renvoyé en état brouillon." });
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Échec du renvoi en brouillon." });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handlePublish = async (changelog?: string) => {
    if (!question.id) return;
    setIsActionLoading(true);
    try {
      const res = await publishQuestion(question.id, changelog);
      setQuestion(res);
      setOriginalQuestion(res);
      setAlertMsg({ type: "success", text: "Item publié officiellement ! Instantané immuable créé." });
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Échec de la publication." });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleArchive = async (reason?: string) => {
    if (!question.id) return;
    setIsActionLoading(true);
    try {
      const res = await archiveQuestion(question.id, reason);
      setQuestion(res);
      setOriginalQuestion(res);
      setAlertMsg({ type: "success", text: "Question archivée." });
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Échec de l'archivage." });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCreateDraftVersion = async (changelog?: string) => {
    if (!question.id) return;
    setIsActionLoading(true);
    try {
      const res = await createDraftVersion(question.id, changelog);
      setQuestion(res);
      setOriginalQuestion(res);
      setAlertMsg({
        type: "success",
        text: `Nouvelle version brouillon v${res.version} créée avec succès.`,
      });
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Échec de création de nouvelle version." });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleFork = async () => {
    if (!question.id) return;
    setIsActionLoading(true);
    try {
      const res = await forkQuestion(question.id);
      setAlertMsg({ type: "success", text: "Question dupliquée avec succès." });
      navigate(`/admin/questions/${res.id}?tab=content`);
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Échec de duplication." });
    } finally {
      setIsActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="py-20 text-center text-sm text-muted-foreground">
          Chargement de l'atelier de conception de questions...
        </div>
      </AdminLayout>
    );
  }

  const isReadOnly = question.status === "published" || question.status === "archived";

  const tabsConfig = [
    { key: "content", label: "Contenu & Énoncé", icon: FileText },
    { key: "profile", label: "Profil & Barème", icon: Sliders },
    { key: "skills", label: "Compétences V2", icon: Award },
    { key: "quality", label: "Qualité & Linter", icon: ShieldCheck },
    { key: "provenance", label: "Traçabilité", icon: GitBranch },
    { key: "history", label: "Historique & Diff", icon: History },
    { key: "preview", label: "Aperçu Candidat / Admin", icon: Eye },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Workspace Header */}
        <QuestionWorkspaceHeader
          question={question}
          isNew={mode === "create"}
          isSaving={isSaving}
          isValidating={isValidating}
          isActionLoading={isActionLoading}
          isDirty={isDirty}
          isStale={isStale}
          onSave={handleSave}
          onValidate={handleValidate}
          onSubmitReview={handleSubmitReview}
          onApprove={handleApprove}
          onReject={handleReject}
          onRevertDraft={handleRevertDraft}
          onPublish={handlePublish}
          onArchive={handleArchive}
          onCreateDraftVersion={handleCreateDraftVersion}
          onFork={handleFork}
          onRefresh={() => id && loadQuestionData(id)}
        />

        {/* Global Feedback Banner */}
        {alertMsg && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-center justify-between shadow-2xs ${
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

        {/* Read-Only Banner for Published/Archived questions */}
        {isReadOnly && (
          <div className="p-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground flex items-center justify-between">
            <span>
              ℹ️ Cet item est <strong>{question.status}</strong> et ses contenus sont figés pour garantir l'équité des examens.
              Pour le modifier, utilisez l'action <strong>« Créer version v{(question.version || 1) + 1} »</strong> dans l'en-tête.
            </span>
          </div>
        )}

        {/* Tabs Bar */}
        <div className="flex border-b border-border gap-1 overflow-x-auto text-xs font-semibold">
          {tabsConfig.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={`flex items-center gap-2 py-2.5 px-3 border-b-2 transition whitespace-nowrap ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Active Tab Panel */}
        <div>
          {activeTab === "content" && (
            <ContentTab
              question={question}
              onChange={handleFieldPatch}
              disabled={isReadOnly}
            />
          )}

          {activeTab === "profile" && (
            <AssessmentProfileTab
              question={question}
              onChange={handleFieldPatch}
              disabled={isReadOnly}
            />
          )}

          {activeTab === "skills" && (
            <SkillsTab
              question={question}
              onChange={handleFieldPatch}
              disabled={isReadOnly}
            />
          )}

          {activeTab === "quality" && (
            <QualityTab
              question={question}
              validationResult={validationResult}
              isValidating={isValidating}
              onValidate={handleValidate}
              onNavigateTab={handleTabChange}
              disabled={isReadOnly}
            />
          )}

          {activeTab === "provenance" && (
            <ProvenanceTab
              question={question}
              onChange={handleFieldPatch}
              disabled={isReadOnly}
            />
          )}

          {activeTab === "history" && <HistoryTab question={question} />}

          {activeTab === "preview" && <PreviewTab question={question} />}
        </div>
      </div>
    </AdminLayout>
  );
};
