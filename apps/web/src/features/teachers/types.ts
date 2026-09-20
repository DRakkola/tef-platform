/**
 * Types for Teacher profiles, availability, marketplace filtering, and bookings.
 */

export type TeacherVerificationStatus = "approved" | "pending" | "rejected"

export interface TeacherSummary {
  id: string
  user_id: string
  display_name: string
  bio?: string | null
  headline?: string | null
  expertise: string[]
  teaching_levels: string[]
  hourly_price: number // in cents
  verification_status: TeacherVerificationStatus
  timezone: string
  avatar_url?: string
}

export interface TimeSlot {
  id?: string
  start_time: string
  end_time: string
  start_time_local: string
  end_time_local: string
  duration_minutes: number
  is_available?: boolean
}

export interface TeacherSlotsResponse {
  teacher_id: string
  teacher_timezone: string
  student_timezone: string
  date_from: string
  date_to: string
  slots: TimeSlot[]
}

export interface TeacherListResponse {
  items: TeacherSummary[]
  total: number
  page: number
  page_size: number
}

export type TeacherSortOption =
  | "recommended"
  | "price_asc"
  | "price_desc"
  | "earliest_availability"

export interface TeacherFilters {
  search?: string
  specialization?: string
  level?: string
  min_price?: number
  max_price?: number
  availability?: "all" | "today" | "this_week"
  sort?: TeacherSortOption
  page?: number
  page_size?: number
}

export interface StudentEntitlements {
  credits_balance: number
  has_subscription: boolean
  subscription_tier: string
  unlimited_mock_tests?: boolean
  speaking_practice?: boolean
}

export interface TeacherServiceItem {
  id: string
  title: string
  durationMinutes: number
  description: string
  badgeText?: string
  isCoveredByPlan?: boolean
  priceCents: number
}

export interface BookingCreatePayload {
  teacher_id: string
  start_time: string
  end_time: string
  notes?: string
}

export type BookingStatus =
  | "requested"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show"

export interface TeacherBookingResponse {
  id: string
  teacher_id: string
  student_id: string
  teacher_display_name?: string | null
  student_email?: string | null
  start_time: string
  end_time: string
  status: BookingStatus
  timezone: string
  payment_status?: string
  notes?: string | null
  meeting_link?: string | null
  cancellation_reason?: string | null
  created_at: string
  updated_at: string
}

// Backward-compatibility aliases
export type TeacherItem = TeacherSummary
export type TeacherProfileCard = TeacherSummary
export type TeacherSlot = TimeSlot
