/**
 * MistakeReview Component.
 * Detailed question-by-question educational review for incorrect answers.
 * Shows student's answer, expected correct answer, and pedagogical rationale ("Pourquoi ?").
 */

import React from "react"
import { HelpCircle, Check, X } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { MistakeItem } from "../types"

export interface MistakeReviewProps {
  mistakes: MistakeItem[]
  className?: string
}

export const MistakeReview: React.FC<MistakeReviewProps> = ({ mistakes = [], className }) => {
  if (!mistakes || mistakes.length === 0) return null

  return (
    <div className={cn("space-y-4", className)}>
      {mistakes.map((mistake: MistakeItem, mIdx: number) => (
        <Card
          key={mistake.question_id || mIdx}
          className="border-border/80 bg-card p-5 sm:p-6 space-y-4 shadow-xs"
        >
          {/* Header Row: Error Index, Skill, Points */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="destructive" size="sm" className="font-mono text-[10px]">
                  Erreur {mIdx + 1}
                </Badge>
                {mistake.skill_name && (
                  <span className="text-[11px] text-muted-foreground">
                    Compétence : <strong className="text-foreground">{mistake.skill_name}</strong>
                  </span>
                )}
                {mistake.level && (
                  <Badge variant="outline" size="sm" className="text-[10px] font-mono">
                    {mistake.level}
                  </Badge>
                )}
              </div>
              <h4 className="text-sm font-semibold text-foreground pt-1 leading-snug">
                {mistake.prompt}
              </h4>
            </div>

            <Badge variant="outline" size="sm" className="font-mono text-destructive text-xs shrink-0">
              0 / {mistake.points} pt
            </Badge>
          </div>

          {/* Answers Comparison Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Student Answer */}
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-destructive font-bold uppercase tracking-wider text-[10px]">
                <X className="size-3.5" />
                <span>Votre réponse :</span>
              </div>
              <p className="text-foreground font-medium pl-5">
                {mistake.user_answer || "(Non répondue)"}
              </p>
            </div>

            {/* Expected Correct Answer */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider text-[10px]">
                <Check className="size-3.5" />
                <span>Bonne réponse attendue :</span>
              </div>
              <p className="text-foreground font-semibold pl-5">
                {mistake.correct_answer || "N/A"}
              </p>
            </div>
          </div>

          {/* Educational Explanation ("Pourquoi ?") */}
          {mistake.explanation && (
            <div className="rounded-xl border border-border/60 bg-muted/40 p-4 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 text-primary font-semibold">
                <HelpCircle className="size-4" />
                <span>Pourquoi ? Règle et explication pédagogique</span>
              </div>
              <p className="text-muted-foreground leading-relaxed pl-5">
                {mistake.explanation}
              </p>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
