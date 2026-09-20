import React from "react"
import { Bookmark, BookmarkCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { QuestionRenderer } from "./QuestionRenderer"
import { cn } from "@/lib/utils"
import type { QuestionStudent } from "../types"

export interface QuestionPanelProps {
  question: QuestionStudent
  questionNumber: number
  totalQuestions: number
  selectedAnswer?: string | string[] | null
  onSelectAnswer: (value: string) => void
  isFlagged?: boolean
  onToggleFlag?: () => void
  disabled?: boolean
  className?: string
}

export const QuestionPanel: React.FC<QuestionPanelProps> = ({
  question,
  questionNumber,
  totalQuestions,
  selectedAnswer,
  onSelectAnswer,
  isFlagged = false,
  onToggleFlag,
  disabled = false,
  className,
}) => {
  return (
    <Card className={cn("border-border/80 bg-card shadow-xs", className)}>
      <CardHeader className="pb-4 border-b border-border/50">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                size="sm"
                className="text-[11px] font-bold text-primary border-primary/30 uppercase tracking-wider"
              >
                Question {questionNumber} / {totalQuestions}
              </Badge>

              {question.points > 0 && (
                <Badge variant="secondary" size="sm" className="font-mono text-xs">
                  {question.points} point{question.points > 1 ? "s" : ""}
                </Badge>
              )}
            </div>

            <CardTitle className="text-base sm:text-lg font-semibold text-foreground leading-relaxed pt-1">
              {question.prompt}
            </CardTitle>
          </div>

          {/* Flag / Bookmark for review */}
          {onToggleFlag && (
            <Button
              type="button"
              variant={isFlagged ? "secondary" : "ghost"}
              size="sm"
              onClick={onToggleFlag}
              className={cn(
                "cursor-pointer text-xs gap-1.5 shrink-0 h-8",
                isFlagged && "text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30"
              )}
              aria-label={isFlagged ? "Question marquée pour relecture" : "Marquer pour relecture"}
            >
              {isFlagged ? (
                <>
                  <BookmarkCheck className="size-3.5 fill-amber-500 text-amber-600" />
                  <span className="hidden sm:inline">Marquée</span>
                </>
              ) : (
                <>
                  <Bookmark className="size-3.5" />
                  <span className="hidden sm:inline">Marquer</span>
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        <QuestionRenderer
          question={question}
          value={selectedAnswer}
          onChange={onSelectAnswer}
          disabled={disabled}
        />
      </CardContent>
    </Card>
  )
}
