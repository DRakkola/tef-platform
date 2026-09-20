import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SettingsPage } from "../src/features/settings";
import { telemetry } from "../src/features/analytics/telemetry";

// Mock telemetry
vi.mock("../src/features/analytics/telemetry", () => ({
  telemetry: {
    track: vi.fn(),
  },
}));

const mockUser = {
  id: "user-123",
  email: "candidat@tef-prep.ca",
  role: "student",
  is_active: true,
  is_verified: true,
  is_beta_user: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  last_login_at: "2026-09-20T00:00:00Z",
  student_profile: {
    id: "prof-123",
    user_id: "user-123",
    target_exam: "TEF Canada",
    target_level: "B2",
    timezone: "America/Montreal",
    native_language: "fr-CA",
    learning_preferences: {
      display_name: "Candidat TEF Test",
      focus_areas: ["comprehension_ecrite", "expression_ecrite"],
      notification_preferences: {
        learning: { email: true, in_app: true },
        teacher: { email: true, in_app: true },
        practice: { email: false, in_app: true },
        billing: { email: true, in_app: false },
        system: { email: true, in_app: true },
      },
    },
  },
};

const mockOnboarding = {
  onboarding_status: "completed",
  onboarding_step: 4,
  target_exam: "TEF Canada",
  target_level: "B2",
  target_date: "2026-11-15",
  daily_minutes_available: 30,
  timezone: "America/Montreal",
  native_language: "fr-CA",
  learning_preferences: {
    display_name: "Candidat TEF Test",
    focus_areas: ["comprehension_ecrite", "expression_ecrite"],
    notification_preferences: {
      learning: { email: true, in_app: true },
      teacher: { email: true, in_app: true },
      practice: { email: false, in_app: true },
      billing: { email: true, in_app: false },
      system: { email: true, in_app: true },
    },
  },
};

const mockBilling = {
  plan_tier: "pro",
  status: "active",
  current_period_end: "2026-10-20T00:00:00Z",
};

const mockCredits = {
  total_balance: 15,
  available_balance: 15,
};

