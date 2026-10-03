import { apiClient } from "@/core/api";
import type {
  SkillFilterParams,
  TaxonomyMetadata,
  TaxonomyVersion,
  TaxonomyTreeNode,
  TaxonomySkillListResponse,
  TaxonomySkillDetail,
  SkillCreatePayload,
  SkillUpdatePayload,
  ChildSkillCreatePayload,
  SkillLevelDescriptor,
  SkillLevelDescriptorPayload,
  SkillRelationsList,
  SkillRelation,
  SkillRelationCreatePayload,
  TaskType,
} from "./types";

export async function fetchTaxonomyMetadata(): Promise<TaxonomyMetadata> {
  return apiClient<TaxonomyMetadata>("/admin/taxonomy/metadata");
}

export async function fetchTaxonomyVersions(): Promise<TaxonomyVersion[]> {
  return apiClient<TaxonomyVersion[]>("/admin/taxonomy/versions");
}

export async function fetchTaxonomyTree(params?: {
  version_id?: string;
  dimension?: string;
  domain?: string;
  is_active?: boolean;
}): Promise<TaxonomyTreeNode[]> {
  const query = new URLSearchParams();
  if (params?.version_id) query.set("version_id", params.version_id);
  if (params?.dimension && params.dimension !== "all") query.set("dimension", params.dimension);
  if (params?.domain && params.domain !== "all") query.set("domain", params.domain);
  if (params?.is_active !== undefined) query.set("is_active", String(params.is_active));

  const qs = query.toString();
  return apiClient<TaxonomyTreeNode[]>(`/admin/taxonomy/tree${qs ? `?${qs}` : ""}`);
}

export async function fetchTaxonomySkills(params?: SkillFilterParams): Promise<TaxonomySkillListResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.page_size) query.set("page_size", String(params.page_size));
  if (params?.q) query.set("q", params.q);
  if (params?.dimension && params.dimension !== "all") query.set("dimension", params.dimension);
  if (params?.domain && params.domain !== "all") query.set("domain", params.domain);
  if (params?.is_active !== undefined) query.set("is_active", String(params.is_active));
  if (params?.parent_id) query.set("parent_id", params.parent_id);
  if (params?.roots_only !== undefined) query.set("roots_only", String(params.roots_only));
  if (params?.sort_by) query.set("sort_by", params.sort_by);
  if (params?.sort_dir) query.set("sort_dir", params.sort_dir);

  const qs = query.toString();
  return apiClient<TaxonomySkillListResponse>(`/admin/taxonomy/skills${qs ? `?${qs}` : ""}`);
}

export async function getSkillDetail(id: string): Promise<TaxonomySkillDetail> {
  return apiClient<TaxonomySkillDetail>(`/admin/taxonomy/skills/${id}`);
}

export async function createSkill(payload: SkillCreatePayload): Promise<TaxonomySkillDetail> {
  return apiClient<TaxonomySkillDetail>("/admin/taxonomy/skills", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateSkill(id: string, payload: SkillUpdatePayload): Promise<TaxonomySkillDetail> {
  return apiClient<TaxonomySkillDetail>(`/admin/taxonomy/skills/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function archiveSkill(id: string): Promise<TaxonomySkillDetail> {
  return apiClient<TaxonomySkillDetail>(`/admin/taxonomy/skills/${id}/archive`, {
    method: "POST",
  });
}

export async function restoreSkill(id: string): Promise<TaxonomySkillDetail> {
  return apiClient<TaxonomySkillDetail>(`/admin/taxonomy/skills/${id}/restore`, {
    method: "POST",
  });
}

export async function deleteSkill(id: string): Promise<void> {
  return apiClient<void>(`/admin/taxonomy/skills/${id}`, {
    method: "DELETE",
  });
}

export async function createChildSkill(
  parentId: string,
  payload: ChildSkillCreatePayload
): Promise<TaxonomySkillDetail> {
  return apiClient<TaxonomySkillDetail>(`/admin/taxonomy/skills/${parentId}/children`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function reparentSkill(
  skillId: string,
  newParentId: string | null
): Promise<TaxonomySkillDetail> {
  return apiClient<TaxonomySkillDetail>(`/admin/taxonomy/skills/${skillId}/parent`, {
    method: "PUT",
    body: JSON.stringify({ new_parent_id: newParentId }),
  });
}

export async function fetchSkillDescriptors(skillId: string): Promise<SkillLevelDescriptor[]> {
  return apiClient<SkillLevelDescriptor[]>(`/admin/taxonomy/skills/${skillId}/descriptors`);
}

export async function upsertSkillDescriptor(
  skillId: string,
  payload: SkillLevelDescriptorPayload
): Promise<SkillLevelDescriptor> {
  return apiClient<SkillLevelDescriptor>(`/admin/taxonomy/skills/${skillId}/descriptors`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteSkillDescriptor(skillId: string, level: string): Promise<void> {
  return apiClient<void>(`/admin/taxonomy/skills/${skillId}/descriptors/${level}`, {
    method: "DELETE",
  });
}

export async function fetchSkillRelations(skillId: string): Promise<SkillRelationsList> {
  return apiClient<SkillRelationsList>(`/admin/taxonomy/skills/${skillId}/relations`);
}

export async function createSkillRelation(
  skillId: string,
  payload: SkillRelationCreatePayload
): Promise<SkillRelation> {
  return apiClient<SkillRelation>(`/admin/taxonomy/skills/${skillId}/relations`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteSkillRelation(skillId: string, relationId: string): Promise<void> {
  return apiClient<void>(`/admin/taxonomy/skills/${skillId}/relations/${relationId}`, {
    method: "DELETE",
  });
}

export async function fetchTaskTypes(modality?: string): Promise<TaskType[]> {
  const query = new URLSearchParams();
  if (modality && modality !== "all") query.set("modality", modality);
  const qs = query.toString();
  return apiClient<TaskType[]>(`/admin/taxonomy/task-types${qs ? `?${qs}` : ""}`);
}

// Aliases for compatibility
export const fetchSkills = async (params?: SkillFilterParams) => {
  const resp = await fetchTaxonomySkills({ ...params, page_size: 100 });
  return resp.items;
};

export const getSkill = getSkillDetail;

export const fetchSkillMetricsSummary = async () => {
  const meta = await fetchTaxonomyMetadata();
  return meta.metrics;
};
