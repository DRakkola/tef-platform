/**
 * ScoreForm: Score, estimated CEFR level, and optional per-dimension scores.
 * Always shows the simulation disclaimer (backend has is_simulated: true hardcoded).
 */

import React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Info } from "lucide-react"
import type { CorrectionFormState } from "../types"
import { CEFR_LEVELS } from "../types"

interface DimensionField {
  key: keyof Pick<
    CorrectionFormState,
    "task_completion" | "coherence" | "vocabulary" | "grammar" | "syntax" | "spelling" | "register"
  >
  label: string
}

const DIMENSIONS: DimensionField[] = [
  { key: "task_completion", label: "Réalisation de la tâche" },
  { key: "coherence",       label: "Cohérence"               },
  { key: "vocabulary",      label: "Vocabulaire"              },
  { key: "grammar",         label: "Grammaire"                },
  { key: "syntax",          label: "Syntaxe"                  },
  { key: "spelling",        label: "Orthographe"              },
  { key: "register",        label: "Registre"                 },
]

interface Props {
  form: CorrectionFormState
  readonly?: boolean
  validationErrors?: string[]
  onChange: <K extends keyof CorrectionFormState>(key: K, value: CorrectionFormState[K]) => void
}

function parseScore(val: string): number | "" {
  if (val === "") return ""
  const n = parseFloat(val)
  return isNaN(n) ? "" : Math.max(0, Math.min(100, n))
}

export const ScoreForm: React.FC<Props> = ({
  form,
  readonly = false,
  validationErrors = [],
  onChange,
}) => {
  const scoreError =
    validationErrors.find((e) => e.toLowerCase().includes("score")) ?? null

  return (
    <div className="space-y-5">
      {/* Disclaimer */}
      <div className="flex gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
        <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
          Le score et le niveau sont des estimations internes à la plateforme.
          Ils ne constituent pas un score TEF officiel.
        </p>
      </div>

      {/* Score + Level in a row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Overall score */}
        <div className="space-y-1.5">
          <Label htmlFor="score" className="text-sm">
            Score global (0–100) <span className="text-destructive">*</span>
          </Label>
          <Input
            id="score"
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={form.score}
            onChange={(e) => onChange("score", parseScore(e.target.value))}
            disabled={readonly}
            className={[
              "text-sm",
              scoreError ? "border-destructive" : "",
            ].join(" ")}
            aria-invalid={!!scoreError}
            placeholder="75"
          />
          {scoreError && (
            <p className="text-xs text-destructive">{scoreError}</p>
          )}
        </div>

        {/* Estimated CEFR level */}
        <div className="space-y-1.5">
          <Label htmlFor="level" className="text-sm">
            Niveau CECRL estimé <span className="text-destructive">*</span>
          </Label>
          <Select
            value={form.estimated_level}
            onValueChange={(val) => onChange("estimated_level", val)}
            disabled={readonly}
          >
            <SelectTrigger
              id="level"
              className={[
                "text-sm",
                validationErrors.some((e) => e.toLowerCase().includes("niveau"))
                  ? "border-destructive"
                  : "",
              ].join(" ")}
            >
              <SelectValue placeholder="Choisir…" />
            </SelectTrigger>
            <SelectContent>
              {CEFR_LEVELS.map((level) => (
                <SelectItem key={level} value={level}>
                  {level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {validationErrors
            .filter((e) => e.toLowerCase().includes("niveau"))
            .map((e, i) => (
              <p key={i} className="text-xs text-destructive">{e}</p>
            ))}
        </div>
      </div>

      {/* Per-dimension scores (optional) */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Scores par critère
          <span className="ml-1 font-normal normal-case">(optionnels)</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          {DIMENSIONS.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={`dim-${key}`} className="text-xs text-muted-foreground">
                {label}
              </Label>
              <Input
                id={`dim-${key}`}
                type="number"
                min={0}
                max={100}
                step={1}
                value={form[key]}
                onChange={(e) => onChange(key, parseScore(e.target.value))}
                disabled={readonly}
                className="h-8 text-sm"
                placeholder="—"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
