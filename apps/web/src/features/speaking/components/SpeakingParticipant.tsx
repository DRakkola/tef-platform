import type { RefObject } from "react"
import { UserCheck, Mic, Sparkles, Volume2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { AISpeakingState, SpeakingParticipant as SpeakingParticipantType } from "../types"
import { ParticlesOrb } from "@/registry/orbe/particles-orb/particles-orb"
import { OrbStatus } from "@/registry/lib/orb-status"
import type { OrbState } from "@/registry/lib/orb-state"

export interface SpeakingParticipantProps {
  sessionType: "ai" | "teacher"
  participant?: SpeakingParticipantType | null
  aiState?: AISpeakingState
  activeTurn?: "ai" | "student"
  isRemoteSpeaking?: boolean
  levelRef?: RefObject<number | null | undefined>
  className?: string
}

export function SpeakingParticipant({
  sessionType,
  participant,
  aiState = "listening",
  activeTurn = "ai",
  isRemoteSpeaking = false,
  levelRef,
  className,
}: SpeakingParticipantProps) {
  if (sessionType === "teacher") {
    const teacherName = participant?.display_name || "Professeur TEF"
    const initials = teacherName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()

    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center p-6 rounded-2xl border border-border bg-card/60 backdrop-blur-xs text-center space-y-3 w-full max-w-sm mx-auto shadow-xs",
          className
        )}
      >
        <div className="relative">
          <div className="size-20 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl border border-primary/20">
            {initials || <UserCheck className="size-9" />}
          </div>
          {isRemoteSpeaking && (
            <span className="absolute -bottom-1 -right-1 flex size-6 rounded-full bg-emerald-500 text-white items-center justify-center shadow-xs">
              <Volume2 className="size-3.5" />
            </span>
          )}
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">{teacherName}</h3>
          <p className="text-xs text-muted-foreground">Examinateur certifié TEF</p>
        </div>

        <Badge
          variant="outline"
          className={cn(
            "text-xs font-medium gap-1.5",
            participant?.is_connected !== false
              ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
              : "text-muted-foreground border-border bg-muted/60"
          )}
        >
          <span
            className={cn(
              "size-2 rounded-full",
              participant?.is_connected !== false
                ? "bg-emerald-500"
                : "bg-muted-foreground"
            )}
          />
          <span>{participant?.is_connected !== false ? "En ligne" : "En attente"}</span>
        </Badge>
      </div>
    )
  }

  // AI Session Participant
  const getAIStateBadge = () => {
    switch (aiState) {
      case "speaking":
        return {
          label: "L'examinateur parle...",
          className: "text-primary border-primary/30 bg-primary/10 animate-pulse",
          icon: <Volume2 className="size-3.5 text-primary" />,
        }
      case "thinking":
        return {
          label: "Analyse en cours...",
          className: "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10",
          icon: <Sparkles className="size-3.5 animate-spin" />,
        }
      case "connecting":
        return {
          label: "Connexion...",
          className: "text-muted-foreground border-border bg-muted/60",
          icon: <span className="size-2 rounded-full bg-muted-foreground" />,
        }
      case "listening":
      default:
        return {
          label: activeTurn === "student" ? "À votre écoute..." : "En attente",
          className: "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
          icon: <Mic className="size-3.5 text-emerald-500" />,
        }
    }
  }

  const getOrbState = (): OrbState => {
    switch (aiState) {
      case "speaking":
        return "speaking"
      case "thinking":
        return "thinking"
      case "connecting":
        return "connecting"
      case "listening":
        return "listening"
      default:
        return "idle"
    }
  }

  const orbState = getOrbState()
  const badge = getAIStateBadge()

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-6 rounded-2xl border border-border bg-card/60 backdrop-blur-xs text-center space-y-3 w-full max-w-sm mx-auto shadow-xs",
        className
      )}
    >
      <div className="relative flex items-center justify-center py-1">
        <ParticlesOrb
          state={orbState}
          size={128}
          speed={aiState === "speaking" ? 1.0 : aiState === "thinking" ? 0.7 : 0.5}
          colorFrom="#f0abfc"
          colorTo="#818cf8"
          levelRef={levelRef}
          label="Examinateur Virtuel TEF"
        />
        <OrbStatus state={orbState} className="sr-only" />
      </div>

      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">Examinateur Virtuel TEF</h3>
        <p className="text-xs text-muted-foreground">Simulateur d'entretien officiel</p>
      </div>

      <Badge
        variant="outline"
        className={cn("text-xs font-medium gap-1.5 px-3 py-1", badge.className)}
      >
        {badge.icon}
        <span>{badge.label}</span>
      </Badge>
    </div>
  )
}
