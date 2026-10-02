import React, { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, AlertCircle, X } from "lucide-react";
import { AdminLayout } from "../AdminLayout";
import { Button } from "@/components/ui/button";

import {
  fetchSkills,
  fetchSkillMetricsSummary,
  createSkill,
  updateSkill,
  deleteSkill,
  createSubSkill,
  updateSubSkill,
  deleteSubSkill,
} from "./api";
import type { SkillItem, SubSkill } from "./types";
import type { SkillFormValues, SubskillFormValues } from "./schemas";

import { SkillsHeader } from "./components/SkillsHeader";
import { SkillsMetrics } from "./components/SkillsMetrics";
import { SkillsToolbar } from "./components/SkillsToolbar";
import { SkillsNavigator } from "./components/SkillsNavigator";
import { SkillDetail } from "./components/SkillDetail";
import { SkillFormSheet } from "./components/SkillFormSheet";
import { SubskillFormSheet } from "./components/SubskillFormSheet";
import { DeleteSkillDialog } from "./components/DeleteSkillDialog";
import { DeleteSubskillDialog } from "./components/DeleteSubskillDialog";

const fallbackQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const SkillsManagerPageContent: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL State
  const searchQuery = searchParams.get("search") || "";
  const categoryFilter = searchParams.get("category") || "all";
  const statusFilter = searchParams.get("status") || "all";
  const hasSubskillsFilter = searchParams.get("has_subskills") || "all";
  const selectedSkillId = searchParams.get("skill");
  const activeTab = searchParams.get("tab") || "overview";

  // Transient Alert feedback state
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Dialog / Sheet states
  const [skillSheetOpen, setSkillSheetOpen] = useState(false);
  const [skillToEdit, setSkillToEdit] = useState<SkillItem | null>(null);

  const [subskillSheetOpen, setSubskillSheetOpen] = useState(false);
  const [subskillToEdit, setSubskillToEdit] = useState<SubSkill | null>(null);
  const [parentSkillForSubskill, setParentSkillForSubskill] = useState<SkillItem | null>(null);

  const [deleteSkillOpen, setDeleteSkillOpen] = useState(false);
  const [skillToDelete, setSkillToDelete] = useState<SkillItem | null>(null);

  const [deleteSubskillOpen, setDeleteSubskillOpen] = useState(false);
  const [subskillToDelete, setSubskillToDelete] = useState<SubSkill | null>(null);

  // Helper to update URL params cleanly
  const updateUrlParam = (key: string, val: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!val || val === "all") {
        next.delete(key);
      } else {
        next.set(key, val);
      }
      return next;
    });
  };

  // Convert filters for API call
  const filterParams = useMemo(() => {
    const p: {
      q?: string;
      category?: string;
      is_active?: boolean;
      has_subskills?: boolean;
    } = {};

    if (searchQuery.trim()) p.q = searchQuery.trim();
    if (categoryFilter !== "all") p.category = categoryFilter;
    if (statusFilter === "active") p.is_active = true;
    if (statusFilter === "archived") p.is_active = false;
    if (hasSubskillsFilter === "yes") p.has_subskills = true;
    if (hasSubskillsFilter === "no") p.has_subskills = false;

    return p;
  }, [searchQuery, categoryFilter, statusFilter, hasSubskillsFilter]);

  // Query: Skills
  const {
    data: skills = [],
    isLoading: isLoadingSkills,
    isError: isSkillsError,
    error: skillsError,
  } = useQuery({
    queryKey: ["admin", "skills", filterParams],
    queryFn: () => fetchSkills(filterParams),
  });

  // Query: Metrics summary
  const { data: metrics = null, isLoading: isLoadingMetrics } = useQuery({
    queryKey: ["admin", "skills", "metrics"],
    queryFn: fetchSkillMetricsSummary,
  });

  // Auto-select first skill if none selected or keep current selected
  const activeSkill = useMemo(() => {
    if (!skills || skills.length === 0) return null;
    if (selectedSkillId) {
      const found = skills.find((s) => s.id === selectedSkillId);
      if (found) return found;
    }
    return skills[0] || null;
  }, [skills, selectedSkillId]);

  // Mutation: Create Skill
  const createSkillMutation = useMutation({
    mutationFn: createSkill,
    onSuccess: (newSkill) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "skills"] });
      setSkillSheetOpen(false);
      setFeedback({ type: "success", text: `Compétence "${newSkill.name}" créée avec succès.` });
      updateUrlParam("skill", newSkill.id);
    },
    onError: (err: any) => {
      setFeedback({ type: "error", text: err.message || "Erreur lors de la création de la compétence." });
    },
  });

  // Mutation: Update Skill
  const updateSkillMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => updateSkill(id, payload),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "skills"] });
      setSkillSheetOpen(false);
      setSkillToEdit(null);
      setFeedback({ type: "success", text: `Compétence "${updated.name}" mise à jour.` });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", text: err.message || "Erreur lors de la mise à jour." });
    },
  });

  // Mutation: Delete Skill
  const deleteSkillMutation = useMutation({
    mutationFn: (id: string) => deleteSkill(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "skills"] });
      setDeleteSkillOpen(false);
      setSkillToDelete(null);
      updateUrlParam("skill", null);
      setFeedback({ type: "success", text: "Compétence supprimée définitivement." });
    },
    onError: (err: any) => {
      setDeleteSkillOpen(false);
      setFeedback({ type: "error", text: err.message || "Erreur lors de la suppression." });
    },
  });

  // Mutation: Create Subskill
  const createSubSkillMutation = useMutation({
    mutationFn: ({ skillId, payload }: { skillId: string; payload: any }) =>
      createSubSkill(skillId, payload),
    onSuccess: (newSub) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "skills"] });
      setSubskillSheetOpen(false);
      setFeedback({ type: "success", text: `Sous-compétence "${newSub.name}" ajoutée avec succès.` });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", text: err.message || "Erreur lors de l'ajout de la sous-compétence." });
    },
  });

  // Mutation: Update Subskill
  const updateSubSkillMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => updateSubSkill(id, payload),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "skills"] });
      setSubskillSheetOpen(false);
      setSubskillToEdit(null);
      setFeedback({ type: "success", text: `Sous-compétence "${updated.name}" mise à jour.` });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", text: err.message || "Erreur lors de la mise à jour." });
    },
  });

  // Mutation: Delete Subskill
  const deleteSubSkillMutation = useMutation({
    mutationFn: (id: string) => deleteSubSkill(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "skills"] });
      setDeleteSubskillOpen(false);
      setSubskillToDelete(null);
      setFeedback({ type: "success", text: "Sous-compétence supprimée." });
    },
    onError: (err: any) => {
      setDeleteSubskillOpen(false);
      setFeedback({ type: "error", text: err.message || "Erreur lors de la suppression." });
    },
  });

  // Handlers
  const handleSelectSkill = (id: string) => {
    updateUrlParam("skill", id);
  };

  const handleOpenNewSkill = () => {
    setSkillToEdit(null);
    setSkillSheetOpen(true);
  };

  const handleEditSkill = (skill: SkillItem) => {
    setSkillToEdit(skill);
    setSkillSheetOpen(true);
  };

  const handleDeleteSkill = (skill: SkillItem) => {
    setSkillToDelete(skill);
    setDeleteSkillOpen(true);
  };

  const handleToggleStatus = (skill: SkillItem) => {
    updateSkillMutation.mutate({
      id: skill.id,
      payload: { is_active: !skill.is_active },
    });
  };

  const handleArchiveInstead = async () => {
    if (!skillToDelete) return;
    updateSkillMutation.mutate({
      id: skillToDelete.id,
      payload: { is_active: false },
    });
    setDeleteSkillOpen(false);
    setSkillToDelete(null);
  };

  const handleAddSubskill = (parent: SkillItem) => {
    setParentSkillForSubskill(parent);
    setSubskillToEdit(null);
    setSubskillSheetOpen(true);
  };

  const handleEditSubskill = (sub: SubSkill) => {
    setSubskillToEdit(sub);
    if (activeSkill) setParentSkillForSubskill(activeSkill);
    setSubskillSheetOpen(true);
  };

  const handleDeleteSubskill = (sub: SubSkill) => {
    setSubskillToDelete(sub);
    setDeleteSubskillOpen(true);
  };

  const handleSkillFormSubmit = async (values: SkillFormValues) => {
    if (skillToEdit) {
      await updateSkillMutation.mutateAsync({
        id: skillToEdit.id,
        payload: {
          name: values.name,
          category: values.category,
          description: values.description,
          is_active: values.is_active,
        },
      });
    } else {
      await createSkillMutation.mutateAsync({
        code: values.code,
        name: values.name,
        category: values.category,
        description: values.description,
        is_active: values.is_active,
      });
    }
  };

  const handleSubskillFormSubmit = async (values: SubskillFormValues) => {
    if (subskillToEdit) {
      await updateSubSkillMutation.mutateAsync({
        id: subskillToEdit.id,
        payload: {
          name: values.name,
          description: values.description,
        },
      });
    } else if (parentSkillForSubskill) {
      await createSubSkillMutation.mutateAsync({
        skillId: parentSkillForSubskill.id,
        payload: {
          code: values.code,
          name: values.name,
          description: values.description,
        },
      });
    }
  };

  const hasActiveFilters =
    Boolean(searchQuery) ||
    categoryFilter !== "all" ||
    statusFilter !== "all" ||
    hasSubskillsFilter !== "all";

  const handleResetFilters = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("search");
      next.delete("category");
      next.delete("status");
      next.delete("has_subskills");
      return next;
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-5 max-w-7xl mx-auto pb-12">
        {/* 1. Page Header */}
        <SkillsHeader
          totalCount={skills.length}
          onNewSkill={handleOpenNewSkill}
        />

        {/* 2. Metric Strip */}
        <SkillsMetrics metrics={metrics} isLoading={isLoadingMetrics} />

        {/* 3. Feedback Banner */}
        {feedback && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center justify-between shadow-2xs ${
              feedback.type === "success"
                ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-300"
                : "bg-destructive/10 border border-destructive/25 text-destructive"
            }`}
          >
            <span className="flex items-center gap-2">
              {feedback.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              {feedback.text}
            </span>
            <button
              onClick={() => setFeedback(null)}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Fermer l'alerte"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* 4. Filter Toolbar */}
        <SkillsToolbar
          searchQuery={searchQuery}
          onSearchChange={(val) => updateUrlParam("search", val)}
          categoryFilter={categoryFilter}
          onCategoryChange={(val) => updateUrlParam("category", val)}
          statusFilter={statusFilter}
          onStatusChange={(val) => updateUrlParam("status", val)}
          hasSubskillsFilter={hasSubskillsFilter}
          onHasSubskillsChange={(val) => updateUrlParam("has_subskills", val)}
          onResetFilters={handleResetFilters}
          hasActiveFilters={hasActiveFilters}
        />

        {/* 5. Main Master-Detail Workspace */}
        {isSkillsError ? (
          <div className="p-8 text-center bg-card border border-border/80 rounded-xl space-y-2">
            <AlertCircle className="size-8 text-destructive mx-auto" />
            <p className="text-sm font-semibold text-foreground">Échec du chargement des compétences</p>
            <p className="text-xs text-muted-foreground">{(skillsError as any)?.message || "Vérifiez votre connexion."}</p>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-start gap-5">
            {/* Left Column: Skill Navigator */}
            <div
              className={`w-full md:w-[340px] lg:w-[380px] shrink-0 md:sticky md:top-4 md:max-h-[calc(100vh-14rem)] md:overflow-y-auto ${
                selectedSkillId ? "hidden md:block" : "block"
              }`}
            >
              <div className="pb-2 flex items-center justify-between text-xs text-muted-foreground px-1">
                <span className="font-semibold uppercase tracking-wider text-[11px]">
                  Taxonomie ({skills.length})
                </span>
                {hasActiveFilters && (
                  <span className="text-[11px] text-primary">Filtré</span>
                )}
              </div>
              <SkillsNavigator
                skills={skills}
                selectedSkillId={activeSkill?.id || null}
                onSelectSkill={handleSelectSkill}
                isLoading={isLoadingSkills}
              />
            </div>

            {/* Right Column: Skill Detail Workspace */}
            <div
              className={`flex-1 min-w-0 w-full ${
                !selectedSkillId ? "hidden md:block" : "block"
              }`}
            >
              {/* Mobile Back Button to return to navigator list */}
              {selectedSkillId && (
                <div className="md:hidden mb-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => updateUrlParam("skill", null)}
                    className="text-xs gap-1.5 text-muted-foreground"
                  >
                    <ArrowLeft className="size-3.5" /> Retour à la liste
                  </Button>
                </div>
              )}

              <SkillDetail
                skill={activeSkill}
                onEditSkill={handleEditSkill}
                onDeleteSkill={handleDeleteSkill}
                onToggleStatus={handleToggleStatus}
                onAddSubskill={handleAddSubskill}
                onEditSubskill={handleEditSubskill}
                onDeleteSubskill={handleDeleteSubskill}
                activeTab={activeTab}
                onTabChange={(tab) => updateUrlParam("tab", tab)}
              />
            </div>
          </div>
        )}

        {/* 6. Form Sheets & Confirmation Dialogs */}
        <SkillFormSheet
          open={skillSheetOpen}
          onOpenChange={setSkillSheetOpen}
          skillToEdit={skillToEdit}
          onSubmit={handleSkillFormSubmit}
          isSubmitting={createSkillMutation.isPending || updateSkillMutation.isPending}
        />

        <SubskillFormSheet
          open={subskillSheetOpen}
          onOpenChange={setSubskillSheetOpen}
          parentSkill={parentSkillForSubskill}
          subskillToEdit={subskillToEdit}
          onSubmit={handleSubskillFormSubmit}
          isSubmitting={createSubSkillMutation.isPending || updateSubSkillMutation.isPending}
        />

        <DeleteSkillDialog
          open={deleteSkillOpen}
          onOpenChange={setDeleteSkillOpen}
          skill={skillToDelete}
          onConfirmDelete={async () => {
            if (skillToDelete) {
              await deleteSkillMutation.mutateAsync(skillToDelete.id);
            }
          }}
          onArchiveInstead={handleArchiveInstead}
          isDeleting={deleteSkillMutation.isPending}
        />

        <DeleteSubskillDialog
          open={deleteSubskillOpen}
          onOpenChange={setDeleteSubskillOpen}
          subskill={subskillToDelete}
          onConfirmDelete={async () => {
            if (subskillToDelete) {
              await deleteSubSkillMutation.mutateAsync(subskillToDelete.id);
            }
          }}
          isDeleting={deleteSubSkillMutation.isPending}
        />
      </div>
    </AdminLayout>
  );
};

export const SkillsManagerPage: React.FC = () => {
  let hasClient = true;
  try {
    useQueryClient();
  } catch {
    hasClient = false;
  }

  if (!hasClient) {
    return (
      <QueryClientProvider client={fallbackQueryClient}>
        <SkillsManagerPageContent />
      </QueryClientProvider>
    );
  }

  return <SkillsManagerPageContent />;
};
