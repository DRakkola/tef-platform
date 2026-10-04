/**
 * Tests for SkillsNavigator multi-level recursive rendering (F-08).
 */

import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { SkillsNavigator } from "@/features/admin/skills/components/SkillsNavigator";
import type { TaxonomySkillItem } from "@/features/admin/skills/types";

describe("SkillsNavigator - Multi-Level Recursive Hierarchy (F-08)", () => {
  afterEach(() => {
    cleanup();
  });

  const createSkill = (
    id: string,
    name: string,
    code: string,
    parentId: string | null = null,
    subskillCount: number = 0,
    isActive: boolean = true
  ): TaxonomySkillItem => ({
    id,
    name,
    code,
    dimension: "reasoning",
    domain: "reading",
    parent_id: parentId,
    subskill_count: subskillCount,
    is_active: isActive,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  });

  it("renders 1-level flat root skills correctly", () => {
    const skills = [
      createSkill("root-1", "Compréhension Écrite", "CE_ROOT"),
      createSkill("root-2", "Compréhension Orale", "CO_ROOT"),
    ];

    render(
      <SkillsNavigator
        skills={skills}
        selectedSkillId={null}
        onSelectSkill={vi.fn()}
        isLoading={false}
      />
    );

    expect(screen.getByText("Compréhension Écrite")).toBeInTheDocument();
    expect(screen.getByText("Compréhension Orale")).toBeInTheDocument();
  });

  it("renders 2-level hierarchy and expands/collapses children", () => {
    const skills = [
      createSkill("root-1", "Compréhension Écrite", "CE_ROOT", null, 1),
      createSkill("child-1", "Extraction d'informations", "CE_EXTRACT", "root-1"),
    ];

    render(
      <SkillsNavigator
        skills={skills}
        selectedSkillId={null}
        onSelectSkill={vi.fn()}
        isLoading={false}
      />
    );

    // Initially child is collapsed
    expect(screen.getByText("Compréhension Écrite")).toBeInTheDocument();
    expect(screen.queryByText("Extraction d'informations")).not.toBeInTheDocument();

    // Click expand button
    const expandBtn = screen.getByRole("button", { name: /développer/i });
    fireEvent.click(expandBtn);

    // Child is now visible
    expect(screen.getByText("Extraction d'informations")).toBeInTheDocument();

    // Click collapse button
    const collapseBtn = screen.getByRole("button", { name: /réduire/i });
    fireEvent.click(collapseBtn);

    // Child is collapsed again
    expect(screen.queryByText("Extraction d'informations")).not.toBeInTheDocument();
  });

  it("renders 3-level canonical hierarchy (Root -> Sub-Container -> Leaf)", () => {
    const skills = [
      createSkill("root-1", "Compréhension globale", "reasoning_reading_root", null, 1),
      createSkill("sub-1", "Extraction d'informations", "reasoning_info_extraction", "root-1", 1),
      createSkill("leaf-1", "Localiser l'information factuelle", "reasoning_locate_information", "sub-1", 0),
    ];

    render(
      <SkillsNavigator
        skills={skills}
        selectedSkillId={null}
        onSelectSkill={vi.fn()}
        isLoading={false}
      />
    );

    // Expand level 0 root
    const rootExpandBtn = screen.getByRole("button", { name: /développer/i });
    fireEvent.click(rootExpandBtn);

    // Sub-container is visible
    expect(screen.getByText("Extraction d'informations")).toBeInTheDocument();

    // Expand level 1 sub-container
    const subExpandBtns = screen.getAllByRole("button", { name: /développer/i });
    // The second button is the sub-container's expand button
    fireEvent.click(subExpandBtns[subExpandBtns.length - 1]);

    // Level 2 leaf is visible!
    expect(screen.getByText("Localiser l'information factuelle")).toBeInTheDocument();
  });

  it("renders 4+ deep level hierarchy and supports selecting a deep leaf", () => {
    const onSelect = vi.fn();
    const skills = [
      createSkill("lvl-0", "Niveau 0 Racine", "LVL_0", null, 1),
      createSkill("lvl-1", "Niveau 1 Container", "LVL_1", "lvl-0", 1),
      createSkill("lvl-2", "Niveau 2 Sous-Container", "LVL_2", "lvl-1", 1),
      createSkill("lvl-3", "Niveau 3 Compétence Précise", "LVL_3", "lvl-2", 1),
      createSkill("lvl-4", "Niveau 4 Micro-Compétence", "LVL_4", "lvl-3", 0),
    ];

    const { rerender } = render(
      <SkillsNavigator
        skills={skills}
        selectedSkillId={null}
        onSelectSkill={onSelect}
        isLoading={false}
      />
    );

    // Expand all levels sequentially
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole("button", { name: /développer/i }));
    }

    // Verify deep leaf is visible
    const deepLeafBtn = screen.getByText("Niveau 4 Micro-Compétence");
    expect(deepLeafBtn).toBeInTheDocument();

    // Click on deep leaf
    fireEvent.click(deepLeafBtn);
    expect(onSelect).toHaveBeenCalledWith("lvl-4");

    // Rerender with lvl-4 selected
    rerender(
      <SkillsNavigator
        skills={skills}
        selectedSkillId="lvl-4"
        onSelectSkill={onSelect}
        isLoading={false}
      />
    );

    expect(screen.getByText("Niveau 4 Micro-Compétence")).toBeInTheDocument();
  });

  it("auto-expands ancestors when selectedSkillId is a deep leaf (URL navigation)", () => {
    const skills = [
      createSkill("root-1", "Racine", "ROOT_1", null, 1),
      createSkill("sub-1", "Sous-groupe", "SUB_1", "root-1", 1),
      createSkill("leaf-deep", "Feuille Profonde", "LEAF_DEEP", "sub-1", 0),
    ];

    // Rendering with selectedSkillId pointing directly to the deep leaf
    render(
      <SkillsNavigator
        skills={skills}
        selectedSkillId="leaf-deep"
        onSelectSkill={vi.fn()}
        isLoading={false}
      />
    );

    // Because of auto-expansion, both root, sub, and leaf are immediately visible!
    expect(screen.getByText("Racine")).toBeInTheDocument();
    expect(screen.getByText("Sous-groupe")).toBeInTheDocument();
    expect(screen.getByText("Feuille Profonde")).toBeInTheDocument();
  });

  it("handles search and filter gracefully when parent nodes are filtered out", () => {
    // When a filter isolates child nodes whose parent_id is missing from the list,
    // they should render as effective roots rather than disappearing.
    const filteredSkills = [
      createSkill("child-orphaned-by-filter", "Compétence Filtrée", "CODE_FILTER", "parent-not-in-list", 0),
    ];

    render(
      <SkillsNavigator
        skills={filteredSkills}
        selectedSkillId={null}
        onSelectSkill={vi.fn()}
        isLoading={false}
      />
    );

    expect(screen.getByText("Compétence Filtrée")).toBeInTheDocument();
  });

  it("renders archived nodes with appropriate badge at any depth", () => {
    const skills = [
      createSkill("root-archived", "Racine Active", "ROOT", null, 1, true),
      createSkill("child-archived", "Sous-compétence Archivée", "SUB_ARCH", "root-archived", 0, false),
    ];

    render(
      <SkillsNavigator
        skills={skills}
        selectedSkillId="child-archived"
        onSelectSkill={vi.fn()}
        isLoading={false}
      />
    );

    expect(screen.getByText("Sous-compétence Archivée")).toBeInTheDocument();
    expect(screen.getByText("Archivée")).toBeInTheDocument();
  });
});
