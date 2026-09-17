export interface SkillProgressPoint {
  date: string;
  score: number;
  confidence: number;
}

export interface ProgressOverTime {
  skillId: string;
  skillName: string;
  category: string;
  history: SkillProgressPoint[];
}
