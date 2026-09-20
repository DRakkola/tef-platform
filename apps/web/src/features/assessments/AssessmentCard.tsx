import React from "react"
import { useNavigate } from "react-router-dom"
import {
  Clock,
  Layers,
  ArrowRight,
  Headphones,
  BookOpen,
  CheckCircle2,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { telemetry } from "@/features/analytics/telemetry"
import type { AssessmentListItem, AttemptStatus } from "./types"

export interface AssessmentCardProps {
  assessment: AssessmentListItem
  isRecommended?: boolean
  activeAttemptId?: string
  lastAttempt?: {
    id: string
    status: AttemptStatus
    score_percentage?: number | null
    submitted_at?: string | null
  }
  onStart?: (assessment: AssessmentListItem) => void
  onResume?: (attemptId: string) => void
  onViewResult?: (attemptId: string) => void
}

export function getDifficultyLabel(difficulty?: number): string {
  if (!difficulty) return "Intermédiaire"
  if (difficulty <= 2) return "Débutant"
  if (difficulty >= 4) return "Avancé"
  return "Intermédiaire"
}

export const AssessmentCard: React.FC<AssessmentCardProps> = ({
  assessment,
  isRecommended = false,
  activeAttemptId,
  lastAttempt,
  onStart,
  onResume,
  onViewResult,
}) => {
  const navigate = useNavigate()

  const isListening = assessment.assessment_type === "listening"
  const isReading = assessment.assessment_type === "reading"
  const TypeIcon = isListening ? Headphones : isReading ? BookOpen : Layers
  const typeLabel = isListening
    ? "Compréhension orale"
    : isReading
    ? "Compréhension écrite"
    : "Simulation complète"

  const durationMins =
    assessment.estimated_completion_time_minutes ||
    Math.round(assessment.duration_seconds / 60)

  const isCompleted = lastAttempt?.status === "submitted"
  const isExpired = lastAttempt?.status === "expired"
  const hasActiveAttempt = Boolean(activeAttemptId)

  const handlePrimaryAction = () => {
    if (hasActiveAttempt && activeAttemptId) {
      telemetry.track("assessment_resume_clicked", {
        attemptId: activeAttemptId,
        assessmentId: assessment.id,
      })
      if (onResume) {
        onResume(activeAttemptId)
      } else {
        navigate(`/attempts/${activeAttemptId}`)
      }
    } else if (isCompleted && lastAttempt?.id) {
      telemetry.track("assessment_result_clicked", { attemptId: lastAttempt.id })
      if (onViewResult) {
        onViewResult(lastAttempt.id)
      } else {
        navigate(`/attempts/${lastAttempt.id}/results`)
      }
    } else {
      telemetry.track("assessment_started", {
        assessmentId: assessment.id,
        title: assessment.title,
      })
      if (onStart) {
        onStart(assessment)
      } else {
        navigate(`/assessments/${assessment.id}`)
      }
    }
  }

  const handleRestart = () => {
    telemetry.track("assessment_started", {
      assessmentId: assessment.id,
      title: assessment.title,
      isRestart: true,
    })
    if (onStart) {
      onStart(assessment)
    } else {
      navigate(`/assessments/${assessment.id}`)
    }
  }

  return (
    <Card
      data-testid={`assessment-card-${assessment.id}`}
      className={`group flex flex-col justify-between transition-all duration-200 border ${
        isRecommended
          ? "border-primary/40 bg-card hover:border-primary/60 hover:shadow-sm"
          : isCompleted
          ? "border-border/60 bg-card/80 hover:border-border"
          : "border-border/70 bg-card hover:border-primary/40 hover:shadow-2xs"
      }`}
    >
      <CardHeader className="p-5 pb-3 space-y-2.5">
        {/* Type & Level Badges */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Badge
              variant={isListening ? "default" : isReading ? "secondary" : "outline"}
              className="gap-1 text-[11px] font-semibold"
            >
              <TypeIcon className="size-3" />
              <span>{typeLabel}</span>
            </Badge>

            {isRecommended && (
              <Badge variant="outline" className="text-[10px] gap-1 font-semibold text-primary border-primary/40">
                <Sparkles className="size-2.5" />
                <span>Recommandé pour vous</span>
              </Badge>
            )}

            {isCompleted && (
              <Badge variant="secondary" className="gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                <CheckCircle2 className="size-3" />
                <span>Terminé</span>
              </Badge>
            )}

            {isExpired && (
              <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30">
                Évaluation expirée
              </Badge>
            )}
          </div>

          <Badge variant="outline" className="font-mono text-xs font-semibold">
            Niveau {assessment.level}
          </Badge>
        </div>

        {/* Title */}
        <CardTitle className="text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
          {assessment.title}
        </CardTitle>

        {/* Description */}
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {assessment.description || "Simulation officielle chronométrée sous contraintes réelles de l'examen TEF."}
        </p>
      </CardHeader>

      <CardContent className="p-5 pt-0 space-y-3">
        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-3 border-t border-border/60 font-mono tabular-nums">
          <div className="flex items-center gap-1.5">
            <Clock className="size-3 text-muted-foreground/80" />
            <span>{durationMins} minutes</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Layers className="size-3 text-muted-foreground/80" />
            <span>{assessment.question_count} questions</span>
          </div>

          <div className="flex items-center gap-1.5 font-sans">
            <span className="text-muted-foreground/70">Difficulté :</span>
            <span className="font-medium text-foreground">{getDifficultyLabel(assessment.difficulty)}</span>
          </div>

          {lastAttempt?.score_percentage !== undefined && lastAttempt.score_percentage !== null ? (
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground/70 font-sans">Score :</span>
              <span className="font-bold text-foreground font-mono">{lastAttempt.score_percentage}%</span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground/70 font-sans">Points :</span>
              <span className="font-medium text-foreground">{assessment.total_points} pts</span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-5 pt-0">
        {hasActiveAttempt ? (
          <Button
            size="sm"
            onClick={handlePrimaryAction}
            className="w-full cursor-pointer justify-between text-xs font-semibold h-9"
          >
            <span className="flex items-center gap-1.5">
              <Play className="size-3 fill-current" />
              <span>Continuer</span>
            </span>
            <ArrowRight className="size-3" />
          </Button>
        ) : isCompleted ? (
          <div className="flex items-center gap-2 w-full">
            <Button
              size="sm"
              variant="secondary"
              onClick={handlePrimaryAction}
              className="flex-1 cursor-pointer text-xs font-semibold h-9"
            >
              <span>Voir le résultat</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRestart}
              className="cursor-pointer text-xs h-9 px-2.5"
              aria-label="Recommencer l'évaluation"
            >
              <RotateCcw className="size-3.5" />
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant={isRecommended ? "default" : "secondary"}
            onClick={handlePrimaryAction}
            className="w-full cursor-pointer justify-between text-xs font-semibold h-9"
          >
            <span className="flex items-center gap-1">
              <span aria-hidden="true">Commencer</span>
              <span className="sr-only">Consulter et démarrer</span>
            </span>
            <ArrowRight className="size-3" />
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
