/**
 * Authoritative data hook for the Student Assessment Results page (/attempts/:id/results).
 * Fetches authoritative attempt results and gracefully enriches with readiness, history,
 * and daily study plan data with independent fault tolerance.
 */

import { useState, useEffect, useCallback, useMemo } from "react"
import { telemetry } from "@/features/analytics/telemetry"
import type {
  AttemptResults,
  AssessmentHistoryItem,
  ReadinessProfileSummary,
  DailyPlanTaskSummary,
  ProgressComparisonData,
} from "./types"

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }
  return headers
}

export function useAssessmentResults(attemptId?: string) {
  const [results, setResults] = useState<AttemptResults | null>(null)
  const [readiness, setReadiness] = useState<ReadinessProfileSummary | null>(null)
  const [history, setHistory] = useState<AssessmentHistoryItem[]>([])
  const [dailyPlan, setDailyPlan] = useState<DailyPlanTaskSummary[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [hasSecondaryError, setHasSecondaryError] = useState<boolean>(false)

  const loadData = useCallback(async () => {
    if (!attemptId) return

    setIsLoading(true)
    setError(null)
    setHasSecondaryError(false)
    const headers = getAuthHeaders()

    // 1. Fetch authoritative attempt results (Critical)
    try {
      const resp = await fetch(`/api/v1/attempts/${attemptId}/results`, {
        credentials: "include",
        headers,
      })

      if (!resp.ok) {
        if (resp.status === 403 || resp.status === 401) {
          throw new Error("Vous n'êtes pas autorisé à consulter ces résultats.")
        }
        if (resp.status === 404) {
          throw new Error("Résultats introuvables pour cette session d'évaluation.")
        }
        throw new Error("Impossible de charger vos résultats.")
      }

      const data: AttemptResults = await resp.json()
      setResults(data)

      telemetry.track("result_viewed", {
        attemptId,
        assessmentId: data.assessment_id,
        scorePercentage: data.score?.percentage,
        estimatedLevel: data.score?.estimated_level,
      })
    } catch (err: any) {
      setError(err.message || "Impossible de charger vos résultats.")
      setIsLoading(false)
      return
    }

    // 2. Concurrently fetch supplementary services (Non-blocking & Fault Tolerant)
    try {
      const [readinessRes, historyRes, planRes] = await Promise.allSettled([
        fetch("/api/v1/students/me/readiness", { credentials: "include", headers }),
        fetch("/api/v1/assessments/me/history?limit=10", { credentials: "include", headers }),
        fetch("/api/v1/students/me/daily-plan", { credentials: "include", headers }),
      ])

      // Readiness
      if (readinessRes.status === "fulfilled" && readinessRes.value.ok) {
        const readData = await readinessRes.value.json()
        setReadiness(readData)
      } else {
        setHasSecondaryError(true)
      }

      // History
      if (historyRes.status === "fulfilled" && historyRes.value.ok) {
        const histData = await historyRes.value.json()
        setHistory(Array.isArray(histData) ? histData : [])
      } else {
        setHasSecondaryError(true)
      }

      // Daily Plan
      if (planRes.status === "fulfilled" && planRes.value.ok) {
        const planData = await planRes.value.json()
        if (planData && Array.isArray(planData.tasks)) {
          setDailyPlan(planData.tasks)
        }
      }
    } catch {
      setHasSecondaryError(true)
    } finally {
      setIsLoading(false)
    }
  }, [attemptId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Compute comparison if a prior comparable attempt exists
  const comparison = useMemo<ProgressComparisonData | null>(() => {
    if (!results || !history || history.length === 0) return null

    // Find the most recent completed attempt prior to the current one
    const priorAttempts = history.filter(
      (h) =>
        h.id !== results.attempt_id &&
        h.status === "submitted" &&
        typeof h.score_percentage === "number" &&
        // Prioritize same assessment or same assessment type
        (h.assessment_id === results.assessment_id || h.assessment_type)
    )

    if (priorAttempts.length === 0) return null

    const previousAttempt = priorAttempts[0]
    const currentScore = Math.round(results.score.percentage)
    const prevScore = Math.round(previousAttempt.score_percentage || 0)
    const scoreDelta = currentScore - prevScore

    return {
      previousAttempt,
      scoreDelta,
      isImprovement: scoreDelta > 0,
      isComparable: true,
    }
  }, [results, history])

  return {
    results,
    readiness,
    history,
    dailyPlan,
    comparison,
    isLoading,
    error,
    hasSecondaryError,
    refetch: loadData,
  }
}
