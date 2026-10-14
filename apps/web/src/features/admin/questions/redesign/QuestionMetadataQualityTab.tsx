import React, { useState, useEffect } from "react";
import {
  Award,
  Sliders,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Trash2,
  Layers,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchSkills, fetchTaskTypes } from "@/features/admin/api";
import type {
  QuestionItem,
  SkillItem,
  QuestionSkillTag,
  TaskType,
  QuestionValidationResult,
  CognitiveComplexityLevel,
} from "../../types";

interface QuestionMetadataQualityTabProps {
  question: Partial<QuestionItem>;
  onPatch: (patch: Partial<QuestionItem>) => void;
  validationReport?: QuestionValidationResult | null;
  disabled?: boolean;
}

export const QuestionMetadataQualityTab: React.FC<QuestionMetadataQualityTabProps> = ({
  question,
  onPatch,
  validationReport,
  disabled = false,
}) => {
  const [availableSkills, setAvailableSkills] = useState<SkillItem[]>([]);
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [isLoadingTaskTypes, setIsLoadingTaskTypes] = useState(false);
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);

  useEffect(() => {
    async function loadCatalog() {
      setIsLoadingSkills(true);
      setIsLoadingTaskTypes(true);
      try {
        const [rawSkills, loadedTaskTypes] = await Promise.all([
          fetchSkills(),
          fetchTaskTypes().catch(() => []),
        ]);
        setTaskTypes(loadedTaskTypes || []);

        const flattened: SkillItem[] = [];
        for (const sk of rawSkills || []) {
          flattened.push(sk);
          if (sk.subskills && Array.isArray(sk.subskills)) {
            for (const sub of sk.subskills) {
              flattened.push({
                ...sub,
                name: `${sk.code ? `[${sk.code}] ` : ""}${sk.name} › ${sub.name}`,
                category: sk.category,
              } as SkillItem);
            }
          }
        }
        setAvailableSkills(flattened);
      } catch (e) {
        console.error("Failed to load skills or task types catalog:", e);
      } finally {
        setIsLoadingSkills(false);
        setIsLoadingTaskTypes(false);
      }
    }
    loadCatalog();
  }, []);

  const skillTags: QuestionSkillTag[] = question.skill_tags || [];

  // Skill Handlers
  const handleAddSkillTag = (skillId: string) => {
    if (!skillId) return;
    if (skillTags.some((t) => t.skill_id === skillId)) return;

    const nextRole = skillTags.length === 0 ? "primary" : "secondary";
    const nextTags = [
      ...skillTags,
      { skill_id: skillId, role: nextRole as "primary" | "secondary", weight: 1.0 },
    ];
    // Re-balance weights
    const balanced = nextTags.map((t) => ({ ...t, weight: Number((1.0 / nextTags.length).toFixed(2)) }));
    onPatch({ skill_tags: balanced });
  };

  const handleRemoveSkillTag = (skillId: string) => {
    const filtered = skillTags.filter((t) => t.skill_id !== skillId);
    const balanced = filtered.map((t) => ({
      ...t,
      weight: Number((1.0 / (filtered.length || 1)).toFixed(2)),
    }));
    onPatch({ skill_tags: balanced });
  };

  const handleRoleChange = (skillId: string, role: "primary" | "secondary") => {
    const updated = skillTags.map((t) => (t.skill_id === skillId ? { ...t, role } : t));
    onPatch({ skill_tags: updated });
  };

  // AI Suggestion Handler
  const handleAiSuggestSkillsAndCefr = () => {
    setIsAiSuggesting(true);
    try {
      const combined = `${question.prompt || ""} ${question.stimulus_text || ""}`.toLowerCase();
      let suggestedCefr = "B1";
      if (combined.length > 250 || /néanmoins|par conséquent|ambiguïté/.test(combined)) {
        suggestedCefr = "B2";
      } else if (combined.length < 80) {
        suggestedCefr = "A2";
      }

      // Find matching skills
      const matched = availableSkills.filter((s) => {
        if (s.is_active === false) return false;
        if (/global|thème|idée/.test(combined) && /main_idea|globale/i.test(s.code + s.name)) return true;
        if (/détail|information|quand|où/.test(combined) && /detail|locate|information/i.test(s.code + s.name)) return true;
        if (/grammaire|accord|temps/.test(combined) && /gramm/i.test(s.code + s.name)) return true;
        return false;
      });

      const tagsToApply = matched.length > 0 ? matched : availableSkills.slice(0, 2);
      const generatedTags = tagsToApply.map((s, idx) => ({
        skill_id: s.id,
        role: (idx === 0 ? "primary" : "secondary") as "primary" | "secondary",
        weight: Number((1.0 / tagsToApply.length).toFixed(2)),
      }));

      onPatch({
        target_cefr: suggestedCefr,
        level: suggestedCefr,
        skill_tags: generatedTags,
      });
    } finally {
      setTimeout(() => setIsAiSuggesting(false), 300);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Psychometrics & Scoring Card */}
      <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-primary shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Profil psychométrique & Barème
              </h3>
              <p className="text-2xs text-muted-foreground">
                Calibrage standardisé pour le moteur adaptatif et le calcul du score TEF.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAiSuggestSkillsAndCefr}
            disabled={disabled || isAiSuggesting}
            className="text-xs h-8 gap-1.5 text-purple-600 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/20 font-semibold"
          >
            {isAiSuggesting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Suggérer CEFR & Compétences par IA
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {/* Target CEFR */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Niveau CEFR</Label>
            <select
              value={question.target_cefr || question.level || "B1"}
              onChange={(e) => onPatch({ target_cefr: e.target.value, level: e.target.value })}
              disabled={disabled}
              className="w-full rounded-md border border-border bg-background p-2 text-xs font-bold text-foreground"
            >
              {["A1", "A2", "B1", "B2", "C1", "C2"].map((lvl) => (
                <option key={lvl} value={lvl}>
                  Niveau {lvl}
                </option>
              ))}
            </select>
          </div>

          {/* Difficulty */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Difficulté (1 à 5)</Label>
            <select
              value={question.difficulty ?? question.item_difficulty ?? 3}
              onChange={(e) => onPatch({ difficulty: parseInt(e.target.value, 10), item_difficulty: parseInt(e.target.value, 10) })}
              disabled={disabled}
              className="w-full rounded-md border border-border bg-background p-2 text-xs text-foreground font-medium"
            >
              <option value="1">1 - Très facile</option>
              <option value="2">2 - Facile</option>
              <option value="3">3 - Intermédiaire</option>
              <option value="4">4 - Difficile</option>
              <option value="5">5 - Expert</option>
            </select>
          </div>

          {/* Cognitive Complexity */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Complexité cognitive</Label>
            <select
              value={question.cognitive_complexity || "understand"}
              onChange={(e) => onPatch({ cognitive_complexity: e.target.value as CognitiveComplexityLevel })}
              disabled={disabled}
              className="w-full rounded-md border border-border bg-background p-2 text-xs text-foreground font-medium"
            >
              <option value="remember">Mémorisation / Rappel</option>
              <option value="understand">Compréhension / Inférence</option>
              <option value="apply">Application contextuelle</option>
              <option value="analyze">Analyse / Synthèse</option>
              <option value="evaluate">Évaluation critique</option>
              <option value="create">Production / Création</option>
            </select>
          </div>

          {/* Points */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Points accordés</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={question.points ?? 1}
              onChange={(e) => onPatch({ points: Math.max(1, parseInt(e.target.value, 10) || 1) })}
              disabled={disabled}
              className="text-xs h-9 font-semibold"
            />
          </div>

          {/* Penalty */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Pénalité erreur</Label>
            <Input
              type="number"
              min={0}
              max={5}
              value={question.penalty_points ?? 0}
              onChange={(e) => onPatch({ penalty_points: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              disabled={disabled}
              className="text-xs h-9 font-semibold text-rose-600 dark:text-rose-400"
            />
          </div>
        </div>
      </div>

      {/* 2. Canonical Task Type (Section TEF) */}
      <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-border/50 pb-3">
          <Layers className="h-4 w-4 text-primary shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Type d'épreuve & Format de tâche canonique TEF
            </h3>
            <p className="text-2xs text-muted-foreground">
              Associe l'exercice à la section officielle de l'examen TEF (Compréhension écrite, orale, etc.).
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold text-foreground">
            Type de tâche officiel *
          </Label>
          <select
            value={question.task_type_id || ""}
            onChange={(e) => {
              const selectedId = e.target.value;
              const matchedTt = taskTypes.find((tt) => tt.id === selectedId);
              onPatch({
                task_type_id: selectedId || null,
                task_type: matchedTt
                  ? {
                      id: matchedTt.id,
                      code: matchedTt.code,
                      name: matchedTt.name,
                      modality: matchedTt.modality,
                    }
                  : null,
              });
            }}
            disabled={disabled || isLoadingTaskTypes}
            className="w-full rounded-md border border-border bg-background p-2.5 text-xs font-medium text-foreground"
          >
            <option value="">-- Aucun type de tâche spécifié (Non catégorisé) --</option>
            {taskTypes.map((tt) => (
              <option key={tt.id} value={tt.id}>
                [{tt.modality.toUpperCase()}] {tt.code} — {tt.name}
              </option>
            ))}
          </select>
        </div>

        {question.task_type && (
          <div className="p-3 rounded-xl border border-border/60 bg-muted/20 flex items-center justify-between text-xs">
            <div className="space-y-0.5">
              <span className="font-bold text-foreground">{question.task_type.name}</span>
              <p className="text-2xs text-muted-foreground font-mono">Code : {question.task_type.code}</p>
            </div>
            <span className="text-2xs uppercase font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {question.task_type.modality}
            </span>
          </div>
        )}
      </div>

      {/* 3. Canonical Competencies V2 */}
      <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-primary shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Compétences didactiques associées (Taxonomie V2)
              </h3>
              <p className="text-2xs text-muted-foreground">
                Permet au moteur d'évaluation adaptatif d'actualiser les sous-compétences du candidat.
              </p>
            </div>
          </div>
        </div>

        {/* Existing Tags Table */}
        {skillTags.length > 0 ? (
          <div className="space-y-2">
            {skillTags.map((tag) => {
              const matchedSkill = availableSkills.find((s) => s.id === tag.skill_id);
              const skillCode = tag.skill_code || matchedSkill?.code || tag.skill_id.slice(0, 8);
              const skillName = tag.skill_name || matchedSkill?.name || "Compétence didactique";
              return (
                <div
                  key={tag.skill_id}
                  className="flex items-center justify-between p-3 rounded-xl border border-border/70 bg-background text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-2xs font-bold px-1.5 py-0.5 rounded bg-muted text-foreground">
                      {skillCode}
                    </span>
                    <span className="font-medium text-foreground">
                      {skillName}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <select
                      value={tag.role}
                      onChange={(e) => handleRoleChange(tag.skill_id, e.target.value as "primary" | "secondary")}
                      disabled={disabled}
                      className="rounded-md border border-border bg-card px-2 py-1 text-2xs font-semibold"
                    >
                      <option value="primary">Primaire (Majeure)</option>
                      <option value="secondary">Secondaire</option>
                    </select>
                    <span className="text-2xs font-mono font-bold text-muted-foreground w-12 text-right">
                      {Math.round((tag.weight || 1.0) * 100)}%
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveSkillTag(tag.skill_id)}
                      disabled={disabled}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Aucune compétence rattachée. Utilisez l'assistant IA ou le sélecteur ci-dessous.</span>
          </div>
        )}

        {/* Add Skill Dropdown */}
        <div className="flex items-center gap-2 pt-2">
          <select
            onChange={(e) => {
              handleAddSkillTag(e.target.value);
              e.target.value = "";
            }}
            disabled={disabled || isLoadingSkills}
            className="flex-1 rounded-md border border-border bg-background p-2 text-xs text-foreground"
            defaultValue=""
          >
            <option value="" disabled>
              + Sélectionner une compétence canonique à associer...
            </option>
            {availableSkills
              .filter((s) => !skillTags.some((t) => t.skill_id === s.id))
              .map((sk) => (
                <option key={sk.id} value={sk.id}>
                  [{sk.code}] {sk.name} ({sk.category || "Général"})
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* 4. Real-Time Quality Audit & Detailed Linter */}
      <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Contrôles de conformité & Audit qualité TEF
              </h3>
              <p className="text-2xs text-muted-foreground">
                Vérifications automatiques appliquées avant publication dans les épreuves officielles.
              </p>
            </div>
          </div>
          {validationReport && (
            <span
              className={`text-2xs font-bold px-2 py-0.5 rounded-full border ${
                validationReport.is_valid
                  ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                  : "bg-rose-500/10 text-rose-700 border-rose-500/30"
              }`}
            >
              {validationReport.is_valid ? "✓ 100% Conforme" : "⚠ Anomalies détectées"}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl border border-border/60 bg-muted/20 space-y-1">
            <span className="text-muted-foreground text-2xs uppercase font-semibold">Format & Enoncé</span>
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              {question.prompt && question.prompt.length >= 10 ? (
                <span className="text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Longueur valide
                </span>
              ) : (
                <span className="text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> Énoncé court
                </span>
              )}
            </div>
          </div>

          <div className="p-3 rounded-xl border border-border/60 bg-muted/20 space-y-1">
            <span className="text-muted-foreground text-2xs uppercase font-semibold">Options de réponse</span>
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              {question.options && question.options.some((o) => o.is_correct) ? (
                <span className="text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Réponse définie
                </span>
              ) : (
                <span className="text-rose-600 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> Réponse manquante
                </span>
              )}
            </div>
          </div>

          <div className="p-3 rounded-xl border border-border/60 bg-muted/20 space-y-1">
            <span className="text-muted-foreground text-2xs uppercase font-semibold">Graphe de compétences</span>
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              {skillTags.length > 0 ? (
                <span className="text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {skillTags.length} tag(s) valide(s)
                </span>
              ) : (
                <span className="text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> 0 tag rattaché
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Validation Issues List */}
        {validationReport && validationReport.issues && validationReport.issues.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border/40">
            <h4 className="text-xs font-bold text-foreground">
              Détail des anomalies relevées par le moteur de validation :
            </h4>
            <div className="space-y-1.5">
              {validationReport.issues.map((iss, i) => (
                <div
                  key={i}
                  className={`p-2.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                    iss.severity === "blocking"
                      ? "border-rose-500/30 bg-rose-500/5 text-rose-800 dark:text-rose-200"
                      : "border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-200"
                  }`}
                >
                  {iss.severity === "blocking" ? (
                    <XCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-2xs font-bold uppercase px-1.5 py-0.2 rounded bg-background/80">
                        {iss.code}
                      </span>
                      {iss.field && (
                        <span className="text-2xs font-semibold text-muted-foreground">
                          Champ : {iss.field}
                        </span>
                      )}
                    </div>
                    <p className="text-xs">{iss.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
