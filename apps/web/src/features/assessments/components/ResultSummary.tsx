/**
 * ResultSummary Component.
 * Presents a calm, grounded executive summary of performance across sections.
 */

import React from "react"
import { Compass } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export interface ResultSummaryProps {
  scorePercentage: number
  sectionScores?: Array<{ title: string; percentage: number }>
  summaryText?: string | null
  className?: string
}

export const ResultSummary: React.FC<ResultSummaryProps> = ({
  scorePercentage,
  sectionScores = [],
  summaryText,
  className,
}) => {
  const rounded = Math.round(scorePercentage)

  // Derive meaningful comparative text if backend didn't provide a custom summaryText
  const getSummary = (): string => {
    if (summaryText) return summaryText

    if (sectionScores.length >= 2) {
      const sorted = [...sectionScores].sort((a, b) => b.percentage - a.percentage)
      const top = sorted[0]
      const bottom = sorted[sorted.length - 1]

      if (top.percentage - bottom.percentage >= 10) {
        return `Vous avez obtenu un score de ${rounded} %. Votre performance en ${top.title.toLowerCase()} (${Math.round(top.percentage)} %) est actuellement plus solide que votre performance en ${bottom.title.toLowerCase()} (${Math.round(bottom.percentage)} %).`
      }
      return `Vous avez obtenu un score de ${rounded} %. Vos résultats sont équilibrés entre vos différentes sections d'évaluation.`
    }

    if (rounded >= 75) {
      return `Vous avez obtenu un score de ${rounded} %, témoignant d'une très bonne maîtrise des compétences évaluées dans cette simulation.`
    }
    if (rounded >= 50) {
      return `Vous avez obtenu un score de ${rounded} %. Vos bases sont bien posées, avec des axes de progression clairement identifiés ci-dessous.`
    }
    return `Vous avez obtenu un score de ${rounded} %. Cette simulation vous permet d'identifier précisément les compétences clés à travailler en priorité.`
  }

  return (
    <Card className={cn("border-border/80 bg-muted/20 shadow-2xs", className)}>
      <CardContent className="p-4 sm:p-5 flex items-start gap-3.5">
        <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
          <Compass className="size-4" />
        </div>
        <div className="space-y-1 text-xs sm:text-sm leading-relaxed text-foreground/90">
          <span className="font-bold text-foreground block text-xs uppercase tracking-wider">
            Synthèse de performance
          </span>
          <p>{getSummary()}</p>
        </div>
      </CardContent>
    </Card>
  )
}
