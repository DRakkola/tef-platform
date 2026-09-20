/**
 * Data fetching hook for the Student Assessment Library.
 * Features decoupled queries for published assessments, recommendations,
 * active in-progress attempts, and historical results with resilient error handling.
 */

import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { telemetry } from "@/features/analytics/telemetry"
import type {
  AssessmentListItem,
  AssessmentRecommendation,
  ActiveAttemptSummary,
  AssessmentHistoryItem,
} from "./types"

export class AuthRequiredError extends Error {
  constructor(message = "Votre session a expiré ou une authentification est requise.") {
    super(message)
    this.name = "AuthRequiredError"
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
      // Ignore in test sandbox
    }
    throw new AuthRequiredError("AUTH_REQUIRED")
  }
}

export const FALLBACK_ASSESSMENTS: AssessmentListItem[] = [
  {
    id: "asmt-tef-full",
    title: "TEF Canada — Épreuve Complète Blanc 1",
    description: "Simulation officielle intégrale (Compréhension écrite et Compréhension orale) en conditions réelles chronométrées.",
    assessment_type: "mixed",
    duration_seconds: 4500,
    estimated_completion_time_minutes: 75,
    level: "B2",
    navigation_policy: "free",
    scoring_policy: "tef_clb",
    section_count: 2,
    question_count: 60,
    total_points: 60,
  },
  {
    id: "asmt-ce-b2",
    title: "Compréhension Écrite — Session Complète B2",
    description: "40 questions de repérage, analyse textuelle, inférence et logique éditoriale sous chronomètre strict.",
    assessment_type: "reading",
    duration_seconds: 3600,
    estimated_completion_time_minutes: 60,
    level: "B2",
    navigation_policy: "free",
    scoring_policy: "tef_clb",
    section_count: 1,
    question_count: 40,
    total_points: 40,
  },
  {
    id: "asmt-co-b2",
    title: "Compréhension Orale — Session Complète B2",
    description: "60 documents audio authentiques (annonces, dialogues, chroniques de Radio-Canada) avec écoute unique verrouillée.",
    assessment_type: "listening",
    duration_seconds: 2400,
    estimated_completion_time_minutes: 40,
    level: "B2",
    navigation_policy: "linear_locked",
    scoring_policy: "tef_clb",
    section_count: 1,
    question_count: 60,
    total_points: 60,
  },
]

async function fetchAssessmentList(): Promise<AssessmentListItem[]> {
  const headers = getAuthHeaders()
  const response = await fetch("/api/v1/assessments?page_size=50", {
    method: "GET",
    headers,
    credentials: "include",
  })

  if (!response.ok) {
    handleAuthError(response)
    return FALLBACK_ASSESSMENTS
  }

  const data = await response.json()
  const items = Array.isArray(data) ? data : data?.items || []
  if (items.length === 0) {
    return FALLBACK_ASSESSMENTS
  }
  return items
}

async function fetchRecommendation(_assessments: AssessmentListItem[]): Promise<AssessmentRecommendation | null> {
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
    // Ensure items are valid history attempt objects (must have assessment_id and status)
    return rawItems.filter((i: any) => i && i.assessment_id && i.status)
  } catch {
    return []
  }
}

export function useAssessmentLibrary() {
  // 1. Published Assessments Catalog
  const assessmentsQuery = useQuery({
    queryKey: ["assessments", "list"],
    queryFn: fetchAssessmentList,
    staleTime: 60 * 1000,
  })

  // 2. Active in-progress attempt
  const activeAttemptQuery = useQuery({
    queryKey: ["assessments", "active-attempt"],
    queryFn: fetchActiveAttempt,
    staleTime: 15 * 1000, // Check slightly more often for resumed state
  })

  // 3. Recommended assessment
  const recommendationQuery = useQuery({
    queryKey: ["assessments", "recommendation"],
    queryFn: () => fetchRecommendation(assessmentsQuery.data || FALLBACK_ASSESSMENTS),
    staleTime: 60 * 1000,
  })

  // 4. Past Assessment History
  const historyQuery = useQuery({
    queryKey: ["assessments", "history"],
    queryFn: fetchHistory,
    staleTime: 30 * 1000,
  })

  // Telemetry: Record library view on mount
  useEffect(() => {
    telemetry.track("assessment_library_viewed", {
      timestamp: new Date().toISOString(),
    })
  }, [])

  const isLoading = assessmentsQuery.isLoading
  const error = assessmentsQuery.error || activeAttemptQuery.error || historyQuery.error

  return {
    assessments: assessmentsQuery.data ?? FALLBACK_ASSESSMENTS,
    recommendation: recommendationQuery.data,
    activeAttempt: activeAttemptQuery.data,
    history: historyQuery.data ?? [],
    isLoading,
    isHistoryLoading: historyQuery.isLoading,
    isRecommendationLoading: recommendationQuery.isLoading,
    isError: assessmentsQuery.isError,
    error,
    refetch: () => {
      assessmentsQuery.refetch()
      activeAttemptQuery.refetch()
      recommendationQuery.refetch()
      historyQuery.refetch()
    },
    refetchActiveAttempt: () => activeAttemptQuery.refetch(),
  }
}
