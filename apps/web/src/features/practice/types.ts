import type React from "react"

export type SkillCategory =
  | "reading"
  | "listening"
  | "writing"
  | "speaking"
  | "grammar"
  | "vocabulary"
  | "conjugation"

export type CEFRLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "all"

export interface PracticeExerciseItem {
  id: string
  title: string
  instructions?: string | null
  category: string
  level: string
  difficulty: number
  question_type: string
  prompt?: string
  estimated_minutes?: number
  points?: number
  skills?: string[]
  is_completed?: boolean
  user_score?: number
}

export interface PracticeRecommendationItem {
  id: string
  entity_type: string
  entity_id: string
  title: string
  category: string
  level: string
  difficulty?: number
  reason: string
  priority: number
  priority_label?: string
  estimated_minutes?: number
  status?: string
}

export interface DailyPracticeTask {
  id: string
  title: string
  description: string
  task_type: string
  target_entity_id?: string | null
  estimated_minutes: number
  priority: string
  is_completed: boolean
}

export interface DailyPracticePlanData {
  date: string
  daily_minutes_available?: number
  total_tasks: number
  completed_tasks: number
  completion_percentage: number
  estimated_minutes_total: number
  tasks: DailyPracticeTask[]
}

export interface PracticeCategoryItem {
  id: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  count?: number
}

export interface PracticeFiltersState {
  category: string
  level: string
  difficulty: string
  duration: string
  search: string
}

export interface RecentPracticeAttempt {
  id: string
  exercise_id: string
  title: string
  category: string
  level?: string
  is_correct: boolean
  points_awarded?: number
  attempted_at: string
}
