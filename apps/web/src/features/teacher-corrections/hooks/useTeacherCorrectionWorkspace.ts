/**
 * useTeacherCorrectionWorkspace: TanStack Query + local form state hook
 * for the correction workspace page (/teacher/corrections/:id).
 *
 * Handles:
 * - Fetching submission detail (with student essay text)
 * - Local correction form state (no backend draft endpoint)
 * - isDirty tracking for unsaved-changes warning
 * - Claim + start review mutation
 * - Final submit correction mutation
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useCallback, useMemo, useEffect } from "react"
import {
  getTeacherWritingSubmissionDetail,
  claimWritingSubmission,
  startWritingReview,
  submitTeacherCorrection,
} from "../api"
import type {
  CorrectionFormState,
  CorrectionItemCreate,
  TeacherCorrectionPayload,
  WritingCorrectionResponse,
} from "../types"
import { EMPTY_CORRECTION_FORM } from "../types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseNumber(val: number | ""): number | null {
  return val === "" ? null : val
}

function splitLines(val: string): string[] {
  return val
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTeacherCorrectionWorkspace(submissionId: string) {
  const queryClient = useQueryClient()

  // -------------------------------------------------------------------------
  // Fetch submission detail
  // -------------------------------------------------------------------------
  const {
    data: submission,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["teacher-correction-workspace", submissionId],
    queryFn: () => getTeacherWritingSubmissionDetail(submissionId),
    enabled: !!submissionId,
    staleTime: 60_000,
    retry: (failureCount, err) => {
      // Don't retry on 403/404 — these are not transient errors
      const msg = (err as Error)?.message ?? ""
      if (msg.includes("403") || msg.includes("404")) return false
      return failureCount < 2
    },
  })

  // -------------------------------------------------------------------------
  // Local correction form state
  // -------------------------------------------------------------------------
  const [form, setForm] = useState<CorrectionFormState>(EMPTY_CORRECTION_FORM)
  const [initialForm, setInitialForm] = useState<CorrectionFormState>(EMPTY_CORRECTION_FORM)

  // Pre-populate form if an existing correction is returned
  useEffect(() => {
    if (submission?.correction) {
      const c = submission.correction
      const prefilled: CorrectionFormState = {
        score: c.score ?? "",
        estimated_level: c.estimated_level ?? "",
        task_completion: c.task_completion ?? "",
        coherence: c.coherence ?? "",
        vocabulary: c.vocabulary ?? "",
        grammar: c.grammar ?? "",
        syntax: c.syntax ?? "",
        spelling: c.spelling ?? "",
        register: c.register ?? "",
        strengths: (c.strengths ?? []).join("\n"),
        weaknesses: (c.weaknesses ?? []).join("\n"),
        comments: c.comments ?? "",
        recommendations: (c.recommendations ?? []).join("\n"),
        items: (c.items ?? []).map((i) => ({
          original_text: i.original_text,
          corrected_text: i.corrected_text,
          category: i.category,
          explanation: i.explanation,
          skill_id: i.skill_id,
        })),
      }
      setForm(prefilled)
      setInitialForm(prefilled)
    }
  }, [submission?.correction])

  // isDirty — deep compare form vs initial
  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm]
  )

  // -------------------------------------------------------------------------
  // Form field updaters
  // -------------------------------------------------------------------------
  const updateField = useCallback(
    <K extends keyof CorrectionFormState>(key: K, value: CorrectionFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  const addErrorItem = useCallback((item: CorrectionItemCreate) => {
    setForm((prev) => ({ ...prev, items: [...prev.items, item] }))
  }, [])

  const updateErrorItem = useCallback((index: number, item: CorrectionItemCreate) => {
    setForm((prev) => {
      const items = [...prev.items]
      items[index] = item
      return { ...prev, items }
    })
  }, [])

  const removeErrorItem = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }))
  }, [])

  // -------------------------------------------------------------------------
  // Claim + start review mutation (combined: claim if unassigned, then review)
  // -------------------------------------------------------------------------
  const claimAndStartMutation = useMutation({
    mutationFn: async () => {
      const sub = await claimWritingSubmission(submissionId)
      // Transition to in_review only if claim succeeded
      if (["assigned", "in_review"].includes(sub.status)) {
        await startWritingReview(submissionId)
      }
      return sub
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-correction-workspace", submissionId] })
      queryClient.invalidateQueries({ queryKey: ["teacher-corrections"] })
    },
  })

  // -------------------------------------------------------------------------
  // Submit correction mutation
  // -------------------------------------------------------------------------
  const [submitError, setSubmitError] = useState<string | null>(null)

  const submitMutation = useMutation<WritingCorrectionResponse, Error, void>({
    mutationFn: () => {
      const payload: TeacherCorrectionPayload = {
        score: form.score as number,
        estimated_level: form.estimated_level,
        task_completion: parseNumber(form.task_completion),
        coherence: parseNumber(form.coherence),
        vocabulary: parseNumber(form.vocabulary),
        grammar: parseNumber(form.grammar),
        syntax: parseNumber(form.syntax),
        spelling: parseNumber(form.spelling),
        register: parseNumber(form.register),
        strengths: splitLines(form.strengths),
        weaknesses: splitLines(form.weaknesses),
        comments: form.comments,
        recommendations: splitLines(form.recommendations),
        corrected_content: null,
        items: form.items,
        skills: [],
      }
      return submitTeacherCorrection(submissionId, payload)
    },
    onSuccess: () => {
      setSubmitError(null)
      setInitialForm(form) // mark clean so unsaved dialog won't fire
      queryClient.invalidateQueries({ queryKey: ["teacher-corrections"] })
      queryClient.invalidateQueries({ queryKey: ["teacher-dashboard-summary"] })
      queryClient.invalidateQueries({ queryKey: ["teacher-correction-workspace", submissionId] })
    },
    onError: (err) => {
      setSubmitError(err?.message ?? "Une erreur est survenue lors de la soumission.")
    },
  })

  // -------------------------------------------------------------------------
  // Client-side validation
  // -------------------------------------------------------------------------
  const validationErrors = useMemo(() => {
    const errs: string[] = []
    if (form.score === "" || (typeof form.score === "number" && (form.score < 0 || form.score > 100))) {
      errs.push("Le score doit être compris entre 0 et 100.")
    }
    if (!form.estimated_level.trim()) {
      errs.push("Le niveau CECRL estimé est requis.")
    }
    if (!form.comments.trim() || form.comments.trim().length < 5) {
      errs.push("Le commentaire général doit contenir au moins 5 caractères.")
    }
    return errs
  }, [form])

  const isValid = validationErrors.length === 0

  return {
    // Data
    submission,
    isLoading,
    isError,
    error,
    refetch,
    // Form
    form,
    updateField,
    addErrorItem,
    updateErrorItem,
    removeErrorItem,
    isDirty,
    isValid,
    validationErrors,
    // Claim + review
    claimAndStart: claimAndStartMutation.mutateAsync,
    isClaimPending: claimAndStartMutation.isPending,
    claimError: claimAndStartMutation.error,
    // Submit
    submitCorrection: submitMutation.mutateAsync,
    isSubmitPending: submitMutation.isPending,
    isSubmitSuccess: submitMutation.isSuccess,
    submitError,
  }
}
