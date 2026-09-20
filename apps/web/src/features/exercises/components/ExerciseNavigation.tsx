/**
 * ExerciseNavigation Component.
 * Dynamic action bar supporting answer validation, retries, and progression.
 */

import React from "react"
import { ArrowRight, RotateCcw, Check, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ExerciseState } from "../types"

export interface ExerciseNavigationProps {
  state: ExerciseState
  isAnswered: boolean
  isCorrect?: boolean
  onSubmit: () => void
  onRetry?: () => void
  onContinue: () => void
  allowRetry?: boolean
  isSubmitting?: boolean
  className?: string
}

export const ExerciseNavigation: React.FC<ExerciseNavigationProps> = ({
  state,
  isAnswered,
  isCorrect = false,
  onSubmit,
  onRetry,
  onContinue,
  allowRetry = true,
  isSubmitting = false,
  className,
}) => {
  const isFeedback = state === "feedback"

  return (
    <div className={cn("flex items-center gap-3 pt-2", className)}>
      {!isFeedback ? (
        /* Pre-submission: Check Answer CTA */
        <Button
          onClick={onSubmit}
          disabled={!isAnswered || isSubmitting}
          size="lg"
          className="w-full cursor-pointer rounded-xl font-semibold gap-2 shadow-xs transition-all"
        >
          {isSubmitting ? (
            <>
              <RotateCw className="size-4 animate-spin" />
              <span>Vérification...</span>
            </>
          ) : (
            <>
              <Check className="size-4" />
              <span>Vérifier ma réponse</span>
            </>
          )}
        </Button>
      ) : (
        /* Post-submission: Continue / Retry Actions */
        <div className="flex items-center gap-3 w-full">
          {!isCorrect && allowRetry && onRetry && (
            <Button
              variant="outline"
              size="lg"
              onClick={onRetry}
              className="flex-1 cursor-pointer rounded-xl font-semibold gap-2 border-border/80 hover:bg-muted"
            >
              <RotateCcw className="size-4" />
              <span>Réessayer</span>
            </Button>
          )}

          <Button
            onClick={onContinue}
            size="lg"
            className={cn(
              "cursor-pointer rounded-xl font-semibold gap-2 shadow-xs",
              !isCorrect && allowRetry ? "flex-1" : "w-full"
            )}
          >
            <span>Continuer</span>
            <ArrowRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
