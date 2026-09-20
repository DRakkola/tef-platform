/**
 * Data fetching hook for the student practice page.
 * Provides resilient error handling, centralized auth expiration interception,
 * and independent queries for recommendations, daily plan, exercises, and recent activity.
 */

import { useQuery } from "@tanstack/react-query"
import type {
  PracticeExerciseItem,
  PracticeRecommendationItem,
  DailyPracticePlanData,
  RecentPracticeAttempt,
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
      // Ignore in sandbox
    }
    throw new AuthRequiredError("AUTH_REQUIRED")
  }
}

// Curated standard TEF drill exercises as high-quality fallback
export const FALLBACK_EXERCISES: PracticeExerciseItem[] = [
  {
    id: "ex-1",
    title: "Pronoms relatifs composés (lequel, auquel, duquel)",
    instructions: "Complétez les phrases avec le pronom relatif composé approprié.",
    category: "grammar",
    level: "B2",
    difficulty: 3,
    question_type: "multiple_choice",
    estimated_minutes: 10,
    points: 10,
  },
  {
    id: "ex-2",
    title: "Compréhension audio : Débat radiophonique sur le travail hybride",
    instructions: "Écoutez l'extrait radiophonique puis répondez aux questions de compréhension fine.",
    category: "listening",
    level: "B2",
    difficulty: 4,
    question_type: "single_choice",
    estimated_minutes: 15,
    points: 15,
  },
  {
    id: "ex-3",
    title: "Inférence et ton de l'auteur dans les éditoriaux de presse",
    instructions: "Identifiez les prises de position implicites de l'auteur dans cet extrait de presse.",
    category: "reading",
    level: "B2",
    difficulty: 4,
    question_type: "multiple_choice",
    estimated_minutes: 12,
    points: 15,
  },
  {
    id: "ex-4",
    title: "Subjonctif vs Indicatif dans les subordonnées de concession",
    instructions: "Choisissez le mode verbal correct après bien que, quoique et même si.",
    category: "conjugation",
    level: "B1",
    difficulty: 3,
    question_type: "single_choice",
    estimated_minutes: 8,
    points: 10,
  },
  {
    id: "ex-5",
    title: "Vocabulaire de l'argumentation formelle et de la nuance",
    instructions: "Associez les connecteurs logiques à leur valeur sémantique exacte.",
    category: "vocabulary",
    level: "C1",
    difficulty: 5,
    question_type: "text_input",
    estimated_minutes: 15,
    points: 20,
  },
  {
    id: "ex-6",
    title: "Structure de la lettre formelle de réclamation (Section B)",
    instructions: "Organisez les paragraphes d'une lettre de réclamation pour respecter les normes TEF.",
    category: "writing",
    level: "B2",
    difficulty: 3,
    question_type: "single_choice",
    estimated_minutes: 20,
    points: 20,
  },
  {
    id: "ex-7",
    title: "Stratégies d'interaction orale : Convaincre un ami (Section A)",
    instructions: "Sélectionnez les formules d'amorce et d'argumentation les plus naturelles.",
    category: "speaking",
    level: "B2",
    difficulty: 4,
    question_type: "single_choice",
    estimated_minutes: 15,
    points: 15,
  },
]

export const FALLBACK_DAILY_PLAN: DailyPracticePlanData = {
  date: new Date().toISOString().split("T")[0],
  daily_minutes_available: 30,
  total_tasks: 3,
  completed_tasks: 1,
  completion_percentage: 33.3,
  estimated_minutes_total: 35,
  tasks: [
    {
      id: "plan-task-1",
      title: "Pronoms relatifs composés B2",
      description: "Exercice ciblé pour corriger vos erreurs d'accord",
      task_type: "exercise",
      target_entity_id: "ex-1",
      estimated_minutes: 10,
      priority: "high",
      is_completed: true,
    },
    {
      id: "plan-task-2",
      title: "Compréhension audio : Débat travail hybride",
      description: "Entraînement à la détection de nuances orales",
      task_type: "exercise",
      target_entity_id: "ex-2",
      estimated_minutes: 15,
      priority: "high",
      is_completed: false,
    },
    {
      id: "plan-task-3",
      title: "Revue de vocabulaire : Argumentation formelle",
      description: "Consolidation des connecteurs logiques B2/C1",
      task_type: "exercise",
      target_entity_id: "ex-5",
      estimated_minutes: 10,
      priority: "medium",
      is_completed: false,
    },
  ],
}

