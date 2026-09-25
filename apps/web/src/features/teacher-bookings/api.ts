/**
 * API client methods for Teacher Bookings & Schedule operations.
 */

import { apiClient } from "@/core/api"
import type {
  TeacherBooking,
  RescheduleBookingPayload,
  CancelBookingPayload,
} from "./types"
import type { TeacherProfileResponse } from "@/features/teacher-dashboard/types"

export async function getMyTeacherProfile(): Promise<TeacherProfileResponse> {
  return apiClient<TeacherProfileResponse>("/teachers/me")
}

export async function getTeacherBookings(params?: {
  status?: string
  from_date?: string
  to_date?: string
}): Promise<{ items: TeacherBooking[]; total: number }> {
  const query = new URLSearchParams()
  if (params?.status && params.status !== "all") {
    query.set("status", params.status)
  }
  if (params?.from_date) {
    query.set("from_date", params.from_date)
  }
  if (params?.to_date) {
    query.set("to_date", params.to_date)
  }

  const qs = query.toString()
  return apiClient<{ items: TeacherBooking[]; total: number }>(
    qs ? `/bookings?${qs}` : "/bookings"
  )
}

export async function getTeacherBooking(id: string): Promise<TeacherBooking> {
  return apiClient<TeacherBooking>(`/bookings/${id}`)
}

export async function confirmBooking(id: string): Promise<TeacherBooking> {
  return apiClient<TeacherBooking>(`/bookings/${id}/confirm`, {
    method: "POST",
  })
}

export async function cancelBooking(
  id: string,
  payload: CancelBookingPayload
): Promise<TeacherBooking> {
  return apiClient<TeacherBooking>(`/bookings/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function rescheduleBooking(
  id: string,
  payload: RescheduleBookingPayload
): Promise<TeacherBooking> {
  return apiClient<TeacherBooking>(`/bookings/${id}/reschedule`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function completeBooking(id: string): Promise<TeacherBooking> {
  return apiClient<TeacherBooking>(`/bookings/${id}/complete`, {
    method: "POST",
  })
}

export async function markNoShow(id: string): Promise<TeacherBooking> {
  return apiClient<TeacherBooking>(`/bookings/${id}/no-show`, {
    method: "POST",
  })
}
