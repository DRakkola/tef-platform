import React, { useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { TeacherBooking } from "../types"
import {
  formatDateInTz,
  formatTimeInTz,
  getStudentDisplayName,
} from "../hooks/useTeacherBookings"

interface CancelBookingDialogProps {
  booking: TeacherBooking | null
  timezone: string
  isOpen: boolean
  onClose: () => void
  onConfirmCancel: (id: string, reason: string) => void
  isLoading: boolean
  error?: string | null
}

export const CancelBookingDialog: React.FC<CancelBookingDialogProps> = ({
  booking,
  timezone,
  isOpen,
  onClose,
  onConfirmCancel,
  isLoading,
  error,
}) => {
  const [reason, setReason] = useState<string>("")
  const [validationError, setValidationError] = useState<string | null>(null)

  if (!booking) return null

  const studentName = getStudentDisplayName(booking)
  const dateStr = formatDateInTz(booking.start_time, timezone)
  const timeStr = `${formatTimeInTz(booking.start_time, timezone)} - ${formatTimeInTz(
    booking.end_time,
    timezone
  )}`

  const handleCancelSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim() || reason.trim().length < 5) {
      setValidationError("Veuillez indiquer un motif d'annulation d'au moins 5 caractères.")
      return
    }
    setValidationError(null)
    onConfirmCancel(booking.id, reason.trim())
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleCancelSubmit}>
          <DialogHeader className="space-y-2">
            <div className="size-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertTriangle className="size-5" />
            </div>
            <DialogTitle className="text-base font-bold text-foreground">
              Annuler la séance
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Êtes-vous certain de vouloir annuler la séance avec{" "}
              <strong className="text-foreground">{studentName}</strong> prévue le{" "}
              <strong className="text-foreground capitalize">{dateStr}</strong> de{" "}
              <strong className="text-foreground">{timeStr}</strong> ?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div className="space-y-1.5">
              <label
                htmlFor="cancel-reason"
                className="text-xs font-semibold text-foreground"
              >
                Motif de l'annulation <span className="text-destructive">*</span>
              </label>
              <Textarea
                id="cancel-reason"
                placeholder="Ex. : Empêchement de dernière minute, urgence personnelle..."
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value)
                  if (validationError) setValidationError(null)
                }}
                rows={3}
                className="text-xs resize-none"
                maxLength={500}
                required
              />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>L'élève recevra immédiatement une notification par email.</span>
                <span>{reason.length}/500</span>
              </div>
            </div>

            {(validationError || error) && (
              <p className="text-xs text-destructive font-medium">
                {validationError || error}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isLoading}
              className="text-xs"
            >
              Conserver la séance
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={isLoading || !reason.trim()}
              className="text-xs font-medium gap-1.5"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Annulation en cours...</span>
                </>
              ) : (
                <span>Confirmer l'annulation</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
