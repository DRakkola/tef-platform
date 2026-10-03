/**
 * Comprehensive frontend tests for Content Studio (Admin module).
 */

import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AdminDashboardPage } from "@/features/admin/AdminDashboardPage";
import { SkillsManagerPage } from "@/features/admin/SkillsManagerPage";
import { AssessmentsListPage } from "@/features/admin/AssessmentsListPage";
import { ReviewsManagerPage } from "@/features/admin/ReviewsManagerPage";
import { AuditLogsPage } from "@/features/admin/AuditLogsPage";

describe("Content Studio Admin UI", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.setItem("auth_token", "fake-admin-token-xyz");
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("renders AdminDashboardPage with metrics and quick actions", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/admin/content/assessments")) {
        return {
          ok: true,
          json: async () => ({ items: [], total: 4 }),
        } as Response;
      }
      if (url.includes("/admin/content/questions")) {
        return {
          ok: true,
          json: async () => ({ items: [], total: 42 }),
        } as Response;
      }
      if (url.includes("/admin/content/exercises")) {
        return {
          ok: true,
          json: async () => ({ items: [], total: 15 }),
        } as Response;
      }
      if (url.includes("/admin/content/writing-tasks")) {
        return {
          ok: true,
          json: async () => ({ items: [], total: 6 }),
        } as Response;
      }
      if (url.includes("/admin/media")) {
        return {
          ok: true,
          json: async () => ({ items: [], total: 8 }),
        } as Response;
      }
      if (url.includes("/admin/content/reviews")) {
        return {
          ok: true,
          json: async () => ({ items: [], total: 2 }),
        } as Response;
      }
      if (url.includes("/admin/audit-logs")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: "audit-1",
                action: "content.publish",
                entity_type: "assessment",
                entity_id: "asmt-101",
                payload: { title: "TEF Simulation B2" },
                created_at: "2026-09-18T00:00:00Z",
              },
            ],
            total: 1,
          }),
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    render(
      <MemoryRouter>
        <AdminDashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Content Studio Dashboard")).toBeInTheDocument();
    expect(
      await screen.findByText("Publishing Validation & Immutability Engine")
    ).toBeInTheDocument();
    expect(screen.getByText("Section & Question Integrity")).toBeInTheDocument();
    expect(screen.getByText("Snapshot Immutability")).toBeInTheDocument();

    // Verify stats loaded
    expect(await screen.findByText("42")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();

    // Verify recent audit
    expect(await screen.findByText("content.publish")).toBeInTheDocument();
    expect(screen.getByText(/asmt-101/i)).toBeInTheDocument();
  });

  it("renders SkillsManagerPage and lists canonical skills with subskills", async () => {
    const mockTaxonomyMetadata = {
      dimensions: ["reasoning", "language"],
      domains: ["reading"],
      relation_types: ["prerequisite", "depends_on", "supports", "related"],
      cefr_bands: ["A1", "A2", "B1", "B2", "C1", "C2"],
      active_version: {
        id: "v-1",
        version: "v2.0.0-tef-canada",
        name: "TEF Canada 2026",
      },
      metrics: {
        total_skills: 1,
        total_subskills: 2,
        total_competencies: 3,
        dimensions_breakdown: { reasoning: 3, language: 0 },
        domains_breakdown: { reading: 3 },
        active_skills: 3,
        archived_skills: 0,
        total_relations: 0,
        total_descriptors: 0,
      },
    };

    const mockSkillsList = [
      {
        id: "skill-reading",
        taxonomy_version_id: "v-1",
        code: "reading_comp",
        name: "Compréhension Écrite",
        dimension: "reasoning",
        domain: "reading",
        category: "reading",
        description: "Compréhension de documents rédigés.",
        parent_id: null,
        is_active: true,
        subskill_count: 2,
        usage_counts: {
          questions: 5,
          exercises: 2,
          assessments: 1,
          student_mastery: 10,
          skill_assessments: 0,
          skill_evidence: 4,
          writing_evaluations: 0,
          speaking_evaluations: 0,
          total_dependencies: 22,
        },
      },
    ];

    const mockSkillDetail = {
      ...mockSkillsList[0],
      children: [
        {
          id: "sub-1",
          code: "reading_main_idea",
          name: "Identifier l'idée générale",
          dimension: "reasoning",
          domain: "reading",
          is_active: true,
        },
        {
          id: "sub-2",
          code: "reading_implicit",
          name: "Déduire le sens implicite",
          dimension: "reasoning",
          domain: "reading",
          is_active: true,
        },
      ],
      level_descriptors: [],
      outgoing_relations: [],
      incoming_relations: [],
    };

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/admin/taxonomy/metadata")) {
        return {
          ok: true,
          json: async () => mockTaxonomyMetadata,
        } as Response;
      }
      if (url.includes("/admin/taxonomy/skills/skill-reading")) {
        return {
          ok: true,
          json: async () => mockSkillDetail,
        } as Response;
      }
      if (url.includes("/admin/taxonomy/skills")) {
        return {
          ok: true,
          json: async () => ({
            items: mockSkillsList,
            total: 1,
            page: 1,
            page_size: 100,
            total_pages: 1,
          }),
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    render(
      <MemoryRouter>
        <SkillsManagerPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: /compétences/i })).toBeInTheDocument();
    const skillNameElements = await screen.findAllByText("Compréhension Écrite");
    expect(skillNameElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("reading_comp").length).toBeGreaterThanOrEqual(1);

    // Verify subskills tab renders subskills
    const subTab = await screen.findByRole("tab", { name: /Sous-compétences/i });
    expect(subTab).toBeInTheDocument();
    fireEvent.mouseDown(subTab, { button: 0 });
    expect(await screen.findByText("Identifier l'idée générale")).toBeInTheDocument();
    expect(screen.getByText("Déduire le sens implicite")).toBeInTheDocument();

    // Verify Nouvelle compétence button
    const addBtn = screen.getByRole("button", { name: /Nouvelle compétence/i });
    expect(addBtn).toBeInTheDocument();
    fireEvent.click(addBtn);

    expect(await screen.findByRole("heading", { name: /Nouvelle compétence/i })).toBeInTheDocument();
  });

  it("renders AssessmentsListPage with version badges and validation report modal", async () => {
    const mockAssessments = [
      {
        id: "asmt-1",
        title: "TEF Canada Simulation Officielle B2",
        description: "Test complet 40 questions",
        assessment_type: "reading",
        duration_seconds: 3600,
        navigation_policy: "linear",
        scoring_policy: "standard",
        pass_percentage: 60,
        status: "published",
        version: 1,
        is_published: true,
        sections: [{ id: "sec-1" }],
        created_at: "2026-09-17T12:00:00Z",
        updated_at: "2026-09-17T12:00:00Z",
      },
    ];

    const mockValReport = {
      is_valid: true,
      errors: [],
      warnings: [{ field: null, message: "No audio media attached to Section 1.", severity: "warning" }],
    };

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/admin/content/assessments/asmt-1/validate")) {
        return {
          ok: true,
          json: async () => mockValReport,
        } as Response;
      }
      if (url.includes("/admin/content/assessments")) {
        return {
          ok: true,
          json: async () => ({ items: mockAssessments, total: 1 }),
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    render(
      <MemoryRouter>
        <AssessmentsListPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("TEF Canada Simulation Officielle B2")).toBeInTheDocument();
    expect(screen.getByText("published")).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByText("60 min")).toBeInTheDocument();

    // Trigger validation
    const validateBtn = screen.getByRole("button", { name: /Validate/i });
    fireEvent.click(validateBtn);

    expect(await screen.findByText("Pre-Publishing Validation Report")).toBeInTheDocument();
    expect(screen.getByText("Passes Validation")).toBeInTheDocument();
    expect(screen.getByText("No blocking errors found.")).toBeInTheDocument();
    expect(screen.getByText("No audio media attached to Section 1.")).toBeInTheDocument();
  });

  it("renders ReviewsManagerPage and opens decision modal", async () => {
    const mockReviews = [
      {
        id: "rev-1",
        entity_type: "assessment",
        entity_id: "asmt-999",
        version: 1,
        status: "pending",
        reviewer_id: null,
        comments: "Submitted for official review.",
        created_at: "2026-09-18T00:00:00Z",
        updated_at: "2026-09-18T00:00:00Z",
      },
    ];

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/admin/content/reviews")) {
        return {
          ok: true,
          json: async () => ({ items: mockReviews, total: 1 }),
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    render(
      <MemoryRouter>
        <ReviewsManagerPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Editorial Review Queue (1)")).toBeInTheDocument();
    expect(screen.getByText("assessment Item")).toBeInTheDocument();
    expect(screen.getByText("Submitted for official review.")).toBeInTheDocument();

    // Click Approve button
    const approveBtn = screen.getByRole("button", { name: /^Approve$/ });
    fireEvent.click(approveBtn);

    expect(screen.getByText("Approve Content")).toBeInTheDocument();
    expect(screen.getByText("Confirm Approval")).toBeInTheDocument();
  });

  it("renders AuditLogsPage and inspects payload snapshot", async () => {
    const mockLogs = [
      {
        id: "log-1",
        actor_user_id: "admin-uuid-1",
        action: "content.publish",
        entity_type: "assessment",
        entity_id: "asmt-uuid-1",
        payload: { title: "TEF Simulation B2", version: 1, sections_count: 2 },
        created_at: "2026-09-18T00:00:00Z",
      },
    ];

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/admin/audit-logs")) {
        return {
          ok: true,
          json: async () => ({ items: mockLogs, total: 1 }),
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    render(
      <MemoryRouter>
        <AuditLogsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Administrative Audit Logs (1)")).toBeInTheDocument();
    expect(screen.getAllByText("content.publish").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("asmt-uui...")).toBeInTheDocument();

    // Click Payload button
    const payloadBtn = screen.getByRole("button", { name: /Payload/i });
    fireEvent.click(payloadBtn);

    expect(await screen.findByText("Audit Event Payload Snapshot")).toBeInTheDocument();
    expect(screen.getByText(/TEF Simulation B2/i)).toBeInTheDocument();
  });
});
