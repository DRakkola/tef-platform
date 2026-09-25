import React from "react"
import { UserCheck, Video } from "lucide-react"
import type { TeacherBooking, WeekDaySlot } from "../types"
import {
  formatTimeInTz,
  isSessionJoinable,
  getStudentDisplayName,
} from "../hooks/useTeacherBookings"

interface BookingsWeekViewProps {
  weekDays: WeekDaySlot[]
  timezone: string
  onSelectBooking: (booking: TeacherBooking) => void
}

export const BookingsWeekView: React.FC<BookingsWeekViewProps> = ({
  weekDays,
  timezone,
  onSelectBooking,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      {weekDays.map((daySlot) => {
        const hasBookings = daySlot.bookings.length > 0

        return (
          <div
            key={daySlot.dateKey}
            className={`flex flex-col rounded-xl border transition-all ${
              daySlot.isToday
                ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20 shadow-xs"
                : "border-border/70 bg-card"
            }`}
          >
            {/* Day Header */}
            <div
              className={`p-3 border-b flex items-center justify-between ${
                daySlot.isToday
                  ? "border-primary/20 bg-primary/10 text-primary font-semibold"
                  : "border-border/50 text-foreground font-medium"
              }`}
            >
              <div className="text-xs capitalize flex items-center gap-1.5">
                <span>{daySlot.dayLabel}</span>
                {daySlot.isToday && (
                  <span className="size-1.5 rounded-full bg-primary" />
                )}
              </div>
              <span className="text-[11px] text-muted-foreground font-mono">
                {daySlot.bookings.length}
              </span>
            </div>

            {/* Sessions List for this Day */}
            <div className="p-2 space-y-2 flex-1 min-h-36">
              {!hasBookings ? (
                <div className="h-full flex items-center justify-center p-4 text-center">
                  <span className="text-[11px] text-muted-foreground/60 italic">
                    Aucun créneau
                  </span>
                </div>
              ) : (
                daySlot.bookings.map((booking) => {
                  const startTimeStr = formatTimeInTz(booking.start_time, timezone)
                  const endTimeStr = formatTimeInTz(booking.end_time, timezone)
                  const studentName = getStudentDisplayName(booking)
                  const joinable = isSessionJoinable(booking)

                  const getStatusColor = () => {
                    switch (booking.status) {
                      case "confirmed":
                        return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                      case "requested":
                        return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                      case "completed":
                        return "border-border/70 bg-muted/40 text-muted-foreground"
                      case "cancelled":
                        return "border-destructive/30 bg-destructive/10 text-destructive line-through opacity-70"
                      case "no_show":
                        return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                      default:
                        return "border-border/70 bg-card text-foreground"
                    }
                  }

                  return (
                    <button
                      key={booking.id}
                      type="button"
                      onClick={() => onSelectBooking(booking)}
                      className={`w-full text-left p-2 rounded-lg border text-xs transition-all hover:shadow-xs hover:border-primary/50 cursor-pointer ${getStatusColor()} ${
                        joinable ? "ring-2 ring-emerald-500" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-mono font-semibold text-[11px]">
                          {startTimeStr} - {endTimeStr}
                        </span>
                        {joinable && (
                          <Video className="size-3 text-emerald-600 animate-pulse" />
                        )}
                      </div>

                      <div className="flex items-center gap-1 font-medium truncate">
                        <UserCheck className="size-3 shrink-0 opacity-70" />
                        <span className="truncate">{studentName}</span>
                      </div>

                      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="capitalize">{booking.status}</span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
