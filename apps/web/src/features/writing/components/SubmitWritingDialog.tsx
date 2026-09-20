/**
 * SubmitWritingDialog Component.
 * Confirmation modal for submitting a written attempt.
 * Displays word count verification, remaining time, correction routing selection (AI vs Teacher),
 * and submission state transitions.
 */

import React from "react"
import { CheckCircle2, Sparkles, UserCheck, AlertTriangle, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { getWordCountCategory, getWordCountStatusMessage } from "../utils/wordCounter"
import type { CorrectionType } from "../types"

export interface SubmitWritingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  wordCount: number
  minWords: number
  maxWords: number
  remainingSeconds: number
  correctionType: CorrectionType
  onSelectCorrectionType: (type: CorrectionType) => void
  onSubmit: () => Promise<void> | void
  isSubmitting: boolean
  submitSuccess?: boolean
  onViewSubmissions?: () => void
}

export const SubmitWritingDialog: React.FC<SubmitWritingDialogProps> = ({
  open,
  onOpenChange,
  wordCount,
  minWords,
  maxWords,
  remainingSeconds,
  correctionType,
  onSelectCorrectionType,
  onSubmit,
  isSubmitting,
  submitSuccess = false,
  onViewSubmissions,
}) => {
  const category = getWordCountCategory(wordCount, minWords, maxWords)
  const statusMessage = getWordCountStatusMessage(wordCount, minWords, maxWords)

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {submitSuccess ? "Essai soumis avec succès !" : "Confirmer la soumission de votre écrit"}
          </DialogTitle>
          <DialogDescription>
            {submitSuccess
              ? "Votre texte a été enregistré et transmis pour analyse."
              : "Vérifiez vos critères de conformité et choisissez votre modalité d'évaluation."}
          </DialogDescription>
        </DialogHeader>

        {submitSuccess ? (
          <div className="space-y-4 py-4 text-center">
            <div className="flex size-14 mx-auto items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <CheckCircle2 className="size-8" />
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p className="font-semibold text-sm text-foreground">
                Statut : En file d'attente
              </p>
              <p>
                {correctionType === "ai"
                  ? "L'évaluation indicative par IA sera disponible dans quelques instants."
                  : "Votre copie a été transmise au professeur référent pour annotation détaillée."}
              </p>
            </div>
            {onViewSubmissions && (
              <Button
                onClick={() => {
                  onOpenChange(false)
                  onViewSubmissions()
                }}
                className="w-full cursor-pointer mt-4"
              >
                Voir mes soumissions d'écriture
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-2 text-xs">
            {/* Word Count Compliance Summary */}
            <div
              className={`p-3.5 rounded-xl border flex flex-col gap-1.5 ${
                category === "in_range"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                  : category === "below_min"
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300"
                  : "bg-destructive/10 border-destructive/20 text-destructive"
              }`}
            >
              <div className="flex items-center justify-between font-medium">
                <span className="flex items-center gap-1.5">
                  {category !== "in_range" && <AlertTriangle className="size-3.5 shrink-0" />}
                  <span>Longueur du texte rédigé :</span>
                </span>
                <span className="font-mono font-bold">
                  {wordCount} mots (cible : {minWords}–{maxWords})
                </span>
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">{statusMessage}</p>
            </div>

            {/* Time remaining info */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5 text-primary" />
                <span>Temps restant sur l'épreuve :</span>
              </span>
              <span className="font-mono font-bold text-foreground">
                {formatTimer(remainingSeconds)}
              </span>
            </div>

            {/* Correction Routing Selection */}
            <div className="space-y-2">
              <span className="font-semibold text-foreground">
                Mode de correction souhaité :
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* AI Evaluation */}
                <button
                  type="button"
                  onClick={() => onSelectCorrectionType("ai")}
                  className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer space-y-1.5 ${
                    correctionType === "ai"
                      ? "border-primary bg-primary/10 shadow-xs"
                      : "border-border bg-card hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <Sparkles className="size-4 text-primary" />
                    <span>Évaluation IA</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Correction instantanée indicative avec identification des erreurs et estimation du niveau CECRL.
                  </p>
                  <Badge variant="secondary" size="sm" className="text-[10px]">
                    Immédiat · Inclus
                  </Badge>
                </button>

                {/* Certified Teacher */}
                <button
                  type="button"
                  onClick={() => onSelectCorrectionType("teacher")}
                  className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer space-y-1.5 ${
                    correctionType === "teacher"
                      ? "border-primary bg-primary/10 shadow-xs"
                      : "border-border bg-card hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <UserCheck className="size-4 text-emerald-500" />
                    <span>Professeur certifié</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Relecture humaine approfondie, annotations personnalisées et conseils sous 24h.
                  </p>
                  <Badge variant="outline" size="sm" className="text-[10px]">
                    Revue experte · 1 crédit
                  </Badge>
                </button>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Continuer la rédaction
              </Button>
              <Button
                onClick={() => onSubmit()}
                disabled={isSubmitting || wordCount === 0}
                className="cursor-pointer font-semibold"
              >
                {isSubmitting ? "Transmission..." : "Confirmer et soumettre"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
