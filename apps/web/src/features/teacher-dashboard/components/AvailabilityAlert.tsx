import React from "react"
import { Link } from "react-router-dom"
import { AlertCircle, CheckCircle2, Clock, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface AvailabilityAlertProps {
  hasAvailability: boolean
  rulesCount: number
  isLoading: boolean
}

export const AvailabilityAlert: React.FC<AvailabilityAlertProps> = ({
  hasAvailability,
  rulesCount,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="animate-pulse h-20 bg-muted/40 rounded-xl border border-border/60" aria-busy="true" />
    )
  }

  if (!hasAvailability) {
    return (
      <div
        role="alert"
        className="p-5 rounded-xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
      >
        <div className="flex items-start gap-3.5">
          <div className="size-9 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
            <AlertCircle className="size-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">
              Votre disponibilité n'est pas encore configurée.
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
              Ajoutez vos créneaux pour permettre aux étudiants de réserver des séances.
            </p>
          </div>
        </div>

        <Button
          size="sm"
          className="bg-amber-600 hover:bg-amber-500 text-white text-xs gap-1.5 shrink-0 self-start sm:self-center"
          asChild
        >
          <Link to="/teacher/availability">
            <Clock className="size-3.5" />
            Configurer mes disponibilités
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <Card className="border-border/70 shadow-xs">
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="size-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span>Disponibilités actives</span>
              <span className="inline-block size-2 rounded-full bg-emerald-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {rulesCount > 0 ? `${rulesCount} créneau${rulesCount > 1 ? "x" : ""} récurrent${rulesCount > 1 ? "s" : ""} configuré${rulesCount > 1 ? "s" : ""}. ` : ""}Vos créneaux récurrents hebdomadaires sont ouverts à la réservation par les étudiants.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="text-xs h-8 gap-1 shrink-0 self-start sm:self-center"
          asChild
        >
          <Link to="/teacher/availability">
            <span>Gérer mes disponibilités</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
