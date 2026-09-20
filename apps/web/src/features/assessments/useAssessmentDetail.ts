/**
 * Data fetching and action hook for the Student Assessment Details page.
 * Manages assessment metadata, authoritative active attempt detection,
 * historical attempt resolution, and attempt initialization with auth handling.
 */

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { telemetry } from "@/features/analytics/telemetry"
import type {
  AssessmentDetail,
  ActiveAttemptSummary,
  AssessmentHistoryItem,
  AssessmentRecommendation,
  AttemptDetail,
} from "./types"
import { AuthRequiredError } from "./useAssessmentLibrary"
export { AuthRequiredError }

export class AssessmentNotFoundError extends Error {
  constructor(message = "Cette évaluation n'est plus disponible ou est introuvable.") {
    super(message)
    this.name = "AssessmentNotFoundError"
  }
}

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }
  return headers
}

function handleAuthError(response: Response) {
  if (response.status === 401) {
    try {
      localStorage.removeItem("auth_token")
    } catch {
      // Ignore sandbox errors
    }
    throw new AuthRequiredError("AUTH_REQUIRED")
  }
}

async function fetchAssessmentDetail(assessmentId: string): Promise<AssessmentDetail> {
  const headers = getAuthHeaders()
  const response = await fetch(`/api/v1/assessments/${assessmentId}`, {
    method: "GET",
    headers,
    credentials: "include",
  })

  if (!response.ok) {
    handleAuthError(response)
    if (response.status === 404) {
      throw new AssessmentNotFoundError()
    }
    throw new Error("Impossible de charger les détails de cette épreuve.")
  }

  return response.json()
}

async function fetchActiveAttempt(): Promise<ActiveAttemptSummary | null> {
  const headers = getAuthHeaders()
  const response = await fetch("/api/v1/assessments/me/active-attempt", {
    method: "GET",
    headers,
    credentials: "include",
  })

  if (!response.ok) {
    handleAuthError(response)
    return null
  }

  const text = await response.text()
  if (!text || text.trim() === "null") return null
  try {
    const data = JSON.parse(text)
    if (!data || !data.assessment_id || typeof data.remaining_seconds !== "number") return null
    return data
  } catch {
    return null
  }
}

async function fetchHistory(): Promise<AssessmentHistoryItem[]> {
  const headers = getAuthHeaders()
  const response = await fetch("/api/v1/assessments/me/history?limit=20", {
    method: "GET",
    headers,
    credentials: "include",
  })

  if (!response.ok) {
    handleAuthError(response)
    return []
  }

  try {
    const data = await response.json()
    const rawItems = Array.isArray(data) ? data : data?.items || []
    return rawItems.filter((i: any) => i && i.assessment_id && i.status)
  } catch {
    return []
  }
}

async function fetchRecommendation(): Promise<AssessmentRecommendation | null> {
  const headers = getAuthHeaders()
  const response = await fetch("/api/v1/assessments/me/recommendation", {
    method: "GET",
    headers,
    credentials: "include",
  })

  if (!response.ok) {
    handleAuthError(response)
    return null
  }

  try {
    const data = await response.json()
    if (!data || !data.assessment_id || !data.title) return null
    return data
  } catch {
    return null
  }
}

export function useAssessmentDetail(assessmentId?: string) {
  const [isStarting, setIsStarting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // 1. Assessment metadata
  const assessmentQuery = useQuery({
    queryKey: ["assessments", "detail", assessmentId],
    queryFn: () => fetchAssessmentDetail(assessmentId!),
    enabled: Boolean(assessmentId),
    staleTime: 60 * 1000,
  })

  // 2. Active in-progress attempt
  const activeAttemptQuery = useQuery({
    queryKey: ["assessments", "active-attempt"],
    queryFn: fetchActiveAttempt,
    staleTime: 10 * 1000,
  })

  // 3. Historical attempts
  const historyQuery = useQuery({
    queryKey: ["assessments", "history"],
    queryFn: fetchHistory,
    staleTime: 30 * 1000,
  })

  // 4. Recommendation
  const recommendationQuery = useQuery({
    queryKey: ["assessments", "recommendation"],
    queryFn: fetchRecommendation,
    staleTime: 60 * 1000,
  })

  // Track details viewed
  useEffect(() => {
    if (assessmentQuery.data) {
      telemetry.track("assessment_details_viewed", {
        assessmentId: assessmentQuery.data.id,
        title: assessmentQuery.data.title,
        assessmentType: assessmentQuery.data.assessment_type,
        level: assessmentQuery.data.level,
      })
    }
  }, [assessmentQuery.data])

  // Derive contextual relationships
  const assessment = assessmentQuery.data || null
  const activeAttempt = activeAttemptQuery.data || null
  const isActiveOnThisTest = Boolean(
    activeAttempt && assessmentId && activeAttempt.assessment_id === assessmentId
  )

  const history = historyQuery.data || []
  const lastAttempt = history.find((h) => h.assessment_id === assessmentId)

  const rawRecommendation = recommendationQuery.data || null
  const recommendationForThisTest =
    rawRecommendation && rawRecommendation.assessment_id === assessmentId
      ? rawRecommendation
      : null

  const totalQuestions =
    assessment?.sections?.reduce((sum, s) => sum + (s.questions?.length || 0), 0) || 0

  // Start / initialize attempt API call
  const startAttempt = async (): Promise<AttemptDetail> => {
    if (!assessmentId) {
      throw new Error("Identifiant d'épreuve manquant.")
    }
    setIsStarting(true)
    setActionError(null)

    telemetry.track("assessment_start_clicked", {
      assessmentId,
      title: assessment?.title,
    })

    try {
      const headers = getAuthHeaders()
      const response = await fetch(`/api/v1/assessments/${assessmentId}/attempts`, {
        method: "POST",
        headers,
        credentials: "include",
      })

      if (!response.ok) {
        handleAuthError(response)
        const errData = await response.json().catch(() => null)
        const message =
          errData?.detail ||
          errData?.error?.message ||
          "Impossible d'initialiser la session d'examen."
        throw new Error(message)
      }

      const attempt: AttemptDetail = await response.json()
      telemetry.track("assessment_start_confirmed", {
        assessmentId,
        attemptId: attempt.id,
      })
      return attempt
    } catch (err: any) {
      setActionError(err.message || "Erreur lors du démarrage.")
      throw err
    } finally {
      setIsStarting(false)
    }
  }

  return {
    assessment,
    activeAttempt,
    isActiveOnThisTest,
    lastAttempt,
    recommendation: recommendationForThisTest,
    totalQuestions,
    isLoading: assessmentQuery.isLoading,
    isStarting,
    actionError,
    isNotFoundError:
      assessmentQuery.error instanceof AssessmentNotFoundError ||
      (assessmentQuery.error as any)?.name === "AssessmentNotFoundError",
    isAuthError:
      assessmentQuery.error instanceof AuthRequiredError ||
      (assessmentQuery.error as any)?.name === "AuthRequiredError" ||
      (assessmentQuery.error as any)?.message === "AUTH_REQUIRED",
    error: assessmentQuery.error || actionError,
    refetch: () => {
      assessmentQuery.refetch()
      activeAttemptQuery.refetch()
      historyQuery.refetch()
    },
    startAttempt,
  }
}
