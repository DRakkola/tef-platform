/**
 * useTeacherCorrections: TanStack Query hook for the correction queue page.
 *
 * Fetches the combined list of unassigned + assigned submissions from
 * GET /teachers/writing/submissions. Provides filter state, pagination,
 * and a claim mutation.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useMemo } from "react"
import {
  getTeacherWritingSubmissions,
  claimWritingSubmission,
} from "../api"
import type { CorrectionStatusFilter, WritingSubmissionSummary } from "../types"

// ---------------------------------------------------------------------------
// Status → filter bucket mapping
// ---------------------------------------------------------------------------

const PENDING_STATUSES = new Set(["submitted", "queued", "assigned"])
const IN_REVIEW_STATUSES = new Set(["in_review", "processing", "reviewing"])
const DONE_STATUSES = new Set(["corrected", "returned"])

function matchesFilter(item: WritingSubmissionSummary, filter: CorrectionStatusFilter): boolean {
  if (filter === "all") return true
  if (filter === "pending") return PENDING_STATUSES.has(item.status)
  if (filter === "in_review") return IN_REVIEW_STATUSES.has(item.status)
  if (filter === "done") return DONE_STATUSES.has(item.status)
  return true
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTeacherCorrections() {
  const queryClient = useQueryClient()
  const [activeFilter, setActiveFilter] = useState<CorrectionStatusFilter>("all")

  // Fetch all submissions (backend returns combined queue + assigned list)
  const {
    data: allSubmissions = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<WritingSubmissionSummary[], Error>({
    queryKey: ["teacher-corrections"],
    queryFn: () => getTeacherWritingSubmissions(),
    staleTime: 30_000,
  })

  // Client-side filter
  const filteredSubmissions = useMemo(
    () => allSubmissions.filter((s) => matchesFilter(s, activeFilter)),
    [allSubmissions, activeFilter]
  )

  // Badge counts
  const counts = useMemo(
    () => ({
      pending: allSubmissions.filter((s) => matchesFilter(s, "pending")).length,
      in_review: allSubmissions.filter((s) => matchesFilter(s, "in_review")).length,
      done: allSubmissions.filter((s) => matchesFilter(s, "done")).length,
      all: allSubmissions.length,
    }),
    [allSubmissions]
  )

  // Claim mutation — used from the queue table action button
  const claimMutation = useMutation({
    mutationFn: (submissionId: string) => claimWritingSubmission(submissionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-corrections"] })
      queryClient.invalidateQueries({ queryKey: ["teacher-dashboard-summary"] })
    },
  })

  return {
    submissions: filteredSubmissions,
    allSubmissions,
    counts,
    activeFilter,
    setActiveFilter,
    isLoading,
    isError,
    error,
    refetch,
    // Claim
    claimSubmission: claimMutation.mutateAsync,
    isClaimPending: claimMutation.isPending,
    claimError: claimMutation.error,
  }
}
