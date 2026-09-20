/**
 * ExerciseQuestion Component.
 * The central learning canvas displaying prompt, instructions, optional reading passage,
 * optional listening audio player, and answer interaction controls.
 */

import React from "react"
import { BookOpen, Headphones, AlertTriangle } from "lucide-react"
import { ListeningPlayer } from "@/components/common/ListeningPlayer"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export interface ExerciseQuestionProps {
  prompt: string
  instructions?: string | null
  category?: string
  passageText?: string | null
  mediaUrl?: string | null
  allowReplay?: boolean
  maxReplays?: number
  isUnsupportedType?: boolean
  children?: React.ReactNode
  className?: string
}

export const ExerciseQuestion: React.FC<ExerciseQuestionProps> = ({
  prompt,
  instructions,
  category,
  passageText,
  mediaUrl,
  allowReplay = true,
  maxReplays = 3,
  isUnsupportedType = false,
  children,
  className,
}) => {
  const isListening = (category || "").toLowerCase().includes("orale") || (category || "").toLowerCase().includes("listening") || Boolean(mediaUrl)
  const isReading = (category || "").toLowerCase().includes("écrit") || (category || "").toLowerCase().includes("reading") || Boolean(passageText)

  if (isUnsupportedType) {
    return (
      <Card className={cn("border-border/80 bg-card shadow-xs", className)}>
        <CardContent className="p-6 sm:p-8 text-center space-y-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-warning/15 text-warning mx-auto">
            <AlertTriangle className="size-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground">Type d'exercice non pris en charge</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              Ce format d'exercice nécessite une interface spécialisée actuellement en cours d'intégration.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("border-border/80 bg-card shadow-xs overflow-hidden", className)}>
      <CardContent className="p-5 sm:p-7 space-y-6">
        {/* 1. Optional Listening Media Player */}
        {isListening && mediaUrl && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <Headphones className="size-3.5" />
              <span>Document sonore d'entraînement</span>
            </div>
            <ListeningPlayer
              mediaUrl={mediaUrl}
              title="Extrait audio de pratique"
              replayAllowed={allowReplay}
              maxPlays={maxReplays}
            />
          </div>
        )}

        {/* 2. Optional Reading Passage Container */}
        {isReading && passageText && (
          <div className="rounded-xl border border-border/70 bg-muted/30 p-4 sm:p-5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <BookOpen className="size-3.5 text-primary" />
              <span>Texte support</span>
            </div>
            <div className="text-sm leading-relaxed text-foreground font-serif whitespace-pre-line">
              {passageText}
            </div>
          </div>
        )}

        {/* 3. Instructions (if provided) */}
        {instructions && (
          <p className="text-xs text-muted-foreground leading-relaxed italic border-l-2 border-primary/40 pl-3">
            {instructions}
          </p>
        )}

        {/* 4. Main Question Prompt (Strong Typography) */}
        <div className="space-y-2">
          <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight leading-snug">
            {prompt}
          </h2>
        </div>

        {/* 5. Answer Interaction Slot */}
        {children && <div className="pt-2">{children}</div>}
      </CardContent>
    </Card>
  )
}
