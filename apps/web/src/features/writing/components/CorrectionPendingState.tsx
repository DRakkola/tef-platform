/**
 * CorrectionPendingState Component.
 * Dedicated view rendered when a writing submission is awaiting AI or Teacher evaluation.
 * Displays submission details, candidate text (read-only), and a manual refresh action.
 */

import React from "react"
import { Clock, RotateCw, CheckCircle2, UserCheck, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export interface CorrectionPendingStateProps {
  taskTitle: string
  taskPrompt: string
  content: string
  wordCount: number
  submittedAt?: string
  status: string
  isTeacherReview?: boolean
  isRefreshing: boolean
  onRefresh: () => void
}

export const CorrectionPendingState: React.FC<CorrectionPendingStateProps> = ({
  taskTitle,
  taskPrompt,
  content,
  wordCount,
  submittedAt,
  isTeacherReview = false,
  isRefreshing,
  onRefresh,
}) => {
  const formatDate = (isoString?: string) => {
    if (!isoString) return ""
    try {
      return new Date(isoString).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return isoString
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Pending Status Notice Card */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-xs text-center space-y-4 max-w-3xl mx-auto">
        <div className="flex size-14 mx-auto items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20">
          {isTeacherReview ? (
            <UserCheck className="size-7" />
          ) : (
            <RotateCw className="size-7 animate-spin" />
          )}
        </div>

        <div className="space-y-1.5">
          <Badge variant="outline" className="text-xs mb-1">
            {isTeacherReview ? "Revue professorale" : "Traitement automatique"}
          </Badge>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            {isTeacherReview
              ? "En attente de correction par un professeur"
              : "Correction en cours"}
          </h2>
          <p className="text-xs font-semibold text-muted-foreground">
            {taskTitle}
          </p>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            {isTeacherReview
              ? "Votre copie a été transmise au corps professoral. Un enseignant certifié examine attentivement votre texte et rédige des annotations personnalisées."
              : "Votre devoir a bien été enregistré. L'analyse détaillée de votre syntaxe, vocabulaire et respect de la consigne est en cours de génération."}
          </p>
        </div>

        {/* Submission Confirmation Bar */}
        <div className="p-3.5 rounded-xl bg-muted/30 border border-border/70 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 text-foreground font-medium">
            <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Soumission confirmée</span>
          </span>
          {submittedAt && (
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-primary" />
              <span>{formatDate(submittedAt)}</span>
            </span>
          )}
          <span className="font-mono font-semibold text-foreground">
            {wordCount} mots rédigés
          </span>
        </div>

        {/* Refresh Action */}
        <div className="pt-2">
          <Button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="cursor-pointer gap-2 rounded-xl text-xs font-semibold"
          >
            <RotateCw className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "Vérification en cours..." : "Actualiser l'état"}</span>
          </Button>
        </div>
      </div>

      {/* 2. Review Submitted Copy While Waiting */}
      <div className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden max-w-4xl mx-auto">
        <div className="p-4 border-b border-border/60 bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Votre copie soumise (en lecture seule)
            </h3>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            {wordCount} mots
          </span>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          <div className="p-3 rounded-xl bg-muted/30 border border-border/60 text-xs text-muted-foreground space-y-1">
            <span className="font-semibold text-foreground block">Sujet officiel :</span>
            <p className="font-serif italic leading-relaxed">{taskPrompt}</p>
          </div>

          <div className="p-4 sm:p-6 rounded-xl bg-background border border-border/70 whitespace-pre-wrap font-sans text-sm sm:text-base leading-relaxed text-foreground select-text">
            {content}
          </div>
        </div>
      </div>
    </div>
  )
}
