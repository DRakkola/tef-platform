/**
 * React Query hooks for Readiness & Adaptive Learning Engine APIs.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ReadinessProfileResponse,
  TargetGapItem,
  BlockingSkillItem,
  ReadinessTrendResponse,
  SkillEvidenceItem,
  ReadinessSnapshotItem,
  DailyPlanResponse,
  ReassessmentStatusResponse,
} from "./types";

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
    credentials: "include",
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("AUTH_REQUIRED");
    }
    const err = await response.json().catch(() => null);
    throw new Error(err?.detail || err?.error?.message || `Erreur serveur (${response.status})`);
  }

  return response.json();
}

export function useReadinessProfile() {
  return useQuery<ReadinessProfileResponse>({
    queryKey: ["readiness", "profile"],
    queryFn: () => apiFetch<ReadinessProfileResponse>("/api/v1/students/me/readiness"),
    staleTime: 60_000,
  });
}

export function useReadinessGaps() {
  return useQuery<{ gaps: TargetGapItem[] }>({
    queryKey: ["readiness", "gaps"],
    queryFn: () => apiFetch<{ gaps: TargetGapItem[] }>("/api/v1/students/me/readiness/gaps"),
    staleTime: 60_000,
  });
}

export function useBlockingSkills() {
  return useQuery<{ blocking_skills: BlockingSkillItem[] }>({
    queryKey: ["readiness", "blockers"],
    queryFn: () => apiFetch<{ blocking_skills: BlockingSkillItem[] }>("/api/v1/students/me/readiness/blockers"),
    staleTime: 60_000,
  });
}

export function useReadinessTrends() {
  return useQuery<ReadinessTrendResponse>({
    queryKey: ["readiness", "trends"],
    queryFn: () => apiFetch<ReadinessTrendResponse>("/api/v1/students/me/readiness/trends"),
    staleTime: 60_000,
  });
}

export function useRecentEvidence(limit = 20) {
  return useQuery<{ evidence: SkillEvidenceItem[]; total_count: number }>({
    queryKey: ["readiness", "evidence", limit],
    queryFn: () => apiFetch<{ evidence: SkillEvidenceItem[]; total_count: number }>(`/api/v1/students/me/readiness/evidence?limit=${limit}`),
    staleTime: 30_000,
  });
}

export function useReadinessSnapshots(limit = 10) {
  return useQuery<{ snapshots: ReadinessSnapshotItem[] }>({
    queryKey: ["readiness", "snapshots", limit],
    queryFn: () => apiFetch<{ snapshots: ReadinessSnapshotItem[] }>(`/api/v1/students/me/readiness/snapshots?limit=${limit}`),
    staleTime: 60_000,
  });
}

export function useDailyPlan() {
  return useQuery<DailyPlanResponse>({
    queryKey: ["readiness", "daily-plan"],
    queryFn: () => apiFetch<DailyPlanResponse>("/api/v1/students/me/daily-plan"),
    staleTime: 30_000,
  });
}

export function useReassessmentStatus() {
  return useQuery<ReassessmentStatusResponse>({
    queryKey: ["readiness", "reassessment"],
    queryFn: () => apiFetch<ReassessmentStatusResponse>("/api/v1/students/me/readiness/reassessment"),
    staleTime: 60_000,
  });
}

export function useRecalculateReadiness() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<ReadinessProfileResponse>("/api/v1/students/me/readiness/recalculate", {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["readiness"] });
    },
  });
}

export function useUpdateDailyBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (daily_minutes_available: number) =>
      apiFetch<{ message: string; daily_minutes_budget: number }>("/api/v1/students/me/daily-plan/budget", {
        method: "PUT",
        body: JSON.stringify({ daily_minutes_available }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["readiness", "daily-plan"] });
    },
  });
}
