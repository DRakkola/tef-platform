export interface WritingTaskSummary {
  id: string;
  title: string;
  sectionType: 'section_a' | 'section_b';
  level: string;
  targetWordCount: number;
  timeLimitMinutes: number;
  prompt: string;
}

export interface WritingCorrectionResult {
  id: string;
  overallScore: number;
  grammarScore: number;
  vocabularyScore: number;
  coherenceScore: number;
  feedback: string;
}
