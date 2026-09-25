import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";
import { BrowserRouter } from "react-router-dom";
import { AdminBetaControlPage } from "@/features/admin/beta/AdminBetaControlPage";

describe("Admin Beta Control Panel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders beta overview KPIs, kill-switches, and cohorts", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes("/admin/beta/overview")) {
        return {
          ok: true,
          json: async () => ({
            total_beta_users: 28,
            active_users_7d: 22,
            recent_registrations_24h: 5,
            assessment_completions: 19,
            writing_submissions: 14,
            speaking_sessions: 12,
            practice_sessions: 8,
            teacher_bookings: 6,
            total_revenue_cents: 145000,
            ai_total_cost_usd: 4.85,
            open_support_tickets: 2,
            unresolved_incidents_count: 0,
            feature_flags: {
              ai_writing: true,
              ai_speaking: true,
              practice_pool: true,
              teacher_bookings: true,
              checkout: true,
              maintenance_mode: false,
            },
            server_timestamp: new Date().toISOString(),
          }),
        } as Response;
      }
      if (urlStr.includes("/admin/beta/cohorts")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "cohort-1",
              name: "Cohorte Bêta Octobre",
              description: "Première cohorte restreinte",
              max_students: 50,
              max_teachers: 15,
              is_active: true,
              students_count: 24,
              teachers_count: 4,
              created_at: new Date().toISOString(),
            },
          ],
        } as Response;
      }
      if (urlStr.includes("/admin/beta/invitations")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "inv-1",
              token_prefix: "tef_beta_a1b2...",
              cohort_id: "cohort-1",
              cohort_name: "Cohorte Bêta Octobre",
              role: "student",
              max_uses: 1,
              used_count: 0,
              expires_at: new Date(Date.now() + 86400000 * 10).toISOString(),
              environment: "production",
              is_revoked: false,
              created_at: new Date().toISOString(),
            },
          ],
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    render(
      <BrowserRouter>
        <AdminBetaControlPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Cockpit de Contrôle Bêta/i)).toBeInTheDocument();
    });

    // Check KPIs
    expect(screen.getByText("28")).toBeInTheDocument();
    expect(screen.getByText("$4.85")).toBeInTheDocument();
    expect(screen.getByText("Cohorte Bêta Octobre")).toBeInTheDocument();
    expect(screen.getByText("tef_beta_a1b2...")).toBeInTheDocument();

    // Check kill-switch buttons exist
    expect(screen.getByText("IA Rédaction")).toBeInTheDocument();
    expect(screen.getByText("Practice Pool")).toBeInTheDocument();
  });

  it("opens generate invitation modal and shows created secret token", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (url, opts) => {
      const urlStr = String(url);
      if (urlStr.includes("/admin/beta/overview")) {
        return {
          ok: true,
          json: async () => ({
            total_beta_users: 10,
            active_users_7d: 8,
            recent_registrations_24h: 2,
            assessment_completions: 5,
            writing_submissions: 4,
            speaking_sessions: 3,
            practice_sessions: 2,
            teacher_bookings: 1,
            total_revenue_cents: 5000,
            ai_total_cost_usd: 1.25,
            open_support_tickets: 0,
            unresolved_incidents_count: 0,
            feature_flags: {},
            server_timestamp: new Date().toISOString(),
          }),
        } as Response;
      }
      if (urlStr.includes("/admin/beta/cohorts")) {
        return { ok: true, json: async () => [] } as Response;
      }
      if (urlStr.includes("/admin/beta/invitations") && opts?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            id: "new-inv-id",
            token_prefix: "tef_beta_999...",
            role: "student",
            max_uses: 1,
            used_count: 0,
            expires_at: new Date().toISOString(),
            environment: "production",
            is_revoked: false,
            created_at: new Date().toISOString(),
            plaintext_token: "tef_beta_secret_token_1234567890",
          }),
        } as Response;
      }
      if (urlStr.includes("/admin/beta/invitations")) {
        return { ok: true, json: async () => [] } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    render(
      <BrowserRouter>
        <AdminBetaControlPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Générer Invitation/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Générer Invitation/i));

    expect(screen.getByText("Générer une Invitation Bêta")).toBeInTheDocument();

    // Click submit
    const submitBtn = screen.getByRole("button", { name: /Créer le Jeton/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("tef_beta_secret_token_1234567890")).toBeInTheDocument();
    });
  });

  it("renders student rates and allows admin to adjust student rate limit", async () => {
    let putCalledWith: any = null;

    vi.spyOn(global, "fetch").mockImplementation(async (url, opts) => {
      const urlStr = String(url);
      if (urlStr.includes("/admin/beta/overview")) {
        return {
          ok: true,
          json: async () => ({
            total_beta_users: 15,
            active_users_7d: 12,
            recent_registrations_24h: 3,
            assessment_completions: 8,
            writing_submissions: 5,
            speaking_sessions: 4,
            practice_sessions: 3,
            teacher_bookings: 2,
            total_revenue_cents: 8000,
            ai_total_cost_usd: 2.15,
            open_support_tickets: 1,
            unresolved_incidents_count: 0,
            feature_flags: {},
            server_timestamp: new Date().toISOString(),
          }),
        } as Response;
      }
      if (urlStr.includes("/admin/beta/cohorts")) {
        return { ok: true, json: async () => [] } as Response;
      }
      if (urlStr.includes("/admin/beta/invitations")) {
        return { ok: true, json: async () => [] } as Response;
      }
      if (urlStr.includes("/admin/beta/rates/students")) {
        return {
          ok: true,
          json: async () => ({
            total: 1,
            students: [
              {
                user_id: "student-uuid-123",
                email: "pilot_student@example.com",
                cohort_id: "c1",
                cohort_name: "Cohorte Pilote",
                quotas: {
                  ai_oral: { name: "IA Oral", limit: 5, consumed: 2, remaining: 3, window: "daily", is_custom: false },
                  ai_writing: { name: "IA Rédaction", limit: 3, consumed: 3, remaining: 0, window: "daily", is_custom: false },
                  practice_pool: { name: "Practice", limit: 4, consumed: 1, remaining: 3, window: "daily", is_custom: false },
                  teacher_booking: { name: "Tuteur", limit: 2, consumed: 0, remaining: 2, window: "weekly", is_custom: false },
                },
                has_overrides: false,
              },
            ],
          }),
        } as Response;
      }
      if (urlStr.includes("/admin/beta/rates/student") && opts?.method === "PUT") {
        putCalledWith = JSON.parse(String(opts?.body));
        return {
          ok: true,
          json: async () => ({
            id: "rate-ovr-1",
            scope: "user",
            action: putCalledWith.action,
            action_name_fr: "Corrections de rédaction par IA",
            limit_value: putCalledWith.limit_value,
            window: "daily",
            user_id: putCalledWith.user_id,
            user_email: "pilot_student@example.com",
            notes: putCalledWith.notes,
            updated_at: new Date().toISOString(),
          }),
        } as Response;
      }
      if (urlStr.includes("/admin/beta/rates")) {
        return {
          ok: true,
          json: async () => ({
            actions: {
              ai_oral: { name_fr: "Sessions orales avec jury IA", default: 5, window: "daily", current_global_limit: 5, is_overridden: false },
              ai_writing: { name_fr: "Corrections de rédaction par IA", default: 3, window: "daily", current_global_limit: 3, is_overridden: false },
            },
            global_limits: [],
            cohort_limits: [],
            student_overrides: [],
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    render(
      <BrowserRouter>
        <AdminBetaControlPage />
      </BrowserRouter>
    );

    // Wait for student table to load
    await waitFor(() => {
      expect(screen.getByText("pilot_student@example.com")).toBeInTheDocument();
    });

    expect(screen.getByText(/Contrôle & Ajustement des Plafonds Étudiants/i)).toBeInTheDocument();
    expect(screen.getByText("Sessions orales avec jury IA")).toBeInTheDocument();
    expect(screen.getByText("Cohorte Pilote")).toBeInTheDocument();

    // Click "Ajuster" on student
    const adjustBtns = screen.getAllByRole("button", { name: /Ajuster/i });
    fireEvent.click(adjustBtns[adjustBtns.length - 1]); // Student quick action

    expect(screen.getByText("Ajuster un Plafond d'Utilisation")).toBeInTheDocument();

    // Submit adjustment
    const saveBtn = screen.getByRole("button", { name: /Enregistrer le Plafond/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(putCalledWith).not.toBeNull();
      expect(putCalledWith.user_id).toBe("student-uuid-123");
    });
  });

  it("allows admin to reset student quota consumption", async () => {
    let resetCalled = false;

    vi.spyOn(global, "fetch").mockImplementation(async (url, opts) => {
      const urlStr = String(url);
      if (urlStr.includes("/admin/beta/overview")) {
        return {
          ok: true,
          json: async () => ({
            total_beta_users: 5,
            active_users_7d: 5,
            recent_registrations_24h: 1,
            assessment_completions: 2,
            writing_submissions: 2,
            speaking_sessions: 2,
            practice_sessions: 1,
            teacher_bookings: 1,
            total_revenue_cents: 1000,
            ai_total_cost_usd: 0.5,
            open_support_tickets: 0,
            unresolved_incidents_count: 0,
            feature_flags: {},
            server_timestamp: new Date().toISOString(),
          }),
        } as Response;
      }
      if (urlStr.includes("/admin/beta/cohorts") || urlStr.includes("/admin/beta/invitations")) {
        return { ok: true, json: async () => [] } as Response;
      }
      if (urlStr.includes("/admin/beta/rates/students")) {
        return {
          ok: true,
          json: async () => ({
            total: 1,
            students: [
              {
                user_id: "student-reset-id",
                email: "exhausted_student@example.com",
                cohort_id: null,
                cohort_name: null,
                quotas: {
                  ai_writing: { name: "IA Rédaction", limit: 3, consumed: 3, remaining: 0, window: "daily", is_custom: false },
                },
                has_overrides: false,
              },
            ],
          }),
        } as Response;
      }
      if (urlStr.includes("/reset") && opts?.method === "POST") {
        resetCalled = true;
        return {
          ok: true,
          json: async () => ({
            message: "Quota réinitialisé pour l'étudiant",
            user_id: "student-reset-id",
            action: null,
            quotas: {},
          }),
        } as Response;
      }
      if (urlStr.includes("/admin/beta/rates")) {
        return {
          ok: true,
          json: async () => ({
            actions: {},
            global_limits: [],
            cohort_limits: [],
            student_overrides: [],
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    render(
      <BrowserRouter>
        <AdminBetaControlPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("exhausted_student@example.com")).toBeInTheDocument();
    });

    // Click "Réinitialiser"
    const resetBtn = screen.getByRole("button", { name: /Réinitialiser/i });
    fireEvent.click(resetBtn);

    expect(screen.getByText("Réinitialiser les Quotas de Consommation")).toBeInTheDocument();

    // Confirm
    const confirmBtn = screen.getByRole("button", { name: /Confirmer la Réinitialisation/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(resetCalled).toBe(true);
    });
  });
});

