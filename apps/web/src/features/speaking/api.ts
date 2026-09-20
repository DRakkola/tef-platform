/**
 * API client methods for Speaking sessions, signaling, and evaluations.
 */

import { apiClient } from "@/core/api"
import type {
  CreateSpeakingSessionPayload,
  SpeakingEvaluation,
  SpeakingSession,
  SpeakingSessionDetail,
  SpeakingSessionListResponse,
} from "./types"

export async function createSpeakingSession(
  payload: CreateSpeakingSessionPayload
): Promise<SpeakingSession> {
  return apiClient<SpeakingSession>("/speaking/sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function getSpeakingSession(sessionId: string): Promise<SpeakingSessionDetail> {
  return apiClient<SpeakingSessionDetail>(`/speaking/sessions/${sessionId}`)
}

export async function startSpeakingSession(sessionId: string): Promise<SpeakingSession> {
  return apiClient<SpeakingSession>(`/speaking/sessions/${sessionId}/start`, {
    method: "POST",
  })
}

export async function completeSpeakingSession(sessionId: string): Promise<SpeakingSession> {
  return apiClient<SpeakingSession>(`/speaking/sessions/${sessionId}/complete`, {
    method: "POST",
  })
}

export async function cancelSpeakingSession(sessionId: string): Promise<SpeakingSession> {
  return apiClient<SpeakingSession>(`/speaking/sessions/${sessionId}/cancel`, {
    method: "POST",
  })
}

export async function getSpeakingEvaluation(sessionId: string): Promise<SpeakingEvaluation> {
  return apiClient<SpeakingEvaluation>(`/speaking/sessions/${sessionId}/evaluation`)
}

export async function listSpeakingSessions(): Promise<SpeakingSessionListResponse> {
  return apiClient<SpeakingSessionListResponse>("/speaking/sessions")
}
