export interface SpeakingSessionDetails {
  id: string;
  sessionType: 'ai_practice' | 'teacher_guided';
  targetLevel: string;
  durationMinutes: number;
  status: 'scheduled' | 'waiting' | 'active' | 'completed' | 'expired' | 'cancelled';
  startsAt: string;
  expiresAt: string;
}

export interface SpeakingEvaluationReport {
  id: string;
  estimatedLevel: string;
  fluencyScore: number;
  vocabularyScore: number;
  grammarScore: number;
  pronunciationScore: number;
  strengths: string[];
  areasForImprovement: string[];
}
