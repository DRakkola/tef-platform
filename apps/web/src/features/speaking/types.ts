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
  exam_id?: string | null
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

export type AudioInputMode = "hands_free" | "push_to_talk"

export interface SignalingEnvelope {
  action: string
  sender_id?: string
  target_id?: string
  data?: Record<string, unknown>
}

// Backward-compatibility aliases if used elsewhere
export type SpeakingSessionDetails = SpeakingSession
export type SpeakingEvaluationReport = SpeakingEvaluation

export type SpeakingExamState =
  | "created"
  | "ready"
  | "section_a_active"
  | "section_a_completed"
  | "section_b_preparing"
  | "section_b_active"
  | "completed"
  | "evaluating"
  | "evaluated"
  | "cancelled"
  | "expired"
  | "failed"

export type ExamSectionType = "section_a" | "section_b"

export type SpeakingSectionState = "pending" | "active" | "completed" | "expired"

export type SpeakingTurnSpeaker = "examiner" | "candidate"

export type SpeakingTurnState = "started" | "processing" | "completed" | "interrupted"

export interface SpeakingTurn {
  id: string
  section_id: string
  turn_number: number
  speaker: SpeakingTurnSpeaker
  state: SpeakingTurnState
  started_at: string
  completed_at?: string | null
  duration_seconds?: number | null
  content_text?: string | null
  client_turn_id?: string | null
  created_at: string
}

export interface SpeakingSection {
  id: string
  exam_id: string
  section_type: ExamSectionType
  sequence: number
  title: string
  state: SpeakingSectionState
  target_duration_seconds: number
  started_at?: string | null
  completed_at?: string | null
  expires_at?: string | null
  remaining_seconds?: number | null
  topic?: string | null
  prompt_context?: string | null
  created_at: string
}

export interface SpeakingExam {
  id: string
  session_id?: string | null
  student_id: string
  state: SpeakingExamState
  level: string
  title: string
  started_at?: string | null
  completed_at?: string | null
  evaluation_id?: string | null
  active_section?: ExamSectionType | null
  sections: SpeakingSection[]
  created_at: string
  updated_at: string
}

export interface SpeakingExamStateResponse {
  exam_id: string
  state: SpeakingExamState
  active_section?: ExamSectionType | null
  active_section_remaining_seconds?: number | null
  prep_remaining_seconds?: number | null
  conversation_state: string
  session_id?: string | null
}

export interface SpeakingExamCreatePayload {
  session_id?: string | null
  level?: string
  title?: string
  topic_a?: string
  topic_b?: string
  prompt_a?: string
  prompt_b?: string
  examiner_persona?: string
}

export interface SpeakingTurnCreatePayload {
  speaker: SpeakingTurnSpeaker
  content_text?: string
  duration_seconds?: number
  client_turn_id?: string
}
