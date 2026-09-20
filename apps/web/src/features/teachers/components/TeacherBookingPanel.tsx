import { Globe, CheckCircle2, Sparkles, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import type { TeacherSummary, TimeSlot, TeacherServiceItem } from "../types"

export interface TeacherBookingPanelProps {
  teacher: TeacherSummary
  selectedService?: TeacherServiceItem
  selectedDate: string
  onDateChange: (date: string) => void
  slots: TimeSlot[]
  selectedSlot: TimeSlot | null
  onSelectSlot: (slot: TimeSlot) => void
  isSlotsLoading?: boolean
  sessionNotes: string
  onSessionNotesChange: (notes: string) => void
  userTimezone: string
  onContinue: () => void
  isInactive?: boolean
}

export function TeacherBookingPanel({
  teacher,
  selectedService,
  selectedDate,
  onDateChange,
  slots,
  selectedSlot,
  onSelectSlot,
  isSlotsLoading,
  sessionNotes,
  onSessionNotesChange,
  userTimezone,
  onContinue,
  isInactive,
}: TeacherBookingPanelProps) {
  const formatPrice = (cents: number) => {
    return `${(cents / 100).toFixed(2)} CAD`
  }

  const isCovered = selectedService?.isCoveredByPlan

  return (
    <Card id="booking-panel" className="border-primary/30 shadow-md rounded-2xl overflow-hidden bg-card">
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg font-bold">Réserver un créneau</CardTitle>
          {isCovered ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              <Sparkles className="size-3 text-primary" />
              <span>Inclus</span>
            </span>
          ) : (
            <span className="text-base font-bold text-primary font-mono">
              {formatPrice(teacher.hourly_price)}
            </span>
          )}
        </div>

        <CardDescription className="flex items-center gap-1 text-xs text-muted-foreground pt-0.5">
          <Globe className="size-3 text-muted-foreground/80 shrink-0" />
          <span>
            Affiché sur votre fuseau : <strong>{userTimezone}</strong>
          </span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {/* Selected Service Notice */}
        {selectedService && (
          <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60 text-xs flex items-center justify-between">
            <span className="text-muted-foreground">Service choisi :</span>
            <span className="font-semibold text-foreground">{selectedService.title}</span>
          </div>
        )}

        {/* Date Picker */}
        <div className="space-y-1.5">
          <label htmlFor="booking-date" className="text-xs font-semibold text-foreground block">
            1. Choisissez une date
          </label>
          <input
            id="booking-date"
            type="date"
            disabled={isInactive}
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50 cursor-pointer"
          />
        </div>

        {/* Slots Grid */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground">
              2. Choisissez une heure (votre heure locale)
            </label>
            <span className="text-[11px] text-muted-foreground font-mono">
              Durée : 60 min
            </span>
          </div>

          {isSlotsLoading ? (
            <div className="grid grid-cols-2 gap-2 pt-1 animate-pulse">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-10 rounded-lg bg-muted/50 border border-border/40" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <div className="p-4 rounded-xl bg-muted/30 border border-dashed border-border text-center space-y-1 my-2">
              <AlertCircle className="size-4 text-muted-foreground mx-auto" />
              <p className="text-xs text-muted-foreground">
                Aucun créneau disponible pour cette date.
              </p>
              <p className="text-[11px] text-muted-foreground/80">
                Veuillez sélectionner un autre jour sur le calendrier.
              </p>
            </div>
          ) : (
            <div
              role="radiogroup"
              aria-label="Créneaux horaires disponibles"
              className="grid grid-cols-2 gap-2 pt-1"
            >
              {slots.map((slot) => {
                const slotKey = slot.id || `${slot.start_time}-${slot.end_time}`
                const isSelected = selectedSlot?.start_time === slot.start_time
                const isAvailable = slot.is_available !== false

                return (
                  <button
                    key={slotKey}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={!isAvailable || isInactive}
                    onClick={() => onSelectSlot(slot)}
                    className={`p-2.5 rounded-lg text-xs font-medium border transition-colors flex items-center justify-between cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-2xs font-semibold"
                        : isAvailable
                        ? "bg-card border-border hover:border-primary/40 hover:bg-muted/40"
                        : "bg-muted/30 border-dashed border-border text-muted-foreground"
                    }`}
                  >
                    <span className="font-mono font-bold">
                      {slot.start_time_local} - {slot.end_time_local}
                    </span>
                    {isAvailable ? (
                      isSelected && <CheckCircle2 className="size-3.5 shrink-0" />
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Complet</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Session Goals input */}
        <div className="space-y-1.5 pt-1">
          <label htmlFor="session-notes" className="text-xs font-semibold text-foreground block">
            3. Objectif de la session (facultatif)
          </label>
          <textarea
            id="session-notes"
            rows={2}
            disabled={isInactive}
            value={sessionNotes}
            onChange={(e) => onSessionNotesChange(e.target.value)}
            placeholder="Ex: Préparation intensive Section A (poser 10 questions) ou relecture d'un fait divers..."
            className="w-full rounded-lg border border-input bg-background p-2.5 text-xs placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
          />
        </div>
      </CardContent>

      <CardFooter className="pt-2 border-t border-border/60">
        <Button
          disabled={!selectedSlot || isInactive}
          onClick={onContinue}
          className="w-full cursor-pointer font-semibold text-xs sm:text-sm h-10 shadow-xs"
        >
          Continuer vers la confirmation
        </Button>
      </CardFooter>
    </Card>
  )
}
