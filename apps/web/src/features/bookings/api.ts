/**
 * API client methods for Booking Management (Page 16).
 */

import { apiClient } from "@/core/api"
import type { TeacherBookingResponse, BookingStatus } from "./types"

export interface BookingListFilters {
  status?: BookingStatus
  from_date?: string
  to_date?: string
}

export interface BookingListResponse {
  items: TeacherBookingResponse[]
  total: number
}

export async function getMyBookings(filters: BookingListFilters = {}): Promise<BookingListResponse> {
  const params = new URLSearchParams()
  if (filters.status) {
    params.append("status", filters.status)
  }
  if (filters.from_date) {
    params.append("from_date", filters.from_date)
  }
  if (filters.to_date) {
    params.append("to_date", filters.to_date)
  }

  const query = params.toString() ? `?${params.toString()}` : ""
  return apiClient<BookingListResponse>(`/bookings${query}`)
}

export async function getBookingById(bookingId: string): Promise<TeacherBookingResponse> {
  return apiClient<TeacherBookingResponse>(`/bookings/${bookingId}`)
}

export async function cancelBookingApi(
  bookingId: string,
  reason: string
): Promise<TeacherBookingResponse> {
  return apiClient<TeacherBookingResponse>(`/bookings/${bookingId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })
}
