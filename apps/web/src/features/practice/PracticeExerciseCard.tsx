import React from "react"
import { useNavigate } from "react-router-dom"
import { Clock, ArrowRight, CheckCircle2, RotateCcw } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getCategoryMeta } from "./PracticeRecommendationCard"
import type { PracticeExerciseItem } from "./types"

export interface PracticeExerciseCardProps {
  exercise: PracticeExerciseItem
  onStart?: (exercise: PracticeExerciseItem) => void
}

export const PracticeExerciseCard: React.FC<PracticeExerciseCardProps> = ({
  exercise,
  onStart,
}) => {
  const navigate = useNavigate()
  const meta = getCategoryMeta(exercise.category)
  const Icon = meta.icon

  const handleAction = () => {
    if (onStart) {
      onStart(exercise)
    } else {
      navigate(`/exercises/${exercise.id}`)
    }
  }

  const isCompleted = Boolean(exercise.is_completed)

  return (
    <Card
      data-testid={`exercise-card-${exercise.id}`}
      className={`group transition-all duration-200 flex flex-col justify-between border ${
        isCompleted
          ? "border-border/60 bg-card/75 hover:border-border"
          : "border-border/70 bg-card hover:border-primary/40 hover:shadow-2xs"
      }`}
    >
      <CardHeader className="p-5 pb-3 space-y-2.5">
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="font-mono text-xs font-semibold">
              Niveau {exercise.level}
            </Badge>
            {isCompleted && (
              <Badge variant="secondary" className="text-[10px] text-emerald-600 dark:text-emerald-400 gap-1 bg-emerald-500/10 border-emerald-500/20">
                <CheckCircle2 className="size-3" />
                <span>Terminé</span>
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            <Icon className="size-3 text-muted-foreground" />
            <span className="truncate max-w-[120px]">{meta.label}</span>
          </div>
        </div>

        {/* Title */}
        <CardTitle className="text-sm sm:text-base font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
          {exercise.title}
        </CardTitle>

        {/* Instructions / preview */}
        {exercise.instructions && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {exercise.instructions}
          </p>
        )}
      </CardHeader>

      <CardContent className="p-5 pt-0 space-y-3.5">
        {/* Metadata row */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border/60">
          <span className="flex items-center gap-1 font-mono tabular-nums">
            <Clock className="size-3" />
            {exercise.estimated_minutes || 10} min
          </span>

          <span className="text-[11px] text-muted-foreground capitalize">
            {exercise.question_type ? exercise.question_type.replace(/_/g, " ") : "Pratique"}
          </span>
        </div>

        {/* CTA Button */}
        {isCompleted ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={handleAction}
            className="w-full cursor-pointer justify-between text-xs font-semibold h-9"
          >
            <span className="flex items-center gap-1.5">
              <RotateCcw className="size-3 text-muted-foreground" />
              <span>Revoir l'activité</span>
            </span>
            <ArrowRight className="size-3" />
          </Button>
        ) : (
          <Button
            size="sm"
            variant="default"
            onClick={handleAction}
            className="w-full cursor-pointer justify-between text-xs font-semibold h-9 shadow-2xs"
          >
            <span>Commencer l'exercice</span>
            <ArrowRight className="size-3.5" />
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
