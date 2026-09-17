export type Role = "student" | "teacher" | "admin";

export interface User {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
}

export type SkillCategory =
  | "reading"
  | "listening"
  | "writing"
  | "speaking"
  | "vocabulary"
  | "grammar"
  | "conjugation";

export interface SkillScore {
  skillId: string;
  name: string;
  category: SkillCategory;
  score: number;
  confidence: number;
}
