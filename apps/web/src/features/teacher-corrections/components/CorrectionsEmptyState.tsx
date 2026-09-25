/**
 * CorrectionsEmptyState: Empty state for corrections queue.
 */

import React from "react"
import { FileCheck, FilterX } from "lucide-react"
import type { CorrectionStatusFilter } from "../types"

interface Props {
  filter: CorrectionStatusFilter
  totalCount: number
}

export const CorrectionsEmptyState: React.FC<Props> = ({ filter, totalCount }) => {
  const isFiltered = filter !== "all" && totalCount > 0

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        {isFiltered ? (
          <FilterX className="h-7 w-7 text-muted-foreground" />
        ) : (
          <FileCheck className="h-7 w-7 text-muted-foreground" />
        )}
      </div>
      <h3 className="text-base font-semibold text-foreground">
        {isFiltered
          ? "Aucune correction correspondante"
          : "Vous n'avez aucune correction en attente"}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {isFiltered
          ? "Aucune correction ne correspond à ces critères. Essayez un autre filtre."
          : "Les nouvelles rédactions attribuées apparaîtront ici."}
      </p>
    </div>
  )
}
