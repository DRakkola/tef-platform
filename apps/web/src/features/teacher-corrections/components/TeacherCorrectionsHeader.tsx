/**
 * TeacherCorrectionsHeader: Page header for /teacher/corrections.
 */

import React from "react"
import { FileEdit } from "lucide-react"

interface Props {
  totalCount: number
  pendingCount: number
}

export const TeacherCorrectionsHeader: React.FC<Props> = ({ totalCount, pendingCount }) => {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileEdit className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Corrections</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Traitez les rédactions qui vous sont attribuées.
            {totalCount > 0 && (
              <span className="ml-1">
                {pendingCount > 0
                  ? `${pendingCount} en attente de correction.`
                  : "Toutes les corrections sont à jour."}
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
