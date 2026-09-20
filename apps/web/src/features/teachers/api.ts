/**
 * API client methods for Teacher Discovery, Availability, and Bookings.
 */

import { apiClient } from "@/core/api"
import type {
  BookingCreatePayload,
  StudentEntitlements,
  TeacherBookingResponse,
  TeacherFilters,
  TeacherListResponse,
  TeacherSlotsResponse,
  TeacherSummary,
} from "./types"

export async function getTeachers(filters: TeacherFilters = {}): Promise<TeacherListResponse> {
  const params = new URLSearchParams()
  if (filters.specialization && filters.specialization !== "all") {
    params.append("specialization", filters.specialization)
  }
  if (filters.level && filters.level !== "all") {
    params.append("level", filters.level)
  }
  if (filters.min_price !== undefined) {
    params.append("min_price", filters.min_price.toString())
  }
  if (filters.max_price !== undefined) {
    params.append("max_price", filters.max_price.toString())
  }
  if (filters.page) {
    params.append("page", filters.page.toString())
  }
  if (filters.page_size) {
    params.append("page_size", filters.page_size.toString())
  }

  const query = params.toString() ? `?${params.toString()}` : ""
  return apiClient<TeacherListResponse>(`/teachers${query}`)
}

export async function getTeacherDetail(teacherId: string): Promise<TeacherSummary> {
  return apiClient<TeacherSummary>(`/teachers/${teacherId}`)
}

export async function getTeacherSlots(
  teacherId: string,
  dateFrom?: string,
  dateTo?: string,
  studentTimezone?: string
): Promise<TeacherSlotsResponse> {
  const params = new URLSearchParams()
  if (dateFrom) params.append("date_from", dateFrom)
  if (dateTo) params.append("date_to", dateTo)
  if (studentTimezone) {
    params.append("student_timezone", studentTimezone)
  } else if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
    params.append("student_timezone", Intl.DateTimeFormat().resolvedOptions().timeZone)
  }

  const query = params.toString() ? `?${params.toString()}` : ""
  return apiClient<TeacherSlotsResponse>(`/teachers/${teacherId}/slots${query}`)
}

export async function getStudentEntitlements(): Promise<StudentEntitlements> {
  try {
    return await apiClient<StudentEntitlements>("/billing/entitlements")
  } catch {
    return {
      credits_balance: 0,
      has_subscription: false,
      subscription_tier: "free",
    }
  }
}

export async function createBooking(payload: BookingCreatePayload): Promise<TeacherBookingResponse> {
  return apiClient<TeacherBookingResponse>("/bookings", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}
