import React from "react"
import {
  Headphones,
  RotateCw,
  Volume2,
  Pause,
  CheckCircle2,
  AlertCircle,
  VolumeX,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { AudioPlaybackState } from "../types"

export interface ListeningAudioStatusProps {
  status: AudioPlaybackState
  onRetry?: () => void
  className?: string
}

export const ListeningAudioStatus: React.FC<ListeningAudioStatusProps> = ({
  status,
  onRetry,
  className,
}) => {
  switch (status) {
    case "loading":
      return (
        <div
          role="status"
          aria-label="Chargement de l'enregistrement audio"
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 animate-pulse",
            className
          )}
        >
          <RotateCw className="size-3.5 animate-spin" />
          <span>Chargement de l'audio...</span>
        </div>
      )

    case "playing":
      return (
        <div
          role="status"
          aria-label="Lecture de l'enregistrement en cours"
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30",
            className
          )}
        >
          <Volume2 className="size-3.5 animate-pulse text-emerald-600 dark:text-emerald-400" />
          <span>Lecture en cours</span>
        </div>
      )

    case "paused":
      return (
        <div
          role="status"
          aria-label="Lecture audio en pause"
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30",
            className
          )}
        >
          <Pause className="size-3.5" />
          <span>En pause</span>
        </div>
      )

    case "ended":
      return (
        <div
          role="status"
          aria-label="Enregistrement audio terminé"
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border/80",
            className
          )}
        >
          <CheckCircle2 className="size-3.5 text-primary" />
          <span>Audio terminé</span>
        </div>
      )

    case "error":
      return (
        <div
          role="alert"
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-destructive/15 text-destructive border border-destructive/30",
            className
          )}
        >
          <AlertCircle className="size-3.5" />
          <span>Impossible de lire l'audio</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="underline underline-offset-2 ml-1 cursor-pointer font-bold hover:text-destructive/80 focus:outline-hidden"
            >
              Réessayer
            </button>
          )}
        </div>
      )

    case "unavailable":
      return (
        <div
          role="status"
          aria-label="Aucun enregistrement audio disponible"
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border/60",
            className
          )}
        >
          <VolumeX className="size-3.5" />
          <span>Aucun enregistrement disponible</span>
        </div>
      )

    case "idle":
    default:
      return (
        <div
          role="status"
          aria-label="Enregistrement prêt à être écouté"
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-muted/60 text-muted-foreground border border-border/70",
            className
          )}
        >
          <Headphones className="size-3.5 text-primary" />
          <span>Prêt à écouter</span>
        </div>
      )
  }
}
