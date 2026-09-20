import React from "react"
import { useNavigate } from "react-router-dom"
import { Play, ArrowRight, RotateCcw, AlertCircle, Clock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { AssessmentDetail, ActiveAttemptSummary, AssessmentHistoryItem } from "./types"

export interface AssessmentPrimaryActionProps {
  assessment: AssessmentDetail
  activeAttempt?: ActiveAttemptSummary | null
  lastAttempt?: AssessmentHistoryItem | null
  isStarting?: boolean
  actionError?: string | null
  onStart: () => void
  onResume?: (attemptId: string) => void
}

function formatRemainingTime(seconds: number): string {
  if (seconds <= 0) return "Temps écoulé"
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins >= 60) {
    const hours = Math.floor(mins / 60)
    const remMins = mins % 60
    return `${hours} h ${remMins} min`
  }
  if (mins > 0) {
    return `${mins} min`
  }
  return `${secs} s`
}

export const AssessmentPrimaryAction: React.FC<AssessmentPrimaryActionProps> = ({
  assessment,
  activeAttempt,
  lastAttempt,
  isStarting = false,
  actionError,
  onStart,
  onResume,
}) => {
  const navigate = useNavigate()

  const isCurrentActive = Boolean(
    activeAttempt && activeAttempt.assessment_id === assessment.id
  )
  const isCompleted = Boolean(!isCurrentActive && lastAttempt?.status === "submitted")

  const handleResume = () => {
    if (!activeAttempt) return
    if (onResume) {
      onResume(activeAttempt.id)
    } else {
      navigate(`/attempts/${activeAttempt.id}`)
    }
  }

  return (
    <Card className="border-border/80 bg-card shadow-sm overflow-hidden">
      <CardContent className="p-5 sm:p-6 space-y-4">
        {/* Active Attempt Banner if this assessment is in-progress */}
        {isCurrentActive && activeAttempt && (
          <div
            data-testid="active-attempt-banner"
            className="p-4 rounded-xl bg-primary/10 border border-primary/30 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="gap-1 text-[11px] font-semibold animate-pulse">
                  <Play className="size-3 fill-current" />
                  <span>Session en cours</span>
                </Badge>
              </div>
              <span className="font-mono text-xs font-bold text-primary flex items-center gap-1">
                <Clock className="size-3.5" />
                <span>Temps restant : {formatRemainingTime(activeAttempt.remaining_seconds)}</span>
              </span>
            </div>
            <p className="text-xs text-foreground/80 leading-relaxed">
              Vous avez une tentative non terminée sur cette simulation ({activeAttempt.answered_count} / {activeAttempt.total_questions} questions traitées).
            </p>
          </div>
        )}

        {/* Action Error Notification */}
        {actionError && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-start gap-2">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {isCurrentActive ? (
            <Button
              size="lg"
              onClick={handleResume}
              className="w-full cursor-pointer justify-between text-sm font-semibold h-11 shadow-xs"
            >
              <span className="flex items-center gap-2">
                <Play className="size-4 fill-current" />
                <span>Continuer l'évaluation</span>
              </span>
              <ArrowRight className="size-4" />
            </Button>
          ) : isCompleted ? (
            <div className="space-y-2">
              <Button
                size="lg"
                onClick={onStart}
                disabled={isStarting}
                className="w-full cursor-pointer justify-between text-sm font-semibold h-11 shadow-xs"
              >
                <span className="flex items-center gap-2">
                  <RotateCcw className="size-4" />
                  <span>Recommencer l'évaluation</span>
                </span>
                <ArrowRight className="size-4" />
              </Button>

              {lastAttempt && (
                <Button
                  variant="outline"
                  onClick={() => navigate(`/attempts/${lastAttempt.id}/results`)}
                  className="w-full cursor-pointer justify-center text-xs font-medium h-9"
                >
                  <span>Voir mon dernier résultat ({lastAttempt.score_percentage}%)</span>
                </Button>
              )}
            </div>
          ) : (
            <Button
              size="lg"
              onClick={onStart}
              disabled={isStarting}
              className="w-full cursor-pointer justify-between text-sm font-semibold h-11 shadow-xs"
            >
              {isStarting ? (
                <span className="flex items-center gap-2">
                  <div className="size-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  <span>Initialisation de la session...</span>
                </span>
              ) : (
                <>
                  <span className="flex items-center gap-2">
                    <Play className="size-4 fill-current" />
                    <span>
                      <span>Commencer l'évaluation</span>
                      <span className="sr-only">Démarrer l'épreuve maintenant</span>
                    </span>
                  </span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          )}

          {/* Submission Notice */}
          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
            Une fois l'évaluation soumise, vos réponses ne pourront plus être modifiées.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
