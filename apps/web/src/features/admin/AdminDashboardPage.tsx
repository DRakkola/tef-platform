import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FileCheck2,
  HelpCircle,
  Dumbbell,
  PenTool,
  Image as ImageIcon,
  Clock,
  ShieldCheck,
  Plus,
  ArrowRight,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import {
  fetchAssessments,
  fetchQuestions,
  fetchExercises,
  fetchWritingTasks,
  fetchMediaAssets,
  fetchReviews,
  fetchAuditLogs,
} from "./api";
import type { AuditEventItem } from "./types";
import { Button } from "@/components/ui/button";

export const AdminDashboardPage: React.FC = () => {
  const [stats, setStats] = useState({
    assessments: 0,
    questions: 0,
    exercises: 0,
    writingTasks: 0,
    media: 0,
    pendingReviews: 0,
  });
  const [recentAudits, setRecentAudits] = useState<AuditEventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      setIsLoading(true);
      try {
        const [asmts, qs, exs, wts, meds, revs, audits] = await Promise.all([
          fetchAssessments({ page_size: 1 }),
          fetchQuestions({ page_size: 1 }),
          fetchExercises({ page_size: 1 }),
          fetchWritingTasks({ page_size: 1 }),
          fetchMediaAssets({ page_size: 1 }),
          fetchReviews({ status: "pending", page_size: 1 }),
          fetchAuditLogs({ page_size: 5 }),
        ]);

        setStats({
          assessments: asmts.total || 0,
          questions: qs.total || 0,
          exercises: exs.total || 0,
          writingTasks: wts.total || 0,
          media: meds.total || 0,
          pendingReviews: revs.total || 0,
        });
        setRecentAudits(audits.items || []);
      } catch (err) {
        console.error("Failed to load admin stats:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-7xl mx-auto">
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/60 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
              Content Studio Dashboard
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Author, review, publish, and audit educational assets for the TEF exam.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/admin/assessments">
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 text-xs font-semibold shadow-2xs">
                <Plus className="h-4 w-4" /> New Assessment
              </Button>
            </Link>
            <Link to="/admin/media">
              <Button size="sm" variant="outline" className="border-border text-foreground hover:bg-muted gap-1.5 text-xs">
                <ImageIcon className="h-4 w-4" /> Upload Media
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Link
            to="/admin/assessments"
            className="rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-xs transition group"
          >
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Assessments</span>
              <FileCheck2 className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
            </div>
            <p className="text-2xl font-bold text-foreground">
              {isLoading ? "—" : stats.assessments}
            </p>
            <span className="text-xs text-muted-foreground">Official simulations</span>
          </Link>

          <Link
            to="/admin/questions"
            className="rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-xs transition group"
          >
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Questions</span>
              <HelpCircle className="h-4 w-4 text-emerald-500 group-hover:scale-110 transition-transform" />
            </div>
            <p className="text-2xl font-bold text-foreground">
              {isLoading ? "—" : stats.questions}
            </p>
            <span className="text-xs text-muted-foreground">Indexed bank</span>
          </Link>

          <Link
            to="/admin/exercises"
            className="rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-xs transition group"
          >
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Drills</span>
              <Dumbbell className="h-4 w-4 text-amber-500 group-hover:scale-110 transition-transform" />
            </div>
            <p className="text-2xl font-bold text-foreground">
              {isLoading ? "—" : stats.exercises}
            </p>
            <span className="text-xs text-muted-foreground">Micro-drills</span>
          </Link>

          <Link
            to="/admin/writing-tasks"
            className="rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-xs transition group"
          >
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Writing Tasks</span>
              <PenTool className="h-4 w-4 text-purple-500 group-hover:scale-110 transition-transform" />
            </div>
            <p className="text-2xl font-bold text-foreground">
              {isLoading ? "—" : stats.writingTasks}
            </p>
            <span className="text-xs text-muted-foreground">Section A & B</span>
          </Link>

          <Link
            to="/admin/media"
            className="rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-xs transition group"
          >
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Media Assets</span>
              <ImageIcon className="h-4 w-4 text-sky-500 group-hover:scale-110 transition-transform" />
            </div>
            <p className="text-2xl font-bold text-foreground">
              {isLoading ? "—" : stats.media}
            </p>
            <span className="text-xs text-muted-foreground">MinIO protected</span>
          </Link>

          <Link
            to="/admin/reviews"
            className="rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-xs transition group"
          >
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Review Queue</span>
              <Clock className="h-4 w-4 text-rose-500 group-hover:scale-110 transition-transform" />
            </div>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {isLoading ? "—" : stats.pendingReviews}
            </p>
            <span className="text-xs text-muted-foreground">Pending approval</span>
          </Link>
        </div>

        {/* Content Pillars & Validation Engine Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                Publishing Validation & Immutability Engine
              </h2>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                Fail-Closed Active
              </span>
            </div>
            <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
              Every content unit is protected by automated pre-publishing verification gates:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-muted/40 border border-border/80 p-3">
                <p className="font-semibold text-foreground mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Section & Question Integrity
                </p>
                <p className="text-muted-foreground">
                  Assessments require at least one section and valid question options before release.
                </p>
              </div>
              <div className="rounded-lg bg-muted/40 border border-border/80 p-3">
                <p className="font-semibold text-foreground mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Single/Multi Choice Rules
                </p>
                <p className="text-muted-foreground">
                  Single choice requires exactly 1 correct option; multiple choice requires at least 1.
                </p>
              </div>
              <div className="rounded-lg bg-muted/40 border border-border/80 p-3">
                <p className="font-semibold text-foreground mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Snapshot Immutability
                </p>
                <p className="text-muted-foreground">
                  Published content freezes an immutable snapshot. Updates automatically fork a new draft version.
                </p>
              </div>
              <div className="rounded-lg bg-muted/40 border border-border/80 p-3">
                <p className="font-semibold text-foreground mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Editorial Review Gate
                </p>
                <p className="text-muted-foreground">
                  Peer-review workflow tracks changes and enforces four-eyes approval before production rollout.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-2xs">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" /> Quick Actions
            </h2>
            <div className="space-y-2">
              <Link
                to="/admin/skills"
                className="flex items-center justify-between p-3 rounded-lg bg-muted/40 hover:bg-muted/80 border border-border/70 text-sm transition"
              >
                <span className="text-foreground font-medium">Manage Skills & Subskills</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <Link
                to="/admin/assessments"
                className="flex items-center justify-between p-3 rounded-lg bg-muted/40 hover:bg-muted/80 border border-border/70 text-sm transition"
              >
                <span className="text-foreground font-medium">Build Assessment Section</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <Link
                to="/admin/reviews"
                className="flex items-center justify-between p-3 rounded-lg bg-muted/40 hover:bg-muted/80 border border-border/70 text-sm transition"
              >
                <span className="text-foreground font-medium">Editorial Review Queue</span>
                <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs px-2 py-0.5 rounded-full border border-rose-500/20 font-semibold">
                  {stats.pendingReviews}
                </span>
              </Link>
              <Link
                to="/admin/audit-logs"
                className="flex items-center justify-between p-3 rounded-lg bg-muted/40 hover:bg-muted/80 border border-border/70 text-sm transition"
              >
                <span className="text-foreground font-medium">Inspect Audit Logs</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Audit Activity */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Recent Administrative Activity
            </h2>
            <Link to="/admin/audit-logs" className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
              View all logs <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {recentAudits.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No recent audit logs found.</p>
          ) : (
            <div className="divide-y divide-border/60">
              {recentAudits.map((event) => (
                <div key={event.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded font-mono font-semibold uppercase ${
                        event.action.includes("CREATE")
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                          : event.action.includes("PUBLISH")
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "bg-muted text-muted-foreground border border-border"
                      }`}
                    >
                      {event.action}
                    </span>
                    <span className="text-foreground font-medium">
                      {event.entity_type} {event.entity_id ? `(${event.entity_id.slice(0, 8)}...)` : ""}
                    </span>
                  </div>
                  <div className="text-muted-foreground font-mono">
                    {new Date(event.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};
