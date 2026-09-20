import React from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import type { TeacherBookingResponse } from "../types"

export interface CancelBookingModalProps {
  booking: TeacherBookingResponse | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  reason: string
  onReasonChange: (reason: string) => void
  isCancelling: boolean
  onConfirmCancel: () => void
}

export const CancelBookingModal: React.FC<CancelBookingModalProps> = ({
  booking,
  isOpen,
  onOpenChange,
  reason,
  onReasonChange,
  isCancelling,
  onConfirmCancel,
}) => {
  if (!booking) return null

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
            <DialogTitle className="text-lg font-bold">
              Annuler votre réservation ?
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
            Cette action libérera le créneau avec <strong>{booking.teacher_display_name || "votre professeur"}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-2 text-xs">
          {/* Booking Summary Box */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border/70 space-y-1">
            <div className="flex justify-between font-semibold text-foreground">
              <span>Enseignant :</span>
              <span>{booking.teacher_display_name}</span>
            </div>
            <div className="flex justify-between text-muted-foreground font-mono">
              <span>Date :</span>
              <span>{new Date(booking.start_time).toLocaleDateString("fr-FR")}</span>
            </div>
          </div>

          {/* Cancellation Policy Notice */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 space-y-1">
            <p className="font-semibold">Politique d'annulation :</p>
            <p className="leading-relaxed">
              Conformément à nos conditions, l'annulation est sans frais jusqu'à 24h avant l'horaire de la séance. Les crédits engagés seront réattribués à votre compte.
            </p>
          </div>

          {/* Cancellation Reason */}
          <div className="space-y-1.5">
            <label htmlFor="cancel-reason" className="font-semibold text-foreground block">
              Motif de l'annulation (facultatif)
            </label>
            <select
              id="cancel-reason"
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="">Sélectionnez un motif…</option>
              <option value="Imprévu d'emploi du temps">Imprévu d'emploi du temps</option>
              <option value="Problème technique / équipement">Problème technique / équipement</option>
              <option value="Reprogrammation nécessaire">Reprogrammation nécessaire</option>
              <option value="Autre raison personnelle">Autre raison personnelle</option>
            </select>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isCancelling}
            className="w-full sm:w-auto cursor-pointer text-xs"
          >
            Conserver la réservation
          </Button>

          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onConfirmCancel}
            disabled={isCancelling}
            className="w-full sm:w-auto cursor-pointer text-xs gap-1.5 font-semibold"
          >
            {isCancelling ? (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                <span>Annulation en cours…</span>
              </>
            ) : (
              <span>Confirmer l'annulation</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
