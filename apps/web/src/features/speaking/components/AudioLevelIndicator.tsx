import { Volume2, VolumeX } from "lucide-react"
import { cn } from "@/lib/utils"

export interface AudioLevelIndicatorProps {
  level: number // 0 to 100
  isMuted?: boolean
  showCheckText?: boolean
  className?: string
}

export function AudioLevelIndicator({
  level,
  isMuted = false,
  showCheckText = false,
  className,
}: AudioLevelIndicatorProps) {
  const isHearing = !isMuted && level > 5

  return (
    <div
      role="status"
      aria-label={
        isMuted
          ? "Microphone coupé"
          : isHearing
            ? "Signal audio détecté"
            : "Aucun son détecté"
      }
      className={cn("flex flex-col items-center gap-2", className)}
    >
      <div className="flex items-center gap-2">
        {isMuted ? (
          <VolumeX className="size-4 text-muted-foreground" />
        ) : (
          <Volume2
            className={cn(
              "size-4 transition-colors",
              isHearing ? "text-emerald-500" : "text-muted-foreground"
            )}
          />
        )}

        {/* Lightweight 5-bar volume meter */}
        <div className="flex items-center gap-1 h-3" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((bar) => {
            const threshold = bar * 20
            const active = !isMuted && level >= threshold
            return (
              <div
                key={bar}
                className={cn(
                  "w-1.5 rounded-full transition-all duration-75",
                  active
                    ? bar > 4
                      ? "bg-amber-500 h-3"
                      : "bg-emerald-500 h-2.5"
                    : "bg-muted-foreground/20 h-1.5"
                )}
              />
            )
          })}
        </div>
      </div>

      {showCheckText && (
        <span
          className={cn(
            "text-xs font-medium transition-colors",
            isMuted
              ? "text-muted-foreground"
              : isHearing
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground"
          )}
        >
          {isMuted
            ? "Microphone coupé"
            : isHearing
              ? "Nous entendons votre microphone."
              : "Parlez pour tester votre niveau audio..."}
        </span>
      )}
    </div>
  )
}
