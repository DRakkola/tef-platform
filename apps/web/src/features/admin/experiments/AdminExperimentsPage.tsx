import React, { useState, useEffect } from "react";
import {
  FlaskConical,
  Plus,
  Play,
  Pause,
  AlertTriangle,
  BarChart2,
  X,
  ShieldAlert,
} from "lucide-react";
import { AdminLayout } from "@/features/admin/AdminLayout";
import { Button } from "@/components/ui/button";

interface ExperimentVariant {
  id: string;
  key: string;
  weight: number;
  config_payload: Record<string, any>;
}

interface Experiment {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: string;
  variants: ExperimentVariant[];
  created_at: string;
  updated_at: string;
}

const FORBIDDEN_KEYWORDS = ["payment", "checkout", "security", "auth", "scoring", "retention"];

export const AdminExperimentsPage: React.FC = () => {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [selectedResults, setSelectedResults] = useState<any>(null);

  // Form states
  const [newKey, setNewKey] = useState<string>("");
  const [newName, setNewName] = useState<string>("");
  const [newDesc, setNewDesc] = useState<string>("");
  const variants = [
    { key: "control", weight: 50, config: "{}" },
    { key: "variant_a", weight: 50, config: "{}" },
  ];
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchExperiments = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/v1/admin/experiments", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setExperiments(data);
      }
    } catch (err) {
      console.warn("Failed to fetch experiments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExperiments();
  }, []);

  const hasForbiddenKeyword = FORBIDDEN_KEYWORDS.some((kw) =>
    newKey.toLowerCase().includes(kw)
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (hasForbiddenKeyword) {
      setCreateError("Cette clé viole l'invariant de sécurité de la plateforme (domaine protégé).");
      return;
    }

    try {
      const parsedVariants = variants.map((v) => ({
        key: v.key,
        weight: Number(v.weight),
        config: JSON.parse(v.config || "{}"),
      }));

      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/v1/admin/experiments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          key: newKey.trim(),
          name: newName.trim(),
          description: newDesc.trim() || undefined,
          variants: parsedVariants,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || errData.message || "Erreur de création");
      }

      setShowCreateModal(false);
      setNewKey("");
      setNewName("");
      setNewDesc("");
      fetchExperiments();
    } catch (err: any) {
      setCreateError(err.message || "Erreur lors de la création de l'expérimentation.");
    }
  };

  const handleStatusChange = async (key: string, newStatus: string) => {
    try {
      const token = localStorage.getItem("auth_token");
      await fetch(`/api/v1/admin/experiments/${key}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchExperiments();
    } catch (err) {
      console.warn("Status transition failed:", err);
    }
  };

  const handleViewResults = async (key: string) => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/v1/admin/experiments/${key}/results`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedResults(data);
      }
    } catch (err) {
      console.warn("Failed to load results:", err);
    }
  };

  return (
    <AdminLayout activeTab="experiments">
      <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
          <div>
            <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase mb-1">
              <FlaskConical className="h-4 w-4" />
              <span>A/B Testing & Optimisation Continue</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              Expérimentations Produit
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Assignation déterministe par hachage SHA-256 avec respect strict des invariants de sécurité.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              <span>Créer une Expérimentation</span>
            </Button>
          </div>
        </div>

        {/* Experiment List */}
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : experiments.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center space-y-3 shadow-xs">
            <div className="mx-auto w-12 h-12 bg-muted text-muted-foreground rounded-full flex items-center justify-center">
              <FlaskConical className="h-6 w-6" />
            </div>
            <div className="font-bold text-base text-foreground">Aucune expérimentation configurée</div>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Testez des variantes d'onboarding, de formulations ou de recommandations de manière sûre et contrôlée.
            </p>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs mt-2"
            >
              Lancer votre premier test
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {experiments.map((exp) => (
              <div
                key={exp.id}
                className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-xs"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-bold text-foreground">{exp.name}</h2>
                    <div className="text-xs font-mono text-muted-foreground mt-0.5">{exp.key}</div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      exp.status === "running"
                        ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                        : exp.status === "paused"
                        ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                        : "bg-muted text-muted-foreground border border-border"
                    }`}
                  >
                    {exp.status}
                  </span>
                </div>

                {exp.description && (
                  <p className="text-xs text-muted-foreground">{exp.description}</p>
                )}

                {/* Variants pill list */}
                <div className="bg-muted/40 p-3 rounded-xl border border-border space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground">Variantes ({exp.variants.length}) :</div>
                  <div className="flex flex-wrap gap-2">
                    {exp.variants.map((v) => (
                      <span
                        key={v.id}
                        className="bg-background border border-border px-2.5 py-1 rounded-lg text-xs font-mono text-foreground"
                      >
                        {v.key} ({v.weight}%)
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex gap-2">
                    {exp.status === "draft" && (
                      <Button
                        size="sm"
                        onClick={() => handleStatusChange(exp.key, "running")}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs flex items-center gap-1.5"
                      >
                        <Play className="h-3.5 w-3.5" />
                        <span>Activer</span>
                      </Button>
                    )}
                    {exp.status === "running" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange(exp.key, "paused")}
                        className="border-border hover:bg-muted text-amber-600 dark:text-amber-400 text-xs flex items-center gap-1.5"
                      >
                        <Pause className="h-3.5 w-3.5" />
                        <span>Mettre en pause</span>
                      </Button>
                    )}
                    {exp.status === "paused" && (
                      <Button
                        size="sm"
                        onClick={() => handleStatusChange(exp.key, "running")}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs flex items-center gap-1.5"
                      >
                        <Play className="h-3.5 w-3.5" />
                        <span>Reprendre</span>
                      </Button>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewResults(exp.key)}
                    className="border-border hover:bg-muted text-foreground text-xs flex items-center gap-1.5"
                  >
                    <BarChart2 className="h-3.5 w-3.5" />
                    <span>Résultats</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 space-y-5 text-foreground shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-primary" />
                  <span className="font-bold text-base text-foreground">Nouvelle Expérimentation</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {createError && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs p-3 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Clé technique unique *
                  </label>
                  <input
                    required
                    type="text"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="ex: onboarding_hero_cta_v1"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                  {hasForbiddenKeyword && (
                    <div className="text-destructive text-xs mt-1 flex items-center gap-1 font-semibold">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      <span>Interdit : les domaines de paiement, sécurité, auth et scoring TEF sont protégés.</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Nom explicite *
                  </label>
                  <input
                    required
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="ex: Titre d'accueil de l'onboarding"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Description de l'hypothèse
                  </label>
                  <textarea
                    rows={2}
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Hypothèse de conversion et métriques surveillées..."
                    className="w-full bg-background border border-border rounded-lg p-3 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreateModal(false)}
                    className="border-border hover:bg-muted text-xs text-foreground"
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={hasForbiddenKeyword || !newKey.trim() || !newName.trim()}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
                  >
                    Créer l'Expérimentation
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Results Modal */}
        {selectedResults && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl max-w-xl w-full p-6 space-y-5 text-foreground shadow-2xl animate-in fade-in">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <BarChart2 className="h-5 w-5 text-primary" />
                  <span className="font-bold text-base text-foreground">
                    Résultats : {selectedResults.experiment_key}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedResults(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="text-xs text-muted-foreground">
                Total des assignations : <span className="font-bold text-foreground">{selectedResults.total_assignments}</span>
              </div>

              <div className="space-y-3">
                {selectedResults.variants.map((v: any) => (
                  <div key={v.variant_key} className="bg-muted/40 p-4 rounded-xl border border-border flex justify-between items-center text-xs">
                    <div>
                      <div className="font-mono font-bold text-foreground text-sm">{v.variant_key}</div>
                      <div className="text-muted-foreground mt-0.5">{v.assigned_count} assignés • {v.conversion_count} conversions</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-primary">
                        {(v.conversion_rate * 100).toFixed(1)}%
                      </div>
                      <div className="text-muted-foreground">taux de conversion</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2 border-t border-border">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedResults(null)}
                  className="border-border hover:bg-muted text-xs text-foreground"
                >
                  Fermer
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
