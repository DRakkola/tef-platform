import React from "react"
import { Headphones, Layers, AlertCircle, Info } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface ListeningQuestionContextProps {
  sectionTitle?: string
  instructions?: string | null
  questionNumber?: number
  totalQuestions?: number
  sharedQuestionRange?: string | null
  replayAllowed?: boolean
  maxPlays?: number
  playsRemaining?: number
  className?: string
}

export const ListeningQuestionContext: React.FC<ListeningQuestionContextProps> = ({
  sectionTitle,
  instructions,
  questionNumber,
  totalQuestions,
  sharedQuestionRange,
  replayAllowed = false,
  maxPlays = 1,
  playsRemaining,
  className,
}) => {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge
            variant="default"
            size="sm"
            className="gap-1.5 text-xs font-semibold px-2.5 py-1"
          >
            <Headphones className="size-3.5" />
            <span>Compréhension orale</span>
          </Badge>

          {questionNumber && totalQuestions && (
            <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
              Question {questionNumber} sur {totalQuestions}
            </span>
          )}

          {sharedQuestionRange && (
            <Badge variant="outline" size="sm" className="gap-1 text-xs text-primary border-primary/30">
              <Layers className="size-3" />
              <span>{sharedQuestionRange}</span>
            </Badge>
          )}
        </div>

        {/* Replay rule badge */}
        <div>
          {!replayAllowed ? (
            <Badge variant="warning" size="sm" className="gap-1 text-[11px] font-medium">
              <AlertCircle className="size-3" />
              <span>1 seule écoute (règle officielle)</span>
            </Badge>
          ) : (
            <Badge variant="outline" size="sm" className="gap-1 text-[11px] text-muted-foreground">
              <Info className="size-3" />
              <span>
                {typeof playsRemaining === "number"
                  ? `${playsRemaining} écoute${playsRemaining > 1 ? "s" : ""} restante${playsRemaining > 1 ? "s" : ""}`
                  : maxPlays > 1
                  ? `${maxPlays} écoutes autorisées`
                  : "Réécoute autorisée"}
              </span>
            </Badge>
          )}
        </div>
      </div>

      {sectionTitle && (
        <h2 className="text-sm sm:text-base font-bold text-foreground tracking-tight">
          {sectionTitle}
        </h2>
      )}

      {instructions && (
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          {instructions}
        </p>
      )}
    </div>
  )
}
