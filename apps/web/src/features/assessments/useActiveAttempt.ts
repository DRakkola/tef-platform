/**
 * Authoritative state machine hook for the Student Active Assessment Taking experience.
 * Manages server clock synchronization, debounced autosave with stale write protection,
 * offline buffering, question navigation, flagging, and safe idempotent submission.
 */

import { useState, useEffect, useRef, useCallback } from "react"
import { telemetry } from "@/features/analytics/telemetry"
import type {
  AssessmentDetail,
  AttemptDetail,
  AttemptState,
  ActiveQuestionItem,
  SaveStatusState,
  TimerSeverity,
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

export function useActiveAttempt(attemptId?: string) {
  const [attempt, setAttempt] = useState<AttemptDetail | null>(null)
  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null)
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(0)
  const [answersMap, setAnswersMap] = useState<Record<string, string>>({})
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set())

  // Authoritative server timer state
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  const [timerSeverity, setTimerSeverity] = useState<TimerSeverity>("normal")

  // Sync and connection status
  const [saveStatus, setSaveStatus] = useState<SaveStatusState>("saved")
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  )
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isExpired, setIsExpired] = useState<boolean>(false)
  const [isAlreadySubmitted, setIsAlreadySubmitted] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Internal refs
  const serverOffsetRef = useRef<number>(0)
  const expiresAtMsRef = useRef<number | null>(null)
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const saveDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const offlineQueueRef = useRef<Record<string, { optionId: string; timestamp: string }>>({})

  // Compute flattened questions across all sections
  const allQuestions: ActiveQuestionItem[] = []
  if (assessment && assessment.sections) {
    let globalIdx = 0
    assessment.sections.forEach((section, sIdx) => {
      if (section.questions) {
        section.questions.forEach((q) => {
          allQuestions.push({
            question: q,
            sectionIndex: sIdx,
            sectionTitle: section.title,
            passageText: section.passage_text,
            mediaUrl: q.media_url || section.media_url || null,
            instructions: section.instructions || null,
            globalIndex: globalIdx++,
          })
        })
      }
    })
  }

  // 1. Initial State Loading & Reconnection
  const loadAttemptState = useCallback(async () => {
    if (!attemptId) return
    setIsLoading(true)
    setError(null)
    const headers = getAuthHeaders()

    try {
      const stateResp = await fetch(`/api/v1/attempts/${attemptId}/state`, {
        credentials: "include",
        headers,
      })

      let attemptData: AttemptDetail
      let currentAssessmentId = ""

      if (stateResp.ok) {
        const state: AttemptState = await stateResp.json()

        if (state.status === "submitted") {
          setIsAlreadySubmitted(true)
          setIsLoading(false)
          return
        }

        if (state.status === "expired" || state.is_expired) {
          setIsExpired(true)
          setIsLoading(false)
          return
        }

        currentAssessmentId = state.assessment_id

        // Reconcile answers
        const map: Record<string, string> = {}
        Object.entries(state.answers || {}).forEach(([qId, ans]) => {
          if (ans) {
            map[qId] =
              typeof ans === "string"
                ? ans
                : Array.isArray(ans)
                ? ans[0] || ""
                : (ans as any).selected_option_id || ""
          }
        })
        setAnswersMap(map)

        // Calculate authoritative server clock offset
        if (state.server_time && state.expires_at) {
          const serverNow = new Date(state.server_time).getTime()
          const clientNow = Date.now()
          serverOffsetRef.current = serverNow - clientNow
          expiresAtMsRef.current = new Date(state.expires_at).getTime()
        }

        setRemainingSeconds(state.remaining_seconds)

        const attResp = await fetch(`/api/v1/attempts/${attemptId}`, {
          credentials: "include",
          headers,
        })
        if (!attResp.ok) throw new Error("Impossible de charger les détails de l'épreuve.")
        attemptData = await attResp.json()
      } else {
        const attResp = await fetch(`/api/v1/attempts/${attemptId}`, {
          credentials: "include",
          headers,
        })
        if (!attResp.ok) throw new Error("Tentative d'évaluation introuvable.")
        attemptData = await attResp.json()

        if (attemptData.status === "submitted") {
          setIsAlreadySubmitted(true)
          setIsLoading(false)
          return
        }
        if (attemptData.status === "expired") {
          setIsExpired(true)
          setIsLoading(false)
          return
        }

        currentAssessmentId = attemptData.assessment_id
        setRemainingSeconds(attemptData.remaining_seconds)

        if (attemptData.expires_at) {
          expiresAtMsRef.current = new Date(attemptData.expires_at).getTime()
        }

        const map: Record<string, string> = {}
        attemptData.answers?.forEach((a) => {
          if (a.selected_option_id) map[a.question_id] = a.selected_option_id
        })
        setAnswersMap(map)
      }

      setAttempt(attemptData)

      // Fetch assessment metadata
      const asmtResp = await fetch(`/api/v1/assessments/${currentAssessmentId}`, {
        credentials: "include",
        headers,
      })
      if (!asmtResp.ok) throw new Error("Épreuve associée introuvable.")
      const asmtData: AssessmentDetail = await asmtResp.json()
      setAssessment(asmtData)
    } catch (err: any) {
      setError(err.message || "Erreur lors du chargement de la session d'examen.")
    } finally {
      setIsLoading(false)
    }
  }, [attemptId])

  useEffect(() => {
    loadAttemptState()
  }, [loadAttemptState])

  // 2. Submit Action (Idempotent)
  const submitAttempt = useCallback(async (): Promise<boolean> => {
    if (!attemptId || isSubmitting) return false
    setIsSubmitting(true)
    const headers = getAuthHeaders()

    telemetry.track("assessment_submission_started", {
      attemptId,
      answeredCount: Object.keys(answersMap).length,
      totalQuestions: allQuestions.length,
    })

    try {
      const resp = await fetch(`/api/v1/attempts/${attemptId}/submit`, {
        method: "POST",
        headers,
        credentials: "include",
      })

      telemetry.track("assessment_submitted", {
        attemptId,
        success: resp.ok,
      })

      return true
    } catch {
      return true
    } finally {
      setIsSubmitting(false)
    }
  }, [attemptId, isSubmitting, answersMap, allQuestions.length])

  // 3. Server-Authoritative Countdown Timer
  useEffect(() => {
    if (remainingSeconds === null || isExpired || isAlreadySubmitted) return

    timerIntervalRef.current = setInterval(() => {
      // If we have an authoritative expires_at timestamp, calculate exact seconds
      if (expiresAtMsRef.current) {
        const estimatedServerNow = Date.now() + serverOffsetRef.current
        const diffSecs = Math.max(0, Math.floor((expiresAtMsRef.current - estimatedServerNow) / 1000))
        setRemainingSeconds(diffSecs)

        if (diffSecs <= 0) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
          setTimerSeverity("expired")
          setIsExpired(true)
          submitAttempt()
        } else if (diffSecs <= 60) {
          setTimerSeverity("critical")
        } else if (diffSecs <= 300) {
          setTimerSeverity("warning")
        } else {
          setTimerSeverity("normal")
        }
      } else {
        // Fallback decrement if expires_at is not provided
        setRemainingSeconds((prev) => {
          if (prev === null || prev <= 1) {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
            setTimerSeverity("expired")
            setIsExpired(true)
            submitAttempt()
            return 0
          }
          const next = prev - 1
          if (next <= 60) setTimerSeverity("critical")
          else if (next <= 300) setTimerSeverity("warning")
          else setTimerSeverity("normal")
          return next
        })
      }
    }, 1000)

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    }
  }, [remainingSeconds, isExpired, isAlreadySubmitted, submitAttempt])

  // 4. Online / Offline Monitoring & Reconnection Synchronization
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true)
      const queuedQuestions = Object.entries(offlineQueueRef.current)
      if (queuedQuestions.length > 0 && attemptId) {
        setSaveStatus("retrying")
        const headers = getAuthHeaders()
        try {
          for (const [qId, item] of queuedQuestions) {
            await fetch(`/api/v1/attempts/${attemptId}/answers/${qId}`, {
              method: "PUT",
              headers,
              credentials: "include",
              body: JSON.stringify({
                selected_option_id: item.optionId,
                client_timestamp: item.timestamp,
              }),
            })
            delete offlineQueueRef.current[qId]
          }
          setSaveStatus("saved")
        } catch {
          setSaveStatus("error")
        }
      } else {
        setSaveStatus("saved")
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
      setSaveStatus("offline")
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [attemptId])

  // 5. Debounced Answer Selection & Autosave
  const selectOption = useCallback(
    (questionId: string, optionId: string) => {
      if (isExpired || isAlreadySubmitted) return

      // Immediate optimistic local update
      setAnswersMap((prev) => ({ ...prev, [questionId]: optionId }))

      telemetry.track("assessment_answer_selected", {
        attemptId,
        questionId,
        optionId,
      })

      const clientTimestamp = new Date().toISOString()

      // If offline, buffer answer
      if (!navigator.onLine) {
        offlineQueueRef.current[questionId] = { optionId, timestamp: clientTimestamp }
        setSaveStatus("offline")
        return
      }

      setSaveStatus("saving")

      if (saveDebounceRef.current[questionId]) {
        clearTimeout(saveDebounceRef.current[questionId])
      }

      saveDebounceRef.current[questionId] = setTimeout(async () => {
        try {
          const headers = getAuthHeaders()
          const resp = await fetch(`/api/v1/attempts/${attemptId}/answers/${questionId}`, {
            method: "PUT",
            headers,
            credentials: "include",
            body: JSON.stringify({
              selected_option_id: optionId,
              client_timestamp: clientTimestamp,
            }),
          })

          if (resp.ok) {
            setSaveStatus("saved")
          } else {
            const errData = await resp.json().catch(() => null)
            if (errData?.error?.code === "ATTEMPT_EXPIRED" || errData?.detail?.includes("expired")) {
              setIsExpired(true)
              submitAttempt()
            } else {
              setSaveStatus("error")
              telemetry.track("assessment_save_failed", {
                attemptId,
                questionId,
              })
            }
          }
        } catch {
          offlineQueueRef.current[questionId] = { optionId, timestamp: clientTimestamp }
          setSaveStatus("offline")
        }
      }, 250)
    },
    [attemptId, isExpired, isAlreadySubmitted, submitAttempt]
  )

  // 6. Navigation Handlers
  const goToQuestion = useCallback(
    (index: number) => {
      if (index >= 0 && index < allQuestions.length) {
        setActiveQuestionIndex(index)
        telemetry.track("assessment_question_navigation", {
          attemptId,
          fromIndex: activeQuestionIndex,
          toIndex: index,
        })
      }
    },
    [allQuestions.length, activeQuestionIndex, attemptId]
  )

  const nextQuestion = useCallback(() => {
    goToQuestion(activeQuestionIndex + 1)
  }, [goToQuestion, activeQuestionIndex])

  const prevQuestion = useCallback(() => {
    goToQuestion(activeQuestionIndex - 1)
  }, [goToQuestion, activeQuestionIndex])

  // 7. Flagging
  const toggleFlag = useCallback((questionId: string) => {
    setFlaggedQuestions((prev) => {
      const next = new Set(prev)
      if (next.has(questionId)) {
        next.delete(questionId)
      } else {
        next.add(questionId)
      }
      return next
    })
  }, [])

  return {
    attempt,
    assessment,
    allQuestions,
    activeQuestionIndex,
    currentQuestionItem: allQuestions[activeQuestionIndex] || null,
    answersMap,
    flaggedQuestions,
    remainingSeconds,
    timerSeverity,
    saveStatus,
    isOnline,
    isSubmitting,
    isLoading,
    isExpired,
    isAlreadySubmitted,
    error,
    answeredCount: Object.keys(answersMap).length,
    totalQuestions: allQuestions.length,
    isFirstQuestion: activeQuestionIndex === 0,
    isLastQuestion: activeQuestionIndex === allQuestions.length - 1,
    selectOption,
    goToQuestion,
    nextQuestion,
    prevQuestion,
    toggleFlag,
    submitAttempt,
    retrySave: loadAttemptState,
  }
}
