export type AssessmentType = 'reading' | 'listening' | 'mixed';

export interface AssessmentSummary {
  id: string;
  title: string;
  type: AssessmentType;
  level: string;
  durationMinutes: number;
  totalQuestions: number;
  isPublished: boolean;
}

export interface AssessmentAttempt {
  id: string;
  assessmentId: string;
  userId: string;
  status: 'created' | 'started' | 'submitted' | 'expired' | 'abandoned';
  score?: number;
  maxScore?: number;
  startedAt: string;
  expiresAt: string;
  submittedAt?: string;
}
