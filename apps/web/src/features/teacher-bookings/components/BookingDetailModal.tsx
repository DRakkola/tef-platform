import React from "react"
import {
  Calendar,
  Clock,
  UserCheck,
  Video,
  AlertCircle,
  CheckCircle2,
  CalendarClock,
  XCircle,
  UserX,
  Globe,
  FileText,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { TeacherBooking } from "../types"
import {
  formatFullDateInTz,
  formatTimeInTz,
  isSessionJoinable,
  getStudentDisplayName,
} from "../hooks/useTeacherBookings"

interface BookingDetailModalProps {
  booking: TeacherBooking | null
  timezone: string
  isOpen: boolean
  onClose: () => void
  onConfirm: (id: string) => void
  onCancel: (booking: TeacherBooking) => void
  onReschedule: (booking: TeacherBooking) => void
  onComplete: (id: string) => void
  onNoShow: (id: string) => void
  isConfirming: boolean
  isCompleting: boolean
  isMarkingNoShow: boolean
}

export const BookingDetailModal: React.FC<BookingDetailModalProps> = ({
  booking,
  timezone,
  isOpen,
  onClose,
  onConfirm,
  onCancel,
  onReschedule,
  onComplete,
  onNoShow,
  isConfirming,
  isCompleting,
  isMarkingNoShow,
}) => {
  if (!booking) return null

  const studentName = getStudentDisplayName(booking)
  const fullDateStr = formatFullDateInTz(booking.start_time, timezone)
  const startTimeStr = formatTimeInTz(booking.start_time, timezone)
  const endTimeStr = formatTimeInTz(booking.end_time, timezone)
  const joinable = isSessionJoinable(booking)

  const durationMinutes = Math.round(
    (new Date(booking.end_time).getTime() - new Date(booking.start_time).getTime()) /
      (1000 * 60)
  )

  const getStatusBadge = () => {
    switch (booking.status) {
      case "confirmed":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-xs font-semibold uppercase">
            Confirmée
          </Badge>
        )
      case "requested":
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20 text-xs font-semibold uppercase">
            En attente de validation
          </Badge>
        )
      case "completed":
        return (
          <Badge variant="secondary" className="text-xs font-semibold uppercase">
            Terminée
          </Badge>
        )
      case "cancelled":
        return (
          <Badge variant="destructive" className="text-xs font-semibold uppercase">
            Annulée
          </Badge>
        )
      case "no_show":
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/20 text-xs font-semibold uppercase">
            Absence (No-show)
          </Badge>
        )
      default:
        return <Badge variant="outline">{booking.status}</Badge>
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <DialogTitle className="text-lg font-bold text-foreground">
                  Séance individuelle TEF
                </DialogTitle>
                {getStatusBadge()}
              </div>
              <DialogDescription className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Globe className="size-3 text-muted-foreground/70" />
                <span>Horaires calculés sur votre fuseau : {timezone}</span>
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          {/* Join Call Banner if active */}
          {joinable && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 text-xs">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  La séance peut être rejointe dès maintenant
                </div>
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                  Votre salle de visio est ouverte pour vous et l'élève.
                </p>
              </div>

              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs gap-1.5 shadow-xs shrink-0"
                asChild
              >
                <a
                  href={booking.meeting_link || `/speaking/sessions/${booking.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Video className="size-3.5" />
                  <span>Rejoindre</span>
                </a>
              </Button>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3.5 p-3.5 rounded-xl border border-border/70 bg-card">
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <UserCheck className="size-3 text-muted-foreground/70" />
                Élève
              </span>
              <p className="text-sm font-semibold text-foreground">
                {studentName}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Clock className="size-3 text-muted-foreground/70" />
                Durée
              </span>
              <p className="text-sm font-semibold text-foreground">
                {durationMinutes} minutes
              </p>
            </div>

            <div className="space-y-1 col-span-2">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="size-3 text-muted-foreground/70" />
                Date & Heure
              </span>
              <p className="text-xs font-semibold text-foreground capitalize">
                {fullDateStr} • {startTimeStr} - {endTimeStr}
              </p>
            </div>
          </div>

          {/* Student Notes / Objectives */}
          {booking.notes && (
            <div className="p-3.5 rounded-xl border border-border/60 bg-muted/10 space-y-1.5">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <FileText className="size-3 text-muted-foreground/70" />
                Notes & objectifs de l'élève
              </span>
              <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                {booking.notes}
              </p>
            </div>
          )}

          {/* Cancellation Notice if cancelled */}
          {booking.status === "cancelled" && (
            <div className="p-3.5 rounded-xl border border-destructive/20 bg-destructive/5 space-y-1 text-xs">
              <div className="font-semibold text-destructive flex items-center gap-1.5">
                <AlertCircle className="size-3.5" />
                Séance annulée
              </div>
              {booking.cancellation_reason && (
                <p className="text-muted-foreground">
                  Motif : {booking.cancellation_reason}
                </p>
              )}
              {booking.cancelled_at && (
                <p className="text-[10px] text-muted-foreground/70">
                  Annulée le {new Date(booking.cancelled_at).toLocaleString("fr-FR")}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-muted/20 border-t border-border/60 flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Fermer
          </Button>

          <div className="flex items-center gap-2 flex-wrap">
            {/* If requested: Confirm / Refuse */}
            {booking.status === "requested" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    onClose()
                    onCancel(booking)
                  }}
                >
                  <XCircle className="size-3.5 mr-1" />
                  Refuser
                </Button>
                <Button
                  size="sm"
                  className="text-xs font-medium"
                  onClick={() => onConfirm(booking.id)}
                  disabled={isConfirming}
                >
                  <CheckCircle2 className="size-3.5 mr-1" />
                  Confirmer la séance
                </Button>
              </>
            )}

            {/* If confirmed: Reschedule / Complete / No-Show / Cancel */}
            {booking.status === "confirmed" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    onClose()
                    onReschedule(booking)
                  }}
                >
                  <CalendarClock className="size-3.5 mr-1" />
                  Reprogrammer
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    onClose()
                    onCancel(booking)
                  }}
                >
                  <XCircle className="size-3.5 mr-1" />
                  Annuler
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  className="text-xs"
                  onClick={() => onComplete(booking.id)}
                  disabled={isCompleting}
                >
                  <CheckCircle2 className="size-3.5 mr-1" />
                  Terminée
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-rose-600"
                  onClick={() => onNoShow(booking.id)}
                  disabled={isMarkingNoShow}
                >
                  <UserX className="size-3.5 mr-1" />
                  Absence
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
