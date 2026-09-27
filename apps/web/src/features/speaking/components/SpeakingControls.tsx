import { Mic, MicOff, ChevronRight, LogOut, Square, Radio } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AudioLevelIndicator } from "./AudioLevelIndicator"
import type { AudioInputMode } from "../types"

export interface SpeakingControlsProps {
  isMuted: boolean
  micLevel: number
  onToggleMute: () => void
  onLeaveClick: () => void
  onCompleteClick?: () => void
  onNextPrompt?: () => void
  hasNextPrompt?: boolean
  isCompleting?: boolean
  audioInputMode?: AudioInputMode
  onAudioInputModeChange?: (mode: AudioInputMode) => void
  isPttActive?: boolean
  onTogglePtt?: () => void
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
  audioInputMode = "hands_free",
  onAudioInputModeChange,
  isPttActive = false,
  onTogglePtt,
  className,
}: SpeakingControlsProps) {
  const isPttMode = audioInputMode === "push_to_talk"

  return (
    <div className={`w-full max-w-xl mx-auto space-y-4 ${className || ""}`}>
      {/* Mode Selector Toggle */}
      {onAudioInputModeChange && (
        <div className="flex items-center justify-center gap-2 p-1 bg-muted/60 rounded-xl border border-border/60 max-w-md mx-auto">
          <button
            type="button"
            onClick={() => onAudioInputModeChange("hands_free")}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              !isPttMode
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Mains libres (Auto)
          </button>
          <button
            type="button"
            onClick={() => onAudioInputModeChange("push_to_talk")}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              isPttMode
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Radio className="size-3.5" />
            <span>Push-to-Talk [T]</span>
          </button>
        </div>
      )}

      {/* Push-to-Talk Primary Action Button */}
      {isPttMode && onTogglePtt && (
        <div className="flex flex-col items-center gap-2 py-1">
          <Button
            type="button"
            size="lg"
            onClick={onTogglePtt}
            className={`w-full max-w-md h-13 font-bold text-sm sm:text-base gap-2.5 rounded-xl cursor-pointer shadow-md transition-all ${
              isPttActive
                ? "bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse"
                : "bg-primary hover:bg-primary/90 text-primary-foreground hover:scale-[1.01]"
            }`}
          >
            <Mic className={`size-5 ${isPttActive ? "animate-bounce" : ""}`} />
            <span>
              {isPttActive
                ? "Vous parlez... (Appuyez sur T ou cliquez pour terminer)"
                : "Appuyez pour parler [T]"}
            </span>
          </Button>
          <span className="text-[11px] text-muted-foreground text-center">
            Touche clavier : <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono font-semibold">T</kbd> · Idéal si vous n'avez pas de casque.
          </span>
        </div>
      )}

      {/* Audio Level Confirmation Meter */}
      <AudioLevelIndicator
        level={isPttMode && !isPttActive ? 0 : micLevel}
        isMuted={isMuted || (isPttMode && !isPttActive)}
      />

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {/* Mute/Unmute (Only needed in hands-free mode) */}
        {!isPttMode && (
          <Button
            variant={isMuted ? "destructive" : "outline"}
            size="lg"
            onClick={onToggleMute}
            className="cursor-pointer gap-2 text-sm font-semibold min-w-[140px] h-12 shadow-xs"
          >
            {isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            <span>{isMuted ? "Micro coupé" : "Couper le micro"}</span>
          </Button>
        )}

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

