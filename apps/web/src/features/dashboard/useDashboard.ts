/**
 * Data fetching hook for student dashboard and progress metrics.
 */

import { useQuery } from "@tanstack/react-query";
import type { StudentDashboardData, StudentProgressData } from "./types";

async function fetchDashboardData(): Promise<StudentDashboardData> {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = {
    "Accept": "application/json",
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch("/api/v1/students/me/dashboard", {
    method: "GET",
    headers,
    credentials: "include",
  });

  const contentType = response.headers?.get ? response.headers.get("content-type") || "" : "application/json";

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("AUTH_REQUIRED");
    }
    if (contentType.includes("application/json")) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.error?.message || `Erreur serveur (${response.status})`);
    }
    throw new Error(`Erreur réseau (${response.status}: ${response.statusText})`);
  }

  if (contentType && !contentType.includes("application/json")) {
    throw new Error(`Réponse inattendue du serveur: attendu JSON, reçu ${contentType || "HTML"}`);
  }

  return response.json();
}

async function fetchProgressData(): Promise<StudentProgressData> {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = {
    "Accept": "application/json",
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch("/api/v1/students/me/progress", {
    method: "GET",
    headers,
    credentials: "include",
  });

  const contentType = response.headers?.get ? response.headers.get("content-type") || "" : "application/json";

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("AUTH_REQUIRED");
    }
    if (contentType.includes("application/json")) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.error?.message || `Erreur serveur (${response.status})`);
    }
    throw new Error(`Erreur réseau (${response.status}: ${response.statusText})`);
  }

  if (contentType && !contentType.includes("application/json")) {
    throw new Error(`Réponse inattendue du serveur: attendu JSON, reçu ${contentType || "HTML"}`);
  }

  return response.json();
}

export function useStudentDashboard() {
  const dashboardQuery = useQuery({
    queryKey: ["student", "dashboard"],
    queryFn: fetchDashboardData,
    staleTime: 60 * 1000,
  });

  const progressQuery = useQuery({
    queryKey: ["student", "progress"],
    queryFn: fetchProgressData,
    staleTime: 60 * 1000,
  });

  return {
    dashboard: dashboardQuery.data,
    progress: progressQuery.data,
    isLoading: dashboardQuery.isLoading || progressQuery.isLoading,
    isError: dashboardQuery.isError || progressQuery.isError,
    error: dashboardQuery.error || progressQuery.error,
    refetch: () => {
      dashboardQuery.refetch();
      progressQuery.refetch();
    },
  };
}
