/**
 * StrengthsSection Component.
 * Highlights 2 to 4 validated competencies observed during the assessment.
 */

import React from "react"
import { TrendingUp, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export interface StrengthsSectionProps {
  strengths: string[]
  className?: string
}

export const StrengthsSection: React.FC<StrengthsSectionProps> = ({ strengths = [], className }) => {
  return (
    <Card className={cn("border-border/80 bg-card shadow-xs", className)}>
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-emerald-600 dark:text-emerald-400" />
          <CardTitle className="text-sm font-bold text-foreground">
            Vos points forts
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {strengths && strengths.length > 0 ? (
          <ul className="space-y-2.5">
            {strengths.slice(0, 4).map((str, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2.5 text-xs text-foreground/90 leading-relaxed"
              >
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>{str}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground italic leading-relaxed">
            Poursuivez vos entraînements réguliers pour consolider vos premiers points forts observés.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
