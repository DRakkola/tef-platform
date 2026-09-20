import React from "react"
import { cn } from "@/lib/utils"

export interface FilterOption {
  value: string
  label: string
  count?: number
  icon?: React.ComponentType<{ className?: string }>
}

export interface FilterGroupProps {
  label?: string
  options: FilterOption[]
  value: string
  onChange: (value: string) => void
  variant?: "segmented" | "pills"
  className?: string
  ariaLabel?: string
}

export function FilterGroup({
  label,
  options,
  value,
  onChange,
  variant = "segmented",
  className,
  ariaLabel,
}: FilterGroupProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel || label || "Filtres"}
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {label && (
        <span className="text-xs font-semibold text-muted-foreground mr-1 shrink-0">
          {label}
        </span>
      )}
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5",
          variant === "segmented" && "p-1 rounded-xl bg-muted/50 border border-border/60"
        )}
      >
        {options.map((option) => {
          const isSelected = value === option.value
          const Icon = option.icon

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={isSelected}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer select-none",
                variant === "segmented"
                  ? isSelected
                    ? "bg-card text-foreground font-semibold shadow-xs border border-border/80"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/40"
                  : isSelected
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "bg-card text-muted-foreground border border-border hover:text-foreground hover:bg-muted"
              )}
            >
              {Icon && <Icon className="size-3.5" />}
              <span>{option.label}</span>
              {typeof option.count === "number" && (
                <span
                  className={cn(
                    "ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                    isSelected
                      ? variant === "segmented"
                        ? "bg-primary/10 text-primary"
                        : "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {option.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export interface FilterBarProps {
  children: React.ReactNode
  className?: string
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-border/80 bg-card shadow-xs",
        className
      )}
    >
      {children}
    </div>
  )
}
