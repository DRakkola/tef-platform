/**
 * Tests for the canonical Taxonomy V2 Admin Skill Management Console.
 */

import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { SkillsManagerPage } from "@/features/admin/SkillsManagerPage";

describe("SkillsManagerPage - Taxonomy V2 Console", () => {
  const mockMetadata = {
    dimensions: ["reasoning", "language"],
    domains: ["reading", "listening", "writing", "speaking", "grammar", "vocabulary", "syntax", "inference"],
    relation_types: ["prerequisite", "depends_on", "supports", "related"],
    cefr_bands: ["A1", "A2", "B1", "B2", "C1", "C2"],
    active_version: {
      id: "v-1",
      version: "v2.0.0-tef-canada",
      name: "TEF Canada 2026",
      status: "active",
      description: "Taxonomie officielle TEF",
      activated_at: "2026-10-01T00:00:00Z",
      archived_at: null,
      created_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-01T00:00:00Z",
      skill_count: 4,
    },
    metrics: {
      total_skills: 4,
      total_subskills: 6,
      total_competencies: 10,
      dimensions_breakdown: { reasoning: 6, language: 4 },
      domains_breakdown: { reading: 4, grammar: 4, listening: 2 },
      active_skills: 9,
      archived_skills: 1,
      total_relations: 3,
      total_descriptors: 5,
    },
  };

  const mockSkillsList = [
    {
      id: "skill-reading-1",
      taxonomy_version_id: "v-1",
      code: "reasoning.reading.main_idea",
      name: "Compréhension globale & Idée directrice",
      dimension: "reasoning",
      domain: "reading",
      category: "reading",
      description: "Identifier l'axe principal du document.",
      parent_id: null,
      is_active: true,
      created_at: "2026-10-02T10:00:00Z",
      updated_at: "2026-10-02T10:00:00Z",
      subskill_count: 2,
      usage_counts: {
        questions: 14,
        exercises: 5,
        assessments: 3,
        student_mastery: 45,
        skill_assessments: 2,
        skill_evidence: 12,
        writing_evaluations: 0,
        speaking_evaluations: 0,
        total_dependencies: 81,
      },
    },
    {
      id: "skill-reading-sub1",
      taxonomy_version_id: "v-1",
      code: "reasoning.reading.main_idea.thesis",
      name: "Thèse centrale de l'auteur",
      dimension: "reasoning",
      domain: "reading",
      category: "reading",
      description: "Dégager la thèse défendue.",
      parent_id: "skill-reading-1",
      is_active: true,
      created_at: "2026-10-02T10:00:00Z",
      updated_at: "2026-10-02T10:00:00Z",
      subskill_count: 0,
      usage_counts: {
        questions: 6,
        exercises: 2,
        assessments: 1,
        student_mastery: 20,
        skill_assessments: 1,
        skill_evidence: 5,
        writing_evaluations: 0,
        speaking_evaluations: 0,
        total_dependencies: 35,
      },
    },
    {
      id: "skill-grammar-1",
      taxonomy_version_id: "v-1",
      code: "language.syntax.connectors",
      name: "Connecteurs logiques et articulation",
      dimension: "language",
      domain: "grammar",
      category: "transversal",
      description: "Emploi et compréhension des marqueurs de relation.",
      parent_id: null,
      is_active: true,
      created_at: "2026-10-02T10:00:00Z",
      updated_at: "2026-10-02T10:00:00Z",
      subskill_count: 0,
      usage_counts: {
        questions: 0,
        exercises: 0,
        assessments: 0,
        student_mastery: 0,
        skill_assessments: 0,
        skill_evidence: 0,
        writing_evaluations: 0,
        speaking_evaluations: 0,
        total_dependencies: 0,
      },
    },
    {
      id: "skill-archived-1",
      taxonomy_version_id: "v-1",
      code: "language.vocab.obsolete",
      name: "Vocabulaire désuet",
      dimension: "language",
      domain: "vocabulary",
      category: "reading",
      description: "Ancienne compétence retirée.",
      parent_id: null,
      is_active: false,
      created_at: "2026-09-01T10:00:00Z",
      updated_at: "2026-09-01T10:00:00Z",
      subskill_count: 0,
      usage_counts: {
        questions: 2,
        exercises: 0,
        assessments: 0,
        student_mastery: 5,
        skill_assessments: 0,
        skill_evidence: 2,
        writing_evaluations: 0,
        speaking_evaluations: 0,
        total_dependencies: 9,
      },
    },
  ];

  const mockSkillDetailReading = {
    id: "skill-reading-1",
    taxonomy_version_id: "v-1",
    code: "reasoning.reading.main_idea",
    name: "Compréhension globale & Idée directrice",
    dimension: "reasoning",
    domain: "reading",
    category: "reading",
    description: "Identifier l'axe principal du document.",
    parent_id: null,
    is_active: true,
    created_at: "2026-10-02T10:00:00Z",
    updated_at: "2026-10-02T10:00:00Z",
    parent: null,
    children: [
      {
        id: "skill-reading-sub1",
        code: "reasoning.reading.main_idea.thesis",
        name: "Thèse centrale de l'auteur",
        dimension: "reasoning",
        domain: "reading",
        category: "reading",
        is_active: true,
      },
    ],
    level_descriptors: [
      {
        id: "desc-b1",
        skill_id: "skill-reading-1",
        level: "B1",
        descriptor: "Peut identifier l'idée générale d'un texte factuel court.",
        evidence_guidance: "Repérer le thème en moins de 45 secondes.",
        created_at: "2026-10-02T10:00:00Z",
        updated_at: "2026-10-02T10:00:00Z",
      },
      {
        id: "desc-b2",
        skill_id: "skill-reading-1",
        level: "B2",
        descriptor: "Peut identifier l'argument principal dans un article de presse complexe.",
        evidence_guidance: "Dégager la position avec 80% de précision.",
        created_at: "2026-10-02T10:00:00Z",
        updated_at: "2026-10-02T10:00:00Z",
      },
    ],
    outgoing_relations: [
      {
        id: "rel-1",
        from_skill_id: "skill-reading-1",
        to_skill_id: "skill-grammar-1",
        relation_type: "supports",
        target_skill_code: "language.syntax.connectors",
        target_skill_name: "Connecteurs logiques et articulation",
        target_skill_dimension: "language",
        created_at: "2026-10-02T10:00:00Z",
      },
    ],
    incoming_relations: [
      {
        id: "rel-2",
        from_skill_id: "skill-prereq-0",
        to_skill_id: "skill-reading-1",
        relation_type: "prerequisite",
        target_skill_code: "reasoning.reading.facts",
        target_skill_name: "Repérage d'informations factuelles",
        target_skill_dimension: "reasoning",
        created_at: "2026-10-02T10:00:00Z",
      },
    ],
    usage_counts: {
      questions: 14,
      exercises: 5,
      assessments: 3,
      student_mastery: 45,
      skill_assessments: 2,
      skill_evidence: 12,
      writing_evaluations: 0,
      speaking_evaluations: 0,
      total_dependencies: 81,
    },
  };

  const mockSkillDetailGrammar = {
    id: "skill-grammar-1",
    taxonomy_version_id: "v-1",
    code: "language.syntax.connectors",
    name: "Connecteurs logiques et articulation",
    dimension: "language",
    domain: "grammar",
    category: "transversal",
    description: "Emploi et compréhension des marqueurs de relation.",
    parent_id: null,
    is_active: true,
    created_at: "2026-10-02T10:00:00Z",
    updated_at: "2026-10-02T10:00:00Z",
    parent: null,
    children: [],
    level_descriptors: [],
    outgoing_relations: [],
    incoming_relations: [],
    usage_counts: {
      questions: 0,
      exercises: 0,
      assessments: 0,
      student_mastery: 0,
      skill_assessments: 0,
      skill_evidence: 0,
      writing_evaluations: 0,
      speaking_evaluations: 0,
      total_dependencies: 0,
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.setItem("auth_token", "fake-admin-token");
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  const setupFetchMock = (skillsResponseItems = mockSkillsList) => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method || "GET";

      // Metadata
      if (url.includes("/admin/taxonomy/metadata")) {
        return {
          ok: true,
          json: async () => mockMetadata,
        } as Response;
      }

      // Individual Skill Detail
      if (url.includes("/admin/taxonomy/skills/skill-reading-1") && method === "GET") {
        return {
          ok: true,
          json: async () => mockSkillDetailReading,
        } as Response;
      }

      if (url.includes("/admin/taxonomy/skills/skill-grammar-1") && method === "GET") {
        return {
          ok: true,
          json: async () => mockSkillDetailGrammar,
        } as Response;
      }

      // Archive Skill
      if (url.includes("/admin/taxonomy/skills/skill-reading-1/archive") && method === "POST") {
        return {
          ok: true,
          json: async () => ({ ...mockSkillDetailReading, is_active: false }),
        } as Response;
      }

      // Restore Skill
      if (url.includes("/admin/taxonomy/skills/skill-reading-1/restore") && method === "POST") {
        return {
          ok: true,
          json: async () => ({ ...mockSkillDetailReading, is_active: true }),
        } as Response;
      }

      // Delete Skill
      if (url.includes("/admin/taxonomy/skills/skill-grammar-1") && method === "DELETE") {
        return {
          ok: true,
          status: 204,
          json: async () => ({}),
        } as Response;
      }

      // Add child subskill
      if (url.includes("/admin/taxonomy/skills/skill-reading-1/children") && method === "POST") {
        const body = JSON.parse(init?.body as string);
        return {
          ok: true,
          json: async () => ({
            id: "sub-new-123",
            code: body.code,
            name: body.name,
            dimension: "reasoning",
            domain: "reading",
            is_active: true,
          }),
        } as Response;
      }

      // Upsert CEFR Descriptor
      if (url.includes("/admin/taxonomy/skills/skill-reading-1/descriptors") && method === "PUT") {
        const body = JSON.parse(init?.body as string);
        return {
          ok: true,
          json: async () => ({
            id: "desc-new",
            skill_id: "skill-reading-1",
            level: body.level,
            descriptor: body.descriptor,
            evidence_guidance: body.evidence_guidance,
            created_at: "2026-10-02T10:00:00Z",
            updated_at: "2026-10-02T10:00:00Z",
          }),
        } as Response;
      }

      // Create Relation
      if (url.includes("/admin/taxonomy/skills/skill-reading-1/relations") && method === "POST") {
        const body = JSON.parse(init?.body as string);
        return {
          ok: true,
          json: async () => ({
            id: "rel-new",
            from_skill_id: "skill-reading-1",
            to_skill_id: body.to_skill_id,
            relation_type: body.relation_type,
            created_at: "2026-10-02T10:00:00Z",
          }),
        } as Response;
      }

      // Create Root Skill
      if (url.includes("/admin/taxonomy/skills") && method === "POST") {
        const body = JSON.parse(init?.body as string);
        return {
          ok: true,
          json: async () => ({
            id: "skill-new-789",
            taxonomy_version_id: "v-1",
            code: body.code,
            name: body.name,
            dimension: body.dimension,
            domain: body.domain,
            is_active: true,
            children: [],
            level_descriptors: [],
            outgoing_relations: [],
            incoming_relations: [],
            usage_counts: {
              questions: 0,
              exercises: 0,
              assessments: 0,
              student_mastery: 0,
              skill_assessments: 0,
              skill_evidence: 0,
              writing_evaluations: 0,
              speaking_evaluations: 0,
              total_dependencies: 0,
            },
          }),
        } as Response;
      }

      // Skills List
      if (url.includes("/admin/taxonomy/skills") && method === "GET") {
        return {
          ok: true,
          json: async () => ({
            items: skillsResponseItems,
            total: skillsResponseItems.length,
            page: 1,
            page_size: 100,
            total_pages: 1,
          }),
        } as Response;
      }

      return { ok: false, status: 404 } as Response;
    });
  };

  it("renders page header with Taxonomy V2 version badge and metric cards", async () => {
    setupFetchMock();

    render(
      <MemoryRouter>
        <SkillsManagerPage />
      </MemoryRouter>
    );

    // Title and version badge
    expect(await screen.findByRole("heading", { name: /Référentiel des compétences/i })).toBeInTheDocument();
    expect(await screen.findByText("v2.0.0-tef-canada")).toBeInTheDocument();

    // Metric strip
    expect(await screen.findByText("Raisonnement cognitif")).toBeInTheDocument();
    expect(screen.getByText("Maîtrise linguistique")).toBeInTheDocument();
    expect(screen.getByText("Prérequis & Dépendances")).toBeInTheDocument();
    expect(screen.getByText("Descripteurs CECRL")).toBeInTheDocument();
  });

  it("renders navigator with dimension badges and auto-selects the first skill", async () => {
    setupFetchMock();

    render(
      <MemoryRouter>
        <SkillsManagerPage />
      </MemoryRouter>
    );

    // Competency cards in navigator
    expect(await screen.findAllByText("Compréhension globale & Idée directrice")).not.toHaveLength(0);
    expect(screen.getByText("Connecteurs logiques et articulation")).toBeInTheDocument();

    // Selected skill detail loaded on right side
    expect(await screen.findByText("ID: skill-reading-1")).toBeInTheDocument();
    expect(screen.getAllByText("reasoning.reading.main_idea").length).toBeGreaterThanOrEqual(1);

    // Dimension indicators
    expect(screen.getAllByText("Raisonnement").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Langue").length).toBeGreaterThanOrEqual(1);
  });

  it("navigates across all 6 tabs in detail console", async () => {
    setupFetchMock();

    render(
      <MemoryRouter initialEntries={["/admin/skills?skill=skill-reading-1"]}>
        <SkillsManagerPage />
      </MemoryRouter>
    );

    // Tab 1: Overview
    expect(await screen.findByText("Périmètre Pédagogique & Objectifs")).toBeInTheDocument();
    expect(screen.getByText("Impact Réel & Dépendances Plateforme")).toBeInTheDocument();
    expect(screen.getByText(/Total : 81 références/i)).toBeInTheDocument();

    // Tab 2: Subskills
    const subskillsTab = screen.getByRole("tab", { name: /Sous-compétences/i });
    fireEvent.mouseDown(subskillsTab, { button: 0 });
    expect(await screen.findByText("Thèse centrale de l'auteur")).toBeInTheDocument();
    expect(screen.getByText("reasoning.reading.main_idea.thesis")).toBeInTheDocument();

    // Tab 3: Mapping & Relations
    const mappingTab = screen.getByRole("tab", { name: /Cartographie/i });
    fireEvent.mouseDown(mappingTab, { button: 0 });
    expect(await screen.findByText(/Prérequis requis en amont/i)).toBeInTheDocument();
    expect(screen.getByText(/Relations & Dépendances sortantes/i)).toBeInTheDocument();
    expect(screen.getByText("reasoning.reading.facts")).toBeInTheDocument();
    expect(screen.getAllByText("Connecteurs logiques et articulation").length).toBeGreaterThanOrEqual(1);

    // Tab 4: CEFR Descriptors
    const cefrTab = screen.getByRole("tab", { name: /CECRL/i });
    fireEvent.mouseDown(cefrTab, { button: 0 });
    expect(await screen.findByText(/Descripteurs de Compétence CECRL/i)).toBeInTheDocument();
    expect(screen.getByText("Peut identifier l'idée générale d'un texte factuel court.")).toBeInTheDocument();
    expect(screen.getByText("Palier CECRL B1")).toBeInTheDocument();
    expect(screen.getByText("Palier CECRL B2")).toBeInTheDocument();

    // Tab 5: Linked Content
    const contentTab = screen.getByRole("tab", { name: /Contenus associés/i });
    fireEvent.mouseDown(contentTab, { button: 0 });
    expect(await screen.findByText("Questions d'examen")).toBeInTheDocument();
    expect(screen.getByText("Exercices drill")).toBeInTheDocument();
    expect(screen.getByText("Simulations TEF")).toBeInTheDocument();

    // Tab 6: Activity & Audit
    const activityTab = screen.getByRole("tab", { name: /Activité/i });
    fireEvent.mouseDown(activityTab, { button: 0 });
    expect(await screen.findByText("Historique & Traçabilité Réglementaire")).toBeInTheDocument();
    expect(screen.getByText("Protection contre la suppression")).toBeInTheDocument();
  });

  it("blocks deletion for competencies with active dependencies and permits archival", async () => {
    setupFetchMock();

    render(
      <MemoryRouter initialEntries={["/admin/skills?skill=skill-reading-1"]}>
        <SkillsManagerPage />
      </MemoryRouter>
    );

    await screen.findAllByText("Compréhension globale & Idée directrice");

    // Click delete button
    const deleteBtn = screen.getByTitle("Supprimer la compétence");
    fireEvent.click(deleteBtn);

    // Modal should show dependency block warning
    expect(await screen.findByText("Suppression bloquée")).toBeInTheDocument();
    expect(screen.getByText(/Cette compétence ne peut pas être supprimée car elle est activement liée/i)).toBeInTheDocument();
    expect(screen.getByText("Archiver à la place")).toBeInTheDocument();
  });

  it("opens skill creation sheet and validates required inputs for Taxonomy V2", async () => {
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

    // Dimension selectors & inputs exist
    expect(screen.getByText("Dimension taxonomique")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/reasoning.inference.implicit/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Repérer des informations/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/syntax, reading/i)).toBeInTheDocument();
  });

  it("opens CEFR descriptor modal to edit benchmark statements", async () => {
    setupFetchMock();

    render(
      <MemoryRouter initialEntries={["/admin/skills?skill=skill-reading-1&tab=cefr"]}>
        <SkillsManagerPage />
      </MemoryRouter>
    );

    // Click "Définir" on A1 descriptor
    const defineA1Btn = (await screen.findAllByRole("button", { name: /Définir/i }))[0];
    fireEvent.click(defineA1Btn);

    expect(await screen.findByText(/Définir le descripteur CECRL/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Peut repérer des informations factuelles/i)).toBeInTheDocument();
  });

  it("opens relation dialog to add dependency graph edge", async () => {
    setupFetchMock();

    render(
      <MemoryRouter initialEntries={["/admin/skills?skill=skill-reading-1&tab=mapping"]}>
        <SkillsManagerPage />
      </MemoryRouter>
    );

    const addRelBtn = await screen.findByRole("button", { name: /Ajouter une relation/i });
    fireEvent.click(addRelBtn);

    expect(await screen.findByText("Ajouter une relation de dépendance")).toBeInTheDocument();
    expect(screen.getByLabelText(/Compétence cible/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Type de relation/i)).toBeInTheDocument();
  });
});
