import React from "react"
import { useNavigate } from "react-router-dom"
import {
  Clock,
  ArrowRight,
  Sparkles,
  BookOpen,
  Headphones,
  PenTool,
  Mic,
  Dumbbell,
  Bookmark,
  GraduationCap,
  HelpCircle,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { PracticeRecommendationItem } from "./types"

export function getCategoryMeta(category: string) {
  const normalized = category.toLowerCase()
  switch (normalized) {
    case "reading":
      return { label: "Compréhension écrite", icon: BookOpen }
    case "listening":
      return { label: "Compréhension orale", icon: Headphones }
    case "writing":
      return { label: "Expression écrite", icon: PenTool }
    case "speaking":
      return { label: "Expression orale", icon: Mic }
    case "grammar":
      return { label: "Grammaire", icon: Dumbbell }
    case "vocabulary":
      return { label: "Vocabulaire", icon: Bookmark }
    case "conjugation":
      return { label: "Conjugaison", icon: GraduationCap }
    default:
      return { label: category, icon: BookOpen }
  }
}

export interface PracticeRecommendationCardProps {
  recommendation: PracticeRecommendationItem
  variant?: "primary" | "secondary"
  onStart?: (rec: PracticeRecommendationItem) => void
}

export const PracticeRecommendationCard: React.FC<PracticeRecommendationCardProps> = ({
  recommendation,
  variant = "secondary",
  onStart,
}) => {
  const navigate = useNavigate()
  const meta = getCategoryMeta(recommendation.category)
  const Icon = meta.icon

  const handleStart = () => {
    if (onStart) {
      onStart(recommendation)
    } else {
      navigate(`/exercises/${recommendation.entity_id || recommendation.id}`)
    }
  }

  if (variant === "primary") {
    return (
      <Card
        data-testid="primary-recommendation-card"
        className="relative overflow-hidden border-primary/40 bg-gradient-to-br from-card via-card to-primary/5 shadow-xs"
      >
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-2xl pointer-events-none -mr-16 -mt-16" />

        <CardContent className="p-5 sm:p-6 space-y-4">
          {/* Header pill & tags */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="gap-1 bg-primary text-primary-foreground text-xs font-semibold">
                <Sparkles className="size-3" />
                <span>Recommandation prioritaire</span>
              </Badge>
              <Badge variant="outline" className="font-mono text-xs font-semibold">
                Niveau {recommendation.level}
              </Badge>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Icon className="size-3.5 text-primary" />
              <span>{meta.label}</span>
            </div>
          </div>

          {/* Title */}
          <div>
            <h3 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              {recommendation.title}
            </h3>
          </div>

          {/* Pedagogical Justification Box */}
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/70 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <HelpCircle className="size-3.5 text-primary" />
              <span>Pourquoi cette activité ?</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {recommendation.reason}
            </p>
          </div>

          {/* Bottom Actions & Metadata */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 font-mono tabular-nums">
                <Clock className="size-3.5" />
                ~{recommendation.estimated_minutes || 15} min
              </span>
              <span className="text-muted-foreground/60">•</span>
              <span>Exercice guidé</span>
            </div>

            <Button
              size="default"
              onClick={handleStart}
              className="cursor-pointer gap-2 font-semibold shadow-xs"
            >
              <span>Commencer l'exercice</span>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Secondary Variant (Compact Card)
  return (
    <Card
      data-testid="secondary-recommendation-card"
      className="border-border/70 bg-card hover:border-primary/40 hover:shadow-xs transition-all flex flex-col justify-between"
    >
      <CardContent className="p-5 flex flex-col justify-between h-full space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              Niveau {recommendation.level}
            </Badge>
            <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <Icon className="size-3 text-muted-foreground" />
              <span>{meta.label}</span>
            </div>
          </div>

          <h4 className="text-sm sm:text-base font-semibold text-foreground line-clamp-2">
            {recommendation.title}
          </h4>

          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {recommendation.reason}
          </p>
        </div>

        <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono tabular-nums">
            <Clock className="size-3" />
            ~{recommendation.estimated_minutes || 10} min
          </span>

          <Button
            size="sm"
            variant="secondary"
            onClick={handleStart}
            className="cursor-pointer text-xs font-semibold gap-1.5"
          >
            <span>S'entraîner</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
