import React from "react"
import { Link } from "react-router-dom"
import { ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"

export interface PageHeaderProps {
  title: string
  description?: string
  backHref?: string
  backLabel?: string
  badge?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  backHref,
  backLabel = "Retour",
  badge,
  actions,
  className,
}) => {
  return (
    <div
      data-slot="page-header"
      className={cn(
        "flex flex-col gap-3.5 pb-6 border-b border-border/60 mb-8 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="space-y-1.5">
        {backHref && (
          <Link
            to={backHref}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-1"
          >
            <ChevronLeft className="size-3.5" />
            <span>{backLabel}</span>
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-h1 font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="text-body text-muted-foreground max-w-3xl leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-3 shrink-0 pt-1 sm:pt-0">
          {actions}
        </div>
      )}
    </div>
  )
}
