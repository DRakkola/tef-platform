import React, { useMemo } from "react"
import { Clock, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TimerSeverity } from "../types"

export interface ExamTimerProps {
  remainingSeconds: number | null
  severity?: TimerSeverity
  className?: string
}

export function formatTime(seconds: number): string {
  if (seconds <= 0) return "00:00"
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

export const ExamTimer: React.FC<ExamTimerProps> = ({
  remainingSeconds,
  severity = "normal",
  className,
}) => {
  const isExpired = severity === "expired" || (remainingSeconds !== null && remainingSeconds <= 0)
  const isCritical = severity === "critical" || (remainingSeconds !== null && remainingSeconds <= 60 && !isExpired)
  const isWarning = severity === "warning" || (remainingSeconds !== null && remainingSeconds <= 300 && !isCritical && !isExpired)

  // Screen-reader announcement for key milestones
  const screenReaderAnnouncement = useMemo(() => {
    if (isExpired) return "Temps d'examen écoulé. L'évaluation est en cours de finalisation."
    if (remainingSeconds === 300) return "Attention, il reste 5 minutes."
    if (remainingSeconds === 60) return "Attention, il reste 1 minute avant la fin de l'évaluation."
    return null
  }, [remainingSeconds, isExpired])

  if (remainingSeconds === null) return null

  return (
    <div
      role="timer"
      aria-label="Temps restant"
      aria-live="polite"
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono text-xs sm:text-sm font-bold tracking-tight transition-colors shadow-2xs",
        isExpired
          ? "border-destructive/80 bg-destructive/20 text-destructive"
          : isCritical
          ? "border-destructive/60 bg-destructive/15 text-destructive"
          : isWarning
          ? "border-warning/60 bg-warning/15 text-warning-foreground"
          : "border-border/80 bg-muted/50 text-foreground",
        className
      )}
    >
      {isCritical ? (
        <AlertTriangle className="size-3.5 sm:size-4 shrink-0 text-destructive animate-pulse" />
      ) : (
        <Clock className="size-3.5 sm:size-4 shrink-0" />
      )}

      <span>{isExpired ? "Temps écoulé" : formatTime(remainingSeconds)}</span>

      {screenReaderAnnouncement && (
        <span className="sr-only" role="status">
          {screenReaderAnnouncement}
        </span>
      )}
    </div>
  )
}
