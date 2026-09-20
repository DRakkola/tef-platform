/**
 * WritingEvaluatorFeedback Component.
 * Displays overall remarks, teacher annotations or AI evaluation summary.
 */

import React from "react"
import { Sparkles, UserCheck, Calendar } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export interface WritingEvaluatorFeedbackProps {
  provider: "ai" | "teacher" | "mock"
  comments: string
  correctedByUserId?: string | null
  createdAt?: string
}

export const WritingEvaluatorFeedback: React.FC<WritingEvaluatorFeedbackProps> = ({
  provider,
  comments,
  createdAt,
}) => {
  if (!comments) return null

  const isTeacher = provider === "teacher"

  const formatDate = (isoString?: string) => {
    if (!isoString) return ""
    try {
      return new Date(isoString).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    } catch {
      return isoString
    }
  }

  return (
    <section
      aria-label="Commentaire de l'évaluateur"
      className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs space-y-4"
    >
      {/* Header with Provenance */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          {isTeacher ? (
            <UserCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Sparkles className="size-4 text-primary" />
          )}
          <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground">
            {isTeacher ? "Commentaire du professeur référent" : "Synthèse de l'évaluation IA"}
          </h3>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {createdAt && (
            <span className="flex items-center gap-1">
              <Calendar className="size-3 text-muted-foreground" />
              <span>{formatDate(createdAt)}</span>
            </span>
          )}
          <Badge variant={isTeacher ? "outline" : "secondary"} className="text-[10px]">
            {isTeacher ? "Revue experte" : "Modèle indicatif"}
          </Badge>
        </div>
      </div>

      {/* Evaluator Comments */}
      <div className="space-y-3">
        {!isTeacher && (
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Cette synthèse a été générée par un modèle d'évaluation automatisé calibré selon les critères officiels de la grille d'expression écrite du TEF.
          </p>
        )}

        <div className="p-4 sm:p-5 rounded-xl bg-muted/30 border border-border/60 text-sm leading-relaxed text-foreground whitespace-pre-wrap font-sans">
          {comments}
        </div>
      </div>
    </section>
  )
}
