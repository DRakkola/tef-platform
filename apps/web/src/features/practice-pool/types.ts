export type PracticeType =
  | "free_conversation"
  | "tef_speaking_section_a"
  | "tef_speaking_section_b"
  | "roleplay"
  | "debate";

export type PracticeQueueStatusType = "waiting" | "matching" | "matched" | "cancelled" | "expired";

export type PracticeSessionStatusType =
  | "created"
  | "waiting"
  | "active"
  | "completed"
  | "abandoned"
  | "expired"
  | "cancelled";

export type PracticeRequestStatusType = "pending" | "accepted" | "rejected" | "expired" | "cancelled";

export type PracticeReportReasonType =
  | "inappropriate_behavior"
  | "offensive_language"
  | "harassment"
  | "silence_or_afk"
  | "audio_quality_issues"
  | "wrong_level"
  | "contact_exchange_attempt"
  | "spam"
  | "technical_abuse"
  | "other";

export interface PracticeTopic {
  id: string;
  title: string;
  description: string;
  level: string;
  category: string;
  prompts: string[];
}

export interface PracticeCandidate {
  queue_id: string;
  anonymous_alias: string;
  language: string;
  level: string;
  practice_type: PracticeType;
  joined_at: string;
  score?: number | null;
}

export interface PracticeQueueStatus {
  in_queue: boolean;
  queue_id?: string | null;
  anonymous_alias?: string | null;
  status?: PracticeQueueStatusType | null;
  language?: string | null;
  level?: string | null;
  practice_type?: PracticeType | null;
  topic_id?: string | null;
  joined_at?: string | null;
  candidates: PracticeCandidate[];
}

export interface PracticeHeartbeatResponse {
  in_queue: boolean;
  status: string;
  ttl_seconds: number;
}

export interface PracticeRequest {
  id: string;
  sender_alias: string;
  receiver_alias: string;
  language: string;
  level: string;
  practice_type: PracticeType;
  status: PracticeRequestStatusType;
  expires_at: string;
  created_at: string;
  is_incoming: boolean;
}

export interface PracticeSession {
  id: string;
  match_id: string;
  room_id: string;
  my_alias: string;
  peer_alias: string;
  language: string;
  level: string;
  practice_type: PracticeType;
  duration_minutes: number;
  status: PracticeSessionStatusType;
  starts_at: string;
  expires_at: string;
  remaining_seconds?: number | null;
  audio_only: boolean;
  topic?: PracticeTopic | null;
  created_at: string;
  ice_servers?: Array<{ urls: string | string[]; username?: string; credential?: string }>;
}

export interface PracticeReportPayload {
  session_id: string;
  reason: PracticeReportReasonType;
  details?: string;
}

export interface PracticeBlockPayload {
  blocked_user_id: string;
  reason?: string;
}

export interface PracticeSignalingMessage {
  action: "connected" | "ready" | "offer" | "answer" | "ice-candidate" | "leave" | "error";
  sender_id?: string;
  sender_alias?: string;
  target_id?: string;
  audio_only?: boolean;
  data?: Record<string, any>;
  message?: string;
}

export type WebRTCAudioConnectionState =
  | "initializing"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed"
  | "closed";

