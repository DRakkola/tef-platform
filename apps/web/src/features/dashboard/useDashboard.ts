/**
 * Data fetching hook for student dashboard and progress metrics.
 * Provides resilient error handling, centralized auth expiration interception,
 * and independent progress streaming to prevent cascade dashboard failures.
 */

import { useQuery } from "@tanstack/react-query"
import type { StudentDashboardData, StudentProgressData } from "./types"

export class AuthRequiredError extends Error {
  constructor(message = "Votre session a expiré ou une authentification est requise.") {
    super(message)
    this.name = "AuthRequiredError"
  }
}

async function fetchDashboardData(): Promise<StudentDashboardData> {
  const token = localStorage.getItem("auth_token")
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const response = await fetch("/api/v1/students/me/dashboard", {
    method: "GET",
    headers,
    credentials: "include",
  })

  const contentType = response.headers?.get ? response.headers.get("content-type") || "" : "application/json"

  if (!response.ok) {
    if (response.status === 401) {
      // Clear token to prevent repeated failed loops
      try {
        localStorage.removeItem("auth_token")
      } catch {
        // Ignore storage errors in sandboxed environments
      }
      throw new AuthRequiredError("AUTH_REQUIRED")
    }
    if (contentType.includes("application/json")) {
      const err = await response.json().catch(() => null)
      throw new Error(err?.error?.message || `Erreur serveur (${response.status})`)
    }
    throw new Error(`Erreur réseau (${response.status}: ${response.statusText})`)
  }

  if (contentType && !contentType.includes("application/json")) {
    throw new Error(`Réponse inattendue du serveur: attendu JSON, reçu ${contentType || "HTML"}`)
  }

  return response.json()
}

async function fetchProgressData(): Promise<StudentProgressData> {
  const token = localStorage.getItem("auth_token")
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const response = await fetch("/api/v1/students/me/progress", {
    method: "GET",
    headers,
    credentials: "include",
  })

  const contentType = response.headers?.get ? response.headers.get("content-type") || "" : "application/json"

  if (!response.ok) {
    if (response.status === 401) {
      try {
        localStorage.removeItem("auth_token")
      } catch {
        // Ignore
      }
      throw new AuthRequiredError("AUTH_REQUIRED")
    }
    if (contentType.includes("application/json")) {
      const err = await response.json().catch(() => null)
      throw new Error(err?.error?.message || `Erreur serveur (${response.status})`)
    }
    throw new Error(`Erreur réseau (${response.status}: ${response.statusText})`)
  }

  if (contentType && !contentType.includes("application/json")) {
    throw new Error(`Réponse inattendue du serveur: attendu JSON, reçu ${contentType || "HTML"}`)
  }

  return response.json()
}

export function useStudentDashboard() {
  const dashboardQuery = useQuery({
    queryKey: ["student", "dashboard"],
    queryFn: fetchDashboardData,
    staleTime: 60 * 1000,
  })

  const progressQuery = useQuery({
    queryKey: ["student", "progress"],
    queryFn: fetchProgressData,
    staleTime: 60 * 1000,
  })

  return {
    dashboard: dashboardQuery.data,
    progress: progressQuery.data,
    isLoading: dashboardQuery.isLoading,
    isProgressLoading: progressQuery.isLoading,
    isError: dashboardQuery.isError,
    error: dashboardQuery.error,
    progressError: progressQuery.error,
    refetch: () => {
      dashboardQuery.refetch()
      progressQuery.refetch()
    },
    refetchProgress: () => {
      progressQuery.refetch()
    },
  }
}
