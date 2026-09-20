import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCircle2,
  Calendar,
  CreditCard,
  BookOpen,
  PenLine,
  Users,
  Info,
  AlertCircle,
  ArrowRight,
  RotateCw,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "./useNotifications";
import { telemetry } from "@/features/analytics/telemetry";
import type { NotificationCategory, NotificationResponse, NotificationType } from "./types";

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<NotificationCategory>("all");

  const { data, isLoading, isError, refetch } = useNotifications(50);
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const notifications = data?.items || [];
  const unreadCount = data?.unread_count || 0;

  // Track page view
  React.useEffect(() => {
    telemetry.track("notifications_viewed", {
      total: notifications.length,
      unread: unreadCount,
    });
  }, [notifications.length, unreadCount]);

  // Handle Mark All Read
  const handleMarkAllRead = () => {
    telemetry.track("notifications_marked_all_read");
    markAllReadMutation.mutate();
  };

  // Resolve safe internal destination URL based on notification type and payload data
  const getDestinationUrl = (notif: NotificationResponse): string | null => {
    const d = notif.data || {};
    switch (notif.type) {
      case "writing_correction_ready":
        if (d.submission_id) return `/writing/${d.submission_id}/result`;
        if (d.attempt_id) return `/writing/attempts/${d.attempt_id}/result`;
        return "/writing";
      case "evaluation_ready":
        if (d.session_id) return `/speaking/sessions/${d.session_id}`;
        if (d.attempt_id) return `/attempts/${d.attempt_id}/results`;
        return "/progress";
      case "booking_confirmed":
      case "booking_cancelled":
      case "session_reminder":
        return "/bookings";
      case "practice_matched":
        if (d.session_id) return `/practice-pool/session/${d.session_id}`;
        return "/practice-pool";
      case "payment_succeeded":
      case "payment_failed":
      case "subscription_activated":
      case "subscription_cancelled":
      case "subscription_renewed":
      case "credits_granted":
      case "credits_low":
      case "refund_completed":
      case "teacher_earning_created":
        return "/billing";
      default:
        // System announcements or links from backend if explicitly matching internal paths
        if (d.link && typeof d.link === "string" && d.link.startsWith("/")) {
          return d.link;
        }
        return null;
    }
  };

  // Determine CTA label
  const getCtaLabel = (notif: NotificationResponse): string | null => {
    switch (notif.type) {
      case "writing_correction_ready":
        return "Voir la correction";
      case "evaluation_ready":
        return "Voir l'évaluation";
      case "booking_confirmed":
      case "session_reminder":
        return "Voir la réservation";
      case "booking_cancelled":
        return "Gérer mes réservations";
      case "practice_matched":
        return "Accéder à la session";
      case "payment_succeeded":
      case "payment_failed":
      case "subscription_activated":
      case "subscription_renewed":
        return "Voir la facturation";
      case "credits_low":
        return "Recharger des crédits";
      default:
        return notif.data?.cta_label || null;
    }
  };

  // Handle Notification Item Click
  const handleItemClick = (notif: NotificationResponse) => {
    if (!notif.is_read) {
      markReadMutation.mutate(notif.id);
      telemetry.track("notification_marked_read", { notification_id: notif.id, type: notif.type });
    }

    const destination = getDestinationUrl(notif);
    if (destination) {
      telemetry.track("notification_action_clicked", {
        notification_id: notif.id,
        type: notif.type,
        destination,
      });
      navigate(destination);
    }
  };

  // Categorize notifications for filtering
  const isCategoryMatch = (notif: NotificationResponse, category: NotificationCategory): boolean => {
    if (category === "all") return true;
    if (category === "unread") return !notif.is_read;

    const learningTypes: NotificationType[] = [
      "evaluation_ready",
      "writing_correction_ready",
    ];
    const teacherTypes: NotificationType[] = [
      "booking_confirmed",
      "booking_cancelled",
      "session_reminder",
      "teacher_earning_created",
    ];
    const practiceTypes: NotificationType[] = ["practice_matched"];
    const billingTypes: NotificationType[] = [
      "payment_succeeded",
      "payment_failed",
      "subscription_activated",
      "subscription_cancelled",
      "subscription_renewed",
      "credits_granted",
      "credits_low",
      "refund_completed",
    ];

    switch (category) {
      case "learning":
        return learningTypes.includes(notif.type);
      case "teacher":
        return teacherTypes.includes(notif.type);
      case "practice":
        return practiceTypes.includes(notif.type);
      case "billing":
        return billingTypes.includes(notif.type);
      case "system":
        return notif.type === "system_announcement";
      default:
        return true;
    }
  };

  const filteredNotifications = notifications.filter((n) =>
    isCategoryMatch(n, activeCategory)
  );

  // Icon mapping
  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case "writing_correction_ready":
        return <PenLine className="size-4 text-emerald-600 dark:text-emerald-400" />;
      case "evaluation_ready":
        return <BookOpen className="size-4 text-indigo-600 dark:text-indigo-400" />;
      case "booking_confirmed":
      case "session_reminder":
        return <Calendar className="size-4 text-primary" />;
      case "booking_cancelled":
        return <Calendar className="size-4 text-rose-500" />;
      case "practice_matched":
        return <Users className="size-4 text-amber-500" />;
      case "payment_succeeded":
      case "subscription_activated":
      case "subscription_renewed":
      case "credits_granted":
        return <CreditCard className="size-4 text-emerald-600 dark:text-emerald-400" />;
      case "payment_failed":
      case "subscription_cancelled":
      case "credits_low":
        return <CreditCard className="size-4 text-rose-500" />;
      default:
        return <Info className="size-4 text-slate-400" />;
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return "Il y a un instant";
      if (diffMins < 60) return `Il y a ${diffMins} min`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `Il y a ${diffHours}h`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return "Hier";
      if (diffDays < 7) return `Il y a ${diffDays} jours`;
      return new Date(isoString).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
      });
    } catch {
      return "Récemment";
    }
  };

  return (
    <AppShell>
      <PageShell maxWidth="default">
        {/* Page Header */}
        <PageHeader
          title="Notifications"
          description="Consultez les mises à jour importantes concernant vos évaluations, corrections, cours et entraînements."
          badge={
            unreadCount > 0 ? (
              <Badge variant="secondary" size="sm" className="font-mono font-bold text-primary">
                {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
              </Badge>
            ) : undefined
          }
          actions={
            unreadCount > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllRead}
                disabled={markAllReadMutation.isPending}
                className="cursor-pointer text-xs font-semibold gap-1.5"
              >
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                <span>Tout marquer comme lu</span>
              </Button>
            ) : undefined
          }
        />

        {/* Filter Tabs Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-border/80 text-xs">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`px-3 py-2 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeCategory === "all"
                ? "bg-primary text-primary-foreground font-bold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <span>Toutes</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeCategory === "all"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {notifications.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory("unread")}
            className={`px-3 py-2 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeCategory === "unread"
                ? "bg-primary text-primary-foreground font-bold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <span>Non lues</span>
            {unreadCount > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  activeCategory === "unread"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {unreadCount}
              </span>
            )}
          </button>

          <div className="h-4 w-px bg-border/80 mx-1 shrink-0" />

          <button
            type="button"
            onClick={() => setActiveCategory("learning")}
            className={`px-3 py-2 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeCategory === "learning"
                ? "bg-muted text-foreground font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            Apprentissage
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory("teacher")}
            className={`px-3 py-2 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeCategory === "teacher"
                ? "bg-muted text-foreground font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            Professeurs
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory("practice")}
            className={`px-3 py-2 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeCategory === "practice"
                ? "bg-muted text-foreground font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            Pratique
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory("billing")}
            className={`px-3 py-2 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeCategory === "billing"
                ? "bg-muted text-foreground font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            Facturation
          </button>
        </div>

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-4 border-border/80 shadow-xs flex items-start gap-3.5 animate-pulse">
                <div className="size-9 rounded-xl bg-muted shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded-md w-1/3" />
                  <div className="h-3 bg-muted rounded-md w-3/4" />
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Error State */}
        {isError && !isLoading && (
          <Card className="p-8 text-center space-y-3 border-destructive/30 bg-destructive/5">
            <AlertCircle className="size-10 text-destructive mx-auto" />
            <h3 className="text-sm font-bold text-foreground">
              Impossible de charger vos notifications.
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Une erreur réseau s'est produite lors de la récupération des alertes.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="cursor-pointer text-xs font-semibold gap-1.5"
            >
              <RotateCw className="size-3.5" />
              <span>Réessayer</span>
            </Button>
          </Card>
        )}

        {/* Empty States */}
        {!isLoading && !isError && filteredNotifications.length === 0 && (
          <Card className="p-12 text-center space-y-3 border-dashed border-border/80 bg-muted/20">
            <div className="size-12 rounded-full bg-muted text-muted-foreground mx-auto flex items-center justify-center">
              {activeCategory === "unread" ? (
                <CheckCircle2 className="size-6 text-emerald-500" />
              ) : (
                <Bell className="size-6" />
              )}
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-foreground">
                {activeCategory === "unread"
                  ? "Aucune notification non lue."
                  : "Vous êtes à jour."}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {activeCategory === "unread"
                  ? "Vous avez consulté toutes vos alertes récentes."
                  : "Aucune nouvelle notification pour le moment."}
              </p>
            </div>
          </Card>
        )}

        {/* Notifications List */}
        {!isLoading && !isError && filteredNotifications.length > 0 && (
          <div className="space-y-2.5 pt-1">
            {filteredNotifications.map((notif) => {
              const ctaLabel = getCtaLabel(notif);
              const destination = getDestinationUrl(notif);

              return (
                <Card
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  className={`p-4 border transition-all cursor-pointer shadow-xs hover:border-primary/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    !notif.is_read
                      ? "bg-primary/5 border-primary/25 shadow-xs"
                      : "bg-card border-border/80 hover:bg-muted/20"
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {/* Category Icon */}
                    <div
                      className={`size-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        !notif.is_read
                          ? "bg-card border-primary/20 shadow-xs"
                          : "bg-muted/50 border-border"
                      }`}
                    >
                      {getNotificationIcon(notif.type)}
                    </div>

                    {/* Content */}
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-bold text-foreground truncate">
                          {notif.title}
                        </h4>
                        {!notif.is_read && (
                          <span
                            aria-label="Non lue"
                            className="size-2 rounded-full bg-primary shrink-0"
                          />
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {notif.message}
                      </p>

                      <div className="text-[11px] text-muted-foreground font-mono pt-0.5">
                        {formatRelativeTime(notif.created_at)}
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  {destination && ctaLabel && (
                    <div className="sm:pl-3 shrink-0 flex items-center justify-end">
                      <Button
                        variant={notif.is_read ? "outline" : "default"}
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleItemClick(notif);
                        }}
                        className="cursor-pointer text-xs font-semibold gap-1.5 h-8 px-3"
                      >
                        <span>{ctaLabel}</span>
                        <ArrowRight className="size-3" />
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </PageShell>
    </AppShell>
  );
};
