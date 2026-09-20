import React from "react"
import { CheckCircle2, RotateCw, WifiOff, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SaveStatusState } from "../types"

export interface SaveStatusProps {
  status: SaveStatusState
  isOnline?: boolean
  onRetry?: () => void
  className?: string
}

export const SaveStatus: React.FC<SaveStatusProps> = ({
  status,
  isOnline = true,
  onRetry,
  className,
}) => {
  if (!isOnline || status === "offline") {
    return (
      <div
        role="status"
        aria-label="Mode hors ligne avec sauvegarde locale"
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-warning/15 text-warning-foreground border border-warning/30",
          className
        )}
      >
        <WifiOff className="size-3" />
        <span>Stockage local actif</span>
      </div>
    )
  }

  if (status === "saving" || status === "retrying") {
    return (
      <div
        role="status"
        aria-label="Enregistrement des réponses en cours"
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 animate-pulse",
          className
        )}
      >
        <RotateCw className="size-3 animate-spin text-primary" />
        <span>{status === "retrying" ? "Synchronisation..." : "Enregistrement..."}</span>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div
        role="alert"
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20",
          className
        )}
      >
        <AlertCircle className="size-3" />
        <span>Erreur de sauvegarde</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="underline underline-offset-2 ml-1 cursor-pointer font-bold hover:text-destructive/80"
          >
            Réessayer
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      role="status"
      aria-label="Toutes les réponses sont enregistrées sur le serveur"
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted/60 text-muted-foreground border border-border/60",
        className
      )}
    >
      <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" />
      <span>Réponses sécurisées</span>
    </div>
  )
}
