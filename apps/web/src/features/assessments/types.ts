export type AssessmentType = "reading" | "listening" | "mixed";
export type AttemptStatus = "created" | "started" | "submitted" | "expired" | "abandoned";

export interface QuestionOptionStudent {
  id: string;
  content: string;
  order_index: number;
}

export interface QuestionStudent {
  id: string;
  section_id: string;
  prompt: string;
  question_type: string;
  order_index: number;
  level: string;
  difficulty: number;
  points: number;
  media_url?: string | null;
  options: QuestionOptionStudent[];
}

export interface AssessmentSectionStudent {
  id: string;
  assessment_id: string;
  title: string;
  instructions?: string | null;
  order_index: number;
  duration_seconds?: number | null;
  passage_text?: string | null;
  media_url?: string | null;
  questions: QuestionStudent[];
}

export interface AssessmentListItem {
  id: string;
  title: string;
  description?: string | null;
  assessment_type: AssessmentType;
  duration_seconds: number;
  estimated_completion_time_minutes: number;
  level: string;
  navigation_policy: string;
  scoring_policy: string;
  section_count: number;
  question_count: number;
  total_points: number;
  difficulty?: number;
}

export interface AssessmentDetail {
  id: string;
  title: string;
  description?: string | null;
  assessment_type: AssessmentType;
  duration_seconds: number;
  estimated_completion_time_minutes: number;
  level: string;
  navigation_policy: string;
  scoring_policy: string;
  max_attempts?: number | null;
  pass_percentage?: number | null;
  total_points?: number;
  sections: AssessmentSectionStudent[];
}

export interface AttemptAnswerStudent {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_option_id?: string | null;
  selected_option_ids: string[];
  text_response?: string | null;
  answered_at: string;
}

export interface AttemptDetail {
  id: string;
  assessment_id: string;
  assessment_version_id?: string | null;
  user_id: string;
  student_id: string;
  status: AttemptStatus;
  started_at?: string | null;
  expires_at?: string | null;
  submitted_at?: string | null;
  remaining_seconds: number;
  answers: AttemptAnswerStudent[];
}

export interface AttemptState {
  attempt_id: string;
  assessment_id: string;
  assessment_version_id?: string | null;
  user_id: string;
  student_id: string;
  status: AttemptStatus;
  started_at?: string | null;
  expires_at?: string | null;
  server_time: string;
  remaining_seconds: number;
  is_expired: boolean;
  answered_count: number;
  total_questions: number;
  answers: Record<string, string | string[] | null>;
}

export interface OptionResult {
  id: string;
  content: string;
  order_index: number;
  is_correct: boolean;
  explanation?: string | null;
}

export interface QuestionResult {
  id: string;
  section_id: string;
  prompt: string;
  question_type: string;
  order_index: number;
  level: string;
  difficulty: number;
  points: number;
  explanation?: string | null;
  media_url?: string | null;
  options: OptionResult[];
  user_answer?: {
    id: string;
    question_id: string;
    selected_option_id?: string | null;
    selected_option_ids: string[];
    text_response?: string | null;
    is_correct?: boolean | null;
    points_awarded: number;
    answered_at: string;
  } | null;
}

export interface SectionResult {
  id: string;
  title: string;
  instructions?: string | null;
  order_index: number;
  passage_text?: string | null;
  media_url?: string | null;
  questions: QuestionResult[];
}

export interface MistakeItem {
  question_id: string;
  prompt: string;
  level: string;
  points: number;
  user_answer?: string | null;
  correct_answer?: string | null;
  explanation?: string | null;
  skill_name?: string | null;
  subskill?: string | null;
}

export interface RecommendedExerciseResult {
  id: string;
  title: string;
  category: string;
  difficulty: number;
  level: string;
  target_skill_name: string;
  reason: string;
  priority: string;
}

export interface AttemptResults {
  attempt_id: string;
  assessment_id: string;
  user_id: string;
  status: AttemptStatus;
  started_at?: string | null;
  expires_at?: string | null;
  submitted_at?: string | null;
  score: {
    id: string;
    attempt_id: string;
    total_points: number;
    max_points: number;
    percentage: number;
    is_passed?: boolean | null;
    estimated_level?: string | null;
    skill_scores: Record<string, any>;
    scored_at: string;
  };
  sections: SectionResult[];
  disclaimer: string;
  strengths: string[];
  weaknesses: string[];
  mistakes: MistakeItem[];
  recommended_exercises: RecommendedExerciseResult[];
}

export interface ActiveAttemptSummary {
  id: string;
  assessment_id: string;
  title: string;
  assessment_type: AssessmentType;
  level: string;
  duration_seconds: number;
  remaining_seconds: number;
  started_at: string;
  expires_at: string;
  total_questions: number;
  answered_count: number;
}

export interface AssessmentRecommendation {
  assessment_id: string;
  title: string;
  assessment_type: AssessmentType;
  level: string;
  duration_seconds: number;
  estimated_completion_time_minutes: number;
  question_count: number;
  section_count: number;
  reason: string;
  recommendation_type?: string;
}

export interface AssessmentHistoryItem {
  id: string;
  assessment_id: string;
  title: string;
  assessment_type: AssessmentType;
  level: string;
  score_percentage?: number | null;
  passed?: boolean | null;
  estimated_level?: string | null;
  status: AttemptStatus;
  started_at: string;
  submitted_at?: string | null;
  duration_seconds?: number | null;
}

export interface AssessmentFiltersState {
  type: string;
  level: string;
  duration: string;
  search: string;
}

export type SupportedQuestionType = "single_choice" | "multiple_choice" | "text_input";

export type SaveStatusState = "saved" | "saving" | "offline" | "error" | "retrying";

export type TimerSeverity = "normal" | "warning" | "critical" | "expired";

export interface ActiveQuestionItem {
  question: QuestionStudent;
  sectionIndex: number;
  sectionTitle: string;
  passageText?: string | null;
  mediaUrl?: string | null;
  instructions?: string | null;
  globalIndex: number;
}

export type AudioPlaybackState =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "ended"
  | "error"
  | "unavailable";

export interface AudioPlaybackRules {
  allow_pause?: boolean;
  allow_seek?: boolean;
  allow_replay?: boolean;
  max_replays?: number;
  autoplay?: boolean;
}

export interface ReadinessProfileSummary {
  student_id: string;
  target_exam?: string | null;
  target_level?: string | null;
  estimated_level?: string | null;
  confidence?: number | null;
  confidence_label?: string | null;
  readiness_band?: string | null;
  summary_gaps?: Array<{
    skill_id: string;
    skill_name: string;
    category?: string;
    current_estimate?: number;
    target_estimate?: number;
    gap?: number;
    explanation?: string;
  }>;
  summary_blockers?: Array<{
    skill_id: string;
    skill_name: string;
    category?: string;
    explanation?: string;
  }>;
}

export interface DailyPlanTaskSummary {
  id: string;
  title: string;
  description?: string;
  task_type: string;
  target_entity_id?: string;
  skill_name?: string;
  estimated_minutes: number;
  priority: number;
  is_completed: boolean;
}

export interface ProgressComparisonData {
  previousAttempt: AssessmentHistoryItem;
  scoreDelta: number;
  isImprovement: boolean;
  isComparable: boolean;
}

