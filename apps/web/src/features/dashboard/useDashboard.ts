/**
 * Data fetching hook for student dashboard and progress metrics.
 */

import { useQuery } from "@tanstack/react-query";
import type { StudentDashboardData, StudentProgressData } from "./types";

async function fetchDashboardData(): Promise<StudentDashboardData> {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = {
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

  if (!response.ok) {
    throw new Error(`Failed to load student dashboard: ${response.statusText}`);
  }

  return response.json();
}

async function fetchProgressData(): Promise<StudentProgressData> {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = {
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

  if (!response.ok) {
    throw new Error(`Failed to load student progress: ${response.statusText}`);
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
