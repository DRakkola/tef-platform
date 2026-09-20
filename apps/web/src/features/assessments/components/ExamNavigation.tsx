import React from "react"
import { ArrowLeft, ArrowRight, Send } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface ExamNavigationProps {
  isFirstQuestion: boolean
  isLastQuestion: boolean
  onPrevious: () => void
  onNext: () => void
  onSubmit: () => void
  disabled?: boolean
  canGoBack?: boolean
}

export const ExamNavigation: React.FC<ExamNavigationProps> = ({
  isFirstQuestion,
  isLastQuestion,
  onPrevious,
  onNext,
  onSubmit,
  disabled = false,
  canGoBack = true,
}) => {
  return (
    <div className="flex items-center justify-between pt-4 border-t border-border/60 gap-3">
      <Button
        type="button"
        onClick={onPrevious}
        disabled={isFirstQuestion || !canGoBack || disabled}
        variant="outline"
        size="sm"
        className="cursor-pointer text-xs gap-1.5 h-10 px-3.5"
      >
        <ArrowLeft className="size-3.5" />
        <span>Question précédente</span>
      </Button>

      {isLastQuestion ? (
        <Button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          size="sm"
          className="cursor-pointer text-xs font-semibold gap-1.5 h-10 px-4 shadow-xs"
        >
          <span>Vérifier et soumettre</span>
          <Send className="size-3.5" />
        </Button>
      ) : (
        <Button
          type="button"
          onClick={onNext}
          disabled={disabled}
          size="sm"
          className="cursor-pointer text-xs font-medium gap-1.5 h-10 px-4 shadow-xs"
        >
          <span>Question suivante</span>
          <ArrowRight className="size-3.5" />
        </Button>
      )}
    </div>
  )
}
