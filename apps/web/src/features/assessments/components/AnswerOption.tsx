import React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface AnswerOptionProps {
  id: string
  label: string
  content: string
  isSelected: boolean
  onSelect: () => void
  disabled?: boolean
  type?: "radio" | "checkbox"
  className?: string
}

export const AnswerOption: React.FC<AnswerOptionProps> = ({
  id,
  label,
  content,
  isSelected,
  onSelect,
  disabled = false,
  type = "radio",
  className,
}) => {
  return (
    <button
      id={`option-${id}`}
      type="button"
      role={type}
      aria-checked={isSelected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "w-full text-left p-4 rounded-xl border transition-all flex items-center gap-3.5 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer min-h-[52px]",
        isSelected
          ? "border-primary bg-primary/10 text-foreground font-medium shadow-2xs ring-1 ring-primary/30"
          : "border-border/80 bg-card text-foreground/90 hover:border-border hover:bg-muted/40",
        disabled && "opacity-60 cursor-not-allowed pointer-events-none",
        className
      )}
    >
      {/* Option Identifier Badge */}
      <div
        className={cn(
          "size-7 rounded-lg border text-xs font-bold flex items-center justify-center shrink-0 transition-colors",
          isSelected
            ? "border-primary bg-primary text-primary-foreground shadow-2xs"
            : "border-border/80 bg-muted/60 text-muted-foreground"
        )}
      >
        {isSelected && type === "checkbox" ? <Check className="size-3.5 stroke-[3]" /> : label}
      </div>

      {/* Option Text Content */}
      <span className="text-sm sm:text-base font-normal leading-relaxed flex-1 select-text">
        {content}
      </span>
    </button>
  )
}
