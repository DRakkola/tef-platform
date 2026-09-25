import React from "react"
import { Link } from "react-router-dom"
import { Mic, Video, ArrowRight } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { TeacherSpeakingSessionItem } from "../types"

interface SpeakingSessionsSectionProps {
  sessions: TeacherSpeakingSessionItem[]
  isLoading: boolean
}

export const SpeakingSessionsSection: React.FC<SpeakingSessionsSectionProps> = ({
  sessions,
  isLoading,
}) => {
  // Only show active or pending evaluation speaking sessions (avoiding 1:1 duplicate of schedule)
  const activeOrPending = sessions.filter(
    (s) => s.status === "ACTIVE" || s.status === "PENDING_EVALUATION" || s.can_join
  )

  if (activeOrPending.length === 0 && !isLoading) {
    return null
  }

  return (
    <Card className="border-border/70 shadow-xs">
      <CardHeader className="p-5 pb-3 border-b border-border/40 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Mic className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-foreground">
              Séances d'expression orale en direct
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sessions orales actives et évaluations en attente
            </p>
          </div>
        </div>
        <Link to="/speaking">
          <Button variant="ghost" size="sm" className="text-xs gap-1 h-8">
            <span>Lab oral</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </Link>
      </CardHeader>

      <CardContent className="p-5">
        {isLoading ? (
          <div className="animate-pulse h-16 bg-muted/40 rounded-xl" aria-busy="true" />
        ) : (
          <div className="space-y-3">
            {activeOrPending.map((session) => (
              <div
                key={session.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border/70 bg-card hover:bg-muted/20 transition-colors gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{session.topic}</span>
                    <Badge variant="default" className="text-[10px] uppercase font-semibold">
                      {session.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{session.student_identifier}</span>
                    <span>•</span>
                    <span>Niveau ciblé : {session.level}</span>
                    <span>•</span>
                    <span>{session.duration_minutes} min</span>
                  </div>
                </div>

                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1.5 h-8 self-end sm:self-center"
                  asChild
                >
                  <Link to={`/speaking/sessions/${session.id}`}>
                    <Video className="size-3.5" />
                    Rejoindre le salon
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
