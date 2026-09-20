import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { HelpCircle } from "lucide-react"

export interface SpeakingPromptProps {
  topic: string
  level?: string
  currentQuestion?: number
  totalQuestions?: number
  objective?: string
  context?: string
  className?: string
}

export function SpeakingPrompt({
  topic,
  level = "B2",
  currentQuestion = 1,
  totalQuestions = 1,
  objective,
  context,
  className,
}: SpeakingPromptProps) {
  return (
    <Card className={`w-full border-border/80 shadow-xs bg-card/80 backdrop-blur-xs ${className || ""}`}>
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              {totalQuestions > 1
                ? `Question ${currentQuestion} sur ${totalQuestions}`
                : "Épreuve d'Expression Orale"}
            </span>
            <Badge variant="outline" className="text-[11px] font-mono border-primary/20 text-primary">
              Niveau {level}
            </Badge>
          </div>

          {context && (
            <span className="text-xs text-muted-foreground italic truncate max-w-xs">
              {context}
            </span>
          )}
        </div>

        <h2 className="text-base sm:text-lg font-bold text-foreground leading-snug pt-1">
          {topic}
        </h2>
      </CardHeader>

      <CardContent className="pt-4 space-y-3">
        {objective ? (
          <div className="p-4 rounded-xl bg-muted/30 border border-border/60 text-sm leading-relaxed text-foreground/90">
            <p className="font-medium text-foreground text-xs uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <HelpCircle className="size-3.5 text-primary" />
              <span>Consigne pour le candidat</span>
            </p>
            <p>{objective}</p>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-muted/30 border border-border/60 text-sm leading-relaxed text-foreground/90">
            <p>
              Prenez la parole pour répondre aux questions de votre interlocuteur.
              Exprimez vos idées avec clarté, adaptez votre registre de langue et justifiez vos arguments.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
