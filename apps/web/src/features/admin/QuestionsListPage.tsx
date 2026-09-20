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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <HelpCircle className="h-6 w-6 text-emerald-400" />
              Question Bank ({total})
            </h1>
            <p className="text-sm text-slate-400">
              Browse, filter, and edit question prompts, options, and difficulty scoring.
            </p>
          </div>
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
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-slate-200 rounded px-2.5 py-1.5"
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
            className="bg-slate-950 border border-slate-700 text-slate-200 rounded px-2.5 py-1.5"
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
            className="bg-slate-950 border border-slate-700 text-slate-200 rounded px-2.5 py-1.5"
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
          <div className="text-center py-12 text-slate-400 text-sm">Loading questions...</div>
        ) : questions.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-slate-800 bg-slate-900/40 text-slate-400 text-sm">
            No questions found. Add questions via Assessment Section Builder.
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((q) => (
              <div
                key={q.id}
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 hover:border-slate-700 transition space-y-3 text-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white text-sm">{q.prompt}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono font-bold">
                      v{q.version}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 uppercase font-mono">
                      {q.level}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-400">
                      Diff: {q.difficulty}/5
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-400">
                      {q.points} pt{q.points > 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleFork(q)}
                      className="h-7 text-xs border-slate-700 text-slate-300 hover:bg-slate-800 gap-1"
                      title="Fork into new draft version"
                    >
                      <GitFork className="h-3 w-3 text-purple-400" /> Fork
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleOpenEdit(q)}
                      className="h-7 text-xs bg-indigo-600 hover:bg-indigo-500 gap-1"
                    >
                      <Edit2 className="h-3 w-3" /> Edit
                    </Button>
                  </div>
                </div>

                {/* Options List */}
                {q.options && q.options.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-800/60">
                    {q.options.map((opt, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded border text-2xs flex items-center justify-between ${
                          opt.is_correct
                            ? "bg-emerald-950/40 border-emerald-800 text-emerald-300 font-semibold"
                            : "bg-slate-950/60 border-slate-800 text-slate-400"
                        }`}
                      >
                        <span>{opt.content}</span>
                        {opt.is_correct && (
                          <CheckCircle className="h-3 w-3 text-emerald-400 shrink-0" />
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-xl rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-bold text-white">Edit Question (v{editingQuestion.version})</h2>
              <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Prompt</label>
                  <textarea
                    rows={2}
                    required
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-white"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Level</label>
                    <select
                      value={editLevel}
                      onChange={(e) => setEditLevel(e.target.value)}
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
                    <label className="block text-slate-300 mb-1 font-medium">Difficulty</label>
                    <select
                      value={editDiff}
                      onChange={(e) => setEditDiff(parseInt(e.target.value, 10))}
                      className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-white"
                    >
                      <option value={1}>1 (Easy)</option>
                      <option value={2}>2</option>
                      <option value={3}>3 (Medium)</option>
                      <option value={4}>4</option>
                      <option value={5}>5 (Hard)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Points</label>
                    <input
                      type="number"
                      min={1}
                      value={editPoints}
                      onChange={(e) => setEditPoints(parseInt(e.target.value, 10))}
                      className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-white"
                    />
                  </div>
                </div>

                {/* Options Editor */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <label className="block text-slate-300 font-bold">Options</label>
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
                        className="h-4 w-4 text-indigo-600 rounded"
                      />
                      <input
                        type="text"
                        value={opt.content}
                        onChange={(e) => {
                          const updated = [...editOptions];
                          updated[oIdx].content = e.target.value;
                          setEditOptions(updated);
                        }}
                        className="flex-1 rounded-md border border-slate-700 bg-slate-950 p-2 text-white"
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Explanation</label>
                  <textarea
                    rows={2}
                    value={editExplanation}
                    onChange={(e) => setEditExplanation(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingQuestion(null)}
                    className="border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-500">
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
