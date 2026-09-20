import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

export function TeacherTeachingApproach() {
  return (
    <Card className="rounded-2xl border-border/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-lg font-bold">
          Déroulement d'une session de 60 minutes
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Chaque cours individuel suit une structure pédagogique rigoureuse alignée sur les standards du TEF Canada.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 pt-0 text-xs text-muted-foreground">
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/30 border border-border/60">
          <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold font-mono text-xs shrink-0">
            1
          </span>
          <div className="space-y-0.5">
            <strong className="text-foreground text-xs block">
              Mise en situation d'examen (20 min)
            </strong>
            <p className="text-[11px] leading-relaxed">
              Simulation d'une épreuve complète sans interruption sous conditions réelles et chronomètre officiel.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/30 border border-border/60">
          <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold font-mono text-xs shrink-0">
            2
          </span>
          <div className="space-y-0.5">
            <strong className="text-foreground text-xs block">
              Débriefing & Grille officielle (25 min)
            </strong>
            <p className="text-[11px] leading-relaxed">
              Analyse point par point des fautes de syntaxe, registre de langue, pertinence lexicale et fluidité selon les critères de la CCI Paris.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/30 border border-border/60">
          <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold font-mono text-xs shrink-0">
            3
          </span>
          <div className="space-y-0.5">
            <strong className="text-foreground text-xs block">
              Plan d'action & Exercices prescrits (15 min)
            </strong>
            <p className="text-[11px] leading-relaxed">
              Remise d'une fiche de remédiation ciblée avec des exercices d'application dans la plateforme pour la prochaine session.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
