/**
 * WritingResultHeader Component.
 * Top navigation header for the Writing Result & Correction page.
 * Displays breadcrumb navigation, task title, section badge, evaluation status,
 * submission timestamp, and practice action.
 */

import React from "react"
import { ArrowLeft, Clock, Sparkles, UserCheck, BookOpen, CheckCircle2, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export interface WritingResultHeaderProps {
  taskTitle: string
  taskType: string
  status: string
  provider?: string
  submittedAt?: string
  onBack: () => void
  onPracticeClick?: () => void
}

export const WritingResultHeader: React.FC<WritingResultHeaderProps> = ({
  taskTitle,
  taskType,
  status,
  provider,
  submittedAt,
  onBack,
  onPracticeClick,
}) => {
  const isCorrected = ["corrected", "returned"].includes(status.toLowerCase())
  const isTeacherReview = provider === "teacher"

  const sectionLabel =
    taskType === "section_a"
      ? "Section A (Fait divers)"
      : taskType === "section_b"
      ? "Section B (Lettre d'opinion)"
      : "Épreuve écrite"

  const formatDate = (isoString?: string) => {
    if (!isoString) return ""
    try {
      const date = new Date(isoString)
      return date.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return isoString
    }
  }

  const getStatusBadge = () => {
    if (isCorrected) {
      return (
        <Badge variant="success" className="gap-1 text-xs">
          <CheckCircle2 className="size-3" />
          <span>Correction disponible</span>
        </Badge>
      )
    }
    if (isTeacherReview) {
      return (
        <Badge variant="warning" className="gap-1 text-xs">
          <RotateCw className="size-3 animate-spin" />
          <span>En attente de correction par un professeur</span>
        </Badge>
      )
    }
    return (
      <Badge variant="warning" className="gap-1 text-xs">
        <RotateCw className="size-3 animate-spin" />
        <span>Correction en cours</span>
      </Badge>
    )
  }

  return (
    <header className="border-b border-border/80 bg-card/80 backdrop-blur-md px-4 sm:px-6 py-4 sticky top-0 z-20 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Navigation & Task Details */}
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="cursor-pointer gap-1.5 text-xs text-muted-foreground hover:text-foreground h-8 -ml-2"
            >
              <ArrowLeft className="size-3.5" />
              <span>Retour à l'Atelier d'écriture</span>
            </Button>
            <span className="text-muted-foreground text-xs">|</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Résultat d'évaluation
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
            <h1 className="text-lg sm:text-xl font-bold text-foreground truncate max-w-2xl">
              {taskTitle}
            </h1>
            <Badge variant="outline" className="text-xs shrink-0">
              {sectionLabel}
            </Badge>
          </div>

          {submittedAt && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-0.5">
              <Clock className="size-3" />
              <span>Soumis le {formatDate(submittedAt)}</span>
            </div>
          )}
        </div>

        {/* Right: Status and Actions */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Status Badge */}
          {getStatusBadge()}

          {/* Evaluator Badge */}
          {provider && (
            <Badge variant="secondary" className="gap-1 text-xs">
              {provider === "teacher" ? (
                <>
                  <UserCheck className="size-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Professeur certifié</span>
                </>
              ) : (
                <>
                  <Sparkles className="size-3 text-primary" />
                  <span>Évaluation IA</span>
                </>
              )}
            </Badge>
          )}

          {/* Action Button */}
          {onPracticeClick && (
            <Button
              variant="outline"
              size="sm"
              onClick={onPracticeClick}
              className="cursor-pointer gap-1.5 text-xs rounded-xl"
            >
              <BookOpen className="size-3.5" />
              <span>S'entraîner</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
