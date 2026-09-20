import React from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { ActiveQuestionItem } from "../types"

export interface QuestionNavigatorProps {
  allQuestions: ActiveQuestionItem[]
  activeQuestionIndex: number
  answersMap: Record<string, any>
  flaggedQuestions?: Set<string>
  onSelectQuestion: (index: number) => void
  isOpen?: boolean
  onClose?: () => void
  mode?: "inline" | "drawer"
  className?: string
}

export const QuestionNavigator: React.FC<QuestionNavigatorProps> = ({
  allQuestions,
  activeQuestionIndex,
  answersMap,
  flaggedQuestions,
  onSelectQuestion,
  isOpen = false,
  onClose,
  mode = "inline",
  className,
}) => {
  const answeredCount = Object.keys(answersMap).length
  const total = allQuestions.length
  const progressPercent = total > 0 ? Math.round((answeredCount / total) * 100) : 0

  const content = (
    <Card className="border-border/80 bg-card shadow-xs h-full flex flex-col">
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-bold text-foreground uppercase tracking-wider">
            Grille des questions
          </CardTitle>
          {onClose && (
            <Button
              type="button"
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="text-muted-foreground p-1 h-7 w-7 cursor-pointer"
              aria-label="Fermer la grille"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4 flex-1 overflow-y-auto">
        {/* Progress metrics */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progression</span>
            <span className="font-semibold text-foreground font-mono">
              {answeredCount} / {total} ({progressPercent}%)
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="w-full h-2 rounded-full bg-muted overflow-hidden"
          >
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground py-2 border-y border-border/60">
          <div className="flex items-center gap-1.5">
            <div className="size-2.5 rounded-md bg-primary" />
            <span>Répondue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="size-2.5 rounded-md border border-border bg-muted/60" />
            <span>Non répondue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="size-2.5 rounded-md ring-2 ring-primary border border-background bg-primary/20" />
            <span>Question active</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="size-2.5 rounded-md bg-amber-500" />
            <span>Marquée</span>
          </div>
        </div>

        {/* Numbered Palette Grid */}
        <div
          role="navigation"
          aria-label="Navigation des questions"
          className="grid grid-cols-5 gap-2 pr-1"
        >
          {allQuestions.map((item, idx) => {
            const isAnswered = answersMap[item.question.id] !== undefined
            const isCurrent = idx === activeQuestionIndex
            const isFlagged = flaggedQuestions?.has(item.question.id)

            const accessibleLabel = `Question ${idx + 1}, ${
              isAnswered ? "répondue" : "non répondue"
            }${isFlagged ? ", marquée pour relecture" : ""}${isCurrent ? ", active" : ""}`

            return (
              <button
                key={item.question.id}
                type="button"
                onClick={() => {
                  onSelectQuestion(idx)
                  if (onClose) onClose()
                }}
                aria-label={accessibleLabel}
                aria-current={isCurrent ? "true" : undefined}
                className={cn(
                  "relative h-9 rounded-lg border text-xs font-semibold flex items-center justify-center transition-all cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
                  isAnswered
                    ? "border-primary bg-primary text-primary-foreground shadow-2xs font-bold"
                    : "border-border/80 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                  isCurrent && "ring-2 ring-primary ring-offset-2 ring-offset-background font-black",
                  isFlagged && "border-amber-500 font-bold"
                )}
              >
                {idx + 1}
                {isFlagged && (
                  <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-amber-500 border border-card" />
                )}
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )

  if (mode === "drawer") {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Grille des questions"
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-80 p-4 transition-transform bg-background/95 backdrop-blur-md shadow-2xl",
          isOpen ? "translate-x-0" : "translate-x-full pointer-events-none",
          className
        )}
      >
        {content}
      </div>
    )
  }

  return <div className={cn("w-full h-full", className)}>{content}</div>
}
