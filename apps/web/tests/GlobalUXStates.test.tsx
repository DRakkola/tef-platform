import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { mapApiError } from "../src/core/errorMapping";
import { ApiError } from "../src/core/api";
import {
  AppErrorState,
  ConfirmationDialog,
  OfflineBanner,
  SessionExpiredDialog,
  PageSkeleton,
  SectionSkeleton,
  TableSkeleton,
  CardGridSkeleton,
  ToastProvider,
  useToast,
  ForbiddenPage,
  MaintenancePage,
  EmptyState,
} from "../src/components/feedback";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import { NotFoundPage } from "../src/components/NotFoundPage";

describe("PAGE 23 — GLOBAL UX STATES, ERROR HANDLING & EDGE-CASE UX", () => {
  // =========================================================================
  // 1. Centralized Error Mapping Tests
  // =========================================================================
  describe("mapApiError", () => {
    it("maps HTTP 401 / AUTH_REQUIRED into clean French auth error without leaking machine codes", () => {
      const apiErr = new ApiError(401, "AUTH_REQUIRED", "Session invalid");
      const mapped = mapApiError(apiErr);

      expect(mapped.type).toBe("auth");
      expect(mapped.status).toBe(401);
      expect(mapped.title).toBe("Session expirée ou connexion requise");
      expect(mapped.description).toContain("Votre session a expiré");
      expect(mapped.description).not.toContain("AUTH_REQUIRED");
      expect(mapped.actionLabel).toBe("Se connecter");
      expect(mapped.actionHref).toBe("/login");
      expect(mapped.retryable).toBe(false);
    });

    it("maps string 'AUTH_REQUIRED' into clean French auth error", () => {
      const mapped = mapApiError("AUTH_REQUIRED");
      expect(mapped.type).toBe("auth");
      expect(mapped.title).toBe("Session expirée ou connexion requise");
      expect(mapped.actionLabel).toBe("Se connecter");
    });

    it("maps HTTP 403 / FORBIDDEN into French restricted access error", () => {
      const apiErr = new ApiError(403, "FORBIDDEN", "Forbidden resource");
      const mapped = mapApiError(apiErr);

      expect(mapped.type).toBe("forbidden");
      expect(mapped.status).toBe(403);
      expect(mapped.title).toBe("Accès restreint");
      expect(mapped.description).toContain("Vous n'avez pas les autorisations nécessaires");
      expect(mapped.actionLabel).toBe("Retour au tableau de bord");
      expect(mapped.actionHref).toBe("/dashboard");
    });

    it("maps HTTP 404 into French not found error", () => {
      const apiErr = new ApiError(404, "NOT_FOUND", "Resource missing");
      const mapped = mapApiError(apiErr);

      expect(mapped.type).toBe("notFound");
      expect(mapped.status).toBe(404);
      expect(mapped.title).toBe("Élément introuvable");
      expect(mapped.description).toContain("n'existe pas");
    });

    it("maps HTTP 409 / CONFLICT into French data conflict error", () => {
      const apiErr = new ApiError(409, "CONFLICT", "Resource state conflict");
      const mapped = mapApiError(apiErr);

      expect(mapped.type).toBe("conflict");
      expect(mapped.status).toBe(409);
      expect(mapped.title).toBe("Conflit de données");
      expect(mapped.actionLabel).toBe("Actualiser");
      expect(mapped.retryable).toBe(true);
    });

    it("maps HTTP 422 into French validation error", () => {
      const apiErr = new ApiError(422, "VALIDATION_ERROR", "Champs invalides");
      const mapped = mapApiError(apiErr);

      expect(mapped.type).toBe("validation");
      expect(mapped.status).toBe(422);
      expect(mapped.title).toBe("Données invalides");
      expect(mapped.description).toBe("Champs invalides");
    });

    it("maps HTTP 429 into French rate limit error", () => {
      const apiErr = new ApiError(429, "RATE_LIMITED", "Too many requests");
      const mapped = mapApiError(apiErr);

      expect(mapped.type).toBe("rateLimit");
      expect(mapped.status).toBe(429);
      expect(mapped.title).toBe("Trop de requêtes");
      expect(mapped.description).toContain("patienter quelques instants");
      expect(mapped.retryable).toBe(true);
    });

    it("maps HTTP 500 / 502 / 504 into French server error", () => {
      const apiErr = new ApiError(500, "INTERNAL_SERVER_ERROR", "Crash");
      const mapped = mapApiError(apiErr);

      expect(mapped.type).toBe("server");
      expect(mapped.status).toBe(500);
      expect(mapped.title).toBe("Erreur serveur temporaire");
      expect(mapped.description).toContain("problème inattendu est survenu sur nos serveurs");
      expect(mapped.retryable).toBe(true);
    });

    it("maps HTTP 503 / SERVICE_UNAVAILABLE into French maintenance error", () => {
      const apiErr = new ApiError(503, "SERVICE_UNAVAILABLE", "Down for maintenance");
      const mapped = mapApiError(apiErr);

      expect(mapped.type).toBe("serviceUnavailable");
      expect(mapped.status).toBe(503);
      expect(mapped.title).toBe("Service temporairement indisponible");
      expect(mapped.description).toContain("maintenance ou d'une forte charge");
      expect(mapped.retryable).toBe(true);
    });

    it("maps network fetch failure (TypeError: Failed to fetch) into French network error", () => {
      const netErr = new TypeError("Failed to fetch");
      const mapped = mapApiError(netErr);

      expect(mapped.type).toBe("network");
      expect(mapped.title).toBe("Connexion au serveur impossible");
      expect(mapped.description).toContain("Vérifiez votre connexion Internet");
      expect(mapped.retryable).toBe(true);
    });

    it("maps ECONNREFUSED error into French network error without leaking technical string", () => {
      const connErr = new Error("connect ECONNREFUSED 127.0.0.1:8000");
      const mapped = mapApiError(connErr);

      expect(mapped.type).toBe("network");
      expect(mapped.title).toBe("Connexion au serveur impossible");
      expect(mapped.description).not.toContain("ECONNREFUSED");
    });

    it("maps timeout / AbortError into French timeout error", () => {
      const abortErr = new Error("The operation was aborted due to timeout");
      abortErr.name = "AbortError";
      const mapped = mapApiError(abortErr);

      expect(mapped.type).toBe("network");
      expect(mapped.title).toBe("Délai d'attente dépassé");
      expect(mapped.description).toContain("Le serveur a mis trop de temps à répondre");
    });

    it("maps unknown or fallback errors into user-friendly French", () => {
      const unknownErr = { foo: "bar" };
      const mapped = mapApiError(unknownErr);

      expect(mapped.type).toBe("unknown");
      expect(mapped.title).toBe("Une erreur est survenue");
      expect(mapped.description).toContain("Veuillez actualiser la page ou réessayer");
    });
  });

  // =========================================================================
  // 2. AppErrorState Component Tests
  // =========================================================================
  describe("AppErrorState", () => {
    it("renders auto-mapped error with title, description, and retry action", async () => {
      const user = userEvent.setup();
      const onRetry = vi.fn();

      render(
        <AppErrorState
          error={new Error("Failed to fetch")}
          onRetry={onRetry}
        />
      );

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Connexion au serveur impossible")).toBeInTheDocument();
      expect(screen.getByText(/Vérifiez votre connexion Internet/)).toBeInTheDocument();

      const retryBtn = screen.getByRole("button", { name: /réessayer/i });
      expect(retryBtn).toBeInTheDocument();

      await user.click(retryBtn);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("renders compact mode correctly for inline/widget errors", async () => {
      const user = userEvent.setup();
      const onRetry = vi.fn();

      render(
        <AppErrorState
          type="network"
          title="Chargement partiel échoué"
          description="Impossible d'actualiser les recommandations."
          compact
          onRetry={onRetry}
        />
      );

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Chargement partiel échoué")).toBeInTheDocument();
      expect(screen.getByText("Impossible d'actualiser les recommandations.")).toBeInTheDocument();

      const retryBtn = screen.getByRole("button", { name: /réessayer/i });
      await user.click(retryBtn);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("renders secondary action button when provided", async () => {
      const user = userEvent.setup();
      const onSecondary = vi.fn();

      render(
        <AppErrorState
          type="forbidden"
          secondaryActionLabel="Consulter l'aide"
          onSecondaryAction={onSecondary}
        />
      );

      const helpBtn = screen.getByRole("button", { name: "Consulter l'aide" });
      expect(helpBtn).toBeInTheDocument();
      await user.click(helpBtn);
      expect(onSecondary).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 3. EmptyState Component Tests
  // =========================================================================
  describe("EmptyState", () => {
    it("renders what is empty, why, and next step action CTA", async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      const onSecondary = vi.fn();

      render(
        <EmptyState
          title="Aucun entraînement commencé"
          description="Vous n'avez pas encore réalisé d'exercice. Commencez dès maintenant par un test d'évaluation pour identifier vos forces."
          actionLabel="Passer le test de positionnement"
          onAction={onAction}
          secondaryActionLabel="Explorer les questions"
          onSecondaryAction={onSecondary}
        />
      );

      expect(screen.getByText("Aucun entraînement commencé")).toBeInTheDocument();
      expect(screen.getByText(/Vous n'avez pas encore réalisé d'exercice/)).toBeInTheDocument();

      const actionBtn = screen.getByRole("button", { name: "Passer le test de positionnement" });
      await user.click(actionBtn);
      expect(onAction).toHaveBeenCalledTimes(1);

      const secondaryBtn = screen.getByRole("button", { name: "Explorer les questions" });
      await user.click(secondaryBtn);
      expect(onSecondary).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 4. OfflineBanner Tests
  // =========================================================================
  describe("OfflineBanner", () => {
    it("shows banner when offline event fires, and shows reconnection banner when online fires", async () => {
      render(<OfflineBanner />);

      // Initially online in test environment -> banner is null
      expect(
        screen.queryByText(/Vous êtes actuellement hors connexion/)
      ).not.toBeInTheDocument();

      // Trigger offline event
      act(() => {
        window.dispatchEvent(new Event("offline"));
      });

      expect(
        screen.getByText(/Vous êtes actuellement hors connexion/)
      ).toBeInTheDocument();
      expect(screen.getByRole("status")).toBeInTheDocument();

      // Trigger online event -> shows reconnection badge
      act(() => {
        window.dispatchEvent(new Event("online"));
      });

      expect(
        screen.getByText(/Connexion rétablie. Vos données se synchronisent./)
      ).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 5. SessionExpiredDialog Tests
  // =========================================================================
  describe("SessionExpiredDialog", () => {
    it("opens dialog on tef:auth-expired event and directs to login with redirect param", async () => {
      render(<SessionExpiredDialog />);

      // Initially closed
      expect(screen.queryByText("Session expirée")).not.toBeInTheDocument();

      // Fire tef:auth-expired
      act(() => {
        window.dispatchEvent(
          new CustomEvent("tef:auth-expired", {
            detail: { status: 401, endpoint: "/api/v1/students/me/dashboard" },
          })
        );
      });

      // Now dialog is open
      expect(screen.getByText("Session expirée")).toBeInTheDocument();
      expect(
        screen.getByText(/Votre session de connexion a expiré ou une authentification est requise/)
      ).toBeInTheDocument();

      const loginBtn = screen.getByRole("button", { name: /se reconnecter/i });
      expect(loginBtn).toBeInTheDocument();

      const closeBtn = screen.getByRole("button", { name: "Fermer" });
      expect(closeBtn).toBeInTheDocument();

      // Click Close
      fireEvent.click(closeBtn);
      await waitFor(() => {
        expect(screen.queryByText("Session expirée")).not.toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // 6. ConfirmationDialog Tests
  // =========================================================================
  describe("ConfirmationDialog", () => {
    it("renders destructive confirmation and triggers onConfirm and onClose", async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      const onClose = vi.fn();

      const { rerender } = render(
        <ConfirmationDialog
          isOpen={true}
          title="Annuler la réservation ?"
          description="Votre session avec le professeur sera annulée. Votre crédit sera restitué sur votre solde."
          confirmLabel="Confirmer l'annulation"
          cancelLabel="Garder la session"
          variant="destructive"
          onConfirm={onConfirm}
          onClose={onClose}
        />
      );

      expect(screen.getByText("Annuler la réservation ?")).toBeInTheDocument();
      expect(screen.getByText(/Votre crédit sera restitué/)).toBeInTheDocument();

      const cancelBtn = screen.getByRole("button", { name: "Garder la session" });
      await user.click(cancelBtn);
      expect(onClose).toHaveBeenCalledTimes(1);

      const confirmBtn = screen.getByRole("button", { name: "Confirmer l'annulation" });
      await user.click(confirmBtn);
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(2); // automatically calls onClose upon successful confirm
    });
  });

  // =========================================================================
  // 7. Toast & ToastProvider Tests
  // =========================================================================
  describe("ToastProvider and useToast", () => {
    const TestToastComponent: React.FC = () => {
      const { toast } = useToast();
      return (
        <div>
          <button
            onClick={() =>
              toast({
                title: "Brouillon sauvegardé",
                description: "Vos modifications sont synchronisées avec succès.",
                variant: "success",
                duration: 2000,
              })
            }
          >
            Afficher Toast
          </button>
        </div>
      );
    };

    it("displays toast notification with success variant and auto-dismisses", async () => {
      const user = userEvent.setup();

      render(
        <ToastProvider>
          <TestToastComponent />
        </ToastProvider>
      );

      const triggerBtn = screen.getByRole("button", { name: "Afficher Toast" });
      await user.click(triggerBtn);

      expect(screen.getByText("Brouillon sauvegardé")).toBeInTheDocument();
      expect(
        screen.getByText("Vos modifications sont synchronisées avec succès.")
      ).toBeInTheDocument();

      const closeBtn = screen.getByRole("button", { name: "Fermer la notification" });
      await user.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByText("Brouillon sauvegardé")).not.toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // 8. ErrorBoundary Tests
  // =========================================================================
  describe("ErrorBoundary", () => {
    const CrashingComponent: React.FC = () => {
      throw new Error("Render crash simulation");
    };

    it("catches render errors and displays localized French recovery screen", () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      render(
        <ErrorBoundary>
          <CrashingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Une erreur inattendue est survenue")).toBeInTheDocument();
      expect(screen.getByText(/Une anomalie temporaire est survenue/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /recharger la page/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /retour au tableau de bord/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /centre d'aide/i })).toBeInTheDocument();

      consoleErrorSpy.mockRestore();
    });
  });

  // =========================================================================
  // 9. NotFoundPage (404) & ForbiddenPage (403) & MaintenancePage (503) Tests
  // =========================================================================
  describe("Global Route Pages", () => {
    it("renders NotFoundPage with 404, French copy, and links to dashboard and help", () => {
      render(
        <MemoryRouter>
          <NotFoundPage />
        </MemoryRouter>
      );

      expect(screen.getByText("404")).toBeInTheDocument();
      expect(screen.getByText("Page introuvable")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /retour au tableau de bord/i })).toHaveAttribute(
        "href",
        "/dashboard"
      );
      expect(screen.getByRole("link", { name: /centre d'aide/i })).toHaveAttribute(
        "href",
        "/help"
      );
    });

    it("renders ForbiddenPage with 403, French copy, and links to dashboard and help", () => {
      render(
        <MemoryRouter>
          <ForbiddenPage />
        </MemoryRouter>
      );

      expect(screen.getByText("403")).toBeInTheDocument();
      expect(screen.getByText("Accès restreint")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /retour au tableau de bord/i })).toHaveAttribute(
        "href",
        "/dashboard"
      );
      expect(screen.getByRole("link", { name: /centre d'aide/i })).toHaveAttribute(
        "href",
        "/help"
      );
    });

    it("renders MaintenancePage with French copy, reload button and help link", () => {
      render(
        <MemoryRouter>
          <MaintenancePage />
        </MemoryRouter>
      );

      expect(screen.getByText("Plateforme en maintenance")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /actualiser la page/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /consulter l'aide/i })).toHaveAttribute(
        "href",
        "/help"
      );
    });
  });

  // =========================================================================
  // 10. Progressive Skeletons Tests
  // =========================================================================
  describe("Progressive Skeletons", () => {
    it("renders PageSkeleton with accessible aria attributes", () => {
      render(<PageSkeleton />);
      const skeleton = screen.getByLabelText("Chargement de la page");
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveAttribute("aria-busy", "true");
    });

    it("renders SectionSkeleton with accessible aria attributes", () => {
      render(<SectionSkeleton rows={4} />);
      const skeleton = screen.getByLabelText("Chargement de la section");
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveAttribute("aria-busy", "true");
    });

    it("renders TableSkeleton with accessible aria attributes", () => {
      render(<TableSkeleton rows={3} columns={3} />);
      const skeleton = screen.getByLabelText("Chargement du tableau");
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveAttribute("aria-busy", "true");
    });

    it("renders CardGridSkeleton with accessible aria attributes", () => {
      render(<CardGridSkeleton count={4} columns={2} />);
      const skeleton = screen.getByLabelText("Chargement des éléments");
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveAttribute("aria-busy", "true");
    });
  });
});
