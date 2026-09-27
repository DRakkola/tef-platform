/**
 * Hook for orchestrating structured TEF Speaking Exam state transitions,
 * section timers, and turn lifecycle.
 */

import { useState, useEffect, useCallback, useRef } from "react"
import {
  getSpeakingExam,
  getSpeakingExamState,
  startSpeakingExam,
  startSpeakingSection,
  completeSpeakingSection,
  listSpeakingSectionTurns,
  createSpeakingSectionTurn,
} from "./api"
import type {
  ExamSectionType,
  SpeakingExam,
  SpeakingSection,
  SpeakingTurn,
  SpeakingTurnCreatePayload,
} from "./types"

interface UseSpeakingExamOptions {
  examId?: string
  sessionId?: string
  onExamCompleted?: () => void
}

export function useSpeakingExam({
  examId,
  sessionId: _sessionId,
  onExamCompleted,
}: UseSpeakingExamOptions) {
  const [exam, setExam] = useState<SpeakingExam | null>(null)
  const [activeSection, setActiveSection] = useState<SpeakingSection | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState<number>(600)
  const [prepRemainingSeconds, setPrepRemainingSeconds] = useState<number | null>(null)
  const [turns, setTurns] = useState<SpeakingTurn[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const isCompletedRef = useRef<boolean>(false)

  // 1. Load Exam Details
  const loadExam = useCallback(async () => {
    if (!examId) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      const data = await getSpeakingExam(examId)
      setExam(data)

      // Determine active section
      const activeType = data.active_section || "section_a"
      const section = data.sections.find((s) => s.section_type === activeType) || data.sections[0] || null
      setActiveSection(section)

      if (section?.remaining_seconds !== undefined && section.remaining_seconds !== null) {
        setRemainingSeconds(section.remaining_seconds)
      } else if (section?.target_duration_seconds) {
        setRemainingSeconds(section.target_duration_seconds)
      }

      if (data.state === "completed" || data.state === "evaluated") {
        isCompletedRef.current = true
        if (onExamCompleted) onExamCompleted()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Impossible de charger l'épreuve orale."
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [examId, onExamCompleted])

  useEffect(() => {
    loadExam()
  }, [loadExam])

  // 2. Poll or Sync Exam State Clock
  useEffect(() => {
    if (!exam || isCompletedRef.current) return

    const updateClock = () => {
      if (exam.state === "section_b_preparing") {
        setPrepRemainingSeconds((prev) => {
          if (prev === null) return 60
          return Math.max(0, prev - 1)
        })
        return
      }

      if (activeSection?.expires_at) {
        const exp = new Date(activeSection.expires_at).getTime()
        const rem = Math.max(0, Math.floor((exp - Date.now()) / 1000))
        setRemainingSeconds(rem)

        if (rem <= 0 && activeSection.state === "active") {
          // Section expired on client clock, trigger refresh from server
          if (examId) {
            getSpeakingExamState(examId).then((stateResp) => {
              if (stateResp.state !== exam.state) {
                loadExam()
              }
            }).catch(() => {})
          }
        }
      } else if (activeSection?.state === "active") {
        setRemainingSeconds((prev) => Math.max(0, prev - 1))
      }
    }

    const interval = setInterval(updateClock, 1000)
    return () => clearInterval(interval)
  }, [exam, activeSection, examId, loadExam])

  // 3. Start Exam (Activates Section A)
  const start = useCallback(async () => {
    if (!examId) return
    try {
      setError(null)
      const updated = await startSpeakingExam(examId)
      setExam(updated)
      const secA = updated.sections.find((s) => s.section_type === "section_a") || null
      setActiveSection(secA)
      if (secA?.remaining_seconds) {
        setRemainingSeconds(secA.remaining_seconds)
      } else {
        setRemainingSeconds(600)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors du démarrage de l'épreuve."
      setError(msg)
    }
  }, [examId])

  // 4. Complete Section (Section A -> Section B Prep, or Section B -> Completed)
  const completeSection = useCallback(
    async (sectionType: ExamSectionType) => {
      if (!examId) return
      try {
        setError(null)
        const updated = await completeSpeakingSection(examId, sectionType)
        setExam(updated)

        if (updated.state === "section_b_preparing") {
          setPrepRemainingSeconds(60)
          const secB = updated.sections.find((s) => s.section_type === "section_b") || null
          setActiveSection(secB)
        } else if (updated.state === "completed" || updated.state === "evaluated") {
          isCompletedRef.current = true
          if (onExamCompleted) onExamCompleted()
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erreur lors du passage à la section suivante."
        setError(msg)
      }
    },
    [examId, onExamCompleted]
  )

  // 5. Start Section B
  const startSectionB = useCallback(async () => {
    if (!examId) return
    try {
      setError(null)
      setPrepRemainingSeconds(null)
      const updated = await startSpeakingSection(examId, "section_b")
      setExam(updated)
      const secB = updated.sections.find((s) => s.section_type === "section_b") || null
      setActiveSection(secB)
      if (secB?.remaining_seconds) {
        setRemainingSeconds(secB.remaining_seconds)
      } else {
        setRemainingSeconds(900)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors du démarrage de la Section B."
      setError(msg)
    }
  }, [examId])

  // 6. Record Conversational Turn
  const recordTurn = useCallback(
    async (payload: SpeakingTurnCreatePayload) => {
      if (!examId || !activeSection) return
      try {
        const newTurn = await createSpeakingSectionTurn(
          examId,
          activeSection.section_type,
          payload
        )
        setTurns((prev) => [...prev, newTurn])
      } catch (err: unknown) {
        console.warn("Could not record speaking turn:", err)
      }
    },
    [examId, activeSection]
  )

  // 7. Load Turns
  const loadTurns = useCallback(
    async (sectionType: ExamSectionType) => {
      if (!examId) return
      try {
        const turnList = await listSpeakingSectionTurns(examId, sectionType)
        setTurns(turnList)
      } catch (err: unknown) {
        console.warn("Could not load turns:", err)
      }
    },
    [examId]
  )

  return {
    exam,
    activeSection,
    remainingSeconds,
    prepRemainingSeconds,
    turns,
    isLoading,
    error,
    start,
    completeSection,
    startSectionB,
    recordTurn,
    loadTurns,
    reload: loadExam,
  }
}
