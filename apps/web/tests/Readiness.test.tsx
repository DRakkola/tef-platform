/**
 * Integration and unit tests for Readiness & Adaptive Learning Cockpit.
 */

import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ReadinessPage } from "@/features/readiness/ReadinessPage";
import type { ReadinessProfileResponse, DailyPlanResponse } from "@/features/readiness/types";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

const mockProfile: ReadinessProfileResponse = {
  student_id: "11111111-1111-1111-1111-111111111111",
  target_exam: "TEF Canada",
  target_level: "B2",
  target_score: 70.0,
  exam_date: "2026-12-01T00:00:00Z",
  calculation_version: "v1.0.0",
  overall_score_estimate: 68.5,
  confidence_overall: 0.78,
  confidence_label: "Élevée",
  readiness_band: "near_target",
  readiness_band_label: "Proche de la cible",
  readiness_band_description: "Performance globale proche du niveau visé.",
  estimated_cefr: "B2",
  estimated_nclc: 7,
  is_ready_for_target: true,
  days_until_exam: 74,
  disclaimer: "Estimation indicative. Ne constitue pas un certificat officiel du TEF.",
  skills: [
    {
      skill_id: "s1",
      skill_code: "CE",
      skill_name: "Compréhension écrite",
      category: "core",
      current_score: 75.0,
      target_score: 70.0,
      target_gap: -5.0,
      confidence: 0.85,
      confidence_label: "Élevée",
      is_blocking: false,
      priority_rank: 2,
      data_points_count: 8,
    },
    {
      skill_id: "s2",
      skill_code: "CO",
      skill_name: "Compréhension orale",
      category: "core",
      current_score: 58.0,
      target_score: 70.0,
      target_gap: 12.0,
      confidence: 0.70,
      confidence_label: "Moyenne",
      is_blocking: true,
      priority_rank: 1,
      data_points_count: 5,
    },
  ],
  blocking_skills: [
    {
      skill_id: "s2",
      skill_code: "CO",
      skill_name: "Compréhension orale",
      category: "core",
      current_score: 58.0,
      target_score: 70.0,
      deficit: 12.0,
      confidence: 0.70,
      observation_count: 5,
      impact_explanation: "L'écart de 12 pts sur Compréhension orale pénalise votre profil.",
      recommended_remedy: "Travailler les exercices audio et l'inférence.",
    },
  ],
  trend: {
    trend_7d: 1.5,
    trend_30d: 4.2,
    trend_all_time: 8.5,
    score_change_per_week: 1.2,
    level_change_estimate: "Progression régulière",
    data_points_count: 13,
    sufficient_data_for_velocity: true,
  },
  last_calculated_at: "2026-09-18T12:00:00Z",
};

const mockDailyPlan: DailyPlanResponse = {
  date: "2026-09-18",
  total_minutes_allocated: 30,
  daily_minutes_budget: 30,
  completed_minutes: 0,
  completion_percentage: 0,
  items: [
    {
      id: "dp-1",
      item_type: "review",
      title: "Révision ciblée : Compréhension orale",
      description: "Exercice audio de renforcement sur les points faibles récents.",
      skill_id: "s2",
      skill_name: "Compréhension orale",
      estimated_minutes: 15,
      difficulty_profile: "appropriate",
      rationale: "Compétence bloquante identifiée.",
      is_completed: false,
      action_url: "/exercises/oral-1",
    },
    {
      id: "dp-2",
      item_type: "core_practice",
      title: "Entraînement : Compréhension écrite B2",
      description: "Lecture rapide et repérage d'arguments.",
      skill_id: "s1",
      skill_name: "Compréhension écrite",
      estimated_minutes: 15,
      difficulty_profile: "challenging",
      rationale: "Consolider la maîtrise B2.",
      is_completed: false,
      action_url: "/exercises/reading-2",
    },
  ],
  summary: "Programme optimisé pour 30 minutes de travail.",
  focus_skill: "Compréhension orale",
};

