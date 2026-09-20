import React, { useState, useRef, useEffect, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  FileCheck2,
  Calendar,
  MessageSquare,
  CreditCard,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { QueryClientContext } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/features/notifications";
import { telemetry } from "@/features/analytics/telemetry";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  read?: boolean;
  is_read?: boolean;
  created_at: string;
  link?: string;
  data?: Record<string, any>;
}

interface NotificationCenterUIProps {
  items: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  onMarkAllAsRead: () => void;
  onItemClick: (item: NotificationItem) => void;
}

const NotificationCenterUI: React.FC<NotificationCenterUIProps> = ({
  items,
  unreadCount,
  isLoading,
  onMarkAllAsRead,
  onItemClick,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const getIcon = (type: string) => {
    if (type.includes("correction") || type.includes("writing")) {
      return <FileCheck2 className="size-4 text-emerald-500" />;
    }
    if (type.includes("booking") || type.includes("session_reminder")) {
      return <Calendar className="size-4 text-primary" />;
    }
    if (type.includes("practice") || type.includes("speaking")) {
      return <MessageSquare className="size-4 text-amber-500" />;
    }
    if (type.includes("payment") || type.includes("subscription") || type.includes("credit")) {
      return <CreditCard className="size-4 text-blue-500" />;
    }
    return <Sparkles className="size-4 text-muted-foreground" />;
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours < 1) return "Il y a un instant";
      if (diffHours < 24) return `Il y a ${diffHours}h`;
      const diffDays = Math.floor(diffHours / 24);
      return `Il y a ${diffDays}j`;
    } catch {
      return "Récemment";
    }
  };

  const displayBadgeCount = unreadCount > 9 ? "9+" : String(unreadCount);

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex size-9 items-center justify-center rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-ring"
        aria-label={`Notifications (${unreadCount} non lues)`}
        aria-expanded={isOpen}
      >
        <Bell className="size-4 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex min-w-4 h-4 px-1 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground font-mono">
            {displayBadgeCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          data-slot="notification-popover"
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden animate-in fade-in-0 zoom-in-95"
        >
          {/* Popover Header */}
          <div className="flex items-center justify-between p-3.5 border-b border-border bg-muted/40">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-foreground">Notifications</h4>
              {unreadCount > 0 && (
                <Badge variant="secondary" size="sm" className="font-mono text-xs">
                  {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkAllAsRead();
                }}
                className="text-xs font-medium text-primary hover:underline cursor-pointer flex items-center gap-1"
              >
                <CheckCircle2 className="size-3 text-emerald-500" />
                <span>Tout marquer comme lu</span>
              </button>
            )}
          </div>

          {/* Popover Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border/60">
            {isLoading ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Chargement des notifications...
              </div>
            ) : items.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Aucune notification pour le moment.
              </div>
            ) : (
              items.slice(0, 8).map((item) => {
                const isRead = item.is_read ?? item.read ?? false;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setIsOpen(false);
                      onItemClick(item);
                    }}
                    className={cn(
                      "p-3.5 flex items-start gap-3 hover:bg-muted/30 transition-colors cursor-pointer text-left",
                      !isRead && "bg-primary/5"
                    )}
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      {getIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {item.title}
                        </p>
                        <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                          {formatRelativeTime(item.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {item.message}
                      </p>
                    </div>
                    {!isRead && (
                      <span
                        aria-label="Non lue"
                        className="size-2 rounded-full bg-primary shrink-0 mt-1.5"
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Popover Footer: Link to Full Center */}
          <div className="p-2.5 border-t border-border bg-muted/20 text-center">
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1.5 py-1 px-2 rounded-md hover:bg-muted/50 transition-colors"
            >
              <span>Voir toutes les notifications</span>
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

// 1. Implementation using React Query (when QueryClientContext is present)
const NotificationCenterWithQuery: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useNotifications(10);
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const items = data?.items || [];
  const unreadCount = data?.unread_count ?? items.filter((n) => !n.is_read).length;

  const handleMarkAllAsRead = () => {
    telemetry.track("notifications_marked_all_read");
    markAllReadMutation.mutate();
  };

  const handleItemClick = (item: NotificationItem) => {
    if (!item.is_read) {
      markReadMutation.mutate(item.id);
      telemetry.track("notification_marked_read", { notification_id: item.id, type: item.type });
    }

    const targetLink =
      item.link ||
      (item.data?.submission_id ? `/writing/${item.data.submission_id}/result` : null) ||
      (item.data?.attempt_id ? `/writing/attempts/${item.data.attempt_id}/result` : null) ||
      (item.data?.session_id ? `/practice-pool/session/${item.data.session_id}` : null) ||
      (item.type?.includes("booking") ? "/bookings" : null) ||
      (item.type?.includes("payment") || item.type?.includes("subscription") ? "/billing" : null);

    if (targetLink) {
      telemetry.track("notification_action_clicked", {
        notification_id: item.id,
        destination: targetLink,
      });
      navigate(targetLink);
    }
  };

  return (
    <NotificationCenterUI
      items={items}
      unreadCount={unreadCount}
      isLoading={isLoading}
      onMarkAllAsRead={handleMarkAllAsRead}
      onItemClick={handleItemClick}
    />
  );
};

// 2. Fallback implementation using direct fetch (when QueryClientContext is absent)
const NotificationCenterFallback: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    setIsLoading(true);
    fetch("/api/v1/notifications", { headers })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Could not fetch");
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : data.items || [];
        setItems(list);
      })
      .catch(() => {
        // Mock fallback if network unavailable
        setItems([]);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const unreadCount = items.filter((n) => !n.is_read && !n.read).length;

  const handleMarkAllAsRead = () => {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true, read: true })));
  };

  const handleItemClick = (item: NotificationItem) => {
    setItems((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, is_read: true, read: true } : n))
    );

    const targetLink =
      item.link ||
      (item.data?.submission_id ? `/writing/${item.data.submission_id}/result` : null) ||
      (item.data?.attempt_id ? `/writing/attempts/${item.data.attempt_id}/result` : null) ||
      (item.data?.session_id ? `/practice-pool/session/${item.data.session_id}` : null) ||
      (item.type?.includes("booking") ? "/bookings" : null) ||
      (item.type?.includes("payment") || item.type?.includes("subscription") ? "/billing" : null);

    if (targetLink) {
      navigate(targetLink);
    }
  };

  return (
    <NotificationCenterUI
      items={items}
      unreadCount={unreadCount}
      isLoading={isLoading}
      onMarkAllAsRead={handleMarkAllAsRead}
      onItemClick={handleItemClick}
    />
  );
};

// Exported root: dynamically dispatches to Query or Fallback based on QueryClientContext
export const NotificationCenter: React.FC = () => {
  const client = useContext(QueryClientContext);
  if (client) {
    return <NotificationCenterWithQuery />;
  }
  return <NotificationCenterFallback />;
};
