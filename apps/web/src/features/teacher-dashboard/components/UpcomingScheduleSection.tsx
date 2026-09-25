import React from "react"
import { Link } from "react-router-dom"
import { CalendarDays, Clock, UserCheck, ArrowRight } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { TeacherBookingItem } from "../types"
import { formatSessionDate, formatSessionTime } from "../hooks/useTeacherDashboard"

interface UpcomingScheduleSectionProps {
  sessions: TeacherBookingItem[]
  timezone: string
  isLoading: boolean
}

export const UpcomingScheduleSection: React.FC<UpcomingScheduleSectionProps> = ({
  sessions,
  timezone,
  isLoading,
}) => {
  return (
    <Card className="border-border/70 shadow-xs">
      <CardHeader className="p-5 pb-3 border-b border-border/40 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <CalendarDays className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-foreground">
              Prochaines séances
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Vos rendez-vous à venir dans les prochains jours
            </p>
          </div>
        </div>
        <Link to="/bookings">
          <Button variant="ghost" size="sm" className="text-xs gap-1 h-8">
            <span>Calendrier complet</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </Link>
      </CardHeader>

      <CardContent className="p-5">
        {isLoading ? (
          <div className="space-y-3" aria-busy="true">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse flex items-center justify-between p-3.5 rounded-lg border border-border/60 bg-muted/30">
                <div className="space-y-1.5">
                  <div className="h-4 w-32 bg-muted rounded-sm" />
                  <div className="h-3 w-40 bg-muted/60 rounded-sm" />
                </div>
                <div className="h-7 w-20 bg-muted rounded-md" />
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-6 text-center space-y-2 rounded-xl border border-dashed border-border/70 bg-muted/10">
            <Clock className="size-6 text-muted-foreground/60 mx-auto" />
            <p className="text-sm font-medium text-foreground">
              Aucune séance programmée pour les prochains jours
            </p>
            <p className="text-xs text-muted-foreground">
              Vos nouvelles réservations s'afficheront automatiquement ici.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {sessions.slice(0, 5).map((session) => {
              const dateStr = formatSessionDate(session.start_time, timezone)
              const timeStr = formatSessionTime(session.start_time, timezone)

              return (
                <div
                  key={session.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg border border-border/60 bg-card hover:bg-muted/30 transition-colors gap-2"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="flex flex-col items-center justify-center min-w-24 px-2 py-1 rounded-md bg-muted/60 text-xs font-mono font-medium text-foreground">
                      <span className="capitalize">{dateStr}</span>
                      <span className="text-[11px] text-muted-foreground">{timeStr}</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {session.service_title}
                        </span>
                        <Badge variant="outline" className="text-[10px] uppercase font-medium">
                          {session.status === "confirmed" ? "Confirmée" : "En attente"}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <UserCheck className="size-3 text-muted-foreground/70" />
                        <span>{session.student_identifier}</span>
                        <span>•</span>
                        <span>{session.duration_minutes} min</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 self-end sm:self-center"
                    asChild
                  >
                    <Link to="/bookings">Voir la réservation</Link>
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
