import React, { useEffect, useState } from "react";
import {
  PenTool,
  Plus,
  GitFork,
  CheckCircle,
  AlertCircle,
  Clock,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import {
  fetchWritingTasks,
  createWritingTask,
  publishWritingTask,
  forkWritingTaskVersion,
} from "./api";
import type { WritingTaskItem } from "./types";
import { Button } from "@/components/ui/button";

export const WritingTasksListPage: React.FC = () => {
  const [tasks, setTasks] = useState<WritingTaskItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [taskTypeFilter, setTaskTypeFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Create modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    task_type: "section_a",
    prompt: "",
    min_words: 80,
    max_words: 120,
    duration_minutes: 20,
    target_level: "B1",
  });

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      const data = await fetchWritingTasks({
        task_type: taskTypeFilter || undefined,
        level: levelFilter || undefined,
        page: 1,
        page_size: 50,
      });
      setTasks(data.items || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to load writing tasks." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [taskTypeFilter, levelFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createWritingTask({
        ...newTask,
        status: "draft",
      });
      setMsg({ type: "success", text: `Writing task "${newTask.title}" created.` });
      setCreateModalOpen(false);
      setNewTask({
        title: "",
        task_type: "section_a",
        prompt: "",
        min_words: 80,
        max_words: 120,
        duration_minutes: 20,
        target_level: "B1",
      });
      loadTasks();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to create writing task." });
    }
  };

  const handlePublish = async (id: string, title: string) => {
    try {
      const res = await publishWritingTask(id);
      setMsg({ type: "success", text: `Published writing task "${title}" (v${res.version})!` });
      loadTasks();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to publish writing task." });
    }
  };

  const handleFork = async (id: string, title: string) => {
    try {
      const res = await forkWritingTaskVersion(id);
      setMsg({ type: "success", text: `Forked "${title}" to draft version v${res.version}.` });
      loadTasks();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to fork writing task." });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <PenTool className="h-6 w-6 text-purple-500" />
              Writing Tasks ({total})
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage TEF Section A (Fait divers) and Section B (Opinion & Plaidoyer) tasks.
            </p>
          </div>
          <Button
            onClick={() => setCreateModalOpen(true)}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1.5 self-start shadow-2xs"
          >
            <Plus className="h-4 w-4" /> Create Writing Task
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

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-card border border-border p-3 rounded-xl text-xs">
          <span className="text-muted-foreground font-medium">Filter by:</span>
          <select
            value={taskTypeFilter}
            onChange={(e) => setTaskTypeFilter(e.target.value)}
            className="bg-background border border-border text-foreground rounded px-2.5 py-1.5 focus:ring-1 focus:ring-primary"
          >
            <option value="">All Task Types</option>
            <option value="section_a">Section A (Fait divers)</option>
            <option value="section_b">Section B (Lettre d'opinion)</option>
          </select>

          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="bg-background border border-border text-foreground rounded px-2.5 py-1.5 focus:ring-1 focus:ring-primary"
          >
            <option value="">All Target Levels</option>
            <option value="B1">B1</option>
            <option value="B2">B2</option>
            <option value="C1">C1</option>
          </select>
        </div>

        {/* Tasks List */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading writing tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-border bg-card text-muted-foreground text-sm">
            No writing tasks found.
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="rounded-xl border border-border bg-card p-5 space-y-3 hover:border-primary/50 shadow-2xs transition text-card-foreground"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-foreground text-base">{task.title}</h3>
                      <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary uppercase font-semibold border border-primary/20">
                        {task.task_type.replace("_", " ")}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-muted text-primary font-mono font-bold border border-border">
                        v{task.version}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full border uppercase font-bold ${
                          task.status === "published"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                        }`}
                      >
                        {task.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                      <span>Cible: {task.target_level}</span>
                      <span>Mots: {task.min_words}–{task.max_words}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" /> {task.duration_minutes} min
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {task.status !== "published" && (
                      <Button
                        size="sm"
                        onClick={() => handlePublish(task.id, task.title)}
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-1"
                      >
                        <CheckCircle className="h-3.5 w-3.5" /> Publish
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleFork(task.id, task.title)}
                      className="h-8 text-xs border-border text-foreground hover:bg-muted gap-1"
                      title="Fork version"
                    >
                      <GitFork className="h-3.5 w-3.5 text-purple-500" /> Fork Version
                    </Button>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-muted/40 border border-border/80 text-xs text-muted-foreground whitespace-pre-line font-serif leading-relaxed">
                  {task.prompt}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Create Writing Task */}
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
            <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto text-card-foreground">
              <h2 className="text-lg font-bold text-foreground">Create Writing Task</h2>
              <form onSubmit={handleCreate} className="space-y-3 text-xs">
                <div>
                  <label className="block text-foreground mb-1 font-medium">Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Section A — Incendie spectaculaire dans le Vieux-Québec"
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    className="w-full rounded-md border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-foreground mb-1 font-medium">Task Type</label>
                    <select
                      value={newTask.task_type}
                      onChange={(e) => setNewTask({ ...newTask, task_type: e.target.value })}
                      className="w-full rounded-md border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary"
                    >
                      <option value="section_a">Section A (Fait divers - 80-120 mots)</option>
                      <option value="section_b">Section B (Plaidoyer/Opinion - 200-250 mots)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-foreground mb-1 font-medium">Target Level</label>
                    <select
                      value={newTask.target_level}
                      onChange={(e) => setNewTask({ ...newTask, target_level: e.target.value })}
                      className="w-full rounded-md border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary"
                    >
                      <option value="B1">B1</option>
                      <option value="B2">B2</option>
                      <option value="C1">C1</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-foreground mb-1 font-medium">Min Words</label>
                    <input
                      type="number"
                      required
                      value={newTask.min_words}
                      onChange={(e) =>
                        setNewTask({ ...newTask, min_words: parseInt(e.target.value, 10) })
                      }
                      className="w-full rounded-md border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-foreground mb-1 font-medium">Max Words</label>
                    <input
                      type="number"
                      required
                      value={newTask.max_words}
                      onChange={(e) =>
                        setNewTask({ ...newTask, max_words: parseInt(e.target.value, 10) })
                      }
                      className="w-full rounded-md border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-foreground mb-1 font-medium">Duration (Mins)</label>
                    <input
                      type="number"
                      required
                      value={newTask.duration_minutes}
                      onChange={(e) =>
                        setNewTask({ ...newTask, duration_minutes: parseInt(e.target.value, 10) })
                      }
                      className="w-full rounded-md border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-foreground mb-1 font-medium">Prompt & Instructions</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Instructions détaillées et début du texte à continuer..."
                    value={newTask.prompt}
                    onChange={(e) => setNewTask({ ...newTask, prompt: e.target.value })}
                    className="w-full rounded-md border border-border bg-background p-2 text-foreground font-serif focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border/80">
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
                    Create Task
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
