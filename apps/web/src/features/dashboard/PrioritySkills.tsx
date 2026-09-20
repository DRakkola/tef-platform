/**
 * PrioritySkills component: Answers "What are my weaknesses?".
 * Focuses on top 3-4 priority skills needing reinforcement with concrete gaps and practice CTA.
 */

import React from "react"
import { useNavigate } from "react-router-dom"
import { AlertCircle } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import type { WeakestSkillSummary } from "./types"

export interface PrioritySkillsProps {
  skills?: WeakestSkillSummary[]
  onPracticeSkill?: (skill: WeakestSkillSummary) => void
}

export const PrioritySkills: React.FC<PrioritySkillsProps> = ({
  skills = [],
  onPracticeSkill,
}) => {
  const navigate = useNavigate()
  const topSkills = skills.slice(0, 4) // Focus on 3-4 top priorities

  const handlePractice = (skill: WeakestSkillSummary) => {
    if (onPracticeSkill) {
      onPracticeSkill(skill)
      return
    }

    if (skill.recommended_exercise_id) {
      navigate(`/exercises/${skill.recommended_exercise_id}`)
    } else {
      navigate(`/practice?category=${skill.category || ""}`)
    }
  }

  return (
    <Card data-testid="weakest-skills-banner" className="shadow-2xs border-border/70 bg-card">
      <CardHeader className="pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="icon-box icon-box-sm bg-amber-500/15 text-amber-700 dark:text-amber-400">
              <AlertCircle className="size-4" aria-hidden="true" />
            </div>
            <CardTitle className="text-base font-semibold text-foreground font-display">
              Compétences prioritaires
            </CardTitle>
          </div>
          <CardDescription className="text-xs leading-relaxed">
            Axes identifiés lors de vos évaluations présentant un écart avec le seuil cible B2.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {topSkills.length > 0 ? (
          topSkills.map((skill) => {
            const mastery = Math.round(skill.mastery_score)
            const gap = Math.max(0, 70 - mastery)

            return (
              <div
                key={skill.skill_id}
                className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-card hover:bg-muted/20 hover:border-border transition-all space-y-3"
              >
                {/* Header: Skill Name, Mastery %, Gap Badge */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-semibold text-foreground truncate">
                    {skill.skill_name}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs text-muted-foreground font-mono tabular-nums">
                      ({mastery}%)
                    </span>
                    <Badge variant="warning" size="sm" className="font-mono text-[11px] px-1.5 py-0">
                      Écart -{gap}%
                    </Badge>
                  </div>
                </div>

                {/* Mini Progress Bar vs 70% threshold */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono tabular-nums">
                    <span>Maîtrise : {mastery}%</span>
                    <span>Seuil B2 : 70%</span>
                  </div>
                  <Progress
                    value={mastery}
                    className="h-1.5"
                    aria-label={`Maîtrise pour ${skill.skill_name} : ${mastery}%`}
                  />
                </div>

                {/* Pedagogical Reason & Practice CTA */}
                <div className="pt-1.5 flex items-center justify-between border-t border-border/50 gap-2">
                  <span className="text-[11px] text-muted-foreground truncate leading-none">
                    {skill.reason || "Exercices ciblés recommandés"}
                  </span>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => handlePractice(skill)}
                    className="cursor-pointer text-xs shrink-0 h-6 px-2.5"
                  >
                    S'entraîner
                  </Button>
                </div>
              </div>
            )
          })
        ) : (
          <div className="p-5 rounded-xl border border-dashed border-border/70 text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              Aucun point bloquant critique identifié. Vos compétences actuelles se situent au-dessus du seuil cible.
            </p>
            <Button
              size="xs"
              variant="secondary"
              onClick={() => navigate("/practice")}
              className="text-xs cursor-pointer"
            >
              Explorer les perfectionnements
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
