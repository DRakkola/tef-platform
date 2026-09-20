import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BillingHubPage } from "../src/features/billing";
import { telemetry } from "../src/features/analytics/telemetry";

// Mock telemetry
vi.mock("../src/features/analytics/telemetry", () => ({
  telemetry: {
    track: vi.fn(),
  },
}));

const mockActiveSubscription = {
  id: "sub-123",
  user_id: "user-123",
  status: "active",
  plan_tier: "pro",
  current_period_start: "2026-09-01T00:00:00Z",
  current_period_end: "2026-10-01T00:00:00Z",
  cancel_at_period_end: false,
  provider: "stripe",
  provider_subscription_id: "sub_stripe_123",
  cancelled_at: null,
};

const mockCancellingSubscription = {
  ...mockActiveSubscription,
  cancel_at_period_end: true,
};

const mockFreeSubscription = {
  id: null,
  user_id: "user-123",
  status: "inactive",
  plan_tier: "free",
  current_period_start: null,
  current_period_end: null,
  cancel_at_period_end: false,
  provider: "mock",
  provider_subscription_id: null,
  cancelled_at: null,
};

const mockCredits = {
  total_balance: 12,
  available_balance: 12,
  expiring_soon: 2,
  next_expiration_date: "2026-12-31T00:00:00Z",
};

const mockUsage = {
  balance: 12,
  consumptions: [
    {
      id: "cons-1",
      user_id: "user-123",
      amount: 1,
      feature: "ai_writing",
      reference_id: "writing-1",
      created_at: "2026-09-18T10:00:00Z",
    },
  ],
  grants: [
    {
      id: "grant-1",
      user_id: "user-123",
      amount: 5,
      grant_type: "pack_purchase",
      source: "Pack 5 Crédits",
      expires_at: "2026-12-31T00:00:00Z",
      created_at: "2026-09-15T08:00:00Z",
    },
  ],
};

const mockEntitlements = {
  unlimited_mock_tests: true,
  premium_exercises: true,
  progress_dashboard: true,
  ai_writing: true,
  ai_speaking: true,
  speaking_practice: true,
  credits_balance: 12,
  has_subscription: true,
  subscription_tier: "pro",
};

const mockProducts = [
  {
    id: "prod-pro",
    sku: "pro",
    name: "Candidat Pro",
    description: "La formule complète pour réussir son TEF Canada avec score B2/C1 garanti.",
    product_type: "subscription",
    is_active: true,
    prices: [
      {
        id: "price-pro-monthly",
        product_id: "prod-pro",
        amount_cents: 2900,
        currency: "cad",
        billing_interval: "monthly",
        is_active: true,
      },
      {
        id: "price-pro-annual",
        product_id: "prod-pro",
        amount_cents: 29000,
        currency: "cad",
        billing_interval: "annual",
        is_active: true,
      },
    ],
    entitlements: [],
  },
  {
    id: "prod-elite",
    sku: "premium",
    name: "Candidat Élite",
    description: "Formule intensive avec tuteurs certifiés et corrections humaines prioritaires.",
    product_type: "subscription",
    is_active: true,
    prices: [
      {
        id: "price-elite-monthly",
        product_id: "prod-elite",
        amount_cents: 5900,
        currency: "cad",
        billing_interval: "monthly",
        is_active: true,
      },
    ],
    entitlements: [],
  },
  {
    id: "prod-pack-5",
    sku: "pack_5",
    name: "Pack 5 Crédits",
    description: "5 crédits pour corrections et cours particuliers.",
    product_type: "credit_pack",
    is_active: true,
    prices: [
      {
        id: "price-pack-5",
        product_id: "prod-pack-5",
        amount_cents: 2000,
        currency: "cad",
        billing_interval: "one_time",
        is_active: true,
      },
    ],
    entitlements: [],
  },
];

const mockOrders = [
  {
    id: "ord-1",
    order_number: "CMD-2026-001",
    user_id: "user-123",
    status: "paid",
    currency: "cad",
    subtotal_cents: 2900,
    tax_cents: 0,
    total_cents: 2900,
    refunded_amount_cents: 0,
    provider: "stripe",
    provider_order_reference: "pi_123",
    paid_at: "2026-09-01T00:00:00Z",
    created_at: "2026-09-01T00:00:00Z",
    items: [
      {
        id: "item-1",
        product_id: "prod-pro",
        price_id: "price-pro-monthly",
        quantity: 1,
        unit_price_cents: 2900,
        total_price_cents: 2900,
        product_name: "Abonnement Candidat Pro (Mensuel)",
      },
    ],
  },
];

const mockInvoices = [
  {
    id: "inv-1",
    order_id: "ord-1",
    invoice_number: "FACT-2026-001",
    amount_cents: 2900,
    currency: "cad",
    pdf_url: "https://example.com/invoice-1.pdf",
    created_at: "2026-09-01T00:00:00Z",
  },
];

