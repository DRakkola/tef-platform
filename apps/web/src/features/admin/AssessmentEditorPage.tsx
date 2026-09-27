import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ChevronLeft,
  Layers,
  Plus,
  Sparkles,
  GitFork,
  CheckCircle,
  AlertCircle,
  Clock,
  History,
  Send,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import {
  getAssessment,
  addAssessmentSection,
  addSectionQuestion,
  validateAssessment,
  publishAssessment,
  forkAssessmentVersion,
  submitAssessmentForReview,
  fetchAssessmentVersions,
} from "./api";
import type {
  AssessmentItem,
  AssessmentVersionItem,
  ValidationReport,
} from "./types";
import { Button } from "@/components/ui/button";

export const AssessmentEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [assessment, setAssessment] = useState<AssessmentItem | null>(null);
  const [versions, setVersions] = useState<AssessmentVersionItem[]>([]);
  const [activeTab, setActiveTab] = useState<"builder" | "versions" | "metadata">("builder");
  const [isLoading, setIsLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Validation report modal
  const [valReport, setValReport] = useState<ValidationReport | null>(null);

  // Add Section modal
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [newSection, setNewSection] = useState({
    title: "",
    instructions: "",
    order_index: 0,
    time_limit_seconds: 900,
    passage_text: "",
    media_url: "",
  });

  // Add Question modal
  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [targetSectionId, setTargetSectionId] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState({
    prompt: "",
    question_type: "single_choice",
    difficulty: 3,
    level: "B2",
    points: 1,
    explanation: "",
    options: [
      { content: "", is_correct: true, explanation: "" },
      { content: "", is_correct: false, explanation: "" },
      { content: "", is_correct: false, explanation: "" },
      { content: "", is_correct: false, explanation: "" },
    ],
  });

  const loadData = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [asmt, vers] = await Promise.all([
        getAssessment(id),
        fetchAssessmentVersions(id),
      ]);
      setAssessment(asmt);
      setVersions(vers);
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to load assessment." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleValidate = async () => {
    if (!id) return;
    try {
      const report = await validateAssessment(id);
      setValReport(report);
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Validation failed." });
    }
  };

  const handlePublish = async () => {
    if (!id) return;
    try {
      const updated = await publishAssessment(id);
      setMsg({
        type: "success",
        text: `Published successfully! Snapshot frozen as version ${updated.version}.`,
      });
      loadData();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Publishing failed. Fix validation errors." });
    }
  };

  const handleFork = async () => {
    if (!id) return;
    try {
      const updated = await forkAssessmentVersion(id);
      setMsg({
        type: "success",
        text: `Forked to new draft version v${updated.version}.`,
      });
      loadData();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to fork." });
    }
  };

  const handleSubmitReview = async () => {
    if (!id) return;
    try {
      await submitAssessmentForReview(id, "Ready for peer review");
      setMsg({ type: "success", text: "Submitted for review!" });
      loadData();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to submit for review." });
    }
  };

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      await addAssessmentSection(id, newSection);
      setMsg({ type: "success", text: `Section "${newSection.title}" added.` });
      setSectionModalOpen(false);
      setNewSection({
        title: "",
        instructions: "",
        order_index: (assessment?.sections?.length || 0),
        time_limit_seconds: 900,
        passage_text: "",
        media_url: "",
      });
      loadData();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to add section." });
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSectionId) return;
    try {
      await addSectionQuestion(targetSectionId, {
        prompt: newQuestion.prompt,
        question_type: newQuestion.question_type,
        difficulty: newQuestion.difficulty,
        level: newQuestion.level,
        points: newQuestion.points,
        explanation: newQuestion.explanation,
        options: newQuestion.options.filter((o) => o.content.trim().length > 0),
      });
      setMsg({ type: "success", text: "Question added to section." });
      setQuestionModalOpen(false);
      setNewQuestion({
        prompt: "",
        question_type: "single_choice",
        difficulty: 3,
        level: "B2",
        points: 1,
        explanation: "",
        options: [
          { content: "", is_correct: true, explanation: "" },
          { content: "", is_correct: false, explanation: "" },
          { content: "", is_correct: false, explanation: "" },
          { content: "", is_correct: false, explanation: "" },
        ],
      });
      loadData();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to add question." });
    }
  };

  if (isLoading || !assessment) {
    return (
      <AdminLayout>
        <div className="py-16 text-center text-muted-foreground text-sm">Loading assessment builder...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Back Link & Title Header */}
        <div className="space-y-3 border-b border-border pb-5">
          <Link
            to="/admin/assessments"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
          >
            <ChevronLeft className="h-4 w-4" /> Back to Assessments
          </Link>

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground">{assessment.title}</h1>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold uppercase ${
                    assessment.status === "published"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : assessment.status === "in_review"
                      ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                  }`}
                >
                  {assessment.status}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-mono border border-primary/20 font-semibold">
                  v{assessment.version}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border uppercase font-medium">
                  {assessment.assessment_type}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {assessment.description || "No description provided."}
              </p>
            </div>

            {/* Lifecycle Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={handleValidate}
                className="h-8 text-xs border-border text-foreground hover:bg-muted gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Validate Engine
              </Button>

              {assessment.status === "draft" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSubmitReview}
                  className="h-8 text-xs border-sky-500/30 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" /> Submit Review
                </Button>
              )}

              {assessment.status !== "published" && (
                <Button
                  size="sm"
                  onClick={handlePublish}
                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
                >
                  <CheckCircle className="h-3.5 w-3.5" /> Publish Snapshot
                </Button>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={handleFork}
                className="h-8 text-xs border-border text-foreground hover:bg-muted gap-1.5"
              >
                <GitFork className="h-3.5 w-3.5 text-purple-500" /> Fork New Version
              </Button>
            </div>
          </div>
        </div>

        {/* Feedback Alert */}
        {msg && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center justify-between ${
              msg.type === "success"
                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                : "bg-destructive/10 border border-destructive/30 text-destructive"
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

        {/* Navigation Tabs */}
        <div className="flex border-b border-border text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("builder")}
            className={`pb-3 px-4 border-b-2 transition flex items-center gap-2 ${
              activeTab === "builder"
                ? "border-primary text-foreground font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="h-4 w-4" /> Sections & Questions ({assessment.sections?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("versions")}
            className={`pb-3 px-4 border-b-2 transition flex items-center gap-2 ${
              activeTab === "versions"
                ? "border-primary text-foreground font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="h-4 w-4" /> Version History ({versions.length})
          </button>
        </div>

        {/* Tab 1: Section Builder */}
        {activeTab === "builder" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Assessment Sections</h2>
              <Button
                size="sm"
                onClick={() => setSectionModalOpen(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1 text-xs"
              >
                <Plus className="h-3.5 w-3.5" /> Add Section
              </Button>
            </div>

            {(!assessment.sections || assessment.sections.length === 0) ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center shadow-xs">
                <p className="text-muted-foreground text-sm">
                  This assessment has no sections yet. Click "Add Section" to create your first passage or prompt.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {assessment.sections.map((section, sIdx) => (
                  <div
                    key={section.id}
                    className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs"
                  >
                    {/* Section Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-mono font-bold">
                            #{sIdx + 1}
                          </span>
                          <h3 className="font-bold text-foreground text-base">{section.title}</h3>
                        </div>
                        {section.instructions && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            Consigne : {section.instructions}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        {section.time_limit_seconds && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                            <Clock className="h-3 w-3" /> {Math.round(section.time_limit_seconds / 60)} min
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setTargetSectionId(section.id);
                            setQuestionModalOpen(true);
                          }}
                          className="h-8 text-xs border-border text-foreground hover:bg-muted gap-1"
                        >
                          <Plus className="h-3.5 w-3.5 text-primary" /> Add Question
                        </Button>
                      </div>
                    </div>

                    {/* Passage text or Media */}
                    {section.passage_text && (
                      <div className="p-3 rounded-lg bg-muted/40 border border-border text-xs text-foreground whitespace-pre-line font-serif leading-relaxed">
                        {section.passage_text}
                      </div>
                    )}

                    {section.media_url && (
                      <div className="p-2 rounded bg-muted/40 border border-border text-xs text-muted-foreground flex items-center gap-2">
                        <span className="font-semibold text-foreground">Media URL:</span>
                        <span className="font-mono truncate">{section.media_url}</span>
                      </div>
                    )}

                    {/* Section Questions */}
                    <div className="space-y-3 pt-2">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Questions ({section.questions?.length || 0})
                      </h4>

                      {(!section.questions || section.questions.length === 0) ? (
                        <p className="text-xs text-muted-foreground italic py-2">
                          No questions in this section yet.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {section.questions.map((q, qIdx) => (
                            <div
                              key={q.id}
                              className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-xs"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-primary">
                                      Q{qIdx + 1}.
                                    </span>
                                    <span className="font-medium text-foreground">{q.prompt}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-muted-foreground text-2xs">
                                    <span className="px-1.5 py-0.5 rounded bg-muted border border-border uppercase">
                                      {q.question_type}
                                    </span>
                                    <span>Niveau: {q.level}</span>
                                    <span>Points: {q.points}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Options */}
                              {q.options && q.options.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-border">
                                  {q.options.map((opt, oIdx) => (
                                    <div
                                      key={opt.id || oIdx}
                                      className={`p-2 rounded border flex items-center justify-between text-2xs ${
                                        opt.is_correct
                                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold"
                                          : "bg-card border-border text-muted-foreground"
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Versions History */}
        {activeTab === "versions" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground">Immutable Version Snapshots</h2>
            <p className="text-xs text-muted-foreground">
              Historical snapshots frozen at time of publishing. Ensures student attempts always evaluate against the exact questions taken.
            </p>

            {versions.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm shadow-xs">
                No versions frozen yet. Publishing an assessment will create version 1.
              </div>
            ) : (
              <div className="space-y-4">
                {versions.map((ver) => (
                  <div
                    key={ver.id}
                    className="rounded-xl border border-border bg-card p-4 space-y-2 text-xs shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs px-2.5 py-1 rounded bg-primary/10 text-primary border border-primary/20 font-bold">
                          v{ver.version}
                        </span>
                        <span className="font-semibold text-foreground text-sm">{ver.title}</span>
                      </div>
                      <span className="text-muted-foreground font-mono">
                        Frozen on: {new Date(ver.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="text-muted-foreground font-mono">
                      Sections Snapshotted: {ver.sections_snapshot?.length || 0}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal: Add Section */}
        {sectionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 space-y-4 shadow-2xl">
              <h2 className="text-lg font-bold text-foreground">Add Assessment Section</h2>
              <form onSubmit={handleCreateSection} className="space-y-3 text-xs">
                <div>
                  <label className="block text-foreground mb-1 font-medium">Section Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Section A — Documents courts"
                    value={newSection.title}
                    onChange={(e) => setNewSection({ ...newSection, title: e.target.value })}
                    className="w-full rounded-md border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-foreground mb-1 font-medium">Instructions</label>
                  <input
                    type="text"
                    placeholder="e.g. Lisez le document et répondez aux questions..."
                    value={newSection.instructions}
                    onChange={(e) => setNewSection({ ...newSection, instructions: e.target.value })}
                    className="w-full rounded-md border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-foreground mb-1 font-medium">Passage / Reading Text</label>
                  <textarea
                    rows={4}
                    placeholder="Enter the reading stimulus text..."
                    value={newSection.passage_text}
                    onChange={(e) => setNewSection({ ...newSection, passage_text: e.target.value })}
                    className="w-full rounded-md border border-border bg-background p-2 text-foreground font-serif focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-foreground mb-1 font-medium">Media Audio/Video URL (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. https://storage.tef-prep.local/content/audio_01.mp3"
                    value={newSection.media_url}
                    onChange={(e) => setNewSection({ ...newSection, media_url: e.target.value })}
                    className="w-full rounded-md border border-border bg-background p-2 text-foreground font-mono focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSectionModalOpen(false)}
                    className="border-border text-foreground hover:bg-muted"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    Save Section
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Add Question */}
        {questionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-bold text-foreground">Add Question to Section</h2>
              <form onSubmit={handleAddQuestion} className="space-y-3 text-xs">
                <div>
                  <label className="block text-foreground mb-1 font-medium">Question Prompt</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="e.g. D'après le texte, quelle est la cause principale de..."
                    value={newQuestion.prompt}
                    onChange={(e) => setNewQuestion({ ...newQuestion, prompt: e.target.value })}
                    className="w-full rounded-md border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-foreground mb-1 font-medium">Type</label>
                    <select
                      value={newQuestion.question_type}
                      onChange={(e) => setNewQuestion({ ...newQuestion, question_type: e.target.value })}
                      className="w-full rounded-md border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary"
                    >
                      <option value="single_choice">Single Choice</option>
                      <option value="multiple_choice">Multiple Choice</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-foreground mb-1 font-medium">Level</label>
                    <select
                      value={newQuestion.level}
                      onChange={(e) => setNewQuestion({ ...newQuestion, level: e.target.value })}
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
                    <label className="block text-foreground mb-1 font-medium">Points</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={newQuestion.points}
                      onChange={(e) =>
                        setNewQuestion({ ...newQuestion, points: parseInt(e.target.value, 10) })
                      }
                      className="w-full rounded-md border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Options List */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <label className="block text-foreground font-bold">Answer Options (Check the correct answer)</label>
                  {newQuestion.options.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-2">
                      <input
                        type={newQuestion.question_type === "single_choice" ? "radio" : "checkbox"}
                        name="correct_option"
                        checked={opt.is_correct}
                        onChange={() => {
                          const updated = newQuestion.options.map((o, idx) => ({
                            ...o,
                            is_correct:
                              newQuestion.question_type === "single_choice"
                                ? idx === oIdx
                                : idx === oIdx
                                ? !o.is_correct
                                : o.is_correct,
                          }));
                          setNewQuestion({ ...newQuestion, options: updated });
                        }}
                        className="h-4 w-4 text-primary rounded"
                      />
                      <input
                        type="text"
                        placeholder={`Option ${oIdx + 1}`}
                        value={opt.content}
                        onChange={(e) => {
                          const updated = [...newQuestion.options];
                          updated[oIdx].content = e.target.value;
                          setNewQuestion({ ...newQuestion, options: updated });
                        }}
                        className="flex-1 rounded-md border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-foreground mb-1 font-medium">Explanation / Rationale</label>
                  <textarea
                    rows={2}
                    placeholder="Pedagogical justification shown after submission..."
                    value={newQuestion.explanation}
                    onChange={(e) => setNewQuestion({ ...newQuestion, explanation: e.target.value })}
                    className="w-full rounded-md border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setQuestionModalOpen(false)}
                    className="border-border text-foreground hover:bg-muted"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    Add Question
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Validation Report */}
        {valReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  Fail-Closed Validation Report
                </h2>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${
                    valReport.is_valid
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : "bg-destructive/10 text-destructive border border-destructive/30"
                  }`}
                >
                  {valReport.is_valid ? "Valid" : "Blocked"}
                </span>
              </div>

              {/* Errors */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-destructive uppercase tracking-wider">
                  Errors ({valReport.errors?.length || 0})
                </h3>
                {valReport.errors?.length === 0 ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" /> Assessment conforms to all publishing specifications.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {valReport.errors.map((err, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded bg-destructive/10 border border-destructive/20 text-xs text-destructive"
                      >
                        {err.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setValReport(null)}
                  className="border-border text-foreground hover:bg-muted"
                >
                  Close
                </Button>
                {valReport.is_valid && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setValReport(null);
                      handlePublish();
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1 text-xs"
                  >
                    <CheckCircle className="h-3.5 w-3.5" /> Publish Now
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
