/**
 * API client methods for Practice Pool.
 */

import { apiClient } from "@/core/api";
import type {
  PracticeCandidate,
  PracticeHeartbeatResponse,
  PracticeQueueStatus,
  PracticeRequest,
  PracticeSession,
  PracticeTopic,
  PracticeType,
} from "./types";

export async function getPracticeTopics(
  level?: string,
  category?: string
): Promise<PracticeTopic[]> {
  const params = new URLSearchParams();
  if (level) params.append("level", level);
  if (category) params.append("category", category);
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiClient<PracticeTopic[]>(`/practice/topics${query}`);
}

export async function joinPracticeQueue(payload: {
  language?: string;
  level?: string;
  practice_type?: PracticeType;
  topic_id?: string | null;
}): Promise<PracticeQueueStatus> {
  return apiClient<PracticeQueueStatus>("/practice/queue/join", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function leavePracticeQueue(): Promise<{ message: string }> {
  return apiClient<{ message: string }>("/practice/queue/leave", {
    method: "POST",
  });
}

export async function getPracticeQueueStatus(): Promise<PracticeQueueStatus> {
  return apiClient<PracticeQueueStatus>("/practice/queue/status");
}

export async function sendPracticeHeartbeat(): Promise<PracticeHeartbeatResponse> {
  return apiClient<PracticeHeartbeatResponse>("/practice/queue/heartbeat", {
    method: "POST",
  });
}

export async function getPracticeCandidates(): Promise<PracticeCandidate[]> {
  return apiClient<PracticeCandidate[]>("/practice/candidates");
}

export async function createPracticeRequest(
  candidateQueueId: string,
  topicId?: string | null
): Promise<PracticeRequest> {
  return apiClient<PracticeRequest>("/practice/requests", {
    method: "POST",
    body: JSON.stringify({
      candidate_queue_id: candidateQueueId,
      topic_id: topicId || null,
    }),
  });
}

export async function getPracticeRequests(): Promise<PracticeRequest[]> {
  return apiClient<PracticeRequest[]>("/practice/requests");
}

export async function getIncomingRequests(): Promise<PracticeRequest[]> {
  return apiClient<PracticeRequest[]>("/practice/requests/incoming");
}

export async function getOutgoingRequests(): Promise<PracticeRequest[]> {
  return apiClient<PracticeRequest[]>("/practice/requests/outgoing");
}

export async function acceptPracticeRequest(requestId: string): Promise<PracticeSession> {
  return apiClient<PracticeSession>(`/practice/requests/${requestId}/accept`, {
    method: "POST",
  });
}

export async function rejectPracticeRequest(requestId: string): Promise<{ message: string }> {
  return apiClient<{ message: string }>(`/practice/requests/${requestId}/reject`, {
    method: "POST",
  });
}

export async function cancelPracticeRequest(requestId: string): Promise<{ message: string }> {
  return apiClient<{ message: string }>(`/practice/requests/${requestId}/cancel`, {
    method: "POST",
  });
}

export async function getPracticeSession(sessionId: string): Promise<PracticeSession> {
  return apiClient<PracticeSession>(`/practice/sessions/${sessionId}`);
}

export async function leavePracticeSession(sessionId: string): Promise<PracticeSession> {
  return apiClient<PracticeSession>(`/practice/sessions/${sessionId}/leave`, {
    method: "POST",
  });
}

export async function reportPracticePeer(
  sessionId: string,
  reason: string,
  details?: string
): Promise<{ id: string; reason: string; status: string; created_at: string }> {
  return apiClient(`/practice/sessions/${sessionId}/report`, {
    method: "POST",
    body: JSON.stringify({ reason, details: details || null }),
  });
}

export async function blockPracticePeer(
  sessionId: string,
  reason?: string
): Promise<{ id: string; blocked_user_id: string }> {
  return apiClient(`/practice/sessions/${sessionId}/block-peer`, {
    method: "POST",
    body: JSON.stringify({ reason: reason || null }),
  });
}
