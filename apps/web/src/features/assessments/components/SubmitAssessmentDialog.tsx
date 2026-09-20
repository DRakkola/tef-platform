import React from "react"
import { Send, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export interface SubmitAssessmentDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isSubmitting: boolean
  answeredCount: number
  totalQuestions: number
}

export const SubmitAssessmentDialog: React.FC<SubmitAssessmentDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
  answeredCount,
  totalQuestions,
}) => {
  if (!isOpen) return null

  const unansweredCount = Math.max(0, totalQuestions - answeredCount)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in"
    >
      <Card className="max-w-md w-full border-border/80 bg-card shadow-2xl animate-in zoom-in-95">
        <CardHeader className="space-y-2">
          <CardTitle id="submit-dialog-title" className="text-lg font-bold text-foreground">
            Confirmer la soumission finale ?
          </CardTitle>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Vous avez répondu à <strong className="text-foreground">{answeredCount}</strong> sur{" "}
            <strong className="text-foreground">{totalQuestions}</strong> questions.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {unansweredCount > 0 && (
            <div
              role="alert"
              className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3.5 flex items-start gap-2.5 text-xs text-foreground"
            >
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-amber-800 dark:text-amber-300">
                  {unansweredCount} question{unansweredCount > 1 ? "s" : ""} sans réponse.
                </span>
                <p className="text-muted-foreground mt-0.5">
                  Vous pouvez soumettre dès maintenant ou reprendre l'épreuve pour compléter vos réponses.
                </p>
              </div>
            </div>
          )}

          <div className="rounded-xl bg-muted/40 p-4 border border-border/60 text-xs text-muted-foreground leading-relaxed">
            Une fois validée, votre copie sera immédiatement notée selon les grilles d'évaluation officielles. Vous ne pourrez plus modifier vos réponses.
          </div>
        </CardContent>

        <div className="flex justify-end gap-3 p-6 pt-0">
          <Button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            variant="outline"
            size="sm"
            className="cursor-pointer text-xs h-9 px-4"
          >
            Reprendre l'épreuve
          </Button>

          <Button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            size="sm"
            className="cursor-pointer text-xs font-semibold gap-1.5 h-9 px-4 shadow-xs"
          >
            {isSubmitting ? (
              <>
                <div className="size-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                <span>Notation en cours...</span>
              </>
            ) : (
              <>
                <Send className="size-3.5" />
                <span>Confirmer et soumettre</span>
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  )
}
