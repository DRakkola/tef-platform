export interface ExerciseOption {
  id: string;
  content: string;
}

export interface Exercise {
  id: string;
  title: string;
  category: string;
  level: string;
  difficulty: number;
  prompt: string;
  points: number;
  options: ExerciseOption[];
}

export interface ExerciseAttemptResult {
  id: string;
  exerciseId: string;
  isCorrect: boolean;
  scoreAchieved: number;
  explanation?: string;
}
