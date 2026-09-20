import React from "react"
import { Clock, CheckCircle2, RefreshCw, AlertCircle, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { TimeSlot } from "../types"

export interface BookingTimeSlotsProps {
  slots: TimeSlot[]
  selectedSlot: TimeSlot | null
  onSelectSlot: (slot: TimeSlot) => void
  isLoading?: boolean
  onRefreshSlots: () => void
  onContinue: () => void
}

export const BookingTimeSlots: React.FC<BookingTimeSlotsProps> = ({
  slots,
  selectedSlot,
  onSelectSlot,
  isLoading = false,
  onRefreshSlots,
  onContinue,
}) => {
  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-primary" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-foreground">
            Choisissez un horaire disponible
          </h3>
        </div>

        <Button
          size="xs"
          variant="ghost"
          onClick={onRefreshSlots}
          disabled={isLoading}
          className="text-xs text-muted-foreground hover:text-foreground gap-1.5 h-7 cursor-pointer"
        >
          <RefreshCw className={`size-3 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
          <span>Actualiser</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-11 rounded-xl bg-muted/40 border border-border/50" />
          ))}
        </div>
      ) : slots.length === 0 ? (
        <div className="p-6 rounded-xl bg-muted/20 border border-dashed border-border/80 text-center space-y-2">
          <AlertCircle className="size-5 text-muted-foreground mx-auto" aria-hidden="true" />
          <p className="text-xs sm:text-sm font-medium text-foreground">
            Aucun créneau disponible pour cette date.
          </p>
          <p className="text-xs text-muted-foreground">
            Veuillez sélectionner un autre jour sur le sélecteur ci-dessus pour afficher les disponibilités.
          </p>
        </div>
      ) : (
        <div
          role="radiogroup"
          aria-label="Créneaux horaires disponibles"
          className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1"
        >
          {slots.map((slot) => {
            const isSelected = selectedSlot?.start_time === slot.start_time
            const isAvailable = slot.is_available !== false
            const slotKey = slot.id || `${slot.start_time}-${slot.end_time}`

            return (
              <button
                key={slotKey}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={!isAvailable}
                onClick={() => onSelectSlot(slot)}
                className={`p-3 rounded-xl text-xs font-medium border transition-all flex items-center justify-between cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold ring-2 ring-primary/20"
                    : isAvailable
                    ? "bg-card border-border/80 hover:border-primary/40 hover:bg-muted/30 text-foreground"
                    : "bg-muted/30 border-dashed border-border text-muted-foreground"
                }`}
              >
                <span className="font-mono font-bold">
                  {slot.start_time_local} - {slot.end_time_local}
                </span>

                {isAvailable ? (
                  isSelected ? (
                    <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                  ) : null
                ) : (
                  <span className="text-[10px] text-muted-foreground font-normal">Complet</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Continue Action */}
      <div className="pt-3 flex justify-end">
        <Button
          size="default"
          onClick={onContinue}
          disabled={!selectedSlot}
          className="w-full sm:w-auto cursor-pointer shadow-xs gap-2 font-medium"
        >
          <span>Continuer vers le récapitulatif</span>
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
