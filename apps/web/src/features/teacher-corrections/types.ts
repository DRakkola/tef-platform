/**
 * Types and interfaces for the Teacher Writing Correction Workspace.
 *
 * All types mirror the backend schemas from:
 *   app/modules/writing/schemas.py
 *   app/modules/writing/enums.py
 */

// ---------------------------------------------------------------------------
// Enums & Status Maps
// ---------------------------------------------------------------------------

export type WritingSubmissionStatus =
  | "submitted"
  | "queued"
  | "assigned"
  | "in_review"
  | "processing"
  | "reviewing"
  | "corrected"
  | "returned"
  | string

export type WritingCorrectionStatus = "draft" | "submitted" | "returned"

export type CorrectionProviderType = "teacher" | "ai" | "mock"

export type WritingTaskType = "section_a" | "section_b" | "general" | string

/** Correction queue filter tabs */
export type CorrectionStatusFilter =
  | "pending"  // submitted + queued + assigned + in_review
  | "in_review"
  | "done"     // corrected + returned
  | "all"

// ---------------------------------------------------------------------------
// Shared Label Maps (single source of truth — never scatter translations)
// ---------------------------------------------------------------------------

export const SUBMISSION_STATUS_META: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  submitted:  { label: "Soumise",    variant: "outline"   },
  queued:     { label: "En attente", variant: "outline"   },
  assigned:   { label: "Attribuée",  variant: "secondary" },
  in_review:  { label: "En cours",   variant: "default"   },
  processing: { label: "En cours",   variant: "default"   },
  reviewing:  { label: "En cours",   variant: "default"   },
  corrected:  { label: "Corrigée",   variant: "secondary" },
  returned:   { label: "Retournée",  variant: "secondary" },
}

export const CORRECTION_CATEGORY_LABELS: Record<string, string> = {
  grammar:     "Grammaire",
  spelling:    "Orthographe",
  vocabulary:  "Vocabulaire",
  register:    "Registre",
  syntax:      "Syntaxe",
  conjugation: "Conjugaison",
  coherence:   "Cohérence",
  other:       "Autre",
}

export const CORRECTION_CATEGORY_OPTIONS = Object.entries(CORRECTION_CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label })
)

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const

export const TASK_TYPE_LABELS: Record<string, string> = {
  section_a: "Section A — Fait divers",
  section_b: "Section B — Lettre argumentative",
  general:   "Rédaction générale",
}

// ---------------------------------------------------------------------------
// Task Detail
// ---------------------------------------------------------------------------

export interface WritingTaskDetail {
  id: string
  title: string
  task_type: WritingTaskType
  prompt: string
  stimulus_text?: string | null
  min_words: number
  max_words: number
  duration_minutes: number
  target_level: string
}

// ---------------------------------------------------------------------------
// Queue / List
// ---------------------------------------------------------------------------

export interface WritingSubmissionSummary {
  id: string
  attempt_id: string
  task_id: string
  writing_task_version_id?: string | null
  user_id: string
  assigned_teacher_id?: string | null
  status: WritingSubmissionStatus
  word_count: number
  submitted_at: string
  /** Populated when backend includes task info */
  task?: Pick<WritingTaskDetail, "title" | "task_type"> | null
}

// ---------------------------------------------------------------------------
// Workspace Detail
// ---------------------------------------------------------------------------

export interface WritingSubmissionDetail {
  id: string
  attempt_id: string
  task_id: string
  writing_task_version_id?: string | null
  user_id: string
  assigned_teacher_id?: string | null
  status: WritingSubmissionStatus
  word_count: number
  submitted_at: string
  /** Student essay text (downloaded from MinIO by backend) */
  content: string
  /** Full task info including prompt */
  task: WritingTaskDetail
  /** Existing correction if already corrected */
  correction?: WritingCorrectionResponse | null
}

// ---------------------------------------------------------------------------
// Correction Items (structured errors)
// ---------------------------------------------------------------------------

export interface CorrectionItemCreate {
  original_text: string
  corrected_text: string
  category: string
  explanation: string
  skill_id?: string | null
}

export interface CorrectionItemResponse extends CorrectionItemCreate {
  id: string
  correction_id: string
  created_at: string
}

export interface CorrectionSkillCreate {
  skill_id: string
  score: number
  level: string
  feedback: string
}

export interface CorrectionSkillResponse extends CorrectionSkillCreate {
  id: string
  correction_id: string
  created_at: string
}

// ---------------------------------------------------------------------------
// Correction Payload & Response
// ---------------------------------------------------------------------------

export interface TeacherCorrectionPayload {
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
  items: CorrectionItemCreate[]
  skills: CorrectionSkillCreate[]
}

export interface WritingCorrectionResponse {
  id: string
  submission_id: string
  provider: CorrectionProviderType
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
  items: CorrectionItemResponse[]
  skills: CorrectionSkillResponse[]
  is_simulated: boolean
  disclaimer: string
  created_at: string
}

// ---------------------------------------------------------------------------
// Local form state (workspace)
// ---------------------------------------------------------------------------

export interface CorrectionFormState {
  score: number | ""
  estimated_level: string
  task_completion: number | ""
  coherence: number | ""
  vocabulary: number | ""
  grammar: number | ""
  syntax: number | ""
  spelling: number | ""
  register: number | ""
  strengths: string
  weaknesses: string
  comments: string
  recommendations: string
  items: CorrectionItemCreate[]
}

export const EMPTY_CORRECTION_FORM: CorrectionFormState = {
  score: "",
  estimated_level: "",
  task_completion: "",
  coherence: "",
  vocabulary: "",
  grammar: "",
  syntax: "",
  spelling: "",
  register: "",
  strengths: "",
  weaknesses: "",
  comments: "",
  recommendations: "",
  items: [],
}

// ---------------------------------------------------------------------------
// Assignment response (for claim endpoint)
// ---------------------------------------------------------------------------

export interface WritingAssignmentResponse {
  id: string
  submission_id: string
  teacher_id: string
  status: string
  assigned_at: string
  claimed_at?: string | null
  completed_at?: string | null
}
