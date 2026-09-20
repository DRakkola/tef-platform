import React from "react"
import { AlertCircle } from "lucide-react"
import { AnswerGroup } from "./AnswerGroup"
import { AnswerOption } from "./AnswerOption"
import { Textarea } from "@/components/ui/textarea"
import type { QuestionStudent } from "../types"

export interface QuestionRendererProps {
  question: QuestionStudent
  value?: string | string[] | null
  onChange: (val: string) => void
  disabled?: boolean
}

export const QuestionRenderer: React.FC<QuestionRendererProps> = ({
  question,
  value,
  onChange,
  disabled = false,
}) => {
  const qType = question.question_type || "single_choice"

  // 1. Single Choice (Standard TEF reading multiple-choice)
  if (qType === "single_choice") {
    const selectedId = typeof value === "string" ? value : null
    return (
      <AnswerGroup
        questionId={question.id}
        prompt={question.prompt}
        options={question.options}
        selectedOptionId={selectedId}
        onSelect={onChange}
        disabled={disabled}
      />
    )
  }

  // 2. Multiple Choice (Multi-select options)
  if (qType === "multiple_choice") {
    const selectedIds = Array.isArray(value) ? value : typeof value === "string" && value ? [value] : []

    const handleToggle = (optionId: string) => {
      if (disabled) return
      const next = selectedIds.includes(optionId)
        ? selectedIds.filter((id) => id !== optionId)
        : [...selectedIds, optionId]
      // Cast to string or handle in parent
      onChange(next[0] || "")
    }

    return (
      <div role="group" aria-label={question.prompt} className="space-y-3">
        {question.options.map((option, idx) => {
          const letter = String.fromCharCode(65 + idx)
          const isSelected = selectedIds.includes(option.id)

          return (
            <AnswerOption
              key={option.id}
              id={option.id}
              label={letter}
              content={option.content}
              isSelected={isSelected}
              onSelect={() => handleToggle(option.id)}
              disabled={disabled}
              type="checkbox"
            />
          )
        })}
      </div>
    )
  }

  // 3. Free Text Input
  if (qType === "text_input") {
    const textVal = typeof value === "string" ? value : ""
    return (
      <div className="space-y-2">
        <label htmlFor={`input-${question.id}`} className="sr-only">
          {question.prompt}
        </label>
        <Textarea
          id={`input-${question.id}`}
          disabled={disabled}
          value={textVal}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Saisissez votre réponse ici..."
          rows={4}
          className="w-full text-sm sm:text-base leading-relaxed p-4 rounded-xl resize-y"
        />
        <div className="text-right text-xs text-muted-foreground">
          {textVal.length} caractères
        </div>
      </div>
    )
  }

  // 4. Graceful Fallback for Unsupported Types
  return (
    <div
      role="alert"
      className="p-4 rounded-xl bg-muted/60 border border-border text-xs text-muted-foreground flex items-start gap-2.5"
    >
      <AlertCircle className="size-4 text-warning shrink-0 mt-0.5" />
      <div>
        <span className="font-semibold text-foreground">Type de question non pris en charge</span>
        <p className="mt-0.5">
          Cette question requiert une modalité non gérée par ce module d'examen. Vos autres réponses restent enregistrées.
        </p>
      </div>
    </div>
  )
}