describe("ReadinessPage Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the readiness cockpit with estimation, confidence, and disclaimer", async () => {
    vi.spyOn(global, "fetch").mockImplementation((url: any) => {
      const u = String(url);
      if (u.includes("/api/v1/students/me/readiness/blockers")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ blocking_skills: mockProfile.blocking_skills }),
        } as Response);
      }
      if (u.includes("/api/v1/students/me/readiness/trends")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockProfile.trend),
        } as Response);
      }
      if (u.includes("/api/v1/students/me/readiness/evidence")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              evidence: [
                {
                  id: "ev-1",
                  skill_id: "s1",
                  skill_name: "Compréhension écrite",
                  source_type: "assessment",
                  source_id: "att-1",
                  raw_score: 75.0,
                  normalized_score: 75.0,
                  confidence: 0.85,
                  weight: 1.0,
                  observed_at: "2026-09-18T10:00:00Z",
                },
              ],
              total_count: 1,
            }),
        } as Response);
      }
      if (u.includes("/api/v1/students/me/daily-plan")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockDailyPlan),
        } as Response);
      }
      if (u.includes("/api/v1/students/me/readiness/reassessment")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              is_reassessment_recommended: false,
              cooldown_active: true,
              days_until_next_eligible: 5,
              triggers_met: [],
              reasons: ["Période de stabilisation active."],
            }),
        } as Response);
      }
      if (u.includes("/api/v1/students/me/readiness")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockProfile),
        } as Response);
      }
      return Promise.reject(new Error("Unknown URL: " + u));
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ReadinessPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify loading or data elements
    await waitFor(() => {
      expect(screen.getByText(/Estimation de Préparation/i)).toBeInTheDocument();
    });

    // Check disclaimer
    expect(screen.getByText(/Estimation pédagogique interne — TEF Canada/i)).toBeInTheDocument();

    // Check Band
    expect(screen.getByText(/Proche de la cible/i)).toBeInTheDocument();

    // Check overall score estimate
    expect(screen.getByText(/68.5%/i)).toBeInTheDocument();

    // Check confidence
    expect(screen.getByText(/78%/i)).toBeInTheDocument();

    // Check Blocking Skills section
    expect(screen.getByText(/Facteurs Limitants Détectés/i)).toBeInTheDocument();
    expect(screen.getByText(/Déficit: -12%/i)).toBeInTheDocument();

    // Check Daily Plan
    expect(screen.getByText(/Plan Quotidien Adaptatif \(V2\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Budget : 30 min/i)).toBeInTheDocument();
    expect(screen.getByText(/Révision ciblée : Compréhension orale/i)).toBeInTheDocument();

    // Check Evidence stream
    expect(screen.getByText(/Flux d'Observations Récentes/i)).toBeInTheDocument();
  });

  it("changes budget when budget selector is clicked", async () => {
    let requestedBudget = 0;
    vi.spyOn(global, "fetch").mockImplementation((url: any, opts: any) => {
      const u = String(url);
      if (u.includes("/api/v1/students/me/daily-plan/budget") && opts?.method === "PUT") {
        const body = JSON.parse(opts.body);
        requestedBudget = body.daily_minutes_available;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ message: "Budget updated", daily_minutes_budget: requestedBudget }),
        } as Response);
      }
      if (u.includes("/api/v1/students/me/readiness/blockers")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ blocking_skills: [] }) } as Response);
      }
      if (u.includes("/api/v1/students/me/readiness/trends")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockProfile.trend) } as Response);
      }
      if (u.includes("/api/v1/students/me/readiness/evidence")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ evidence: [], total_count: 0 }) } as Response);
      }
      if (u.includes("/api/v1/students/me/daily-plan")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockDailyPlan) } as Response);
      }
      if (u.includes("/api/v1/students/me/readiness/reassessment")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ is_reassessment_recommended: false, cooldown_active: false, days_until_next_eligible: 0, triggers_met: [], reasons: [] }) } as Response);
      }
      if (u.includes("/api/v1/students/me/readiness")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockProfile) } as Response);
      }
      return Promise.reject(new Error("Unknown URL: " + u));
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ReadinessPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Plan Quotidien Adaptatif \(V2\)/i)).toBeInTheDocument();
    });

    const btn45 = screen.getByRole("button", { name: "45 min" });
    fireEvent.click(btn45);

    await waitFor(() => {
      expect(requestedBudget).toBe(45);
    });
  });
});
