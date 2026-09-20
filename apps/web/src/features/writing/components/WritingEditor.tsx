/**
 * WritingEditor Component.
 * The primary writing canvas providing French-friendly typography,
 * live word counting, autosave status, and anti-copy/paste UX friction.
 */

import React, { useState } from "react"
import { PenTool, AlertCircle, ShieldAlert, CheckCircle2, RotateCw, WifiOff } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { WritingWordCount } from "./WritingWordCount"
import { cn } from "@/lib/utils"
import type { SaveStatus } from "../types"

export interface WritingEditorProps {
  content: string
  onChange: (text: string) => void
  wordCount: number
  minWords: number
  maxWords: number
  saveStatus: SaveStatus
  isReadOnly?: boolean
  enableAntiCopy?: boolean
  placeholder?: string
  className?: string
}

export const WritingEditor: React.FC<WritingEditorProps> = ({
  content,
  onChange,
  wordCount,
  minWords,
  maxWords,
  saveStatus,
  isReadOnly = false,
  enableAntiCopy = true,
  placeholder = "Rédigez votre réponse ici. Soignez la structure, les formules d'appel et de politesse, et l'enchaînement de vos paragraphes...",
  className,
}) => {
  const [pasteNotice, setPasteNotice] = useState<string | null>(null)

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (enableAntiCopy && !isReadOnly) {
      e.preventDefault()
      setPasteNotice(
        "Le copier-coller est désactivé pendant cette simulation d'épreuve pour refléter les conditions réelles d'examen."
      )
      setTimeout(() => setPasteNotice(null), 4000)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    if (enableAntiCopy && !isReadOnly) {
      e.preventDefault()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab" && !isReadOnly) {
      e.preventDefault()
      const target = e.currentTarget
      const start = target.selectionStart
      const end = target.selectionEnd
      const newText = content.substring(0, start) + "    " + content.substring(end)
      onChange(newText)
      // Set cursor position after indentation
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 4
      }, 0)
    }
  }

  const getSaveBadge = () => {
    if (saveStatus === "saving") {
      return (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
          <RotateCw className="size-3 animate-spin text-primary" />
          <span>Enregistrement...</span>
        </span>
      )
    }
    if (saveStatus === "offline") {
      return (
        <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
          <WifiOff className="size-3" />
          <span>Hors ligne (brouillon local)</span>
        </span>
      )
    }
    if (saveStatus === "error") {
      return (
        <span className="flex items-center gap-1.5 text-xs text-destructive font-medium">
          <AlertCircle className="size-3" />
          <span>Erreur de sauvegarde</span>
        </span>
      )
    }
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
        <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" />
        <span>Brouillon sauvegardé</span>
      </span>
    )
  }

  return (
    <section
      aria-label="Zone de rédaction de l'épreuve écrite"
      className={cn(
        "flex flex-col rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden",
        className
      )}
    >
      {/* Editor Subheader: Word count and save indicator */}
      <div className="p-3.5 sm:p-4 border-b border-border/60 bg-muted/20 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <PenTool className="size-4 text-primary shrink-0" />
          <span className="font-bold text-foreground uppercase tracking-wider text-[11px]">
            Espace de rédaction
          </span>
        </div>

        <div className="flex items-center gap-4">
          {getSaveBadge()}
          <WritingWordCount wordCount={wordCount} minWords={minWords} maxWords={maxWords} />
        </div>
      </div>

      {/* Anti-copy UX Friction Notice */}
      {pasteNotice && (
        <div
          role="alert"
          aria-live="polite"
          className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200 transition-all"
        >
          <ShieldAlert className="size-4 text-amber-600 shrink-0" />
          <span>{pasteNotice}</span>
        </div>
      )}

      {/* Read-Only Notice (if submitted or expired) */}
      {isReadOnly && (
        <div className="bg-muted/40 border-b border-border/60 px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground font-medium">
          <AlertCircle className="size-4 text-primary shrink-0" />
          <span>Cette copie est verrouillée en lecture seule (épreuve terminée ou soumise).</span>
        </div>
      )}

      {/* Main Textarea */}
      <div className="flex-1 p-4 sm:p-6 flex flex-col min-h-[460px]">
        <label htmlFor="exam-writing-textarea" className="sr-only">
          Rédigez votre réponse écrite
        </label>
        <Textarea
          id="exam-writing-textarea"
          value={content}
          onChange={(e) => onChange(e.target.value)}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onKeyDown={handleKeyDown}
          readOnly={isReadOnly}
          disabled={isReadOnly}
          placeholder={placeholder}
          className={cn(
            "flex-1 w-full p-4 rounded-xl border-0 focus-visible:ring-0 resize-none font-sans text-base leading-relaxed bg-transparent text-foreground placeholder:text-muted-foreground/60 transition-colors",
            isReadOnly && "opacity-90 cursor-not-allowed bg-muted/10"
          )}
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      {/* Editor Footer */}
      <div className="p-3 border-t border-border/60 bg-muted/20 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground font-mono">
        <span>Touche Tabulation : indentation de 4 espaces</span>
        <span>{content.length} caractères</span>
      </div>
    </section>
  )
}
