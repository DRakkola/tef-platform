/**
 * WeaknessesSection Component.
 * Identifies 1 to 3 priority weaknesses impacting current performance with direct practice action.
 */

import React from "react"
import { AlertTriangle, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface WeaknessesSectionProps {
  weaknesses: string[]
  onPracticeClick?: (weaknessText: string) => void
  className?: string
}

export const WeaknessesSection: React.FC<WeaknessesSectionProps> = ({
  weaknesses = [],
  onPracticeClick,
  className,
}) => {
  return (
    <Card className={cn("border-border/80 bg-card shadow-xs", className)}>
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-warning" />
          <CardTitle className="text-sm font-bold text-foreground">
            À améliorer en priorité
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {weaknesses && weaknesses.length > 0 ? (
          <ul className="space-y-3">
            {weaknesses.slice(0, 3).map((weak, idx) => (
              <li
                key={idx}
                className="rounded-xl border border-warning/30 bg-warning/5 p-3.5 space-y-2"
              >
                <div className="flex items-start gap-2.5">
                  <span className="size-5 rounded-full bg-warning/15 text-warning font-bold font-mono text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="text-xs text-foreground/90 leading-relaxed font-medium">
                    {weak}
                  </p>
                </div>

                {onPracticeClick && (
                  <div className="pt-1 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onPracticeClick(weak)}
                      className="cursor-pointer text-[11px] font-semibold text-warning hover:text-warning/80 hover:bg-warning/10 h-7 px-2.5 gap-1"
                    >
                      <span>Pratiquer</span>
                      <ArrowRight className="size-3" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium leading-relaxed">
            Excellent niveau de maîtrise globale observé sur cette épreuve.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
