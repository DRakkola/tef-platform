import React, { useEffect, useState } from "react";
import {
  GitBranch,
  Plus,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import {
  fetchSkills,
  createSkill,
  createSubSkill,
  updateSubSkill,
  deleteSubSkill,
} from "./api";
import type { SkillItem, SubSkill } from "./types";
import { Button } from "@/components/ui/button";

export const SkillsManagerPage: React.FC = () => {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSkills, setExpandedSkills] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modals state
  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const [newSkill, setNewSkill] = useState({
    code: "",
    name: "",
    category: "reading",
    description: "",
  });

  const [subskillModalOpen, setSubskillModalOpen] = useState(false);
  const [selectedParentSkillId, setSelectedParentSkillId] = useState<string | null>(null);
  const [newSubskill, setNewSubskill] = useState({
    code: "",
    name: "",
    description: "",
  });

  const [editingSubskill, setEditingSubskill] = useState<SubSkill | null>(null);
  const [editSubskillName, setEditSubskillName] = useState("");
  const [editSubskillDesc, setEditSubskillDesc] = useState("");

  const loadSkills = async () => {
    setIsLoading(true);
    try {
      const data = await fetchSkills();
      setSkills(data);
      // Auto expand all
      const expanded: Record<string, boolean> = {};
      data.forEach((s) => {
        expanded[s.id] = true;
      });
      setExpandedSkills(expanded);
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to load skills." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSkills();
  }, []);

  const toggleExpand = (skillId: string) => {
    setExpandedSkills((prev) => ({ ...prev, [skillId]: !prev[skillId] }));
  };

  const handleCreateSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createSkill(newSkill);
      setMsg({ type: "success", text: `Skill "${newSkill.name}" created.` });
      setSkillModalOpen(false);
      setNewSkill({ code: "", name: "", category: "reading", description: "" });
      loadSkills();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to create skill." });
    }
  };

  const handleCreateSubskill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParentSkillId) return;
    try {
      await createSubSkill(selectedParentSkillId, newSubskill);
      setMsg({ type: "success", text: `Subskill "${newSubskill.name}" created.` });
      setSubskillModalOpen(false);
      setNewSubskill({ code: "", name: "", description: "" });
      loadSkills();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to create subskill." });
    }
  };

  const handleUpdateSubskill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubskill) return;
    try {
      await updateSubSkill(editingSubskill.id, {
        name: editSubskillName,
        description: editSubskillDesc,
      });
      setMsg({ type: "success", text: "Subskill updated successfully." });
      setEditingSubskill(null);
      loadSkills();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to update subskill." });
    }
  };

  const handleDeleteSubskill = async (id: string, name: string) => {
    if (!window.confirm(`Delete subskill "${name}"?`)) return;
    try {
      await deleteSubSkill(id);
      setMsg({ type: "success", text: `Subskill "${name}" deleted.` });
      loadSkills();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to delete subskill." });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <GitBranch className="h-6 w-6 text-primary" />
              Skills & Subskills Taxonomy
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage hierarchical competencies for accurate micro-scoring and targeted diagnostics.
            </p>
          </div>
          <Button
            onClick={() => setSkillModalOpen(true)}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 self-start"
          >
            <Plus className="h-4 w-4" /> Add Parent Skill
          </Button>
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

        {/* Skills List */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading skills taxonomy...</div>
        ) : skills.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-border bg-card shadow-xs">
            <p className="text-muted-foreground text-sm">No skills found. Click "Add Parent Skill" to start.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {skills.map((skill) => {
              const isExpanded = !!expandedSkills[skill.id];
              const subCount = skill.subskills?.length || 0;

              return (
                <div
                  key={skill.id}
                  className="rounded-xl border border-border bg-card overflow-hidden shadow-xs"
                >
                  {/* Skill Bar */}
                  <div className="flex items-center justify-between p-4 bg-muted/40 border-b border-border">
                    <button
                      type="button"
                      onClick={() => toggleExpand(skill.id)}
                      className="flex items-center gap-3 text-left hover:text-primary transition"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground text-base">{skill.name}</span>
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                            {skill.code}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 uppercase font-medium">
                            {skill.category}
                          </span>
                        </div>
                        {skill.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {skill.description}
                          </p>
                        )}
                      </div>
                    </button>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground font-mono bg-background px-2.5 py-1 rounded border border-border">
                        {subCount} subskills
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedParentSkillId(skill.id);
                          setSubskillModalOpen(true);
                        }}
                        className="h-8 text-xs gap-1 border-border text-foreground hover:bg-muted"
                      >
                        <FolderPlus className="h-3.5 w-3.5 text-primary" /> Add Subskill
                      </Button>
                    </div>
                  </div>

                  {/* Subskills Subtree */}
                  {isExpanded && (
                    <div className="p-4 divide-y divide-border/40">
                      {subCount === 0 ? (
                        <p className="text-xs text-muted-foreground italic py-2 pl-7">
                          No subskills added yet for this domain.
                        </p>
                      ) : (
                        skill.subskills!.map((sub) => (
                          <div
                            key={sub.id}
                            className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pl-7 hover:bg-muted/50 rounded px-2 transition-colors"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-foreground">
                                  {sub.name}
                                </span>
                                <span className="text-xs font-mono text-muted-foreground">
                                  ({sub.code})
                                </span>
                              </div>
                              {sub.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">{sub.description}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-auto">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSubskill(sub);
                                  setEditSubskillName(sub.name);
                                  setEditSubskillDesc(sub.description || "");
                                }}
                                className="text-muted-foreground hover:text-primary p-1.5 rounded hover:bg-muted transition"
                                title="Edit Subskill"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSubskill(sub.id, sub.name)}
                                className="text-muted-foreground hover:text-destructive p-1.5 rounded hover:bg-muted transition"
                                title="Delete Subskill"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Add Parent Skill */}
        {skillModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 space-y-4 shadow-2xl text-foreground">
              <h2 className="text-lg font-bold text-foreground">Create New Parent Skill</h2>
              <form onSubmit={handleCreateSkill} className="space-y-3 text-xs">
                <div>
                  <label className="block text-foreground mb-1 font-medium">Skill Code (Unique)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. grammar_logic"
                    value={newSkill.code}
                    onChange={(e) => setNewSkill({ ...newSkill, code: e.target.value })}
                    className="w-full rounded-md border border-border bg-background p-2 text-foreground font-mono focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-foreground mb-1 font-medium">Skill Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Logique et Concession"
                    value={newSkill.name}
                    onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })}
                    className="w-full rounded-md border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-foreground mb-1 font-medium">Category</label>
                  <select
                    value={newSkill.category}
                    onChange={(e) => setNewSkill({ ...newSkill, category: e.target.value })}
                    className="w-full rounded-md border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary"
                  >
                    <option value="reading">Reading (Compréhension Écrite)</option>
                    <option value="listening">Listening (Compréhension Orale)</option>
                    <option value="grammar">Grammar (Grammaire)</option>
                    <option value="vocabulary">Vocabulary (Vocabulaire)</option>
                    <option value="conjugation">Conjugation (Conjugaison)</option>
                    <option value="writing">Writing (Expression Écrite)</option>
                    <option value="speaking">Speaking (Expression Orale)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-foreground mb-1 font-medium">Description</label>
                  <textarea
                    rows={3}
                    placeholder="Educational objectives and scope..."
                    value={newSkill.description}
                    onChange={(e) => setNewSkill({ ...newSkill, description: e.target.value })}
                    className="w-full rounded-md border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSkillModalOpen(false)}
                    className="border-border text-foreground hover:bg-muted"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    Save Skill
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Add Subskill */}
        {subskillModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 space-y-4 shadow-2xl text-foreground">
              <h2 className="text-lg font-bold text-foreground">Add Subskill</h2>
              <form onSubmit={handleCreateSubskill} className="space-y-3 text-xs">
                <div>
                  <label className="block text-foreground mb-1 font-medium">Subskill Code (Unique)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. grammar_subjonctif_doute"
                    value={newSubskill.code}
                    onChange={(e) => setNewSubskill({ ...newSubskill, code: e.target.value })}
                    className="w-full rounded-md border border-border bg-background p-2 text-foreground font-mono focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-foreground mb-1 font-medium">Subskill Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Subjonctif après verbes de doute"
                    value={newSubskill.name}
                    onChange={(e) => setNewSubskill({ ...newSubskill, name: e.target.value })}
                    className="w-full rounded-md border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-foreground mb-1 font-medium">Description</label>
                  <textarea
                    rows={3}
                    placeholder="Pedagogical indicator..."
                    value={newSubskill.description}
                    onChange={(e) => setNewSubskill({ ...newSubskill, description: e.target.value })}
                    className="w-full rounded-md border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSubskillModalOpen(false)}
                    className="border-border text-foreground hover:bg-muted"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    Add Subskill
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Edit Subskill */}
        {editingSubskill && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 space-y-4 shadow-2xl text-foreground">
              <h2 className="text-lg font-bold text-foreground">Edit Subskill</h2>
              <p className="text-xs text-muted-foreground font-mono">Code: {editingSubskill.code}</p>
              <form onSubmit={handleUpdateSubskill} className="space-y-3 text-xs">
                <div>
                  <label className="block text-foreground mb-1 font-medium">Subskill Name</label>
                  <input
                    type="text"
                    required
                    value={editSubskillName}
                    onChange={(e) => setEditSubskillName(e.target.value)}
                    className="w-full rounded-md border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-foreground mb-1 font-medium">Description</label>
                  <textarea
                    rows={3}
                    value={editSubskillDesc}
                    onChange={(e) => setEditSubskillDesc(e.target.value)}
                    className="w-full rounded-md border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingSubskill(null)}
                    className="border-border text-foreground hover:bg-muted"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
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
