import {
  Wifi,
  WifiOff,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { WebRTCConnectionState } from "../types"

export interface SessionConnectionStatusProps {
  connectionState: WebRTCConnectionState
  isReconnecting?: boolean
  compact?: boolean
  className?: string
}

export function SessionConnectionStatus({
  connectionState,
  isReconnecting = false,
  compact = false,
  className,
}: SessionConnectionStatusProps) {
  // Determine semantic presentation
  let icon = <Wifi className="size-3.5 text-muted-foreground" />
  let label = "Connexion..."
  let badgeStyle = "bg-muted/60 text-muted-foreground border-border/80"

  if (isReconnecting || connectionState === "reconnecting") {
    icon = <RotateCw className="size-3.5 text-amber-500 animate-spin" />
    label = "Reconnexion..."
    badgeStyle = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
  } else if (connectionState === "connected") {
    icon = <CheckCircle2 className="size-3.5 text-emerald-500" />
    label = "Connecté"
    badgeStyle = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
  } else if (connectionState === "connecting" || connectionState === "new") {
    icon = <RotateCw className="size-3.5 text-primary animate-spin" />
    label = "Connexion..."
    badgeStyle = "bg-primary/10 text-primary border-primary/30"
  } else if (connectionState === "failed") {
    icon = <AlertTriangle className="size-3.5 text-destructive" />
    label = "Connexion perdue"
    badgeStyle = "bg-destructive/10 text-destructive border-destructive/30"
  } else if (connectionState === "closed") {
    icon = <WifiOff className="size-3.5 text-muted-foreground" />
    label = "Session terminée"
    badgeStyle = "bg-muted text-muted-foreground border-border"
  }

  return (
    <div
      role="status"
      aria-label={`État de la connexion : ${label}`}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
        badgeStyle,
        className
      )}
    >
      {icon}
      {!compact && <span>{label}</span>}
      {compact && <span className="hidden sm:inline">{label}</span>}
    </div>
  )
}

export function ReconnectingBanner({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-xs text-amber-700 dark:text-amber-300">
      <div className="flex items-center gap-2">
        <RotateCw className="size-3.5 animate-spin text-amber-600 dark:text-amber-400" />
        <span className="font-medium">
          Reconnexion en cours... Restabilisation de la liaison audio.
        </span>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="underline font-semibold hover:text-amber-900 dark:hover:text-amber-100 cursor-pointer"
        >
          Réessayer
        </button>
      )}
    </div>
  )
}
