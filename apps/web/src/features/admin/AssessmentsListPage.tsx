import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FileCheck2,
  Plus,
  ArrowRight,
  Clock,
  Layers,
  GitFork,
  CheckCircle,
  AlertCircle,
  Send,
  Sparkles,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import {
  fetchAssessments,
  createAssessment,
  publishAssessment,
  forkAssessmentVersion,
  validateAssessment,
  submitAssessmentForReview,
} from "./api";
import type { AssessmentItem, ContentStatus, ValidationReport } from "./types";
import { Button } from "@/components/ui/button";

export const AssessmentsListPage: React.FC = () => {
  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Validation report modal
  const [valReport, setValReport] = useState<{
    id: string;
    title: string;
    report: ValidationReport;
  } | null>(null);

  // Create Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newAsmt, setNewAsmt] = useState({
    title: "",
    description: "",
    assessment_type: "reading",
    duration_seconds: 3600,
    navigation_policy: "linear",
    scoring_policy: "standard",
    pass_percentage: 60,
  });

  const loadAssessments = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAssessments({
        status: statusFilter ? (statusFilter as ContentStatus) : undefined,
        assessment_type: typeFilter || undefined,
        page: 1,
        page_size: 50,
      });
      setAssessments(data.items || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to load assessments." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAssessments();
  }, [statusFilter, typeFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await createAssessment({
        ...newAsmt,
        status: "draft",
      });
      setMsg({ type: "success", text: `Assessment "${created.title}" created as draft.` });
      setCreateModalOpen(false);
      setNewAsmt({
        title: "",
        description: "",
        assessment_type: "reading",
        duration_seconds: 3600,
        navigation_policy: "linear",
        scoring_policy: "standard",
        pass_percentage: 60,
      });
      loadAssessments();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to create assessment." });
    }
  };

  const handleValidate = async (asmt: AssessmentItem) => {
    try {
      const report = await validateAssessment(asmt.id);
      setValReport({ id: asmt.id, title: asmt.title, report });
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Validation failed." });
    }
  };

  const handlePublish = async (id: string, title: string) => {
    try {
      const res = await publishAssessment(id);
      setMsg({
        type: "success",
        text: `Assessment "${title}" published! Immutable version ${res.version} created.`,
      });
      loadAssessments();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Publishing failed. Check validation." });
    }
  };

  const handleForkVersion = async (id: string, title: string) => {
    try {
      const res = await forkAssessmentVersion(id);
      setMsg({
        type: "success",
        text: `Forked new draft version v${res.version} for "${title}".`,
      });
      loadAssessments();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to fork version." });
    }
  };

  const handleSubmitReview = async (id: string, title: string) => {
    try {
      await submitAssessmentForReview(id, "Ready for editorial verification");
      setMsg({
        type: "success",
        text: `Submitted "${title}" to the editorial review queue.`,
      });
      loadAssessments();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to submit for review." });
    }
  };

  const getStatusBadge = (status: ContentStatus) => {
    switch (status) {
      case "published":
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";
      case "in_review":
        return "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20";
      case "archived":
        return "bg-muted text-muted-foreground border-border";
      default:
        return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20";
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileCheck2 className="h-6 w-6 text-primary" />
              Assessments & Simulations ({total})
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage simulated TEF practice exams, section builders, and version freezes.
            </p>
          </div>
          <Button
            onClick={() => setCreateModalOpen(true)}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1.5 self-start shadow-2xs"
          >
            <Plus className="h-4 w-4" /> Create Assessment
          </Button>
        </div>

        {/* Feedback Alert */}
        {msg && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center justify-between ${
              msg.type === "success"
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                : "bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300"
            }`}
          >
            <span className="flex items-center gap-2">
              {msg.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {msg.text}
            </span>
            <button onClick={() => setMsg(null)} className="text-muted-foreground hover:text-foreground">
              ✕
            </button>
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 bg-card border border-border p-3 rounded-xl text-xs">
          <span className="text-muted-foreground font-medium">Filter by:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-background border border-border text-foreground rounded px-2.5 py-1.5 focus:ring-1 focus:ring-primary"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="in_review">In Review</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-background border border-border text-foreground rounded px-2.5 py-1.5 focus:ring-1 focus:ring-primary"
          >
            <option value="">All Exam Types</option>
            <option value="reading">Reading (Compréhension Écrite)</option>
            <option value="listening">Listening (Compréhension Orale)</option>
            <option value="writing">Writing (Expression Écrite)</option>
            <option value="speaking">Speaking (Expression Orale)</option>
          </select>

          {(statusFilter || typeFilter) && (
            <button
              onClick={() => {
                setStatusFilter("");
                setTypeFilter("");
              }}
              className="text-primary hover:underline ml-auto font-medium"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Assessment Cards */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading assessments...</div>
        ) : assessments.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-border bg-card">
            <p className="text-muted-foreground text-sm">No assessments found matching the criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {assessments.map((asmt) => (
              <div
                key={asmt.id}
                className="rounded-xl border border-border bg-card p-5 hover:border-primary/50 shadow-2xs transition space-y-4 text-card-foreground"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground text-base">{asmt.title}</span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold uppercase ${getStatusBadge(
                          asmt.status
                        )}`}
                      >
                        {asmt.status}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-muted text-primary font-mono border border-border font-semibold">
                        v{asmt.version}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase font-medium">
                        {asmt.assessment_type}
                      </span>
                    </div>
                    {asmt.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{asmt.description}</p>
                    )}
                  </div>

                  {/* Top Stats */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono self-start md:self-auto">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {Math.round(asmt.duration_seconds / 60)} min
                    </span>
                    <span className="flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                      {asmt.sections?.length || 0} sections
                    </span>
                  </div>
                </div>

                {/* Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border/80">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleValidate(asmt)}
                      className="h-8 text-xs border-border text-foreground hover:bg-muted gap-1"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Validate
                    </Button>

                    {asmt.status === "draft" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSubmitReview(asmt.id, asmt.title)}
                        className="h-8 text-xs border-sky-500/30 text-sky-600 dark:text-sky-300 hover:bg-sky-500/10 gap-1"
                      >
                        <Send className="h-3.5 w-3.5" /> Submit Review
                      </Button>
                    )}

                    {asmt.status !== "published" && (
                      <Button
                        size="sm"
                        onClick={() => handlePublish(asmt.id, asmt.title)}
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1"
                      >
                        <CheckCircle className="h-3.5 w-3.5" /> Publish
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleForkVersion(asmt.id, asmt.title)}
                      className="h-8 text-xs border-border text-foreground hover:bg-muted gap-1"
                      title="Fork into a new draft version for editing"
                    >
                      <GitFork className="h-3.5 w-3.5 text-purple-500" /> Fork New Version
                    </Button>
                  </div>

                  <Link to={`/admin/assessments/${asmt.id}`}>
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1"
                    >
                      Open Section Builder <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Create Assessment */}
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
            <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 space-y-4 shadow-2xl text-card-foreground">
              <h2 className="text-lg font-bold text-foreground">Create New Assessment</h2>
              <form onSubmit={handleCreate} className="space-y-3 text-xs">
                <div>
                  <label className="block text-foreground mb-1 font-medium">Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TEF Canada — Compréhension Écrite Série B"
                    value={newAsmt.title}
                    onChange={(e) => setNewAsmt({ ...newAsmt, title: e.target.value })}
                    className="w-full rounded-md border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-foreground mb-1 font-medium">Description</label>
                  <textarea
                    rows={2}
                    placeholder="Exam instructions and candidate notice..."
                    value={newAsmt.description}
                    onChange={(e) => setNewAsmt({ ...newAsmt, description: e.target.value })}
                    className="w-full rounded-md border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-foreground mb-1 font-medium">Exam Type</label>
                    <select
                      value={newAsmt.assessment_type}
                      onChange={(e) => setNewAsmt({ ...newAsmt, assessment_type: e.target.value })}
                      className="w-full rounded-md border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary"
                    >
                      <option value="reading">Reading</option>
                      <option value="listening">Listening</option>
                      <option value="writing">Writing</option>
                      <option value="speaking">Speaking</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-foreground mb-1 font-medium">Duration (Seconds)</label>
                    <input
                      type="number"
                      required
                      min={60}
                      step={60}
                      value={newAsmt.duration_seconds}
                      onChange={(e) =>
                        setNewAsmt({ ...newAsmt, duration_seconds: parseInt(e.target.value, 10) })
                      }
                      className="w-full rounded-md border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCreateModalOpen(false)}
                    className="border-border text-foreground hover:bg-muted"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                    Create Draft
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Validation Report */}
        {valReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
            <div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 space-y-4 shadow-2xl text-card-foreground">
              <div className="flex items-center justify-between border-b border-border/80 pb-3">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  Pre-Publishing Validation Report
                </h2>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${
                    valReport.report.is_valid
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20"
                  }`}
                >
                  {valReport.report.is_valid ? "Passes Validation" : "Blocked (Errors Found)"}
                </span>
              </div>

              <p className="text-xs text-muted-foreground font-medium">Exam: {valReport.title}</p>

              {/* Errors */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                  Errors ({valReport.report.errors?.length || 0})
                </h3>
                {valReport.report.errors?.length === 0 ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                    <CheckCircle className="h-3.5 w-3.5" /> No blocking errors found.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {valReport.report.errors.map((err, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2"
                      >
                        <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
                        <div>
                          {err.field && <span className="font-mono font-bold">[{err.field}] </span>}
                          <span>{err.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Warnings */}
              {valReport.report.warnings && valReport.report.warnings.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                    Warnings ({valReport.report.warnings.length})
                  </h3>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {valReport.report.warnings.map((w, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300"
                      >
                        {w.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-border/80">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setValReport(null)}
                  className="border-border text-foreground hover:bg-muted"
                >
                  Close
                </Button>
                {valReport.report.is_valid && (
                  <Button
                    size="sm"
                    onClick={() => {
                      handlePublish(valReport.id, valReport.title);
                      setValReport(null);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1 text-xs font-semibold"
                  >
                    <CheckCircle className="h-3.5 w-3.5" /> Publish Assessment
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
