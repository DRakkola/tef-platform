/**
 * RecentActivity component: Answers "What did I just do?".
 * Compact activity feed aggregating assessments, writing evaluations, and oral sessions.
 */

import React from "react"
import { Link, useNavigate } from "react-router-dom"
import { Clock, BookOpen, PenLine, Mic, Calendar, ExternalLink } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type {
  RecentAssessmentSummary,
  RecentWritingSummary,
  RecentSpeakingSummary,
} from "./types"

export interface ActivityFeedItem {
  id: string
  title: string
  type: "assessment" | "writing" | "speaking" | "booking"
  timestamp: string
  score?: number | null
  level?: string | null
  status?: string
  actionUrl?: string
}

export interface RecentActivityProps {
  assessments?: RecentAssessmentSummary[]
  writings?: RecentWritingSummary[]
  speakingSessions?: RecentSpeakingSummary[]
  onViewAll?: () => void
}

export const RecentActivity: React.FC<RecentActivityProps> = ({
  assessments = [],
  writings = [],
  speakingSessions = [],
  onViewAll,
}) => {
  const navigate = useNavigate()

  // Aggregate items into a unified chronologically sorted feed
  const feedItems: ActivityFeedItem[] = React.useMemo(() => {
    const items: ActivityFeedItem[] = []

    assessments.forEach((a) => {
      items.push({
        id: `assessment-${a.id}`,
        title: a.title,
        type: "assessment",
        timestamp: a.submitted_at,
        score: a.score_percentage,
        level: a.estimated_level,
        status: a.passed ? "Validé" : "À consolider",
        actionUrl: `/assessments/${a.id}`,
      })
    })

    writings.forEach((w) => {
      items.push({
        id: `writing-${w.id}`,
        title: w.task_title,
        type: "writing",
        timestamp: w.submitted_at,
        score: w.overall_score,
        level: w.estimated_level,
        status: w.status === "corrected" ? "Corrigé" : "En évaluation",
        actionUrl: `/writing/tasks/${w.id}`,
      })
    })

    speakingSessions.forEach((s) => {
      items.push({
        id: `speaking-${s.id}`,
        title: s.session_type || "Session d'expression orale",
        type: "speaking",
        timestamp: s.completed_at || s.starts_at || new Date().toISOString(),
        score: s.overall_score,
        level: s.estimated_level,
        status: s.status || "Terminée",
        actionUrl: "/practice-pool",
      })
    })

    // Sort descending by timestamp
    return items
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5) // Max 5 items
  }, [assessments, writings, speakingSessions])

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      if (diffHours < 1) return "À l'instant"
      if (diffHours < 24) return `Il y a ${diffHours}h`
      if (diffDays === 1) return "Hier"
      if (diffDays < 7) return `Il y a ${diffDays} jours`

      return date.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
      })
    } catch {
      return "Récemment"
    }
  }

  const getTypeIcon = (type: ActivityFeedItem["type"]) => {
    switch (type) {
      case "assessment":
        return <BookOpen className="size-3.5 text-primary" aria-hidden="true" />
      case "writing":
        return <PenLine className="size-3.5 text-amber-500" aria-hidden="true" />
      case "speaking":
        return <Mic className="size-3.5 text-emerald-500" aria-hidden="true" />
      default:
        return <Calendar className="size-3.5 text-sky-500" aria-hidden="true" />
    }
  }

  return (
    <Card className="shadow-2xs border-border/70 bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-2.5">
          <div className="icon-box icon-box-sm icon-box-accent">
            <Clock className="size-4" aria-hidden="true" />
          </div>
          <CardTitle className="text-base font-semibold text-foreground font-display">
            Activité récente
          </CardTitle>
        </div>

        <Link
          to="/progress"
          onClick={onViewAll}
          className="text-xs font-semibold text-primary hover:underline"
        >
          Historique complet
        </Link>
      </CardHeader>

      <CardContent className="space-y-2.5 pt-0">
        {feedItems.length > 0 ? (
          feedItems.map((item) => (
            <div
              key={item.id}
              onClick={() => item.actionUrl && navigate(item.actionUrl)}
              className="group p-3 rounded-xl border border-border/60 bg-card hover:bg-muted/20 hover:border-border transition-all flex items-center justify-between gap-3 cursor-pointer"
            >
              {/* Left: Icon & Details */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex size-8 items-center justify-center rounded-lg bg-muted shrink-0 group-hover:bg-muted/80">
                  {getTypeIcon(item.type)}
                </div>

                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {item.title}
                  </p>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {formatRelativeTime(item.timestamp)}
                  </span>
                </div>
              </div>

              {/* Right: Badge / Score */}
              <div className="shrink-0 flex items-center gap-1.5">
                {item.score !== null && item.score !== undefined ? (
                  <Badge variant="secondary" size="sm" className="font-mono text-xs">
                    {item.score}%
                  </Badge>
                ) : item.level ? (
                  <Badge variant="outline" size="sm" className="font-mono text-xs">
                    {item.level}
                  </Badge>
                ) : (
                  <Badge variant="secondary" size="sm" className="text-[10px]">
                    {item.status || "Terminé"}
                  </Badge>
                )}
                <ExternalLink className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
              </div>
            </div>
          ))
        ) : (
          <div className="p-4 rounded-xl border border-dashed border-border/70 text-center text-xs text-muted-foreground">
            Aucune activité récente enregistrée.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
