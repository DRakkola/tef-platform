/**
 * WritingAnnotatedCorrections Component.
 * Interactive sentence/phrase-level correction cards with category filtering,
 * before/after diffs, and pedagogical explanations ("Pourquoi ?").
 */

import React, { useState, useMemo } from "react"
import { CheckCircle2, AlertTriangle, ArrowRight, BookOpen } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { CorrectionItem } from "../types"

export interface WritingAnnotatedCorrectionsProps {
  items: CorrectionItem[]
  onSelectSkill?: (skillId: string) => void
}

const CATEGORY_LABELS: Record<string, string> = {
  grammar: "Grammaire",
  spelling: "Orthographe",
  vocabulary: "Vocabulaire",
  syntax: "Syntaxe",
  register: "Registre de langue",
  coherence: "Cohérence",
  connectors: "Connecteurs",
}

export const WritingAnnotatedCorrections: React.FC<WritingAnnotatedCorrectionsProps> = ({
  items,
  onSelectSkill,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("all")

  // Extract unique categories for filter tabs
  const categories = useMemo(() => {
    const set = new Set<string>()
    items.forEach((item) => {
      if (item.category) set.add(item.category.toLowerCase())
    })
    return Array.from(set)
  }, [items])

  const filteredItems = useMemo(() => {
    if (selectedCategory === "all") return items
    return items.filter((item) => item.category?.toLowerCase() === selectedCategory)
  }, [items, selectedCategory])

  const getCategoryLabel = (cat: string) => {
    const key = cat.toLowerCase()
    return CATEGORY_LABELS[key] || cat.charAt(0).toUpperCase() + cat.slice(1)
  }

  if (items.length === 0) {
    return (
      <div className="p-8 rounded-2xl border border-border/80 bg-card text-center space-y-3 shadow-xs">
        <div className="flex size-12 mx-auto items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
          <CheckCircle2 className="size-6" />
        </div>
        <h3 className="text-base font-bold text-foreground">
          Aucune faute ponctuelle relevée
        </h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
          Votre texte démontre une excellente maîtrise syntaxique et orthographique. Aucun point d'attention spécifique n'a été isolé.
        </p>
      </div>
    )
  }

  return (
    <section
      aria-label="Corrections détaillées et annotations"
      className="space-y-4"
    >
      {/* Category Filter Chips & Counter */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer border ${
              selectedCategory === "all"
                ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            Toutes ({items.length})
          </button>

          {categories.map((cat) => {
            const count = items.filter((i) => i.category?.toLowerCase() === cat).length
            const isSelected = selectedCategory === cat
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer border ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                    : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {getCategoryLabel(cat)} ({count})
              </button>
            )
          })}
        </div>

        <span className="text-xs font-mono text-muted-foreground">
          {filteredItems.length} point{filteredItems.length > 1 ? "s" : ""} affiché{filteredItems.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* List of Correction Cards */}
      <div className="space-y-3.5">
        {filteredItems.map((item, index) => (
          <div
            key={item.id || index}
            className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-4 transition-all hover:border-border"
          >
            {/* Header: Category Badge and Item Counter */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-medium">
                  {getCategoryLabel(item.category)}
                </Badge>
              </div>

              <span className="text-xs font-mono text-muted-foreground">
                Point #{index + 1}
              </span>
            </div>

            {/* Before / After Comparison Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm">
              {/* Original */}
              <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5" />
                  <span>Formulation d'origine :</span>
                </span>
                <p className="font-serif leading-relaxed text-foreground/90 line-through decoration-amber-600/60">
                  {item.original_text}
                </p>
              </div>

              {/* Corrected */}
              <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5" />
                  <span>Proposition d'amélioration :</span>
                </span>
                <p className="font-serif leading-relaxed text-foreground font-semibold">
                  {item.corrected_text}
                </p>
              </div>
            </div>

            {/* Pedagogical Explanation */}
            <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60 text-xs space-y-1">
              <span className="font-bold text-foreground uppercase tracking-wider text-[11px] flex items-center gap-1">
                <span>Règle & justification :</span>
              </span>
              <p className="text-muted-foreground leading-relaxed">
                {item.explanation}
              </p>
            </div>

            {/* Optional Skill Link */}
            {item.skill_id && onSelectSkill && (
              <div className="flex justify-end pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelectSkill(item.skill_id!)}
                  className="h-7 text-xs text-primary hover:text-primary gap-1 cursor-pointer"
                >
                  <BookOpen className="size-3" />
                  <span>S'entraîner sur cette règle</span>
                  <ArrowRight className="size-3" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
