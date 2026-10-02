export type SkillCategory =
  | "reading"
  | "listening"
  | "writing"
  | "speaking"
  | "vocabulary"
  | "grammar"
  | "conjugation";

export interface SubSkill {
  id: string;
  skill_id: string;
  code: string;
  name: string;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SkillUsageCounts {
  questions: number;
  exercises: number;
  assessments: number;
  student_mastery: number;
  skill_assessments: number;
  skill_evidence: number;
  writing_evaluations: number;
  speaking_evaluations: number;
  total_dependencies: number;
}

export interface SkillItem {
  id: string;
  code: string;
  name: string;
  category: SkillCategory | string;
  description?: string | null;
  parent_id?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  subskills: SubSkill[];
  usage_counts: SkillUsageCounts;
}

export interface TaxonomyIssue {
  skill_id: string;
  skill_code: string;
  skill_name: string;
  severity: "warning" | "info" | "error";
  message: string;
}

export interface SkillMetricsSummary {
  total_skills: number;
  total_subskills: number;
  domains_count: number;
  domain_breakdown: Record<string, number>;
  taxonomy_warnings_count: number;
  issues: TaxonomyIssue[];
}

export interface SkillFilterParams {
  q?: string;
  category?: string;
  is_active?: boolean;
  has_subskills?: boolean;
  parent_id?: string;
}

export interface SkillCreatePayload {
  code: string;
  name: string;
  category?: string;
  description?: string;
  parent_id?: string | null;
  is_active?: boolean;
}

export interface SkillUpdatePayload {
  code?: string;
  name?: string;
  category?: string;
  description?: string;
  is_active?: boolean;
}

export interface SubSkillCreatePayload {
  code: string;
  name: string;
  description?: string;
}

export interface SubSkillUpdatePayload {
  code?: string;
  name?: string;
  description?: string;
}
