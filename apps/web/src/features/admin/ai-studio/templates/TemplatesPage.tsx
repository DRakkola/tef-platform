import React, { useState } from "react";
import {
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit2,
  Lock,
} from "lucide-react";
import { AIStudioLayout } from "../layout/AIStudioLayout";
import { useAIStudio, AIStudioProvider } from "../context/AIStudioContext";
import { TemplateEditorModal } from "./TemplateEditorModal";
import type { AIPromptTemplate } from "../types";
import { Button } from "@/components/ui/button";

const TemplatesPageContent: React.FC = () => {
  const { templates, refreshTemplates, getAuthHeaders } = useAIStudio();

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("all");

  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [templateToEdit, setTemplateToEdit] = useState<AIPromptTemplate | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter templates
  const filteredTemplates = templates.filter((t) => {
    const matchesType = filterType === "all" || t.feature_type === filterType;
    const matchesSearch =
      !searchQuery.trim() ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      t.system_prompt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const handleSaveTemplate = async (payload: any) => {
    if (templateToEdit) {
      // Update
      const res = await fetch(`/api/v1/admin/ai-sandbox/templates/${templateToEdit.id}`, {
        method: "PUT",
        headers: getAuthHeaders(true),
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Échec de la mise à jour");
      }
      setSuccessMsg("Modèle de prompt mis à jour !");
    } else {
      // Create
      const res = await fetch("/api/v1/admin/ai-sandbox/templates", {
        method: "POST",
        headers: getAuthHeaders(true),
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Échec de la création");
      }
      setSuccessMsg("Nouveau modèle de prompt enregistré !");
    }
    await refreshTemplates();
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce modèle de prompt personnalisé ?")) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/admin/ai-sandbox/templates/${templateId}`, {
        method: "DELETE",
        headers: getAuthHeaders(false),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Échec de suppression");
      }
      await refreshTemplates();
      setSuccessMsg("Modèle supprimé avec succès.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur de suppression.");
    }
  };

  return (
    <AIStudioLayout
      title="Bibliothèque de Prompts — Actifs Réutilisables"
      description="Gestion des gabarits et instructions système de référence pour l'évaluation écrite, l'oral et le Prompt Lab."
      headerActions={
        <Button
          onClick={() => {
            setTemplateToEdit(null);
            setModalOpen(true);
          }}
          className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs rounded-xl shadow-xs"
        >
          <Plus className="size-3.5 mr-1.5" />
          Nouveau Modèle de Prompt
        </Button>
      }
    >
      {errorMsg && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-destructive text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="font-bold text-sm px-2">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="font-bold text-sm px-2">✕</button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher par nom, description ou consigne..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-background border border-border rounded-xl pl-9 pr-3 py-2 text-foreground focus:ring-1 focus:ring-primary shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-muted rounded-xl text-xs">
          {["all", "writing", "speaking", "raw"].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all uppercase text-[11px] ${
                filterType === t
                  ? "bg-card text-foreground shadow-2xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "all" ? "Tous" : t}
            </button>
          ))}
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTemplates.length === 0 ? (
          <div className="col-span-2 bg-card p-12 rounded-2xl border border-dashed border-border text-center text-xs text-muted-foreground">
            Aucun modèle ne correspond à vos critères de recherche.
          </div>
        ) : (
          filteredTemplates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-card p-5 rounded-2xl border border-border shadow-2xs space-y-3.5 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-foreground">{tpl.name}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tpl.description || "Aucune description fournie"}
                    </p>
                  </div>

                  <span
                    className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full shrink-0 ${
                      tpl.is_system_preset
                        ? "bg-muted text-muted-foreground border border-border flex items-center gap-1"
                        : "bg-primary/10 text-primary border border-primary/20"
                    }`}
                  >
                    {tpl.is_system_preset ? (
                      <>
                        <Lock className="size-2.5 inline" /> Système
                      </>
                    ) : (
                      "Personnalisé"
                    )}
                  </span>
                </div>

                <div className="p-3 bg-muted/40 rounded-xl text-xs font-mono text-foreground max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {tpl.system_prompt}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border">
                <div className="space-x-3 font-mono text-[11px]">
                  <span>Modèle: {tpl.default_model.replace("models/", "")}</span>
                  <span>•</span>
                  <span>T°: {tpl.default_temperature}</span>
                </div>

                {!tpl.is_system_preset && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setTemplateToEdit(tpl);
                        setModalOpen(true);
                      }}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 className="size-3 mr-1" />
                      Modifier
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTemplate(tpl.id)}
                      className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Template Modal */}
      <TemplateEditorModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        templateToEdit={templateToEdit}
        onSave={handleSaveTemplate}
      />
    </AIStudioLayout>
  );
};

export const TemplatesPage: React.FC = () => (
  <AIStudioProvider>
    <TemplatesPageContent />
  </AIStudioProvider>
);
