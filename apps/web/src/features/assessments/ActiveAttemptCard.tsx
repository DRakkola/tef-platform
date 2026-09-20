import React from "react"
import { useNavigate } from "react-router-dom"
import { Clock, Play, Headphones, BookOpen, Layers } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { telemetry } from "@/features/analytics/telemetry"
import type { ActiveAttemptSummary } from "./types"

export interface ActiveAttemptCardProps {
  attempt: ActiveAttemptSummary
  onResume?: (attempt: ActiveAttemptSummary) => void
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

export const ActiveAttemptCard: React.FC<ActiveAttemptCardProps> = ({
  attempt,
  onResume,
}) => {
  const navigate = useNavigate()

  const handleResume = () => {
    telemetry.track("assessment_resume_clicked", {
      attemptId: attempt.id,
      assessmentId: attempt.assessment_id,
    })
    if (onResume) {
      onResume(attempt)
    } else {
      navigate(`/attempts/${attempt.id}`)
    }
  }

  const isListening = attempt.assessment_type === "listening"
  const isReading = attempt.assessment_type === "reading"
  const TypeIcon = isListening ? Headphones : isReading ? BookOpen : Layers

  return (
    <Card
      data-testid="active-attempt-card"
      className="border-primary/40 bg-gradient-to-r from-primary/10 via-card to-card shadow-xs"
    >
      <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="size-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
            <TypeIcon className="size-5" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="default" className="text-[10px] uppercase font-bold tracking-wider bg-primary text-primary-foreground">
                Évaluation en cours
              </Badge>
              <Badge variant="outline" className="font-mono text-xs font-semibold">
                Niveau {attempt.level}
              </Badge>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-foreground">
              {attempt.title}
            </h3>

            <div className="flex items-center gap-3 text-xs text-muted-foreground pt-0.5">
              <span className="flex items-center gap-1 font-medium text-foreground font-mono tabular-nums">
                <Clock className="size-3.5 text-primary" />
                Temps restant : {formatRemainingTime(attempt.remaining_seconds)}
              </span>
              {attempt.total_questions > 0 && (
                <>
                  <span className="text-muted-foreground/60">•</span>
                  <span className="font-mono tabular-nums">
                    {attempt.answered_count} / {attempt.total_questions} questions répondues
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0">
          <Button
            onClick={handleResume}
            className="w-full sm:w-auto cursor-pointer gap-2 font-semibold shadow-xs"
          >
            <Play className="size-4 fill-current" />
            <span>Continuer l'évaluation</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
