/**
 * API client functions for Content Management / Content Studio.
 */

import { apiClient } from "@/core/api";
import type {
  AssessmentItem,
  AssessmentSectionItem,
  AssessmentVersionItem,
  AuditEventItem,
  ContentReviewItem,
  ContentStatus,
  ExerciseItem,
  MediaAssetItem,
  QuestionItem,
  QuestionSkillTag,
  SkillItem,
  SubSkill,
  ValidationReport,
  WritingTaskItem,
} from "./types";

// ---------------------------------------------------------------------------
// Skills & Subskills
// ---------------------------------------------------------------------------

export async function fetchSkills(): Promise<SkillItem[]> {
  return apiClient<SkillItem[]>("/admin/content/skills");
}

export async function createSkill(payload: {
  code: string;
  name: string;
  category: string;
  description?: string;
  is_active?: boolean;
}): Promise<SkillItem> {
  return apiClient<SkillItem>("/admin/content/skills", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateSkill(
  id: string,
  payload: {
    code?: string;
    name?: string;
    category?: string;
    description?: string;
    is_active?: boolean;
  }
): Promise<SkillItem> {
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
  payload: { code: string; name: string; description?: string }
): Promise<SubSkill> {
  return apiClient<SubSkill>(`/admin/content/skills/${skillId}/subskills`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateSubSkill(
  subskillId: string,
  payload: { name?: string; description?: string }
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

// ---------------------------------------------------------------------------
// Assessments
// ---------------------------------------------------------------------------

export async function fetchAssessments(params?: {
  status?: ContentStatus;
  assessment_type?: string;
  page?: number;
  page_size?: number;
}): Promise<{ items: AssessmentItem[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.assessment_type) query.set("assessment_type", params.assessment_type);
  if (params?.page) query.set("page", params.page.toString());
  if (params?.page_size) query.set("page_size", params.page_size.toString());

  const qs = query.toString();
  return apiClient<{ items: AssessmentItem[]; total: number }>(
    `/admin/content/assessments${qs ? `?${qs}` : ""}`
  );
}

export async function getAssessment(id: string): Promise<AssessmentItem> {
  return apiClient<AssessmentItem>(`/admin/content/assessments/${id}`);
}

export async function createAssessment(payload: {
  title: string;
  description?: string;
  assessment_type: string;
  duration_seconds: number;
  navigation_policy?: string;
  scoring_policy?: string;
  pass_percentage?: number;
  status?: ContentStatus;
}): Promise<AssessmentItem> {
  return apiClient<AssessmentItem>("/admin/content/assessments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAssessment(
  id: string,
  payload: Partial<AssessmentItem>
): Promise<AssessmentItem> {
  return apiClient<AssessmentItem>(`/admin/content/assessments/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function addAssessmentSection(
  assessmentId: string,
  payload: {
    title: string;
    instructions?: string;
    order_index?: number;
    time_limit_seconds?: number;
    media_url?: string;
    passage_text?: string;
  }
): Promise<AssessmentSectionItem> {
  return apiClient<AssessmentSectionItem>(
    `/admin/content/assessments/${assessmentId}/sections`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function addSectionQuestion(
  sectionId: string,
  payload: {
    prompt: string;
    question_type: string;
    order_index?: number;
    difficulty?: number;
    level?: string;
    explanation?: string;
    points?: number;
    penalty_points?: number;
    media_url?: string;
    options: Array<{
      content: string;
      order_index?: number;
      is_correct: boolean;
      explanation?: string;
    }>;
    skill_tags?: QuestionSkillTag[];
  }
): Promise<QuestionItem> {
  return apiClient<QuestionItem>(
    `/admin/content/sections/${sectionId}/questions`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function validateAssessment(id: string): Promise<ValidationReport> {
  return apiClient<ValidationReport>(
    `/admin/content/assessments/${id}/validate`,
    { method: "POST" }
  );
}

export async function publishAssessment(id: string): Promise<AssessmentItem> {
  return apiClient<AssessmentItem>(
    `/admin/content/assessments/${id}/publish`,
    { method: "POST" }
  );
}

export async function forkAssessmentVersion(id: string): Promise<AssessmentItem> {
  return apiClient<AssessmentItem>(
    `/admin/content/assessments/${id}/new-version`,
    { method: "POST" }
  );
}

export async function submitAssessmentForReview(
  id: string,
  comments?: string
): Promise<ContentReviewItem> {
  return apiClient<ContentReviewItem>(
    `/admin/content/assessments/${id}/submit-review`,
    {
      method: "POST",
      body: JSON.stringify({ comments }),
    }
  );
}

export async function fetchAssessmentVersions(
  id: string
): Promise<AssessmentVersionItem[]> {
  return apiClient<AssessmentVersionItem[]>(
    `/admin/content/assessments/${id}/versions`
  );
}

// ---------------------------------------------------------------------------
// Standalone Questions
// ---------------------------------------------------------------------------

export async function fetchQuestions(params?: {
  section_id?: string;
  level?: string;
  difficulty?: number;
  question_type?: string;
  page?: number;
  page_size?: number;
}): Promise<{ items: QuestionItem[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.section_id) query.set("section_id", params.section_id);
  if (params?.level) query.set("level", params.level);
  if (params?.difficulty) query.set("difficulty", params.difficulty.toString());
  if (params?.question_type) query.set("question_type", params.question_type);
  if (params?.page) query.set("page", params.page.toString());
  if (params?.page_size) query.set("page_size", params.page_size.toString());

  const qs = query.toString();
  return apiClient<{ items: QuestionItem[]; total: number }>(
    `/admin/content/questions${qs ? `?${qs}` : ""}`
  );
}

export async function getQuestion(id: string): Promise<QuestionItem> {
  return apiClient<QuestionItem>(`/admin/content/questions/${id}`);
}

export async function updateQuestion(
  id: string,
  payload: Partial<QuestionItem>
): Promise<QuestionItem> {
  return apiClient<QuestionItem>(`/admin/content/questions/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function forkQuestionVersion(id: string): Promise<QuestionItem> {
  return apiClient<QuestionItem>(`/admin/content/questions/${id}/new-version`, {
    method: "POST",
  });
}

export async function fetchQuestionVersions(id: string): Promise<any[]> {
  return apiClient<any[]>(`/admin/content/questions/${id}/versions`);
}

// ---------------------------------------------------------------------------
// Exercises
// ---------------------------------------------------------------------------

export async function fetchExercises(params?: {
  category?: string;
  level?: string;
  status?: ContentStatus;
  page?: number;
  page_size?: number;
}): Promise<{ items: ExerciseItem[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.category) query.set("category", params.category);
  if (params?.level) query.set("level", params.level);
  if (params?.status) query.set("status", params.status);
  if (params?.page) query.set("page", params.page.toString());
  if (params?.page_size) query.set("page_size", params.page_size.toString());

  const qs = query.toString();
  return apiClient<{ items: ExerciseItem[]; total: number }>(
    `/admin/content/exercises${qs ? `?${qs}` : ""}`
  );
}

export async function createExercise(payload: {
  title: string;
  prompt: string;
  category: string;
  level: string;
  difficulty: number;
  points?: number;
  instructions?: string;
  explanation?: string;
  options_payload: any[];
  status?: ContentStatus;
}): Promise<ExerciseItem> {
  return apiClient<ExerciseItem>("/admin/content/exercises", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateExercise(
  id: string,
  payload: Partial<ExerciseItem>
): Promise<ExerciseItem> {
  return apiClient<ExerciseItem>(`/admin/content/exercises/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function publishExercise(id: string): Promise<ExerciseItem> {
  return apiClient<ExerciseItem>(`/admin/content/exercises/${id}/publish`, {
    method: "POST",
  });
}

export async function forkExerciseVersion(id: string): Promise<ExerciseItem> {
  return apiClient<ExerciseItem>(`/admin/content/exercises/${id}/new-version`, {
    method: "POST",
  });
}

export async function fetchExerciseVersions(id: string): Promise<any[]> {
  return apiClient<any[]>(`/admin/content/exercises/${id}/versions`);
}

// ---------------------------------------------------------------------------
// Writing Tasks
// ---------------------------------------------------------------------------

export async function fetchWritingTasks(params?: {
  task_type?: string;
  level?: string;
  status?: ContentStatus;
  page?: number;
  page_size?: number;
}): Promise<{ items: WritingTaskItem[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.task_type) query.set("task_type", params.task_type);
  if (params?.level) query.set("level", params.level);
  if (params?.status) query.set("status", params.status);
  if (params?.page) query.set("page", params.page.toString());
  if (params?.page_size) query.set("page_size", params.page_size.toString());

  const qs = query.toString();
  return apiClient<{ items: WritingTaskItem[]; total: number }>(
    `/admin/content/writing-tasks${qs ? `?${qs}` : ""}`
  );
}

export async function createWritingTask(payload: {
  title: string;
  task_type: string;
  prompt: string;
  stimulus_text?: string;
  min_words: number;
  max_words: number;
  duration_minutes: number;
  target_level: string;
  status?: ContentStatus;
}): Promise<WritingTaskItem> {
  return apiClient<WritingTaskItem>("/admin/content/writing-tasks", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateWritingTask(
  id: string,
  payload: Partial<WritingTaskItem>
): Promise<WritingTaskItem> {
  return apiClient<WritingTaskItem>(`/admin/content/writing-tasks/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function publishWritingTask(id: string): Promise<WritingTaskItem> {
  return apiClient<WritingTaskItem>(`/admin/content/writing-tasks/${id}/publish`, {
    method: "POST",
  });
}

export async function forkWritingTaskVersion(id: string): Promise<WritingTaskItem> {
  return apiClient<WritingTaskItem>(
    `/admin/content/writing-tasks/${id}/new-version`,
    { method: "POST" }
  );
}

export async function fetchWritingTaskVersions(id: string): Promise<any[]> {
  return apiClient<any[]>(`/admin/content/writing-tasks/${id}/versions`);
}

// ---------------------------------------------------------------------------
// Media Assets
// ---------------------------------------------------------------------------

export async function fetchMediaAssets(params?: {
  media_type?: string;
  page?: number;
  page_size?: number;
}): Promise<{ items: MediaAssetItem[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.media_type) query.set("media_type", params.media_type);
  if (params?.page) query.set("page", params.page.toString());
  if (params?.page_size) query.set("page_size", params.page_size.toString());

  const qs = query.toString();
  return apiClient<{ items: MediaAssetItem[]; total: number }>(
    `/admin/media${qs ? `?${qs}` : ""}`
  );
}

export async function uploadMediaAsset(
  file: File,
  title: string,
  mediaType: string,
  isPublic: boolean = false
): Promise<MediaAssetItem> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", title);
  formData.append("media_type", mediaType);
  formData.append("is_public", isPublic ? "true" : "false");

  return apiClient<MediaAssetItem>("/admin/media/upload", {
    method: "POST",
    body: formData,
  });
}

export async function getMediaPresignedUrl(
  mediaId: string,
  expiresSeconds: number = 3600
): Promise<{ url: string; expires_in: number }> {
  return apiClient<{ url: string; expires_in: number }>(
    `/admin/media/${mediaId}/presigned-url?expires_seconds=${expiresSeconds}`
  );
}

export async function deleteMediaAsset(mediaId: string): Promise<void> {
  return apiClient<void>(`/admin/media/${mediaId}`, {
    method: "DELETE",
  });
}

// ---------------------------------------------------------------------------
// Review Queue
// ---------------------------------------------------------------------------

export async function fetchReviews(params?: {
  status?: string;
  entity_type?: string;
  page?: number;
  page_size?: number;
}): Promise<{ items: ContentReviewItem[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.entity_type) query.set("entity_type", params.entity_type);
  if (params?.page) query.set("page", params.page.toString());
  if (params?.page_size) query.set("page_size", params.page_size.toString());

  const qs = query.toString();
  return apiClient<{ items: ContentReviewItem[]; total: number }>(
    `/admin/content/reviews${qs ? `?${qs}` : ""}`
  );
}

export async function decideReview(
  reviewId: string,
  decision: "approve" | "reject",
  comments?: string
): Promise<ContentReviewItem> {
  return apiClient<ContentReviewItem>(
    `/admin/content/reviews/${reviewId}/decision`,
    {
      method: "POST",
      body: JSON.stringify({ decision, comments }),
    }
  );
}

// ---------------------------------------------------------------------------
// Audit Trail Logs
// ---------------------------------------------------------------------------

export async function fetchAuditLogs(params?: {
  entity_type?: string;
  action?: string;
  page?: number;
  page_size?: number;
}): Promise<{ items: AuditEventItem[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.entity_type) query.set("entity_type", params.entity_type);
  if (params?.action) query.set("action", params.action);
  if (params?.page) query.set("page", params.page.toString());
  if (params?.page_size) query.set("page_size", params.page_size.toString());

  const qs = query.toString();
  return apiClient<{ items: AuditEventItem[]; total: number }>(
    `/admin/audit-logs${qs ? `?${qs}` : ""}`
  );
}