function renderBillingPage(initialRoute = "/billing", subscriptionData = mockActiveSubscription) {
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
          <Route path="/billing" element={<BillingHubPage />} />
          <Route path="/checkout" element={<div>Page de paiement sécurisé</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Page 21 — Student Billing & Subscription (/billing)", () => {
  let currentSub = mockActiveSubscription;

  beforeEach(() => {
    vi.clearAllMocks();
    currentSub = mockActiveSubscription;

    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      const urlStr = url.toString();

      if (urlStr.includes("/api/v1/billing/subscription/cancel")) {
        currentSub = mockCancellingSubscription;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => currentSub,
        });
      }

      if (urlStr.includes("/api/v1/billing/subscription/resume")) {
        currentSub = mockActiveSubscription;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => currentSub,
        });
      }

      if (urlStr.includes("/api/v1/billing/subscription")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => currentSub,
        });
      }

      if (urlStr.includes("/api/v1/billing/credits")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockCredits,
        });
      }

      if (urlStr.includes("/api/v1/billing/usage")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockUsage,
        });
      }

      if (urlStr.includes("/api/v1/billing/entitlements")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockEntitlements,
        });
      }

      if (urlStr.includes("/api/v1/billing/products")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockProducts,
        });
      }

      if (urlStr.includes("/api/v1/billing/orders")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockOrders,
        });
      }

      if (urlStr.includes("/api/v1/billing/invoices")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockInvoices,
        });
      }

      if (urlStr.includes("/api/v1/billing/checkout/sess_123")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            session_id: "sess_123",
            order_id: "ord-1",
            order_number: "CMD-2026-001",
            status: "paid",
            paid: true,
            total_cents: 2900,
            currency: "cad",
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

  it("renders BillingHubPage with PageHeader, status badge, and CurrentPlanHero", async () => {
    renderBillingPage();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Abonnement et facturation" })
      ).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Candidat Pro" })).toBeInTheDocument();
    });

    expect(
      screen.getByText("Gérez votre abonnement, vos crédits et vos paiements.")
    ).toBeInTheDocument();

    // Check CurrentPlanHero displays active subscription
    expect(screen.getByRole("heading", { name: "Candidat Pro" })).toBeInTheDocument();
    expect(screen.getAllByText(/12/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/crédits disponibles/)).toBeInTheDocument();
  });

  it("displays server-authoritative entitlements under 'Accès inclus'", async () => {
    renderBillingPage();

    await waitFor(() => {
      expect(screen.getByText("Accès inclus")).toBeInTheDocument();
    });

    expect(screen.getByText("Simulations TEF officielles")).toBeInTheDocument();
    expect(screen.getByText("Entraînement ciblé & exercices")).toBeInTheDocument();
    expect(screen.getByText("Correction IA d'expression écrite")).toBeInTheDocument();
    expect(screen.getByText("Practice Pool 1-à-1")).toBeInTheDocument();
  });

  it("renders published plan catalog and disables current plan button", async () => {
    const user = userEvent.setup();
    renderBillingPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Choisir une offre" })).toBeInTheDocument();
    });

    // Current plan button is disabled
    expect(screen.getByRole("button", { name: "Votre abonnement actuel" })).toBeDisabled();

    // Other plan has active button
    const otherPlanBtn = screen.getByRole("button", { name: "Choisir cette formule" });
    expect(otherPlanBtn).toBeEnabled();

    // Toggle interval to annual
    const annualBtn = screen.getByRole("button", { name: "Facturation annuelle" });
    await user.click(annualBtn);

    expect(screen.getByText("290 $")).toBeInTheDocument();
  });

  it("renders credit balance with ledger history and top-up action", async () => {
    renderBillingPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Mes crédits" })).toBeInTheDocument();
    });

    expect(screen.getAllByText("12").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("crédits actifs")).toBeInTheDocument();
    expect(screen.getByText(/Recharge \(Pack 5 Crédits\)/)).toBeInTheDocument();
    expect(screen.getByText(/\+5 crédits/)).toBeInTheDocument();
  });

  it("renders payment history and invoices with download action", async () => {
    renderBillingPage();

    await waitFor(() => {
      expect(screen.getByText("Historique des paiements")).toBeInTheDocument();
    });

    expect(screen.getByText("Factures & Justificatifs")).toBeInTheDocument();
    expect(screen.getByText("CMD-2026-001")).toBeInTheDocument();
    expect(screen.getByText("Facture #FACT-2026-001")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /PDF/i })).toHaveAttribute(
      "href",
      "https://example.com/invoice-1.pdf"
    );
  });

  it("opens cancellation dialog, explains consequences, and cancels subscription", async () => {
    const user = userEvent.setup();
    renderBillingPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Candidat Pro" })).toBeInTheDocument();
    });

    // Click cancel button
    const cancelBtn = screen.getByRole("button", { name: "Résilier l'abonnement" });
    await user.click(cancelBtn);

    // Dialog appears
    expect(screen.getByText("Résilier votre abonnement")).toBeInTheDocument();
    expect(screen.getByText(/Ce qui va se passer :/)).toBeInTheDocument();

    // Confirm cancel
    const confirmBtn = screen.getByRole("button", { name: "Confirmer la résiliation" });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(telemetry.track).toHaveBeenCalledWith("subscription_cancelled");
    });
  });

  it("handles checkout return with session_id, polls status, and displays success banner", async () => {
    renderBillingPage("/billing?session_id=sess_123&status=success");

    await waitFor(() => {
      expect(screen.getByText("Paiement confirmé avec succès !")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Votre formule et vos crédits ont été activés. Vos fonctionnalités sont immédiatement disponibles.")
    ).toBeInTheDocument();

    expect(telemetry.track).toHaveBeenCalledWith(
      "payment_confirmed",
      expect.objectContaining({ sessionId: "sess_123" })
    );
  });
});
