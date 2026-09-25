/**
 * AddErrorForm: Side-panel form for adding a structured correction item (error annotation).
 *
 * Fields match CorrectionItemCreate schema:
 *   original_text, corrected_text, category, explanation
 *
 * skill_id is omitted in MVP (requires skill list endpoint not yet confirmed available).
 */

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, X } from "lucide-react"
import type { CorrectionItemCreate } from "../types"
import { CORRECTION_CATEGORY_OPTIONS } from "../types"

interface Props {
  onAdd: (item: CorrectionItemCreate) => void
  onCancel?: () => void
}

const EMPTY: CorrectionItemCreate = {
  original_text: "",
  corrected_text: "",
  category: "",
  explanation: "",
  skill_id: null,
}

export const AddErrorForm: React.FC<Props> = ({ onAdd, onCancel }) => {
  const [form, setForm] = useState<CorrectionItemCreate>(EMPTY)
  const [touched, setTouched] = useState(false)

  const isValid =
    form.original_text.trim().length > 0 &&
    form.corrected_text.trim().length > 0 &&
    form.category.length > 0 &&
    form.explanation.trim().length > 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!isValid) return
    onAdd({
      original_text: form.original_text.trim(),
      corrected_text: form.corrected_text.trim(),
      category: form.category,
      explanation: form.explanation.trim(),
      skill_id: null,
    })
    setForm(EMPTY)
    setTouched(false)
  }

  const fieldError = (val: string) =>
    touched && !val.trim() ? "Ce champ est requis." : undefined

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Ajouter une erreur
      </p>

      <div className="grid grid-cols-2 gap-3">
        {/* Original text */}
        <div className="space-y-1">
          <Label htmlFor="err-original" className="text-xs">Texte original *</Label>
          <Input
            id="err-original"
            value={form.original_text}
            onChange={(e) => setForm((f) => ({ ...f, original_text: e.target.value }))}
            placeholder="Phrase ou mot erroné"
            className="h-8 text-sm"
            aria-invalid={!!fieldError(form.original_text)}
          />
          {fieldError(form.original_text) && (
            <p className="text-xs text-destructive">{fieldError(form.original_text)}</p>
          )}
        </div>

        {/* Corrected text */}
        <div className="space-y-1">
          <Label htmlFor="err-corrected" className="text-xs">Correction *</Label>
          <Input
            id="err-corrected"
            value={form.corrected_text}
            onChange={(e) => setForm((f) => ({ ...f, corrected_text: e.target.value }))}
            placeholder="Version corrigée"
            className="h-8 text-sm"
            aria-invalid={!!fieldError(form.corrected_text)}
          />
          {fieldError(form.corrected_text) && (
            <p className="text-xs text-destructive">{fieldError(form.corrected_text)}</p>
          )}
        </div>
      </div>

      {/* Category */}
      <div className="space-y-1">
        <Label htmlFor="err-category" className="text-xs">Catégorie *</Label>
        <Select
          value={form.category}
          onValueChange={(val) => setForm((f) => ({ ...f, category: val }))}
        >
          <SelectTrigger id="err-category" className="h-8 text-sm">
            <SelectValue placeholder="Choisir une catégorie" />
          </SelectTrigger>
          <SelectContent>
            {CORRECTION_CATEGORY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {touched && !form.category && (
          <p className="text-xs text-destructive">Ce champ est requis.</p>
        )}
      </div>

      {/* Explanation */}
      <div className="space-y-1">
        <Label htmlFor="err-explanation" className="text-xs">Explication *</Label>
        <Textarea
          id="err-explanation"
          value={form.explanation}
          onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))}
          placeholder="Pourquoi c'est une erreur et comment l'éviter…"
          rows={2}
          className="text-sm resize-none"
          aria-invalid={!!fieldError(form.explanation)}
        />
        {fieldError(form.explanation) && (
          <p className="text-xs text-destructive">{fieldError(form.explanation)}</p>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Ajouter l'erreur
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="gap-1">
            <X className="h-3.5 w-3.5" />
            Annuler
          </Button>
        )}
      </div>
    </form>
  )
}
