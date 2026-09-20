import React from "react"
import { ArrowLeft, Menu, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ExamTimer } from "./ExamTimer"
import { ExamProgress } from "./ExamProgress"
import { SaveStatus } from "./SaveStatus"
import { cn } from "@/lib/utils"
import type { SaveStatusState, TimerSeverity } from "../types"

export interface ExamHeaderProps {
  title: string
  sectionTitle?: string
  questionNumber: number
  totalQuestions: number
  answeredCount?: number
  remainingSeconds: number | null
  timerSeverity?: TimerSeverity
  saveStatus: SaveStatusState
  isOnline?: boolean
  onExitClick?: () => void
  onSubmitClick?: () => void
  isSubmitting?: boolean
  onToggleDrawer?: () => void
  drawerOpen?: boolean
  className?: string
}

export const ExamHeader: React.FC<ExamHeaderProps> = ({
  title,
  sectionTitle,
  questionNumber,
  totalQuestions,
  answeredCount,
  remainingSeconds,
  timerSeverity = "normal",
  saveStatus,
  isOnline = true,
  onExitClick,
  onSubmitClick,
  isSubmitting = false,
  onToggleDrawer,
  drawerOpen = false,
  className,
}) => {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border/80 bg-card/95 backdrop-blur-md px-4 sm:px-6 py-3 shadow-xs",
        className
      )}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Exit button & Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {onExitClick && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onExitClick}
              className="cursor-pointer gap-1 text-xs text-muted-foreground hover:text-foreground -ml-2 h-8 px-2"
              aria-label="Quitter l'évaluation"
            >
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Quitter</span>
            </Button>
          )}

          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-foreground truncate">{title}</h1>
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
              {sectionTitle && <span>{sectionTitle}</span>}
              {sectionTitle && <span>•</span>}
              <span>
                Question {questionNumber} sur {totalQuestions}
              </span>
            </p>
          </div>
        </div>

        {/* Center: Progress & Save Status (desktop only) */}
        <div className="hidden lg:flex items-center gap-6">
          <ExamProgress
            questionNumber={questionNumber}
            totalQuestions={totalQuestions}
            answeredCount={answeredCount}
          />
          <SaveStatus status={saveStatus} isOnline={isOnline} />
        </div>

        {/* Right: Timer, Mobile Drawer Trigger, Finish Button */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <ExamTimer remainingSeconds={remainingSeconds} severity={timerSeverity} />

          {/* Mobile drawer trigger */}
          {onToggleDrawer && (
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleDrawer}
              className={cn(
                "lg:hidden px-2.5 py-1.5 text-xs rounded-xl cursor-pointer h-9",
                drawerOpen && "bg-muted"
              )}
              aria-label="Ouvrir la grille des questions"
            >
              {drawerOpen ? <X className="size-4" /> : <Menu className="size-4" />}
              {typeof answeredCount === "number" && (
                <span className="ml-1 text-[11px] font-mono">
                  {answeredCount}/{totalQuestions}
                </span>
              )}
            </Button>
          )}

          {/* Submit action in header */}
          {onSubmitClick && (
            <Button
              onClick={onSubmitClick}
              disabled={isSubmitting}
              size="sm"
              className="cursor-pointer gap-1.5 font-semibold text-xs rounded-xl h-9 shadow-xs"
            >
              <Send className="size-3.5" />
              <span className="hidden sm:inline">Terminer l'épreuve</span>
              <span className="sm:hidden">Terminer</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
