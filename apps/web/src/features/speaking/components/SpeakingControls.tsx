import { Mic, MicOff, ChevronRight, LogOut, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AudioLevelIndicator } from "./AudioLevelIndicator"

export interface SpeakingControlsProps {
  isMuted: boolean
  micLevel: number
  onToggleMute: () => void
  onLeaveClick: () => void
  onCompleteClick?: () => void
  onNextPrompt?: () => void
  hasNextPrompt?: boolean
  isCompleting?: boolean
  className?: string
}

export function SpeakingControls({
  isMuted,
  micLevel,
  onToggleMute,
  onLeaveClick,
  onCompleteClick,
  onNextPrompt,
  hasNextPrompt = false,
  isCompleting = false,
  className,
}: SpeakingControlsProps) {
  return (
    <div className={`w-full max-w-xl mx-auto space-y-4 ${className || ""}`}>
      {/* Audio Level Confirmation Meter */}
      <AudioLevelIndicator level={micLevel} isMuted={isMuted} />

      {/* Primary Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {/* Mute/Unmute */}
        <Button
          variant={isMuted ? "destructive" : "outline"}
          size="lg"
          onClick={onToggleMute}
          className="cursor-pointer gap-2 text-sm font-semibold min-w-[140px] h-12 shadow-xs"
        >
          {isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
          <span>{isMuted ? "Micro coupé" : "Couper le micro"}</span>
        </Button>

        {/* Next Question (if multiple prompts) */}
        {hasNextPrompt && onNextPrompt && (
          <Button
            variant="secondary"
            size="lg"
            onClick={onNextPrompt}
            className="cursor-pointer gap-2 text-sm font-semibold h-12 shadow-xs"
          >
            <span>Question suivante</span>
            <ChevronRight className="size-4" />
          </Button>
        )}

        {/* Complete / Finalize Session */}
        {onCompleteClick && (
          <Button
            variant="default"
            size="lg"
            onClick={onCompleteClick}
            disabled={isCompleting}
            className="cursor-pointer gap-2 text-sm font-semibold h-12 shadow-xs"
          >
            <Square className="size-4" />
            <span>{isCompleting ? "Finalisation..." : "Terminer l'entretien"}</span>
          </Button>
        )}

        {/* Leave Session */}
        <Button
          variant="ghost"
          size="lg"
          onClick={onLeaveClick}
          className="cursor-pointer gap-2 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-12"
        >
          <LogOut className="size-4" />
          <span>Quitter</span>
        </Button>
      </div>
    </div>
  )
}
