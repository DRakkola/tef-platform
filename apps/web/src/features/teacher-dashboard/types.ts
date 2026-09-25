/**
 * Types for the Teacher Dashboard feature (Page 25).
 */

import type { BookingStatus, TeacherVerificationStatus } from "@/features/teachers/types"

export interface TeacherProfileResponse {
  id: string
  user_id: string
  display_name: string
  bio?: string | null
  expertise: string[]
  teaching_levels: string[]
  hourly_price: number
  verification_status: TeacherVerificationStatus
  timezone: string
  created_at?: string
  updated_at?: string
}

export interface TeacherAvailabilityRule {
  id: string
  teacher_id: string
  weekday: number // 0 = Monday, 6 = Sunday
  start_time: string // HH:MM:SS
  end_time: string // HH:MM:SS
  timezone: string
  is_active: boolean
  created_at?: string
}

export interface TeacherAvailabilityRuleCreate {
  weekday: number
  start_time: string
  end_time: string
  timezone?: string
}

export interface TeacherBookingItem {
  id: string
  teacher_id: string
  student_id: string
  teacher_display_name?: string | null
  student_identifier: string
  service_title: string
  duration_minutes: number
  start_time: string
  end_time: string
  status: BookingStatus
  notes?: string | null
  meeting_link?: string | null
  is_today: boolean
  can_join: boolean
}

export interface TeacherWritingQueueItem {
  id: string
  attempt_id: string
  task_id: string
  task_title?: string
  student_identifier: string
  word_count: number
  status: string
  submitted_at: string
  priority?: "normal" | "urgent"
}

export interface TeacherSpeakingSessionItem {
  id: string
  topic: string
  level?: string
  duration_minutes: number
  status: string
  starts_at?: string | null
  expires_at?: string | null
  room_id?: string | null
  student_identifier: string
  can_join: boolean
}

export interface TeacherEarningsSummary {
  total_gross_cents: number
  total_platform_fee_cents: number
  total_net_cents: number
  available_cents: number
  pending_cents: number
  paid_cents: number
  currency: string
  completed_lessons_count: number
}

export interface TeacherRecentActivityItem {
  id: string
  type: "session_completed" | "correction_returned" | "new_booking"
  title: string
  description: string
  timestamp: string
}
