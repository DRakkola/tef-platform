import React from "react"
import {
  Clock,
  WifiOff,
  RotateCw,
  CheckCircle2,
  Menu,
  X,
  Send,
  ArrowLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface FocusedExamShellProps {
  title: string
  sectionTitle?: string
  questionNumber?: number
  totalQuestions?: number
  remainingSeconds: number | null
  isOnline?: boolean
  saveStatus?: "saved" | "saving" | "offline" | "error"
  onExitClick?: () => void
  onSubmitClick?: () => void
  isSubmitting?: boolean
  submitLabel?: string
  onTogglePalette?: () => void
  paletteOpen?: boolean
  answeredCount?: number
  children: React.ReactNode
}

export function FocusedExamShell({
  title,
  sectionTitle,
  questionNumber,
  totalQuestions,
  remainingSeconds,
  isOnline = true,
  saveStatus = "saved",
  onExitClick,
  onSubmitClick,
  isSubmitting = false,
  submitLabel = "Terminer l'épreuve",
  onTogglePalette,
  paletteOpen = false,
  answeredCount,
  children,
}: FocusedExamShellProps) {
  const isTimeCritical = remainingSeconds !== null && remainingSeconds < 60
  const isTimeLow = remainingSeconds !== null && remainingSeconds < 300 && !isTimeCritical

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans select-none antialiased">
      {/* 1. Distraction-Free Focused Header */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-card/90 backdrop-blur-md px-4 sm:px-6 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Title & Section Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            {onExitClick && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onExitClick}
                className="cursor-pointer gap-1 text-xs text-muted-foreground hover:text-foreground -ml-2"
                aria-label="Quitter l'épreuve"
              >
                <ArrowLeft className="size-4" />
                <span className="hidden sm:inline">Quitter</span>
              </Button>
            )}
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-foreground truncate">{title}</h1>
              {(sectionTitle || (questionNumber && totalQuestions)) && (
                <p className="text-xs text-muted-foreground truncate">
                  {sectionTitle}
                  {sectionTitle && questionNumber && " • "}
                  {questionNumber && totalQuestions && `Question ${questionNumber} sur ${totalQuestions}`}
                </p>
              )}
            </div>
          </div>

          {/* Sync Status Indicator */}
          <div className="hidden md:flex items-center gap-2 text-xs font-medium">
            {!isOnline ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                <WifiOff className="size-3" />
                <span>Hors ligne (local)</span>
              </span>
            ) : saveStatus === "saving" ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning/15 text-warning-foreground border border-warning/30 animate-pulse">
                <RotateCw className="size-3 animate-spin text-warning" />
                <span>Synchronisation...</span>
              </span>
            ) : saveStatus === "offline" ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning/15 text-warning-foreground border border-warning/30">
                <WifiOff className="size-3" />
                <span>Stockage local actif</span>
              </span>
            ) : saveStatus === "error" ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                <span>Erreur d'enregistrement</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 text-muted-foreground border border-border/60">
                <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" />
                <span>Réponses sécurisées</span>
              </span>
            )}
          </div>

          {/* Controls: Timer & Submit Action */}
          <div className="flex items-center gap-2 sm:gap-3">
            {remainingSeconds !== null && (
              <div
                role="timer"
                aria-live="polite"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono text-xs sm:text-sm font-bold tracking-tight shadow-2xs",
                  isTimeCritical
                    ? "border-destructive/60 bg-destructive/15 text-destructive animate-pulse"
                    : isTimeLow
                    ? "border-warning/60 bg-warning/15 text-warning-foreground"
                    : "border-border/80 bg-muted/50 text-foreground"
                )}
              >
                <Clock className="size-3.5 sm:size-4" />
                <span>{formatTimer(remainingSeconds)}</span>
              </div>
            )}

            {onTogglePalette && (
              <Button
                variant="outline"
                size="sm"
                onClick={onTogglePalette}
                className={cn(
                  "lg:hidden px-2.5 py-1.5 text-xs rounded-xl cursor-pointer",
                  paletteOpen && "bg-muted"
                )}
                aria-label="Grille des questions"
              >
                {paletteOpen ? <X className="size-4" /> : <Menu className="size-4" />}
                {typeof answeredCount === "number" && typeof totalQuestions === "number" && (
                  <span className="ml-1 text-[11px] font-mono">
                    {answeredCount}/{totalQuestions}
                  </span>
                )}
              </Button>
            )}

            {onSubmitClick && (
              <Button
                onClick={onSubmitClick}
                disabled={isSubmitting}
                size="sm"
                className="cursor-pointer gap-1.5 font-semibold text-xs rounded-xl"
              >
                <Send className="size-3.5" />
                <span className="hidden sm:inline">{submitLabel}</span>
                <span className="sm:hidden">Terminer</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* 2. Main Exam Canvas */}
      <div className="flex-1 flex overflow-hidden">{children}</div>
    </div>
  )
}
