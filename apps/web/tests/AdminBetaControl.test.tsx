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
});
