/**
 * TypeScript types for the in-app notifications domain.
 */

export type NotificationType =
  | "session_reminder"
  | "booking_confirmed"
  | "booking_cancelled"
  | "evaluation_ready"
  | "writing_correction_ready"
  | "practice_matched"
  | "system_announcement"
  | "payment_succeeded"
  | "payment_failed"
  | "subscription_activated"
  | "subscription_cancelled"
  | "subscription_renewed"
  | "credits_granted"
  | "credits_low"
  | "refund_completed"
  | "teacher_earning_created";

export interface NotificationResponse {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  data: Record<string, any>;
  created_at: string;
}

export interface NotificationListResponse {
  items: NotificationResponse[];
  total: number;
  unread_count: number;
}

export type NotificationCategory =
  | "all"
  | "unread"
  | "learning"
  | "teacher"
  | "practice"
  | "billing"
  | "system";
