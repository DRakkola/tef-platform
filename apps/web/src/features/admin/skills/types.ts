export type SkillDimension = "reasoning" | "language";

export type SkillRelationType = "prerequisite" | "depends_on" | "supports" | "related";

export type CEFRBand = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export type TaxonomyLifecycleStatus = "draft" | "active" | "deprecated" | "archived";

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

export interface SkillLevelDescriptor {
  id: string;
  skill_id: string;
  level: CEFRBand;
  descriptor: string;
  evidence_guidance?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SkillRelation {
  id: string;
  from_skill_id: string;
  to_skill_id: string;
  relation_type: SkillRelationType;
  target_skill_code?: string | null;
  target_skill_name?: string | null;
  target_skill_dimension?: string | null;
  created_at: string;
}

export interface SkillRelationsList {
  outgoing: SkillRelation[];
  incoming: SkillRelation[];
}

export interface TaxonomySkillSummary {
  id: string;
  code: string;
  name: string;
  dimension: SkillDimension;
  domain: string;
  category?: string | null;
  is_active: boolean;
}

export interface TaxonomySkillItem {
  id: string;
  taxonomy_version_id: string;
  code: string;
  name: string;
  dimension: SkillDimension;
  domain: string;
  category?: string | null;
  description?: string | null;
  parent_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  subskill_count: number;
  usage_counts: SkillUsageCounts;
}

export interface TaxonomySkillDetail {
  id: string;
  taxonomy_version_id: string;
  code: string;
  name: string;
  dimension: SkillDimension;
  domain: string;
  category?: string | null;
  description?: string | null;
  parent_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  parent?: TaxonomySkillSummary | null;
  children: TaxonomySkillSummary[];
  level_descriptors: SkillLevelDescriptor[];
  outgoing_relations: SkillRelation[];
  incoming_relations: SkillRelation[];
  usage_counts: SkillUsageCounts;
}

export interface TaxonomyTreeNode {
  id: string;
  code: string;
  name: string;
  dimension: SkillDimension;
  domain: string;
  category?: string | null;
  description?: string | null;
  parent_id?: string | null;
  is_active: boolean;
  children: TaxonomyTreeNode[];
  level_descriptors: SkillLevelDescriptor[];
  usage_counts: SkillUsageCounts;
}

export interface TaxonomySkillListResponse {
  items: TaxonomySkillItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface TaxonomyMetricsSummary {
  total_skills: number;
  total_subskills: number;
  total_competencies: number;
  dimensions_breakdown: Record<string, number>;
  domains_breakdown: Record<string, number>;
  active_skills: number;
  archived_skills: number;
  total_relations: number;
  total_descriptors: number;
}

export interface TaxonomyVersion {
  id: string;
  version: string;
  name: string;
  status: TaxonomyLifecycleStatus;
  description?: string | null;
  activated_at?: string | null;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
  skill_count: number;
}

export interface TaxonomyMetadata {
  dimensions: string[];
  domains: string[];
  relation_types: string[];
  cefr_bands: string[];
  active_version?: TaxonomyVersion | null;
  metrics: TaxonomyMetricsSummary;
}

export interface TaskType {
  id: string;
  modality: string;
  code: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SkillFilterParams {
  q?: string;
  dimension?: string;
  domain?: string;
  modality?: string;
  status?: string;
  is_active?: boolean;
  parent_id?: string;
  roots_only?: boolean;
  task_type_id?: string;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_dir?: string;
}

export interface SkillCreatePayload {
  code: string;
  name: string;
  dimension: SkillDimension;
  domain: string;
  category?: string | null;
  description?: string | null;
  parent_id?: string | null;
  is_active?: boolean;
}

export interface SkillUpdatePayload {
  code?: string;
  name?: string;
  dimension?: SkillDimension;
  domain?: string;
  category?: string | null;
  description?: string | null;
  parent_id?: string | null;
  is_active?: boolean;
}

export interface ChildSkillCreatePayload {
  code: string;
  name: string;
  dimension?: SkillDimension;
  domain?: string;
  category?: string | null;
  description?: string | null;
  is_active?: boolean;
}

export interface SkillLevelDescriptorPayload {
  level: CEFRBand;
  descriptor: string;
  evidence_guidance?: string | null;
}

export interface SkillRelationCreatePayload {
  to_skill_id: string;
  relation_type: SkillRelationType;
}

// Backward-compatibility aliases for legacy consumer imports
export type SkillItem = TaxonomySkillItem;
export type SubSkill = TaxonomySkillSummary;
export type SkillMetricsSummary = TaxonomyMetricsSummary;
