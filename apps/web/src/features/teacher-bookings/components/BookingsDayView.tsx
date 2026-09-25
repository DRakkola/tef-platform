import React from "react"
import {
  Clock,
  Video,
  UserCheck,
  CheckCircle2,
  XCircle,
  CalendarClock,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { TeacherBooking } from "../types"
import {
  formatTimeInTz,
  isSessionJoinable,
  getStudentDisplayName,
} from "../hooks/useTeacherBookings"

interface BookingsDayViewProps {
  bookings: TeacherBooking[]
  timezone: string
  onSelectBooking: (booking: TeacherBooking) => void
  onConfirm: (id: string) => void
  onCancel: (booking: TeacherBooking) => void
  onReschedule: (booking: TeacherBooking) => void
  isConfirming: boolean
}

export const BookingsDayView: React.FC<BookingsDayViewProps> = ({
  bookings,
  timezone,
  onSelectBooking,
  onConfirm,
  onCancel,
  onReschedule,
  isConfirming,
}) => {
  if (bookings.length === 0) {
    return (
      <Card className="border-dashed border-border/80 bg-muted/10 shadow-xs">
        <CardContent className="p-10 text-center space-y-3">
          <div className="size-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
            <Clock className="size-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">
              Aucune séance ce jour-là
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Vous n'avez aucune séance programmée pour cette journée selon vos disponibilités actuelles.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {bookings.map((booking) => {
        const startTimeStr = formatTimeInTz(booking.start_time, timezone)
        const endTimeStr = formatTimeInTz(booking.end_time, timezone)
        const studentName = getStudentDisplayName(booking)
        const joinable = isSessionJoinable(booking)

        const getStatusBadge = () => {
          switch (booking.status) {
            case "confirmed":
              return (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-semibold uppercase">
                  Confirmée
                </Badge>
              )
            case "requested":
              return (
                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[10px] font-semibold uppercase">
                  En attente
                </Badge>
              )
            case "completed":
              return (
                <Badge variant="secondary" className="text-[10px] font-semibold uppercase">
                  Terminée
                </Badge>
              )
            case "cancelled":
              return (
                <Badge variant="destructive" className="text-[10px] font-semibold uppercase">
                  Annulée
                </Badge>
              )
            case "no_show":
              return (
                <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/20 text-[10px] font-semibold uppercase">
                  Absence
                </Badge>
              )
            default:
              return <Badge variant="outline">{booking.status}</Badge>
          }
        }

        return (
          <Card
            key={booking.id}
            className={`border transition-all shadow-xs ${
              joinable
                ? "border-emerald-500/40 bg-emerald-500/5 ring-1 ring-emerald-500/20"
                : "border-border/70 bg-card hover:bg-muted/15"
            }`}
          >
            <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Left: Time & Student info */}
              <div className="flex items-start sm:items-center gap-4">
                {/* Time pill */}
                <div
                  className={`flex flex-col items-center justify-center min-w-20 px-3 py-2 rounded-xl border text-xs font-semibold ${
                    joinable
                      ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-mono"
                      : "bg-muted/40 border-border/70 text-foreground font-mono"
                  }`}
                >
                  <span className="text-sm">{startTimeStr}</span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    {endTimeStr}
                  </span>
                </div>

                {/* Session Details */}
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-foreground">
                      Séance individuelle TEF
                    </span>
                    {getStatusBadge()}
                    {joinable && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Séance prête
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <UserCheck className="size-3.5 text-muted-foreground/80" />
                      <span>{studentName}</span>
                    </span>
                    {booking.notes && (
                      <span className="italic text-muted-foreground/80 truncate max-w-xs">
                        "{booking.notes}"
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2 self-end md:self-center flex-wrap">
                {/* Join Session CTA */}
                {joinable && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1.5 h-8 font-medium shadow-xs"
                    asChild
                  >
                    <a
                      href={booking.meeting_link || `/speaking/sessions/${booking.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Video className="size-3.5" />
                      <span>Rejoindre la séance</span>
                    </a>
                  </Button>
                )}

                {/* Confirm pending booking */}
                {booking.status === "requested" && (
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1 h-8 font-medium shadow-xs"
                    onClick={() => onConfirm(booking.id)}
                    disabled={isConfirming}
                  >
                    <CheckCircle2 className="size-3.5" />
                    <span>Confirmer</span>
                  </Button>
                )}

                {/* Reschedule */}
                {(booking.status === "confirmed" || booking.status === "requested") && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 gap-1 text-muted-foreground hover:text-foreground"
                    onClick={() => onReschedule(booking)}
                  >
                    <CalendarClock className="size-3.5" />
                    <span className="hidden sm:inline">Reprogrammer</span>
                  </Button>
                )}

                {/* Cancel */}
                {(booking.status === "confirmed" || booking.status === "requested") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-8 gap-1 text-destructive hover:bg-destructive/10"
                    onClick={() => onCancel(booking)}
                  >
                    <XCircle className="size-3.5" />
                    <span className="hidden sm:inline">Annuler</span>
                  </Button>
                )}

                {/* View Details */}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => onSelectBooking(booking)}
                >
                  Détails
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
