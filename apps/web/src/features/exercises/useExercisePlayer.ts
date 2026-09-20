/**
 * useExercisePlayer Hook.
 * Centralized state management for the student exercise practice experience.
 * Manages fetching, answer submission, retry rules, refresh survival,
 * TanStack Query cache invalidation, and telemetry tracking.
 */

import { useState, useEffect, useCallback, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { telemetry } from "@/features/analytics/telemetry"
import type {
  ExerciseDetail,
  ExerciseAttemptResult,
  ExerciseState,
  NextRecommendedActivity,
} from "./types"

export interface UseExercisePlayerReturn {
  exercise: ExerciseDetail | null
  state: ExerciseState
  selectedOptionIndex: number | null
  selectedOptionIndices: number[]
  textResponse: string
  result: ExerciseAttemptResult | null
  pastAttempts: ExerciseAttemptResult[]
  recommendation: NextRecommendedActivity | null
  timeSpentSeconds: number
  error: string | null
  networkError: string | null
  isAnswered: boolean
  selectOption: (index: number) => void
  toggleOption: (index: number) => void
  setTextResponse: (text: string) => void
  submitAnswer: () => Promise<void>
  retrySubmission: () => Promise<void>
  retryQuestion: () => void
  completeExercise: () => Promise<void>
  restartExercise: () => void
  refetch: () => Promise<void>
}

export function useExercisePlayer(exerciseId: string | undefined): UseExercisePlayerReturn {
  const queryClient = useQueryClient()

  const [exercise, setExercise] = useState<ExerciseDetail | null>(null)
  const [state, setState] = useState<ExerciseState>("loading")
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null)
  const [selectedOptionIndices, setSelectedOptionIndices] = useState<number[]>([])
  const [textResponse, setTextResponse] = useState<string>("")
  const [result, setResult] = useState<ExerciseAttemptResult | null>(null)
  const [pastAttempts, setPastAttempts] = useState<ExerciseAttemptResult[]>([])
  const [recommendation, setRecommendation] = useState<NextRecommendedActivity | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [networkError, setNetworkError] = useState<string | null>(null)
  const [timeSpentSeconds, setTimeSpentSeconds] = useState<number>(0)

  const startTimeRef = useRef<number>(Date.now())
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const storageKey = exerciseId ? `tef_exercise_attempt_${exerciseId}` : null

  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
  const authHeaders = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  // 1. Fetch Exercise Data & Past Attempts
  const loadExercise = useCallback(async () => {
    if (!exerciseId) return

    setState("loading")
    setError(null)
    setNetworkError(null)

    try {
      // Primary: Fetch exercise definition
      const resp = await fetch(`/api/v1/exercises/${exerciseId}`, {
        credentials: "include",
        headers: authHeaders,
      })

      if (!resp.ok) {
        if (resp.status === 404) {
          throw new Error("Cet exercice n'est plus disponible.")
        }
        throw new Error("Impossible de charger cet exercice.")
      }

      const exData: ExerciseDetail = await resp.json()
      setExercise(exData)

      // Telemetry: Exercise viewed & started
      telemetry.track("exercise_viewed", {
        exercise_id: exData.id,
        category: exData.category,
        level: exData.level,
      })
      telemetry.track("exercise_started", {
        exercise_id: exData.id,
        category: exData.category,
      })

      // Secondary: Check for past attempts (graceful failure)
      try {
        const attResp = await fetch(`/api/v1/exercises/${exerciseId}/attempts`, {
          credentials: "include",
          headers: authHeaders,
        })
        if (attResp.ok) {
          const attempts: ExerciseAttemptResult[] = await attResp.json()
          setPastAttempts(attempts)
        }
      } catch {
        // Silently ignore secondary attempts history failure
      }

      // Check SessionStorage for refresh recovery
      if (storageKey) {
        const saved = sessionStorage.getItem(storageKey)
        if (saved) {
          try {
            const parsed = JSON.parse(saved)
            if (parsed.selectedOptionIndex !== undefined) setSelectedOptionIndex(parsed.selectedOptionIndex)
            if (parsed.textResponse !== undefined) setTextResponse(parsed.textResponse)
            if (parsed.result) setResult(parsed.result)
            if (parsed.state && parsed.state !== "loading") {
              setState(parsed.state)
              return
            }
          } catch {
            // Ignore corrupted session storage
          }
        }
      }

      setState("ready")
      startTimeRef.current = Date.now()
    } catch (err: any) {
      setError(err.message || "Impossible de charger cet exercice.")
      setState("error")
    }
  }, [exerciseId, storageKey])

  useEffect(() => {
    loadExercise()
  }, [loadExercise])

  // Timer effect to track practice duration
  useEffect(() => {
    if (state === "ready" || state === "feedback") {
      timerIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
        setTimeSpentSeconds(elapsed)
      }, 1000)
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
    }
  }, [state])

  // Sync state to sessionStorage for refresh survival
  useEffect(() => {
    if (!storageKey || state === "loading" || state === "error") return
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          selectedOptionIndex,
          selectedOptionIndices,
          textResponse,
          result,
          state,
        })
      )
    } catch {
      // Ignore quota errors
    }
  }, [storageKey, selectedOptionIndex, selectedOptionIndices, textResponse, result, state])

  // Option selection handlers
  const selectOption = useCallback((index: number) => {
    setSelectedOptionIndex(index)
  }, [])

  const toggleOption = useCallback((index: number) => {
    setSelectedOptionIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    )
  }, [])

  const isAnswered =
    exercise?.question_type === "text_input"
      ? textResponse.trim().length > 0
      : exercise?.question_type === "multiple_choice"
      ? selectedOptionIndices.length > 0
      : selectedOptionIndex !== null

  // 2. Submit Answer
  const submitAnswer = useCallback(async () => {
    if (!exercise || !isAnswered || state === "submitting") return

    setState("submitting")
    setNetworkError(null)

    // Construct submission payload
    const payload: { selected_option_index?: number; user_response?: string } = {}
    if (exercise.question_type === "text_input") {
      payload.user_response = textResponse.trim()
    } else {
      payload.selected_option_index = selectedOptionIndex ?? undefined
      if (selectedOptionIndex !== null && exercise.options[selectedOptionIndex]) {
        payload.user_response = exercise.options[selectedOptionIndex].content
      }
    }

    try {
      const resp = await fetch(`/api/v1/exercises/${exercise.id}/attempts`, {
        method: "POST",
        headers: authHeaders,
        credentials: "include",
        body: JSON.stringify(payload),
      })

      if (!resp.ok) {
        throw new Error("Votre réponse n'a pas pu être enregistrée.")
      }

      const attemptResult: ExerciseAttemptResult = await resp.json()
      setResult(attemptResult)
      setState("feedback")

      // Telemetry
      telemetry.track("exercise_answer_checked", {
        exercise_id: exercise.id,
        is_correct: attemptResult.is_correct,
        points: attemptResult.points_awarded,
      })

      if (attemptResult.is_correct) {
        telemetry.track("exercise_correct", {
          exercise_id: exercise.id,
          points: attemptResult.points_awarded,
        })
      } else {
        telemetry.track("exercise_incorrect", {
          exercise_id: exercise.id,
        })
      }
    } catch (err: any) {
      // On network or server error: retain answer, enter network_error state
      setNetworkError(err.message || "Votre réponse n'a pas pu être enregistrée.")
      setState("network_error")
    }
  }, [exercise, isAnswered, state, selectedOptionIndex, textResponse])

  // 3. Retry Submission (on network failure)
  const retrySubmission = useCallback(async () => {
    await submitAnswer()
  }, [submitAnswer])

  // 4. Retry Question (re-attempt after incorrect answer)
  const retryQuestion = useCallback(() => {
    if (!exercise) return
    setSelectedOptionIndex(null)
    setSelectedOptionIndices([])
    setTextResponse("")
    setResult(null)
    setNetworkError(null)
    setState("ready")

    telemetry.track("exercise_retry", {
      exercise_id: exercise.id,
    })
  }, [exercise])

  // 5. Complete Exercise
  const completeExercise = useCallback(async () => {
    if (!exercise) return

    setState("completed")

    // Invalidate TanStack query caches
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["readiness"] }),
      queryClient.invalidateQueries({ queryKey: ["skills"] }),
      queryClient.invalidateQueries({ queryKey: ["recommendations"] }),
      queryClient.invalidateQueries({ queryKey: ["daily-plan"] }),
      queryClient.invalidateQueries({ queryKey: ["recent-activity"] }),
    ])

    telemetry.track("exercise_completed", {
      exercise_id: exercise.id,
      score: result?.points_awarded || 0,
      is_correct: result?.is_correct || false,
      duration_seconds: timeSpentSeconds,
    })

    // Fetch active next recommendation
    try {
      let recResp = await fetch("/api/v1/recommendations?status=active", {
        credentials: "include",
        headers: authHeaders,
      })
      if (!recResp.ok) {
        recResp = await fetch("/api/v1/students/me/recommendations", {
          credentials: "include",
          headers: authHeaders,
        })
      }

      if (recResp.ok) {
        const recData = await recResp.json()
        const recList = Array.isArray(recData) ? recData : recData.items || []
        if (recList.length > 0) {
          const topRec = recList[0]
          setRecommendation({
            id: topRec.id,
            title: topRec.title || "Activité recommandée",
            category: topRec.category || exercise.category,
            level: topRec.level || exercise.level,
            duration_minutes: topRec.difficulty ? topRec.difficulty * 5 : 10,
            reason: topRec.reason || "Recommandé pour consolider vos acquis récents.",
            entity_id: topRec.entity_id || topRec.id,
            entity_type: topRec.entity_type,
          })
        }
      }
    } catch {
      // Graceful degradation: exercise completion remains valid even if recommendation lookup fails
    }
  }, [exercise, result, timeSpentSeconds, queryClient])

  // 6. Restart Exercise (clears session and resets)
  const restartExercise = useCallback(() => {
    if (storageKey) {
      sessionStorage.removeItem(storageKey)
    }
    setSelectedOptionIndex(null)
    setSelectedOptionIndices([])
    setTextResponse("")
    setResult(null)
    setRecommendation(null)
    setNetworkError(null)
    setError(null)
    setState("ready")
    startTimeRef.current = Date.now()
    setTimeSpentSeconds(0)
  }, [storageKey])

  return {
    exercise,
    state,
    selectedOptionIndex,
    selectedOptionIndices,
    textResponse,
    result,
    pastAttempts,
    recommendation,
    timeSpentSeconds,
    error,
    networkError,
    isAnswered,
    selectOption,
    toggleOption,
    setTextResponse,
    submitAnswer,
    retrySubmission,
    retryQuestion,
    completeExercise,
    restartExercise,
    refetch: loadExercise,
  }
}
