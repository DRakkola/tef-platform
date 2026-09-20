/**
 * DailyPlanCard component: Supports the daily learning loop.
 * Displays 2-4 prioritized tasks, estimated time per task, completion status, and quick-start actions.
 */

import React from "react"
import { Link, useNavigate } from "react-router-dom"
import { Calendar, CheckCircle2, Play, ArrowRight, Check } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { DailyPlanData, DailyTaskItem } from "./types"

export interface DailyPlanCardProps {
  dailyPlan?: DailyPlanData | null
  onTaskClick?: (task: DailyTaskItem) => void
}

export const DailyPlanCard: React.FC<DailyPlanCardProps> = ({
  dailyPlan,
  onTaskClick,
}) => {
  const navigate = useNavigate()

  // Support both dailyPlan.tasks and dailyPlan.items
  const rawTasks = dailyPlan?.tasks || dailyPlan?.items || []
  const tasks = rawTasks.slice(0, 4) // Max 4 tasks for focused clarity

  const completedCount = dailyPlan?.completed_tasks ?? tasks.filter((t) => t.is_completed).length
  const totalCount = dailyPlan?.total_tasks ?? tasks.length
  const dailyBudget = dailyPlan?.daily_minutes_available || dailyPlan?.estimated_minutes_total || 30

  const handleStartTask = (task: DailyTaskItem) => {
    if (onTaskClick) {
      onTaskClick(task)
      return
    }

    if (task.task_type === "assessment") {
      navigate(`/assessments/${task.target_entity_id || task.id}`)
    } else {
      navigate(`/exercises/${task.target_entity_id || task.id}`)
    }
  }

  return (
    <Card className="shadow-2xs border-border/70 bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-4 gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="icon-box icon-box-sm icon-box-accent">
              <Calendar className="size-4" aria-hidden="true" />
            </div>
            <CardTitle className="text-base font-semibold text-foreground font-display">
              Plan du jour
            </CardTitle>
            {totalCount > 0 && (
              <Badge variant={completedCount === totalCount ? "success" : "secondary"} size="sm" className="font-mono">
                {completedCount}/{totalCount}
              </Badge>
            )}
          </div>
          <CardDescription className="text-xs">
            Budget quotidien : <span className="font-semibold text-foreground">{dailyBudget}&nbsp;minutes</span>
          </CardDescription>
        </div>

        <Link
          to="/practice"
          className="text-xs font-semibold text-primary hover:underline shrink-0"
        >
          Tout explorer
        </Link>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {tasks.length > 0 ? (
          tasks.map((task, idx) => {
            const isDone = task.is_completed
            return (
              <div
                key={task.id || idx}
                className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                  isDone
                    ? "border-border/40 bg-muted/20 opacity-80"
                    : "border-border/70 bg-card hover:bg-muted/20 hover:border-border"
                }`}
              >
                {/* Step / Check Icon & Task Details */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`flex size-8 items-center justify-center rounded-xl text-xs font-mono font-bold shrink-0 ${
                      isDone
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isDone ? <Check className="size-4 stroke-[3]" aria-hidden="true" /> : idx + 1}
                  </div>

                  <div className="min-w-0">
                    <p
                      className={`text-xs sm:text-sm font-semibold truncate ${
                        isDone ? "text-muted-foreground line-through" : "text-foreground"
                      }`}
                    >
                      {task.title}
                    </p>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5 font-mono">
                      <span className="capitalize">{task.task_type === "exercise" ? "Exercice" : task.task_type || "Pratique"}</span>
                      <span>·</span>
                      <span className="tabular-nums">{task.estimated_minutes || 10}&nbsp;min</span>
                    </div>
                  </div>
                </div>

                {/* Start / Completed Button */}
                <Button
                  size="xs"
                  variant={isDone ? "ghost" : "secondary"}
                  onClick={() => handleStartTask(task)}
                  className="shrink-0 cursor-pointer h-7 text-xs font-medium px-3 gap-1.5"
                >
                  {isDone ? (
                    <>
                      <CheckCircle2 className="size-3 text-emerald-500" aria-hidden="true" />
                      <span>Revoir</span>
                    </>
                  ) : (
                    <>
                      <Play className="size-2.5 fill-current" aria-hidden="true" />
                      <span>Faire</span>
                    </>
                  )}
                </Button>
              </div>
            )
          })
        ) : (
          <div className="p-6 rounded-xl border border-dashed border-border/70 text-center space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Aucune tâche programmée pour aujourd'hui. Choisissez vos entraînements dans le catalogue.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/practice")}
              className="text-xs cursor-pointer gap-1.5"
            >
              <span>Parcourir les exercices</span>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
