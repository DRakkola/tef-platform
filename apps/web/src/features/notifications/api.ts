/**
 * API client methods for the in-app notifications domain.
 */

import { apiClient } from "@/core/api";
import type { NotificationListResponse, NotificationResponse } from "./types";

export async function getNotifications(limit = 50): Promise<NotificationListResponse> {
  return apiClient<NotificationListResponse>(`/notifications?limit=${limit}`);
}

export async function markNotificationAsRead(notificationId: string): Promise<NotificationResponse> {
  return apiClient<NotificationResponse>(`/notifications/${notificationId}/read`, {
    method: "POST",
  });
}

export async function markAllNotificationsAsRead(): Promise<{ marked_as_read: number }> {
  return apiClient<{ marked_as_read: number }>("/notifications/read-all", {
    method: "POST",
  });
}
