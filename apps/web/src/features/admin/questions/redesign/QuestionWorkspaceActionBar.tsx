import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  ShieldCheck,
  Loader2,
  Send,
  CheckCircle2,
  XCircle,
  Upload,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { QuestionItem } from "../../types";

interface QuestionWorkspaceActionBarProps {
  question: Partial<QuestionItem>;
  isNew: boolean;
  isSaving: boolean;
  isValidating: boolean;
  isDirty: boolean;
  onSave: () => void;
  onValidate: () => void;
  onSubmitReview?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onPublish?: () => void;
  onCreateDraftVersion?: () => void;
}

export const QuestionWorkspaceActionBar: React.FC<QuestionWorkspaceActionBarProps> = ({
  question,
  isNew,
  isSaving,
  isValidating,
  isDirty,
  onSave,
  onValidate,
  onSubmitReview,
  onApprove,
  onReject,
  onPublish,
  onCreateDraftVersion,
}) => {
  const statusColors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground border-border",
    in_review: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    approved: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    published: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    rejected: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    archived: "bg-neutral-500/15 text-neutral-600 dark:text-neutral-400 border-neutral-500/30",
  };

  const statusLabels: Record<string, string> = {
    draft: "Brouillon",
    in_review: "En révision",
    approved: "Approuvé",
    published: "Publié",
    rejected: "Modifications requises",
    archived: "Archivé",
  };

  const currentStatus = question.status || "draft";
  const isReadOnly = currentStatus === "published" || currentStatus === "archived";

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 rounded-2xl border border-border bg-card shadow-xs">
      {/* Left: Navigation and Identity */}
      <div className="flex items-center gap-3">
        <Link
          to="/admin/questions"
          className="h-9 w-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition shrink-0"
          title="Retour à la banque de questions"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-foreground">
              {isNew ? "Nouvelle question" : `Question #${question.id?.slice(0, 8)}`}
            </h1>
            <span
              className={`text-2xs font-bold px-2 py-0.5 rounded-full border ${
                statusColors[currentStatus] || statusColors.draft
              }`}
            >
              {statusLabels[currentStatus] || currentStatus}
            </span>
            {question.version && question.version > 1 && (
              <span className="text-2xs font-mono font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                v{question.version}
              </span>
            )}
            {isDirty && !isReadOnly && (
              <span className="text-2xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                ● Modifié non enregistré
              </span>
            )}
          </div>
          <p className="text-2xs text-muted-foreground truncate max-w-md">
            {question.prompt || "Configurez l'énoncé, le document support et les réponses attendues."}
          </p>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Validate Quality Linter */}
        {!isNew && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onValidate}
            disabled={isValidating || isSaving}
            className="text-xs h-8 gap-1.5 font-semibold"
          >
            {isValidating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            )}
            Audit Qualité
          </Button>
        )}

        {/* Lifecycle Buttons based on State */}
        {!isNew && (currentStatus === "draft" || currentStatus === "rejected") && onSubmitReview && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSubmitReview}
            disabled={isSaving || isValidating}
            className="text-xs h-8 gap-1.5 font-semibold text-amber-700 border-amber-300 dark:text-amber-300 dark:border-amber-800 hover:bg-amber-500/10"
          >
            <Send className="h-3.5 w-3.5" />
            Soumettre pour révision
          </Button>
        )}

        {!isNew && currentStatus === "in_review" && (
          <>
            {onApprove && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onApprove}
                disabled={isSaving || isValidating}
                className="text-xs h-8 gap-1.5 font-semibold text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-500/10"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approuver
              </Button>
            )}
            {onReject && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onReject}
                disabled={isSaving || isValidating}
                className="text-xs h-8 gap-1.5 font-semibold text-rose-700 border-rose-300 dark:text-rose-300 dark:border-rose-800 hover:bg-rose-500/10"
              >
                <XCircle className="h-3.5 w-3.5" />
                Demander corrections
              </Button>
            )}
          </>
        )}

        {!isNew && currentStatus === "approved" && onPublish && (
          <Button
            type="button"
            size="sm"
            onClick={onPublish}
            disabled={isSaving || isValidating}
            className="text-xs h-8 gap-1.5 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Upload className="h-3.5 w-3.5" />
            Publier dans la banque
          </Button>
        )}

        {!isNew && isReadOnly && onCreateDraftVersion && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCreateDraftVersion}
            disabled={isSaving || isValidating}
            className="text-xs h-8 gap-1.5 font-semibold"
            title="Créer une version brouillon pour modifier cet item sans impacter les sessions actives"
          >
            <Copy className="h-3.5 w-3.5 text-primary" />
            Créer version brouillon
          </Button>
        )}

        {/* Save / Create Button (Only if writable or new) */}
        {(!isReadOnly || isNew) && (
          <Button
            type="button"
            size="sm"
            onClick={onSave}
            disabled={isSaving}
            className="text-xs h-8 gap-1.5 font-semibold"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {isNew ? "Créer la question" : "Enregistrer"}
          </Button>
        )}
      </div>
    </div>
  );
};
