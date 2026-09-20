import { useNavigate } from "react-router-dom"
import { CheckCircle2, RotateCcw, LayoutDashboard, Sparkles, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import type { SpeakingEvaluation } from "../types"

export interface SpeakingSessionCompleteProps {
  evaluation?: SpeakingEvaluation | null
  isExpired?: boolean
  onRestart?: () => void
}

export function SpeakingSessionComplete({
  evaluation,
  isExpired = false,
  onRestart,
}: SpeakingSessionCompleteProps) {
  const navigate = useNavigate()

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
      <Card className="border-border shadow-sm">
        <CardHeader className="text-center pb-3">
          <div className="size-14 mx-auto rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-2">
            <CheckCircle2 className="size-8" />
          </div>
          <CardTitle className="text-xl">
            {isExpired ? "Temps écoulé · Entretien terminé" : "Session terminée avec succès"}
          </CardTitle>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {isExpired
              ? "Le temps imparti pour cette session orale est écoulé. Vos flux ont été arrêtés et votre participation enregistrée."
              : "Votre entretien oral s'est achevé. Les flux audio ont été coupés et l'évaluation a été finalisée."}
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {evaluation ? (
            <div className="space-y-6">
              {/* Score & CEFR Header */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-center sm:text-left">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Niveau estimé
                  </span>
                  <div className="flex items-center gap-2 justify-center sm:justify-start mt-0.5">
                    <span className="text-2xl font-black text-foreground">
                      {evaluation.estimated_level}
                    </span>
                    <Badge variant="default" className="text-xs font-mono font-bold">
                      {Math.round(evaluation.overall_score)}/100
                    </Badge>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground max-w-xs text-center sm:text-right">
                  <span className="font-semibold text-foreground block">
                    Score d'entraînement indicatif
                  </span>
                  <span>Non officiel TEF · Calculé selon la grille de compétences</span>
                </div>
              </div>

              {/* 5 Oral Criteria Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className="p-3 rounded-lg border border-border/80 bg-card text-center space-y-1">
                  <span className="text-[11px] text-muted-foreground block truncate">Aisance</span>
                  <span className="text-base font-bold text-foreground">{Math.round(evaluation.fluency)}%</span>
                </div>
                <div className="p-3 rounded-lg border border-border/80 bg-card text-center space-y-1">
                  <span className="text-[11px] text-muted-foreground block truncate">Vocabulaire</span>
                  <span className="text-base font-bold text-foreground">{Math.round(evaluation.vocabulary)}%</span>
                </div>
                <div className="p-3 rounded-lg border border-border/80 bg-card text-center space-y-1">
                  <span className="text-[11px] text-muted-foreground block truncate">Grammaire</span>
                  <span className="text-base font-bold text-foreground">{Math.round(evaluation.grammar)}%</span>
                </div>
                <div className="p-3 rounded-lg border border-border/80 bg-card text-center space-y-1">
                  <span className="text-[11px] text-muted-foreground block truncate">Prononciation</span>
                  <span className="text-base font-bold text-foreground">{Math.round(evaluation.pronunciation)}%</span>
                </div>
                <div className="p-3 rounded-lg border border-border/80 bg-card text-center space-y-1 col-span-2 sm:col-span-1">
                  <span className="text-[11px] text-muted-foreground block truncate">Cohérence</span>
                  <span className="text-base font-bold text-foreground">{Math.round(evaluation.coherence)}%</span>
                </div>
              </div>

              {/* Strengths & Weaknesses */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {evaluation.strengths.length > 0 && (
                  <div className="p-3.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                    <h4 className="font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                      <Sparkles className="size-3.5" />
                      <span>Points forts validés</span>
                    </h4>
                    <ul className="space-y-1 text-muted-foreground list-disc pl-4 leading-relaxed">
                      {evaluation.strengths.map((str, i) => (
                        <li key={i}>{str}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {evaluation.recommendations.length > 0 && (
                  <div className="p-3.5 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                    <h4 className="font-semibold text-primary flex items-center gap-1.5">
                      <BookOpen className="size-3.5" />
                      <span>Axes de travail prioritaires</span>
                    </h4>
                    <ul className="space-y-1 text-muted-foreground list-disc pl-4 leading-relaxed">
                      {evaluation.recommendations.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Detailed Feedback Note */}
              {evaluation.detailed_feedback && (
                <div className="p-3.5 rounded-lg bg-muted/30 border border-border text-xs text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground block mb-1">
                    Commentaire de l'évaluateur :
                  </span>
                  <p>{evaluation.detailed_feedback}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center rounded-xl bg-muted/20 border border-dashed border-border/80 space-y-3">
              <Sparkles className="size-8 text-primary mx-auto animate-spin" />
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground">
                  Génération de votre rapport en cours...
                </h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Les métriques de votre session orale sont en cours de traitement par le moteur d'évaluation.
                </p>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/60 pt-4">
          {onRestart ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onRestart}
              className="w-full sm:w-auto cursor-pointer gap-1.5 text-xs"
            >
              <RotateCcw className="size-3.5" />
              <span>Nouvelle simulation</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/speaking")}
              className="w-full sm:w-auto cursor-pointer gap-1.5 text-xs"
            >
              <RotateCcw className="size-3.5" />
              <span>Retour à l'accueil Speaking</span>
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="w-full sm:w-auto cursor-pointer gap-1.5 text-xs font-semibold"
          >
            <LayoutDashboard className="size-3.5" />
            <span>Tableau de bord</span>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
