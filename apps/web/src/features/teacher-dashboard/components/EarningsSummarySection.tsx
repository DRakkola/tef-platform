import React from "react"
import { Link } from "react-router-dom"
import { CreditCard, ArrowRight, ShieldCheck, RefreshCw, AlertTriangle } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { TeacherEarningsSummary } from "../types"

interface EarningsSummarySectionProps {
  summary?: TeacherEarningsSummary | null
  isLoading: boolean
  isError: boolean
  error?: Error | null
  onRetry: () => void
}

function formatCents(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}

export const EarningsSummarySection: React.FC<EarningsSummarySectionProps> = ({
  summary,
  isLoading,
  isError,
  error,
  onRetry,
}) => {
  return (
    <Card className="border-border/70 shadow-xs">
      <CardHeader className="p-5 pb-3 border-b border-border/40 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CreditCard className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-foreground">
              Revenus
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Rémunérations perçues et disponibles pour virement
            </p>
          </div>
        </div>

        <Button variant="ghost" size="sm" className="text-xs gap-1 h-8" asChild>
          <Link to="/teacher/earnings">
            <span>Voir mes revenus</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>

      <CardContent className="p-5">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-pulse" aria-busy="true">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-3.5 rounded-xl border border-border/60 bg-muted/30">
                <div className="h-3 w-20 bg-muted rounded-sm mb-2" />
                <div className="h-6 w-16 bg-muted rounded-sm" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="p-4 text-center space-y-2 rounded-xl border border-destructive/20 bg-destructive/5" role="alert">
            <AlertTriangle className="size-6 text-destructive mx-auto" />
            <p className="text-xs font-semibold text-foreground">
              Impossible de charger les données financières
            </p>
            <p className="text-xs text-muted-foreground">
              {error?.message || "Une erreur est survenue lors de la récupération de vos revenus."}
            </p>
            <Button size="sm" variant="outline" onClick={onRetry} className="text-xs gap-1 h-7">
              <RefreshCw className="size-3" />
              Réessayer
            </Button>
          </div>
        ) : !summary ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Données de rémunération indisponibles pour le moment.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-border/70 bg-card">
              <span className="text-[11px] font-medium text-muted-foreground block">
                Disponible au versement
              </span>
              <span className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
                {formatCents(summary.available_cents, summary.currency)}
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-border/70 bg-card">
              <span className="text-[11px] font-medium text-muted-foreground block">
                En cours de validation
              </span>
              <span className="text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400 mt-1 block">
                {formatCents(summary.pending_cents, summary.currency)}
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-border/70 bg-card">
              <span className="text-[11px] font-medium text-muted-foreground block">
                Revenu net total (80%)
              </span>
              <span className="text-lg sm:text-xl font-bold text-foreground mt-1 block">
                {formatCents(summary.total_net_cents, summary.currency)}
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-border/70 bg-card">
              <span className="text-[11px] font-medium text-muted-foreground block">
                Cours terminés
              </span>
              <span className="text-lg sm:text-xl font-bold text-foreground mt-1 block">
                {summary.completed_lessons_count}
              </span>
            </div>
          </div>
        )}

        <div className="mt-4 pt-3.5 border-t border-border/40 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-emerald-500 shrink-0" />
          <span>
            Rémunération garantie 80% / 20%. Les fonds sont disponibles 24h après la validation de la séance.
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
