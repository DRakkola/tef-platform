import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Play,
  Send,
  CheckCircle2,
  XCircle,
  RotateCcw,
  UploadCloud,
  Archive,
  GitFork,
  AlertTriangle,
  Copy,
  Check,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { QuestionItem, ContentStatus, QuestionValidationStatus } from "../types";

interface QuestionWorkspaceHeaderProps {
  question: Partial<QuestionItem>;
  isNew: boolean;
  isSaving: boolean;
  isValidating: boolean;
  isActionLoading: boolean;
  isDirty: boolean;
  isStale: boolean;
  onSave: () => void;
  onValidate: () => void;
  onSubmitReview: (comments?: string) => void;
  onApprove: (notes?: string) => void;
  onReject: (notes?: string) => void;
  onRevertDraft: (reason?: string) => void;
  onPublish: (changelog?: string) => void;
  onArchive: (reason?: string) => void;
  onCreateDraftVersion: (changelog?: string) => void;
  onFork: () => void;
  onRefresh: () => void;
  onRegenerateComponent?: (component: string) => void;
}

export const QuestionWorkspaceHeader: React.FC<QuestionWorkspaceHeaderProps> = ({
  question,
  isNew,
  isSaving,
  isValidating,
  isActionLoading,
  isDirty,
  isStale,
  onSave,
  onValidate,
  onSubmitReview,
  onApprove,
  onReject,
  onRevertDraft,
  onPublish,
  onArchive,
  onCreateDraftVersion,
  onFork,
  onRefresh,
  onRegenerateComponent,
}) => {
  const [copied, setCopied] = useState(false);
  const [modalAction, setModalAction] = useState<
    "submit_review" | "reject" | "revert_draft" | "publish" | "archive" | "new_version" | null
  >(null);
  const [modalNote, setModalNote] = useState("");

  const status: ContentStatus = (question.status as ContentStatus) || "draft";
  const validationStatus: QuestionValidationStatus = question.validation_status || "warning";

  const handleCopyId = () => {
    if (question.id) {
      navigator.clipboard.writeText(question.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenActionModal = (action: typeof modalAction) => {
    setModalAction(action);
    setModalNote("");
  };

  const handleConfirmModalAction = () => {
    if (!modalAction) return;
    const note = modalNote.trim() || undefined;
    switch (modalAction) {
      case "submit_review":
        onSubmitReview(note);
        break;
      case "reject":
        onReject(note);
        break;
      case "revert_draft":
        onRevertDraft(note);
        break;
      case "publish":
        onPublish(note);
        break;
      case "archive":
        onArchive(note);
        break;
      case "new_version":
        onCreateDraftVersion(note);
        break;
    }
    setModalAction(null);
  };

  const getStatusBadge = (st: ContentStatus) => {
    switch (st) {
      case "draft":
        return <span className="px-2 py-0.5 rounded text-2xs font-bold uppercase bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">Brouillon</span>;
      case "in_review":
        return <span className="px-2 py-0.5 rounded text-2xs font-bold uppercase bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">En révision</span>;
      case "approved":
        return <span className="px-2 py-0.5 rounded text-2xs font-bold uppercase bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">Approuvé</span>;
      case "published":
        return <span className="px-2 py-0.5 rounded text-2xs font-bold uppercase bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">Publié</span>;
      case "rejected":
        return <span className="px-2 py-0.5 rounded text-2xs font-bold uppercase bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">Rejeté</span>;
      case "archived":
        return <span className="px-2 py-0.5 rounded text-2xs font-bold uppercase bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20">Archivé</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-2xs font-bold uppercase bg-muted text-muted-foreground">{st}</span>;
    }
  };

  const getValidationPill = (v: QuestionValidationStatus) => {
    switch (v) {
      case "valid":
        return (
          <span className="flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="h-3 w-3" /> Conforme
          </span>
        );
      case "warning":
        return (
          <span className="flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
            <AlertTriangle className="h-3 w-3" /> Avertissements
          </span>
        );
      case "invalid":
        return (
          <span className="flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
            <XCircle className="h-3 w-3" /> Bloquant
          </span>
        );
    }
  };

  return (
    <div className="space-y-3">
      {/* Breadcrumb & Concurrency Warning */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link
            to="/admin/questions"
            className="hover:text-foreground flex items-center gap-1 font-medium transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Banque de questions
          </Link>
          <span>/</span>
          <span className="text-foreground font-semibold">
            {isNew ? "Nouvelle question" : `Item #${question.id?.slice(0, 8)}`}
          </span>
        </div>

        {/* Concurrency / Stale Indicator */}
        {isStale && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Cet item a été modifié par un autre processus.</span>
            <Button size="sm" variant="outline" onClick={onRefresh} className="h-6 text-2xs">
              Recharger
            </Button>
          </div>
        )}
      </div>

      {/* Main Header Bar */}
      <div className="p-4 rounded-2xl border border-border bg-card shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Title, ID & Badges */}
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-base font-bold text-foreground truncate max-w-xl">
              {question.prompt || (isNew ? "Nouvel item en cours d'édition..." : "Sans énoncé")}
            </h1>
            {getStatusBadge(status)}
            <span className="px-2 py-0.5 rounded text-2xs font-mono font-bold bg-muted text-foreground border border-border">
              v{question.version || 1}
            </span>
            {getValidationPill(validationStatus)}
            {isDirty && (
              <span className="px-1.5 py-0.5 rounded text-2xs font-semibold bg-primary/10 text-primary">
                Modifications non enregistrées
              </span>
            )}
          </div>

          {!isNew && question.id && (
            <div className="flex items-center gap-2 text-2xs text-muted-foreground font-mono">
              <span>ID: {question.id}</span>
              <button
                type="button"
                onClick={handleCopyId}
                className="hover:text-foreground transition p-0.5"
                title="Copier l'identifiant"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          )}
        </div>

        {/* Action Controls Toolbar */}
        <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
          {/* Quick Validate Button */}
          {!isNew && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onValidate}
              disabled={isValidating || isActionLoading}
              className="h-8 text-xs gap-1"
            >
              <Play className="h-3.5 w-3.5" />
              {isValidating ? "Validation..." : "Valider"}
            </Button>
          )}

          {/* DRAFT STATE ACTIONS */}
          {(status === "draft" || status === "rejected") && (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onSave}
                disabled={isSaving || isActionLoading}
                className="h-8 text-xs gap-1"
              >
                <Save className="h-3.5 w-3.5" />
                {isSaving ? "Enregistrement..." : "Enregistrer"}
              </Button>
              {!isNew && (
                <>
                  {onRegenerateComponent && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onRegenerateComponent("distractors")}
                      disabled={isActionLoading}
                      className="h-8 text-xs gap-1 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                      title="Régénérer les distracteurs par IA selon les règles didactiques"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Distracteurs IA
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleOpenActionModal("submit_review")}
                    disabled={isActionLoading || validationStatus === "invalid"}
                    className="h-8 text-xs gap-1 bg-sky-600 hover:bg-sky-700 text-white font-semibold"
                    title={validationStatus === "invalid" ? "Corrigez les erreurs bloquantes avant soumission" : "Soumettre pour révision"}
                  >
                    <Send className="h-3.5 w-3.5" />
                    Soumettre pour révision
                  </Button>
                </>
              )}
            </>
          )}

          {/* IN_REVIEW STATE ACTIONS */}
          {status === "in_review" && (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleOpenActionModal("revert_draft")}
                disabled={isActionLoading}
                className="h-8 text-xs gap-1"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Renvoyer en brouillon
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleOpenActionModal("reject")}
                disabled={isActionLoading}
                className="h-8 text-xs gap-1 border-rose-500/30 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
              >
                <XCircle className="h-3.5 w-3.5" /> Rejeter
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => onApprove()}
                disabled={isActionLoading}
                className="h-8 text-xs gap-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Approuver
              </Button>
            </>
          )}

          {/* APPROVED STATE ACTIONS */}
          {status === "approved" && (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleOpenActionModal("revert_draft")}
                disabled={isActionLoading}
                className="h-8 text-xs gap-1"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Renvoyer en brouillon
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => handleOpenActionModal("publish")}
                disabled={isActionLoading || validationStatus === "invalid"}
                className="h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                <UploadCloud className="h-3.5 w-3.5" /> Publier officiellement
              </Button>
            </>
          )}

          {/* PUBLISHED / ARCHIVED STATE ACTIONS */}
          {status === "published" && (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleOpenActionModal("new_version")}
                disabled={isActionLoading}
                className="h-8 text-xs gap-1 text-primary hover:bg-primary/5"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Créer version v{(question.version || 1) + 1}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onFork}
                disabled={isActionLoading}
                className="h-8 text-xs gap-1"
                title="Créer une copie distincte de cet item"
              >
                <GitFork className="h-3.5 w-3.5 text-purple-500" /> Dupliquer
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => handleOpenActionModal("archive")}
                disabled={isActionLoading}
                className="h-8 text-xs gap-1 text-muted-foreground hover:text-rose-500"
              >
                <Archive className="h-3.5 w-3.5" /> Archiver
              </Button>
            </>
          )}

          {status === "archived" && (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleOpenActionModal("new_version")}
                disabled={isActionLoading}
                className="h-8 text-xs gap-1"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Réactiver dans une nouvelle version
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onFork}
                disabled={isActionLoading}
                className="h-8 text-xs gap-1"
              >
                <GitFork className="h-3.5 w-3.5" /> Dupliquer
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {modalAction && (
        <Dialog open={!!modalAction} onOpenChange={() => setModalAction(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold">
                {modalAction === "submit_review" && "Soumettre pour relecture éditoriale"}
                {modalAction === "reject" && "Rejeter l'item avec motif"}
                {modalAction === "revert_draft" && "Renvoyer en état brouillon"}
                {modalAction === "publish" && "Publication officielle de la question"}
                {modalAction === "archive" && "Archiver cette question"}
                {modalAction === "new_version" && `Créer une nouvelle version v${(question.version || 1) + 1}`}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <p className="text-muted-foreground">
                {modalAction === "publish"
                  ? "La publication va figer un instantané immuable dans l'historique et rendre l'item éligible aux épreuves candidates."
                  : "Vous pouvez joindre une note ou un journal des modifications :"}
              </p>
              <Textarea
                rows={3}
                placeholder="Commentaires didactiques, changelog ou motif..."
                value={modalNote}
                onChange={(e) => setModalNote(e.target.value)}
                className="text-xs"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setModalAction(null)}>
                Annuler
              </Button>
              <Button size="sm" onClick={handleConfirmModalAction} disabled={isActionLoading}>
                Confirmer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
