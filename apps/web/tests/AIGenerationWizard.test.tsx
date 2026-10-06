/**
 * Frontend tests for the server-driven admin AI generation wizard
 * (/admin/questions/generate).
 *
 * The wizard renders its selectors from the server catalogue and submits
 * asynchronous generation jobs, so these tests assert that no format is
 * hardcoded on the client and that the job/polling flow drives the review
 * step.
 */

import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AIGenerationPage } from "@/features/admin/questions/AIGenerationPage";

const CATALOG = {
  total_formats: 2,
  modules: [
    { code: "reading", label: "Compréhension écrite" },
    { code: "lexique_structure", label: "Lexique et structure" },
  ],
  stimulus_kinds: [
    { code: "none", label: "Sans document" },
    { code: "single_document", label: "Un document" },
  ],
  formats: [
    {
      code: "press_article",
      module: "reading",
      module_label: "Compréhension écrite",
      name: "Articles de presse et analyses",
      admin_hint: "Article suivi d'actualité ou d'analyse.",
      stimulus_kind: "single_document",
      stimulus_kind_label: "Un document",
      requires_stimulus: true,
      allowed_response_types: ["single_choice", "multiple_choice"],
      default_response_type: "single_choice",
      option_count_min: 4,
      option_count_max: 4,
      prompt_guidance: "Identifiez la thèse principale de l'article.",
    },
    {
      code: "word_formation",
      module: "lexique_structure",
      module_label: "Lexique et structure",
      name: "Formation des mots",
      admin_hint: "Dérivation et formation lexicale.",
      stimulus_kind: "none",
      stimulus_kind_label: "Sans document",
      requires_stimulus: false,
      allowed_response_types: ["gap_fill"],
      default_response_type: "gap_fill",
      option_count_min: 0,
      option_count_max: 0,
      prompt_guidance: "Complétez la phrase avec la forme correcte.",
    },
  ],
};

const QUEUED_JOB = {
  id: "job-1-uuid",
  status: "queued",
  task_type_code: "press_article",
  modality: "reading",
  target_cefr: "B2",
  requested_count: 1,
  error_message: null,
  started_at: null,
  completed_at: null,
  created_at: "2026-10-06T10:00:00Z",
  updated_at: "2026-10-06T10:00:00Z",
  is_terminal: false,
  result: null,
};

const CANDIDATE = {
  candidate_id: "cand-1",
  modality: "reading",
  prompt: "Quel est le message principal de cet article ?",
  instructions: "Choisissez la meilleure réponse.",
  response_type: "single_choice",
  target_cefr: "B2",
  difficulty_rating: 3,
  item_difficulty: 3,
  cognitive_complexity: "interpretation",
  points: 1,
  penalty_points: 0,
  task_type_code: "press_article",
  stimulus_content: "Article de test sur la mobilite douce en ville.",
  stimulus_title: "La ville apaisee",
  source_attribution: "La Presse",
  options: [
    {
      content: "Promouvoir les transports doux",
      is_correct: true,
      explanation: "L'article plaide pour les velos.",
    },
    { content: "Interdire les voitures", is_correct: false, explanation: "Trop categorique." },
  ],
  skill_mappings: [
    {
      skill_id: "skill-1",
      skill_code: "CE_GLOBAL_INTENT",
      skill_name: "Intention generale",
      role: "primary",
      weight: 0.7,
    },
  ],
  scoring_payload: { correct_option_index: 0 },
  generation_metadata: { provider: "gemini", model: "models/gemini-3.5-flash" },
  duplicate_check: { is_duplicate: false, similarity_score: 0.04 },
  validation_report: { is_valid: true, issues: [] },
  ai_review: null,
  status: "pending_review",
};

const SUCCEEDED_JOB = {
  ...QUEUED_JOB,
  status: "succeeded",
  is_terminal: true,
  completed_at: "2026-10-06T10:00:12Z",
  result: {
    batch_id: "batch-1",
    candidates: [CANDIDATE],
    total_requested: 1,
    total_generated: 1,
    valid_candidates_count: 1,
    invalid_candidates_count: 0,
    generation_time_ms: 1200,
    summary: "1 candidat genere, 1 conforme.",
  },
};

const renderWizard = () =>
  render(
    <MemoryRouter initialEntries={["/admin/questions/generate"]}>
      <Routes>
        <Route path="/admin/questions/generate" element={<AIGenerationPage />} />
        <Route
          path="/admin/questions/:id"
          element={<div>question-workspace-page</div>}
        />
      </Routes>
    </MemoryRouter>
  );

const mockFetch = () =>
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    const method = (init?.method || "GET").toUpperCase();

    if (url.includes("/admin/content/generation/formats")) {
      return { ok: true, status: 200, json: async () => CATALOG } as Response;
    }
    if (url.includes("/admin/content/skills")) {
      return { ok: true, status: 200, json: async () => [] } as Response;
    }
    if (url.includes("/admin/content/generation/jobs") && method === "POST") {
      return {
        ok: true,
        status: 202,
        json: async () => ({ job: QUEUED_JOB, poll_url: "/api/v1/admin/content/generation/jobs/job-1-uuid" }),
      } as Response;
    }
    if (url.includes("/admin/content/generation/jobs/job-1-uuid")) {
      return { ok: true, status: 200, json: async () => SUCCEEDED_JOB } as Response;
    }
    return {
      ok: false,
      status: 404,
      json: async () => ({ error: { code: "NOT_FOUND", message: "not found" } }),
    } as Response;
  });

