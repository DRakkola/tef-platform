import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { LoadingState } from "@/components/LoadingState";
import { NotFoundPage } from "@/components/NotFoundPage";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { App } from "@/App";

describe("Frontend Foundation Components", () => {
  it("renders the root application without crashing", () => {
    render(<App />);
    expect(
      screen.getByText(/TEF Preparation Platform/i)
    ).toBeInTheDocument();
  });

  it("renders LoadingState correctly with accessible attributes", () => {
    render(<LoadingState message="Fetching assessments..." />);
    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(screen.getByText("Fetching assessments...")).toBeInTheDocument();
  });

  it("renders NotFoundPage with return link", () => {
    render(
      <BrowserRouter>
        <NotFoundPage />
      </BrowserRouter>
    );
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText("Page introuvable")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /retour au tableau de bord/i })).toBeInTheDocument();
  });

  it("renders ErrorBoundary fallback when a child crashes", () => {
    const ProblemChild = () => {
      throw new Error("Simulated component explosion");
    };

    // Prevent console.error clutter in test output
    const originalError = console.error;
    console.error = () => {};

    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Une erreur inattendue est survenue")).toBeInTheDocument();

    console.error = originalError;
  });
});
