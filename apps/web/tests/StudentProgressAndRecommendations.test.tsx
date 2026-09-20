/**
 * Integration and UI tests for ProgressPage and RecommendationsPage.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ProgressPage } from "@/features/progress/ProgressPage";
import { RecommendationsPage } from "@/features/recommendations/RecommendationsPage";

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

describe("Student Progress & Personalization Views", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    localStorage.setItem("auth_token", "fake-test-token");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders ProgressPage with timeline, trajectory metrics, and simulation disclaimer", async () => {
    const mockProgress = {
      timeline: [
        {
          timestamp: "2026-09-15T10:00:00Z",
          overall_score: 78.5,
          assessment_title: "TEF Test Blanc #1",
          source_type: "assessment",
        },
        {
          timestamp: "2026-09-17T14:30:00Z",
          overall_score: 84.0,
          assessment_title: "Fait Divers Grammaire Drill",
          source_type: "exercise",
        },
      ],
      skills: [
        {
          skill_id: "s-1",
          skill_name: "Compréhension Orale Directe",
          category: "listening",
          current_score: 82.0,
          previous_score: 72.0,
          change: 10.0,
          confidence: 0.88,
          confidence_label: "High",
          insufficient_data: false,
          attempts_count: 5,
          last_assessed_at: "2026-09-17T14:30:00Z",
          estimated_level: "B2",
          trend: "improving",
        },
        {
          skill_id: "s-2",
          skill_name: "Subjonctif Présent",
          category: "grammar",
          current_score: 58.0,
          previous_score: 65.0,
          change: -7.0,
          confidence: 0.75,
          confidence_label: "Medium",
          insufficient_data: false,
          attempts_count: 4,
          last_assessed_at: "2026-09-16T11:00:00Z",
          estimated_level: "B1",
          trend: "declining",
        },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/v1/students/me/progress")) {
        return {
          ok: true,
          json: async () => mockProgress,
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ProgressPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Header and Disclaimer
    expect(await screen.findByText(/Trajectoire & Progression TEF/i)).toBeInTheDocument();
    expect(
      screen.getByText(/estimation indicative basée sur notre modèle d'apprentissage/i)
    ).toBeInTheDocument();

    // Skills Trajectories
    expect(screen.getByText("Compréhension Orale Directe")).toBeInTheDocument();
    expect(screen.getByText("En progrès")).toBeInTheDocument();
    expect(screen.getByText("+10%")).toBeInTheDocument();

    expect(screen.getByText("Subjonctif Présent")).toBeInTheDocument();
    expect(screen.getByText("En baisse")).toBeInTheDocument();
    expect(screen.getByText("-7%")).toBeInTheDocument();

    // Timeline entries
    expect(screen.getByTitle(/TEF Test Blanc #1/)).toBeInTheDocument();
    expect(screen.getByTitle(/Fait Divers Grammaire Drill/)).toBeInTheDocument();
    expect(screen.getByText("78.5%")).toBeInTheDocument();
    expect(screen.getByText("84%")).toBeInTheDocument();
  });

  it("renders RecommendationsPage with status filters and action triggers", async () => {
    const mockRecommendations = [
      {
        id: "rec-1",
        skill_id: "s-1",
        skill_name: "Pronoms Relatifs",
        skill_code: "GRM-01",
        recommendation_type: "weakness_remediation",
        entity_type: "exercise",
        entity_id: "ex-42",
        title: "Exercice intensif — Les pronoms composés",
        reason: "Score récent inférieur à 65% sur cette compétence clé.",
        priority: "critical",
        status: "active",
        created_at: "2026-09-17T10:00:00Z",
      },
      {
        id: "rec-2",
        skill_id: "s-2",
        skill_name: "Accord du participe passé",
        skill_code: "GRM-02",
        recommendation_type: "target_gap_priority",
        entity_type: "exercise",
        entity_id: "ex-43",
        title: "Exercice — Accord avec avoir et être",
        reason: "Compétence requise pour atteindre le niveau B2.",
        priority: "high",
        status: "completed",
        created_at: "2026-09-16T10:00:00Z",
      },
    ];

    let patchCalled = false;
    let patchedStatus = "";

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method || "GET";

      if (url.includes("/api/v1/students/me/recommendations") && method === "GET") {
        return {
          ok: true,
          json: async () => mockRecommendations,
        } as Response;
      }

      if (url.includes("/api/v1/students/me/recommendations/rec-1") && method === "PATCH") {
        patchCalled = true;
        const body = JSON.parse((init?.body as string) || "{}");
        patchedStatus = body.status;
        return {
          ok: true,
          json: async () => ({ ...mockRecommendations[0], status: patchedStatus }),
        } as Response;
      }

      return { ok: false, status: 404 } as Response;
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <RecommendationsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Active recommendation rendered
    expect(
      await screen.findByText("Exercice intensif — Les pronoms composés")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Score récent inférieur à 65%/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/critical/i)).toBeInTheDocument();

    // Dismiss action
    const dismissBtn = screen.getByText(/Ignorer/i);
    fireEvent.click(dismissBtn);

    await waitFor(() => {
      expect(patchCalled).toBe(true);
      expect(patchedStatus).toBe("dismissed");
    });
  });
});
