/**
 * CorrectionPanel: Right-side panel in the workspace.
 * Orchestrates: ErrorList + AddErrorForm + FeedbackForm + ScoreForm.
 */

import React, { useState } from "react"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import type { CorrectionFormState, CorrectionItemCreate } from "../types"
import { ErrorList } from "./ErrorList"
import { AddErrorForm } from "./AddErrorForm"
import { FeedbackForm } from "./FeedbackForm"
import { ScoreForm } from "./ScoreForm"

interface Props {
  form: CorrectionFormState
  readonly?: boolean
  validationErrors?: string[]
  onChange: <K extends keyof CorrectionFormState>(key: K, value: CorrectionFormState[K]) => void
  onAddError: (item: CorrectionItemCreate) => void
  onUpdateError: (index: number, item: CorrectionItemCreate) => void
  onRemoveError: (index: number) => void
}

export const CorrectionPanel: React.FC<Props> = ({
  form,
  readonly = false,
  validationErrors = [],
  onChange,
  onAddError,
  onUpdateError,
  onRemoveError,
}) => {
  const [isAddingError, setIsAddingError] = useState(false)

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Section 1: Score & Evaluation                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-lg border border-border/60 bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold">Évaluation</h3>
        <ScoreForm
          form={form}
          readonly={readonly}
          validationErrors={validationErrors}
          onChange={onChange}
        />
      </div>

      <Separator />

      {/* ------------------------------------------------------------------ */}
      {/* Section 2: Error annotations                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            Erreurs relevées
            {form.items.length > 0 && (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                ({form.items.length})
              </span>
            )}
          </h3>
          {!readonly && !isAddingError && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddingError(true)}
              className="h-7 gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Ajouter une erreur
            </Button>
          )}
        </div>

        {isAddingError && !readonly && (
          <AddErrorForm
            onAdd={(item) => {
              onAddError(item)
              setIsAddingError(false)
            }}
            onCancel={() => setIsAddingError(false)}
          />
        )}

        <ErrorList
          items={form.items}
          readonly={readonly}
          onUpdate={onUpdateError}
          onRemove={onRemoveError}
        />
      </div>

      <Separator />

      {/* ------------------------------------------------------------------ */}
      {/* Section 3: Feedback                                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Retour pédagogique</h3>
        <FeedbackForm
          form={form}
          readonly={readonly}
          validationErrors={validationErrors}
          onChange={onChange}
        />
      </div>
    </div>
  )
}
