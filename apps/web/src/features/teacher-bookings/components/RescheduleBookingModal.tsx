import React, { useState, useEffect } from "react"
import { CalendarClock, AlertCircle, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { TeacherBooking, RescheduleBookingPayload } from "../types"
import {
  getLocalDateKey,
  formatTimeInTz,
  getStudentDisplayName,
} from "../hooks/useTeacherBookings"

interface RescheduleBookingModalProps {
  booking: TeacherBooking | null
  timezone: string
  isOpen: boolean
  onClose: () => void
  onConfirmReschedule: (id: string, payload: RescheduleBookingPayload) => void
  isLoading: boolean
  error?: string | null
}

export const RescheduleBookingModal: React.FC<RescheduleBookingModalProps> = ({
  booking,
  timezone,
  isOpen,
  onClose,
  onConfirmReschedule,
  isLoading,
  error,
}) => {
  const [newDate, setNewDate] = useState<string>("")
  const [newStartTime, setNewStartTime] = useState<string>("10:00")
  const [newEndTime, setNewEndTime] = useState<string>("11:00")
  const [reason, setReason] = useState<string>("")
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    if (booking) {
      // Initialize with next day same time
      const nextDay = new Date(booking.start_time)
      nextDay.setDate(nextDay.getDate() + 1)
      setNewDate(getLocalDateKey(nextDay, timezone))
      setNewStartTime(formatTimeInTz(booking.start_time, timezone))
      setNewEndTime(formatTimeInTz(booking.end_time, timezone))
      setReason("")
      setValidationError(null)
    }
  }, [booking, timezone])

  if (!booking) return null

  const studentName = getStudentDisplayName(booking)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDate) {
      setValidationError("Veuillez sélectionner une date.")
      return
    }
    if (!newStartTime || !newEndTime) {
      setValidationError("Veuillez renseigner les heures de début et de fin.")
      return
    }
    if (newEndTime <= newStartTime) {
      setValidationError("L'heure de fin doit être strictement postérieure à l'heure de début.")
      return
    }

    // Construct ISO strings
    const startIso = new Date(`${newDate}T${newStartTime}:00Z`).toISOString()
    const endIso = new Date(`${newDate}T${newEndTime}:00Z`).toISOString()

    setValidationError(null)
    onConfirmReschedule(booking.id, {
      new_start_time: startIso,
      new_end_time: endIso,
      reason: reason.trim() || undefined,
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="space-y-2">
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <CalendarClock className="size-5" />
            </div>
            <DialogTitle className="text-base font-bold text-foreground">
              Reprogrammer la séance
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Définissez un nouveau créneau pour la séance avec{" "}
              <strong className="text-foreground">{studentName}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3.5 text-xs">
            {/* New Date */}
            <div className="space-y-1.5">
              <label
                htmlFor="reschedule-date"
                className="font-semibold text-foreground"
              >
                Nouvelle date ({timezone}) <span className="text-destructive">*</span>
              </label>
              <Input
                id="reschedule-date"
                type="date"
                value={newDate}
                onChange={(e) => {
                  setNewDate(e.target.value)
                  if (validationError) setValidationError(null)
                }}
                min={getLocalDateKey(new Date(), timezone)}
                required
                className="text-xs"
              />
            </div>

            {/* Time slot row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="reschedule-start"
                  className="font-semibold text-foreground"
                >
                  Heure de début <span className="text-destructive">*</span>
                </label>
                <Input
                  id="reschedule-start"
                  type="time"
                  value={newStartTime}
                  onChange={(e) => {
                    setNewStartTime(e.target.value)
                    if (validationError) setValidationError(null)
                  }}
                  required
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="reschedule-end"
                  className="font-semibold text-foreground"
                >
                  Heure de fin <span className="text-destructive">*</span>
                </label>
                <Input
                  id="reschedule-end"
                  type="time"
                  value={newEndTime}
                  onChange={(e) => {
                    setNewEndTime(e.target.value)
                    if (validationError) setValidationError(null)
                  }}
                  required
                  className="text-xs"
                />
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <label
                htmlFor="reschedule-reason"
                className="font-semibold text-foreground"
              >
                Motif de la reprogrammation (optionnel)
              </label>
              <Textarea
                id="reschedule-reason"
                placeholder="Ex. : Décalage à la demande de l'élève..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="text-xs resize-none"
                maxLength={500}
              />
            </div>

            {/* Error banner */}
            {(validationError || error) && (
              <div
                className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-start gap-2 text-xs font-medium"
                role="alert"
              >
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{validationError || error}</span>
              </div>
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
              Annuler
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isLoading}
              className="text-xs font-medium gap-1.5"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Validation du créneau...</span>
                </>
              ) : (
                <span>Confirmer le nouveau créneau</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
