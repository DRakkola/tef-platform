/**
 * WritingResultSummary Component.
 * Concise top summary panel displaying estimated CEFR level, practice score,
 * word count compliance, criterion breakdown, and simulation disclaimer.
 */

import React from "react"
import { Award, Target, FileText, Info, CheckCircle2, AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getWordCountCategory } from "../utils/wordCounter"

export interface WritingResultSummaryProps {
  estimatedLevel: string
  score: number
  wordCount: number
  minWords: number
  maxWords: number
  criteria?: {
    taskCompletion?: number | null
    coherence?: number | null
    vocabulary?: number | null
    grammar?: number | null
    syntax?: number | null
    spelling?: number | null
    register?: number | null
  }
  disclaimer?: string
}

export const WritingResultSummary: React.FC<WritingResultSummaryProps> = ({
  estimatedLevel,
  score,
  wordCount,
  minWords,
  maxWords,
  criteria,
  disclaimer = "Score d'entraînement indicatif — Non officiel TEF.",
}) => {
  const wordCategory = getWordCountCategory(wordCount, minWords, maxWords)

  const getWordCountBadge = () => {
    if (wordCategory === "in_range") {
      return (
        <Badge variant="success" className="gap-1 text-xs font-mono">
          <CheckCircle2 className="size-3" />
          <span>Conforme ({minWords}–{maxWords})</span>
        </Badge>
      )
    }
    if (wordCategory === "below_min") {
      return (
        <Badge variant="warning" className="gap-1 text-xs font-mono">
          <AlertTriangle className="size-3" />
          <span>Inférieur au minimum ({minWords})</span>
        </Badge>
      )
    }
    return (
      <Badge variant="destructive" className="gap-1 text-xs font-mono">
        <AlertTriangle className="size-3" />
        <span>Dépassement ({maxWords})</span>
      </Badge>
    )
  }

  const getScoreInterpretation = (val: number) => {
    if (val >= 80) return "Excellente maîtrise des exigences"
    if (val >= 65) return "Niveau solide avec axes de progression"
    if (val >= 50) return "Compétence en cours d'acquisition"
    return "Nécessite un entraînement approfondi"
  }

  return (
    <section
      aria-label="Synthèse des résultats de l'écrit"
      className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs space-y-6"
    >
      {/* 1. Primary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Metric 1: Estimated CEFR Level */}
        <div className="p-4 rounded-xl border border-border/70 bg-muted/20 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Niveau estimé
            </span>
            <Award className="size-4 text-primary" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight font-mono">
              {estimatedLevel}
            </span>
            <span className="text-xs text-muted-foreground">sur l'échelle CECRL</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Évaluation indicative calculée sur cette épreuve.
          </p>
        </div>

        {/* Metric 2: Practice Score */}
        <div className="p-4 rounded-xl border border-border/70 bg-muted/20 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Score d'entraînement
            </span>
            <Target className="size-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight font-mono">
              {Math.round(score)}
              <span className="text-lg font-normal text-muted-foreground">/100</span>
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-tight">
            {getScoreInterpretation(score)}
          </p>
        </div>

        {/* Metric 3: Word Count Compliance */}
        <div className="p-4 rounded-xl border border-border/70 bg-muted/20 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Longueur rédigée
            </span>
            <FileText className="size-4 text-primary" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight font-mono">
              {wordCount}
            </span>
            <span className="text-xs text-muted-foreground">mots</span>
          </div>
          <div>{getWordCountBadge()}</div>
        </div>
      </div>

      {/* 2. Structured Criteria Breakdown (if provided) */}
      {criteria && (
        <div className="space-y-3 pt-2 border-t border-border/60">
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Détail des critères d'évaluation
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-xs">
            {criteria.taskCompletion !== undefined && criteria.taskCompletion !== null && (
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60 flex flex-col">
                <span className="text-muted-foreground text-[11px]">Adéquation</span>
                <span className="font-mono font-bold text-foreground text-sm mt-1">
                  {Math.round(criteria.taskCompletion)}%
                </span>
              </div>
            )}
            {criteria.coherence !== undefined && criteria.coherence !== null && (
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60 flex flex-col">
                <span className="text-muted-foreground text-[11px]">Cohérence</span>
                <span className="font-mono font-bold text-foreground text-sm mt-1">
                  {Math.round(criteria.coherence)}%
                </span>
              </div>
            )}
            {criteria.vocabulary !== undefined && criteria.vocabulary !== null && (
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60 flex flex-col">
                <span className="text-muted-foreground text-[11px]">Vocabulaire</span>
                <span className="font-mono font-bold text-foreground text-sm mt-1">
                  {Math.round(criteria.vocabulary)}%
                </span>
              </div>
            )}
            {criteria.grammar !== undefined && criteria.grammar !== null && (
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60 flex flex-col">
                <span className="text-muted-foreground text-[11px]">Grammaire</span>
                <span className="font-mono font-bold text-foreground text-sm mt-1">
                  {Math.round(criteria.grammar)}%
                </span>
              </div>
            )}
            {criteria.syntax !== undefined && criteria.syntax !== null && (
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60 flex flex-col">
                <span className="text-muted-foreground text-[11px]">Syntaxe</span>
                <span className="font-mono font-bold text-foreground text-sm mt-1">
                  {Math.round(criteria.syntax)}%
                </span>
              </div>
            )}
            {criteria.spelling !== undefined && criteria.spelling !== null && (
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60 flex flex-col">
                <span className="text-muted-foreground text-[11px]">Orthographe</span>
                <span className="font-mono font-bold text-foreground text-sm mt-1">
                  {Math.round(criteria.spelling)}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Official Simulation Disclaimer */}
      <div className="p-3 rounded-xl bg-muted/30 border border-border/60 flex items-start gap-2.5 text-xs text-muted-foreground">
        <Info className="size-4 text-primary shrink-0 mt-0.5" />
        <p className="leading-relaxed">{disclaimer}</p>
      </div>
    </section>
  )
}
