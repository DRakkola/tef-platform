/**
 * WorkspaceToolbar: Sticky top bar in the correction workspace.
 * Shows: back, student/task identity, status badge, save indicator, Submit button.
 */

import React from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Send,
} from "lucide-react"
import type { WritingSubmissionDetail } from "../types"
import { SUBMISSION_STATUS_META, TASK_TYPE_LABELS } from "../types"

interface Props {
  submission: WritingSubmissionDetail | undefined
  isDirty: boolean
  isValid: boolean
  isSubmitPending: boolean
  isSubmitSuccess: boolean
  onSubmitClick: () => void
}

export const WorkspaceToolbar: React.FC<Props> = ({
  submission,
  isDirty,
  isValid,
  isSubmitPending,
  isSubmitSuccess,
  onSubmitClick,
}) => {
  const navigate = useNavigate()

  const statusMeta = submission
    ? (SUBMISSION_STATUS_META[submission.status] ?? { label: submission.status, variant: "outline" as const })
    : null

  const taskTypeLabel = submission?.task?.task_type
    ? TASK_TYPE_LABELS[submission.task.task_type] ?? submission.task.task_type
    : ""

  const saveIndicator = isSubmitSuccess ? (
    <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Envoyée
    </span>
  ) : isDirty ? (
    <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
      <AlertCircle className="h-3.5 w-3.5" />
      Non enregistré
    </span>
  ) : null

  const isAlreadyDone =
    submission && ["corrected", "returned"].includes(submission.status)

  return (
    <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur-sm">
      {/* Back */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/teacher/corrections")}
        className="gap-1.5 text-muted-foreground hover:text-foreground -ml-1"
        aria-label="Retour aux corrections"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Corrections</span>
      </Button>

      <div className="h-4 w-px bg-border flex-shrink-0" />

      {/* Identity */}
      <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:gap-3">
        <p className="truncate text-sm font-medium text-foreground">
          {submission?.task?.title ?? "Chargement…"}
        </p>
        {taskTypeLabel && (
          <span className="hidden sm:inline text-xs text-muted-foreground truncate">
            {taskTypeLabel}
          </span>
        )}
      </div>

      {/* Status + save indicator */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {saveIndicator}
        {statusMeta && (
          <Badge variant={statusMeta.variant} className="text-xs hidden sm:flex">
            {statusMeta.label}
          </Badge>
        )}
      </div>

      {/* Submit CTA */}
      {!isAlreadyDone && (
        <Button
          size="sm"
          onClick={onSubmitClick}
          disabled={isSubmitPending || isSubmitSuccess || !isValid}
          className="gap-1.5 flex-shrink-0"
        >
          {isSubmitPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="hidden sm:inline">Envoi…</span>
            </>
          ) : (
            <>
              <Send className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Soumettre la correction</span>
              <span className="sm:hidden">Soumettre</span>
            </>
          )}
        </Button>
      )}
    </div>
  )
}
