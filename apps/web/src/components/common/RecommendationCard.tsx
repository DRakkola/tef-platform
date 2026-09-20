import { Sparkles, Clock, ArrowRight, BookOpen, Headphones, PenTool, Mic, Dumbbell } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  reading: BookOpen,
  listening: Headphones,
  writing: PenTool,
  speaking: Mic,
  grammar: Dumbbell,
}

export interface RecommendationCardProps {
  id: string
  title: string
  category: string
  level?: string
  estimatedMinutes?: number
  reason?: string
  priority?: "critical" | "high" | "medium" | "low" | string
  onStart?: () => void
  className?: string
}

export function RecommendationCard({
  title,
  category,
  level = "B2",
  estimatedMinutes,
  reason,
  priority = "high",
  onStart,
  className,
}: RecommendationCardProps) {
  const Icon = CATEGORY_ICONS[category.toLowerCase()] || Sparkles

  return (
    <Card
      className={cn(
        "p-5 rounded-xl border border-border/80 bg-card hover:border-primary/40 transition-all shadow-2xs space-y-3.5",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="secondary" size="sm" className="font-mono text-[11px] shrink-0 flex items-center gap-1">
            <Icon className="size-3" aria-hidden="true" />
            <span>{level}</span>
          </Badge>
          <span className="text-xs font-medium text-muted-foreground capitalize truncate">
            {category}
          </span>
        </div>
        {priority === "critical" && (
          <Badge variant="warning" size="sm" className="text-[11px] shrink-0">
            Prioritaire
          </Badge>
        )}
      </div>

      <div className="space-y-1">
        <h3 className="text-sm sm:text-base font-semibold text-foreground tracking-tight text-balance leading-snug">
          {title}
        </h3>
        {reason && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {reason}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-border/50">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono tabular-nums">
          <Clock className="size-3.5 text-muted-foreground/70" aria-hidden="true" />
          <span>{estimatedMinutes ? `${estimatedMinutes}\u00A0min` : "10\u00A0min"}</span>
        </div>
        <Button size="sm" variant="default" onClick={onStart} className="text-xs h-8 px-3">
          <span>Pratiquer</span>
          <ArrowRight className="size-3 ml-1" aria-hidden="true" />
        </Button>
      </div>
    </Card>
  )
}
