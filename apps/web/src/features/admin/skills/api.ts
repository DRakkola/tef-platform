import { apiClient } from "@/core/api";
import type {
  SkillFilterParams,
  SkillItem,
  SkillMetricsSummary,
  SkillCreatePayload,
  SkillUpdatePayload,
  SubSkill,
  SubSkillCreatePayload,
  SubSkillUpdatePayload,
} from "./types";

export async function fetchSkills(params?: SkillFilterParams): Promise<SkillItem[]> {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.category && params.category !== "all") query.set("category", params.category);
  if (params?.is_active !== undefined) query.set("is_active", String(params.is_active));
  if (params?.has_subskills !== undefined) query.set("has_subskills", String(params.has_subskills));
  if (params?.parent_id) query.set("parent_id", params.parent_id);

  const qs = query.toString();
  return apiClient<SkillItem[]>(`/admin/content/skills${qs ? `?${qs}` : ""}`);
}

export async function getSkill(id: string): Promise<SkillItem> {
  return apiClient<SkillItem>(`/admin/content/skills/${id}`);
}

export async function fetchSkillMetricsSummary(): Promise<SkillMetricsSummary> {
  return apiClient<SkillMetricsSummary>("/admin/content/skills/metrics/summary");
}

export async function createSkill(payload: SkillCreatePayload): Promise<SkillItem> {
  return apiClient<SkillItem>("/admin/content/skills", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateSkill(id: string, payload: SkillUpdatePayload): Promise<SkillItem> {
  return apiClient<SkillItem>(`/admin/content/skills/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteSkill(id: string): Promise<void> {
  return apiClient<void>(`/admin/content/skills/${id}`, {
    method: "DELETE",
  });
}

export async function createSubSkill(
  skillId: string,
  payload: SubSkillCreatePayload
): Promise<SubSkill> {
  return apiClient<SubSkill>(`/admin/content/skills/${skillId}/subskills`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateSubSkill(
  subskillId: string,
  payload: SubSkillUpdatePayload
): Promise<SubSkill> {
  return apiClient<SubSkill>(`/admin/content/subskills/${subskillId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteSubSkill(subskillId: string): Promise<void> {
  return apiClient<void>(`/admin/content/subskills/${subskillId}`, {
    method: "DELETE",
  });
}
