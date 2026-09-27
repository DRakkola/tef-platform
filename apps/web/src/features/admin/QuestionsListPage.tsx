import React, { useEffect, useState } from "react";
import {
  HelpCircle,
  GitFork,
  Edit2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import {
  fetchQuestions,
  updateQuestion,
  forkQuestionVersion,
} from "./api";
import type { QuestionItem } from "./types";
import { Button } from "@/components/ui/button";

export const QuestionsListPage: React.FC = () => {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState("");
  const [diffFilter, setDiffFilter] = useState<number | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Edit Modal
  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [editLevel, setEditLevel] = useState("B1");
  const [editDiff, setEditDiff] = useState(3);
  const [editPoints, setEditPoints] = useState(1);
  const [editExplanation, setEditExplanation] = useState("");
  const [editOptions, setEditOptions] = useState<Array<{ content: string; is_correct: boolean; explanation?: string }>>([]);

  const loadQuestions = async () => {
    setIsLoading(true);
    try {
      const data = await fetchQuestions({
        level: levelFilter || undefined,
        difficulty: diffFilter,
        question_type: typeFilter || undefined,
        page: 1,
        page_size: 50,
      });
      setQuestions(data.items || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to load questions." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, [levelFilter, diffFilter, typeFilter]);

  const handleOpenEdit = (q: QuestionItem) => {
    setEditingQuestion(q);
    setEditPrompt(q.prompt);
    setEditLevel(q.level);
    setEditDiff(q.difficulty);
    setEditPoints(q.points);
    setEditExplanation(q.explanation || "");
    setEditOptions(
      q.options?.map((o) => ({
        content: o.content,
        is_correct: o.is_correct,
        explanation: o.explanation || "",
      })) || []
    );
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion) return;
    try {
      await updateQuestion(editingQuestion.id, {
        prompt: editPrompt,
        level: editLevel,
        difficulty: editDiff,
        points: editPoints,
        explanation: editExplanation,
        options: editOptions,
      });
      setMsg({ type: "success", text: "Question updated successfully." });
      setEditingQuestion(null);
      loadQuestions();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to update question." });
    }
  };

  const handleFork = async (q: QuestionItem) => {
    try {
      const res = await forkQuestionVersion(q.id);
      setMsg({
        type: "success",
        text: `Forked question to version v${res.version}.`,
      });
      loadQuestions();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to fork question." });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <HelpCircle className="h-6 w-6 text-emerald-500" />
              Question Bank ({total})
            </h1>
            <p className="text-sm text-muted-foreground">
              Browse, filter, and edit question prompts, options, and difficulty scoring.
            </p>
          </div>
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
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="bg-background border border-border text-foreground rounded px-2.5 py-1.5 focus:ring-1 focus:ring-primary"
          >
            <option value="">All CEFR Levels</option>
            <option value="A1">A1</option>
            <option value="A2">A2</option>
            <option value="B1">B1</option>
            <option value="B2">B2</option>
            <option value="C1">C1</option>
            <option value="C2">C2</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-background border border-border text-foreground rounded px-2.5 py-1.5 focus:ring-1 focus:ring-primary"
          >
            <option value="">All Question Types</option>
            <option value="single_choice">Single Choice</option>
            <option value="multiple_choice">Multiple Choice</option>
          </select>

          <select
            value={diffFilter !== undefined ? diffFilter.toString() : ""}
            onChange={(e) =>
              setDiffFilter(e.target.value ? parseInt(e.target.value, 10) : undefined)
            }
            className="bg-background border border-border text-foreground rounded px-2.5 py-1.5 focus:ring-1 focus:ring-primary"
          >
            <option value="">All Difficulties</option>
            <option value="1">Difficulty 1 (Beginner)</option>
            <option value="2">Difficulty 2 (Elementary)</option>
            <option value="3">Difficulty 3 (Intermediate)</option>
            <option value="4">Difficulty 4 (Advanced)</option>
            <option value="5">Difficulty 5 (Mastery)</option>
          </select>
        </div>

        {/* Questions Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading questions...</div>
        ) : questions.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-border bg-card text-muted-foreground text-sm">
            No questions found. Add questions via Assessment Section Builder.
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((q) => (
              <div
                key={q.id}
                className="rounded-xl border border-border bg-card p-4 hover:border-primary/50 shadow-2xs transition space-y-3 text-xs text-card-foreground"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground text-sm">{q.prompt}</span>
                    <span className="px-2 py-0.5 rounded bg-muted text-primary font-mono font-bold border border-border">
                      v{q.version}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-muted text-foreground uppercase font-mono">
                      {q.level}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      Diff: {q.difficulty}/5
                    </span>
                    <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      {q.points} pt{q.points > 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleFork(q)}
                      className="h-7 text-xs border-border text-foreground hover:bg-muted gap-1"
                      title="Fork into new draft version"
                    >
                      <GitFork className="h-3 w-3 text-purple-500" /> Fork
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleOpenEdit(q)}
                      className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1"
                    >
                      <Edit2 className="h-3 w-3" /> Edit
                    </Button>
                  </div>
                </div>

                {/* Options List */}
                {q.options && q.options.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-border/80">
                    {q.options.map((opt, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded border text-2xs flex items-center justify-between ${
                          opt.is_correct
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold"
                            : "bg-muted/40 border-border/70 text-muted-foreground"
                        }`}
                      >
                        <span>{opt.content}</span>
                        {opt.is_correct && (
                          <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Modal: Edit Question */}
        {editingQuestion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
            <div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto text-card-foreground">
              <h2 className="text-lg font-bold text-foreground">Edit Question (v{editingQuestion.version})</h2>
              <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-foreground mb-1 font-medium">Prompt</label>
                  <textarea
                    rows={2}
                    required
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    className="w-full rounded-md border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-foreground mb-1 font-medium">Level</label>
                    <select
                      value={editLevel}
                      onChange={(e) => setEditLevel(e.target.value)}
                      className="w-full rounded-md border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary"
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
                    <label className="block text-foreground mb-1 font-medium">Difficulty</label>
                    <select
                      value={editDiff}
                      onChange={(e) => setEditDiff(parseInt(e.target.value, 10))}
                      className="w-full rounded-md border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary"
                    >
                      <option value={1}>1 (Easy)</option>
                      <option value={2}>2</option>
                      <option value={3}>3 (Medium)</option>
                      <option value={4}>4</option>
                      <option value={5}>5 (Hard)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-foreground mb-1 font-medium">Points</label>
                    <input
                      type="number"
                      min={1}
                      value={editPoints}
                      onChange={(e) => setEditPoints(parseInt(e.target.value, 10))}
                      className="w-full rounded-md border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Options Editor */}
                <div className="space-y-2 pt-2 border-t border-border/80">
                  <label className="block text-foreground font-bold">Options</label>
                  {editOptions.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={opt.is_correct}
                        onChange={(e) => {
                          const updated = [...editOptions];
                          updated[oIdx].is_correct = e.target.checked;
                          setEditOptions(updated);
                        }}
                        className="h-4 w-4 text-primary rounded"
                      />
                      <input
                        type="text"
                        value={opt.content}
                        onChange={(e) => {
                          const updated = [...editOptions];
                          updated[oIdx].content = e.target.value;
                          setEditOptions(updated);
                        }}
                        className="flex-1 rounded-md border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-foreground mb-1 font-medium">Explanation</label>
                  <textarea
                    rows={2}
                    value={editExplanation}
                    onChange={(e) => setEditExplanation(e.target.value)}
                    className="w-full rounded-md border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border/80">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingQuestion(null)}
                    className="border-border text-foreground hover:bg-muted"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                    Save Changes
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
