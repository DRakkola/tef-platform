/**
 * StudentResponsePanel: Left panel in the correction workspace.
 *
 * Shows:
 * 1. Collapsible task context (prompt, word limits, target level)
 * 2. Student essay text — large, readable, immutable, line-break preserving
 */

import React, { useState } from "react"
import { ChevronDown, ChevronRight, BookOpen, FileText } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { WritingSubmissionDetail } from "../types"
import { TASK_TYPE_LABELS } from "../types"

interface Props {
  submission: WritingSubmissionDetail
}

export const StudentResponsePanel: React.FC<Props> = ({ submission }) => {
  const [isContextOpen, setIsContextOpen] = useState(true)
  const { task, content, word_count } = submission

  const taskTypeLabel = task?.task_type
    ? TASK_TYPE_LABELS[task.task_type] ?? task.task_type
    : ""

  return (
    <div className="flex flex-col gap-4">
      {/* ------------------------------------------------------------------ */}
      {/* Task context (collapsible)                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-lg border border-border/60 bg-muted/30 overflow-hidden">
        <button
          type="button"
          onClick={() => setIsContextOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={isContextOpen}
        >
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium">Contexte de la tâche</span>
            {taskTypeLabel && (
              <Badge variant="secondary" className="text-xs hidden sm:flex">
                {taskTypeLabel}
              </Badge>
            )}
          </div>
          {isContextOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {isContextOpen && (
          <div className="border-t border-border/50 px-4 py-4 space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Consigne
              </p>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                {task.prompt}
              </p>
            </div>

            {task.stimulus_text && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Texte de départ
                  </p>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-line italic border-l-2 border-border pl-3">
                    {task.stimulus_text}
                  </p>
                </div>
              </>
            )}

            <Separator />

            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>
                <span className="font-medium text-foreground">{task.min_words}–{task.max_words}</span>{" "}
                mots attendus
              </span>
              <span>
                Niveau cible :{" "}
                <span className="font-medium text-foreground">{task.target_level}</span>
              </span>
              <span>
                Durée :{" "}
                <span className="font-medium text-foreground">{task.duration_minutes} min</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Student response (read-only, large, comfortable typography)         */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Réponse de l'élève</span>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {word_count} mot{word_count !== 1 ? "s" : ""}
          </span>
        </div>

        <div
          aria-label="Texte soumis par l'élève — lecture seule"
          aria-readonly="true"
          role="textbox"
          className="px-5 py-5 min-h-[300px] text-[15px] leading-8 text-foreground font-serif whitespace-pre-wrap break-words select-text"
          style={{ userSelect: "text" }}
        >
          {content || (
            <span className="text-muted-foreground italic text-sm">
              Aucun texte soumis.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
