import React from "react"
import { Timer, CheckCircle2, Award, Sparkles } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import type { AssessmentDetail } from "./types"

export interface AssessmentOverviewProps {
  assessment: AssessmentDetail
}

export const AssessmentOverview: React.FC<AssessmentOverviewProps> = ({ assessment }) => {
  const durationMins =
    assessment.estimated_completion_time_minutes ||
    Math.round(assessment.duration_seconds / 60)

  return (
    <Card className="border-border/80 bg-card shadow-2xs">
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-lg font-bold text-foreground">
          À quoi vous attendre
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Timed Experience */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/50">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
              <Timer className="size-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-foreground">
                Épreuve chronométrée
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Vous disposerez de {durationMins} minutes pour compléter l'évaluation sous contraintes réelles.
              </p>
            </div>
          </div>

          {/* Continuous Autosave */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/50">
            <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="size-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-foreground">
                Sauvegarde continue
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Vos réponses sont enregistrées au fil de l'eau. En cas de déconnexion, votre session est préservée.
              </p>
            </div>
          </div>

          {/* Results & Analysis */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/50">
            <div className="size-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
              <Award className="size-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-foreground">
                Résultats immédiats
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Votre score, équivalence NCLC et analyse des erreurs sont calculés dès votre soumission.
              </p>
            </div>
          </div>

          {/* Personalized Insights */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/50">
            <div className="size-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="size-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-foreground">
                Progression personnalisée
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Vos résultats calibreront votre jauge de préparation et recommanderont vos prochains exercices.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