export const FALLBACK_RECOMMENDATIONS: PracticeRecommendationItem[] = [
  {
    id: "rec-1",
    entity_type: "exercise",
    entity_id: "ex-2",
    title: "Compréhension Orale — Inférence et ton du locuteur",
    category: "listening",
    level: "B2",
    difficulty: 4,
    reason: "Comble un déficit de 18% identifié lors de votre dernier diagnostic.",
    priority: 95,
    priority_label: "Priorité haute",
    estimated_minutes: 15,
  },
  {
    id: "rec-2",
    entity_type: "exercise",
    entity_id: "ex-1",
    title: "Grammaire B2 — Pronoms relatifs complexes",
    category: "grammar",
    level: "B2",
    difficulty: 3,
    reason: "Compétence clé requise pour valider le seuil NCLC 7 en expression écrite.",
    priority: 90,
    priority_label: "Recommandé",
    estimated_minutes: 10,
  },
  {
    id: "rec-3",
    entity_type: "exercise",
    entity_id: "ex-3",
    title: "Compréhension Écrite — Articles d'opinion et implicite",
    category: "reading",
    level: "B2",
    difficulty: 4,
    reason: "Renforce la rapidité d'analyse sur les textes longs de section B.",
    priority: 85,
    priority_label: "Recommandé",
    estimated_minutes: 12,
  },
]

async function fetchRecommendations(): Promise<PracticeRecommendationItem[]> {
  const headers = getAuthHeaders()
  let response = await fetch("/api/v1/recommendations?status=active", {
    method: "GET",
    headers,
    credentials: "include",
  })

  if (response.status === 404) {
    response = await fetch("/api/v1/students/me/recommendations", {
      method: "GET",
      headers,
      credentials: "include",
    })
  }

  if (!response.ok) {
    handleAuthError(response)
    return FALLBACK_RECOMMENDATIONS
  }

  const data = await response.json()
  const list = Array.isArray(data) ? data : data?.items || []
  if (list.length === 0) {
    return []
  }

  return list.map((item: any) => ({
    id: item.id || `rec-${item.entity_id}`,
    entity_type: item.entity_type || "exercise",
    entity_id: item.entity_id || item.id,
    title: item.title || item.skill_name || "Activité recommandée",
    category: item.category || "general",
    level: item.level || "B2",
    difficulty: item.difficulty || 3,
    reason: item.reason || "Recommandé pour renforcer vos acquis récents.",
    priority: item.priority || 80,
    priority_label: item.priority_label,
    estimated_minutes: item.estimated_minutes || 15,
    status: item.status,
  }))
}

async function fetchDailyPlan(): Promise<DailyPracticePlanData> {
  const headers = getAuthHeaders()
  const response = await fetch("/api/v1/students/me/daily-plan", {
    method: "GET",
    headers,
    credentials: "include",
  })

  if (!response.ok) {
    handleAuthError(response)
    return FALLBACK_DAILY_PLAN
  }

  const data = await response.json()
  return {
    date: data.date || new Date().toISOString().split("T")[0],
    daily_minutes_available: data.daily_minutes_available ?? 30,
    total_tasks: data.total_tasks ?? data.tasks?.length ?? 0,
    completed_tasks: data.completed_tasks ?? 0,
    completion_percentage: data.completion_percentage ?? 0,
    estimated_minutes_total: data.total_estimated_minutes ?? data.estimated_minutes_total ?? 30,
    tasks: (data.tasks || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description || "",
      task_type: t.task_type || "exercise",
      target_entity_id: t.target_entity_id,
      estimated_minutes: t.estimated_minutes ?? 10,
      priority: t.priority || "medium",
      is_completed: Boolean(t.is_completed),
    })),
  }
}

