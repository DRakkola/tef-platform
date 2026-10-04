/**
 * Type definitions for Content Management / Content Studio module.
 */

export type ContentStatus = "draft" | "in_review" | "approved" | "published" | "archived" | "rejected";
export type ReviewStatus = "pending" | "approved" | "rejected";
export type MediaType = "audio" | "image" | "document";

export type QuestionResponseType =
  | "single_choice"
  | "multiple_choice"
  | "matching"
  | "ordering"
  | "gap_fill"
  | "short_text"
  | "long_text"
  | "spoken_response"
  | "interaction"
  | "text_input"
  | "cloze";

export type QuestionType = QuestionResponseType;

export type CognitiveComplexityLevel =
  | "remember"
  | "understand"
  | "apply"
  | "analyze"
  | "evaluate"
  | "create";

export type QuestionValidationStatus = "valid" | "warning" | "invalid";

export interface QuestionValidationIssue {
  code: string;
  severity: "blocking" | "warning" | "info";
  message: string;
  field?: string | null;
  rule_name?: string | null;
}

export interface QuestionValidationResult {
  is_valid: boolean;
  status: QuestionValidationStatus;
  issues: QuestionValidationIssue[];
  checked_at?: string;
}

export interface AdminStimulus {
  id: string;
  title: string;
  content: string;
  modality?: string | null;
  media_url?: string | null;
  audio_url?: string | null;
  source_attribution?: string | null;
  cefr_level?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface QuestionProvenance {
  id?: string;
  author_type: "human" | "ai" | "imported";
  source_reference?: string | null;
  generation_model?: string | null;
  prompt_template_version?: string | null;
  human_verified: boolean;
  verified_by_user_id?: string | null;
  verified_at?: string | null;
  notes?: string | null;
}

export interface SubSkill {
  id: string;
  skill_id: string;
  code: string;
  name: string;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SkillItem {
  id: string;
  code: string;
  name: string;
  category: string;
  description?: string | null;
  parent_id?: string | null;
  is_active?: boolean;
  subskills?: SubSkill[];
  usage_counts?: Record<string, any>;
}

export interface QuestionOption {
  id?: string;
  question_id?: string;
  content: string;
  order_index?: number;
  is_correct: boolean;
  explanation?: string | null;
  misconception_type?: string | null;
  distractor_rationale?: string | null;
  weight?: number;
}

export interface QuestionSkillTag {
  id?: string;
  skill_id: string;
  subskill_id?: string | null;
  subskill?: string | null;
  role?: "primary" | "secondary";
  weight: number;
  context?: Record<string, any> | null;
  skill_code?: string;
  skill_name?: string;
  dimension?: "reasoning" | "language" | string;
  domain?: string;
}

export interface QuestionVersionItem {
  id: string;
  question_id: string;
  version_number: number;
  status_at_version?: string;
  changelog?: string | null;
  snapshot_payload: Record<string, any>;
  created_by_user_id?: string | null;
  created_at: string;
}

export interface QuestionFilterParams {
  page?: number;
  page_size?: number;
  search?: string;
  section_id?: string;
  modality?: string;
  task_type_id?: string;
  response_type?: string;
  target_cefr?: string;
  difficulty?: number;
  status?: string;
  validation_status?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

export interface QuestionItem {
  id: string;
  section_id?: string | null;
  question_type: QuestionResponseType;
  prompt: string;
  stimulus_id?: string | null;
  stimulus?: AdminStimulus | null;
  stimulus_text?: string | null;
  audio_url?: string | null;
  media_url?: string | null;
  order_index: number;
  difficulty: number;
  level: string;
  target_cefr?: string;
  item_difficulty?: number;
  cognitive_complexity?: CognitiveComplexityLevel;
  task_type_id?: string | null;
  task_type?: { id: string; code: string; name: string; modality: string } | null;
  explanation?: string | null;
  points: number;
  penalty_points: number;
  status: ContentStatus;
  version: number;
  validation_status?: QuestionValidationStatus;
  validation_issues?: QuestionValidationIssue[];
  options: QuestionOption[];
  skill_tags?: QuestionSkillTag[];
  response_metadata?: Record<string, any>;
  scoring_payload?: Record<string, any>;
  provenance?: QuestionProvenance | null;
  created_at: string;
  updated_at: string;
  created_by_user_id?: string | null;
  updated_by_user_id?: string | null;
}

export interface QuestionCreatePayload {
  section_id?: string | null;
  prompt: string;
  question_type: QuestionResponseType;
  stimulus_id?: string | null;
  stimulus_text?: string | null;
  audio_url?: string | null;
  media_url?: string | null;
  order_index?: number;
  difficulty?: number;
  level?: string;
  target_cefr?: string;
  item_difficulty?: number;
  cognitive_complexity?: CognitiveComplexityLevel;
  task_type_id?: string | null;
  explanation?: string | null;
  points?: number;
  penalty_points?: number;
  options?: Array<{
    content: string;
    order_index?: number;
    is_correct: boolean;
    explanation?: string | null;
    misconception_type?: string | null;
    distractor_rationale?: string | null;
    weight?: number;
  }>;
  skill_tags?: Array<{
    skill_id: string;
    role?: "primary" | "secondary";
    subskill_id?: string | null;
    subskill?: string | null;
    weight?: number;
    context?: Record<string, any> | null;
  }>;
  response_metadata?: Record<string, any>;
  scoring_payload?: Record<string, any>;
  provenance?: QuestionProvenance | null;
}

export interface AssessmentSectionItem {
  id: string;
  assessment_id: string;
  title: string;
  instructions?: string | null;
  order_index: number;
  time_limit_seconds?: number | null;
  media_url?: string | null;
  passage_text?: string | null;
  questions: QuestionItem[];
}

export interface AssessmentItem {
  id: string;
  title: string;
  description?: string | null;
  assessment_type: string;
  duration_seconds: number;
  navigation_policy: string;
  scoring_policy: string;
  pass_percentage?: number | null;
  status: ContentStatus;
  version: number;
  is_published: boolean;
  sections?: AssessmentSectionItem[];
  created_at: string;
  updated_at: string;
}

export interface AssessmentVersionItem {
  id: string;
  assessment_id: string;
  version: number;
  title: string;
  description?: string | null;
  assessment_type: string;
  duration_seconds: number;
  navigation_policy: string;
  scoring_policy: string;
  pass_percentage?: number | null;
  sections_snapshot: any[];
  created_at: string;
}

export interface ValidationErrorItem {
  field?: string | null;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationReport {
  is_valid: boolean;
  errors: ValidationErrorItem[];
  warnings: ValidationErrorItem[];
}

export interface ExerciseItem {
  id: string;
  title: string;
  prompt: string;
  instructions?: string | null;
  explanation?: string | null;
  category: string;
  difficulty: number;
  level: string;
  points: number;
  options_payload: any[];
  status: ContentStatus;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface WritingTaskItem {
  id: string;
  title: string;
  task_type: string;
  prompt: string;
  stimulus_text?: string | null;
  min_words: number;
  max_words: number;
  duration_minutes: number;
  target_level: string;
  status: ContentStatus;
  version: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface MediaAssetItem {
  id: string;
  title: string;
  filename: string;
  content_type: string;
  file_size: number;
  storage_object_key: string;
  bucket: string;
  checksum?: string | null;
  duration_seconds?: number | null;
  media_type: MediaType;
  is_public: boolean;
  created_at: string;
}

export interface ContentReviewItem {
  id: string;
  entity_type: string;
  entity_id: string;
  version: number;
  status: ReviewStatus;
  reviewer_id?: string | null;
  comments?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditEventItem {
  id: string;
  actor_user_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  payload: Record<string, any>;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}
