import * as React from "react"
import { cn } from "@/lib/utils"

export interface SectionProps extends React.ComponentProps<"section"> {
  children: React.ReactNode
}

export function Section({ children, className, ...props }: SectionProps) {
  return (
    <section className={cn("space-y-4 min-w-0", className)} {...props}>
      {children}
    </section>
  )
}

export interface SectionHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function SectionHeader({
  title,
  description,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-1 min-w-0",
        className
      )}
    >
      <div className="space-y-1 min-w-0">
        <h2 className="text-lg font-semibold tracking-tight text-foreground text-balance">
          {title}
        </h2>
        {description && (
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0 pt-1 sm:pt-0">{action}</div>}
    </div>
  )
}
