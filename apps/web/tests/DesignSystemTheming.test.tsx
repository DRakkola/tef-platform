import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider, useTheme } from "../src/providers/ThemeProvider";
import { ThemeSwitcher } from "../src/components/common/ThemeSwitcher";
import { Button } from "../src/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "../src/components/ui/card";
import { Badge } from "../src/components/ui/badge";
import { Input } from "../src/components/ui/input";
import { DesignSystemPage } from "../src/features/admin/design-system/DesignSystemPage";

// Mock matchMedia
beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("light", "dark");

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe("PAGE 24 — GLOBAL VISUAL DESIGN SYSTEM, THEMING & TYPOGRAPHY FOUNDATION", () => {
  // =========================================================================
  // 1. ThemeProvider Tests
  // =========================================================================
  describe("ThemeProvider & useTheme", () => {
    const TestThemeConsumer: React.FC = () => {
      const { theme, resolvedTheme, setTheme } = useTheme();
      return (
        <div>
          <span data-testid="theme-val">{theme}</span>
          <span data-testid="resolved-val">{resolvedTheme}</span>
          <button onClick={() => setTheme("dark")}>Set Dark</button>
          <button onClick={() => setTheme("light")}>Set Light</button>
          <button onClick={() => setTheme("system")}>Set System</button>
        </div>
      );
    };

    it("initializes with system theme and updates documentElement class", async () => {
      render(
        <ThemeProvider defaultTheme="system">
          <TestThemeConsumer />
        </ThemeProvider>
      );

      expect(screen.getByTestId("theme-val").textContent).toBe("system");
      expect(screen.getByTestId("resolved-val").textContent).toBe("light");
      expect(document.documentElement.classList.contains("light")).toBe(true);
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });

    it("switches theme to dark and persists in localStorage", async () => {
      const user = userEvent.setup();

      render(
        <ThemeProvider defaultTheme="light">
          <TestThemeConsumer />
        </ThemeProvider>
      );

      const darkBtn = screen.getByRole("button", { name: "Set Dark" });
      await user.click(darkBtn);

      expect(screen.getByTestId("theme-val").textContent).toBe("dark");
      expect(screen.getByTestId("resolved-val").textContent).toBe("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(document.documentElement.classList.contains("light")).toBe(false);
      expect(localStorage.getItem("tef-theme")).toBe("dark");
    });

    it("loads saved theme preference from localStorage on mount", () => {
      localStorage.setItem("tef-theme", "dark");

      render(
        <ThemeProvider>
          <TestThemeConsumer />
        </ThemeProvider>
      );

      expect(screen.getByTestId("theme-val").textContent).toBe("dark");
      expect(screen.getByTestId("resolved-val").textContent).toBe("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
  });

  // =========================================================================
  // 2. ThemeSwitcher Component Tests
  // =========================================================================
  describe("ThemeSwitcher", () => {
    it("renders segmented control and allows user to switch themes", async () => {
      const user = userEvent.setup();

      render(
        <ThemeProvider defaultTheme="light">
          <ThemeSwitcher variant="segmented" />
        </ThemeProvider>
      );

      const radiogroup = screen.getByRole("radiogroup", { name: /thème d'affichage/i });
      expect(radiogroup).toBeInTheDocument();

      const clairRadio = screen.getByRole("radio", { name: /clair/i });
      const sombreRadio = screen.getByRole("radio", { name: /sombre/i });
      const systemRadio = screen.getByRole("radio", { name: /système/i });

      expect(clairRadio).toHaveAttribute("aria-checked", "true");
      expect(sombreRadio).toHaveAttribute("aria-checked", "false");

      // Switch to dark
      await user.click(sombreRadio);
      expect(sombreRadio).toHaveAttribute("aria-checked", "true");
      expect(document.documentElement.classList.contains("dark")).toBe(true);

      // Switch to system
      await user.click(systemRadio);
      expect(systemRadio).toHaveAttribute("aria-checked", "true");
    });

    it("renders cycle button and cycles through themes", async () => {
      const user = userEvent.setup();

      render(
        <ThemeProvider defaultTheme="light">
          <ThemeSwitcher variant="cycle" />
        </ThemeProvider>
      );

      const cycleBtn = screen.getByRole("button", { name: /thème actuel/i });
      expect(cycleBtn).toBeInTheDocument();

      await user.click(cycleBtn);
      expect(localStorage.getItem("tef-theme")).toBe("dark");
    });
  });

  // =========================================================================
  // 3. Button Component System Tests
  // =========================================================================
  describe("Button Design Tokens & Variants", () => {
    it("renders primary button with lime accent styling and high contrast text", () => {
      render(<Button variant="default">Commencer l'évaluation</Button>);
      const btn = screen.getByRole("button", { name: /commencer l'évaluation/i });
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveAttribute("data-variant", "default");
      // Check that it contains bg-primary and text-primary-foreground classes
      expect(btn.className).toContain("bg-primary");
      expect(btn.className).toContain("text-primary-foreground");
    });

    it("renders teal button with deep teal styling", () => {
      render(<Button variant="teal">Consulter NCLC</Button>);
      const btn = screen.getByRole("button", { name: /consulter nclc/i });
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveAttribute("data-variant", "teal");
      expect(btn.className).toContain("bg-teal");
      expect(btn.className).toContain("text-teal-foreground");
    });

    it("renders secondary button with crisp card surface and subtle border", () => {
      render(<Button variant="secondary">Enregistrer</Button>);
      const btn = screen.getByRole("button", { name: /enregistrer/i });
      expect(btn).toHaveAttribute("data-variant", "secondary");
      expect(btn.className).toContain("bg-card");
      expect(btn.className).toContain("border-border/80");
    });
  });

  // =========================================================================
  // 4. Card Component System Tests
  // =========================================================================
  describe("Card Design Tokens & Variants", () => {
    it("renders default card with rounded-2xl and subtle border", () => {
      render(
        <Card variant="default">
          <CardHeader>
            <CardTitle>Compréhension Écrite</CardTitle>
          </CardHeader>
          <CardContent>40 questions</CardContent>
        </Card>
      );

      const card = screen.getByText("Compréhension Écrite").closest('[data-slot="card"]');
      expect(card).toBeInTheDocument();
      expect(card?.className).toContain("rounded-2xl");
      expect(card?.className).toContain("bg-card");
      expect(card?.className).toContain("border-border/70");
    });

    it("renders accent card with lime background for highlights", () => {
      render(
        <Card variant="accent">
          <CardTitle>Score 4.8</CardTitle>
        </Card>
      );

      const card = screen.getByText("Score 4.8").closest('[data-slot="card"]');
      expect(card?.className).toContain("bg-primary");
      expect(card?.className).toContain("text-primary-foreground");
    });

    it("renders teal card for secondary progress highlights", () => {
      render(
        <Card variant="teal">
          <CardTitle>Niveau B2</CardTitle>
        </Card>
      );

      const card = screen.getByText("Niveau B2").closest('[data-slot="card"]');
      expect(card?.className).toContain("bg-teal");
      expect(card?.className).toContain("text-teal-foreground");
    });
  });

  // =========================================================================
  // 5. Badge Component System Tests
  // =========================================================================
  describe("Badge Design Tokens & Variants", () => {
    it("renders default badge with lime accent and pill shape", () => {
      render(<Badge variant="default">Recommandé</Badge>);
      const badge = screen.getByText("Recommandé");
      expect(badge.className).toContain("rounded-full");
      expect(badge.className).toContain("bg-primary");
      expect(badge.className).toContain("text-primary-foreground");
    });

    it("renders teal badge for TEF secondary tags", () => {
      render(<Badge variant="teal">TEF Canada</Badge>);
      const badge = screen.getByText("TEF Canada");
      expect(badge.className).toContain("bg-teal");
      expect(badge.className).toContain("text-teal-foreground");
    });

    it("renders semantic badges for success, warning, destructive", () => {
      const { rerender } = render(<Badge variant="success">Réussi</Badge>);
      expect(screen.getByText("Réussi").className).toContain("bg-emerald-500/15");

      rerender(<Badge variant="warning">À consolider</Badge>);
      expect(screen.getByText("À consolider").className).toContain("bg-amber-500/15");

      rerender(<Badge variant="destructive">Expiré</Badge>);
      expect(screen.getByText("Expiré").className).toContain("bg-destructive/15");
    });
  });

  // =========================================================================
  // 6. Input Component System Tests
  // =========================================================================
  describe("Input Design Tokens", () => {
    it("renders input with rounded-xl, crisp card background, and subtle border", () => {
      render(<Input placeholder="Rechercher..." />);
      const input = screen.getByPlaceholderText("Rechercher...");
      expect(input.className).toContain("rounded-xl");
      expect(input.className).toContain("bg-card");
      expect(input.className).toContain("border-input");
    });
  });

  // =========================================================================
  // 7. DesignSystemPage Showcase Tests
  // =========================================================================
  describe("DesignSystemPage Showcase", () => {
    it("renders design system showcase with tokens, typography, and components", () => {
      render(
        <ThemeProvider>
          <MemoryRouter>
            <DesignSystemPage />
          </MemoryRouter>
        </ThemeProvider>
      );

      expect(screen.getByText("Système de Design & Fondations Visuelles")).toBeInTheDocument();
      expect(screen.getByText("Palette de Couleurs & Surfaces")).toBeInTheDocument();
      expect(screen.getByText("Échelle Typographique Éditoriale")).toBeInTheDocument();
      expect(screen.getByText("Boutons & Actions")).toBeInTheDocument();
      expect(screen.getByText("Cartes & Surfaces (Card Variants)")).toBeInTheDocument();
      expect(screen.getByText("Badges & Indicateurs de Statut")).toBeInTheDocument();
    });
  });
});
