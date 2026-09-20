import React from "react"
import {
  ArrowLeft,
  Clock,
  Mic,
  MicOff,
  Radio,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface FocusedSpeakingShellProps {
  title: string
  level?: string
  remainingSeconds?: number
  isMicMuted?: boolean
  onToggleMic?: () => void
  connectionStatus?: "connected" | "connecting"
  onExitClick?: () => void
  children: React.ReactNode
}

export function FocusedSpeakingShell({
  title,
  level,
  remainingSeconds,
  isMicMuted = false,
  onToggleMic,
  connectionStatus = "connected",
  onExitClick,
  children,
}: FocusedSpeakingShellProps) {
  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased">
      {/* Distraction-Free Header */}
      <header className="h-14 border-b border-border/80 bg-card/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          {onExitClick && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onExitClick}
              className="cursor-pointer gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              <span>Quitter</span>
            </Button>
          )}

          <span className="hidden sm:inline text-xs text-muted-foreground">|</span>

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs sm:text-sm font-semibold text-foreground truncate max-w-xs sm:max-w-md">
              {title}
            </span>
            {level && (
              <Badge variant="outline" size="sm" className="hidden sm:inline-flex text-[11px]">
                Niveau {level}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          {/* Connection status */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Radio
              className={cn(
                "size-3.5",
                connectionStatus === "connected"
                  ? "text-emerald-500 animate-pulse"
                  : "text-amber-500"
              )}
            />
            <span>{connectionStatus === "connected" ? "Connecté au lab" : "Connexion..."}</span>
          </div>

          {/* Mic control */}
          {onToggleMic && (
            <Button
              variant={isMicMuted ? "destructive" : "outline"}
              size="sm"
              onClick={onToggleMic}
              className="gap-1.5 text-xs rounded-xl cursor-pointer"
            >
              {isMicMuted ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
              <span className="hidden sm:inline">{isMicMuted ? "Micro coupé" : "Micro actif"}</span>
            </Button>
          )}

          {/* Timer */}
          {typeof remainingSeconds === "number" && (
            <div
              role="timer"
              aria-live="polite"
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl border border-border/80 bg-muted/50 font-mono text-xs font-bold text-foreground shadow-2xs"
            >
              <Clock className="size-3.5" />
              <span>{formatTimer(remainingSeconds)}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  )
}
