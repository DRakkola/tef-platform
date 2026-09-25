import React from "react"
import {
  Calendar,
  UserCheck,
  Video,
  CheckCircle2,
  RotateCcw,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { TeacherBooking } from "../types"
import {
  formatDateInTz,
  formatTimeInTz,
  isSessionJoinable,
  getStudentDisplayName,
} from "../hooks/useTeacherBookings"

interface BookingsListViewProps {
  bookings: TeacherBooking[]
  timezone: string
  onSelectBooking: (booking: TeacherBooking) => void
  onConfirm: (id: string) => void
  onCancel?: (booking: TeacherBooking) => void
  onReschedule?: (booking: TeacherBooking) => void
  isConfirming: boolean
  hasActiveFilters: boolean
  onResetFilters: () => void
}

export const BookingsListView: React.FC<BookingsListViewProps> = ({
  bookings,
  timezone,
  onSelectBooking,
  onConfirm,
  isConfirming,
  hasActiveFilters,
  onResetFilters,
}) => {
  if (bookings.length === 0) {
    return (
      <Card className="border-dashed border-border/80 bg-muted/10 shadow-xs">
        <CardContent className="p-10 text-center space-y-3">
          <div className="size-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
            <Calendar className="size-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">
              Aucune séance trouvée
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Aucune réservation ne correspond à vos critères de recherche actuels.
            </p>
          </div>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onResetFilters}
              className="text-xs gap-1.5"
            >
              <RotateCcw className="size-3.5" />
              <span>Réinitialiser les filtres</span>
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  const renderStatusBadge = (status: string) => {
    switch (status) {
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
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-3">
      {/* Desktop Table View (hidden on screens < 768px) */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40 font-semibold text-muted-foreground">
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Heure ({timezone})</th>
              <th className="py-3 px-4">Élève</th>
              <th className="py-3 px-4">Service</th>
              <th className="py-3 px-4">Statut</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {bookings.map((booking) => {
              const dateStr = formatDateInTz(booking.start_time, timezone)
              const startTimeStr = formatTimeInTz(booking.start_time, timezone)
              const endTimeStr = formatTimeInTz(booking.end_time, timezone)
              const studentName = getStudentDisplayName(booking)
              const joinable = isSessionJoinable(booking)

              return (
                <tr
                  key={booking.id}
                  className={`hover:bg-muted/20 transition-colors ${
                    joinable ? "bg-emerald-500/5 font-medium" : ""
                  }`}
                >
                  <td className="py-3.5 px-4 text-foreground font-medium capitalize">
                    {dateStr}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-muted-foreground">
                    {startTimeStr} - {endTimeStr}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      <UserCheck className="size-3.5 text-muted-foreground/70" />
                      <span>{studentName}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-muted-foreground">
                    Séance individuelle TEF
                  </td>
                  <td className="py-3.5 px-4">
                    {renderStatusBadge(booking.status)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {joinable && (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-7 px-2.5 font-medium"
                          asChild
                        >
                          <a
                            href={booking.meeting_link || `/speaking/sessions/${booking.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Video className="size-3 mr-1" />
                            Rejoindre
                          </a>
                        </Button>
                      )}

                      {booking.status === "requested" && (
                        <Button
                          size="sm"
                          className="text-xs h-7 px-2.5"
                          onClick={() => onConfirm(booking.id)}
                          disabled={isConfirming}
                        >
                          <CheckCircle2 className="size-3 mr-1" />
                          Confirmer
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 px-2.5"
                        onClick={() => onSelectBooking(booking)}
                      >
                        Détails
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card / Row View (visible only on < 768px, zero horizontal overflow) */}
      <div className="block md:hidden space-y-2.5">
        {bookings.map((booking) => {
          const dateStr = formatDateInTz(booking.start_time, timezone)
          const startTimeStr = formatTimeInTz(booking.start_time, timezone)
          const endTimeStr = formatTimeInTz(booking.end_time, timezone)
          const studentName = getStudentDisplayName(booking)
          const joinable = isSessionJoinable(booking)

          return (
            <Card
              key={booking.id}
              className={`border transition-all shadow-xs ${
                joinable
                  ? "border-emerald-500/40 bg-emerald-500/5 ring-1 ring-emerald-500/20"
                  : "border-border/70 bg-card"
              }`}
            >
              <CardContent className="p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <span className="text-xs font-bold text-foreground block truncate">
                      Séance individuelle TEF
                    </span>
                    <span className="text-[11px] text-muted-foreground capitalize block">
                      {dateStr} • {startTimeStr} - {endTimeStr}
                    </span>
                  </div>
                  <div>{renderStatusBadge(booking.status)}</div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                  <UserCheck className="size-3.5 text-muted-foreground/80" />
                  <span>{studentName}</span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 flex-1"
                    onClick={() => onSelectBooking(booking)}
                  >
                    Détails
                  </Button>

                  {joinable && (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-7 flex-1 font-medium"
                      asChild
                    >
                      <a
                        href={booking.meeting_link || `/speaking/sessions/${booking.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Video className="size-3 mr-1" />
                        Rejoindre
                      </a>
                    </Button>
                  )}

                  {booking.status === "requested" && (
                    <Button
                      size="sm"
                      className="text-xs h-7 flex-1"
                      onClick={() => onConfirm(booking.id)}
                      disabled={isConfirming}
                    >
                      Confirmer
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
