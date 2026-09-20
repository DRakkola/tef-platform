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
    const mockSkills = [
      {
        id: "skill-reading",
        code: "reading_comp",
        name: "Compréhension Écrite",
        category: "reading",
        description: "Compréhension de documents rédigés.",
        subskills: [
          {
            id: "sub-1",
            skill_id: "skill-reading",
            code: "reading_main_idea",
            name: "Identifier l'idée générale",
            description: "Dégager le thème central.",
          },
          {
            id: "sub-2",
            skill_id: "skill-reading",
            code: "reading_implicit",
            name: "Déduire le sens implicite",
            description: "Inférer des intentions.",
          },
        ],
      },
    ];

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/admin/content/skills")) {
        return {
          ok: true,
          json: async () => mockSkills,
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    render(
      <MemoryRouter>
        <SkillsManagerPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Skills & Subskills Taxonomy")).toBeInTheDocument();
    expect(await screen.findByText("Compréhension Écrite")).toBeInTheDocument();
    expect(screen.getByText("reading_comp")).toBeInTheDocument();
    expect(screen.getByText("2 subskills")).toBeInTheDocument();

    // Verify subskills rendered in tree
    expect(screen.getByText("Identifier l'idée générale")).toBeInTheDocument();
    expect(screen.getByText("Déduire le sens implicite")).toBeInTheDocument();

    // Verify Add Parent Skill button
    const addBtn = screen.getByRole("button", { name: /Add Parent Skill/i });
    expect(addBtn).toBeInTheDocument();
    fireEvent.click(addBtn);

    expect(screen.getByText("Create New Parent Skill")).toBeInTheDocument();
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
