import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelpPage, ArticleDetailPage } from "../src/features/help";
import { telemetry } from "../src/features/analytics/telemetry";

// Mock telemetry
vi.mock("../src/features/analytics/telemetry", () => ({
  telemetry: {
    track: vi.fn(),
  },
}));

const mockTickets = [
  {
    id: "ticket-1234-5678",
    user_id: "user-1",
    category: "billing",
    subject: "Problème de facturation avec ma carte",
    description: "J'ai été débité deux fois pour le même pack de crédits.",
    status: "in_progress",
    priority: "high",
    created_at: "2026-09-18T10:00:00Z",
    updated_at: "2026-09-18T14:30:00Z",
  },
  {
    id: "ticket-9999-0000",
    user_id: "user-1",
    category: "assessments",
    subject: "Chronomètre bloqué en simulation",
    description: "Le test blanc s'est figé sur la question 14.",
    status: "resolved",
    priority: "medium",
    created_at: "2026-09-10T08:00:00Z",
    updated_at: "2026-09-11T09:00:00Z",
  },
];

function renderWithProviders(initialRoute = "/help") {
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
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/help" element={<HelpPage />} />
          <Route path="/help/:slug" element={<ArticleDetailPage />} />
          <Route path="/dashboard" element={<div>Tableau de bord</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Page 22 — Student Help & Support (/help)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("auth_token", "fake-test-token");

    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      const urlStr = url.toString();

      if (urlStr.includes("/api/v1/analytics/support/tickets/me")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockTickets,
        });
      }

      if (urlStr.includes("/api/v1/analytics/support/tickets") && options?.method === "POST") {
        const body = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            id: "ticket-created-7777",
            user_id: "user-1",
            category: body.category,
            subject: body.subject,
            description: body.description,
            status: "open",
            priority: body.priority || "medium",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
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

  it("renders HelpPage with PageHeader, search input, categories, and FAQ accordion", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Centre d'aide" })).toBeInTheDocument();
    });

    expect(
      screen.getByText("Retrouvez les réponses aux questions fréquentes ou contactez notre équipe.")
    ).toBeInTheDocument();

    // Search bar present
    expect(
      screen.getByPlaceholderText(/Rechercher dans l'aide/i)
    ).toBeInTheDocument();

    // Category heading & cards
    expect(screen.getByText("Thématiques d'assistance")).toBeInTheDocument();
    expect(screen.getByText("Compte et sécurité")).toBeInTheDocument();
    expect(screen.getByText("Abonnement et paiements")).toBeInTheDocument();
    expect(screen.getByText("Practice Pool oral")).toBeInTheDocument();

    // FAQ Section
    expect(screen.getByText("Questions fréquentes")).toBeInTheDocument();
    expect(
      screen.getByText("Puis-je résilier mon abonnement à tout moment ?")
    ).toBeInTheDocument();

    // Telemetry tracked
    expect(telemetry.track).toHaveBeenCalledWith("help_viewed", expect.any(Object));
  });

  it("filters FAQs and articles by search query and shows matching results", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    const searchInput = screen.getByPlaceholderText(/Rechercher dans l'aide/i);
    await user.type(searchInput, "chronomètre");

    await waitFor(() => {
      expect(screen.getByText(/Résultats pour/)).toBeInTheDocument();
    });

    expect(
      screen.getByText("Comment fonctionne une simulation d'examen TEF ?")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Que faire en cas de déconnexion ou problème technique ?")
    ).toBeInTheDocument();
  });

  it("displays empty search state with Contact Support CTA when no results match", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    const searchInput = screen.getByPlaceholderText(/Rechercher dans l'aide/i);
    await user.type(searchInput, "terme_inexistant_xyz_123");

    await waitFor(() => {
      expect(screen.getByText(/Aucun résultat trouvé pour/)).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: "Contacter le support" })
    ).toBeInTheDocument();
  });

  it("filters by category when clicking a category card", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Abonnement et paiements")).toBeInTheDocument();
    });

    // Click on Abonnement category
    const billingCat = screen.getByText("Abonnement et paiements");
    await user.click(billingCat);

    // "Afficher toutes les thématiques" link appears
    expect(screen.getByText("Afficher toutes les thématiques")).toBeInTheDocument();

    // FAQs are filtered
    expect(
      screen.getByText("Puis-je résilier mon abonnement à tout moment ?")
    ).toBeInTheDocument();
  });

  it("navigates to and renders article detail page (/help/:slug)", async () => {
    renderWithProviders("/help/evaluation-deroulement");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Comment fonctionne une simulation d'examen TEF ?" })
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Les simulations TEF reproduisent fidèlement les conditions réelles/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Compréhension écrite \(CE\)/)).toBeInTheDocument();
    expect(screen.getByText("Retour aux questions")).toBeInTheDocument();

    expect(telemetry.track).toHaveBeenCalledWith(
      "article_opened",
      expect.objectContaining({ slug: "evaluation-deroulement" })
    );
  });

  it("opens contact support modal, validates fields, and submits support ticket", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Contacter le support" })).toBeInTheDocument();
    });

    // Click contact button
    const contactBtn = screen.getByRole("button", { name: "Contacter le support" });
    await user.click(contactBtn);

    // Modal appears
    expect(screen.getByRole("heading", { name: "Contacter le support" })).toBeInTheDocument();

    // Try submitting without filling fields
    const submitBtn = screen.getByRole("button", { name: "Envoyer ma demande" });
    await user.click(submitBtn);

    // Validation errors appear
    expect(
      screen.getByText("Le sujet doit comporter au moins 3 caractères.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Veuillez détailler votre message (au moins 10 caractères).")
    ).toBeInTheDocument();

    // Fill fields
    const subjectInput = screen.getByPlaceholderText(/Ex : Question sur l'épreuve/i);
    await user.type(subjectInput, "Demande de remboursement crédit");

    const descInput = screen.getByPlaceholderText(/Expliquez ce qui s'est passé/i);
    await user.type(descInput, "J'ai un cours qui a été annulé par le professeur.");

    // Submit form
    await user.click(submitBtn);

    // Success screen appears
    await waitFor(() => {
      expect(
        screen.getByText("Votre demande a bien été envoyée")
      ).toBeInTheDocument();
    });

    expect(screen.getByText("ticket-created-7777")).toBeInTheDocument();
    expect(telemetry.track).toHaveBeenCalledWith(
      "support_request_submitted",
      expect.objectContaining({ ticketId: "ticket-created-7777" })
    );
  });

  it("displays student support requests (Mes demandes) with localized statuses and opens detail modal", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Mes demandes de support")).toBeInTheDocument();
    });

    expect(
      screen.getAllByText("Problème de facturation avec ma carte").length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("En cours").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Chronomètre bloqué en simulation").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Résolue").length).toBeGreaterThanOrEqual(1);

    // Click on a ticket row to open detail modal
    const ticketRow = screen.getAllByText("Problème de facturation avec ma carte")[0];
    await user.click(ticketRow);

    // Modal appears with ticket description
    await waitFor(() => {
      expect(
        screen.getByText("J'ai été débité deux fois pour le même pack de crédits.")
      ).toBeInTheDocument();
    });
  });

  it("supports contextual query params (?category=billing&action=contact) to pre-open contact dialog", async () => {
    renderWithProviders("/help?category=billing&action=contact");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Contacter le support" })).toBeInTheDocument();
    });

    const categorySelect = screen.getByLabelText("Catégorie") as HTMLSelectElement;
    expect(categorySelect.value).toBe("billing");
  });
});
