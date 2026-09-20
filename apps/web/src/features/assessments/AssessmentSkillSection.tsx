import React from "react"
import { useNavigate } from "react-router-dom"
import {
  BookOpen,
  Headphones,
  PenTool,
  Mic,
  ArrowRight,
  ArrowUpRight,
  Clock,
  Layers,
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { telemetry } from "@/features/analytics/telemetry"
import type { AssessmentListItem } from "./types"

export interface AssessmentSkillSectionProps {
  assessments: AssessmentListItem[]
  onSelectSkill?: (skillType: "reading" | "listening") => void
}

export const AssessmentSkillSection: React.FC<AssessmentSkillSectionProps> = ({
  assessments,
  onSelectSkill,
}) => {
  const navigate = useNavigate()

  const readingCount = assessments.filter((a) => a.assessment_type === "reading").length
  const listeningCount = assessments.filter((a) => a.assessment_type === "listening").length

  const handleFilterReading = () => {
    telemetry.track("assessment_skill_filtered", { skill: "reading" })
    if (onSelectSkill) {
      onSelectSkill("reading")
    }
  }

  const handleFilterListening = () => {
    telemetry.track("assessment_skill_filtered", { skill: "listening" })
    if (onSelectSkill) {
      onSelectSkill("listening")
    }
  }

  return (
    <section className="space-y-6" aria-labelledby="skill-assessments-heading">
      <div className="flex flex-col gap-1 sm:gap-1.5">
        <h2
          id="skill-assessments-heading"
          className="text-xl font-bold tracking-tight text-foreground sm:text-2xl"
        >
          Évaluer une compétence
        </h2>
        <p className="text-sm text-muted-foreground">
          Ciblez une modalité spécifique pour mesurer votre niveau sous contraintes officielles.
        </p>
      </div>

      {/* Grid: 2 Primary Assessment Modalities + 2 Subdued Production Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        {/* Compréhension Écrite */}
        <Card className="flex flex-col justify-between border-border/80 hover:border-primary/40 hover:shadow-sm transition-all">
          <CardHeader className="space-y-3 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="size-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <BookOpen className="size-5" />
              </div>
              <Badge variant="outline" size="sm" className="font-medium text-xs">
                {readingCount} {readingCount > 1 ? "épreuves disponibles" : "épreuve disponible"}
              </Badge>
            </div>

            <div className="space-y-1">
              <CardTitle className="text-lg font-bold text-foreground">
                Compréhension Écrite
              </CardTitle>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Articles, graphiques, notes de synthèse et logique textuelle sous chronométrage strict.
              </p>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-3 border-t border-border/60">
              <div className="flex items-center gap-1.5">
                <Clock className="size-3.5 text-muted-foreground/80" />
                <span>60 min d'épreuve</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Layers className="size-3.5 text-muted-foreground/80" />
                <span>40 à 50 questions</span>
              </div>
            </div>
          </CardContent>

          <CardFooter className="pt-2 border-t border-border/40">
            <Button
              variant="outline"
              onClick={handleFilterReading}
              className="w-full gap-2 text-xs font-semibold hover:border-primary/50"
            >
              <span>Voir les évaluations de lecture</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </CardFooter>
        </Card>

        {/* Compréhension Orale */}
        <Card className="flex flex-col justify-between border-border/80 hover:border-primary/40 hover:shadow-sm transition-all">
          <CardHeader className="space-y-3 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="size-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Headphones className="size-5" />
              </div>
              <Badge variant="outline" size="sm" className="font-medium text-xs">
                {listeningCount} {listeningCount > 1 ? "épreuves disponibles" : "épreuve disponible"}
              </Badge>
            </div>

            <div className="space-y-1">
              <CardTitle className="text-lg font-bold text-foreground">
                Compréhension Orale
              </CardTitle>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Enregistrements authentiques de Radio-Canada, dialogues réels et messages d'annonces.
              </p>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-3 border-t border-border/60">
              <div className="flex items-center gap-1.5">
                <Clock className="size-3.5 text-muted-foreground/80" />
                <span>40 min d'épreuve</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Layers className="size-3.5 text-muted-foreground/80" />
                <span>60 questions audio</span>
              </div>
            </div>
          </CardContent>

          <CardFooter className="pt-2 border-t border-border/40">
            <Button
              variant="outline"
              onClick={handleFilterListening}
              className="w-full gap-2 text-xs font-semibold hover:border-primary/50"
            >
              <span>Voir les évaluations d'écoute</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </CardFooter>
        </Card>

        {/* Subdued Companion: Expression Écrite */}
        <Card className="flex flex-col justify-between border-dashed border-border/70 bg-muted/20 hover:bg-muted/30 transition-colors">
          <CardHeader className="space-y-2 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="size-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                <PenTool className="size-4" />
              </div>
              <Badge variant="secondary" size="sm" className="text-[11px] font-normal">
                Atelier guidé
              </Badge>
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-foreground">
                Expression Écrite
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Section A (fait divers) et Section B (lettre argumentative) avec corrections détaillées.
              </p>
            </div>
          </CardHeader>

          <CardFooter className="pt-2 border-t border-border/30">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/writing")}
              className="w-full justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <span>Accéder aux ateliers d'écriture</span>
              <ArrowUpRight className="size-3.5" />
            </Button>
          </CardFooter>
        </Card>

        {/* Subdued Companion: Expression Orale */}
        <Card className="flex flex-col justify-between border-dashed border-border/70 bg-muted/20 hover:bg-muted/30 transition-colors">
          <CardHeader className="space-y-2 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="size-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                <Mic className="size-4" />
              </div>
              <Badge variant="secondary" size="sm" className="text-[11px] font-normal">
                Laboratoire vocal
              </Badge>
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-foreground">
                Expression Orale
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Simulations Section A (renseignements) et Section B (convaincre un ami) avec feedback IA.
              </p>
            </div>
          </CardHeader>

          <CardFooter className="pt-2 border-t border-border/30">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/speaking")}
              className="w-full justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <span>Accéder au labo d'expression orale</span>
              <ArrowUpRight className="size-3.5" />
            </Button>
          </CardFooter>
        </Card>
      </div>
    </section>
  )
}
