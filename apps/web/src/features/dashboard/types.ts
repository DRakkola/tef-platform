/**
 * Domain types for student dashboard and learning loop progress.
 */

export interface SkillSummaryMetric {
  skill_id: string;
  skill_name: string;
  category: string;
  current_score: number;
  previous_score: number | null;
  change: number | null;
  confidence: number;
  confidence_label: "High" | "Moderate" | "Low" | "Calibration";
  insufficient_data: boolean;
  attempts_count: number;
  last_assessed_at: string | null;
}

export interface WeakestSkillSummary {
  skill_id: string;
  skill_name: string;
  category: string;
  mastery_score: number;
  attempts_count: number;
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
  completed_at: string;
}

export interface StudentDashboardData {
  student_id: string;
  student_name: string;
  target_exam: string;
  target_level: string;
  overall_readiness: number | null;
  skills: SkillSummaryMetric[];
  weakest_skills: WeakestSkillSummary[];
  recommended_exercises: RecommendedExerciseSummary[];
  recent_assessments: RecentAssessmentSummary[];
  recent_writings: RecentWritingSummary[];
  upcoming_bookings: UpcomingBookingSummary[];
  recent_speaking_sessions: RecentSpeakingSummary[];
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
}
