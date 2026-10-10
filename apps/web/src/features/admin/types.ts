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
  text_format?: "plain" | "markdown" | "table" | "multi_doc" | string | null;
  word_count?: number | null;
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

// ---------------------------------------------------------------------------
// AI Question Generation (Phase 7)
// ---------------------------------------------------------------------------

export interface CandidateOptionPayload {
  content: string;
  is_correct: boolean;
  order_index?: number;
  explanation?: string | null;
  misconception_type?: string | null;
  distractor_rationale?: string | null;
}

export interface CandidateSkillMapping {
  skill_id: string;
  skill_code?: string | null;
  skill_name?: string | null;
  role: string;
  weight: number;
}

export interface CandidateGenerationMetadata {
  model: string;
  prompt_template_version: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  estimated_cost_usd?: number;
  latency_ms?: number;
  is_simulation: boolean;
  generated_at?: string;
}

export interface DuplicateCheckReport {
  is_duplicate: boolean;
  status: "unique" | "possible_duplicate" | "exact_duplicate" | string;
  similarity_score: number;
  matched_question_id?: string | null;
  matched_prompt?: string | null;
  message?: string;
}

export interface AIReviewReport {
  quality_score: number;
  naturalness_score: number;
  pedagogical_alignment: string;
  distractor_quality?: string | null;
  strengths: string[];
  weaknesses: string[];
  warnings: string[];
  suggested_improvements: string[];
  reviewed_at?: string;
}

export interface GeneratedQuestionCandidate {
  candidate_id: string;
  modality: string;
  prompt: string;
  instructions?: string | null;
  response_type: string;
  target_cefr: string;
  difficulty_rating: number;
  item_difficulty: number;
  cognitive_complexity: string;
  points: number;
  penalty_points: number;
  task_type_id?: string | null;
  task_type_code?: string | null;
  stimulus_id?: string | null;
  stimulus_title?: string | null;
  stimulus_content?: string | null;
  stimulus_mode?: string;
  source_attribution?: string | null;
  options: CandidateOptionPayload[];
  skill_mappings: CandidateSkillMapping[];
  scoring_payload?: Record<string, any> | null;
  explanation?: string | null;
  generation_metadata: CandidateGenerationMetadata;
  duplicate_check: DuplicateCheckReport;
  validation_report?: QuestionValidationResult | Record<string, any> | null;
  ai_review?: AIReviewReport | null;
  status: "pending_review" | "accepted" | "rejected" | string;
}

export interface AIQuestionGenerationRequest {
  modality?: string;
  task_type_id?: string | null;
  task_type_code?: string | null;
  response_type?: string;
  target_cefr?: string;
  difficulty_rating?: number | null;
  cognitive_complexity?: string;
  topic?: string | null;
  stimulus_mode?: "generate_new" | "existing_stimulus" | "supplied_text" | string;
  stimulus_id?: string | null;
  supplied_stimulus_text?: string | null;
  source_attribution?: string | null;
  target_skill_ids?: string[];
  count?: number;
  temperature?: number;
  model?: string;
  api_key_override?: string | null;
  force_simulation?: boolean;
}

export interface AIBatchGenerationResponse {
  batch_id: string;
  candidates: GeneratedQuestionCandidate[];
  total_requested: number;
  total_generated: number;
  valid_candidates_count: number;
  invalid_candidates_count: number;
  generation_time_ms: number;
  summary: string;
}

export interface CandidateCreateDraftRequest {
  candidate: GeneratedQuestionCandidate;
  section_id?: string | null;
}

export interface CandidateReviewRequest {
  candidate: GeneratedQuestionCandidate;
  api_key_override?: string | null;
  force_simulation?: boolean;
}

export interface CandidateRegenerateRequest {
  component: "distractors" | "prompt" | "explanation" | string;
  custom_instructions?: string | null;
  temperature?: number;
  model?: string;
  api_key_override?: string | null;
  force_simulation?: boolean;
}

