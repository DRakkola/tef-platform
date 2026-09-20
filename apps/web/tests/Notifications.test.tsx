/**
 * Tests for the Notification Center and Header Notification Bell.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationsPage } from "@/features/notifications";
import { NotificationCenter } from "@/features/dashboard/NotificationCenter";

describe("Notification Center Experience (/notifications)", () => {
  let queryClient: QueryClient;
  let originalFetch: typeof globalThis.fetch;

  const mockNotifications = [
    {
      id: "notif-1",
      user_id: "user-1",
      title: "Correction disponible",
      message: "Votre essai 'Expression Écrite - Section B' a été évalué par l'IA.",
      type: "writing_correction_ready",
      is_read: false,
      data: { submission_id: "sub-123" },
      created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(), // 10 min ago
    },
    {
      id: "notif-2",
      user_id: "user-1",
      title: "Réservation confirmée",
      message: "Votre cours avec Professeur Martin est programmé pour demain à 18h00.",
      type: "booking_confirmed",
      is_read: false,
      data: { booking_id: "book-456" },
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    },
    {
      id: "notif-3",
      user_id: "user-1",
      title: "Practice Pool Match",
      message: "Un apprenant compatible est prêt pour une session orale de 25 minutes.",
      type: "practice_matched",
      is_read: true,
      data: { session_id: "sess-789" },
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    },
    {
      id: "notif-4",
      user_id: "user-1",
      title: "Paiement réussi",
      message: "Votre abonnement mensuel TEF Réussite a été renouvelé avec succès.",
      type: "payment_succeeded",
      is_read: true,
      data: {},
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    originalFetch = globalThis.fetch;
    localStorage.setItem("auth_token", "test-bearer-token");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const renderWithProviders = (ui: React.ReactElement, initialRoute = "/notifications") => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialRoute]}>
          <Routes>
            <Route path="/notifications" element={ui} />
            <Route path="/writing/:id/result" element={<div data-testid="writing-result">Writing Result</div>} />
            <Route path="/bookings" element={<div data-testid="bookings-page">Bookings Page</div>} />
            <Route path="/practice-pool/session/:id" element={<div data-testid="practice-session">Practice Session</div>} />
            <Route path="/billing" element={<div data-testid="billing-page">Billing Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it("renders NotificationsPage with header, breadcrumb, unread count badge, and notification list", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/notifications")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              items: mockNotifications,
              total: 4,
              unread_count: 2,
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as any;

    renderWithProviders(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: "Notifications" })).toBeInTheDocument();
      expect(screen.getByText(/Consultez les mises à jour importantes/i)).toBeInTheDocument();
      expect(screen.getAllByText(/2 non lues/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole("button", { name: /Tout marquer comme lu/i })).toBeInTheDocument();
      expect(screen.getByText("Correction disponible")).toBeInTheDocument();
      expect(screen.getByText("Réservation confirmée")).toBeInTheDocument();
      expect(screen.getByText("Practice Pool Match")).toBeInTheDocument();
      expect(screen.getByText("Paiement réussi")).toBeInTheDocument();
    });

    expect(screen.getByText("Voir la correction")).toBeInTheDocument();
    expect(screen.getByText("Voir la réservation")).toBeInTheDocument();
  });

  it("filters notifications by 'Non lues' tab", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/notifications")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              items: mockNotifications,
              total: 4,
              unread_count: 2,
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as any;

    renderWithProviders(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText("Correction disponible")).toBeInTheDocument();
    });

    const unreadTab = screen.getByRole("button", { name: /^Non lues/i });
    fireEvent.click(unreadTab);

    // Only unread notifications should appear
    expect(screen.getByText("Correction disponible")).toBeInTheDocument();
    expect(screen.getByText("Réservation confirmée")).toBeInTheDocument();
    expect(screen.queryByText("Practice Pool Match")).not.toBeInTheDocument();
    expect(screen.queryByText("Paiement réussi")).not.toBeInTheDocument();
  });

  it("filters notifications by category (Apprentissage, Professeurs, Facturation)", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/notifications")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              items: mockNotifications,
              total: 4,
              unread_count: 2,
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as any;

    renderWithProviders(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText("Correction disponible")).toBeInTheDocument();
    });

    // 1. Learning
    const learningTab = screen.getByRole("button", { name: /Apprentissage/i });
    fireEvent.click(learningTab);
    expect(screen.getByText("Correction disponible")).toBeInTheDocument();
    expect(screen.queryByText("Réservation confirmée")).not.toBeInTheDocument();

    // 2. Teachers
    const teacherTab = screen.getByRole("button", { name: /Professeurs/i });
    fireEvent.click(teacherTab);
    expect(screen.getByText("Réservation confirmée")).toBeInTheDocument();
    expect(screen.queryByText("Correction disponible")).not.toBeInTheDocument();

    // 3. Billing
    const billingTab = screen.getByRole("button", { name: /Facturation/i });
    fireEvent.click(billingTab);
    expect(screen.getByText("Paiement réussi")).toBeInTheDocument();
    expect(screen.queryByText("Réservation confirmée")).not.toBeInTheDocument();
  });

  it("marks a notification as read and navigates when clicked", async () => {
    let markReadCalled = false;

    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes("/notifications/notif-1/read") && opts?.method === "POST") {
        markReadCalled = true;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ...mockNotifications[0],
              is_read: true,
            }),
        });
      }
      if (url.includes("/notifications")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              items: mockNotifications,
              total: 4,
              unread_count: 2,
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as any;

    renderWithProviders(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText("Correction disponible")).toBeInTheDocument();
    });

    const notifItem = screen.getByText("Correction disponible").closest("div[class*='border']");
    expect(notifItem).toBeInTheDocument();

    fireEvent.click(notifItem!);

    await waitFor(() => {
      expect(markReadCalled).toBe(true);
      expect(screen.getByTestId("writing-result")).toBeInTheDocument();
    });
  });

  it("marks all notifications as read when clicking 'Tout marquer comme lu'", async () => {
    let markAllReadCalled = false;

    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes("/notifications/read-all") && opts?.method === "POST") {
        markAllReadCalled = true;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ marked_as_read: 2 }),
        });
      }
      if (url.includes("/notifications")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              items: mockNotifications.map((n) => (markAllReadCalled ? { ...n, is_read: true } : n)),
              total: 4,
              unread_count: markAllReadCalled ? 0 : 2,
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as any;

    renderWithProviders(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Tout marquer comme lu/i })).toBeInTheDocument();
    });

    const markAllBtn = screen.getByRole("button", { name: /Tout marquer comme lu/i });
    fireEvent.click(markAllBtn);

    await waitFor(() => {
      expect(markAllReadCalled).toBe(true);
    });
  });

  it("displays empty state when there are no notifications", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/notifications")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              items: [],
              total: 0,
              unread_count: 0,
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as any;

    renderWithProviders(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText("Vous êtes à jour.")).toBeInTheDocument();
      expect(screen.getByText(/Aucune nouvelle notification pour le moment/i)).toBeInTheDocument();
    });
  });

  it("renders NotificationCenter bell, unread badge, popover, and link to full page", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/notifications")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              items: mockNotifications,
              total: 4,
              unread_count: 2,
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as any;

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <NotificationCenter />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Bell button with unread count
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Notifications \(2 non lues\)/i })).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
    });

    const bellBtn = screen.getByRole("button", { name: /Notifications \(2 non lues\)/i });

    // Click to open popover
    fireEvent.click(bellBtn);

    await waitFor(() => {
      expect(screen.getByText("Voir toutes les notifications")).toBeInTheDocument();
      expect(screen.getByText("Correction disponible")).toBeInTheDocument();
    });
  });
});
