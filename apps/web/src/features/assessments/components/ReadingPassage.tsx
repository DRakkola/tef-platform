import React from "react"
import { BookOpen } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ListeningPlayer } from "@/components/common/ListeningPlayer"
import { cn } from "@/lib/utils"

export interface ReadingPassageProps {
  passageText?: string | null
  sectionTitle?: string
  mediaUrl?: string | null
  instructions?: string | null
  className?: string
}

export const ReadingPassage: React.FC<ReadingPassageProps> = ({
  passageText,
  sectionTitle,
  mediaUrl,
  instructions,
  className,
}) => {
  if (!passageText && !mediaUrl) return null

  // Split text by paragraphs for optimal reading rhythm
  const paragraphs = passageText ? passageText.split(/\n\s*\n/) : []

  return (
    <div className={cn("space-y-4", className)}>
      {/* Audio player if audio media is provided */}
      {mediaUrl && (
        <ListeningPlayer
          mediaUrl={mediaUrl}
          title={`Document sonore${sectionTitle ? ` · ${sectionTitle}` : ""}`}
        />
      )}

      {/* Reading Document Card */}
      {passageText && (
        <Card className="border-border/80 bg-card shadow-xs overflow-hidden">
          <CardHeader className="py-3 px-5 border-b border-border/60 bg-muted/20">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                <BookOpen className="size-3.5" />
                <span>Document de lecture associé</span>
              </div>
              {sectionTitle && (
                <span className="text-xs text-muted-foreground font-medium truncate">
                  {sectionTitle}
                </span>
              )}
            </div>
            {instructions && (
              <p className="text-xs text-muted-foreground italic mt-1">{instructions}</p>
            )}
          </CardHeader>

          <CardContent className="p-5 sm:p-6">
            <article
              aria-label="Texte du document"
              className="max-w-prose text-sm sm:text-base text-foreground/90 leading-relaxed font-serif space-y-4 select-text"
            >
              {paragraphs.map((p, pIdx) => (
                <p key={pIdx} className="leading-relaxed whitespace-pre-line">
                  {p.trim()}
                </p>
              ))}
            </article>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
