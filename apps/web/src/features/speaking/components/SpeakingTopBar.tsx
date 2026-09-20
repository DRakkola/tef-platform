import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SpeakingTimer } from "./SpeakingTimer"
import { SessionConnectionStatus } from "./SessionConnectionStatus"
import { MicrophoneControl } from "./MicrophoneControl"
import type { WebRTCConnectionState } from "../types"

export interface SpeakingTopBarProps {
  title: string
  sessionType: "ai" | "teacher"
  connectionState: WebRTCConnectionState
  isReconnecting: boolean
  isMuted: boolean
  remainingSeconds: number
  onToggleMute: () => void
  onLeaveClick: () => void
}

export function SpeakingTopBar({
  title,
  sessionType,
  connectionState,
  isReconnecting,
  isMuted,
  remainingSeconds,
  onToggleMute,
  onLeaveClick,
}: SpeakingTopBarProps) {
  return (
    <div className="h-14 px-4 sm:px-6 flex items-center justify-between gap-3">
      {/* Left: Speaking Badge & Session Title */}
      <div className="flex items-center gap-2.5 min-w-0">
        <Badge variant="outline" className="font-semibold text-xs border-primary/30 text-primary shrink-0">
          Speaking · {sessionType === "ai" ? "IA" : "Professeur"}
        </Badge>
        <span className="font-medium text-xs sm:text-sm text-foreground truncate max-w-[200px] sm:max-w-xs md:max-w-md" title={title}>
          {title}
        </span>
      </div>

      {/* Center / Right: Connection, Mic, Timer */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <SessionConnectionStatus
          connectionState={connectionState}
          isReconnecting={isReconnecting}
          compact
        />

        <MicrophoneControl
          isMuted={isMuted}
          onToggleMute={onToggleMute}
          compact
        />

        <SpeakingTimer remainingSeconds={remainingSeconds} />

        {/* Far Right: Leave Session */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onLeaveClick}
          className="cursor-pointer gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
        >
          <LogOut className="size-3.5" />
          <span className="hidden sm:inline">Quitter</span>
        </Button>
      </div>
    </div>
  )
}
