import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import { ScenariosPage } from "@/features/admin/ai-studio/scenarios/ScenariosPage";
import { ExaminerStudioPage } from "@/features/admin/ai-studio/examiner/ExaminerStudioPage";
import type { SpeakingScenario } from "@/features/admin/ai-studio/types";

describe("TEF AI Studio — Scenarios & Guardrails Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockScenarios: SpeakingScenario[] = [
    {
      id: "sc-sec-a-cooking",
      code: "TEF-ORAL-A-001",
      section: "section_a",
      title: "Atelier de Cuisine Moléculaire",
      target_level: "B2",
      difficulty: "standard",
      is_active: true,
      document_title: "Annonce : Nouveau cours de cuisine du futur",
      document_content: "Apprenez les techniques de la cuisine moléculaire tous les samedis à Paris.",
      document_image_url: null,
      role_title: "Secrétaire d'accueil",
      persona_name: "Julie",
      voice_persona: "Aoede",
      register: "formal",
      temperament: "Professionnelle et polie",
      scepticism_level: 0.3,
      known_facts: [
        {
          category: "tarifs",
          fact: "Le cours coûte 65 euros par séance.",
          disclose_condition: "Seulement si le candidat demande le prix.",
        },
      ],
      omitted_facts: ["Le matériel de sécurité n'est pas fourni."],
      objection_cards: [],
      scope_description: "Informations sur l'atelier culinaire.",
      forbidden_topics: ["politique", "recettes secrètes"],
      redirectionPhrases: ["Je vous invite à rester sur les détails de l'atelier."],
      custom_instructions: "Insiste sur la ponctualité.",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "sc-sec-b-carfree",
      code: "TEF-ORAL-B-001",
      section: "section_b",
      title: "Pétition pour un Centre-Ville sans Voitures",
      target_level: "B2",
      difficulty: "challenging",
      is_active: true,
      document_title: "Article : Respirez mieux sans voitures",
      document_content: "La ville envisage de fermer le centre historique aux véhicules polluants.",
      document_image_url: null,
      role_title: "Ami sceptique",
      persona_name: "Thomas",
      voice_persona: "Fenrir",
      register: "informal",
      temperament: "Attaché à sa voiture",
      scepticism_level: 0.75,
      known_facts: [],
      omitted_facts: [],
      objection_cards: [
        {
          trigger_topic: "transports",
          objection: "Les bus sont toujours en retard, c'est impraticable.",
          concession_condition: "Si le candidat propose le vélo électrique partagé.",
        },
      ],
      scope_description: "Débat amical sur la mobilité urbaine.",
      forbidden_topics: ["violence", "propos haineux"],
      redirectionPhrases: ["Reviens au sujet, pourquoi je devrais lâcher ma voiture ?"],
      custom_instructions: "Sois difficile à convaincre au départ.",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const mockConfigs = [
    {
      id: "cfg-1",
      section: "section_a",
      model: "models/gemini-3.8-live",
      voice_persona: "Aoede",
      scepticism_level: 0.3,
      temperature: 0.7,
      top_p: 0.95,
      system_prompt: "Consigne officielle A",
      updated_at: new Date().toISOString(),
    },
    {
      id: "cfg-2",
      section: "section_b",
      model: "models/gemini-3.8-live",
      voice_persona: "Aoede",
      scepticism_level: 0.65,
      temperature: 0.7,
      top_p: 0.95,
      system_prompt: "Consigne officielle B",
      updated_at: new Date().toISOString(),
    },
  ];

  const setupFetchMock = (overrideScenarios: SpeakingScenario[] = mockScenarios) => {
    vi.spyOn(global, "fetch").mockImplementation(async (url: any, opts: any) => {
      const urlStr = String(url);
      const method = opts?.method || "GET";

      if (urlStr.includes("/admin/ai-sandbox/scenarios/seed") && method === "POST") {
        return {
          ok: true,
          json: async () => ({
            message: "Seeded",
            seeded_count: 2,
            scenario_ids: ["sc-1", "sc-2"],
          }),
        } as Response;
      }

      if (urlStr.includes("/admin/ai-sandbox/scenarios") && method === "GET") {
        return {
          ok: true,
          json: async () => ({
            items: overrideScenarios,
            total: overrideScenarios.length,
          }),
        } as Response;
      }

      if (urlStr.includes("/admin/ai-sandbox/scenarios") && method === "POST") {
        const body = JSON.parse(opts.body);
        const created: SpeakingScenario = {
          ...body,
          id: "sc-new-" + Date.now(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        return {
          ok: true,
          json: async () => created,
        } as Response;
      }

      if (urlStr.includes("/admin/ai-sandbox/scenarios/") && method === "PUT") {
        const body = JSON.parse(opts.body);
        return {
          ok: true,
          json: async () => ({
            ...overrideScenarios[0],
            ...body,
            updated_at: new Date().toISOString(),
          }),
        } as Response;
      }

      if (urlStr.includes("/admin/ai-sandbox/scenarios/") && method === "DELETE") {
        return {
          ok: true,
          json: async () => ({ ok: true }),
        } as Response;
      }

      if (urlStr.includes("/admin/ai-sandbox/scenarios/") && urlStr.includes("/duplicate") && method === "POST") {
        return {
          ok: true,
          json: async () => ({
            ...overrideScenarios[0],
            id: "sc-copy-" + Date.now(),
            code: overrideScenarios[0].code + "-COPY",
            title: overrideScenarios[0].title + " (Copie)",
          }),
        } as Response;
      }

      if (urlStr.includes("/admin/ai-sandbox/benchmarks")) {
        return {
          ok: true,
          json: async () => ({ samples: [] }),
        } as Response;
      }

      if (urlStr.includes("/admin/ai-sandbox/templates")) {
        return {
          ok: true,
          json: async () => [],
        } as Response;
      }

      if (urlStr.includes("/admin/ai-sandbox/speaking/config")) {
        return {
          ok: true,
          json: async () => mockConfigs,
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({}),
      } as Response;
    });
  };

  it("renders ScenariosPage catalog with scenarios, badges, and filters", async () => {
    setupFetchMock();
    render(
      <BrowserRouter>
        <ScenariosPage />
      </BrowserRouter>
    );

    expect(screen.getByText("Scénarios d'Épreuve & Garde-fous")).toBeInTheDocument();
    expect(screen.getByText("Initialiser scénarios types")).toBeInTheDocument();
    expect(screen.getByText("Nouveau Scénario")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Atelier de Cuisine Moléculaire")).toBeInTheDocument();
      expect(screen.getByText("Pétition pour un Centre-Ville sans Voitures")).toBeInTheDocument();
      expect(screen.getByText("TEF-ORAL-A-001")).toBeInTheDocument();
      expect(screen.getByText("TEF-ORAL-B-001")).toBeInTheDocument();
      expect(screen.getByText("1 faits connus")).toBeInTheDocument();
      expect(screen.getByText("1 objections")).toBeInTheDocument();
    });
  });

  it("filters scenarios catalog based on search input", async () => {
    setupFetchMock();
    render(
      <BrowserRouter>
        <ScenariosPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Atelier de Cuisine Moléculaire")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Rechercher par titre/i);
    fireEvent.change(searchInput, { target: { value: "Pétition" } });

    expect(screen.queryByText("Atelier de Cuisine Moléculaire")).not.toBeInTheDocument();
    expect(screen.getByText("Pétition pour un Centre-Ville sans Voitures")).toBeInTheDocument();
  });

  it("calls seed endpoint when clicking 'Initialiser scénarios types'", async () => {
    setupFetchMock();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <BrowserRouter>
        <ScenariosPage />
      </BrowserRouter>
    );

    const seedBtn = screen.getByText("Initialiser scénarios types");
    fireEvent.click(seedBtn);

    await waitFor(() => {
      expect(window.fetch).toHaveBeenCalledWith(
        "/api/v1/admin/ai-sandbox/scenarios/seed",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("opens ScenarioEditorModal and submits a new scenario", async () => {
    setupFetchMock();
    render(
      <BrowserRouter>
        <ScenariosPage />
      </BrowserRouter>
    );

    const newBtn = screen.getByText("Nouveau Scénario");
    fireEvent.click(newBtn);

    // Modal opens
    await waitFor(() => {
      expect(screen.getByText("Nouveau Scénario d'Épreuve TEF")).toBeInTheDocument();
    });

    // Fill metadata
    fireEvent.change(screen.getByLabelText(/Titre du Scénario/i), {
      target: { value: "Location de Vélos Électriques" },
    });
    fireEvent.change(screen.getByLabelText(/Code Unique/i), {
      target: { value: "TEF-ORAL-A-999" },
    });

    // Switch to Document tab
    const docTab = screen.getByRole("tab", { name: /Document/i });
    fireEvent.click(docTab);

    fireEvent.change(screen.getByLabelText(/Titre de l'Annonce/i), {
      target: { value: "Vélos en libre-service" },
    });
    fireEvent.change(screen.getByLabelText(/Texte du Stimulus/i), {
      target: { value: "Louez un vélo à 2 euros de l'heure." },
    });

    // Switch to Persona tab
    const personaTab = screen.getByRole("tab", { name: /Personnage/i });
    fireEvent.click(personaTab);

    fireEvent.change(screen.getByLabelText(/Rôle du Personnage/i), {
      target: { value: "Agent de station" },
    });
    fireEvent.change(screen.getByLabelText(/Nom du Personnage/i), {
      target: { value: "Marc" },
    });

    // Submit form
    const submitBtn = screen.getByRole("button", { name: "Créer le scénario" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(window.fetch).toHaveBeenCalledWith(
        "/api/v1/admin/ai-sandbox/scenarios",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("TEF-ORAL-A-999"),
        })
      );
    });
  });

  it("renders ExaminerStudioPage with authentic stimulus mirror when scenario is loaded", async () => {
    setupFetchMock();
    render(
      <MemoryRouter initialEntries={["/admin/ai-studio/examiner?scenarioId=sc-sec-a-cooking"]}>
        <ExaminerStudioPage />
      </MemoryRouter>
    );

    // 1. Verify Examiner studio loads
    await waitFor(() => {
      expect(screen.getByText("Examinateur Studio — Simulation & Calibration Live")).toBeInTheDocument();
    });

    // 2. Verify Stimulus title
    await waitFor(() => {
      expect(screen.getByText("Document Ressource Officiel (Stimulus Candidat)")).toBeInTheDocument();
    });

    // 3. Verify scenario details
    expect(screen.getByText("Annonce : Nouveau cours de cuisine du futur")).toBeInTheDocument();
    expect(screen.getByText("TEF-ORAL-A-001")).toBeInTheDocument();
    expect(screen.getByText(/Garde-fous Actifs/i)).toBeInTheDocument();
    expect(screen.getByText("Anti-Jailbreak V2")).toBeInTheDocument();
  });
});
