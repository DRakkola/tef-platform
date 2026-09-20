import React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"

export interface MetricCardProps {
  label: string
  value: string | number
  subtext?: string
  icon?: LucideIcon
  delta?: {
    value: string
    isPositive?: boolean
    neutral?: boolean
  }
  badge?: React.ReactNode
  className?: string
  onClick?: () => void
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtext,
  icon: Icon,
  delta,
  badge,
  className,
  onClick,
}) => {
  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-colors",
        onClick && "cursor-pointer hover:border-primary/40 hover:bg-muted/30",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-5 flex flex-col justify-between h-full">
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </span>
          <div className="flex items-center gap-1.5">
            {badge}
            {Icon && (
              <div className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon className="size-3.5" aria-hidden="true" />
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {value}
            </span>
            {delta && (
              <span
                className={cn(
                  "text-xs font-semibold px-1.5 py-0.5 rounded",
                  delta.neutral
                    ? "text-muted-foreground bg-muted"
                    : delta.isPositive
                    ? "text-success bg-success/15"
                    : "text-destructive bg-destructive/15"
                )}
              >
                {delta.value}
              </span>
            )}
          </div>
          {subtext && (
            <p className="text-xs text-muted-foreground leading-normal">
              {subtext}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
