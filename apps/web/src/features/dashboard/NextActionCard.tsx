/**
 * NextActionCard component: Answers "What should I do next?".
 * Prominently presents the single highest-impact action (exercise, diagnostic, or review).
 */

import React from "react"
import { useNavigate } from "react-router-dom"
import {
  Sparkles,
  ArrowRight,
  BookOpen,
  Headphones,
  PenLine,
  Mic,
  Layers,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { RecommendedExerciseSummary, DailyTaskItem } from "./types"

export interface NextActionCardProps {
  recommendation?: RecommendedExerciseSummary | DailyTaskItem | null
  isNewStudent?: boolean
  onActionClick?: (action: any) => void
}

export const NextActionCard: React.FC<NextActionCardProps> = ({
  recommendation,
  isNewStudent = false,
  onActionClick,
}) => {
  const navigate = useNavigate()

  // Handle action navigation
  const handleStart = () => {
    if (onActionClick && recommendation) {
      onActionClick(recommendation)
      return
    }

    if (!recommendation) {
      navigate("/assessments")
      return
    }

    const rec = recommendation as any
    if (rec.entity_type === "assessment" || rec.task_type === "assessment") {
      navigate(`/assessments/${rec.entity_id || rec.target_entity_id || rec.id}`)
    } else {
      navigate(`/exercises/${rec.entity_id || rec.target_entity_id || rec.id}`)
    }
  }

  // Choose appropriate modality icon
  const getCategoryIcon = (category?: string) => {
    const cat = (category || "").toLowerCase()
    if (cat.includes("listen") || cat.includes("orale")) return <Headphones className="size-4 text-primary" />
    if (cat.includes("read") || cat.includes("écrite") || cat.includes("texte")) return <BookOpen className="size-4 text-primary" />
    if (cat.includes("writ") || cat.includes("rédac")) return <PenLine className="size-4 text-primary" />
    if (cat.includes("speak") || cat.includes("parole")) return <Mic className="size-4 text-primary" />
    return <Layers className="size-4 text-primary" />
  }

  // 1. New Student / Diagnostic Onboarding State
  if (isNewStudent || !recommendation) {
    return (
      <section
        aria-label="Action recommandée"
        data-testid="next-action-card"
        className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 transition-all shadow-xs border-l-4 border-l-primary"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="icon-box icon-box-lg icon-box-accent hidden sm:flex shrink-0">
              <Sparkles className="size-6" aria-hidden="true" />
            </div>
            <div className="space-y-2.5 max-w-xl">
              <Badge variant="accent" className="uppercase tracking-wider text-xs gap-1.5 w-fit">
                <Sparkles className="size-3.5" aria-hidden="true" />
                <span>Étape 1 : Étalonnage initial</span>
              </Badge>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground text-balance font-display">
                Passez votre premier test diagnostic
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Calibrez votre niveau linguistique initial en 20 minutes pour générer votre plan d'étude personnalisé
                et identifier immédiatement vos points d'effort prioritaires.
              </p>
            </div>
          </div>

          <Button
            size="lg"
            onClick={() => navigate("/assessments")}
            className="shrink-0 cursor-pointer shadow-xs gap-2 font-semibold"
          >
            <span>Démarrer le diagnostic</span>
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </section>
    )
  }

  // 2. Returning Student with Prioritized Recommendation
  const rec = recommendation as any
  const title = rec.title || "Entraînement recommandé"
  const category = rec.category || rec.target_skill_name || "Pratique ciblée"
  const level = rec.level || "B2"
  const duration = rec.estimated_minutes ? `${rec.estimated_minutes} min` : "~15 min"
  const reason = rec.reason || rec.description || "Recommandé selon vos récents résultats pour consolider ce palier."
  const priority = rec.priority || "medium"

  return (
    <section
      aria-label="Prochaine étape recommandée"
      data-testid="next-action-card"
      className="relative overflow-hidden rounded-2xl border border-border/80 bg-card hover:border-primary/40 p-6 sm:p-8 transition-colors shadow-xs border-l-4 border-l-primary"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="icon-box icon-box-lg icon-box-accent hidden sm:flex shrink-0 mt-1">
            {getCategoryIcon(category)}
          </div>

          <div className="space-y-3 max-w-2xl">
            {/* Tagline & Meta Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="accent" className="uppercase tracking-wider text-xs gap-1.5">
                <Sparkles className="size-3.5" aria-hidden="true" />
                Prochaine étape recommandée
              </Badge>
              <span className="text-border">|</span>
              <Badge variant="secondary" className="capitalize text-xs font-medium gap-1">
                {getCategoryIcon(category)}
                <span>{category}</span>
              </Badge>
              <Badge variant="outline" className="font-mono text-xs">
                Niveau {level}
              </Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono tabular-nums">
                <Clock className="size-3 text-muted-foreground" aria-hidden="true" />
                {duration}
              </span>
              {priority && (
                <Badge
                  variant={priority === "critical" ? "destructive" : priority === "high" ? "warning" : "secondary"}
                  size="sm"
                  className="text-[10px] font-mono"
                >
                  Priorité {priority}
                </Badge>
              )}
            </div>

            {/* Action Title */}
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground text-balance font-display">
              {title}
            </h2>

            {/* Pedagogical Justification */}
            <p className="text-sm text-muted-foreground leading-relaxed">
              {reason}
            </p>
          </div>
        </div>

        {/* Primary CTA */}
        <div className="shrink-0 flex items-center">
          <Button
            size="lg"
            onClick={handleStart}
            className="w-full sm:w-auto cursor-pointer shadow-xs gap-2 font-semibold"
          >
            <span>Commencer la pratique</span>
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </section>
  )
}
