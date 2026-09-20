/**
 * AppErrorState: Standardized, versatile error state component.
 * Maps API and runtime errors into clear, actionable French UI.
 */

import React from "react";
import {
  AlertTriangle,
  Lock,
  ShieldAlert,
  FileQuestion,
  WifiOff,
  Clock,
  Wrench,
  ServerCrash,
  RotateCcw,
  Home,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { mapApiError, type ErrorType, type MappedError } from "@/core/errorMapping";

export interface AppErrorStateProps {
  error?: unknown;
  type?: ErrorType;
  title?: string;
  description?: string;
  actionLabel?: string;
  onRetry?: () => void;
  onAction?: () => void;
  actionHref?: string;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  secondaryActionHref?: string;
  compact?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const AppErrorState: React.FC<AppErrorStateProps> = ({
  error,
  type,
  title,
  description,
  actionLabel,
  onRetry,
  onAction,
  actionHref,
  secondaryActionLabel,
  onSecondaryAction,
  secondaryActionHref,
  compact = false,
  className,
  children,
}) => {
  // Determine mapped error if provided
  const mapped: MappedError | null = error
    ? mapApiError(error)
    : type
    ? mapApiError(new Error(type))
    : null;

  const resolvedType = type || mapped?.type || "unknown";
  const displayTitle = title || mapped?.title || "Une erreur est survenue";
  const displayDescription =
    description ||
    mapped?.description ||
    "Une anomalie temporaire est survenue. Veuillez réessayer.";
  const displayActionLabel =
    actionLabel || mapped?.actionLabel || (onRetry ? "Réessayer" : undefined);
  const resolvedActionHref = actionHref || mapped?.actionHref;

  // Select appropriate icon and color scheme based on error type
  const { icon: Icon, iconBg, iconColor } = getIconAndColors(resolvedType);

  const handlePrimaryAction = () => {
    if (onRetry) {
      onRetry();
    } else if (onAction) {
      onAction();
    } else if (resolvedActionHref) {
      window.location.href = resolvedActionHref;
    }
  };

  const handleSecondaryAction = () => {
    if (onSecondaryAction) {
      onSecondaryAction();
    } else if (secondaryActionHref) {
      window.location.href = secondaryActionHref;
    }
  };

  const hasPrimaryAction = Boolean(onRetry || onAction || resolvedActionHref || displayActionLabel);
  const hasSecondaryAction = Boolean(onSecondaryAction || secondaryActionHref || secondaryActionLabel);

  if (compact) {
    return (
      <div
        role="alert"
        aria-live="polite"
        className={cn(
          "flex items-center gap-3 p-3.5 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive text-sm",
          className
        )}
      >
        <Icon className="size-4 shrink-0 text-destructive" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-xs sm:text-sm truncate">{displayTitle}</p>
          <p className="text-xs text-muted-foreground line-clamp-1">{displayDescription}</p>
        </div>
        {hasPrimaryAction && (
          <Button
            size="sm"
            variant="outline"
            onClick={handlePrimaryAction}
            className="h-7 text-xs px-2.5 shrink-0"
          >
            {onRetry && <RotateCcw className="size-3 mr-1" />}
            {displayActionLabel || "Réessayer"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-border/80 bg-card shadow-xs max-w-md mx-auto my-6 space-y-4",
        className
      )}
    >
      <div
        className={cn(
          "flex size-12 items-center justify-center rounded-full transition-transform duration-200",
          iconBg,
          iconColor
        )}
      >
        <Icon className="size-6" aria-hidden="true" />
      </div>

      <div className="space-y-1.5">
        <h3 className="text-base sm:text-lg font-semibold text-foreground tracking-tight text-balance">
          {displayTitle}
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-sm">
          {displayDescription}
        </p>
      </div>

      {(hasPrimaryAction || hasSecondaryAction || children) && (
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
          {hasPrimaryAction && (
            <Button
              variant={resolvedType === "server" || resolvedType === "network" ? "default" : "outline"}
              size="sm"
              onClick={handlePrimaryAction}
              className="text-xs font-medium cursor-pointer"
            >
              {onRetry && <RotateCcw className="size-3.5 mr-1.5" />}
              {resolvedType === "auth" && <Lock className="size-3.5 mr-1.5" />}
              <span>{displayActionLabel || "Réessayer"}</span>
            </Button>
          )}

          {hasSecondaryAction && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSecondaryAction}
              className="text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {secondaryActionHref?.includes("dashboard") && <Home className="size-3.5 mr-1.5" />}
              {secondaryActionHref?.includes("help") && <HelpCircle className="size-3.5 mr-1.5" />}
              <span>{secondaryActionLabel || "Retour"}</span>
            </Button>
          )}

          {children}
        </div>
      )}
    </div>
  );
};

function getIconAndColors(type: ErrorType) {
  switch (type) {
    case "auth":
      return {
        icon: Lock,
        iconBg: "bg-primary/10",
        iconColor: "text-primary",
      };
    case "forbidden":
      return {
        icon: ShieldAlert,
        iconBg: "bg-amber-500/10",
        iconColor: "text-amber-500",
      };
    case "notFound":
      return {
        icon: FileQuestion,
        iconBg: "bg-muted",
        iconColor: "text-muted-foreground",
      };
    case "network":
    case "offline":
      return {
        icon: WifiOff,
        iconBg: "bg-blue-500/10",
        iconColor: "text-blue-500",
      };
    case "rateLimit":
      return {
        icon: Clock,
        iconBg: "bg-amber-500/10",
        iconColor: "text-amber-500",
      };
    case "maintenance":
    case "serviceUnavailable":
      return {
        icon: Wrench,
        iconBg: "bg-orange-500/10",
        iconColor: "text-orange-500",
      };
    case "server":
      return {
        icon: ServerCrash,
        iconBg: "bg-destructive/10",
        iconColor: "text-destructive",
      };
    default:
      return {
        icon: AlertTriangle,
        iconBg: "bg-destructive/10",
        iconColor: "text-destructive",
      };
  }
}
