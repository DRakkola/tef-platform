import React from "react"
import { Link } from "react-router-dom"
import { Calendar, PenTool, Users, CreditCard, ArrowUpRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { TeacherEarningsSummary } from "../types"

interface TeacherSummaryCardsProps {
  todaySessionsCount: number
  pendingCorrectionsCount: number
  newBookingsCount: number
  earningsSummary?: TeacherEarningsSummary | null
  isLoading?: boolean
}

function formatCents(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}

export const TeacherSummaryCards: React.FC<TeacherSummaryCardsProps> = ({
  todaySessionsCount,
  pendingCorrectionsCount,
  newBookingsCount,
  earningsSummary,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-busy="true">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-5">
              <div className="h-4 w-24 bg-muted rounded-sm mb-3" />
              <div className="h-8 w-16 bg-muted rounded-sm mb-2" />
              <div className="h-3 w-32 bg-muted/60 rounded-sm" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Séances aujourd'hui */}
      <Link
        to="#today-schedule"
        className="group focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
        onClick={(e) => {
          const el = document.getElementById("today-schedule")
          if (el) {
            e.preventDefault()
            el.scrollIntoView({ behavior: "smooth" })
          }
        }}
      >
        <Card className="h-full border-border/70 hover:border-primary/50 transition-all hover:shadow-xs cursor-pointer">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-muted-foreground mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Aujourd'hui
              </span>
              <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Calendar className="size-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold tracking-tight text-foreground">
                {todaySessionsCount}
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                <span>{todaySessionsCount === 1 ? "séance prévue" : "séances prévues"}</span>
                <ArrowUpRight className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
              </p>
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* 2. Corrections en attente */}
      <Link
        to="#corrections-queue"
        className="group focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
        onClick={(e) => {
          const el = document.getElementById("corrections-queue")
          if (el) {
            e.preventDefault()
            el.scrollIntoView({ behavior: "smooth" })
          }
        }}
      >
        <Card className="h-full border-border/70 hover:border-primary/50 transition-all hover:shadow-xs cursor-pointer">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-muted-foreground mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Corrections
              </span>
              <div className="size-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <PenTool className="size-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold tracking-tight text-foreground">
                {pendingCorrectionsCount}
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                <span>{pendingCorrectionsCount === 1 ? "à traiter" : "en attente"}</span>
                <ArrowUpRight className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
              </p>
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* 3. Nouvelles réservations */}
      <Link
        to="/bookings"
        className="group focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
      >
        <Card className="h-full border-border/70 hover:border-primary/50 transition-all hover:shadow-xs cursor-pointer">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-muted-foreground mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Réservations
              </span>
              <div className="size-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Users className="size-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold tracking-tight text-foreground">
                {newBookingsCount}
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                <span>{newBookingsCount === 1 ? "réservation active" : "réservations actives"}</span>
                <ArrowUpRight className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
              </p>
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* 4. Revenus / Solde */}
      {earningsSummary ? (
        <Link
          to="/teacher/earnings"
          className="group focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
        >
          <Card className="h-full border-border/70 hover:border-primary/50 transition-all hover:shadow-xs cursor-pointer">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between text-muted-foreground mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Solde disponible
                </span>
                <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CreditCard className="size-4" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold tracking-tight text-foreground">
                  {formatCents(earningsSummary.available_cents, earningsSummary.currency)}
                </div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                  <span>Prêt pour virement</span>
                  <ArrowUpRight className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      ) : (
        <Card className="h-full border-border/70">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-muted-foreground mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Revenus
              </span>
              <div className="size-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
                <CreditCard className="size-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight text-foreground">—</div>
              <p className="text-xs text-muted-foreground mt-1">Aucun versement disponible</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
