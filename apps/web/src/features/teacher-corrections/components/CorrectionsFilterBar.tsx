/**
 * CorrectionsFilterBar: Tab bar for filtering corrections by status.
 */

import React from "react"
import { Badge } from "@/components/ui/badge"
import type { CorrectionStatusFilter } from "../types"

interface FilterTab {
  key: CorrectionStatusFilter
  label: string
}

const TABS: FilterTab[] = [
  { key: "all",       label: "Toutes"    },
  { key: "pending",   label: "À corriger" },
  { key: "in_review", label: "En cours"  },
  { key: "done",      label: "Terminées" },
]

interface Props {
  activeFilter: CorrectionStatusFilter
  counts: Record<CorrectionStatusFilter, number>
  onFilterChange: (filter: CorrectionStatusFilter) => void
}

export const CorrectionsFilterBar: React.FC<Props> = ({
  activeFilter,
  counts,
  onFilterChange,
}) => {
  return (
    <div
      role="tablist"
      aria-label="Filtrer les corrections"
      className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/40 p-1"
    >
      {TABS.map((tab) => {
        const isActive = activeFilter === tab.key
        const count = counts[tab.key] ?? 0
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onFilterChange(tab.key)}
            className={[
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {tab.label}
            {count > 0 && (
              <Badge
                variant={isActive ? "default" : "secondary"}
                className="h-4 min-w-4 px-1 text-[10px] tabular-nums"
              >
                {count}
              </Badge>
            )}
          </button>
        )
      })}
    </div>
  )
}
