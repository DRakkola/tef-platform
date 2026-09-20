import { Mic, MicOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface MicrophoneControlProps {
  isMuted: boolean
  onToggleMute: () => void
  compact?: boolean
  className?: string
}

export function MicrophoneControl({
  isMuted,
  onToggleMute,
  compact = false,
  className,
}: MicrophoneControlProps) {
  return (
    <Button
      variant={isMuted ? "destructive" : "outline"}
      size="sm"
      onClick={onToggleMute}
      aria-label={isMuted ? "Activer le microphone (Microphone coupé)" : "Couper le microphone (Microphone actif)"}
      className={cn(
        "cursor-pointer gap-1.5 text-xs transition-colors",
        !isMuted && "border-border/80 hover:bg-muted/60",
        className
      )}
    >
      {isMuted ? (
        <MicOff className="size-3.5 shrink-0" />
      ) : (
        <Mic className="size-3.5 text-primary shrink-0" />
      )}
      {!compact && (
        <span>{isMuted ? "Microphone coupé" : "Microphone actif"}</span>
      )}
      {compact && (
        <span className="hidden md:inline">
          {isMuted ? "Coupé" : "Micro actif"}
        </span>
      )}
    </Button>
  )
}
