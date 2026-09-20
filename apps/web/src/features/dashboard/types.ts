/**
 * Domain types for student dashboard, skill intelligence, and learning loop progress.
 */

export interface SkillSummaryMetric {
  skill_id: string;
  skill_name: string;
  category: string;
  current_score: number;
  previous_score: number | null;
  change: number | null;
  confidence: number;
  confidence_label: "High" | "Medium" | "Low" | "Calibration" | string;
  insufficient_data: boolean;
  trend?: "improving" | "declining" | "stable" | "insufficient_data" | string;
  estimated_level?: string | null;
  attempts_count: number;
  successful_attempts?: number;
  last_assessed_at: string | null;
}

export interface WeakestSkillSummary {
  skill_id: string;
  skill_name: string;
  category: string;
  mastery_score: number;
  reason?: string;
  recommended_exercise_id?: string | null;
  attempts_count?: number;
}

export interface RecommendedExerciseSummary {
  id: string;
  title: string;
  category: string;
  difficulty: number;
  level: string;
  target_skill_name: string;
  reason: string;
  priority: "critical" | "high" | "medium";
}

export interface RecentAssessmentSummary {
  id: string;
  title: string;
  assessment_type: string;
  score_percentage: number;
  passed: boolean;
  estimated_level: string;
  submitted_at: string;
}

export interface RecentWritingSummary {
  id: string;
  task_title: string;
  overall_score: number | null;
  estimated_level: string | null;
  submitted_at: string;
  status: string;
  corrected_at: string | null;
}

export interface UpcomingBookingSummary {
  id: string;
  teacher_name: string;
  start_time: string;
  end_time: string;
  status: string;
  meeting_link: string | null;
}

export interface RecentSpeakingSummary {
  id: string;
  session_type: string;
  overall_score: number | null;
  estimated_level: string | null;
  completed_at?: string;
  starts_at?: string;
  duration_minutes?: number;
  status?: string;
}

export interface DailyTaskItem {
  id: string;
  title: string;
  description: string;
  task_type: "exercise" | "assessment" | "mistake_review" | string;
  target_entity_id?: string | null;
  estimated_minutes: number;
  priority: string;
  is_completed: boolean;
}

export interface DailyPlanData {
  date: string;
  total_tasks: number;
  completed_tasks: number;
  completion_percentage: number;
  estimated_minutes_total: number;
  tasks: DailyTaskItem[];
  items?: DailyTaskItem[];
  daily_minutes_available?: number;
}

export interface ActivityItem {
  id: string;
  event_type: string;
  title: string;
  created_at: string;
  metadata: Record<string, any>;
}

export interface StudentDashboardData {
  student_id?: string;
  student_name?: string;
  target_exam: string;
  target_level: string;
  target_cefr_level?: string;
  target_nclc_level?: string;
  target_date?: string | null;
  days_remaining?: number | null;
  target_urgency?: "none" | "normal" | "urgent" | "critical" | "overdue" | string;
  score_gap?: number;
  level_distance?: number;
  is_target_met?: boolean;
  target_disclaimer?: string;
  native_language?: string | null;
  overall_readiness: number | null;
  current_cefr_level?: string | null;
  current_nclc_level?: string | null;
  total_assessments_taken: number;
  total_practice_minutes: number;
  skills: SkillSummaryMetric[];
  progress_history: ProgressDataPoint[];
  weakest_skills: WeakestSkillSummary[];
  strongest_skills?: WeakestSkillSummary[];
  daily_plan?: DailyPlanData | null;
  recommended_exercises: RecommendedExerciseSummary[];
  recent_assessments: RecentAssessmentSummary[];
  recent_writing_corrections: RecentWritingSummary[];
  upcoming_bookings: UpcomingBookingSummary[];
  recent_speaking_sessions: RecentSpeakingSummary[];
  recent_activity?: ActivityItem[];
  segment?: string;
  engagement_status?: EngagementStatus;
}

export interface EngagementStatus {
  status: "on_track" | "needs_reengagement" | "at_risk" | "dormant" | "new" | string;
  label_fr: string;
  days_inactive: number;
  pending_writing_corrections: number;
  incomplete_recommendations: number;
  unresolved_blockers: number;
  risk_factors: string[];
}

export interface ProgressDataPoint {
  timestamp: string;
  overall_score: number;
  assessment_title: string;
  source_type: "assessment" | "writing" | "speaking" | "exercise";
  category?: string;
}

export interface StudentProgressData {
  timeline: ProgressDataPoint[];
  skills: SkillSummaryMetric[];
  overall_score?: number | null;
  estimated_cefr_level?: string | null;
  estimated_nclc_level?: string | null;
  disclaimer?: string;
}
