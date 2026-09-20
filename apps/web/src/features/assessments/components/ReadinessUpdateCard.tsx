/**
 * ReadinessUpdateCard Component.
 * Contextual alert notifying the student that their preparation profile
 * and readiness radar have integrated the assessment results.
 */

import React from "react"
import { Sparkles, ArrowRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface ReadinessUpdateCardProps {
  onViewReadiness: () => void
  className?: string
}

export const ReadinessUpdateCard: React.FC<ReadinessUpdateCardProps> = ({
  onViewReadiness,
  className,
}) => {
  return (
    <Card className={cn("border-primary/30 bg-primary/5 shadow-2xs overflow-hidden", className)}>
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="size-4" />
          </div>
          <div className="space-y-0.5 text-xs">
            <h4 className="font-bold text-foreground">
              Profil de préparation actualisé
            </h4>
            <p className="text-muted-foreground leading-relaxed">
              Les données de cette simulation ont été intégrées pour ajuster votre radar de compétences.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onViewReadiness}
          className="cursor-pointer text-xs font-semibold gap-1.5 h-8 shrink-0 self-end sm:self-auto border-primary/30 text-primary hover:bg-primary/10"
        >
          <span>Voir votre préparation</span>
          <ArrowRight className="size-3" />
        </Button>
      </CardContent>
    </Card>
  )
}
