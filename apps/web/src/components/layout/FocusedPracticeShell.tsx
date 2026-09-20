/**
 * FocusedPracticeShell Component.
 * Distraction-free, calm, and centered workspace for student practice exercises.
 * Unlike the high-stakes exam shell, this layout prioritizes comfortable reading,
 * immediate pedagogical feedback, and low-friction repetition.
 */

import React from "react"
import { ArrowLeft, Clock, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface FocusedPracticeShellProps {
  title: string
  category?: string
  level?: string
  estimatedDurationMinutes?: number
  questionNumber?: number
  totalQuestions?: number
  onExitClick?: () => void
  children: React.ReactNode
  className?: string
}

export const FocusedPracticeShell: React.FC<FocusedPracticeShellProps> = ({
  title,
  category,
  level,
  estimatedDurationMinutes,
  questionNumber,
  totalQuestions,
  onExitClick,
  children,
  className,
}) => {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans antialiased">
      {/* 1. Practice Header */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-card/90 backdrop-blur-md px-4 sm:px-6 py-3 shadow-xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          {/* Back / Exit Button & Title Info */}
          <div className="flex items-center gap-3 min-w-0">
            {onExitClick && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onExitClick}
                className="cursor-pointer gap-1.5 text-xs text-muted-foreground hover:text-foreground -ml-2"
                aria-label="Quitter l'exercice et retourner au catalogue"
              >
                <ArrowLeft className="size-4" />
                <span className="hidden sm:inline">Pratique</span>
              </Button>
            )}

            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                {category && (
                  <Badge
                    variant="outline"
                    size="sm"
                    className="capitalize font-semibold text-[11px] bg-primary/5 text-primary border-primary/20"
                  >
                    {category}
                  </Badge>
                )}
                {level && (
                  <Badge variant="secondary" size="sm" className="font-bold text-[11px]">
                    {level}
                  </Badge>
                )}
                {estimatedDurationMinutes && (
                  <span className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="size-3" />
                    <span>~{estimatedDurationMinutes} min</span>
                  </span>
                )}
              </div>
              <h1 className="text-sm sm:text-base font-bold text-foreground truncate tracking-tight">
                {title}
              </h1>
            </div>
          </div>

          {/* Right Header: Question Counter or Practice Mode Badge */}
          <div className="flex items-center gap-3 shrink-0">
            {typeof questionNumber === "number" && typeof totalQuestions === "number" ? (
              <div className="text-right">
                <span className="text-xs font-mono font-semibold text-muted-foreground">
                  Question <strong className="text-foreground">{questionNumber}</strong> / {totalQuestions}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Sparkles className="size-3.5 text-primary" />
                <span className="hidden sm:inline">Entraînement guidé</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. Focused Workspace */}
      <main className={cn("flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10", className)}>
        {children}
      </main>
    </div>
  )
}
