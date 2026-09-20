import React from "react"
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  RotateCw,
  Send,
  WifiOff,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface FocusedWritingShellProps {
  title: string
  sectionBadge?: string
  remainingSeconds: number
  saveStatus: "saved" | "saving" | "offline" | "error"
  onExitClick: () => void
  onSubmitClick: () => void
  isSubmitting?: boolean
  isReadOnly?: boolean
  children: React.ReactNode
}

export function FocusedWritingShell({
  title,
  sectionBadge,
  remainingSeconds,
  saveStatus,
  onExitClick,
  onSubmitClick,
  isSubmitting = false,
  isReadOnly = false,
  children,
}: FocusedWritingShellProps) {
  const isTimeCritical = remainingSeconds < 300 && remainingSeconds > 0 // < 5 min

  const formatTimer = (secs: number) => {
    if (!secs || isNaN(secs) || secs <= 0) return "00:00"
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased">
      {/* Distraction-Free Header */}
      <header className="h-14 border-b border-border/80 bg-card/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onExitClick}
            className="cursor-pointer gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            <span>Quitter</span>
          </Button>

          <span className="hidden sm:inline text-xs text-muted-foreground">|</span>

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs sm:text-sm font-semibold text-foreground truncate max-w-xs sm:max-w-md">
              {title}
            </span>
            {sectionBadge && (
              <Badge variant="outline" size="sm" className="hidden sm:inline-flex text-[11px]">
                {sectionBadge}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          {/* Autosave badge */}
          <div className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
            {saveStatus === "saving" ? (
              <>
                <RotateCw className="size-3 animate-spin text-primary" />
                <span className="hidden sm:inline">Enregistrement...</span>
              </>
            ) : saveStatus === "offline" ? (
              <>
                <WifiOff className="size-3 text-amber-600 dark:text-amber-400" />
                <span className="hidden sm:inline text-amber-600 dark:text-amber-400">Hors ligne</span>
              </>
            ) : saveStatus === "error" ? (
              <>
                <AlertCircle className="size-3 text-destructive" />
                <span className="hidden sm:inline text-destructive">Erreur</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">Sauvegardé</span>
              </>
            )}
          </div>

          {/* Calm Timer */}
          <div
            role="timer"
            aria-live="polite"
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-xl border font-mono text-xs font-bold shadow-2xs",
              remainingSeconds <= 0
                ? "border-destructive/60 bg-destructive/15 text-destructive"
                : isTimeCritical
                ? "border-destructive/40 bg-destructive/10 text-destructive animate-pulse"
                : "border-border/80 bg-muted/50 text-foreground"
            )}
          >
            <Clock className="size-3.5" />
            <span>{formatTimer(remainingSeconds)}</span>
          </div>

          {/* Submit CTA or Read-Only Status */}
          {isReadOnly ? (
            <Badge variant="secondary" className="text-xs px-2.5 py-1">
              Lecture seule
            </Badge>
          ) : (
            <Button
              size="sm"
              onClick={onSubmitClick}
              disabled={isSubmitting}
              className="cursor-pointer gap-1.5 font-semibold text-xs rounded-xl"
            >
              <Send className="size-3.5" />
              <span>Soumettre</span>
            </Button>
          )}
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  )
}
