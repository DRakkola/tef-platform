/**
 * WritingInstructionsPanel Component.
 * Left pane displaying official task prompt, reference stimulus text,
 * target word count constraints, and grading criteria.
 */

import React, { useState } from "react"
import { FileText, ChevronDown, ChevronUp, Target, CheckSquare } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { WritingTaskDetail } from "../types"

export interface WritingInstructionsPanelProps {
  task: WritingTaskDetail
  className?: string
}

export const WritingInstructionsPanel: React.FC<WritingInstructionsPanelProps> = ({
  task,
  className,
}) => {
  const [mobileExpanded, setMobileExpanded] = useState<boolean>(true)

  const sectionLabel =
    task.task_type === "section_a"
      ? "Section A (Fait divers / Récit)"
      : task.task_type === "section_b"
      ? "Section B (Lettre d'opinion formelle)"
      : "Épreuve d'écriture"

  return (
    <section
      aria-labelledby="writing-instructions-title"
      className={cn(
        "flex flex-col rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden",
        className
      )}
    >
      {/* Panel Header */}
      <div className="p-4 sm:p-5 border-b border-border/60 bg-muted/20 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="size-4 text-primary shrink-0" />
          <h2
            id="writing-instructions-title"
            className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wider truncate"
          >
            Consigne officielle TEF
          </h2>
          <Badge variant="outline" size="sm" className="hidden sm:inline-flex text-[11px]">
            {sectionLabel}
          </Badge>
        </div>

        {/* Mobile toggle button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMobileExpanded(!mobileExpanded)}
          className="lg:hidden h-7 px-2 text-xs text-muted-foreground"
          aria-expanded={mobileExpanded}
          aria-label={mobileExpanded ? "Réduire les consignes" : "Afficher les consignes"}
        >
          <span>{mobileExpanded ? "Réduire" : "Afficher"}</span>
          {mobileExpanded ? <ChevronUp className="size-3.5 ml-1" /> : <ChevronDown className="size-3.5 ml-1" />}
        </Button>
      </div>

      {/* Panel Content */}
      <div className={cn("p-5 sm:p-6 space-y-5 flex-1 overflow-y-auto", !mobileExpanded && "hidden lg:block")}>
        {/* Target Constraints Card */}
        <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Target className="size-4 text-primary shrink-0" />
            <span className="text-muted-foreground font-medium">
              Cible : {task.min_words} à {task.max_words} mots
            </span>
          </div>
          <span className="font-mono font-bold text-foreground">
            {task.duration_minutes || 60} min
          </span>
        </div>

        {/* Optional Reference Stimulus Text */}
        {task.stimulus_text && (
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Document support :
            </span>
            <div className="text-xs sm:text-sm leading-relaxed text-foreground/90 font-serif italic p-3.5 rounded-xl bg-muted/40 border border-border/60">
              {task.stimulus_text}
            </div>
          </div>
        )}

        {/* Main Prompt */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            Votre sujet :
          </span>
          <div className="text-sm sm:text-base leading-relaxed text-foreground font-serif p-4 rounded-xl bg-card border border-border/80 shadow-2xs whitespace-pre-wrap">
            {task.prompt}
          </div>
        </div>

        {/* Grading Criteria */}
        <div className="space-y-2 pt-2 border-t border-border/60 text-xs text-muted-foreground">
          <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <CheckSquare className="size-3.5 text-primary" />
            <span>Critères d'évaluation officiels :</span>
          </h4>
          <ul className="space-y-1.5 list-disc pl-4 leading-relaxed">
            <li>Respect de la longueur minimale et maximale exigée ({task.min_words}–{task.max_words} mots).</li>
            <li>Adéquation au sujet, clarté de la prise de position et pertinence des arguments.</li>
            <li>Organisation textuelle : cohérence, progression logique et variété des connecteurs.</li>
            <li>Correction morphosyntaxique, précision lexicale et maîtrise des registres formels.</li>
          </ul>
        </div>
      </div>
    </section>
  )
}
