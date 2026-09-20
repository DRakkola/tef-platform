/**
 * TanStack React Query hooks for the notifications domain.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "./api";
import type { NotificationListResponse } from "./types";

export const NOTIFICATIONS_QUERY_KEY = ["notifications"];

export function useNotifications(limit = 50) {
  return useQuery<NotificationListResponse>({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, limit],
    queryFn: () => getNotifications(limit),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useUnreadNotificationCount() {
  const { data } = useNotifications(10);
  return data?.unread_count ?? 0;
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => markNotificationAsRead(notificationId),
    onSuccess: (updatedItem) => {
      queryClient.setQueriesData<NotificationListResponse>(
        { queryKey: NOTIFICATIONS_QUERY_KEY },
        (old) => {
          if (!old) return old;
          const wasUnread = old.items.find((n) => n.id === updatedItem.id && !n.is_read);
          return {
            ...old,
            unread_count: wasUnread ? Math.max(0, old.unread_count - 1) : old.unread_count,
            items: old.items.map((n) => (n.id === updatedItem.id ? { ...n, is_read: true } : n)),
          };
        }
      );
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => markAllNotificationsAsRead(),
    onSuccess: () => {
      queryClient.setQueriesData<NotificationListResponse>(
        { queryKey: NOTIFICATIONS_QUERY_KEY },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            unread_count: 0,
            items: old.items.map((n) => ({ ...n, is_read: true })),
          };
        }
      );
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });
}
