import React from "react"
import { Link } from "react-router-dom"
import {
  Calendar,
  Clock,
  Globe,
  Video,
  ExternalLink,
  FileText,
  RotateCcw,
  XCircle,
  Eye,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { BookingStatusBadge } from "./BookingStatusBadge"
import type { TeacherBookingResponse } from "../types"

export interface BookingCardProps {
  booking: TeacherBookingResponse
  userTimezone: string
  onViewDetails: (booking: TeacherBookingResponse) => void
  onReschedule: (booking: TeacherBookingResponse) => void
  onCancel: (booking: TeacherBookingResponse) => void
  getJoinStatus: (booking: TeacherBookingResponse) => { canJoin: boolean; label: string; variant: "primary" | "warning" | "secondary" | "muted" }
}

export const BookingCard: React.FC<BookingCardProps> = ({
  booking,
  userTimezone,
  onViewDetails,
  onReschedule,
  onCancel,
  getJoinStatus,
}) => {
  const joinStatus = getJoinStatus(booking)
  const isUpcoming = booking.status === "confirmed" || booking.status === "requested"
  const isPast = booking.status === "completed" || booking.status === "cancelled" || booking.status === "no_show"

  // Derive service name from notes if available
  const serviceName = React.useMemo(() => {
    if (booking.notes?.startsWith("Session: ")) {
      return booking.notes.replace("Session: ", "").split(" - ")[0]
    }
    if (booking.notes?.toLowerCase().includes("oral")) return "Expression orale TEF"
    if (booking.notes?.toLowerCase().includes("écrit") || booking.notes?.toLowerCase().includes("ecrit")) return "Expression écrite TEF"
    return "Session individuelle TEF"
  }, [booking.notes])

  const isWriting = serviceName.toLowerCase().includes("écrit") || serviceName.toLowerCase().includes("ecrit")
  const isSpeaking = serviceName.toLowerCase().includes("oral") || serviceName.toLowerCase().includes("speaking")

  // Format date and time
  const { dateFormatted, timeFormatted } = React.useMemo(() => {
    try {
      const start = new Date(booking.start_time)
      const end = new Date(booking.end_time)

      const dateStr = start.toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })

      const timeStr = `${start.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} – ${end.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`

      return { dateFormatted: dateStr, timeFormatted: timeStr }
    } catch {
      return { dateFormatted: booking.start_time, timeFormatted: "" }
    }
  }, [booking.start_time, booking.end_time])

  // Teacher initials
  const initials = React.useMemo(() => {
    const name = booking.teacher_display_name || "Enseignant"
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase()
  }, [booking.teacher_display_name])

  return (
    <div
      data-testid="booking-card"
      className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-card hover:border-primary/30 transition-all shadow-xs space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Teacher Info & Service */}
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="size-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs shrink-0 font-mono">
            {initials}
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-foreground truncate">
                {booking.teacher_display_name || "Enseignant agréé TEF"}
              </h2>
              <BookingStatusBadge status={booking.status} />
            </div>

            <p className="text-xs font-semibold text-primary">
              {serviceName}
              <span className="text-muted-foreground font-normal font-mono"> · 60 min</span>
            </p>
          </div>
        </div>

        {/* Right: Date & Time in Local Timezone */}
        <div className="sm:text-right space-y-0.5 shrink-0">
          <div className="flex sm:justify-end items-center gap-1.5 text-xs text-foreground font-medium capitalize">
            <Calendar className="size-3.5 text-primary" aria-hidden="true" />
            <span>{dateFormatted}</span>
          </div>

          <div className="flex sm:justify-end items-center gap-1.5 text-xs font-mono font-bold text-foreground">
            <Clock className="size-3.5 text-primary" aria-hidden="true" />
            <span>{timeFormatted}</span>
          </div>

          <div className="flex sm:justify-end items-center gap-1 text-[11px] text-muted-foreground">
            <Globe className="size-3 text-muted-foreground" aria-hidden="true" />
            <span className="font-mono">{userTimezone}</span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          {/* Join CTA for Live Speaking Session */}
          {isUpcoming && joinStatus.canJoin && booking.meeting_link && (
            <Button asChild size="sm" className="cursor-pointer shadow-xs gap-1.5 font-semibold text-xs h-8">
              <a href={booking.meeting_link} target="_blank" rel="noopener noreferrer">
                <Video className="size-3.5" aria-hidden="true" />
                <span>Rejoindre la séance</span>
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            </Button>
          )}

          {/* Starting soon badge button */}
          {isUpcoming && !joinStatus.canJoin && joinStatus.label === "Démarre bientôt" && (
            <Button size="sm" variant="secondary" disabled className="gap-1.5 text-xs h-8 opacity-90">
              <Clock className="size-3.5 text-amber-500 animate-pulse" aria-hidden="true" />
              <span>Démarre bientôt</span>
            </Button>
          )}

          {/* Completed Speaking Evaluation Link */}
          {isPast && isSpeaking && booking.status === "completed" && (
            <Button asChild size="sm" variant="outline" className="cursor-pointer text-xs h-8 gap-1.5">
              <Link to="/speaking">
                <FileText className="size-3.5 text-primary" aria-hidden="true" />
                <span>Voir l'évaluation</span>
              </Link>
            </Button>
          )}

          {/* Completed Writing Correction Link */}
          {isPast && isWriting && (
            <Button asChild size="sm" variant="outline" className="cursor-pointer text-xs h-8 gap-1.5">
              <Link to="/writing">
                <FileText className="size-3.5 text-primary" aria-hidden="true" />
                <span>Voir la correction</span>
              </Link>
            </Button>
          )}

          {/* View Details Button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onViewDetails(booking)}
            className="cursor-pointer text-xs h-8 gap-1 text-muted-foreground hover:text-foreground"
          >
            <Eye className="size-3.5" aria-hidden="true" />
            <span>Détails</span>
          </Button>
        </div>

        {/* Secondary Actions for Upcoming: Reschedule & Cancel */}
        {isUpcoming && booking.status !== "cancelled" && (
          <div className="flex items-center gap-1.5">
            <Button
              size="xs"
              variant="outline"
              onClick={() => onReschedule(booking)}
              className="cursor-pointer text-xs h-7 gap-1"
            >
              <RotateCcw className="size-3" aria-hidden="true" />
              <span>Reprogrammer</span>
            </Button>

            <Button
              size="xs"
              variant="ghost"
              onClick={() => onCancel(booking)}
              className="cursor-pointer text-xs h-7 gap-1 text-destructive hover:bg-destructive/10"
            >
              <XCircle className="size-3" aria-hidden="true" />
              <span>Annuler</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
