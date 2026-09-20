/**
 * Types and interfaces for the Student Exercise Player and Practice Catalog.
 */

export interface ExerciseOption {
  id?: string
  content: string
  order_index?: number
}

export interface ExerciseDetail {
  id: string
  title: string
  instructions?: string | null
  category: string
  level: string
  difficulty: number
  question_type: string
  prompt: string
  points: number
  options: ExerciseOption[]
  skills: string[]
  passage_text?: string | null
  media_url?: string | null
  allow_pause?: boolean
  allow_seek?: boolean
  allow_replay?: boolean
  max_replays?: number
  estimated_duration_minutes?: number
}

// Backward compatibility alias for catalog views
export type Exercise = ExerciseDetail

export interface ExerciseAttemptResult {
  id: string
  user_id?: string
  exercise_id?: string
  is_correct: boolean
  points_awarded: number
  user_response?: string | null
  correct_answer?: string | null
  explanation?: string | null
  attempted_at?: string
  // Legacy aliases
  exerciseId?: string
  scoreAchieved?: number
}

export type ExerciseState =
  | "loading"
  | "ready"
  | "submitting"
  | "feedback"
  | "completed"
  | "error"
  | "network_error"

export interface NextRecommendedActivity {
  id: string
  title: string
  category: string
  level: string
  duration_minutes?: number
  reason: string
  entity_id: string
  entity_type?: string
}
