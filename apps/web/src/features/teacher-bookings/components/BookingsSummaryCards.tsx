import React from "react"
import { Clock, Calendar, AlertCircle, CheckCircle2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { BookingsSummaryMetrics } from "../types"

interface BookingsSummaryCardsProps {
  metrics: BookingsSummaryMetrics
  isLoading: boolean
}

export const BookingsSummaryCards: React.FC<BookingsSummaryCardsProps> = ({
  metrics,
  isLoading,
}) => {
  const cards = [
    {
      id: "today",
      title: "Aujourd'hui",
      count: metrics.todayCount,
      subtitle: "Séances prévues ce jour",
      icon: Clock,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20",
    },
    {
      id: "upcoming",
      title: "À venir",
      count: metrics.upcomingCount,
      subtitle: "Séances confirmées / planifiées",
      icon: Calendar,
      color: "text-indigo-600 dark:text-indigo-400",
      bgColor: "bg-indigo-500/10",
      borderColor: "border-indigo-500/20",
    },
    {
      id: "pending",
      title: "En attente",
      count: metrics.pendingCount,
      subtitle: "Demandes à valider",
      icon: AlertCircle,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/20",
      highlight: metrics.pendingCount > 0,
    },
    {
      id: "completed",
      title: "Terminées ce mois",
      count: metrics.completedMonthCount,
      subtitle: "Séances effectuées avec succès",
      icon: CheckCircle2,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/20",
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
      {cards.map((c) => {
        const Icon = c.icon
        return (
          <Card
            key={c.id}
            className={`border transition-all shadow-xs ${
              c.highlight ? "border-amber-500/40 bg-amber-500/5" : "border-border/70"
            }`}
          >
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground truncate">
                  {c.title}
                </p>
                {isLoading ? (
                  <div className="h-7 w-12 bg-muted animate-pulse rounded-md" />
                ) : (
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold tracking-tight text-foreground">
                      {c.count}
                    </span>
                    {c.id === "pending" && c.count > 0 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-600 dark:text-amber-400">
                        Action
                      </span>
                    )}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground/80 truncate">
                  {c.subtitle}
                </p>
              </div>

              <div
                className={`size-10 rounded-xl flex items-center justify-center shrink-0 border ${c.bgColor} ${c.color} ${c.borderColor}`}
              >
                <Icon className="size-5" />
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
