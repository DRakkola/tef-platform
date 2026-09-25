/**
 * API client methods for Teacher Writing Correction operations.
 *
 * All endpoints reuse the existing backend writing router:
 *   GET  /teachers/writing/submissions        — combined queue + assigned
 *   GET  /teacher/writing/{id}                — submission detail with student text
 *   POST /teacher/writing/{id}/claim          — claim unassigned submission
 *   POST /teachers/writing/submissions/{id}/review — mark as in_review
 *   POST /teacher/writing/{id}/evaluate       — submit final correction
 */

import { apiClient } from "@/core/api"
import type {
  WritingSubmissionSummary,
  WritingSubmissionDetail,
  WritingCorrectionResponse,
  TeacherCorrectionPayload,
  WritingSubmissionStatus,
} from "./types"

// ---------------------------------------------------------------------------
// Queue Listing
// ---------------------------------------------------------------------------

export async function getTeacherWritingSubmissions(params?: {
  status_filter?: WritingSubmissionStatus
}): Promise<WritingSubmissionSummary[]> {
  const query = new URLSearchParams()
  if (params?.status_filter) {
    query.set("status_filter", params.status_filter)
  }
  const qs = query.toString()
  return apiClient<WritingSubmissionSummary[]>(
    qs ? `/teachers/writing/submissions?${qs}` : "/teachers/writing/submissions"
  )
}

// ---------------------------------------------------------------------------
// Submission Detail (with student text from MinIO)
// ---------------------------------------------------------------------------

export async function getTeacherWritingSubmissionDetail(
  submissionId: string
): Promise<WritingSubmissionDetail> {
  return apiClient<WritingSubmissionDetail>(`/teacher/writing/${submissionId}`)
}

// ---------------------------------------------------------------------------
// Claim Submission (row-level pessimistic lock)
// ---------------------------------------------------------------------------

export async function claimWritingSubmission(
  submissionId: string
): Promise<WritingSubmissionSummary> {
  return apiClient<WritingSubmissionSummary>(`/teacher/writing/${submissionId}/claim`, {
    method: "POST",
  })
}

// ---------------------------------------------------------------------------
// Start Review (transition to in_review)
// ---------------------------------------------------------------------------

export async function startWritingReview(
  submissionId: string
): Promise<WritingSubmissionSummary> {
  return apiClient<WritingSubmissionSummary>(
    `/teachers/writing/submissions/${submissionId}/review`,
    { method: "POST" }
  )
}

// ---------------------------------------------------------------------------
// Submit Teacher Correction (final evaluation)
// ---------------------------------------------------------------------------

export async function submitTeacherCorrection(
  submissionId: string,
  payload: TeacherCorrectionPayload
): Promise<WritingCorrectionResponse> {
  return apiClient<WritingCorrectionResponse>(`/teacher/writing/${submissionId}/evaluate`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}
