import React from "react"
import { useNavigate } from "react-router-dom"
import { Calendar, CheckCircle2, Circle, Clock, Play, RotateCcw } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { DailyPracticePlanData, DailyPracticeTask } from "./types"

export interface DailyPracticePlanProps {
  dailyPlan?: DailyPracticePlanData | null
  onTaskClick?: (task: DailyPracticeTask) => void
}

export const DailyPracticePlan: React.FC<DailyPracticePlanProps> = ({
  dailyPlan,
  onTaskClick,
}) => {
  const navigate = useNavigate()

  if (!dailyPlan || !dailyPlan.tasks || dailyPlan.tasks.length === 0) {
    return null
  }

  const { tasks, completed_tasks, total_tasks, completion_percentage, estimated_minutes_total } = dailyPlan

  const handleTaskAction = (task: DailyPracticeTask) => {
    if (onTaskClick) {
      onTaskClick(task)
    } else if (task.target_entity_id) {
      navigate(`/exercises/${task.target_entity_id}`)
    }
  }

  return (
    <Card data-testid="daily-practice-plan" className="border-border/70 bg-card shadow-2xs">
      <CardHeader className="p-5 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Calendar className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                Votre plan du jour
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Objectif quotidien recommandé : ~{estimated_minutes_total} minutes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant={completion_percentage >= 100 ? "default" : "secondary"}
              className="font-mono tabular-nums text-xs font-semibold"
            >
              {completed_tasks} / {total_tasks} activités terminées
            </Badge>
          </div>
        </div>

        {/* Progress bar */}
        <div className="pt-2">
          <Progress value={completion_percentage} className="h-2" />
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-1">
        <div className="divide-y divide-border/60">
          {tasks.map((task) => {
            const isCompleted = task.is_completed

            return (
              <div
                key={task.id}
                className={`py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                  isCompleted ? "opacity-75" : ""
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 shrink-0">
                    {isCompleted ? (
                      <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Circle className="size-4 text-muted-foreground" />
                    )}
                  </div>

                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-sm font-semibold truncate ${
                          isCompleted
                            ? "text-muted-foreground line-through decoration-muted-foreground/50"
                            : "text-foreground"
                        }`}
                      >
                        {task.title}
                      </span>
                      {task.priority === "high" && !isCompleted && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 dark:text-amber-400 border-amber-500/30">
                          Prioritaire
                        </Badge>
                      )}
                    </div>

                    {task.description && (
                      <p className="text-xs text-muted-foreground truncate max-w-lg">
                        {task.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-7 sm:pl-0">
                  <span className="flex items-center gap-1 text-xs font-mono tabular-nums text-muted-foreground">
                    <Clock className="size-3" />
                    {task.estimated_minutes} min
                  </span>

                  {isCompleted ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleTaskAction(task)}
                      className="cursor-pointer text-xs h-8 text-muted-foreground hover:text-foreground gap-1"
                    >
                      <RotateCcw className="size-3" />
                      <span>Revoir</span>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTaskAction(task)}
                      className="cursor-pointer text-xs h-8 font-semibold gap-1.5 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                    >
                      <Play className="size-3 fill-current" />
                      <span>Faire</span>
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
