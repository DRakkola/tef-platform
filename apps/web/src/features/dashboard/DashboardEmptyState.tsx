/**
 * Empty state component for new students with no assessment history.
 * Adheres to the TEF design system using semantic tokens and crisp card surface.
 */

import React from "react"
import { Compass, BookOpen, Target, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface DashboardEmptyStateProps {
  studentName: string
  targetExam: string
  targetLevel: string
  onStartDiagnostic?: () => void
}

export const DashboardEmptyState: React.FC<DashboardEmptyStateProps> = ({
  studentName,
  targetExam,
  targetLevel,
  onStartDiagnostic,
}) => {
  return (
    <div
      data-testid="dashboard-empty-state"
      className="flex flex-col items-center justify-center rounded-2xl border border-border/70 bg-card p-8 sm:p-10 text-center shadow-2xs max-w-2xl mx-auto my-8 sm:my-12"
    >
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-8 ring-primary/5 mb-6">
        <Compass className="size-8" aria-hidden="true" />
      </div>

      <h2 className="text-2xl font-bold tracking-tight text-foreground">
        Bienvenue, {studentName} !
      </h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md leading-relaxed">
        Votre plan de préparation pour le <span className="font-semibold text-foreground">{targetExam}</span> visant le niveau{" "}
        <span className="inline-block rounded bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary font-mono">
          {targetLevel}
        </span>{" "}
        est initialisé.
      </p>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full text-left">
        <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <Target className="size-4" aria-hidden="true" />
            <span>Étalonnage initial</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Passez votre premier test diagnostic pour calculer la précision de vos compétences.
          </p>
        </div>

        <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
            <Sparkles className="size-4" aria-hidden="true" />
            <span>Recommandations</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Le moteur pédagogique déterminera automatiquement vos points faibles prioritaires.
          </p>
        </div>
      </div>

      <div className="mt-8 flex gap-3">
        <Button
          size="lg"
          onClick={onStartDiagnostic}
          className="font-medium px-6 py-2.5 rounded-lg flex items-center gap-2 shadow-xs cursor-pointer"
        >
          <BookOpen className="size-4" aria-hidden="true" />
          <span>Démarrer un test diagnostique</span>
        </Button>
      </div>
    </div>
  )
}
