/**
 * FeedbackForm: Strengths, weaknesses, overall comments, recommendations fields.
 */

import React from "react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { CorrectionFormState } from "../types"

const MAX_COMMENTS = 2000

interface Props {
  form: CorrectionFormState
  readonly?: boolean
  validationErrors?: string[]
  onChange: <K extends keyof CorrectionFormState>(key: K, value: CorrectionFormState[K]) => void
}

export const FeedbackForm: React.FC<Props> = ({
  form,
  readonly = false,
  validationErrors = [],
  onChange,
}) => {
  return (
    <div className="space-y-4">
      {/* Strengths */}
      <div className="space-y-1.5">
        <Label htmlFor="strengths" className="text-sm">
          Points forts
          <span className="ml-1 text-xs text-muted-foreground">(une entrée par ligne)</span>
        </Label>
        <Textarea
          id="strengths"
          value={form.strengths}
          onChange={(e) => onChange("strengths", e.target.value)}
          placeholder={"Bonne organisation des idées\nVocabulaire varié\n…"}
          rows={3}
          disabled={readonly}
          className="text-sm resize-none"
        />
      </div>

      {/* Weaknesses */}
      <div className="space-y-1.5">
        <Label htmlFor="weaknesses" className="text-sm">
          Points à améliorer
          <span className="ml-1 text-xs text-muted-foreground">(une entrée par ligne)</span>
        </Label>
        <Textarea
          id="weaknesses"
          value={form.weaknesses}
          onChange={(e) => onChange("weaknesses", e.target.value)}
          placeholder={"Accords sujet-verbe à revoir\nRegistre parfois trop familier\n…"}
          rows={3}
          disabled={readonly}
          className="text-sm resize-none"
        />
      </div>

      {/* Overall comments */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="comments" className="text-sm">
            Commentaire général <span className="text-destructive">*</span>
          </Label>
          <span
            className={[
              "text-xs tabular-nums",
              form.comments.length > MAX_COMMENTS * 0.9
                ? "text-destructive"
                : "text-muted-foreground",
            ].join(" ")}
          >
            {form.comments.length}/{MAX_COMMENTS}
          </span>
        </div>
        <Textarea
          id="comments"
          value={form.comments}
          onChange={(e) =>
            onChange("comments", e.target.value.slice(0, MAX_COMMENTS))
          }
          placeholder="Rédigez votre évaluation globale pour l'élève…"
          rows={5}
          disabled={readonly}
          className={[
            "text-sm resize-none",
            validationErrors.some((e) => e.toLowerCase().includes("commentaire"))
              ? "border-destructive"
              : "",
          ].join(" ")}
          aria-describedby="comments-error"
          aria-invalid={validationErrors.some((e) => e.toLowerCase().includes("commentaire"))}
        />
        {validationErrors
          .filter((e) => e.toLowerCase().includes("commentaire"))
          .map((e, i) => (
            <p key={i} id="comments-error" className="text-xs text-destructive">
              {e}
            </p>
          ))}
      </div>

      {/* Recommendations */}
      <div className="space-y-1.5">
        <Label htmlFor="recommendations" className="text-sm">
          Recommandations
          <span className="ml-1 text-xs text-muted-foreground">(une entrée par ligne)</span>
        </Label>
        <Textarea
          id="recommendations"
          value={form.recommendations}
          onChange={(e) => onChange("recommendations", e.target.value)}
          placeholder={"Réviser les accords en genre et en nombre\nPratiquer les connecteurs logiques\n…"}
          rows={3}
          disabled={readonly}
          className="text-sm resize-none"
        />
      </div>
    </div>
  )
}
