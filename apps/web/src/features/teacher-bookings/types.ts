/**
 * Types for Teacher Bookings & Schedule feature (Page 26).
 */

export type BookingStatus =
  | "requested"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show"

export interface TeacherBooking {
  id: string
  teacher_id: string
  student_id: string
  teacher_display_name?: string | null
  student_display_name?: string | null
  student_email?: string | null // Kept in schema type but NEVER displayed in UI
  start_time: string
  end_time: string
  status: BookingStatus
  timezone?: string
  payment_status?: string
  notes?: string | null
  meeting_link?: string | null
  cancellation_reason?: string | null
  cancelled_by_user_id?: string | null
  cancelled_at?: string | null
  created_at: string
  updated_at?: string
}

export type BookingStatusFilter = "all" | BookingStatus
export type TimeRangeFilter = "all" | "today" | "upcoming" | "past"
export type CalendarViewMode = "day" | "week" | "list"

export interface RescheduleBookingPayload {
  new_start_time: string
  new_end_time: string
  reason?: string
}

export interface CancelBookingPayload {
  reason: string
}

export interface BookingsSummaryMetrics {
  todayCount: number
  upcomingCount: number
  pendingCount: number
  completedMonthCount: number
}

export interface BookingDayGroup {
  dateKey: string // YYYY-MM-DD
  label: string // e.g. "Lundi 21 Septembre"
  isToday: boolean
  bookings: TeacherBooking[]
}

export interface WeekDaySlot {
  date: Date
  dateKey: string // YYYY-MM-DD
  dayLabel: string // "Lun 21"
  fullDayLabel: string // "Lundi 21 sept."
  isToday: boolean
  bookings: TeacherBooking[]
}
