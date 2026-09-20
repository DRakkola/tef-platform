import React from "react"
import { ShieldAlert, Clock, Save, Lock, Volume2, Compass } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import type { AssessmentDetail } from "./types"

export interface AssessmentRulesProps {
  assessment: AssessmentDetail
}

export const AssessmentRules: React.FC<AssessmentRulesProps> = ({ assessment }) => {
  const isListening = assessment.assessment_type === "listening"
  const isLinearLocked = assessment.navigation_policy === "linear_locked"

  return (
    <Card className="border-border/80 bg-card shadow-2xs">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-4 text-warning" />
          <CardTitle className="text-base sm:text-lg font-bold text-foreground">
            Consignes et modalités d'examen
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Server Timer Rule */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/30 border border-border/50 text-xs">
            <Clock className="size-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <strong className="text-foreground font-semibold">
                Chronomètre serveur faisant autorité :
              </strong>
              <p className="text-muted-foreground leading-relaxed">
                Dès que vous démarrez l'épreuve, le compte à rebours s'écoule côté serveur. Fermer l'onglet ou actualiser la page ne suspend pas le temps imparti.
              </p>
            </div>
          </div>

          {/* Continuous Autosave Rule */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/30 border border-border/50 text-xs">
            <Save className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <strong className="text-foreground font-semibold">
                Sauvegarde continue des réponses :
              </strong>
              <p className="text-muted-foreground leading-relaxed">
                Chaque réponse cochée est enregistrée instantanément. En cas de perte temporaire de connexion, vos réponses déjà saisies restent sauvegardées.
              </p>
            </div>
          </div>

          {/* Definite Submission Rule */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/30 border border-border/50 text-xs">
            <Lock className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <strong className="text-foreground font-semibold">
                Soumission définitive et clôture :
              </strong>
              <p className="text-muted-foreground leading-relaxed">
                À l'expiration du chronomètre ou sur confirmation manuelle de votre part, la tentative est figée et corrigée instantanément.
              </p>
            </div>
          </div>

          {/* Navigation Policy Rule */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/30 border border-border/50 text-xs">
            <Compass className="size-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <strong className="text-foreground font-semibold">
                {isLinearLocked ? "Navigation séquentielle verrouillée :" : "Navigation libre dans l'épreuve :"}
              </strong>
              <p className="text-muted-foreground leading-relaxed">
                {isLinearLocked
                  ? "Les questions doivent être traitées dans l'ordre sans possibilité de revenir en arrière, conformément au format officiel."
                  : "Vous pouvez parcourir les questions de la section, marquer des questions à revoir et modifier vos réponses jusqu'à la soumission finale."}
              </p>
            </div>
          </div>

          {/* Audio Listening Rule (if listening) */}
          {isListening && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/30 border border-border/50 text-xs">
              <Volume2 className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <strong className="text-foreground font-semibold">
                  Écoute unique des documents sonores :
                </strong>
                <p className="text-muted-foreground leading-relaxed">
                  Chaque piste audio ne peut être écoutée qu'une seule fois selon les conditions strictes de l'examen TEF. Assurez-vous que votre casque ou vos haut-parleurs fonctionnent correctement avant de lancer l'épreuve.
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
