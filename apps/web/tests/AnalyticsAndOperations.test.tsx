import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { OnboardingPage } from "@/features/onboarding/OnboardingPage";
import { MicroFeedbackWidget } from "@/features/feedback/MicroFeedbackWidget";
import { AdminHealthPage } from "@/features/admin/health/AdminHealthPage";
import { AdminExperimentsPage } from "@/features/admin/experiments/AdminExperimentsPage";
import { AdminAnalyticsPage } from "@/features/admin/analytics/AdminAnalyticsPage";
import { telemetry } from "@/features/analytics/telemetry";

describe("Beta Operations & Product Analytics Frontend", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("OnboardingPage: renders 4-step wizard, handles step progression, and allows skipping", async () => {
    // Mock onboarding state fetch
    vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes("/onboarding")) {
        return {
          ok: true,
          json: async () => ({
            onboarding_status: "incomplete",
            onboarding_step: 1,
            target_exam: "TEF Canada",
            target_level: "B2",
            daily_minutes_available: 30,
            learning_preferences: { focus_areas: ["comprehension_ecrite"] },
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    render(
      <BrowserRouter>
        <OnboardingPage />
      </BrowserRouter>
    );

    // Verify Step 1 header and options
    await waitFor(() => {
      expect(screen.getByText(/Définissez vos objectifs TEF Canada/i)).toBeInTheDocument();
    });
    expect(screen.getByText("Étape 1 / 4")).toBeInTheDocument();
    expect(screen.getByText("Passer l'onboarding")).toBeInTheDocument();

    // Select B2 level
    const b2Btn = screen.getByRole("button", { name: "B2" });
    expect(b2Btn).toBeInTheDocument();
    fireEvent.click(b2Btn);

    // Advance to Step 2
    const nextBtn = screen.getByRole("button", { name: /Suivant/i });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByText(/Votre rythme d'apprentissage quotidien/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/30 min \/ jour/i)).toBeInTheDocument();
  });

  it("MicroFeedbackWidget: opens feedback modal and renders category and rating options", async () => {
    render(<MicroFeedbackWidget />);

    const openBtn = screen.getByRole("button", { name: /Donner votre avis/i });
    expect(openBtn).toBeInTheDocument();
    fireEvent.click(openBtn);

    // Modal is opened
    expect(screen.getByText("Votre avis compte")).toBeInTheDocument();
    expect(screen.getByText("Catégorie")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Qu'avez-vous pensé de cet exercice/i)).toBeInTheDocument();
  });

  it("AdminHealthPage: renders operational health probes and status indicators", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (String(url).includes("/admin/health")) {
        return {
          ok: true,
          json: async () => ({
            overall_status: "healthy",
            subsystems: [
              {
                name: "api_core",
                status: "healthy",
                latency_ms: 0.1,
                message: "Version: 0.1.0",
                last_checked_at: new Date().toISOString(),
              },
              {
                name: "database_postgresql",
                status: "healthy",
                latency_ms: 1.2,
                message: "PostgreSQL connection pool responsive",
                last_checked_at: new Date().toISOString(),
              },
            ],
            server_timestamp: new Date().toISOString(),
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    render(
      <BrowserRouter>
        <AdminHealthPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/État Opérationnel de l'Infrastructure/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Statut Général : HEALTHY/i)).toBeInTheDocument();
    expect(screen.getByText(/api core/i)).toBeInTheDocument();
    expect(screen.getByText(/database postgresql/i)).toBeInTheDocument();
  });

  it("AdminExperimentsPage: lists experiments and renders safety invariant warning on protected keys", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (String(url).includes("/admin/experiments")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "exp-1",
              key: "onboarding_title_test",
              name: "Onboarding Title Copy",
              description: "Testing welcoming banner",
              status: "running",
              variants: [
                { id: "v1", key: "control", weight: 50, config_payload: {} },
                { id: "v2", key: "variant_a", weight: 50, config_payload: {} },
              ],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    render(
      <BrowserRouter>
        <AdminExperimentsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Onboarding Title Copy")).toBeInTheDocument();
    });
    expect(screen.getByText("onboarding_title_test")).toBeInTheDocument();
    expect(screen.getByText(/running/i)).toBeInTheDocument();

    // Open create modal
    const createBtn = screen.getByRole("button", { name: /Créer une Expérimentation/i });
    fireEvent.click(createBtn);

    expect(screen.getByText("Nouvelle Expérimentation")).toBeInTheDocument();

    // Enter a forbidden key to verify safety guard
    const keyInput = screen.getByPlaceholderText("ex: onboarding_hero_cta_v1");
    fireEvent.change(keyInput, { target: { value: "payment_button_test" } });

    expect(screen.getByText(/Interdit : les domaines de paiement/i)).toBeInTheDocument();
  });

  it("AdminAnalyticsPage: displays executive cockpit with tabs and headline metrics", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (String(url).includes("/admin/analytics/overview")) {
        return {
          ok: true,
          json: async () => ({
            total_registered_users: 142,
            active_users: 98,
            activated_users: 75,
            activation_rate: 0.528,
            assessments_completed: 64,
            exercises_completed: 412,
            writing_submissions: 38,
            speaking_sessions: 45,
            practice_pool_sessions: 22,
            teacher_bookings: 18,
            active_subscriptions: 14,
            total_revenue: 1250.0,
            ai_estimated_cost: 8.65,
            date_range: "last_30_days",
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    render(
      <BrowserRouter>
        <AdminAnalyticsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Product Analytics & Beta Operations/i)).toBeInTheDocument();
    });

    // Check tabs
    expect(screen.getByText("Vue d'ensemble")).toBeInTheDocument();
    expect(screen.getByText("Entonnoir (11 étapes)")).toBeInTheDocument();
    expect(screen.getByText("Rétention Cohortes")).toBeInTheDocument();

    // Check KPI cards
    expect(screen.getByText("142")).toBeInTheDocument();
    expect(screen.getByText("52.8%")).toBeInTheDocument();
    expect(screen.getByText("1250.00 €")).toBeInTheDocument();
    expect(screen.getByText("$8.65")).toBeInTheDocument();
  });

  it("TelemetryClient: dispatches events fail-safe without throwing", () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({ ok: true } as Response);
    expect(() => {
      telemetry.track("test_event", { foo: "bar" });
    }).not.toThrow();
    expect(fetchSpy).toHaveBeenCalled();
  });
});
