/**
 * ExerciseFeedback Component.
 * Immediate, constructive pedagogical feedback banner.
 * Uses calm, non-punitive terminology ("Bonne réponse" / "Pas tout à fait").
 */

import React from "react"
import { CheckCircle2, AlertCircle, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ExerciseAttemptResult } from "../types"

export interface ExerciseFeedbackProps {
  result: ExerciseAttemptResult | null
  showCorrectAnswer?: boolean
  className?: string
}

export const ExerciseFeedback: React.FC<ExerciseFeedbackProps> = ({
  result,
  showCorrectAnswer = true,
  className,
}) => {
  if (!result) return null

  const isCorrect = result.is_correct
  const srText = isCorrect
    ? `Bonne réponse ! ${result.points_awarded > 0 ? `Vous gagnez ${result.points_awarded} points.` : ""}`
    : `Pas tout à fait. ${result.correct_answer ? `La bonne réponse est : ${result.correct_answer}.` : ""}`

  return (
    <div
      role="region"
      aria-label="Retour d'évaluation de votre réponse"
      className={cn(
        "rounded-xl border p-4 sm:p-5 space-y-2.5 transition-all shadow-2xs",
        isCorrect
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
          : "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200",
        className
      )}
    >
      {/* Screen-reader announcement (polite, once) */}
      <div role="status" aria-live="polite" className="sr-only">
        {srText}
      </div>

      {/* Main Feedback Heading */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
          {isCorrect ? (
            <>
              <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Bonne réponse !</span>
            </>
          ) : (
            <>
              <AlertCircle className="size-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Pas tout à fait</span>
            </>
          )}
        </div>

        {isCorrect && result.points_awarded > 0 && (
          <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-2.5 py-0.5 rounded-full">
            <Sparkles className="size-3" />
            <span>+{result.points_awarded} pts</span>
          </div>
        )}
      </div>

      {/* Correct Answer Display (if incorrect & allowed by backend) */}
      {!isCorrect && showCorrectAnswer && result.correct_answer && (
        <div className="text-xs sm:text-sm font-medium pt-1 border-t border-amber-500/20">
          <span className="text-muted-foreground">Bonne réponse : </span>
          <strong className="text-foreground font-semibold">{result.correct_answer}</strong>
        </div>
      )}
    </div>
  )
}
