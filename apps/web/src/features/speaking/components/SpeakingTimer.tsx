import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SpeakingTimerProps {
  remainingSeconds: number
  className?: string
}

export function SpeakingTimer({ remainingSeconds, className }: SpeakingTimerProps) {
  const isWarning = remainingSeconds > 0 && remainingSeconds <= 300 // < 5 min
  const isCritical = remainingSeconds > 0 && remainingSeconds <= 60 // < 1 min
  const isExpired = remainingSeconds <= 0

  const formatTimer = (secs: number) => {
    if (!secs || isNaN(secs) || secs <= 0) return "00:00"
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }

  return (
    <div
      role="timer"
      aria-label={`Temps restant : ${formatTimer(remainingSeconds)}`}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-xs font-semibold border transition-colors",
        isExpired
          ? "bg-destructive/15 text-destructive border-destructive/30"
          : isCritical
            ? "bg-destructive/10 text-destructive border-destructive/20 animate-pulse"
            : isWarning
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
              : "bg-muted/60 text-foreground border-border/80",
        className
      )}
    >
      <Clock
        className={cn(
          "size-3.5 shrink-0",
          isCritical || isExpired
            ? "text-destructive"
            : isWarning
              ? "text-amber-600 dark:text-amber-400"
              : "text-muted-foreground"
        )}
      />
      <span>{formatTimer(remainingSeconds)}</span>
    </div>
  )
}
