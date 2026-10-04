import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  HelpCircle,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  GitFork,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  Layers,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { fetchQuestions, forkQuestion, validateQuestion } from "./api";
import { fetchTaskTypes } from "./skills/api";
import type { TaskType } from "./skills/types";
import type { QuestionItem, ContentStatus, QuestionValidationStatus } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const QuestionsListPage: React.FC = () => {
  const navigate = useNavigate();

  // State
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);

  // Filter params
  const [search, setSearch] = useState("");
  const [modality, setModality] = useState("all");
  const [taskTypeId, setTaskTypeId] = useState("all");
  const [responseType, setResponseType] = useState("all");
  const [targetCefr, setTargetCefr] = useState("all");
  const [difficulty, setDifficulty] = useState<number | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState("all");
  const [validationFilter, setValidationFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updated_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchTaskTypes(modality !== "all" ? modality : undefined)
      .then((tt) => setTaskTypes(tt))
      .catch(() => {});
  }, [modality]);

  const loadQuestions = async () => {
    setIsLoading(true);
    try {
      const data = await fetchQuestions({
        search: search.trim() || undefined,
        modality: modality !== "all" ? modality : undefined,
        task_type_id: taskTypeId !== "all" ? taskTypeId : undefined,
        response_type: responseType !== "all" ? responseType : undefined,
        target_cefr: targetCefr !== "all" ? targetCefr : undefined,
        difficulty: difficulty,
        status: statusFilter !== "all" ? statusFilter : undefined,
        validation_status: validationFilter !== "all" ? validationFilter : undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        page,
        page_size: pageSize,
      });
      setQuestions(data.items || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Impossible de charger les questions." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, [
    search,
    modality,
    taskTypeId,
    responseType,
    targetCefr,
    difficulty,
    statusFilter,
    validationFilter,
    sortBy,
    sortOrder,
    page,
  ]);

  const handleFork = async (q: QuestionItem) => {
    try {
      const res = await forkQuestion(q.id);
      setMsg({
        type: "success",
        text: `Item dupliqué avec succès en nouvelle question brouillon.`,
      });
      navigate(`/admin/questions/${res.id}?tab=content`);
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Échec de duplication de l'item." });
    }
  };

  const handleQuickValidate = async (q: QuestionItem) => {
    try {
      const res = await validateQuestion(q.id);
      setMsg({
        type: res.is_valid ? "success" : "error",
        text: res.is_valid
          ? `Question #${q.id.slice(0, 8)} conforme aux règles éditoriales.`
          : `Validation : ${res.issues.length} problème(s) détecté(s).`,
      });
      loadQuestions();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Erreur de validation." });
    }
  };

  const getStatusBadge = (st: ContentStatus) => {
    switch (st) {
      case "draft":
        return <span className="px-2 py-0.5 rounded text-2xs font-bold uppercase bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">Brouillon</span>;
      case "in_review":
        return <span className="px-2 py-0.5 rounded text-2xs font-bold uppercase bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">En révision</span>;
      case "approved":
        return <span className="px-2 py-0.5 rounded text-2xs font-bold uppercase bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">Approuvé</span>;
      case "published":
        return <span className="px-2 py-0.5 rounded text-2xs font-bold uppercase bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">Publié</span>;
      case "rejected":
        return <span className="px-2 py-0.5 rounded text-2xs font-bold uppercase bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">Rejeté</span>;
      case "archived":
        return <span className="px-2 py-0.5 rounded text-2xs font-bold uppercase bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20">Archivé</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-2xs font-bold uppercase bg-muted text-muted-foreground">{st}</span>;
    }
  };

  const getValidationPill = (v?: QuestionValidationStatus) => {
    switch (v) {
      case "valid":
        return (
          <span className="flex items-center gap-1 text-2xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3 w-3" /> Conforme
          </span>
        );
      case "warning":
        return (
          <span className="flex items-center gap-1 text-2xs font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3 w-3" /> Avertissements
          </span>
        );
      case "invalid":
        return (
          <span className="flex items-center gap-1 text-2xs font-medium px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300">
            <XCircle className="h-3 w-3" /> Bloquant
          </span>
        );
      default:
        return (
          <span className="text-2xs text-muted-foreground">Non vérifié</span>
        );
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <HelpCircle className="h-6 w-6 text-primary" />
              Banque de questions ({total})
            </h1>
            <p className="text-sm text-muted-foreground">
              Atelier de conception, relecture didactique et publication des items d'examen TEF V2.
            </p>
          </div>

          <Link to="/admin/questions/new">
            <Button className="gap-2 shadow-xs font-semibold">
              <Plus className="h-4 w-4" /> Nouvelle question
            </Button>
          </Link>
        </div>

        {/* Global Feedback Banner */}
        {msg && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center justify-between ${
              msg.type === "success"
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                : "bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300"
            }`}
          >
            <span className="flex items-center gap-2">
              {msg.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {msg.text}
            </span>
            <button onClick={() => setMsg(null)} className="text-muted-foreground hover:text-foreground font-semibold px-1">
              ✕
            </button>
          </div>
        )}

        {/* Filter Bar */}
        <div className="p-4 rounded-xl border border-border bg-card space-y-3 text-xs">
          <div className="flex flex-col md:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par énoncé, mot clé ou texte..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Quick Modality Filter */}
            <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto">
              {["all", "reading", "listening", "writing", "speaking"].map((mod) => (
                <button
                  key={mod}
                  type="button"
                  onClick={() => {
                    setModality(mod);
                    setTaskTypeId("all");
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-medium transition capitalize text-xs whitespace-nowrap ${
                    modality === mod
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {mod === "all" ? "Toutes modalités" : mod}
                </button>
              ))}
            </div>
          </div>

          {/* Granular Filters Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
            {/* Task Type */}
            <select
              value={taskTypeId}
              onChange={(e) => {
                setTaskTypeId(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-border bg-background p-1.5 text-2xs text-foreground"
            >
              <option value="all">Tous types de tâche</option>
              {taskTypes.map((tt) => (
                <option key={tt.id} value={tt.id}>
                  {tt.name}
                </option>
              ))}
            </select>

            {/* Response Type */}
            <select
              value={responseType}
              onChange={(e) => {
                setResponseType(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-border bg-background p-1.5 text-2xs text-foreground"
            >
              <option value="all">Tous types de réponse</option>
              <option value="single_choice">Choix unique (QCM)</option>
              <option value="multiple_choice">Choix multiple</option>
              <option value="matching">Appariement</option>
              <option value="ordering">Ordonnancement</option>
              <option value="gap_fill">Texte à trous</option>
              <option value="short_text">Réponse courte</option>
              <option value="long_text">Production libre</option>
            </select>

            {/* Target CEFR */}
            <select
              value={targetCefr}
              onChange={(e) => {
                setTargetCefr(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-border bg-background p-1.5 text-2xs text-foreground font-semibold"
            >
              <option value="all">Tous niveaux CEFR</option>
              <option value="A1">Niveau A1</option>
              <option value="A2">Niveau A2</option>
              <option value="B1">Niveau B1</option>
              <option value="B2">Niveau B2</option>
              <option value="C1">Niveau C1</option>
              <option value="C2">Niveau C2</option>
            </select>

            {/* Difficulty */}
            <select
              value={difficulty !== undefined ? String(difficulty) : "all"}
              onChange={(e) => {
                setDifficulty(e.target.value === "all" ? undefined : parseInt(e.target.value, 10));
                setPage(1);
              }}
              className="rounded-md border border-border bg-background p-1.5 text-2xs text-foreground"
            >
              <option value="all">Toutes difficultés (1-5)</option>
              <option value="1">Difficulté 1 (Très facile)</option>
              <option value="2">Difficulté 2 (Facile)</option>
              <option value="3">Difficulté 3 (Intermédiaire)</option>
              <option value="4">Difficulté 4 (Difficile)</option>
              <option value="5">Difficulté 5 (Expert)</option>
            </select>

            {/* Lifecycle Status */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-border bg-background p-1.5 text-2xs text-foreground font-semibold"
            >
              <option value="all">Tous statuts</option>
              <option value="draft">Brouillon</option>
              <option value="in_review">En révision</option>
              <option value="approved">Approuvé</option>
              <option value="published">Publié</option>
              <option value="archived">Archivé</option>
            </select>

            {/* Validation Status */}
            <select
              value={validationFilter}
              onChange={(e) => {
                setValidationFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-border bg-background p-1.5 text-2xs text-foreground"
            >
              <option value="all">Toutes conformités</option>
              <option value="valid">Conforme (Valid)</option>
              <option value="warning">Avertissements</option>
              <option value="invalid">Bloquant (Invalid)</option>
            </select>

            {/* Sorting */}
            <select
              value={`${sortBy}:${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split(":");
                setSortBy(sb);
                setSortOrder(so as "asc" | "desc");
                setPage(1);
              }}
              className="rounded-md border border-border bg-background p-1.5 text-2xs text-foreground col-span-2 sm:col-span-1"
            >
              <option value="updated_at:desc">Tri : Plus récent</option>
              <option value="updated_at:asc">Tri : Plus ancien</option>
              <option value="level:asc">Tri : Niveau CEFR (croissant)</option>
              <option value="level:desc">Tri : Niveau CEFR (décroissant)</option>
              <option value="difficulty:asc">Tri : Difficulté (croissante)</option>
              <option value="difficulty:desc">Tri : Difficulté (décroissante)</option>
            </select>
          </div>
        </div>

        {/* Questions Grid / Table */}
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Chargement des questions...
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-dashed border-border bg-card text-muted-foreground text-sm space-y-3">
            <HelpCircle className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <div className="font-semibold text-foreground">Aucune question ne correspond à vos filtres</div>
            <p className="text-xs max-w-md mx-auto">
              Modifiez vos critères de recherche ou créez une nouvelle question pour enrichir la banque d'évaluation.
            </p>
            <Link to="/admin/questions/new">
              <Button size="sm" className="gap-1 mt-2">
                <Plus className="h-4 w-4" /> Créer une question
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q) => (
              <div
                key={q.id}
                className="rounded-xl border border-border bg-card p-4 hover:border-primary/50 shadow-2xs transition space-y-3 text-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap flex-1">
                    <span className="font-semibold text-foreground text-sm hover:text-primary transition">
                      <Link to={`/admin/questions/${q.id}?tab=content`}>
                        {q.prompt}
                      </Link>
                    </span>
                    {getStatusBadge(q.status)}
                    <span className="px-2 py-0.5 rounded bg-muted text-primary font-mono font-bold border border-border text-2xs">
                      v{q.version}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-muted text-foreground uppercase font-mono font-bold text-2xs">
                      {q.target_cefr || q.level}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-2xs">
                      Diff: {q.item_difficulty ?? q.difficulty}/5
                    </span>
                    <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-2xs">
                      {q.points} pt{q.points > 1 ? "s" : ""}
                    </span>
                    {getValidationPill(q.validation_status)}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleQuickValidate(q)}
                      className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                      title="Lancer le contrôle de conformité"
                    >
                      <Play className="h-3 w-3" /> Valider
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleFork(q)}
                      className="h-7 text-xs gap-1 text-purple-600 hover:text-purple-700 dark:text-purple-400"
                      title="Dupliquer"
                    >
                      <GitFork className="h-3 w-3" /> Fork
                    </Button>
                    <Link to={`/admin/questions/${q.id}?tab=content`}>
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1 font-semibold"
                      >
                        <Edit2 className="h-3 w-3" /> Ouvrir l'atelier
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Subtitle / Metadata row */}
                <div className="flex items-center gap-4 text-2xs text-muted-foreground border-t border-border/60 pt-2 flex-wrap">
                  {q.task_type && (
                    <span className="flex items-center gap-1 text-foreground font-medium">
                      <Layers className="h-3 w-3 text-primary" />
                      {q.task_type.name}
                    </span>
                  )}
                  <span>Type : <strong>{q.question_type}</strong></span>
                  <span>Modifié le {new Date(q.updated_at).toLocaleDateString()}</span>
                  {q.options && q.options.length > 0 && (
                    <span>{q.options.length} options ({q.options.filter((o) => o.is_correct).length} correcte(s))</span>
                  )}
                  {q.skill_tags && q.skill_tags.length > 0 && (
                    <span className="text-primary font-mono">
                      {q.skill_tags.length} compétence(s) V2 liée(s)
                    </span>
                  )}
                </div>
              </div>
            ))}

            {/* Pagination Controls */}
            <div className="flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
              <span>
                Page {page} sur {totalPages} ({total} questions au total)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-7 text-xs gap-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Précédent
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-7 text-xs gap-1"
                >
                  Suivant <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
