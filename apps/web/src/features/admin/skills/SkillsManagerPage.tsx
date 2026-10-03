import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { AdminLayout } from "../AdminLayout";

import {
  fetchTaxonomyMetadata,
  fetchTaxonomySkills,
  getSkillDetail,
  createSkill,
  updateSkill,
  archiveSkill,
  restoreSkill,
  deleteSkill,
  createChildSkill,
  upsertSkillDescriptor,
  deleteSkillDescriptor,
  createSkillRelation,
  deleteSkillRelation,
} from "./api";
import type {
  TaxonomySkillItem,
  TaxonomySkillDetail,
  TaxonomySkillSummary,
  SkillLevelDescriptor,
  CEFRBand,
  SkillFilterParams,
} from "./types";
import type {
  SkillFormValues,
  ChildSkillFormValues,
  CefrDescriptorFormValues,
  SkillRelationFormValues,
} from "./schemas";

import { SkillsHeader } from "./components/SkillsHeader";
import { SkillsMetrics } from "./components/SkillsMetrics";
import { SkillsToolbar } from "./components/SkillsToolbar";
import { SkillsNavigator } from "./components/SkillsNavigator";
import { SkillDetail } from "./components/SkillDetail";
import { SkillFormSheet } from "./components/SkillFormSheet";
import { SubskillFormSheet } from "./components/SubskillFormSheet";
import { ArchiveSkillDialog } from "./components/ArchiveSkillDialog";
import { DeleteSkillDialog } from "./components/DeleteSkillDialog";
import { CefrDescriptorDialog } from "./components/CefrDescriptorDialog";
import { SkillRelationDialog } from "./components/SkillRelationDialog";

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
  const dimensionFilter = searchParams.get("dimension") || "all";
  const modalityFilter = searchParams.get("modality") || "all";
  const domainFilter = searchParams.get("domain") || "all";
  const statusFilter = searchParams.get("status") || "all";
  const selectedSkillId = searchParams.get("skill");
  const activeTab = searchParams.get("tab") || "overview";

  // Transient feedback banner
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sheets & Dialogs
  const [skillSheetOpen, setSkillSheetOpen] = useState(false);
  const [skillToEdit, setSkillToEdit] = useState<TaxonomySkillDetail | TaxonomySkillItem | null>(null);

  const [subskillSheetOpen, setSubskillSheetOpen] = useState(false);
  const [subskillToEdit, setSubskillToEdit] = useState<TaxonomySkillSummary | null>(null);
  const [parentSkillForSubskill, setParentSkillForSubskill] = useState<TaxonomySkillDetail | null>(null);

  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [skillToArchive, setSkillToArchive] = useState<TaxonomySkillDetail | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [skillToDelete, setSkillToDelete] = useState<TaxonomySkillDetail | null>(null);

  const [descriptorDialogOpen, setDescriptorDialogOpen] = useState(false);
  const [descriptorLevel, setDescriptorLevel] = useState<CEFRBand | null>(null);
  const [descriptorToEdit, setDescriptorToEdit] = useState<SkillLevelDescriptor | null>(null);

  const [relationDialogOpen, setRelationDialogOpen] = useState(false);

  // Helper to update URL search parameters
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
    const p: SkillFilterParams = { page_size: 100 };

    if (searchQuery.trim()) p.q = searchQuery.trim();
    if (dimensionFilter !== "all") p.dimension = dimensionFilter;
    if (domainFilter !== "all") p.domain = domainFilter;
    if (modalityFilter !== "all") p.modality = modalityFilter;
    if (statusFilter === "active") p.is_active = true;
    if (statusFilter === "archived") p.is_active = false;

    return p;
  }, [searchQuery, dimensionFilter, domainFilter, modalityFilter, statusFilter]);

  // Query: Taxonomy Metadata & Global Metrics
  const { data: metadata = null, isLoading: isLoadingMetadata } = useQuery({
    queryKey: ["admin", "taxonomy", "metadata"],
    queryFn: fetchTaxonomyMetadata,
  });

  // Query: Skills List
  const {
    data: skillsResponse,
    isLoading: isLoadingSkills,
    isError: isSkillsError,
    error: skillsError,
  } = useQuery({
    queryKey: ["admin", "taxonomy", "skills", filterParams],
    queryFn: () => fetchTaxonomySkills(filterParams),
  });

  const skillsList: TaxonomySkillItem[] = skillsResponse?.items || [];

  // Query: Selected Skill Detail
  const {
    data: selectedSkill = null,
    isLoading: isLoadingDetail,
  } = useQuery({
    queryKey: ["admin", "taxonomy", "skill", selectedSkillId],
    queryFn: () => getSkillDetail(selectedSkillId!),
    enabled: !!selectedSkillId,
  });

  // Auto-select first skill if none selected
  useEffect(() => {
    if (!selectedSkillId && skillsList.length > 0) {
      updateUrlParam("skill", skillsList[0].id);
    }
  }, [selectedSkillId, skillsList]);

  // Dismiss feedback automatically after 5s
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Invalidation helper
  const invalidateCatalog = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "taxonomy", "skills"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "taxonomy", "metadata"] });
    if (selectedSkillId) {
      queryClient.invalidateQueries({ queryKey: ["admin", "taxonomy", "skill", selectedSkillId] });
    }
  };

  // --- Mutations ---
  const createSkillMutation = useMutation({
    mutationFn: (values: SkillFormValues) =>
      createSkill({
        code: values.code,
        name: values.name,
        dimension: values.dimension,
        domain: values.domain,
        category: values.category || null,
        description: values.description || null,
        is_active: values.is_active,
      }),
    onSuccess: (newSkill) => {
      invalidateCatalog();
      updateUrlParam("skill", newSkill.id);
      setSkillSheetOpen(false);
      setFeedback({ type: "success", text: `La compétence "${newSkill.name}" a été créée avec succès.` });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", text: err.message || "Erreur lors de la création de la compétence." });
    },
  });

  const updateSkillMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: SkillFormValues }) =>
      updateSkill(id, {
        name: values.name,
        dimension: values.dimension,
        domain: values.domain,
        category: values.category || null,
        description: values.description || null,
        is_active: values.is_active,
      }),
    onSuccess: (updated) => {
      invalidateCatalog();
      setSkillSheetOpen(false);
      setSkillToEdit(null);
      setFeedback({ type: "success", text: `La compétence "${updated.name}" a été mise à jour.` });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", text: err.message || "Erreur lors de la mise à jour." });
    },
  });

  const archiveSkillMutation = useMutation({
    mutationFn: (id: string) => archiveSkill(id),
    onSuccess: (archived) => {
      invalidateCatalog();
      setArchiveDialogOpen(false);
      setDeleteDialogOpen(false);
      setSkillToArchive(null);
      setFeedback({ type: "success", text: `La compétence "${archived.name}" a été archivée avec succès.` });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", text: err.message || "Erreur lors de l'archivage." });
    },
  });

  const restoreSkillMutation = useMutation({
    mutationFn: (id: string) => restoreSkill(id),
    onSuccess: (restored) => {
      invalidateCatalog();
      setFeedback({ type: "success", text: `La compétence "${restored.name}" a été réactivée.` });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", text: err.message || "Erreur lors de la réactivation." });
    },
  });

  const deleteSkillMutation = useMutation({
    mutationFn: (id: string) => deleteSkill(id),
    onSuccess: () => {
      invalidateCatalog();
      setDeleteDialogOpen(false);
      setSkillToDelete(null);
      updateUrlParam("skill", null);
      setFeedback({ type: "success", text: "Compétence supprimée définitivement." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", text: err.message || "Erreur lors de la suppression." });
    },
  });

  const createChildMutation = useMutation({
    mutationFn: ({ parentId, values }: { parentId: string; values: ChildSkillFormValues }) =>
      createChildSkill(parentId, {
        code: values.code,
        name: values.name,
        description: values.description || null,
        category: values.category || null,
        is_active: values.is_active,
      }),
    onSuccess: (child) => {
      invalidateCatalog();
      setSubskillSheetOpen(false);
      setSubskillToEdit(null);
      setFeedback({ type: "success", text: `Sous-compétence "${child.name}" ajoutée avec succès.` });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", text: err.message || "Erreur lors de l'ajout de la sous-compétence." });
    },
  });

  const upsertDescriptorMutation = useMutation({
    mutationFn: ({ skillId, values }: { skillId: string; values: CefrDescriptorFormValues }) =>
      upsertSkillDescriptor(skillId, {
        level: values.level,
        descriptor: values.descriptor,
        evidence_guidance: values.evidence_guidance || null,
      }),
    onSuccess: (_, vars) => {
      invalidateCatalog();
      setDescriptorDialogOpen(false);
      setDescriptorToEdit(null);
      setFeedback({ type: "success", text: `Descripteur CECRL ${vars.values.level} enregistré avec succès.` });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", text: err.message || "Erreur lors de l'enregistrement du descripteur CECRL." });
    },
  });

  const deleteDescriptorMutation = useMutation({
    mutationFn: ({ skillId, level }: { skillId: string; level: string }) =>
      deleteSkillDescriptor(skillId, level),
    onSuccess: (_, vars) => {
      invalidateCatalog();
      setFeedback({ type: "success", text: `Descripteur CECRL ${vars.level} supprimé.` });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", text: err.message || "Erreur lors de la suppression du descripteur." });
    },
  });

  const createRelationMutation = useMutation({
    mutationFn: ({ skillId, values }: { skillId: string; values: SkillRelationFormValues }) =>
      createSkillRelation(skillId, {
        to_skill_id: values.to_skill_id,
        relation_type: values.relation_type,
      }),
    onSuccess: () => {
      invalidateCatalog();
      setRelationDialogOpen(false);
      setFeedback({ type: "success", text: "Relation de dépendance ajoutée avec succès au graphe." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", text: err.message || "Erreur lors de la création de la relation." });
    },
  });

  const deleteRelationMutation = useMutation({
    mutationFn: ({ skillId, relationId }: { skillId: string; relationId: string }) =>
      deleteSkillRelation(skillId, relationId),
    onSuccess: () => {
      invalidateCatalog();
      setFeedback({ type: "success", text: "Relation supprimée du graphe." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", text: err.message || "Erreur lors de la suppression de la relation." });
    },
  });

  // Action handlers
  const handleOpenNewSkill = () => {
    setSkillToEdit(null);
    setSkillSheetOpen(true);
  };

  const handleEditSkill = (s: TaxonomySkillDetail) => {
    setSkillToEdit(s);
    setSkillSheetOpen(true);
  };

  const handleArchiveSkill = (s: TaxonomySkillDetail) => {
    setSkillToArchive(s);
    setArchiveDialogOpen(true);
  };

  const handleDeleteSkill = (s: TaxonomySkillDetail) => {
    setSkillToDelete(s);
    setDeleteDialogOpen(true);
  };

  const handleAddSubskill = (parent: TaxonomySkillDetail) => {
    setParentSkillForSubskill(parent);
    setSubskillToEdit(null);
    setSubskillSheetOpen(true);
  };

  const handleEditSubskill = (child: TaxonomySkillSummary) => {
    setSubskillToEdit(child);
    setSubskillSheetOpen(true);
  };

  const handleOpenDescriptorModal = (level: CEFRBand, current?: SkillLevelDescriptor) => {
    setDescriptorLevel(level);
    setDescriptorToEdit(current || null);
    setDescriptorDialogOpen(true);
  };

  const handleResetFilters = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("search");
      next.delete("dimension");
      next.delete("domain");
      next.delete("modality");
      next.delete("status");
      return next;
    });
  };

  const hasActiveFilters =
    !!searchQuery ||
    dimensionFilter !== "all" ||
    domainFilter !== "all" ||
    modalityFilter !== "all" ||
    statusFilter !== "all";

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <SkillsHeader
          totalCount={metadata?.metrics?.total_competencies || skillsList.length}
          activeVersion={metadata?.active_version}
          onNewSkill={handleOpenNewSkill}
        />

        {/* Global Feedback Banner */}
        {feedback && (
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs sm:text-sm animate-in fade-in duration-200 ${
              feedback.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                : "bg-destructive/10 border-destructive/30 text-destructive dark:text-red-400"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === "success" ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="size-4 shrink-0 text-destructive" />
              )}
              <span>{feedback.text}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition cursor-pointer"
              aria-label="Fermer la notification"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* Global Taxonomy Metrics */}
        <SkillsMetrics metrics={metadata?.metrics || null} isLoading={isLoadingMetadata} />

        {/* Master-Detail Split Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: Search, Filters & Hierarchical Navigator */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-3.5">
            <SkillsToolbar
              searchQuery={searchQuery}
              onSearchChange={(q) => updateUrlParam("search", q)}
              dimensionFilter={dimensionFilter}
              onDimensionChange={(d) => updateUrlParam("dimension", d)}
              modalityFilter={modalityFilter}
              onModalityChange={(m) => updateUrlParam("modality", m)}
              domainFilter={domainFilter}
              onDomainChange={(dom) => updateUrlParam("domain", dom)}
              statusFilter={statusFilter}
              onStatusChange={(s) => updateUrlParam("status", s)}
              availableDomains={metadata?.domains || []}
              onResetFilters={handleResetFilters}
              hasActiveFilters={hasActiveFilters}
            />

            {/* Error State */}
            {isSkillsError ? (
              <div className="p-6 text-center bg-card border border-destructive/30 rounded-xl space-y-2">
                <AlertCircle className="size-6 text-destructive mx-auto" />
                <p className="text-xs font-semibold text-destructive">
                  Erreur de chargement du référentiel
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {(skillsError as any)?.message || "Impossible de contacter l'API taxonomie."}
                </p>
              </div>
            ) : (
              <SkillsNavigator
                skills={skillsList}
                selectedSkillId={selectedSkillId}
                onSelectSkill={(id) => updateUrlParam("skill", id)}
                isLoading={isLoadingSkills}
              />
            )}
          </div>

          {/* RIGHT COLUMN: Selected Competency Console Workspace */}
          <div className="lg:col-span-7 xl:col-span-8 min-w-0">
            <SkillDetail
              skill={selectedSkill}
              isLoading={isLoadingDetail}
              onEditSkill={handleEditSkill}
              onArchiveSkill={handleArchiveSkill}
              onRestoreSkill={(s) => restoreSkillMutation.mutate(s.id)}
              onDeleteSkill={handleDeleteSkill}
              onAddSubskill={handleAddSubskill}
              onEditSubskill={handleEditSubskill}
              onToggleChildStatus={(child) => {
                if (child.is_active) {
                  archiveSkillMutation.mutate(child.id);
                } else {
                  restoreSkillMutation.mutate(child.id);
                }
              }}
              onSelectSkill={(id) => updateUrlParam("skill", id)}
              onAddRelation={() => setRelationDialogOpen(true)}
              onDeleteRelation={(relationId) => {
                if (selectedSkill) {
                  deleteRelationMutation.mutate({ skillId: selectedSkill.id, relationId });
                }
              }}
              onEditCefrDescriptor={handleOpenDescriptorModal}
              onDeleteCefrDescriptor={(level) => {
                if (selectedSkill) {
                  deleteDescriptorMutation.mutate({ skillId: selectedSkill.id, level });
                }
              }}
              activeTab={activeTab}
              onTabChange={(tab) => updateUrlParam("tab", tab)}
            />
          </div>
        </div>
      </div>

      {/* --- Dialogs and Sheets --- */}
      {/* Skill Create / Edit Sheet */}
      <SkillFormSheet
        open={skillSheetOpen}
        onOpenChange={setSkillSheetOpen}
        skillToEdit={skillToEdit}
        onSubmit={async (values) => {
          if (skillToEdit) {
            await updateSkillMutation.mutateAsync({ id: skillToEdit.id, values });
          } else {
            await createSkillMutation.mutateAsync(values);
          }
        }}
        isSubmitting={createSkillMutation.isPending || updateSkillMutation.isPending}
        availableDomains={metadata?.domains || []}
      />

      {/* Child Subskill Sheet */}
      <SubskillFormSheet
        open={subskillSheetOpen}
        onOpenChange={setSubskillSheetOpen}
        parentSkill={parentSkillForSubskill || selectedSkill}
        subskillToEdit={subskillToEdit}
        onSubmit={async (values) => {
          const parentId = parentSkillForSubskill?.id || selectedSkill?.id;
          if (parentId) {
            await createChildMutation.mutateAsync({ parentId, values });
          }
        }}
        isSubmitting={createChildMutation.isPending}
      />

      {/* Archive Skill Dialog */}
      <ArchiveSkillDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        skill={skillToArchive}
        onConfirmArchive={async () => {
          if (skillToArchive) {
            await archiveSkillMutation.mutateAsync(skillToArchive.id);
          }
        }}
        isArchiving={archiveSkillMutation.isPending}
      />

      {/* Safe Delete Skill Dialog */}
      <DeleteSkillDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        skill={skillToDelete}
        onConfirmDelete={async () => {
          if (skillToDelete) {
            await deleteSkillMutation.mutateAsync(skillToDelete.id);
          }
        }}
        onArchiveInstead={async () => {
          if (skillToDelete) {
            await archiveSkillMutation.mutateAsync(skillToDelete.id);
          }
        }}
        isDeleting={deleteSkillMutation.isPending}
      />

      {/* CEFR Descriptor Modal */}
      <CefrDescriptorDialog
        open={descriptorDialogOpen}
        onOpenChange={setDescriptorDialogOpen}
        skill={selectedSkill}
        level={descriptorLevel}
        descriptorToEdit={descriptorToEdit}
        onSubmit={async (values) => {
          if (selectedSkill) {
            await upsertDescriptorMutation.mutateAsync({ skillId: selectedSkill.id, values });
          }
        }}
        isSubmitting={upsertDescriptorMutation.isPending}
      />

      {/* Skill Relation Modal */}
      <SkillRelationDialog
        open={relationDialogOpen}
        onOpenChange={setRelationDialogOpen}
        currentSkill={selectedSkill}
        availableSkills={skillsList}
        onSubmit={async (values) => {
          if (selectedSkill) {
            await createRelationMutation.mutateAsync({ skillId: selectedSkill.id, values });
          }
        }}
        isSubmitting={createRelationMutation.isPending}
      />
    </AdminLayout>
  );
};

export const SkillsManagerPage: React.FC = () => {
  return (
    <QueryClientProvider client={fallbackQueryClient}>
      <SkillsManagerPageContent />
    </QueryClientProvider>
  );
};
