import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export interface SkillCardProps {
  name: string
  score: number
  category: string
  status?: "mastered" | "developing" | "gap" | "calibrating"
  gapPercentage?: number
  attemptsCount?: number
  className?: string
}

export function SkillCard({
  name,
  score,
  category,
  status = "developing",
  gapPercentage,
  attemptsCount,
  className,
}: SkillCardProps) {
  const badgeVariant =
    status === "mastered" || score >= 75
      ? "success"
      : status === "gap" || score < 60
      ? "warning"
      : "secondary"
  const badgeLabel =
    status === "mastered" || score >= 75
      ? "Maîtrisé"
      : status === "gap" || score < 60
      ? "À renforcer"
      : status === "calibrating"
      ? "Étalonnage"
      : "En cours"

  return (
    <Card
      className={cn(
        "p-4 rounded-xl border border-border/70 bg-card hover:border-border transition-colors shadow-2xs space-y-3",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider capitalize truncate">
          {category}
        </span>
        <Badge
          variant={badgeVariant}
          size="sm"
          className="text-[11px] font-mono shrink-0"
        >
          {badgeLabel}
        </Badge>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="text-sm font-semibold text-foreground tracking-tight truncate">
            {name}
          </h4>
          <span className="text-sm font-bold font-mono tabular-nums text-foreground">
            {Math.round(score)}%
          </span>
        </div>
        <Progress value={score} className="h-1.5" />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
        {gapPercentage !== undefined ? (
          <span className="font-mono tabular-nums text-amber-600 dark:text-amber-400">
            Écart&nbsp;: -{Math.abs(gapPercentage)}%
          </span>
        ) : attemptsCount !== undefined ? (
          <span>{attemptsCount}&nbsp;exercices</span>
        ) : null}
      </div>
    </Card>
  )
}

export interface ProgressCardProps {
  title: string
  current: number
  target: number
  unit?: string
  description?: string
  className?: string
}

export function ProgressCard({
  title,
  current,
  target,
  unit = "min",
  description,
  className,
}: ProgressCardProps) {
  const percentage = Math.min(100, Math.round((current / (target || 1)) * 100))

  return (
    <Card className={cn("p-5 rounded-xl border border-border/70 bg-card shadow-2xs space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </span>
        <span className="text-xs font-mono font-medium text-primary tabular-nums">
          {percentage}%
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold font-mono tabular-nums text-foreground">
            {current}
          </span>
          <span className="text-sm text-muted-foreground font-mono">
            / {target}&nbsp;{unit}
          </span>
        </div>
        <Progress value={percentage} className="h-2" />
      </div>

      {description && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}
    </Card>
  )
}
