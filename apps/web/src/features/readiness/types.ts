/**
 * TypeScript types for TEF Readiness Engine & Adaptive Learning Engine.
 * Conforms to strict terminology:
 * - Readiness estimate (never official certification or score guarantee)
 * - Estimated performance, target gap, confidence, skill profile
 * - Readiness bands: insufficient_data, developing, progressing, near_target, target_consistent
 */

export type ReadinessBand =
  | "insufficient_data"
  | "developing"
  | "progressing"
  | "near_target"
  | "target_consistent";

export type ConfidenceLabel = "Faible" | "Moyenne" | "Élevée";

export interface ReadinessSkillEstimate {
  skill_id: string;
  skill_code: string;
  skill_name: string;
  category?: string | null;
  current_score: number;
  target_score: number;
  target_gap: number;
  confidence: number;
  confidence_label: ConfidenceLabel;
  is_blocking: boolean;
  priority_rank: number;
  last_observed_at?: string | null;
  data_points_count: number;
  trend_label?: string | null;
}

export interface TargetGapItem {
  skill_id: string;
  skill_code: string;
  skill_name: string;
  category?: string | null;
  current_score: number;
  target_score: number;
  target_gap: number;
  confidence: number;
  is_blocking: boolean;
  priority_weight: number;
  recommended_focus: string;
}

export interface BlockingSkillItem {
  skill_id: string;
  skill_code: string;
  skill_name: string;
  category?: string | null;
  current_score: number;
  target_score: number;
  deficit: number;
  confidence: number;
  observation_count: number;
  impact_explanation: string;
  recommended_remedy: string;
}

export interface ReadinessTrendResponse {
  trend_7d?: number | null;
  trend_30d?: number | null;
  trend_90d?: number | null;
  trend_all_time?: number | null;
  score_change_per_week?: number | null;
  level_change_estimate?: string | null;
  data_points_count: number;
  sufficient_data_for_velocity: boolean;
}

export interface SkillEvidenceItem {
  id: string;
  skill_id: string;
  skill_code?: string | null;
  skill_name?: string | null;
  source_type: string;
  source_id: string;
  raw_score: number;
  normalized_score: number;
  confidence: number;
  weight: number;
  observed_at: string;
  metadata_payload?: Record<string, any>;
}

export interface ReadinessSnapshotItem {
  id: string;
  snapshot_version: string;
  overall_score_estimate?: number | null;
  confidence_overall: number;
  readiness_band: ReadinessBand;
  estimated_cefr?: string | null;
  estimated_nclc?: number | null;
  skills_breakdown: Record<string, any>;
  blocking_skills: string[];
  created_at: string;
}

export interface ReadinessProfileResponse {
  student_id: string;
  target_exam: string;
  target_level: string;
  target_score: number;
  exam_date?: string | null;
  calculation_version: string;
  overall_score_estimate?: number | null;
  confidence_overall: number;
  confidence_label: ConfidenceLabel;
  readiness_band: ReadinessBand;
  readiness_band_label: string;
  readiness_band_description: string;
  estimated_cefr?: string | null;
  estimated_nclc?: number | null;
  is_ready_for_target: boolean;
  skills: ReadinessSkillEstimate[];
  blocking_skills: BlockingSkillItem[];
  trend: ReadinessTrendResponse;
  last_calculated_at?: string | null;
  days_until_exam?: number | null;
  disclaimer: string;
}

export interface DailyPlanItem {
  id: string;
  item_type: "review" | "core_practice" | "diagnostic" | "refresh";
  title: string;
  description: string;
  skill_id?: string | null;
  skill_name?: string | null;
  exercise_id?: string | null;
  assessment_id?: string | null;
  estimated_minutes: number;
  difficulty_profile: "too_easy" | "appropriate" | "challenging";
  rationale: string;
  is_completed: boolean;
  action_url: string;
}

export interface DailyPlanResponse {
  date: string;
  total_minutes_allocated: number;
  daily_minutes_budget: number;
  completed_minutes: number;
  completion_percentage: number;
  items: DailyPlanItem[];
  summary: string;
  focus_skill?: string | null;
}

export interface ReassessmentStatusResponse {
  is_reassessment_recommended: boolean;
  cooldown_active: boolean;
  days_until_next_eligible: number;
  last_assessment_date?: string | null;
  triggers_met: string[];
  reasons: string[];
  recommended_assessment_id?: string | null;
  recommended_assessment_title?: string | null;
}
