/**
 * Types for Teacher Booking Flow (Page 15).
 */

import type {
  TeacherSummary,
  TimeSlot,
  TeacherServiceItem,
  StudentEntitlements,
  TeacherBookingResponse,
  BookingStatus,
} from "@/features/teachers/types"

export type BookingStep = "service" | "time" | "review" | "success"

export interface BookingFlowState {
  step: BookingStep
  teacherId: string
  selectedService: TeacherServiceItem | null
  selectedDate: string
  selectedSlot: TimeSlot | null
  sessionNotes: string
  userTimezone: string
  isSubmitting: boolean
  bookingConflict: boolean
  conflictMessage?: string
  confirmedBooking: TeacherBookingResponse | null
  networkTimeoutWarning: boolean
}

export interface BookingCalendarEvent {
  title: string
  description: string
  startTime: string
  endTime: string
  location?: string
}

export type {
  TeacherSummary,
  TimeSlot,
  TeacherServiceItem,
  StudentEntitlements,
  TeacherBookingResponse,
  BookingStatus,
}
