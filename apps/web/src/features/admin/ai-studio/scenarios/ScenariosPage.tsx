import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Sparkles,
  Mic,
  Edit2,
  Copy,
  Trash2,
  Layers,
  FileText,
  UserCheck,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { AIStudioLayout } from "../layout/AIStudioLayout";
import { AIStudioProvider } from "../context/AIStudioContext";
import type {
  SpeakingScenario,
  SpeakingScenarioCreateRequest,
  SpeakingScenarioUpdateRequest,
  SpeakingScenarioListResponse,
} from "../types";
import { ScenarioEditorModal } from "./ScenarioEditorModal";

const ScenariosPageContent: React.FC = () => {
  const navigate = useNavigate();

  const [scenarios, setScenarios] = useState<SpeakingScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState<SpeakingScenario | null>(null);

  const fetchScenarios = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (sectionFilter !== "all") params.append("section", sectionFilter);
      if (levelFilter !== "all") params.append("target_level", levelFilter);
      if (activeFilter === "active") params.append("is_active", "true");
      if (activeFilter === "inactive") params.append("is_active", "false");

      const res = await fetch(`/api/v1/admin/ai-sandbox/scenarios?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`Erreur ${res.status} lors de la récupération des scénarios.`);
      }
      const data: SpeakingScenarioListResponse = await res.json();
      setScenarios(data.items);
    } catch (err: any) {
      setError(err.message || "Impossible de charger les scénarios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScenarios();
  }, [sectionFilter, levelFilter, activeFilter]);

  const handleSeedDefaults = async () => {
    if (!confirm("Voulez-vous initialiser les scénarios TEF Section A & B par défaut ?")) return;
    try {
      setLoading(true);
      const res = await fetch("/api/v1/admin/ai-sandbox/scenarios/seed", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Échec de l'initialisation des scénarios.");
      await fetchScenarios();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveScenario = async (
    data: SpeakingScenarioCreateRequest | SpeakingScenarioUpdateRequest,
    scenarioId?: string
  ) => {
    const isEdit = Boolean(scenarioId);
    const url = isEdit
      ? `/api/v1/admin/ai-sandbox/scenarios/${scenarioId}`
      : "/api/v1/admin/ai-sandbox/scenarios";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || errData.message || "Erreur de sauvegarde");
    }

    await fetchScenarios();
  };

  const handleDuplicate = async (scenario: SpeakingScenario) => {
    try {
      const res = await fetch(`/api/v1/admin/ai-sandbox/scenarios/${scenario.id}/duplicate`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Échec de la duplication");
      await fetchScenarios();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (scenario: SpeakingScenario) => {
    if (!confirm(`Supprimer définitivement le scénario "${scenario.title}" (${scenario.code}) ?`)) return;
    try {
      const res = await fetch(`/api/v1/admin/ai-sandbox/scenarios/${scenario.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Échec de la suppression");
      await fetchScenarios();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredScenarios = scenarios.filter((sc) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      sc.title.toLowerCase().includes(q) ||
      sc.code.toLowerCase().includes(q) ||
      sc.role_title.toLowerCase().includes(q) ||
      sc.persona_name.toLowerCase().includes(q) ||
      sc.document_title.toLowerCase().includes(q)
    );
  });

  return (
    <AIStudioLayout
      title="Scénarios d'Épreuve & Garde-fous"
      description="Préparez et calibrez les sujets authentiques du TEF Oral (Section A & B) avec persona, document stimulus et règles anti-dérive."
      headerActions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeedDefaults}
            className="rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="size-3.5 text-amber-500" />
            <span>Initialiser scénarios types</span>
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setEditingScenario(null);
              setIsModalOpen(true);
            }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Nouveau Scénario</span>
          </Button>
        </div>
      }
    >
      {/* SEARCH & FILTERS */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-card p-4 rounded-2xl border border-border shadow-2xs">
        <div className="relative flex-1 w-full">
          <Search className="size-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            placeholder="Rechercher par titre, code, rôle, ou document..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-muted/30 border-border text-foreground rounded-xl placeholder:text-muted-foreground text-xs"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Select value={sectionFilter} onValueChange={setSectionFilter}>
            <SelectTrigger className="w-[170px] bg-background border-border text-xs rounded-xl">
              <SelectValue placeholder="Épreuve" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes épreuves</SelectItem>
              <SelectItem value="section_a">Section A (Formel)</SelectItem>
              <SelectItem value="section_b">Section B (Persuasion)</SelectItem>
            </SelectContent>
          </Select>

          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-[120px] bg-background border-border text-xs rounded-xl">
              <SelectValue placeholder="Niveau" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous niveaux</SelectItem>
              <SelectItem value="A2">A2</SelectItem>
              <SelectItem value="B1">B1</SelectItem>
              <SelectItem value="B2">B2</SelectItem>
              <SelectItem value="C1">C1</SelectItem>
            </SelectContent>
          </Select>

          <Select value={activeFilter} onValueChange={setActiveFilter}>
            <SelectTrigger className="w-[130px] bg-background border-border text-xs rounded-xl">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="active">Actifs</SelectItem>
              <SelectItem value="inactive">Inactifs</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="ghost" size="icon" onClick={fetchScenarios} title="Rafraîchir" className="rounded-xl size-8">
            <RefreshCw className="size-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* ERROR NOTICE */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl flex items-center gap-3 text-xs">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* CATALOG GRID */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-64 bg-muted/40 rounded-2xl animate-pulse border border-border" />
          ))}
        </div>
      ) : filteredScenarios.length === 0 ? (
        <Card className="text-center p-12 border-dashed border-border rounded-2xl bg-card">
          <CardContent className="space-y-4">
            <div className="mx-auto size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Layers className="size-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">Aucun scénario trouvé</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
                Aucun scénario ne correspond à vos critères de recherche. Vous pouvez en créer un nouveau ou initialiser les scénarios types.
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-3">
              <Button variant="outline" size="sm" onClick={handleSeedDefaults} className="rounded-xl text-xs">
                Initialiser les modèles TEF
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setEditingScenario(null);
                  setIsModalOpen(true);
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-semibold"
              >
                Créer un scénario
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredScenarios.map((sc) => {
            const isSecA = sc.section === "section_a";
            return (
              <Card
                key={sc.id}
                className="flex flex-col justify-between hover:shadow-md transition-shadow border-border bg-card rounded-2xl shadow-2xs"
              >
                <CardHeader className="pb-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      className={
                        isSecA
                          ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 text-[11px]"
                          : "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20 hover:bg-purple-500/15 text-[11px]"
                      }
                      variant="outline"
                    >
                      {isSecA ? "Section A (Renseignements)" : "Section B (Persuasion)"}
                    </Badge>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {sc.target_level}
                      </Badge>
                      <Badge
                        variant={sc.is_active ? "default" : "outline"}
                        className={
                          sc.is_active
                            ? "bg-emerald-600/90 text-white text-[10px]"
                            : "text-muted-foreground border-border text-[10px]"
                        }
                      >
                        {sc.is_active ? "Actif" : "Inactif"}
                      </Badge>
                    </div>
                  </div>

                  <CardTitle className="text-sm font-bold text-foreground line-clamp-1 pt-1">
                    {sc.title}
                  </CardTitle>
                  <CardDescription className="text-[11px] font-mono text-muted-foreground">
                    {sc.code}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3 text-xs text-muted-foreground pb-3">
                  {/* Persona details */}
                  <div className="p-3 bg-muted/40 rounded-xl space-y-1.5 border border-border/60">
                    <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                      <UserCheck className="size-3.5 text-primary" />
                      <span>{sc.persona_name}</span>
                      <span className="text-muted-foreground font-normal">({sc.role_title})</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                      <span>Voix : {sc.voice_persona}</span>
                      <span>Registre : {sc.register === "formal" ? "Vouvoiement" : "Tutoiement"}</span>
                      <span>Scepticisme : {Math.round(sc.scepticism_level * 100)}%</span>
                    </div>
                  </div>

                  {/* Stimulus Snippet */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
                      <FileText className="size-3.5 text-primary/70" />
                      <span className="line-clamp-1">{sc.document_title}</span>
                    </div>
                    <p className="line-clamp-2 text-muted-foreground italic pl-5 text-[11px]">
                      « {sc.document_content} »
                    </p>
                  </div>

                  {/* Guardrails pill count */}
                  <div className="flex items-center gap-2 pt-1 text-[10px]">
                    <span className="bg-muted px-2 py-0.5 rounded-md font-medium text-foreground">
                      {isSecA ? `${sc.known_facts.length} faits connus` : `${sc.objection_cards.length} objections`}
                    </span>
                    <span className="bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 rounded-md font-medium">
                      {sc.forbidden_topics.length} sujets interdits
                    </span>
                  </div>
                </CardContent>

                <CardFooter className="pt-3 border-t border-border bg-muted/20 rounded-b-2xl flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    onClick={() => navigate(`/admin/ai-studio/examiner?scenarioId=${sc.id}`)}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl flex-1 flex items-center justify-center gap-1.5 text-xs h-8"
                  >
                    <Mic className="size-3.5" />
                    Tester en Live
                  </Button>

                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingScenario(sc);
                        setIsModalOpen(true);
                      }}
                      className="size-8 p-0 rounded-xl"
                      title="Modifier"
                    >
                      <Edit2 className="size-3.5 text-foreground/80" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDuplicate(sc)}
                      className="size-8 p-0 rounded-xl"
                      title="Dupliquer"
                    >
                      <Copy className="size-3.5 text-foreground/80" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(sc)}
                      className="size-8 p-0 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Supprimer"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* AUTHORING MODAL */}
      <ScenarioEditorModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        scenario={editingScenario}
        onSave={handleSaveScenario}
      />
    </AIStudioLayout>
  );
};

export const ScenariosPage: React.FC = () => (
  <AIStudioProvider>
    <ScenariosPageContent />
  </AIStudioProvider>
);
