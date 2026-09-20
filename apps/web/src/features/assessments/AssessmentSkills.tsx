import React from "react"
import { CheckCircle2, Sparkles } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import type { AssessmentType } from "./types"

export interface AssessmentSkillsProps {
  assessmentType: AssessmentType
  skills?: string[]
}

const CANONICAL_SKILLS_BY_TYPE: Record<AssessmentType, string[]> = {
  reading: [
    "Repérage d'informations factuelles",
    "Compréhension globale et logique textuelle",
    "Inférence et implicite de l'auteur",
    "Vocabulaire en contexte professionnel et quotidien",
  ],
  listening: [
    "Compréhension de messages courts et annonces",
    "Analyse d'échanges et conversations authentiques",
    "Compréhension de chroniques Radio-Canada et exposés",
    "Identification des opinions et intentions des locuteurs",
  ],
  mixed: [
    "Compréhension écrite approfondie (textes longs et notes de synthèse)",
    "Compréhension orale en écoute unique (discours, dialogues, émissions)",
    "Gestion du temps sous contraintes strictes TEF Canada",
    "Précision lexicale et grammaticale en situation de test",
  ],
}

export const AssessmentSkills: React.FC<AssessmentSkillsProps> = ({
  assessmentType,
  skills,
}) => {
  const displayedSkills = skills && skills.length > 0
    ? skills
    : CANONICAL_SKILLS_BY_TYPE[assessmentType] || CANONICAL_SKILLS_BY_TYPE.reading

  return (
    <Card className="border-border/80 bg-card shadow-2xs">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <CardTitle className="text-base sm:text-lg font-bold text-foreground">
            Compétences évaluées
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {displayedSkills.map((skill, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/40 text-xs text-foreground"
            >
              <CheckCircle2 className="size-3.5 text-primary shrink-0" />
              <span className="font-medium leading-snug">{skill}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
