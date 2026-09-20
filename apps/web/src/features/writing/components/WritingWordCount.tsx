/**
 * WritingWordCount Component.
 * Live, normalized word count indicator displaying target range and compliance status.
 */

import React from "react"
import { getWordCountCategory, getWordCountStatusMessage } from "../utils/wordCounter"
import { cn } from "@/lib/utils"

export interface WritingWordCountProps {
  wordCount: number
  minWords: number
  maxWords: number
  className?: string
}

export const WritingWordCount: React.FC<WritingWordCountProps> = ({
  wordCount,
  minWords,
  maxWords,
  className,
}) => {
  const category = getWordCountCategory(wordCount, minWords, maxWords)
  const statusMessage = getWordCountStatusMessage(wordCount, minWords, maxWords)

  let badgeStyle = "text-muted-foreground bg-muted border-border/80"
  if (category === "in_range") {
    badgeStyle = "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30"
  } else if (category === "below_min") {
    badgeStyle = "text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30"
  } else if (category === "above_max") {
    badgeStyle = "text-destructive bg-destructive/10 border-destructive/30"
  }

  return (
    <div
      role="status"
      aria-label={`Compteur : ${wordCount} mots. ${statusMessage}`}
      className={cn("flex items-center gap-2 text-xs", className)}
    >
      <span className="text-muted-foreground">Compteur :</span>
      <span
        title={statusMessage}
        className={cn(
          "font-mono font-bold px-2 py-0.5 rounded-md border text-xs transition-colors",
          badgeStyle
        )}
      >
        {wordCount} / {minWords}-{maxWords} mots
      </span>
    </div>
  )
}
