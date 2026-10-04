/**
 * Comprehensive frontend tests for Question Authoring & Review Workspace (Phase 6).
 */

import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QuestionsListPage } from "@/features/admin/QuestionsListPage";
import { QuestionWorkspacePage } from "@/features/admin/questions/QuestionWorkspacePage";

describe("Question System V2 - Phase 6 Workspace & Admin UI", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.setItem("auth_token", "admin-jwt-token-xyz");
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  // Mock Question Sample
  const mockQuestion = {
    id: "q-101-uuid",
    section_id: null,
    question_type: "single_choice",
    prompt: "Quel est l'objectif principal de ce message professionnel ?",
    stimulus_id: "stim-001",
    stimulus: {
      id: "stim-001",
      title: "Note de service interne",
      content: "Chers collaborateurs, nous vous informons que les horaires d'accès changent dès lundi.",
      cefr_level: "B1",
      source_attribution: "Direction RH",
    },
    audio_url: null,
    media_url: null,
    order_index: 0,
    difficulty: 3,
    item_difficulty: 3,
    level: "B1",
    target_cefr: "B1",
    cognitive_complexity: "understand",
    task_type_id: "tt-read-01",
    task_type: {
      id: "tt-read-01",
      code: "READ_MSG",
      name: "Compréhension de message professionnel",
      modality: "reading",
    },
    explanation: "Le texte annonce une modification des règles d'accès.",
    points: 1,
    penalty_points: 0,
    status: "draft",
    version: 1,
    validation_status: "valid",
    validation_issues: [],
    options: [
      {
        id: "opt-1",
        content: "Informer d'une modification des plages horaires",
        order_index: 0,
        is_correct: true,
        explanation: "Explication de la réponse correcte.",
      },
      {
        id: "opt-2",
        content: "Sanctionner des retards répétés",
        order_index: 1,
        is_correct: false,
        misconception_type: "unwarranted_inference",
        distractor_rationale: "Rien n'indique une sanction disciplinaire.",
      },
    ],
    skill_tags: [
      {
        skill_id: "sk-reason-01",
        skill_code: "CE_GLOBAL_INTENT",
        skill_name: "Identifier l'intention générale",
        dimension: "reasoning",
        role: "primary",
        weight: 0.6,
      },
      {
        skill_id: "sk-reason-02",
        skill_code: "CE_DETAIL_LOCATE",
        skill_name: "Repérer une information ponctuelle",
        dimension: "reasoning",
        role: "secondary",
        weight: 0.4,
      },
    ],
    provenance: {
      author_type: "human",
      source_reference: "Dossier RH Interne 2026",
      human_verified: true,
    },
    created_at: "2026-10-04T10:00:00Z",
    updated_at: "2026-10-04T10:00:00Z",
  };

  it("renders QuestionsListPage with server-side filters and question summary", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/admin/taxonomy/task-types")) {
        return {
          ok: true,
          json: async () => [
            { id: "tt-read-01", code: "READ_MSG", name: "Compréhension de message", modality: "reading" },
          ],
        } as Response;
      }
      if (url.includes("/admin/content/questions")) {
        return {
          ok: true,
          json: async () => ({
            items: [mockQuestion],
            total: 1,
            page: 1,
            page_size: 15,
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    render(
      <MemoryRouter initialEntries={["/admin/questions"]}>
        <Routes>
          <Route path="/admin/questions" element={<QuestionsListPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Header and search
    expect(await screen.findByRole("heading", { name: /Banque de questions/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Rechercher par énoncé/i)).toBeInTheDocument();

    // Verify question displayed in list
    expect(await screen.findByText(mockQuestion.prompt)).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByText("B1")).toBeInTheDocument();
    expect(screen.getAllByText("Brouillon").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Conforme")).toBeInTheDocument();
    expect(screen.getByText("Ouvrir l'atelier")).toBeInTheDocument();
  });

  it("renders QuestionWorkspacePage in create mode as draft", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/admin/taxonomy/task-types")) {
        return {
          ok: true,
          json: async () => [
            { id: "tt-read-01", code: "READ_MSG", name: "Message pro", modality: "reading" },
          ],
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    render(
      <MemoryRouter initialEntries={["/admin/questions/new?tab=content"]}>
        <Routes>
          <Route path="/admin/questions/new" element={<QuestionWorkspacePage mode="create" />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Nouvelle question/i)).toBeInTheDocument();
    expect(screen.getByText("Brouillon")).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();

    // Prompt input should exist
    const promptInput = screen.getByPlaceholderText(/Écrivez ici la question posée/i);
    expect(promptInput).toBeInTheDocument();

    // Default options should be present
    expect(screen.getByDisplayValue("Option A")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Option B")).toBeInTheDocument();
  });

  it("switches tabs in QuestionWorkspacePage (Profile, Skills, Quality, Preview)", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/admin/content/questions/q-101-uuid")) {
        return {
          ok: true,
          json: async () => mockQuestion,
        } as Response;
      }
      if (url.includes("/admin/taxonomy/task-types")) {
        return {
          ok: true,
          json: async () => [
            { id: "tt-read-01", code: "READ_MSG", name: "Message pro", modality: "reading" },
          ],
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    render(
      <MemoryRouter initialEntries={["/admin/questions/q-101-uuid?tab=content"]}>
        <Routes>
          <Route path="/admin/questions/:id" element={<QuestionWorkspacePage mode="edit" />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for question to load
    await waitFor(() => {
      expect(document.querySelector("h1")?.textContent).toBe(mockQuestion.prompt);
    });

    // 1. Switch to Profile tab
    fireEvent.click(screen.getByText(/Profil & Barème/i));
    expect(await screen.findByText(/Principe de dé-conflation psychométrique/i)).toBeInTheDocument();
    expect(screen.getByText(/Calibration psychométrique & Barème/i)).toBeInTheDocument();

    // 2. Switch to Skills tab
    fireEvent.click(screen.getByText(/Compétences V2/i));
    expect(await screen.findByText(/Dimension Raisonnement & Compréhension/i)).toBeInTheDocument();
    expect(screen.getByText(/CE_GLOBAL_INTENT/i)).toBeInTheDocument();
    expect(screen.getByText(/Équilibrer les poids/i)).toBeInTheDocument();

    // 3. Switch to Quality tab
    fireEvent.click(screen.getByText(/Qualité & Linter/i));
    expect(await screen.findByText(/QuestionValidationEngine/i)).toBeInTheDocument();
    expect(screen.getByText(/Lancer le contrôle de conformité/i)).toBeInTheDocument();

    // 4. Switch to Preview tab
    fireEvent.click(screen.getByText(/Aperçu Candidat \/ Admin/i));
    expect(await screen.findByText(/Aperçu Candidat \(Étanche\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Aperçu Révision Enseignant/i)).toBeInTheDocument();
  });

  it("enforces strict Student Safe Preview boundary (zero answer/distractor leak)", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/admin/content/questions/q-101-uuid")) {
        return {
          ok: true,
          json: async () => mockQuestion,
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    render(
      <MemoryRouter initialEntries={["/admin/questions/q-101-uuid?tab=preview"]}>
        <Routes>
          <Route path="/admin/questions/:id" element={<QuestionWorkspacePage mode="edit" />} />
        </Routes>
      </MemoryRouter>
    );

    // In student preview mode (default):
    expect(await screen.findByText(/Aperçu Candidat \(Étanche\)/i)).toBeInTheDocument();

    // The student sees the options text
    expect(screen.getByText("Informer d'une modification des plages horaires")).toBeInTheDocument();
    expect(screen.getByText("Sanctionner des retards répétés")).toBeInTheDocument();

    // CRITICAL: The student view MUST NOT contain "RÉPONSE CORRECTE", distractor rationale, or misconception
    expect(screen.queryByText(/RÉPONSE CORRECTE/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Rien n'indique une sanction/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/unwarranted_inference/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/CE_GLOBAL_INTENT/i)).not.toBeInTheDocument();

    // Now switch to Admin Review mode
    const adminToggleBtn = screen.getByRole("button", { name: /Aperçu Révision Enseignant/i });
    fireEvent.click(adminToggleBtn);

    // Admin review view SHOULD display the diagnostic information
    const correctIndicators = await screen.findAllByText(/CORRECTE/i);
    expect(correctIndicators.length).toBeGreaterThan(0);
    expect(screen.getByText(/unwarranted_inference/i)).toBeInTheDocument();
    expect(screen.getByText(/Rien n'indique une sanction/i)).toBeInTheDocument();
    expect(screen.getByText(/CE_GLOBAL_INTENT/i)).toBeInTheDocument();
  });

  it("executes lifecycle transitions (submit review, approve, publish, fork)", async () => {
    let currentStatus = "draft";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method || "GET";

      if (url.includes("/admin/content/questions/q-101-uuid/submit-review") && method === "POST") {
        currentStatus = "in_review";
        return {
          ok: true,
          json: async () => ({ ...mockQuestion, status: "in_review" }),
        } as Response;
      }
      if (url.includes("/admin/content/questions/q-101-uuid/approve") && method === "POST") {
        currentStatus = "approved";
        return {
          ok: true,
          json: async () => ({ ...mockQuestion, status: "approved" }),
        } as Response;
      }
      if (url.includes("/admin/content/questions/q-101-uuid/publish") && method === "POST") {
        currentStatus = "published";
        return {
          ok: true,
          json: async () => ({ ...mockQuestion, status: "published", version: 1 }),
        } as Response;
      }
      if (url.includes("/admin/content/questions/q-101-uuid") && method === "GET") {
        return {
          ok: true,
          json: async () => ({ ...mockQuestion, status: currentStatus }),
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    render(
      <MemoryRouter initialEntries={["/admin/questions/q-101-uuid?tab=content"]}>
        <Routes>
          <Route path="/admin/questions/:id" element={<QuestionWorkspacePage mode="edit" />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for draft question
    expect(await screen.findByText("Brouillon")).toBeInTheDocument();

    // 1. Submit for review
    const submitBtn = screen.getByText(/Soumettre pour révision/i);
    fireEvent.click(submitBtn);

    // Modal opens
    const confirmBtn = await screen.findByText("Confirmer");
    fireEvent.click(confirmBtn);

    // Expect status updated to in_review
    expect(await screen.findByText("En révision")).toBeInTheDocument();

    // 2. Approve
    const approveBtn = screen.getByText(/Approuver/i);
    fireEvent.click(approveBtn);
    expect(await screen.findByText("Approuvé")).toBeInTheDocument();

    // 3. Publish
    const publishBtn = screen.getByText(/Publier officiellement/i);
    fireEvent.click(publishBtn);
    const publishConfirm = await screen.findByText("Confirmer");
    fireEvent.click(publishConfirm);
    expect(await screen.findByText("Publié")).toBeInTheDocument();
  });
});
