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

// --- Speaking Exam API Methods ---

export async function createSpeakingExam(
  payload: import("./types").SpeakingExamCreatePayload
): Promise<import("./types").SpeakingExam> {
  return apiClient<import("./types").SpeakingExam>("/speaking/exams", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function getSpeakingExam(examId: string): Promise<import("./types").SpeakingExam> {
  return apiClient<import("./types").SpeakingExam>(`/speaking/exams/${examId}`)
}

export async function getSpeakingExamState(
  examId: string
): Promise<import("./types").SpeakingExamStateResponse> {
  return apiClient<import("./types").SpeakingExamStateResponse>(`/speaking/exams/${examId}/state`)
}

export async function startSpeakingExam(examId: string): Promise<import("./types").SpeakingExam> {
  return apiClient<import("./types").SpeakingExam>(`/speaking/exams/${examId}/start`, {
    method: "POST",
  })
}

export async function startSpeakingSection(
  examId: string,
  sectionType: import("./types").ExamSectionType
): Promise<import("./types").SpeakingExam> {
  return apiClient<import("./types").SpeakingExam>(
    `/speaking/exams/${examId}/sections/${sectionType}/start`,
    {
      method: "POST",
    }
  )
}

export async function completeSpeakingSection(
  examId: string,
  sectionType: import("./types").ExamSectionType
): Promise<import("./types").SpeakingExam> {
  return apiClient<import("./types").SpeakingExam>(
    `/speaking/exams/${examId}/sections/${sectionType}/complete`,
    {
      method: "POST",
    }
  )
}

export async function listSpeakingSectionTurns(
  examId: string,
  sectionType: import("./types").ExamSectionType
): Promise<import("./types").SpeakingTurn[]> {
  return apiClient<import("./types").SpeakingTurn[]>(
    `/speaking/exams/${examId}/sections/${sectionType}/turns`
  )
}

export async function createSpeakingSectionTurn(
  examId: string,
  sectionType: import("./types").ExamSectionType,
  payload: import("./types").SpeakingTurnCreatePayload
): Promise<import("./types").SpeakingTurn> {
  return apiClient<import("./types").SpeakingTurn>(
    `/speaking/exams/${examId}/sections/${sectionType}/turns`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  )
}

export async function listSpeakingExams(
  page: number = 1,
  pageSize: number = 20
): Promise<{ items: import("./types").SpeakingExam[]; total: number }> {
  return apiClient<{ items: import("./types").SpeakingExam[]; total: number }>(
    `/speaking/exams?page=${page}&page_size=${pageSize}`
  )
}
