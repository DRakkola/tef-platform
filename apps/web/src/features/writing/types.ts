/**
 * Types and interfaces for the Student Writing Workspace and Writing Result experience.
 */

export interface WritingTaskDetail {
  id: string
  title: string
  task_type: "section_a" | "section_b" | string
  prompt: string
  stimulus_text?: string | null
  min_words: number
  max_words: number
  duration_minutes: number
  target_level: string
}

export type WritingAttemptStatus = "draft" | "submitted" | "expired" | "abandoned"

export interface WritingAttempt {
  id: string
  task_id: string
  writing_task_version_id?: string | null
  user_id?: string
  status: WritingAttemptStatus
  content: string
  word_count: number
  current_revision: number
  started_at: string
  expires_at: string
  remaining_seconds: number
  submitted_at?: string | null
  task?: WritingTaskDetail | null
}

export type SaveStatus = "saved" | "saving" | "offline" | "error"

export type CorrectionType = "ai" | "teacher"

export interface WritingSubmissionResponse {
  id: string
  attempt_id: string
  task_id: string
  user_id: string
  assigned_teacher_id?: string | null
  status: string
  word_count: number
  submitted_at: string
}

export interface CorrectionItem {
  id: string
  correction_id: string
  original_text: string
  corrected_text: string
  category: string
  explanation: string
  skill_id?: string | null
  created_at: string
}

export interface CorrectionSkill {
  id: string
  correction_id: string
  skill_id: string
  score: number
  level: string
  feedback: string
  created_at: string
}

export interface WritingCorrectionDetail {
  id: string
  submission_id: string
  provider: "ai" | "teacher" | "mock"
  corrected_by_user_id?: string | null
  status: string
  score: number
  estimated_level: string
  task_completion?: number | null
  coherence?: number | null
  vocabulary?: number | null
  grammar?: number | null
  syntax?: number | null
  spelling?: number | null
  register?: number | null
  strengths: string[]
  weaknesses: string[]
  comments: string
  corrected_content?: string | null
  recommendations: string[]
  items: CorrectionItem[]
  skills: CorrectionSkill[]
  is_simulated: boolean
  disclaimer: string
  created_at: string
}

export interface WritingResultDetail {
  attempt_id: string
  submission_id: string
  status: "submitted" | "queued" | "assigned" | "in_review" | "processing" | "reviewing" | "corrected" | "returned" | string
  word_count: number
  submitted_at: string
  task: WritingTaskDetail
  content: string
  correction: WritingCorrectionDetail | null
  is_simulated: boolean
  disclaimer: string
}

export interface WritingRecommendation {
  id: string
  skill_id?: string
  skill_name: string
  skill_code?: string
  category: string
  level?: string
  title: string
  reason: string
  action_url?: string
  action_label?: string
}

export interface WritingCorrectionResult {
  id: string
  overallScore: number
  grammarScore: number
  vocabularyScore: number
  coherenceScore: number
  feedback: string
}

// Backward-compatibility alias
export type WritingTaskSummary = WritingTaskDetail
