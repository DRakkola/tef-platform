import React, { useEffect, useState } from "react";
import {
  Dumbbell,
  Plus,
  GitFork,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import {
  fetchExercises,
  createExercise,
  publishExercise,
  forkExerciseVersion,
} from "./api";
import type { ExerciseItem } from "./types";
import { Button } from "@/components/ui/button";

export const ExercisesListPage: React.FC = () => {
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Create modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newEx, setNewEx] = useState({
    title: "",
    prompt: "",
    category: "grammar",
    level: "B2",
    difficulty: 3,
    points: 5,
    instructions: "Complétez avec l'option correcte.",
    explanation: "",
    options: [
      { content: "", is_correct: true },
      { content: "", is_correct: false },
      { content: "", is_correct: false },
    ],
  });

  const loadExercises = async () => {
    setIsLoading(true);
    try {
      const data = await fetchExercises({
        category: categoryFilter || undefined,
        level: levelFilter || undefined,
        page: 1,
        page_size: 50,
      });
      setExercises(data.items || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to load exercises." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadExercises();
  }, [categoryFilter, levelFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createExercise({
        title: newEx.title,
        prompt: newEx.prompt,
        category: newEx.category,
        level: newEx.level,
        difficulty: newEx.difficulty,
        points: newEx.points,
        instructions: newEx.instructions,
        explanation: newEx.explanation,
        options_payload: newEx.options.filter((o) => o.content.trim().length > 0),
        status: "draft",
      });
      setMsg({ type: "success", text: `Drill exercise "${newEx.title}" created.` });
      setCreateModalOpen(false);
      setNewEx({
        title: "",
        prompt: "",
        category: "grammar",
        level: "B2",
        difficulty: 3,
        points: 5,
        instructions: "Complétez avec l'option correcte.",
        explanation: "",
        options: [
          { content: "", is_correct: true },
          { content: "", is_correct: false },
          { content: "", is_correct: false },
        ],
      });
      loadExercises();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to create exercise." });
    }
  };

  const handlePublish = async (id: string, title: string) => {
    try {
      const res = await publishExercise(id);
      setMsg({ type: "success", text: `Published drill "${title}" (v${res.version})!` });
      loadExercises();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to publish exercise." });
    }
  };

  const handleFork = async (id: string, title: string) => {
    try {
      const res = await forkExerciseVersion(id);
      setMsg({ type: "success", text: `Forked "${title}" to draft version v${res.version}.` });
      loadExercises();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to fork exercise." });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Dumbbell className="h-6 w-6 text-amber-400" />
              Drill Exercises ({total})
            </h1>
            <p className="text-sm text-slate-400">
              Manage micro-drills across grammar, vocabulary, conjugation, and reading.
            </p>
          </div>
          <Button
            onClick={() => setCreateModalOpen(true)}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-500 gap-1.5 self-start"
          >
            <Plus className="h-4 w-4" /> Create Drill
          </Button>
        </div>

        {/* Feedback Alert */}
        {msg && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center justify-between ${
              msg.type === "success"
                ? "bg-emerald-950/60 border border-emerald-800 text-emerald-300"
                : "bg-rose-950/60 border border-rose-800 text-rose-300"
            }`}
          >
            <span className="flex items-center gap-2">
              {msg.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {msg.text}
            </span>
            <button onClick={() => setMsg(null)} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-xl text-xs">
          <span className="text-slate-400 font-medium">Filter by:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-slate-200 rounded px-2.5 py-1.5"
          >
            <option value="">All Categories</option>
            <option value="grammar">Grammar</option>
            <option value="vocabulary">Vocabulary</option>
            <option value="conjugation">Conjugation</option>
            <option value="reading">Reading</option>
            <option value="listening">Listening</option>
          </select>

          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-slate-200 rounded px-2.5 py-1.5"
          >
            <option value="">All Levels</option>
            <option value="A1">A1</option>
            <option value="A2">A2</option>
            <option value="B1">B1</option>
            <option value="B2">B2</option>
            <option value="C1">C1</option>
            <option value="C2">C2</option>
          </select>
        </div>

        {/* Exercises Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-slate-400 text-sm">Loading drills...</div>
        ) : exercises.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-slate-800 bg-slate-900/40 text-slate-400 text-sm">
            No drill exercises found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exercises.map((ex) => (
              <div
                key={ex.id}
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3 hover:border-slate-700 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <h3 className="font-bold text-white text-sm">{ex.title}</h3>
                    <div className="flex items-center gap-2 flex-wrap text-2xs">
                      <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 uppercase font-medium">
                        {ex.category}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 font-mono">
                        {ex.level}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono font-bold">
                        v{ex.version}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded border uppercase font-bold ${
                          ex.status === "published"
                            ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                            : "bg-amber-950 text-amber-300 border-amber-800"
                        }`}
                      >
                        {ex.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {ex.status !== "published" && (
                      <Button
                        size="sm"
                        onClick={() => handlePublish(ex.id, ex.title)}
                        className="h-7 text-xs bg-emerald-700 hover:bg-emerald-600 gap-1"
                      >
                        <CheckCircle className="h-3 w-3" /> Publish
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleFork(ex.id, ex.title)}
                      className="h-7 text-xs border-slate-700 text-slate-300 hover:bg-slate-800 gap-1"
                      title="Fork version"
                    >
                      <GitFork className="h-3 w-3 text-purple-400" /> Fork
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded border border-slate-800/80">
                  {ex.prompt}
                </p>

                {/* Options preview */}
                {ex.options_payload && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {ex.options_payload.map((opt: any, idx: number) => (
                      <span
                        key={idx}
                        className={`text-2xs px-2 py-1 rounded border ${
                          opt.is_correct
                            ? "bg-emerald-950/40 text-emerald-300 border-emerald-800 font-bold"
                            : "bg-slate-950 text-slate-400 border-slate-800"
                        }`}
                      >
                        {opt.content}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Modal: Create Drill */}
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-bold text-white">Create Drill Exercise</h2>
              <form onSubmit={handleCreate} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Subjonctif après 'Bien que'"
                    value={newEx.title}
                    onChange={(e) => setNewEx({ ...newEx, title: e.target.value })}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Prompt</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="e.g. Bien qu'il ___ (pleuvoir), nous irons marcher."
                    value={newEx.prompt}
                    onChange={(e) => setNewEx({ ...newEx, prompt: e.target.value })}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-white"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Category</label>
                    <select
                      value={newEx.category}
                      onChange={(e) => setNewEx({ ...newEx, category: e.target.value })}
                      className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-white"
                    >
                      <option value="grammar">Grammar</option>
                      <option value="vocabulary">Vocabulary</option>
                      <option value="conjugation">Conjugation</option>
                      <option value="reading">Reading</option>
                      <option value="listening">Listening</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Level</label>
                    <select
                      value={newEx.level}
                      onChange={(e) => setNewEx({ ...newEx, level: e.target.value })}
                      className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-white"
                    >
                      <option value="A1">A1</option>
                      <option value="A2">A2</option>
                      <option value="B1">B1</option>
                      <option value="B2">B2</option>
                      <option value="C1">C1</option>
                      <option value="C2">C2</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Difficulty (1-5)</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={newEx.difficulty}
                      onChange={(e) =>
                        setNewEx({ ...newEx, difficulty: parseInt(e.target.value, 10) })
                      }
                      className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-white"
                    />
                  </div>
                </div>

                {/* Options */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <label className="block text-slate-300 font-bold">Answer Options (Check the correct option)</label>
                  {newEx.options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="drill_correct"
                        checked={opt.is_correct}
                        onChange={() => {
                          const updated = newEx.options.map((o, i) => ({
                            ...o,
                            is_correct: i === idx,
                          }));
                          setNewEx({ ...newEx, options: updated });
                        }}
                        className="h-4 w-4 text-indigo-600"
                      />
                      <input
                        type="text"
                        placeholder={`Option ${idx + 1}`}
                        value={opt.content}
                        onChange={(e) => {
                          const updated = [...newEx.options];
                          updated[idx].content = e.target.value;
                          setNewEx({ ...newEx, options: updated });
                        }}
                        className="flex-1 rounded-md border border-slate-700 bg-slate-950 p-2 text-white"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCreateModalOpen(false)}
                    className="border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-500">
                    Create Drill
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
