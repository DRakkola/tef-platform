import React from "react"
import { cn } from "@/lib/utils"

export interface ListeningPlaybackProgressProps {
  currentTime: number
  duration: number
  allowSeek?: boolean
  onSeek?: (newTime: number) => void
  className?: string
}

export function formatAudioTime(seconds: number): string {
  if (isNaN(seconds) || seconds <= 0) return "00:00"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}

export const ListeningPlaybackProgress: React.FC<ListeningPlaybackProgressProps> = ({
  currentTime,
  duration,
  allowSeek = false,
  onSeek,
  className,
}) => {
  const percent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0

  return (
    <div className={cn("space-y-2 w-full", className)}>
      {/* Progress Bar (Interactive if allowSeek, otherwise visual display only) */}
      <div className="relative w-full h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          role={allowSeek ? undefined : "progressbar"}
          aria-valuenow={allowSeek ? undefined : Math.round(percent)}
          aria-valuemin={allowSeek ? undefined : 0}
          aria-valuemax={allowSeek ? undefined : 100}
          aria-label={allowSeek ? undefined : `Progression de l'audio : ${Math.round(percent)}%`}
          className="h-full bg-primary transition-all duration-100 ease-linear rounded-full"
          style={{ width: `${percent}%` }}
        />

        {allowSeek && onSeek && (
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={(e) => onSeek(Number(e.target.value))}
            aria-label="Déplacer la tête de lecture audio"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        )}
      </div>

      {/* Audio Timestamps: Elapsed / Total (explicitly distinct from exam timer) */}
      <div className="flex items-center justify-between text-xs font-mono text-muted-foreground font-medium">
        <span>{formatAudioTime(currentTime)}</span>
        <span>{formatAudioTime(duration)}</span>
      </div>
    </div>
  )
}
