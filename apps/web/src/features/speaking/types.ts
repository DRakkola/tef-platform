/**
 * Types for speaking sessions, participants, WebRTC signaling, and evaluations.
 */

export type SpeakingSessionType = "ai" | "teacher"

export type SpeakingSessionState =
  | "scheduled"
  | "waiting"
  | "active"
  | "completed"
  | "expired"
  | "cancelled"

export type SpeakingParticipantRole = "student" | "teacher" | "ai_assistant"

export type SpeakingEvaluatorType = "ai" | "teacher" | "mock"

export interface SpeakingParticipant {
  id: string
  user_id?: string | null
  role: SpeakingParticipantRole
  display_name: string
  is_connected: boolean
  joined_at?: string | null
}

export interface SpeakingEvaluationSkill {
  skill_id: string
  score: number
  notes?: string | null
}

export interface SpeakingEvaluation {
  id: string
  session_id: string
  student_id: string
  evaluator_user_id?: string | null
  evaluator_type: SpeakingEvaluatorType
  estimated_level: string
  fluency: number
  vocabulary: number
  grammar: number
  coherence: number
  pronunciation: number
  overall_score: number
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
  detailed_feedback?: string | null
  is_official_tef: boolean
  created_at: string
}

export interface SpeakingSession {
  id: string
  session_type: SpeakingSessionType
  status: SpeakingSessionState
  topic: string
  level: string
  duration_minutes: number
  starts_at?: string | null
  expires_at?: string | null
  remaining_seconds?: number | null
  room_id: string
  participants: SpeakingParticipant[]
  created_at: string
}

export interface SpeakingSessionDetail extends SpeakingSession {
  ice_servers: Array<{
    urls: string | string[]
    username?: string
    credential?: string
  }>
  evaluation?: SpeakingEvaluation | null
}

export interface SpeakingSessionListResponse {
  items: SpeakingSession[]
  total: number
}

export interface CreateSpeakingSessionPayload {
  session_type?: SpeakingSessionType
  topic?: string
  level?: string
  duration_minutes?: number
  booking_id?: string
}

/**
 * State machine for the Speaking Workspace.
 * Prevents impossible states across real-time transitions.
 */
export type SpeakingWorkspaceState =
  | "preparing"
  | "microphone_required"
  | "connecting"
  | "ready"
  | "listening"
  | "student_speaking"
  | "ai_speaking"
  | "teacher_speaking"
  | "transitioning"
  | "reconnecting"
  | "ending"
  | "submitted"
  | "failed"

export type WebRTCConnectionState =
  | "new"
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "failed"
  | "closed"

export type AISpeakingState = "connecting" | "listening" | "speaking" | "thinking"

export interface SignalingEnvelope {
  action: string
  sender_id?: string
  target_id?: string
  data?: Record<string, unknown>
}

// Backward-compatibility aliases if used elsewhere
export type SpeakingSessionDetails = SpeakingSession
export type SpeakingEvaluationReport = SpeakingEvaluation
