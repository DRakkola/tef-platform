import { Mic, Volume2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SpeakingTurnIndicatorProps {
  sessionType: "ai" | "teacher"
  activeTurn: "ai" | "student"
  isMicMuted: boolean
  className?: string
}

export function SpeakingTurnIndicator({
  sessionType,
  activeTurn,
  isMicMuted,
  className,
}: SpeakingTurnIndicatorProps) {
  // Natural conversation for teacher mode: no artificial turn banner
  if (sessionType === "teacher") {
    return null
  }

  const isStudentTurn = activeTurn === "student"

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-full border text-xs sm:text-sm font-semibold transition-all duration-300 max-w-sm mx-auto shadow-xs",
        isStudentTurn
          ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20"
          : "bg-primary/10 border-primary/25 text-primary",
        className
      )}
    >
      {isStudentTurn ? (
        <>
          <span className="flex size-2 rounded-full bg-emerald-500 animate-ping" />
          <Mic className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            {isMicMuted
              ? "À vous de parler (Votre micro est coupé)"
              : "À vous de parler · Votre micro est actif"}
          </span>
        </>
      ) : (
        <>
          <Volume2 className="size-4 text-primary animate-pulse shrink-0" />
          <span>L'examinateur parle... Écoutez attentivement</span>
        </>
      )}
    </div>
  )
}