describe("Admin AI Generation Wizard (server-driven)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.setItem("auth_token", "fake-admin-token-xyz");
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.useRealTimers();
  });

  it("renders step 1 from the server catalogue with no hardcoded format list", async () => {
    mockFetch();
    renderWizard();

    expect(
      await screen.findByRole("option", { name: /Articles de presse et analyses/ })
    ).toBeTruthy();
    expect(screen.getByRole("option", { name: /Compréhension écrite/ })).toBeTruthy();
    expect(screen.getByText("Identifiez la thèse principale de l'article.")).toBeTruthy();

    // Full four-step wizard header, including the stimulus step for this format.
    expect(screen.getByText("Format TEF")).toBeTruthy();
    expect(screen.getByText("Support documentaire")).toBeTruthy();
    expect(screen.getByText("Génération asynchrone")).toBeTruthy();
    expect(screen.getByText("Revue & brouillon")).toBeTruthy();

    // The wizard is a page, not a modal dialog.
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText(/Atelier de génération de questions par IA/)).toBeNull();
  });

  it("skips the stimulus step for formats that require no external document", async () => {
    mockFetch();
    renderWizard();
    await screen.findByRole("option", { name: /Articles de presse et analyses/ });

    const moduleSelect = screen.getByDisplayValue("Compréhension écrite");
    fireEvent.change(moduleSelect, { target: { value: "lexique_structure" } });

    expect(await screen.findByRole("option", { name: /Formation des mots/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Continuer/ }));

    // Directly on the async generation step: no stimulus step offered.
    expect(
      await screen.findByRole("button", { name: /Lancer la génération asynchrone/ })
    ).toBeTruthy();
    expect(screen.queryByText("Support documentaire")).toBeNull();
    expect(screen.getByText(/Réponse :/)).toBeTruthy();
  });

  it("queues an async job, polls it and opens the review with the candidates", async () => {
    mockFetch();
    renderWizard();
    await screen.findByRole("option", { name: /Articles de presse et analyses/ });

    // Step 1 -> stimulus studio.
    fireEvent.click(screen.getByRole("button", { name: /Continuer/ }));
    expect(await screen.findByText("Aucun support généré pour l'instant")).toBeTruthy();

    // Stimulus studio -> async generation step.
    fireEvent.click(screen.getByRole("button", { name: /Passer à la génération/ }));

    fireEvent.click(await screen.findByRole("button", { name: /Lancer la génération asynchrone/ }));

    // The job is created (202) and polled until terminal, then the review opens.
    expect(await screen.findByText(/Unique/, {}, { timeout: 6000 })).toBeTruthy();
    expect(screen.getByText(/Conforme règles V2/)).toBeTruthy();
    expect(screen.getByText(/Quel est le message principal de cet article \?/)).toBeTruthy();
    expect(screen.getByText("Promouvoir les transports doux")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Créer le brouillon/ })).toBeTruthy();

    // The job handle stays visible for traceability.
    expect(screen.getByText("#job-1-uu")).toBeTruthy();

    expect(
      vi.mocked(globalThis.fetch).mock.calls.some(
        (call) =>
          String(call[0]).includes("/admin/content/generation/jobs") &&
          (call[1]?.method || "GET") === "POST"
      )
    ).toBe(true);
  });

  it("surfaces a job failure message instead of advancing to review", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method || "GET").toUpperCase();
      if (url.includes("/admin/content/generation/formats")) {
        return { ok: true, status: 200, json: async () => CATALOG } as Response;
      }
      if (url.includes("/admin/content/skills")) {
        return { ok: true, status: 200, json: async () => [] } as Response;
      }
      if (url.includes("/admin/content/generation/jobs") && method === "POST") {
        return {
          ok: true,
          status: 202,
          json: async () => ({ job: QUEUED_JOB, poll_url: "/api/v1/admin/content/generation/jobs/job-1-uuid" }),
        } as Response;
      }
      if (url.includes("/admin/content/generation/jobs/job-1-uuid")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ...QUEUED_JOB,
            status: "failed",
            is_terminal: true,
            completed_at: "2026-10-06T10:00:05Z",
            error_message: "Le fournisseur IA est indisponible.",
          }),
        } as Response;
      }
      return {
        ok: false,
        status: 404,
        json: async () => ({ error: { code: "NOT_FOUND", message: "not found" } }),
      } as Response;
    });

    renderWizard();
    await screen.findByRole("option", { name: /Articles de presse et analyses/ });

    fireEvent.click(screen.getByRole("button", { name: /Continuer/ }));
    await screen.findByText("Aucun support généré pour l'instant");
    fireEvent.click(screen.getByRole("button", { name: /Passer à la génération/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Lancer la génération asynchrone/ }));

    await waitFor(
      () =>
        expect(
          screen.getAllByText(/Le fournisseur IA est indisponible\./).length
        ).toBeGreaterThan(0),
      { timeout: 6000 }
    );
    expect(screen.queryByText(/Conforme règles V2/)).toBeNull();
  });
});