export interface AIStimulusSubDocument {
  label: string;
  title: string;
  content: string;
}

export interface AIStimulusCandidate {
  id: string;
  title: string;
  content_text: string;
  text_format: "plain" | "markdown" | "table" | "multi_doc" | string;
  modality: string;
  target_cefr: string;
  word_count: number;
  source_attribution?: string | null;
  task_type_code?: string | null;
  sub_documents: AIStimulusSubDocument[];
  generation_metadata: CandidateGenerationMetadata;
}

export interface AIStimulusGenerationRequest {
  modality?: string;
  task_type_code?: string | null;
  target_cefr?: string;
  topic?: string | null;
  constraints?: string | null;
  text_format?: string;
  model?: string;
  temperature?: number;
  api_key_override?: string | null;
  force_simulation?: boolean;
}

// ---------------------------------------------------------------------------
// Server-driven generation catalogue & async jobs
// ---------------------------------------------------------------------------

export interface CatalogOption {
  code: string;
  label: string;
}

export interface TaskFormatCatalogEntry {
  code: string;
  module: string;
  module_label: string;
  name: string;
  admin_hint: string;
  stimulus_kind: string;
  stimulus_kind_label: string;
  requires_stimulus: boolean;
  allowed_response_types: string[];
  default_response_type: string;
  option_count_min: number;
  option_count_max: number;
  prompt_guidance: string;
}

export interface TaskFormatCatalogResponse {
  total_formats: number;
  modules: CatalogOption[];
  stimulus_kinds: CatalogOption[];
  formats: TaskFormatCatalogEntry[];
}

export type AIGenerationJobStatus = "queued" | "running" | "succeeded" | "failed" | string;

export interface AIGenerationJobResponse {
  id: string;
  status: AIGenerationJobStatus;
  task_type_code: string | null;
  modality: string;
  target_cefr: string;
  requested_count: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  is_terminal: boolean;
  result: AIBatchGenerationResponse | null;
}

export interface AIGenerationJobCreateResponse {
  job: AIGenerationJobResponse;
  poll_url: string;
}

// ---------------------------------------------------------------------------
// Bulk Question Operations & Import Types
// ---------------------------------------------------------------------------

export type BulkActionType = "publish" | "archive" | "delete" | "validate";

export interface BulkActionRequest {
  question_ids: string[];
  action: BulkActionType;
  notes?: string;
}

export interface BulkActionResponse {
  action: BulkActionType;
  total_requested: number;
  success_count: number;
  failure_count: number;
  affected_ids: string[];
  errors: Array<{ question_id: string; code: string; message: string }>;
}

export interface BulkOptionPayload {
  content: string;
  is_correct: boolean;
  explanation?: string | null;
  order_index?: number;
  misconception_type?: string | null;
}

export interface BulkImportQuestionItem {
  temp_id?: string;
  prompt: string;
  question_type?: string;
  response_type?: string;
  modality?: string;
  level?: string;
  target_cefr?: string | null;
  difficulty?: number;
  cognitive_complexity?: string | null;
  points?: number;
  penalty_points?: number;
  explanation?: string | null;
  stimulus_title?: string | null;
  stimulus_text?: string | null;
  stimulus_id?: string | null;
  media_url?: string | null;
  options: BulkOptionPayload[];
  skill_codes?: string[];
  is_valid?: boolean;
  validation_errors?: string[];
}

export interface BulkParseResponse {
  items: BulkImportQuestionItem[];
  total_parsed: number;
  valid_count: number;
  invalid_count: number;
  parse_errors: string[];
}

export interface AIAutoTagAndFormatResponse {
  items: BulkImportQuestionItem[];
  enriched_count: number;
}

export interface BulkImportCommitResponse {
  created_count: number;
  created_ids: string[];
  errors: Array<{ item_index: number; prompt: string; error?: string; errors?: string[] }>;
}

