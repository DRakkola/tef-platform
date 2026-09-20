import React from "react"
import {
  Calendar,
  Clock,
  Globe,
  GraduationCap,
  Video,
  ExternalLink,
  ShieldAlert,
  RotateCcw,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { BookingStatusBadge } from "./BookingStatusBadge"
import type { TeacherBookingResponse } from "../types"

export interface BookingDetailModalProps {
  booking: TeacherBookingResponse | null
  userTimezone: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onReschedule: (booking: TeacherBookingResponse) => void
  onCancel: (booking: TeacherBookingResponse) => void
  canJoin: boolean
}

export const BookingDetailModal: React.FC<BookingDetailModalProps> = ({
  booking,
  userTimezone,
  isOpen,
  onOpenChange,
  onReschedule,
  onCancel,
  canJoin,
}) => {
  if (!booking) return null

  const isUpcoming = booking.status === "confirmed" || booking.status === "requested"

  // Public Booking Reference
  const bookingRef = React.useMemo(() => {
    if (!booking.id) return "TEF-BK-000000"
    const raw = booking.id.replace(/-/g, "").toUpperCase()
    return `TEF-BK-${raw.slice(0, 8)}`
  }, [booking.id])

  // Format date and time
  const { dateFormatted, timeFormatted } = React.useMemo(() => {
    try {
      const start = new Date(booking.start_time)
      const end = new Date(booking.end_time)

      const dateStr = start.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })

      const timeStr = `${start.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} – ${end.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`

      return { dateFormatted: dateStr, timeFormatted: timeStr }
    } catch {
      return { dateFormatted: booking.start_time, timeFormatted: "" }
    }
  }, [booking.start_time, booking.end_time])

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl p-6">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-4">
            <DialogTitle className="text-lg font-bold">
              Détails de la session
            </DialogTitle>
            <BookingStatusBadge status={booking.status} />
          </div>
          <DialogDescription className="text-xs text-muted-foreground font-mono">
            Référence : {bookingRef}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-2 text-xs sm:text-sm">
          {/* Teacher */}
          <div className="flex items-center justify-between pb-2.5 border-b border-border/60">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <GraduationCap className="size-4 text-primary" aria-hidden="true" />
              Enseignant
            </span>
            <span className="font-semibold text-foreground">
              {booking.teacher_display_name || "Enseignant agréé TEF"}
            </span>
          </div>

          {/* Date & Time */}
          <div className="flex items-center justify-between pb-2.5 border-b border-border/60">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Calendar className="size-4 text-primary" aria-hidden="true" />
              Date
            </span>
            <span className="font-medium text-foreground capitalize">
              {dateFormatted}
            </span>
          </div>

          <div className="flex items-center justify-between pb-2.5 border-b border-border/60">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Clock className="size-4 text-primary" aria-hidden="true" />
              Horaire
            </span>
            <span className="font-mono font-bold text-foreground">
              {timeFormatted} (60 min)
            </span>
          </div>

          <div className="flex items-center justify-between pb-2.5 border-b border-border/60">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Globe className="size-4 text-primary" aria-hidden="true" />
              Fuseau horaire
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {userTimezone}
            </span>
          </div>

          {/* Meeting Link */}
          {booking.meeting_link && booking.status === "confirmed" && (
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5">
              <span className="font-semibold text-primary text-xs flex items-center gap-1.5">
                <Video className="size-3.5" aria-hidden="true" />
                Lien de visioconférence
              </span>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-mono truncate max-w-[240px]">
                  {booking.meeting_link}
                </span>
                {canJoin && (
                  <Button asChild size="xs" className="h-6 text-xs gap-1 cursor-pointer">
                    <a href={booking.meeting_link} target="_blank" rel="noopener noreferrer">
                      <span>Ouvrir</span>
                      <ExternalLink className="size-2.5" aria-hidden="true" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Session Notes */}
          {booking.notes && (
            <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1 text-xs">
              <span className="font-semibold text-foreground">Notes de session :</span>
              <p className="text-muted-foreground leading-relaxed">{booking.notes}</p>
            </div>
          )}

          {/* Cancellation Reason if cancelled */}
          {booking.cancellation_reason && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 space-y-1 text-xs text-destructive">
              <span className="font-semibold">Motif d'annulation :</span>
              <p className="leading-relaxed">{booking.cancellation_reason}</p>
            </div>
          )}

          {/* Cancellation Policy */}
          {isUpcoming && (
            <div className="p-2.5 rounded-xl bg-muted/20 border border-border/50 flex items-center gap-2 text-[11px] text-muted-foreground">
              <ShieldAlert className="size-3.5 shrink-0" aria-hidden="true" />
              <span>Annulation sans frais jusqu'à 24h avant la séance.</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
          {isUpcoming && booking.status !== "cancelled" && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false)
                  onReschedule(booking)
                }}
                className="w-full sm:w-auto cursor-pointer text-xs gap-1.5"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                <span>Reprogrammer</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onOpenChange(false)
                  onCancel(booking)
                }}
                className="w-full sm:w-auto cursor-pointer text-xs gap-1.5 text-destructive hover:bg-destructive/10"
              >
                <XCircle className="size-3.5" aria-hidden="true" />
                <span>Annuler la session</span>
              </Button>
            </>
          )}

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto cursor-pointer text-xs"
          >
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