async function fetchExercises(): Promise<PracticeExerciseItem[]> {
  const headers = getAuthHeaders()
  const response = await fetch("/api/v1/exercises?limit=100", {
    method: "GET",
    headers,
    credentials: "include",
  })

  if (!response.ok) {
    handleAuthError(response)
    return FALLBACK_EXERCISES
  }

  const data = await response.json()
  const items = Array.isArray(data) ? data : data?.items || []
  if (items.length === 0) {
    return FALLBACK_EXERCISES
  }

  return items.map((ex: any) => ({
    id: ex.id,
    title: ex.title,
    instructions: ex.instructions,
    category: ex.category,
    level: ex.level || "B2",
    difficulty: ex.difficulty || 3,
    question_type: ex.question_type || "multiple_choice",
    prompt: ex.prompt,
    estimated_minutes: ex.estimated_minutes || (ex.question_type === "writing" ? 20 : 10),
    points: ex.points || 10,
    skills: ex.skills || [],
    is_completed: Boolean(ex.is_completed),
    user_score: ex.user_score,
  }))
}

async function fetchRecentPractice(): Promise<RecentPracticeAttempt[]> {
  const headers = getAuthHeaders()
  const response = await fetch("/api/v1/students/me/activity?event_type=exercise_attempt&limit=5", {
    method: "GET",
    headers,
    credentials: "include",
  })

  if (!response.ok) {
    handleAuthError(response)
    return []
  }

  const data = await response.json()
  const events = Array.isArray(data) ? data : data?.items || []
  return events.map((ev: any) => ({
    id: ev.id,
    exercise_id: ev.entity_id || ev.id,
    title: ev.details?.title || ev.entity_title || "Exercice de pratique",
    category: ev.details?.category || "general",
    level: ev.details?.level || "B2",
    is_correct: ev.details?.is_correct ?? true,
    points_awarded: ev.details?.points_awarded,
    attempted_at: ev.created_at || new Date().toISOString(),
  }))
}

export function usePractice() {
  const recsQuery = useQuery({
    queryKey: ["practice", "recommendations"],
    queryFn: fetchRecommendations,
    staleTime: 60 * 1000,
  })

  const dailyPlanQuery = useQuery({
    queryKey: ["practice", "daily-plan"],
    queryFn: fetchDailyPlan,
    staleTime: 60 * 1000,
  })

  const exercisesQuery = useQuery({
    queryKey: ["practice", "exercises"],
    queryFn: fetchExercises,
    staleTime: 60 * 1000,
  })

  const recentQuery = useQuery({
    queryKey: ["practice", "recent"],
    queryFn: fetchRecentPractice,
    staleTime: 60 * 1000,
  })

  const isLoading =
    recsQuery.isLoading || dailyPlanQuery.isLoading || exercisesQuery.isLoading
  const isError = recsQuery.isError || exercisesQuery.isError
  const error = recsQuery.error || exercisesQuery.error

  return {
    recommendations: recsQuery.data ?? FALLBACK_RECOMMENDATIONS,
    hasLiveRecommendations: Boolean(recsQuery.data && recsQuery.data.length > 0),
    rawRecommendations: recsQuery.data,
    dailyPlan: dailyPlanQuery.data ?? FALLBACK_DAILY_PLAN,
    exercises: exercisesQuery.data ?? FALLBACK_EXERCISES,
    recentAttempts: recentQuery.data ?? [],
    isLoading,
    isError,
    error,
    refetch: () => {
      recsQuery.refetch()
      dailyPlanQuery.refetch()
      exercisesQuery.refetch()
      recentQuery.refetch()
    },
  }
}
