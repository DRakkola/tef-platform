/**
 * Type definitions for Content Management / Content Studio module.
 */

export type ContentStatus = "draft" | "in_review" | "published" | "archived";
export type ReviewStatus = "pending" | "approved" | "rejected";
export type MediaType = "audio" | "image" | "document";
export type QuestionType = "single_choice" | "multiple_choice" | "text_input" | "cloze";

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
  subskills?: SubSkill[];
}

export interface QuestionOption {
  id?: string;
  question_id?: string;
  content: string;
  order_index?: number;
  is_correct: boolean;
  explanation?: string | null;
}

export interface QuestionSkillTag {
  skill_id: string;
  subskill?: string | null;
  weight?: number;
}

export interface QuestionItem {
  id: string;
  section_id?: string | null;
  question_type: QuestionType;
  prompt: string;
  stimulus_text?: string | null;
  audio_url?: string | null;
  media_url?: string | null;
  order_index: number;
  difficulty: number;
  level: string;
  explanation?: string | null;
  points: number;
  penalty_points: number;
  status: ContentStatus;
  version: number;
  options: QuestionOption[];
  created_at: string;
  updated_at: string;
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
