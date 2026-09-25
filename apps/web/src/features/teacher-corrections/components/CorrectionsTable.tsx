/**
 * CorrectionsTable: Desktop table + mobile card list for the correction queue.
 *
 * CTA label varies by backend status:
 *  - unassigned (submitted/queued) → "Commencer la correction"
 *  - assigned/in_review → "Continuer"
 *  - corrected/returned → "Voir la correction"
 */

import React from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronRight, FileText } from "lucide-react"
import type { WritingSubmissionSummary } from "../types"
import {
  SUBMISSION_STATUS_META,
  TASK_TYPE_LABELS,
} from "../types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso))
}

function getCTA(status: string): string {
  if (["corrected", "returned"].includes(status)) return "Voir la correction"
  if (["assigned", "in_review", "reviewing"].includes(status)) return "Continuer"
  return "Commencer la correction"
}

function getStudentLabel(item: WritingSubmissionSummary): string {
  // Backend does not yet anonymize — show truncated UUID as identifier
  return `Élève #${item.user_id.slice(0, 8)}`
}

// ---------------------------------------------------------------------------
// Row (desktop)
// ---------------------------------------------------------------------------

interface RowProps {
  item: WritingSubmissionSummary
  onOpen: (id: string) => void
  isClaimPending: boolean
}

const CorrectionsTableRow: React.FC<RowProps> = ({ item, onOpen, isClaimPending }) => {
  const statusMeta = SUBMISSION_STATUS_META[item.status] ?? {
    label: item.status,
    variant: "outline" as const,
  }
  const taskLabel =
    item.task?.task_type
      ? TASK_TYPE_LABELS[item.task.task_type] ?? item.task.task_type
      : "—"

  return (
    <tr className="border-b border-border/50 hover:bg-muted/30 transition-colors">
      <td className="py-3 pl-4 pr-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="h-7 w-7 flex items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-medium flex-shrink-0">
            É
          </span>
          <span className="font-medium text-foreground">{getStudentLabel(item)}</span>
        </div>
      </td>
      <td className="py-3 px-3 text-sm text-muted-foreground">
        {item.task?.title ?? taskLabel}
      </td>
      <td className="py-3 px-3 text-sm text-muted-foreground tabular-nums">
        {formatDate(item.submitted_at)}
      </td>
      <td className="py-3 px-3">
        <Badge variant={statusMeta.variant} className="text-xs">
          {statusMeta.label}
        </Badge>
      </td>
      <td className="py-3 pl-3 pr-4 text-right">
        <Button
          size="sm"
          variant={["corrected", "returned"].includes(item.status) ? "outline" : "default"}
          onClick={() => onOpen(item.id)}
          disabled={isClaimPending}
          className="gap-1.5"
        >
          {getCTA(item.status)}
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Mobile card
// ---------------------------------------------------------------------------

const CorrectionsMobileCard: React.FC<RowProps> = ({ item, onOpen, isClaimPending }) => {
  const statusMeta = SUBMISSION_STATUS_META[item.status] ?? {
    label: item.status,
    variant: "outline" as const,
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">{getStudentLabel(item)}</p>
          <p className="text-xs text-muted-foreground">
            {item.task?.title ?? "—"}
          </p>
        </div>
        <Badge variant={statusMeta.variant} className="text-xs flex-shrink-0">
          {statusMeta.label}
        </Badge>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <FileText className="h-3 w-3" />
          Soumise le {formatDate(item.submitted_at)} · {item.word_count} mots
        </p>
        <Button
          size="sm"
          variant={["corrected", "returned"].includes(item.status) ? "outline" : "default"}
          onClick={() => onOpen(item.id)}
          disabled={isClaimPending}
          className="h-7 px-3 text-xs gap-1"
        >
          {getCTA(item.status)}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  submissions: WritingSubmissionSummary[]
  isClaimPending: boolean
  onClaim: (id: string) => Promise<unknown>
}

export const CorrectionsTable: React.FC<Props> = ({ submissions, isClaimPending, onClaim }) => {
  const navigate = useNavigate()

  const handleOpen = async (id: string) => {
    const item = submissions.find((s) => s.id === id)
    if (!item) return

    const isUnassigned = ["submitted", "queued"].includes(item.status)
    if (isUnassigned) {
      try {
        await onClaim(id)
      } catch {
        // Claim error surfaced by parent; still navigate so teacher can see the submission
      }
    }
    navigate(`/teacher/corrections/${id}`)
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block rounded-lg border border-border/60 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40">
              <th className="py-2.5 pl-4 pr-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Élève
              </th>
              <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Type de rédaction
              </th>
              <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Soumise le
              </th>
              <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Statut
              </th>
              <th className="py-2.5 pl-3 pr-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 bg-card">
            {submissions.map((item) => (
              <CorrectionsTableRow
                key={item.id}
                item={item}
                onOpen={handleOpen}
                isClaimPending={isClaimPending}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {submissions.map((item) => (
          <CorrectionsMobileCard
            key={item.id}
            item={item}
            onOpen={handleOpen}
            isClaimPending={isClaimPending}
          />
        ))}
      </div>
    </>
  )
}
