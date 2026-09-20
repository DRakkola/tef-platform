import React from "react"
import { cn } from "@/lib/utils"

export interface ExamProgressProps {
  questionNumber: number
  totalQuestions: number
  answeredCount?: number
  className?: string
}

export const ExamProgress: React.FC<ExamProgressProps> = ({
  questionNumber,
  totalQuestions,
  answeredCount,
  className,
}) => {
  if (totalQuestions <= 0) return null

  const progressPercentage = Math.min(
    100,
    Math.round(((answeredCount ?? questionNumber) / totalQuestions) * 100)
  )

  return (
    <div className={cn("flex flex-col gap-1.5 min-w-[120px] sm:min-w-[160px]", className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">
          Question {questionNumber} / {totalQuestions}
        </span>
        {typeof answeredCount === "number" && (
          <span className="font-mono text-[11px]">
            {answeredCount} répondu{answeredCount > 1 ? "es" : "e"}
          </span>
        )}
      </div>

      <div
        role="progressbar"
        aria-valuenow={progressPercentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progression : ${progressPercentage}%`}
        className="w-full h-1.5 rounded-full bg-muted overflow-hidden"
      >
        <div
          className="h-full bg-primary transition-all duration-300 rounded-full"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
    </div>
  )
}
