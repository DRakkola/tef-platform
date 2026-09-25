/**
 * API client methods for Teacher Dashboard & Availability operations.
 */

import { apiClient } from "@/core/api"
import type {
  TeacherProfileResponse,
  TeacherAvailabilityRule,
  TeacherAvailabilityRuleCreate,
  TeacherEarningsSummary,
} from "./types"

export async function getMyTeacherProfile(): Promise<TeacherProfileResponse> {
  return apiClient<TeacherProfileResponse>("/teachers/me")
}

export async function getTeacherAvailabilityRules(teacherId: string): Promise<TeacherAvailabilityRule[]> {
  return apiClient<TeacherAvailabilityRule[]>(`/teachers/${teacherId}/availability/rules`)
}

export async function createTeacherAvailabilityRule(
  payload: TeacherAvailabilityRuleCreate
): Promise<TeacherAvailabilityRule> {
  return apiClient<TeacherAvailabilityRule>("/teachers/me/availability/rules", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function deleteTeacherAvailabilityRule(ruleId: string): Promise<void> {
  await apiClient<void>(`/teachers/me/availability/rules/${ruleId}`, {
    method: "DELETE",
  })
}

export async function getTeacherBookings(): Promise<{ items: any[]; total: number }> {
  return apiClient<{ items: any[]; total: number }>("/bookings")
}

export async function getTeacherWritingQueue(): Promise<any[]> {
  return apiClient<any[]>("/teacher/writing/queue")
}

export async function getTeacherWritingAssignments(): Promise<any[]> {
  return apiClient<any[]>("/teacher/writing/assignments")
}

export async function getTeacherSpeakingSessions(): Promise<{ items: any[]; total: number }> {
  return apiClient<{ items: any[]; total: number }>("/speaking/sessions")
}

export async function getTeacherEarningsSummary(): Promise<TeacherEarningsSummary> {
  return apiClient<TeacherEarningsSummary>("/teacher/earnings/summary")
}
