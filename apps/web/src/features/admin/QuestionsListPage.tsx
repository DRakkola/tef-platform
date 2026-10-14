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
  Sparkles,
  FileSpreadsheet,
  Download,
  Trash2,
  Archive,
  Eye,
  BookOpen,
  Music,
  ArrowUpDown,
  Check,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import {
  fetchQuestions,
  forkQuestion,
  validateQuestion,
  executeBulkQuestionAction,
  downloadImportTemplateCsv,
} from "./api";
import { fetchTaskTypes } from "./skills/api";
import type { TaskType } from "./skills/types";
import type {
  QuestionItem,
  ContentStatus,
  BulkActionType,
} from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkImportModal } from "./questions/BulkImportModal";
import { QuestionQuickPreviewModal } from "./questions/QuestionQuickPreviewModal";
import { QuestionSheetGuideModal } from "./questions/QuestionSheetGuideModal";

export const QuestionsListPage: React.FC = () => {
  const navigate = useNavigate();

  // Questions & Pagination State
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);

  // Selection & Bulk Actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkActing, setIsBulkActing] = useState(false);

  // Modals
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<QuestionItem | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

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
  const [pageSize, setPageSize] = useState(15);

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
    pageSize,
  ]);

  // Selection handlers
  const handleSelectAll = () => {
    if (selectedIds.size === questions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(questions.map((q) => q.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Bulk Actions
  const handleBulkAction = async (action: BulkActionType) => {
    if (selectedIds.size === 0) return;
    setIsBulkActing(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await executeBulkQuestionAction({
        question_ids: ids,
        action,
      });

      if (res.failure_count > 0) {
        setMsg({
          type: "error",
          text: `Action '${action}' : ${res.success_count} réussi(s), ${res.failure_count} échec(s) (${res.errors[0]?.message || ""})`,
        });
      } else {
        setMsg({
          type: "success",
          text: `Action '${action}' exécutée avec succès sur ${res.success_count} question(s).`,
        });
      }
      setSelectedIds(new Set());
      loadQuestions();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Échec de l'action en masse." });
    } finally {
      setIsBulkActing(false);
    }
  };

  // Bulk Export (CSV / JSON)
  const handleBulkExport = (exportFormat: "json" | "csv") => {
    const targetQuestions = questions.filter((q) => selectedIds.has(q.id));
    if (targetQuestions.length === 0) return;

    if (exportFormat === "json") {
      const blob = new Blob([JSON.stringify(targetQuestions, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tef_questions_export_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = "id,prompt,modality,level,difficulty,status,version\n";
      const rows = targetQuestions
        .map(
          (q) =>
            `"${q.id}","${q.prompt.replace(/"/g, '""')}","${q.task_type?.modality || q.stimulus?.modality || "reading"}","${
              q.target_cefr || q.level
            }",${q.difficulty},"${q.status}",${q.version}`
        )
        .join("\n");
      const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tef_questions_export_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setMsg({
      type: "success",
      text: `${targetQuestions.length} question(s) exportée(s) au format ${exportFormat.toUpperCase()}.`,
    });
  };

  const handleFork = async (q: QuestionItem) => {
    try {
      const res = await forkQuestion(q.id);
      setMsg({
        type: "success",
        text: `Item dupliqué avec succès en nouvelle question brouillon.`,
      });
      navigate(`/admin/questions/${res.id}?tab=editor`);
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Échec de duplication de l'item." });
    }
  };

  const handleQuickValidate = async (q: QuestionItem) => {
    try {
      const res = await validateQuestion(q.id);
      setQuestions((prev) =>
        prev.map((item) =>
          item.id === q.id
            ? {
                ...item,
                validation_status: res.status as any,
                validations: [
                  {
                    id: `val-client-${Date.now()}`,
                    question_id: q.id,
                    validation_status: res.status,
                    blocking_error_count: res.errors?.length || 0,
                    warning_count: res.warnings?.length || 0,
                    issues_payload: res.issues || [],
                    checked_at: new Date().toISOString(),
                    validated_by_system_version: "v2.0.0",
                  },
                ],
              }
            : item
        )
      );
      setMsg({
        type: res.is_valid ? "success" : "error",
        text: res.is_valid
          ? `Question #${q.id.slice(0, 8)} conforme aux règles éditoriales.`
          : `Validation : ${res.issues.length} problème(s) détecté(s).`,
      });
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Erreur de validation." });
    }
  };

  const getFormatLabel = (q: QuestionItem) => {
    const rType = q.response_type || q.question_type;
    if (rType === "gap_fill" || rType === "cloze") {
      let gapCount = 0;
      if (Array.isArray(q.scoring_payload?.gaps)) {
        gapCount = q.scoring_payload.gaps.length;
      } else if (q.options && q.options.length > 0) {
        const gapIds = new Set<string>();
        q.options.forEach((o) => {
          const match = o.content.match(/^\[(\d+)\]/);
          if (match) gapIds.add(match[1]);
        });
        gapCount = gapIds.size;
      }
      return gapCount > 0 ? `Texte à trous • ${gapCount} trou${gapCount > 1 ? "s" : ""}` : "Texte à trous";
    }
    if (rType === "single_choice") return "QCM (Choix unique)";
    if (rType === "multiple_choice") return "Choix multiple";
    if (rType === "matching") return "Appariement";
    if (rType === "ordering") return "Ordonnancement";
    if (rType === "short_text") return "Réponse courte";
    if (rType === "long_text") return "Production écrite";
    if (rType === "spoken_response") return "Production orale";
    if (rType === "interaction") return "Interaction dialoguée";
    return rType || "Format non défini";
  };

  const getStatusBadge = (st: ContentStatus) => {
    switch (st) {
      case "draft":
        return (
          <Badge variant="warning" size="sm" className="uppercase font-bold tracking-wider">
            Brouillon
          </Badge>
        );
      case "in_review":
        return (
          <Badge variant="info" size="sm" className="uppercase font-bold tracking-wider">
            En révision
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="teal" size="sm" className="uppercase font-bold tracking-wider">
            Approuvé
          </Badge>
        );
      case "published":
        return (
          <Badge variant="success" size="sm" className="uppercase font-bold tracking-wider">
            Publié
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" size="sm" className="uppercase font-bold tracking-wider">
            Rejeté
          </Badge>
        );
      case "archived":
        return (
          <Badge variant="secondary" size="sm" className="uppercase font-bold tracking-wider text-muted-foreground">
            Archivé
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" size="sm" className="uppercase font-bold tracking-wider">
            {st}
          </Badge>
        );
    }
  };

  const getValidationPill = (q: QuestionItem) => {
    const rawVal = q.validations?.[0];
    const status = q.validation_status || rawVal?.validation_status;
    const errorCount = rawVal?.blocking_error_count ?? 0;
    const warnCount = rawVal?.warning_count ?? 0;

    switch (status) {
      case "valid":
        return (
          <Badge
            variant="success"
            size="sm"
            className="gap-1 font-medium rounded-full cursor-default"
            title="Conforme aux spécifications TEF (0 défaut bloquant, 0 alerte)"
          >
            <CheckCircle2 className="h-3 w-3" /> Conforme
          </Badge>
        );
      case "warning":
        return (
          <Badge
            variant="warning"
            size="sm"
            className="gap-1 font-medium rounded-full cursor-default"
            title={
              warnCount > 0
                ? `${warnCount} avertissement(s) didactique(s) détecté(s)`
                : "Avertissements didactiques à vérifier"
            }
          >
            <AlertTriangle className="h-3 w-3" /> Alerte
            {warnCount > 0 && <span className="text-3xs font-mono ml-0.5">({warnCount})</span>}
          </Badge>
        );
      case "invalid":
      case "blocking":
        return (
          <Badge
            variant="destructive"
            size="sm"
            className="gap-1 font-medium rounded-full cursor-default"
            title={
              errorCount > 0
                ? `${errorCount} erreur(s) bloquante(s) à corriger avant publication`
                : "Non conforme — Problèmes bloquants détectés"
            }
          >
            <XCircle className="h-3 w-3" /> Bloquant
            {errorCount > 0 && <span className="text-3xs font-mono ml-0.5">({errorCount})</span>}
          </Badge>
        );
      default:
        return (
          <span
            className="text-2xs text-muted-foreground whitespace-nowrap"
            title="Aucun audit enregistré pour cet item"
          >
            Non vérifié
          </span>
        );
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-24">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <HelpCircle className="h-6 w-6 text-primary" />
              Banque de questions ({total})
            </h1>
            <p className="text-sm text-muted-foreground">
              Gestion centralisée en tableur, validation didactique et publication des items TEF.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBulkImportOpen(true)}
              className="gap-1.5 shadow-2xs font-semibold text-xs h-9"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Importer en masse
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={downloadImportTemplateCsv}
              className="gap-1.5 shadow-2xs text-xs h-9 text-muted-foreground hover:text-foreground"
              title="Télécharger le modèle CSV"
            >
              <Download className="h-3.5 w-3.5" /> Modèle CSV
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsGuideModalOpen(true)}
              className="gap-1.5 shadow-2xs text-xs h-9 text-muted-foreground hover:text-foreground"
              title="Ouvrir le guide de référence CSV & Enums"
            >
              <BookOpen className="h-3.5 w-3.5 text-primary" /> Guide CSV
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/admin/questions/generate")}
              className="gap-1.5 shadow-2xs font-semibold text-xs h-9 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/30"
            >
              <Sparkles className="h-4 w-4" /> Générer par IA
            </Button>

            <Link to="/admin/questions/new">
              <Button size="sm" className="gap-1.5 shadow-xs font-semibold text-xs h-9">
                <Plus className="h-4 w-4" /> Nouvelle question
              </Button>
            </Link>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {msg && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center justify-between ${
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
              <option value="all">Tous formats de réponse</option>
              <option value="single_choice">Choix unique (QCM)</option>
              <option value="multiple_choice">Choix multiple</option>
              <option value="matching">Appariement</option>
              <option value="ordering">Ordonnancement</option>
              <option value="gap_fill">Texte à trous</option>
              <option value="short_text">Réponse courte</option>
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
              <option value="valid">Conforme</option>
              <option value="warning">Avertissements</option>
              <option value="invalid">Bloquant</option>
            </select>
          </div>
        </div>

        {/* ============================================================== */}
        {/* QUESTIONS DATA TABLE */}
        {/* ============================================================== */}
        {isLoading ? (
          <div className="text-center py-24 text-muted-foreground text-sm">
            Chargement des questions de la banque...
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-dashed border-border bg-card text-muted-foreground text-sm space-y-3">
            <HelpCircle className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <div className="font-semibold text-foreground">Aucune question ne correspond à vos filtres</div>
            <p className="text-xs max-w-md mx-auto">
              Modifiez vos critères de recherche ou importez une série d'items pour enrichir la banque.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => setIsBulkImportOpen(true)} className="gap-1 text-xs">
                <FileSpreadsheet className="h-3.5 w-3.5" /> Importer en masse
              </Button>
              <Link to="/admin/questions/new">
                <Button size="sm" className="gap-1 text-xs">
                  <Plus className="h-3.5 w-3.5" /> Créer une question
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
            <Table className="text-xs">
              <TableHeader className="bg-muted/50 border-b border-border select-none">
                <TableRow className="hover:bg-transparent">
                  {/* Checkbox */}
                  <TableHead className="p-3 w-10 text-center">
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={
                          selectedIds.size === questions.length && questions.length > 0
                        }
                        onCheckedChange={handleSelectAll}
                        aria-label="Sélectionner tout"
                      />
                    </div>
                  </TableHead>
                  <TableHead className="p-3 min-w-[280px] text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Énoncé & Item
                  </TableHead>
                  <TableHead className="p-3 text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Modalité & Format
                  </TableHead>
                  <TableHead
                    className="p-3 cursor-pointer hover:text-foreground text-2xs font-semibold text-muted-foreground uppercase tracking-wider"
                    onClick={() => {
                      setSortBy("target_cefr");
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Niveau / Diff. <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead className="p-3 text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Statut
                  </TableHead>
                  <TableHead className="p-3 text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Conformité
                  </TableHead>
                  <TableHead
                    className="p-3 cursor-pointer hover:text-foreground text-2xs font-semibold text-muted-foreground uppercase tracking-wider"
                    onClick={() => {
                      setSortBy("updated_at");
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Mis à jour <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead className="p-3 text-right text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-border/60">
                {questions.map((q) => {
                  const isSelected = selectedIds.has(q.id);
                  return (
                    <TableRow
                      key={q.id}
                      data-state={isSelected ? "selected" : undefined}
                      className={`hover:bg-muted/30 transition ${
                        isSelected ? "bg-primary/5" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <TableCell className="p-3 text-center">
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleSelect(q.id)}
                            aria-label={`Sélectionner question #${q.id.slice(0, 8)}`}
                          />
                        </div>
                      </TableCell>

                      {/* Prompt & Badges */}
                      <TableCell className="p-3">
                        <div className="space-y-1">
                          <div className="font-semibold text-foreground hover:text-primary transition flex items-start gap-1.5">
                            <Link
                              to={`/admin/questions/${q.id}?tab=editor`}
                              className="line-clamp-2 leading-snug"
                            >
                              {q.prompt}
                            </Link>
                          </div>

                          <div className="flex items-center gap-2 text-2xs text-muted-foreground flex-wrap">
                            <span className="font-mono text-muted-foreground/70">
                              #{q.id.slice(0, 8)}
                            </span>
                            <Badge variant="outline" size="sm" className="font-mono text-primary font-bold">
                              v{q.version}
                            </Badge>
                            {q.stimulus && (
                              <Badge variant="info" size="sm" className="inline-flex items-center gap-1 font-medium">
                                <BookOpen className="h-2.5 w-2.5" /> Document
                              </Badge>
                            )}
                            {(q.media_url || q.stimulus?.media_url) && (
                              <Badge variant="accent" size="sm" className="inline-flex items-center gap-1 font-medium text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20">
                                <Music className="h-2.5 w-2.5" /> Audio
                              </Badge>
                            )}
                            <span>{q.options?.length || 0} choix</span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Modality & Format */}
                      <TableCell className="p-3">
                        <div className="space-y-0.5">
                          <span className="font-semibold capitalize text-foreground block">
                            {q.task_type?.modality || q.stimulus?.modality || "reading"}
                          </span>
                          <span className="text-2xs text-muted-foreground block">
                            {getFormatLabel(q)}
                          </span>
                        </div>
                      </TableCell>

                      {/* CEFR & Difficulty */}
                      <TableCell className="p-3">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary" size="sm" className="uppercase font-mono font-bold">
                            {q.target_cefr || q.level}
                          </Badge>
                          <span className="text-2xs text-muted-foreground">
                            Diff: {q.difficulty}/5
                          </span>
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="p-3">{getStatusBadge(q.status)}</TableCell>

                      {/* Validation */}
                      <TableCell className="p-3">{getValidationPill(q)}</TableCell>

                      {/* Date */}
                      <TableCell className="p-3 text-2xs text-muted-foreground whitespace-nowrap">
                        {q.updated_at
                          ? new Date(q.updated_at).toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "short",
                            })
                          : "—"}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setPreviewQuestion(q);
                              setIsPreviewOpen(true);
                            }}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            title="Aperçu rapide"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleQuickValidate(q)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            title="Valider la conformité"
                          >
                            <Play className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleFork(q)}
                            className="h-7 w-7 p-0 text-purple-600 hover:text-purple-700 dark:text-purple-400"
                            title="Dupliquer (Fork)"
                          >
                            <GitFork className="h-3.5 w-3.5" />
                          </Button>

                          <Link to={`/admin/questions/${q.id}?tab=editor`}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-2xs gap-1 font-semibold"
                              title="Ouvrir l'atelier"
                            >
                              <Edit2 className="h-3 w-3" /> Ouvrir l'atelier
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Pagination footer */}
            <div className="p-3.5 bg-muted/20 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>
                  Affichage de {(page - 1) * pageSize + 1} à{" "}
                  {Math.min(page * pageSize, total)} sur {total} question{total > 1 ? "s" : ""}
                </span>
                <span>•</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(parseInt(e.target.value, 10));
                    setPage(1);
                  }}
                  className="rounded border border-border bg-background p-1 text-2xs text-foreground"
                >
                  <option value="15">15 par page</option>
                  <option value="25">25 par page</option>
                  <option value="50">50 par page</option>
                  <option value="100">100 par page</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page <= 1}
                  className="h-7 text-xs gap-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Précédent
                </Button>
                <span className="px-2 font-mono text-2xs text-muted-foreground">
                  Page {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  disabled={page >= totalPages}
                  className="h-7 text-xs gap-1"
                >
                  Suivant <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STICKY BULK ACTIONS BAR */}
        {/* ============================================================== */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-card border border-border/80 rounded-2xl shadow-2xl p-2.5 flex items-center gap-3 text-xs animate-in fade-in slide-in-from-bottom-3 duration-200">
            <span className="font-semibold text-foreground px-2 flex items-center gap-1.5">
              <Check className="h-4 w-4 text-primary" />
              {selectedIds.size} sélectionnée{selectedIds.size > 1 ? "s" : ""}
            </span>

            <div className="h-4 w-px bg-border" />

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction("validate")}
              disabled={isBulkActing}
              className="h-8 text-xs gap-1.5"
            >
              <Play className="h-3.5 w-3.5 text-sky-600" /> Valider
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction("publish")}
              disabled={isBulkActing}
              className="h-8 text-xs gap-1.5 text-emerald-600 dark:text-emerald-400"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Publier
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction("archive")}
              disabled={isBulkActing}
              className="h-8 text-xs gap-1.5 text-zinc-600 dark:text-zinc-400"
            >
              <Archive className="h-3.5 w-3.5" /> Archiver
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkExport("csv")}
              className="h-8 text-xs gap-1.5"
              title="Exporter au format CSV"
            >
              <Download className="h-3.5 w-3.5" /> Exporter CSV
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction("delete")}
              disabled={isBulkActing}
              className="h-8 text-xs gap-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
            >
              <Trash2 className="h-3.5 w-3.5" /> Supprimer
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              Désélectionner
            </Button>
          </div>
        )}

        {/* Bulk Import Modal */}
        <BulkImportModal
          isOpen={isBulkImportOpen}
          onClose={() => setIsBulkImportOpen(false)}
          onSuccess={(count) => {
            setMsg({
              type: "success",
              text: `${count} question(s) importée(s) avec succès dans la banque.`,
            });
            loadQuestions();
          }}
        />

        {/* Quick Preview Modal */}
        <QuestionQuickPreviewModal
          question={previewQuestion}
          isOpen={isPreviewOpen}
          onClose={() => {
            setIsPreviewOpen(false);
            setPreviewQuestion(null);
          }}
          onEdit={(q) => navigate(`/admin/questions/${q.id}?tab=editor`)}
        />

        {/* CSV Reference Guide Modal */}
        <QuestionSheetGuideModal
          isOpen={isGuideModalOpen}
          onClose={() => setIsGuideModalOpen(false)}
        />
      </div>
    </AdminLayout>
  );
};
