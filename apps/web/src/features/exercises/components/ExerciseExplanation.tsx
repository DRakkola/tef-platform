/**
 * ExerciseExplanation Component.
 * Educational explanation container answering "Pourquoi ?" and connecting
 * the exercise to the underlying curriculum skill taxonomy.
 */

import React from "react"
import { HelpCircle, BookMarked } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface ExerciseExplanationProps {
  explanation?: string | null
  skills?: string[]
  category?: string
  className?: string
}

export const ExerciseExplanation: React.FC<ExerciseExplanationProps> = ({
  explanation,
  skills = [],
  category,
  className,
}) => {
  if (!explanation && skills.length === 0) return null

  return (
    <div
      role="region"
      aria-label="Explication pédagogique et compétences associées"
      className={cn(
        "rounded-xl border border-border/80 bg-muted/30 p-4 sm:p-5 space-y-3 shadow-2xs",
        className
      )}
    >
      {/* 1. "Pourquoi ?" Explanation Block */}
      {explanation && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <HelpCircle className="size-4 text-primary shrink-0" />
            <span>Pourquoi ?</span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-6">
            {explanation}
          </p>
        </div>
      )}

      {/* 2. Skill Connection Tag */}
      {(skills.length > 0 || category) && (
        <div className="pt-2.5 border-t border-border/60 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            <BookMarked className="size-3.5 text-primary" />
            <span>Compétence travaillée :</span>
          </span>

          {category && (
            <Badge variant="outline" size="sm" className="capitalize text-[11px]">
              {category}
            </Badge>
          )}

          {skills.map((skill, idx) => (
            <Badge
              key={idx}
              variant="secondary"
              size="sm"
              className="text-[11px] font-medium"
            >
              {skill}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
