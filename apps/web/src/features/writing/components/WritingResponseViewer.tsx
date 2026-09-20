/**
 * WritingResponseViewer Component.
 * Immutable, read-only viewer for candidate's submitted writing response.
 * Preserves paragraphs, formatting, allows text selection and copying.
 */

import React, { useState } from "react"
import { FileText, Copy, Check, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface WritingResponseViewerProps {
  content: string
  wordCount: number
  taskPrompt: string
  stimulusText?: string | null
}

export const WritingResponseViewer: React.FC<WritingResponseViewerProps> = ({
  content,
  wordCount,
  taskPrompt,
  stimulusText,
}) => {
  const [copied, setCopied] = useState<boolean>(false)
  const [showPrompt, setShowPrompt] = useState<boolean>(false)

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  return (
    <section
      aria-label="Votre copie soumise"
      className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden flex flex-col"
    >
      {/* Viewer Header */}
      <div className="p-4 sm:p-5 border-b border-border/60 bg-muted/20 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-primary shrink-0" />
          <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground">
            Votre copie soumise
          </h3>
          <span className="text-xs font-mono text-muted-foreground">
            ({wordCount} mots · {content.length} caractères)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Prompt Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPrompt(!showPrompt)}
            className="h-8 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <span>{showPrompt ? "Masquer le sujet" : "Revoir le sujet"}</span>
            {showPrompt ? <ChevronUp className="size-3.5 ml-1" /> : <ChevronDown className="size-3.5 ml-1" />}
          </Button>

          {/* Copy Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-8 text-xs gap-1.5 cursor-pointer rounded-xl"
          >
            {copied ? (
              <>
                <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                <span>Copié</span>
              </>
            ) : (
              <>
                <Copy className="size-3" />
                <span>Copier</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Optional Subject & Stimulus Accordion */}
      {showPrompt && (
        <div className="p-4 sm:p-5 border-b border-border/60 bg-muted/30 space-y-3 text-xs">
          {stimulusText && (
            <div className="space-y-1">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px] block">
                Document support :
              </span>
              <p className="font-serif italic text-foreground/90 p-3 rounded-xl bg-card border border-border/60 leading-relaxed">
                {stimulusText}
              </p>
            </div>
          )}
          <div className="space-y-1">
            <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px] block">
              Sujet de l'épreuve :
            </span>
            <p className="font-serif text-foreground p-3 rounded-xl bg-card border border-border/60 leading-relaxed whitespace-pre-wrap">
              {taskPrompt}
            </p>
          </div>
        </div>
      )}

      {/* Main Student Copy Canvas */}
      <div className="p-5 sm:p-7 flex-1">
        <div className="p-5 sm:p-6 rounded-xl bg-muted/10 border border-border/60 font-sans text-sm sm:text-base leading-relaxed text-foreground select-text whitespace-pre-wrap">
          {content}
        </div>
      </div>
    </section>
  )
}
