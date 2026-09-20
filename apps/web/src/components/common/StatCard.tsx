import type { LucideIcon } from "lucide-react"
import { TrendingUp, TrendingDown } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface StatCardProps {
  label: string
  value: string | number
  subtext?: string
  change?: number
  changeLabel?: string
  icon?: LucideIcon
  className?: string
}

export function StatCard({
  label,
  value,
  subtext,
  change,
  changeLabel,
  icon: Icon,
  className,
}: StatCardProps) {
  const isPositive = change !== undefined && change > 0
  const isNegative = change !== undefined && change < 0

  return (
    <Card
      className={cn(
        "p-5 rounded-xl border border-border/70 bg-card hover:border-border transition-colors shadow-2xs space-y-3",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">
          {label}
        </span>
        {Icon && (
          <div className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0">
            <Icon className="size-3.5" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl sm:text-3xl font-bold tracking-tight font-mono tabular-nums text-foreground">
          {value}
        </span>
        {change !== undefined && (
          <Badge
            variant={isPositive ? "success" : isNegative ? "warning" : "secondary"}
            size="sm"
            className="font-mono text-[11px] shrink-0"
          >
            {isPositive && <TrendingUp className="size-3 mr-1" aria-hidden="true" />}
            {isNegative && <TrendingDown className="size-3 mr-1" aria-hidden="true" />}
            {change > 0 ? `+${change}%` : `${change}%`}
          </Badge>
        )}
      </div>

      {(subtext || changeLabel) && (
        <p className="text-xs text-muted-foreground leading-relaxed truncate">
          {changeLabel || subtext}
        </p>
      )}
    </Card>
  )
}
