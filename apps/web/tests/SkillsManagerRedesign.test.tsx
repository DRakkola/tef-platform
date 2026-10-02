/**
 * Tests for the redesigned Admin Skills Management feature (Taxonomy Console).
 */

import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { SkillsManagerPage } from "@/features/admin/SkillsManagerPage";

describe("SkillsManagerPage Redesign - Taxonomy Console", () => {
  const mockMetrics = {
    total_skills: 3,
    total_subskills: 5,
    domains_count: 2,
    domain_breakdown: { reading: 2, grammar: 1 },
    taxonomy_warnings_count: 1,
    issues: ["1 compétence sans sous-compétences"],
  };

  const mockSkills = [
    {
      id: "skill-reading-1",
      code: "reading_comprehension",
      name: "Compréhension des écrits",
      category: "reading",
      description: "Identifier des informations clés et idées directrices.",
      is_active: true,
      subskills: [
        {
          id: "sub-1",
          skill_id: "skill-reading-1",
          code: "reading_main_idea",
          name: "Idée générale",
          description: "Dégager le thème central.",
        },
        {
          id: "sub-2",
          skill_id: "skill-reading-1",
          code: "reading_details",
          name: "Détails factuels",
          description: "Repérer des données concrètes.",
        },
      ],
      usage_counts: {
        questions: 12,
        exercises: 4,
        assessments: 2,
        student_mastery: 45,
        skill_assessments: 0,
        skill_evidence: 8,
        speaking_evaluations: 0,
        writing_evaluations: 0,
        total_dependencies: 71,
      },
    },
    {
      id: "skill-grammar-1",
      code: "grammar_syntax",
      name: "Syntaxe & Structures de phrase",
      category: "grammar",
      description: "Maîtrise de l'ordre des mots et de la subordination.",
      is_active: true,
      subskills: [],
      usage_counts: {
        questions: 0,
        exercises: 0,
        assessments: 0,
        student_mastery: 0,
        skill_assessments: 0,
        skill_evidence: 0,
        speaking_evaluations: 0,
        writing_evaluations: 0,
        total_dependencies: 0,
      },
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.setItem("auth_token", "fake-admin-token");
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  const setupFetchMock = (customSkills = mockSkills) => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method || "GET";

      if (url.includes("/admin/content/skills/metrics/summary")) {
        return {
          ok: true,
          json: async () => mockMetrics,
        } as Response;
      }

      if (url.includes("/admin/content/skills/skill-reading-1/subskills") && method === "POST") {
        const body = JSON.parse(init?.body as string);
        return {
          ok: true,
          json: async () => ({
            id: "sub-new-123",
            skill_id: "skill-reading-1",
            code: body.code,
            name: body.name,
            description: body.description,
          }),
        } as Response;
      }

      if (url.includes("/admin/content/skills") && method === "POST") {
        const body = JSON.parse(init?.body as string);
        return {
          ok: true,
          json: async () => ({
            id: "skill-new-456",
            code: body.code,
            name: body.name,
            category: body.category,
            description: body.description,
            is_active: true,
            subskills: [],
            usage_counts: {
              questions: 0,
              exercises: 0,
              assessments: 0,
              student_mastery: 0,
              skill_assessments: 0,
              skill_evidence: 0,
              speaking_evaluations: 0,
              writing_evaluations: 0,
              total_dependencies: 0,
            },
          }),
        } as Response;
      }

      if (url.includes("/admin/content/skills") && method === "GET") {
        return {
          ok: true,
          json: async () => customSkills,
        } as Response;
      }

      return { ok: false, status: 404 } as Response;
    });
  };

  it("renders page header and metric strip accurately", async () => {
    setupFetchMock();

    render(
      <MemoryRouter>
        <SkillsManagerPage />
      </MemoryRouter>
    );

    // Title and subtitle
    expect(await screen.findByRole("heading", { name: /^Compétences/i })).toBeInTheDocument();
    expect(screen.getByText(/Référentiel taxonomique des compétences/i)).toBeInTheDocument();

    // Metric strip
    expect(await screen.findByText("Compétences racines")).toBeInTheDocument();
    expect(screen.getByText("Sous-compétences")).toBeInTheDocument();
    expect(screen.getByText("Domaines linguistiques")).toBeInTheDocument();
    expect(screen.getByText("Avertissements taxonomie")).toBeInTheDocument();
  });

  it("renders navigator with skills and selects the active skill", async () => {
    setupFetchMock();

    render(
      <MemoryRouter>
        <SkillsManagerPage />
      </MemoryRouter>
    );

    // Both skills in navigator
    expect(await screen.findAllByText("Compréhension des écrits")).not.toHaveLength(0);
    expect(screen.getByText("Syntaxe & Structures de phrase")).toBeInTheDocument();

    // First skill selected by default
    expect(screen.getAllByText("reading_comprehension").length).toBeGreaterThanOrEqual(1);

    // Subskill count pill in navigator
    expect(screen.getByText("2 sous-compétences")).toBeInTheDocument();
  });

  it("navigates across tabs in detail workspace", async () => {
    setupFetchMock();

    render(
      <MemoryRouter>
        <SkillsManagerPage />
      </MemoryRouter>
    );

    // Default overview tab is visible
    expect(await screen.findByText("Impact Réel & Dépendances Plateforme")).toBeInTheDocument();
    expect(screen.getByText(/Total : 71 références/i)).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();

    // Switch to Subskills tab
    const subTab = screen.getByRole("tab", { name: /Sous-compétences/i });
    fireEvent.click(subTab);

    expect(await screen.findByText("Idée générale")).toBeInTheDocument();
    expect(screen.getByText("Détails factuels")).toBeInTheDocument();
    expect(screen.getByText("reading_main_idea")).toBeInTheDocument();

    // Switch to Linked Content tab
    const linkedTab = screen.getByRole("tab", { name: /Contenus associés/i });
    fireEvent.click(linkedTab);

    expect(await screen.findByText("Banque de questions")).toBeInTheDocument();
    expect(screen.getByText("Exercices drill")).toBeInTheDocument();

    // Switch to Activity tab
    const activityTab = screen.getByRole("tab", { name: /Activité & Audit/i });
    fireEvent.click(activityTab);

    expect(await screen.findByText("Historique & Traçabilité Réglementaire")).toBeInTheDocument();
  });

  it("prevents deletion of skills with existing dependencies", async () => {
    setupFetchMock();

    render(
      <MemoryRouter>
        <SkillsManagerPage />
      </MemoryRouter>
    );

    await screen.findAllByText("Compréhension des écrits");

    // Click delete button
    const deleteBtn = screen.getByTitle("Supprimer la compétence");
    fireEvent.click(deleteBtn);

    // Modal should show dependency block warning
    expect(await screen.findByText("Suppression bloquée")).toBeInTheDocument();
    expect(screen.getByText(/Cette compétence ne peut pas être supprimée/i)).toBeInTheDocument();
    expect(screen.getByText("Archiver la compétence")).toBeInTheDocument();
  });

  it("opens skill creation sheet and validates required inputs", async () => {
    setupFetchMock();

    render(
      <MemoryRouter>
        <SkillsManagerPage />
      </MemoryRouter>
    );

    // Open sheet
    const addBtn = screen.getByRole("button", { name: /Nouvelle compétence/i });
    fireEvent.click(addBtn);

    expect(await screen.findByRole("heading", { name: "Nouvelle compétence" })).toBeInTheDocument();

    // Form inputs exist
    expect(screen.getByPlaceholderText(/reading_comprehension/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Compréhension Écrite, Grammaire/i)).toBeInTheDocument();
  });
});
