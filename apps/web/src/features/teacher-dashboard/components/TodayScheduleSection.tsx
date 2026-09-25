import React from "react"
import { Link } from "react-router-dom"
import { Clock, Video, Calendar, ArrowRight, UserCheck, AlertTriangle, RefreshCw } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { TeacherBookingItem } from "../types"
import { formatSessionTime } from "../hooks/useTeacherDashboard"

interface TodayScheduleSectionProps {
  sessions: TeacherBookingItem[]
  timezone: string
  isLoading: boolean
  isError: boolean
  error?: Error | null
  onRetry: () => void
}

export const TodayScheduleSection: React.FC<TodayScheduleSectionProps> = ({
  sessions,
  timezone,
  isLoading,
  isError,
  error,
  onRetry,
}) => {
  return (
    <Card id="today-schedule" className="border-border/70 shadow-xs">
      <CardHeader className="p-5 pb-3 border-b border-border/40 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Calendar className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-foreground">
              Votre journée
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Séances programmées aujourd'hui selon votre fuseau ({timezone})
            </p>
          </div>
        </div>
        <Link to="/bookings">
          <Button variant="ghost" size="sm" className="text-xs gap-1 h-8">
            <span>Toutes mes réservations</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </Link>
      </CardHeader>

      <CardContent className="p-5">
        {isLoading ? (
          <div className="space-y-3" aria-busy="true">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse flex items-center justify-between p-4 rounded-xl border border-border/60 bg-muted/30">
                <div className="space-y-2">
                  <div className="h-4 w-36 bg-muted rounded-sm" />
                  <div className="h-3 w-48 bg-muted/60 rounded-sm" />
                </div>
                <div className="h-8 w-24 bg-muted rounded-md" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="p-6 text-center space-y-3 rounded-xl border border-destructive/20 bg-destructive/5" role="alert">
            <AlertTriangle className="size-8 text-destructive mx-auto" />
            <h4 className="text-sm font-semibold text-foreground">
              Impossible de charger votre planning d'aujourd'hui
            </h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {error?.message || "Une erreur est survenue lors de la récupération de vos séances."}
            </p>
            <Button size="sm" variant="outline" onClick={onRetry} className="text-xs gap-1.5">
              <RefreshCw className="size-3.5" />
              Réessayer
            </Button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center space-y-2.5 rounded-xl border border-dashed border-border/70 bg-muted/10">
            <Clock className="size-8 text-muted-foreground/60 mx-auto" />
            <p className="text-sm font-medium text-foreground">
              Aucune séance prévue aujourd'hui
            </p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Profitez de ce temps pour traiter vos corrections en attente ou ajuster vos créneaux de disponibilité.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => {
              const startTimeStr = formatSessionTime(session.start_time, timezone)
              const endTimeStr = formatSessionTime(session.end_time, timezone)

              return (
                <div
                  key={session.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border/70 bg-card hover:bg-muted/20 transition-colors gap-3"
                >
                  <div className="flex items-start sm:items-center gap-3.5">
                    {/* Time pill */}
                    <div className="flex flex-col items-center justify-center min-w-20 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary font-mono text-xs font-semibold">
                      <span>{startTimeStr}</span>
                      <span className="text-[10px] text-muted-foreground font-normal">
                        {endTimeStr}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {session.service_title}
                        </span>
                        <Badge
                          variant={session.status === "confirmed" ? "default" : "secondary"}
                          className="text-[10px] uppercase font-semibold"
                        >
                          {session.status === "confirmed"
                            ? "Confirmée"
                            : session.status === "requested"
                            ? "En attente"
                            : session.status}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <UserCheck className="size-3 text-muted-foreground/70" />
                          <span className="font-medium text-foreground">
                            {session.student_identifier}
                          </span>
                        </span>
                        <span>•</span>
                        <span>{session.duration_minutes} min</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {session.can_join ? (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1.5 h-8 shadow-xs"
                        asChild
                      >
                        <a
                          href={session.meeting_link || `/speaking/sessions/${session.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Video className="size-3.5" />
                          Rejoindre la séance
                        </a>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 text-muted-foreground hover:text-foreground"
                        asChild
                      >
                        <Link to={`/bookings`}>
                          Détails
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