function renderSettingsPage(initialTab = "profile") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/settings?tab=${initialTab}`]}>
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/progress" element={<div>Page de progression</div>} />
          <Route path="/billing" element={<div>Page de facturation</div>} />
          <Route path="/login" element={<div>Page de connexion</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Page 20 — Student Profile & Settings (/settings)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fetch for all endpoints
    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      const urlStr = url.toString();

      if (urlStr.includes("/api/v1/auth/me")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockUser,
        });
      }

      if (urlStr.includes("/api/v1/students/me/onboarding")) {
        if (options?.method === "PUT") {
          const body = JSON.parse(options.body || "{}");
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              ...mockOnboarding,
              ...body,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockOnboarding,
        });
      }

      if (urlStr.includes("/api/v1/billing/subscription")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockBilling,
        });
      }

      if (urlStr.includes("/api/v1/billing/credits")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockCredits,
        });
      }

      if (urlStr.includes("/api/v1/students/me/dashboard")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ estimated_level: "B2" }),
        });
      }

      if (urlStr.includes("/api/v1/auth/change-password")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ message: "Password changed successfully" }),
        });
      }

      if (urlStr.includes("/api/v1/students/me/export")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            user_id: "user-123",
            email: "candidat@tef-prep.ca",
            exported_at: "2026-09-20T00:00:00Z",
            profile: {},
            assessments_history: [{ id: "attempt-1" }],
            writing_submissions: [{ id: "sub-1" }],
            speaking_sessions: [{ id: "sess-1" }],
            practice_pool_matches: [],
            activity_logs: [],
            gdpr_notice: "Conformité RGPD / LPRPDE",
          }),
        });
      }

      if (urlStr.includes("/api/v1/students/me") && options?.method === "DELETE") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            message: "Account deleted",
            user_id: "user-123",
            anonymized_at: "2026-09-20T00:00:00Z",
          }),
        });
      }

      if (urlStr.includes("/api/v1/notifications")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ items: [], unread_count: 0 }),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
      });
    });
  });

  it("renders SettingsPage with header, breadcrumb, and navigation sections", async () => {
    renderSettingsPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Paramètres" })).toBeInTheDocument();
    });

    expect(
      screen.getByText("Gérez votre profil, vos préférences et la sécurité de votre compte.")
    ).toBeInTheDocument();

    // Check navigation buttons in desktop nav after loading finishes
    await waitFor(() => {
      expect(screen.getByRole("navigation", { name: "Navigation des paramètres" })).toBeInTheDocument();
    });
    const nav = screen.getByRole("navigation", { name: "Navigation des paramètres" });
    expect(within(nav).getByRole("button", { name: /Profil/i })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /Préparation TEF/i })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /Notifications/i })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /Sécurité/i })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /Confidentialité/i })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /Facturation/i })).toBeInTheDocument();
  });

  it("loads and edits profile section, persisting changes", async () => {
    const user = userEvent.setup();
    renderSettingsPage("profile");

    await waitFor(() => {
      expect(screen.getByDisplayValue("Candidat TEF Test")).toBeInTheDocument();
    });

    // Check read-only email
    const emailInput = screen.getByDisplayValue("candidat@tef-prep.ca");
    expect(emailInput).toBeDisabled();

    // Edit display name
    const nameInput = screen.getByDisplayValue("Candidat TEF Test");
    await user.clear(nameInput);
    await user.type(nameInput, "Jean-Luc Picard");

    // Click save
    const saveButton = screen.getByRole("button", { name: "Enregistrer les modifications" });
    expect(saveButton).toBeEnabled();
    await user.click(saveButton);

    await waitFor(() => {
      expect(
        screen.getByText("Vos informations de profil ont été enregistrées avec succès.")
      ).toBeInTheDocument();
    });

    expect(telemetry.track).toHaveBeenCalledWith("profile_updated", expect.any(Object));
  });

  it("renders TEF preferences, displays read-only estimated level, and updates preferences", async () => {
    const user = userEvent.setup();
    renderSettingsPage("tef");

    await waitFor(() => {
      expect(screen.getByText("Niveau actuel estimé")).toBeInTheDocument();
    });

    // Verify read-only estimated level is displayed
    expect(screen.getByText("B2")).toBeInTheDocument();
    expect(
      screen.getByText("Déterminé automatiquement à partir de vos évaluations et simulations.")
    ).toBeInTheDocument();

    // Verify progression link
    const progressLink = screen.getByRole("link", { name: /Voir ma progression/i });
    expect(progressLink).toHaveAttribute("href", "/progress");

    // Change target exam
    const examSelect = screen.getByLabelText("Examen cible");
    await user.selectOptions(examSelect, "TEF Québec (TEFAQ)");

    // Save preferences
    const saveButton = screen.getByRole("button", { name: "Enregistrer les préférences" });
    await user.click(saveButton);

    await waitFor(() => {
      expect(
        screen.getByText("Vos préférences de préparation ont été enregistrées avec succès.")
      ).toBeInTheDocument();
    });

    expect(telemetry.track).toHaveBeenCalledWith(
      "learning_preferences_updated",
      expect.any(Object)
    );
  });

  it("renders notifications with categories and enforces mandatory system alerts", async () => {
    const user = userEvent.setup();
    renderSettingsPage("notifications");

    await waitFor(() => {
      expect(screen.getByText("Apprentissage & Résultats")).toBeInTheDocument();
    });

    // Check system category has mandatory badge
    expect(screen.getByText("Obligatoire")).toBeInTheDocument();
    const systemEmailSwitch = screen.getByLabelText("Notification courriel pour Sécurité & Système");
    expect(systemEmailSwitch).toBeDisabled();

    // Toggle learning in-app switch
    const learningInAppSwitch = screen.getByLabelText(
      "Notification dans l'application pour Apprentissage & Résultats"
    );
    expect(learningInAppSwitch).not.toBeDisabled();
    await user.click(learningInAppSwitch);

    // Save
    const saveButton = screen.getByRole("button", { name: "Enregistrer les préférences" });
    await user.click(saveButton);

    await waitFor(() => {
      expect(
        screen.getByText("Vos préférences de notification ont été mises à jour avec succès.")
      ).toBeInTheDocument();
    });
  });

  it("validates password change requirements and submits new password", async () => {
    const user = userEvent.setup();
    renderSettingsPage("security");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Modifier le mot de passe" })
      ).toBeInTheDocument();
    });

    const currentPwdInput = screen.getByPlaceholderText("Votre mot de passe actuel");
    const newPwdInput = screen.getByPlaceholderText("Au moins 12 caractères");
    const confirmPwdInput = screen.getByPlaceholderText("Confirmez votre nouveau mot de passe");
    const submitButton = screen.getByRole("button", { name: "Modifier le mot de passe" });

    // Initially disabled
    expect(submitButton).toBeDisabled();

    // Type valid passwords
    await user.type(currentPwdInput, "AncienMotDePasse123!");
    await user.type(newPwdInput, "NouveauMotDePasseTresSecurise2026!");
    await user.type(confirmPwdInput, "NouveauMotDePasseTresSecurise2026!");

    expect(submitButton).toBeEnabled();
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(
          "Mot de passe modifié avec succès. Vos sessions précédentes ont été invalidées."
        )
      ).toBeInTheDocument();
    });

    expect(telemetry.track).toHaveBeenCalledWith("password_changed");
  });

  it("handles privacy data export and account deletion confirmation flow", async () => {
    const user = userEvent.setup();
    renderSettingsPage("privacy");

    await waitFor(() => {
      expect(screen.getByText("Portabilité des données")).toBeInTheDocument();
    });

    // Request data export
    const exportButton = screen.getByRole("button", {
      name: "Demander une copie de mes données",
    });
    await user.click(exportButton);

    await waitFor(() => {
      expect(screen.getByText("Archive prête")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Télécharger le fichier JSON" })).toBeInTheDocument();

    // Click delete account
    const deleteButton = screen.getByRole("button", { name: "Supprimer mon compte" });
    await user.click(deleteButton);

    // Dialog appears
    expect(screen.getByText("Confirmer la suppression du compte")).toBeInTheDocument();

    // Type password
    const pwdConfirmInput = screen.getByPlaceholderText("Votre mot de passe actuel");
    await user.type(pwdConfirmInput, "MonMotDePasse123!");

    const confirmDeleteBtn = screen.getByRole("button", {
      name: "Confirmer la suppression",
    });
    await user.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(telemetry.track).toHaveBeenCalledWith(
        "account_deletion_requested",
        expect.any(Object)
      );
    });
  });

  it("renders billing summary and navigates to /billing", async () => {
    const user = userEvent.setup();
    renderSettingsPage("billing");

    await waitFor(() => {
      expect(screen.getByText("Candidat Pro")).toBeInTheDocument();
    });

    expect(screen.getByText("15 crédits")).toBeInTheDocument();
    expect(screen.getByText(/Renouvellement le/i)).toBeInTheDocument();

    const manageBtn = screen.getByRole("button", { name: /Gérer ma facturation/i });
    await user.click(manageBtn);

    await waitFor(() => {
      expect(screen.getByText("Page de facturation")).toBeInTheDocument();
    });
  });
});
