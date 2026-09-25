/**
 * ErrorList: Displays added correction items (errors) with edit and delete actions.
 */

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Trash2, ChevronDown, ChevronUp } from "lucide-react"
import type { CorrectionItemCreate } from "../types"
import { CORRECTION_CATEGORY_LABELS } from "../types"
import { AddErrorForm } from "./AddErrorForm"

interface Props {
  items: CorrectionItemCreate[]
  readonly?: boolean
  onUpdate?: (index: number, item: CorrectionItemCreate) => void
  onRemove?: (index: number) => void
}

export const ErrorList: React.FC<Props> = ({
  items,
  readonly = false,
  onUpdate,
  onRemove,
}) => {
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null)
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic py-2">
        Aucune erreur relevée pour l'instant.
      </p>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {items.map((item, i) => {
          const categoryLabel = CORRECTION_CATEGORY_LABELS[item.category] ?? item.category
          const isExpanded = expandedIndex === i
          const isEditing = editIndex === i

          if (isEditing && !readonly && onUpdate) {
            return (
              <AddErrorForm
                key={i}
                onAdd={(updated) => {
                  onUpdate(i, updated)
                  setEditIndex(null)
                }}
                onCancel={() => setEditIndex(null)}
              />
            )
          }

          return (
            <div
              key={i}
              className="rounded-md border border-border/60 bg-card overflow-hidden"
            >
              <button
                type="button"
                className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setExpandedIndex(isExpanded ? null : i)}
                aria-expanded={isExpanded}
              >
                <span className="flex-shrink-0 mt-0.5 text-xs font-mono text-muted-foreground w-5">
                  {i + 1}.
                </span>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] px-1.5 h-4">
                      {categoryLabel}
                    </Badge>
                    <span className="text-sm">
                      <span className="line-through text-destructive/80 mr-1.5 break-all">
                        {item.original_text}
                      </span>
                      <span className="text-emerald-700 dark:text-emerald-400 break-all">
                        {item.corrected_text}
                      </span>
                    </span>
                  </div>
                </div>
                <span className="flex-shrink-0 text-muted-foreground ml-1">
                  {isExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </span>
              </button>

              {isExpanded && (
                <div className="border-t border-border/50 px-3 py-2.5 space-y-2 bg-muted/20">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {item.explanation}
                  </p>
                  {!readonly && (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditIndex(i)}
                        className="h-6 px-2 text-xs text-muted-foreground"
                      >
                        Modifier
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteIndex(i)}
                        className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Supprimer
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteIndex !== null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette erreur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette erreur sera définitivement retirée de votre correction.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteIndex(null)}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteIndex !== null && onRemove) {
                  onRemove(deleteIndex)
                }
                setDeleteIndex(null)
                setExpandedIndex(null)
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
