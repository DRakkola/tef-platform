/**
 * DailyPlanHandoffCard Component.
 * Connects the completed assessment to the student's active daily study plan.
 */

import React from "react"
import { Calendar, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { DailyPlanTaskSummary } from "../types"

export interface DailyPlanHandoffCardProps {
  tasks: DailyPlanTaskSummary[]
  onViewPlan: () => void
  className?: string
}

export const DailyPlanHandoffCard: React.FC<DailyPlanHandoffCardProps> = ({
  tasks = [],
  onViewPlan,
  className,
}) => {
  const pendingTasks = tasks.filter((t) => !t.is_completed).slice(0, 2)

  if (pendingTasks.length === 0) return null

  return (
    <Card className={cn("border-border/80 bg-card shadow-xs", className)}>
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-primary" />
            <CardTitle className="text-sm font-bold text-foreground">
              Continuer avec votre plan
            </CardTitle>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Activités du jour
          </span>
        </div>
      </CardHeader>

      <CardContent className="pt-3 space-y-3">
        {pendingTasks.map((task) => (
          <div
            key={task.id}
            className="rounded-xl border border-border/60 bg-muted/20 p-2.5 space-y-1 text-xs"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground truncate">
                {task.title}
              </span>
              <Badge variant="outline" size="sm" className="font-mono text-[10px]">
                {task.estimated_minutes} min
              </Badge>
            </div>
            {task.skill_name && (
              <span className="text-[11px] text-muted-foreground">
                {task.skill_name}
              </span>
            )}
          </div>
        ))}

        <div className="pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onViewPlan}
            className="w-full cursor-pointer text-xs font-semibold gap-1.5 h-8 justify-center"
          >
            <span>Voir mon plan</span>
            <ArrowRight className="size-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
