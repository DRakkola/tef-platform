/**
 * WritingStrengthsImprovements Component.
 * Balanced two-column container presenting validated strengths and priority improvements.
 */

import React from "react"
import { CheckCircle2, AlertCircle } from "lucide-react"

export interface WritingStrengthsImprovementsProps {
  strengths: string[]
  weaknesses: string[]
}

export const WritingStrengthsImprovements: React.FC<WritingStrengthsImprovementsProps> = ({
  strengths,
  weaknesses,
}) => {
  if (strengths.length === 0 && weaknesses.length === 0) return null

  return (
    <section
      aria-label="Points forts et axes d'amélioration"
      className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch"
    >
      {/* Column 1: Strengths */}
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 sm:p-6 flex flex-col space-y-3.5">
        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider">
            Ce que vous avez bien fait
          </h3>
        </div>

        {strengths.length > 0 ? (
          <ul className="space-y-2.5 flex-1 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
            {strengths.map((str, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">•</span>
                <span>{str}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            Aucun point fort spécifique relevé.
          </p>
        )}
      </div>

      {/* Column 2: Improvements */}
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 sm:p-6 flex flex-col space-y-3.5">
        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
          <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider">
            Axes d'amélioration prioritaires
          </h3>
        </div>

        {weaknesses.length > 0 ? (
          <ul className="space-y-2.5 flex-1 text-xs sm:text-sm text-foreground/90 leading-relaxed pl-1">
            {weaknesses.map((weak, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-amber-600 dark:text-amber-400 font-bold">•</span>
                <span>{weak}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            Aucun axe d'amélioration majeur relevé sur ce devoir.
          </p>
        )}
      </div>
    </section>
  )
}
