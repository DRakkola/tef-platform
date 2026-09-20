/**
 * ExerciseAnswerGroup Component.
 * Accessible, semantic answer controls for practice exercises.
 * Uses native <input type="radio">, <input type="checkbox">, or <input type="text">
 * with comfortable touch targets and subtle feedback states.
 */

import React from "react"
import { Check, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { ExerciseOption, ExerciseAttemptResult } from "../types"

export interface ExerciseAnswerGroupProps {
  questionType: string
  options: ExerciseOption[]
  selectedOptionIndex: number | null
  selectedOptionIndices?: number[]
  textResponse?: string
  onSelectOption: (index: number) => void
  onToggleOption?: (index: number) => void
  onChangeText?: (text: string) => void
  onSubmit?: () => void
  disabled?: boolean
  result?: ExerciseAttemptResult | null
  className?: string
}

export const ExerciseAnswerGroup: React.FC<ExerciseAnswerGroupProps> = ({
  questionType = "single_choice",
  options,
  selectedOptionIndex,
  selectedOptionIndices = [],
  textResponse = "",
  onSelectOption,
  onToggleOption,
  onChangeText,
  onSubmit,
  disabled = false,
  result = null,
  className,
}) => {
  const isMultiple = questionType === "multiple_choice"
  const isTextInput = questionType === "text_input"

  // 1. Text Input Mode (Conjugation, Fill-in-the-blank)
  if (isTextInput) {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !disabled && textResponse.trim().length > 0) {
        e.preventDefault()
        onSubmit?.()
      }
    }

    return (
      <div className={cn("space-y-3", className)}>
        <label htmlFor="exercise-text-input" className="text-xs font-semibold text-muted-foreground block">
          Votre réponse :
        </label>
        <div className="relative">
          <Input
            id="exercise-text-input"
            type="text"
            value={textResponse}
            onChange={(e) => onChangeText?.(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Tapez votre réponse ici..."
            className={cn(
              "h-12 text-base px-4 rounded-xl border transition-all",
              result && (result.is_correct ? "border-emerald-500 bg-emerald-500/5 text-emerald-950 dark:text-emerald-200" : "border-amber-500 bg-amber-500/5 text-amber-950 dark:text-amber-200")
            )}
            autoComplete="off"
            spellCheck="false"
          />
        </div>
      </div>
    )
  }

  // 2. Choice Options Mode (Single Choice Radio or Multiple Choice Checkbox)
  return (
    <fieldset className={cn("space-y-3", className)}>
      <legend className="sr-only">Options de réponse pour l'exercice</legend>

      <div className="space-y-2.5">
        {options.map((option, idx) => {
          const isSelected = isMultiple
            ? selectedOptionIndices.includes(idx)
            : selectedOptionIndex === idx

          const inputId = `exercise-opt-${idx}`

          // Post-submission feedback styling
          let containerStyle = "border-border/80 bg-card hover:bg-muted/40 hover:border-border"
          let indicatorIcon = null

          if (result) {
            if (isSelected) {
              if (result.is_correct) {
                containerStyle = "border-emerald-500/50 bg-emerald-500/10 text-foreground"
                indicatorIcon = <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
              } else {
                containerStyle = "border-amber-500/50 bg-amber-500/10 text-foreground"
                indicatorIcon = <X className="size-4 text-amber-600 dark:text-amber-400" />
              }
            } else if (!result.is_correct && result.correct_answer === option.content) {
              containerStyle = "border-emerald-500/50 bg-emerald-500/10 text-foreground"
              indicatorIcon = <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
            }
          } else if (isSelected) {
            containerStyle = "border-primary bg-primary/5 text-foreground ring-1 ring-primary/40"
          }

          return (
            <label
              key={idx}
              htmlFor={inputId}
              className={cn(
                "group relative flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer select-none min-h-[52px]",
                disabled && "cursor-not-allowed opacity-90",
                containerStyle
              )}
            >
              <div className="flex items-center gap-3.5 min-w-0 pr-3">
                {/* Native Accessible Semantic Control */}
                <input
                  id={inputId}
                  type={isMultiple ? "checkbox" : "radio"}
                  name="exercise_choice_answer"
                  value={idx}
                  checked={isSelected}
                  disabled={disabled}
                  onChange={() => {
                    if (isMultiple) {
                      onToggleOption?.(idx)
                    } else {
                      onSelectOption(idx)
                    }
                  }}
                  className={cn(
                    "size-4 rounded-full border-border text-primary focus:ring-primary/40 focus:ring-offset-background",
                    isMultiple && "rounded-sm"
                  )}
                />

                <span className="text-sm font-medium leading-relaxed text-foreground">
                  {option.content}
                </span>
              </div>

              {/* Status feedback icon */}
              {indicatorIcon && <div className="shrink-0">{indicatorIcon}</div>}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
