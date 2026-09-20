import React from "react"
import {
  Calendar,
  Clock,
  Globe,
  GraduationCap,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Coins,
  ShieldAlert,
  Loader2,
  CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import type {
  TeacherSummary,
  TeacherServiceItem,
  TimeSlot,
  StudentEntitlements,
} from "../types"

export interface BookingReviewProps {
  teacher?: TeacherSummary
  selectedService: TeacherServiceItem | null
  selectedDate: string
  selectedSlot: TimeSlot | null
  userTimezone: string
  entitlements?: StudentEntitlements
  sessionNotes: string
  onSessionNotesChange: (notes: string) => void
  isSubmitting: boolean
  bookingConflict: boolean
  conflictMessage?: string
  networkTimeoutWarning: boolean
  onBackToSlots: () => void
  onConfirmBooking: () => void
}

export const BookingReview: React.FC<BookingReviewProps> = ({
  teacher,
  selectedService,
  selectedDate,
  selectedSlot,
  userTimezone,
  entitlements,
  sessionNotes,
  onSessionNotesChange,
  isSubmitting,
  bookingConflict,
  conflictMessage,
  networkTimeoutWarning,
  onBackToSlots,
  onConfirmBooking,
}) => {
  const isCovered = selectedService?.isCoveredByPlan
  const hasCredits = (entitlements?.credits_balance || 0) >= 2
  const availableCredits = entitlements?.credits_balance || 0
  const bookingCreditsCost = 2
  const remainingCredits = Math.max(0, availableCredits - bookingCreditsCost)

  const formattedDate = React.useMemo(() => {
    try {
      const d = new Date(selectedDate + "T12:00:00Z")
      return d.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    } catch {
      return selectedDate
    }
  }, [selectedDate])

  const formatPrice = (cents: number) => {
    return `${(cents / 100).toFixed(2)} CAD`
  }

  // Determine confirmation button label
  const confirmButtonText = isCovered
    ? entitlements?.has_subscription
      ? "Confirmer la réservation (Inclus dans votre forfait)"
      : `Confirmer pour ${bookingCreditsCost} crédits`
    : `Confirmer la réservation (${formatPrice(selectedService?.priceCents || teacher?.hourly_price || 4500)})`

  return (
    <section aria-labelledby="review-heading" className="space-y-5">
      <div className="space-y-1">
        <h2 id="review-heading" className="text-base sm:text-lg font-bold text-foreground">
          3. Vérifiez et confirmez votre réservation
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Assurez-vous que l'ensemble des détails correspondent à vos attentes avant la validation finale.
        </p>
      </div>

      {/* 409 Stale Slot Conflict Banner */}
      {bookingConflict && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 space-y-2 text-destructive"
        >
          <div className="flex items-center gap-2 font-semibold text-sm">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            <span>Ce créneau n'est plus disponible</span>
          </div>
          <p className="text-xs text-destructive/90 leading-relaxed">
            {conflictMessage || "Un autre candidat vient de réserver cette plage horaire. Veuillez choisir un autre créneau disponible."}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onBackToSlots}
            className="cursor-pointer text-xs h-8 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <RefreshCw className="size-3" aria-hidden="true" />
            <span>Choisir un autre créneau</span>
          </Button>
        </div>
      )}

      {/* Network Timeout In-Flight Warning */}
      {networkTimeoutWarning && (
        <div
          role="status"
          className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5 text-amber-700 dark:text-amber-300"
        >
          <div className="flex items-center gap-2 font-semibold text-xs">
            <Loader2 className="size-3.5 animate-spin shrink-0" aria-hidden="true" />
            <span>Vérification de la confirmation en cours…</span>
          </div>
          <p className="text-xs leading-relaxed">
            La connexion avec le serveur prend plus de temps que prévu. Nous synchronisons l'état de votre réservation sans créer de doublon.
          </p>
        </div>
      )}

      {/* Session Details Card */}
      <Card className="border-border/80 bg-card shadow-xs">
        <CardHeader className="pb-3 border-b border-border/60">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center justify-between">
            <span>Détails de la séance</span>
            {isCovered && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                <Sparkles className="size-3 text-primary" aria-hidden="true" />
                <span>Inclus</span>
              </span>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3 pt-3.5 text-xs sm:text-sm">
          {/* Teacher */}
          <div className="flex items-start justify-between gap-4">
            <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
              <GraduationCap className="size-4 text-primary" aria-hidden="true" />
              Enseignant :
            </span>
            <span className="font-semibold text-foreground text-right">
              {teacher?.display_name}
            </span>
          </div>

          {/* Service */}
          <div className="flex items-start justify-between gap-4">
            <span className="text-muted-foreground shrink-0">Service :</span>
            <span className="font-medium text-foreground text-right">
              {selectedService?.title} ({selectedService?.durationMinutes} min)
            </span>
          </div>

          {/* Date & Time */}
          <div className="flex items-start justify-between gap-4">
            <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
              <Calendar className="size-4 text-primary" aria-hidden="true" />
              Date :
            </span>
            <span className="font-medium text-foreground text-right capitalize">
              {formattedDate}
            </span>
          </div>

          <div className="flex items-start justify-between gap-4">
            <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
              <Clock className="size-4 text-primary" aria-hidden="true" />
              Heure :
            </span>
            <span className="font-mono font-bold text-foreground text-right">
              {selectedSlot?.start_time_local} - {selectedSlot?.end_time_local}
            </span>
          </div>

          {/* Timezone */}
          <div className="flex items-start justify-between gap-4">
            <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
              <Globe className="size-4 text-primary" aria-hidden="true" />
              Fuseau horaire :
            </span>
            <span className="font-mono text-xs text-muted-foreground text-right">
              {userTimezone}
            </span>
          </div>

          {/* Payment & Entitlement Breakdown */}
          <div className="pt-3 border-t border-border/60 space-y-2">
            <div className="flex items-center justify-between font-semibold text-foreground">
              <span className="text-muted-foreground font-normal">Mode de règlement :</span>
              {isCovered ? (
                entitlements?.has_subscription ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    Inclus dans l'abonnement
                  </span>
                ) : hasCredits ? (
                  <span className="text-primary font-mono font-bold flex items-center gap-1">
                    <Coins className="size-3.5" aria-hidden="true" />
                    {bookingCreditsCost} crédits
                  </span>
                ) : (
                  <span>Forfait actif</span>
                )
              ) : (
                <span className="font-mono font-bold text-foreground">
                  {formatPrice(selectedService?.priceCents || teacher?.hourly_price || 4500)}
                </span>
              )}
            </div>

            {/* If paid with credits, show transparent balance */}
            {!entitlements?.has_subscription && hasCredits && (
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50 text-xs space-y-1 font-mono">
                <div className="flex justify-between text-muted-foreground">
                  <span>Crédits disponibles :</span>
                  <span>{availableCredits}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Coût de la séance :</span>
                  <span>-{bookingCreditsCost}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-border/40 font-bold text-foreground">
                  <span>Solde restant après réservation :</span>
                  <span>{remainingCredits}</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Session Notes Input */}
      <div className="space-y-1.5">
        <label htmlFor="session-notes" className="text-xs font-semibold text-foreground block">
          Objectifs ou points à travailler (facultatif)
        </label>
        <textarea
          id="session-notes"
          rows={3}
          value={sessionNotes}
          onChange={(e) => onSessionNotesChange(e.target.value)}
          placeholder="Ex : Je souhaite me concentrer sur la Section B de l'expression orale et l'argumentation face aux objections…"
          className="w-full rounded-xl border border-input bg-background p-3 text-xs sm:text-sm placeholder:text-muted-foreground/70 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary leading-relaxed"
        />
      </div>

      {/* Cancellation Policy Notice */}
      <div className="p-3 rounded-xl bg-muted/20 border border-border/60 flex items-start gap-2.5 text-xs text-muted-foreground">
        <ShieldAlert className="size-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-0.5">
          <p className="font-semibold text-foreground">Politique d'annulation</p>
          <p>
            Annulation et reprogrammation gratuites jusqu'à 24 heures avant l'horaire prévu de la session.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBackToSlots}
          disabled={isSubmitting}
          className="w-full sm:w-auto cursor-pointer text-xs sm:text-sm font-medium"
        >
          Modifier l'horaire
        </Button>

        <Button
          type="button"
          size="lg"
          onClick={onConfirmBooking}
          disabled={isSubmitting || bookingConflict || !selectedSlot}
          className="w-full sm:w-auto cursor-pointer shadow-xs gap-2 font-semibold"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              <span>Confirmation en cours…</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="size-4" aria-hidden="true" />
              <span>{confirmButtonText}</span>
            </>
          )}
        </Button>
      </div>
    </section>
  )
}
