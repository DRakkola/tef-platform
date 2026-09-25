import React from "react"
import { Activity, CheckCircle2, Calendar } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import type { TeacherRecentActivityItem } from "../types"

interface RecentStudentActivityProps {
  activities: TeacherRecentActivityItem[]
}

export const RecentStudentActivity: React.FC<RecentStudentActivityProps> = ({ activities }) => {
  if (activities.length === 0) {
    return null
  }

  return (
    <Card className="border-border/70 shadow-xs">
      <CardHeader className="p-5 pb-3 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Activity className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-foreground">
              Activité récente des élèves
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Historique récent des cours et interactions pédagogiques
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5">
        <div className="space-y-3">
          {activities.map((act) => (
            <div
              key={act.id}
              className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/20 transition-colors"
            >
              <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                {act.type === "session_completed" ? (
                  <CheckCircle2 className="size-3.5" />
                ) : (
                  <Calendar className="size-3.5" />
                )}
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground truncate">
                  {act.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {act.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
