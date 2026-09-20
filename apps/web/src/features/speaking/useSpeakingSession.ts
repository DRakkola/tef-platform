/**
 * Hook for managing speaking session lifecycle, server-authoritative timer,
 * and state transitions.
 */

import { useState, useEffect, useCallback, useRef } from "react"
import {
  getSpeakingSession,
  startSpeakingSession,
  completeSpeakingSession,
} from "./api"
import type {
  SpeakingEvaluation,
  SpeakingSessionDetail,
  SpeakingWorkspaceState,
} from "./types"

interface UseSpeakingSessionOptions {
  sessionId?: string
  onExpired?: () => void
}

export function useSpeakingSession({
  sessionId,
  onExpired,
}: UseSpeakingSessionOptions) {
  const [session, setSession] = useState<SpeakingSessionDetail | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState<number>(25 * 60)
  const [workspaceState, setWorkspaceState] = useState<SpeakingWorkspaceState>("preparing")
  const [evaluation, setEvaluation] = useState<SpeakingEvaluation | null>(null)
  const [currentPromptIndex, setCurrentPromptIndex] = useState<number>(0)

  const isCompletedRef = useRef<boolean>(false)

  // 1. Fetch Authoritative Session Data
  const loadSession = useCallback(async () => {
    if (!sessionId) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      const data = await getSpeakingSession(sessionId)
      setSession(data)

      if (data.evaluation) {
        setEvaluation(data.evaluation)
      }

      // Calculate authoritative remaining seconds
      if (data.remaining_seconds !== undefined && data.remaining_seconds !== null) {
        setRemainingSeconds(data.remaining_seconds)
      } else if (data.expires_at) {
        const exp = new Date(data.expires_at).getTime()
        const rem = Math.max(0, Math.floor((exp - Date.now()) / 1000))
        setRemainingSeconds(rem)
      } else {
        setRemainingSeconds(data.duration_minutes * 60)
      }

      // Sync workspace state
      if (data.status === "completed" || data.status === "expired") {
        setWorkspaceState("submitted")
        isCompletedRef.current = true
      } else if (data.status === "active") {
        setWorkspaceState("ready")
      } else {
        setWorkspaceState("preparing")
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Impossible de charger la session orale."
      setError(msg)
      setWorkspaceState("failed")
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    loadSession()
  }, [loadSession])

  // 2. Authoritative Server Countdown Clock
  useEffect(() => {
    if (!session || session.status !== "active" || isCompletedRef.current) return

    const updateTimer = () => {
      if (session.expires_at) {
        const exp = new Date(session.expires_at).getTime()
        const rem = Math.max(0, Math.floor((exp - Date.now()) / 1000))
        setRemainingSeconds(rem)

        if (rem <= 0 && !isCompletedRef.current) {
          isCompletedRef.current = true
          setWorkspaceState("ending")
          if (onExpired) onExpired()
          // Automatically finalize expired session
          if (sessionId) {
            completeSpeakingSession(sessionId)
              .then(() => {
                setSession((prev) => (prev ? { ...prev, status: "expired" } : null))
                setWorkspaceState("submitted")
              })
              .catch(() => {
                setWorkspaceState("submitted")
              })
          }
        }
      } else {
        setRemainingSeconds((prev) => {
          if (prev <= 1 && !isCompletedRef.current) {
            isCompletedRef.current = true
            setWorkspaceState("ending")
            if (onExpired) onExpired()
            if (sessionId) {
              completeSpeakingSession(sessionId)
                .then(() => setWorkspaceState("submitted"))
                .catch(() => setWorkspaceState("submitted"))
            }
            return 0
          }
          return prev - 1
        })
      }
    }

    const interval = setInterval(updateTimer, 1000)

    // Handle backgrounding drift
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        updateTimer()
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [session, sessionId, onExpired])

  // 3. Start Session & Activate Server Timer
  const startSession = useCallback(async () => {
    if (!sessionId) return
    try {
      setError(null)
      const updated = await startSpeakingSession(sessionId)
      setSession((prev) =>
        prev
          ? {
              ...prev,
              status: updated.status,
              starts_at: updated.starts_at,
              expires_at: updated.expires_at,
              remaining_seconds: updated.remaining_seconds,
            }
          : null
      )
      if (updated.expires_at) {
        const exp = new Date(updated.expires_at).getTime()
        setRemainingSeconds(Math.max(0, Math.floor((exp - Date.now()) / 1000)))
      }
      setWorkspaceState("ready")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Échec du démarrage de la session."
      setError(msg)
    }
  }, [sessionId])

  // 4. Complete Session
  const completeSession = useCallback(async () => {
    if (!sessionId || isCompletedRef.current) return
    isCompletedRef.current = true
    setWorkspaceState("ending")

    try {
      const updated = await completeSpeakingSession(sessionId)
      setSession((prev) => (prev ? { ...prev, status: updated.status } : null))

      // If AI session, reload to fetch newly generated evaluation
      const refreshed = await getSpeakingSession(sessionId)
      if (refreshed.evaluation) {
        setEvaluation(refreshed.evaluation)
      }
      setWorkspaceState("submitted")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de la finalisation."
      setError(msg)
      setWorkspaceState("submitted")
    }
  }, [sessionId])

  // 5. Prompt Navigation
  const nextPrompt = useCallback(() => {
    setCurrentPromptIndex((prev) => prev + 1)
  }, [])

  return {
    session,
    isLoading,
    error,
    remainingSeconds,
    workspaceState,
    evaluation,
    currentPromptIndex,
    setWorkspaceState,
    startSession,
    completeSession,
    nextPrompt,
    reload: loadSession,
  }
}
