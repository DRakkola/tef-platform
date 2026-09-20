import { AlertCircle, RotateCcw, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { mapApiError } from "@/core/errorMapping";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onRetry?: () => void;
  onAction?: () => void;
  actionHref?: string;
  isAuthError?: boolean;
  className?: string;
  error?: unknown;
}

export function ErrorState({
  title,
  description,
  actionLabel,
  onRetry,
  onAction,
  actionHref,
  isAuthError = false,
  className,
  error,
}: ErrorStateProps) {
  // Map any machine error codes or provided error
  const sourceError =
    error ||
    (isAuthError
      ? "AUTH_REQUIRED"
      : typeof description === "string" && (description === "AUTH_REQUIRED" || description.includes("AUTH_REQUIRED"))
      ? "AUTH_REQUIRED"
      : description);

  const mapped = mapApiError(sourceError);

  const isAuth = isAuthError || mapped.type === "auth";
  const displayTitle =
    title && !title.includes("AUTH_REQUIRED")
      ? title
      : isAuth
      ? "Session expirée ou connexion requise"
      : mapped.title;

  const displayDescription =
    description && !description.includes("AUTH_REQUIRED")
      ? description
      : mapped.description;

  const displayActionLabel =
    actionLabel && actionLabel !== "AUTH_REQUIRED"
      ? actionLabel
      : isAuth
      ? "Se connecter"
      : mapped.actionLabel || "Réessayer";

  const resolvedActionHref = actionHref || (isAuth ? "/login" : mapped.actionHref);

  const handleAction = () => {
    if (onRetry) {
      onRetry();
    } else if (onAction) {
      onAction();
    } else if (resolvedActionHref) {
      window.location.href = resolvedActionHref;
    } else if (isAuth) {
      window.location.href = "/login";
    }
  };

  const hasAction = Boolean(onRetry || onAction || resolvedActionHref || isAuth);

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-border/80 bg-card shadow-xs max-w-md mx-auto my-6 space-y-4",
        className
      )}
    >
      <div
        className={cn(
          "flex size-12 items-center justify-center rounded-full",
          isAuth ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
        )}
      >
        {isAuth ? (
          <Lock className="size-6" aria-hidden="true" />
        ) : (
          <AlertCircle className="size-6" aria-hidden="true" />
        )}
      </div>
      <div className="space-y-1.5">
        <h3 className="text-base font-semibold text-foreground tracking-tight text-balance">
          {displayTitle}
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          {displayDescription}
        </p>
      </div>
      {hasAction && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleAction}
          className="mt-2 text-xs cursor-pointer"
        >
          {!isAuth && <RotateCcw className="size-3.5 mr-1.5" />}
          {isAuth && <Lock className="size-3.5 mr-1.5" />}
          <span>{displayActionLabel}</span>
        </Button>
      )}
    </div>
  );
}
