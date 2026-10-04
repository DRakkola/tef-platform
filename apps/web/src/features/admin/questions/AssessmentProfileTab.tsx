import React, { useState, useEffect } from "react";
import { Sliders, Layers, HelpCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { fetchTaskTypes } from "../skills/api";
import type { TaskType } from "../skills/types";
import type { QuestionItem, QuestionResponseType, CognitiveComplexityLevel } from "../types";

interface AssessmentProfileTabProps {
  question: Partial<QuestionItem>;
  onChange: (patch: Partial<QuestionItem>) => void;
  disabled?: boolean;
}

const RESPONSE_TYPES: Array<{ value: QuestionResponseType; label: string; desc: string }> = [
  { value: "single_choice", label: "Choix unique (QCM)", desc: "1 seule réponse correcte parmi plusieurs distracteurs" },
  { value: "multiple_choice", label: "Choix multiple", desc: "Plusieurs réponses correctes à sélectionner" },
  { value: "matching", label: "Appariement", desc: "Association terme à terme entre deux colonnes" },
  { value: "ordering", label: "Ordonnancement", desc: "Remise en ordre chronologique ou logique" },
  { value: "gap_fill", label: "Texte à trous", desc: "Complétion de blancs guidée ou libre" },
  { value: "short_text", label: "Réponse courte", desc: "Mot ou syntagme exact avec variantes admises" },
  { value: "long_text", label: "Production écrite libre", desc: "Essai, lettre ou argumentation évaluée par grille" },
  { value: "spoken_response", label: "Production orale", desc: "Enregistrement vocal noté par grille ou examinateur" },
  { value: "interaction", label: "Interaction dialoguée", desc: "Simulation interactive" },
];

const COGNITIVE_COMPLEXITIES: Array<{ value: CognitiveComplexityLevel; label: string; desc: string }> = [
  { value: "remember", label: "Mémoriser / Reconnaître", desc: "Repérer une information textuelle ou lexicale explicite" },
  { value: "understand", label: "Comprendre / Interpréter", desc: "Saisir le sens global, reformuler ou identifier l'intention" },
  { value: "apply", label: "Appliquer", desc: "Utiliser une règle grammaticale ou convention dans un contexte" },
  { value: "analyze", label: "Analyser / Déduire", desc: "Distinguer des nuances, inférer des intentions implicites" },
  { value: "evaluate", label: "Évaluer / Juger", desc: "Porter un jugement critique sur la cohérence ou la valeur" },
  { value: "create", label: "Créer / Produire", desc: "Synthétiser et générer une production linguistique originale" },
];

export const AssessmentProfileTab: React.FC<AssessmentProfileTabProps> = ({
  question,
  onChange,
  disabled = false,
}) => {
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const currentModality = question.task_type?.modality || "reading";

  useEffect(() => {
    loadTaskTypes(currentModality);
  }, [currentModality]);

  const loadTaskTypes = async (modality: string) => {
    setLoadingTasks(true);
    try {
      const items = await fetchTaskTypes(modality);
      setTaskTypes(items);
    } catch {
      // fallback
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleModalityChange = (modality: string) => {
    onChange({
      task_type_id: null,
      task_type: null,
    });
    loadTaskTypes(modality);
  };

  const handleTaskTypeSelect = (taskTypeId: string) => {
    const selected = taskTypes.find((t) => t.id === taskTypeId);
    onChange({
      task_type_id: taskTypeId,
      task_type: selected ? { id: selected.id, code: selected.code, name: selected.name, modality: selected.modality } : null,
    });
  };

  return (
    <div className="space-y-6">
      {/* Target CEFR & Difficulty Triad Notice */}
      <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-start gap-3 text-xs">
        <HelpCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-semibold text-foreground">
            Principe de dé-conflation psychométrique TEF
          </h4>
          <p className="text-muted-foreground text-2xs leading-relaxed">
            Le modèle psychométrique TEF sépare explicitement :
            <br />
            1. <strong>Niveau CEFR cible</strong> (ex. B1, B2) — la norme standard de maîtrise attendue.
            <br />
            2. <strong>Difficulté intrinsèque de l'item (1 à 5)</strong> — la propension d'erreur mesurée par rapport à ce niveau CEFR.
            <br />
            3. <strong>Complexité cognitive</strong> — la profondeur de traitement taxonomique requise (Taxonomie de Bloom révisée).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Modality & Task Type */}
        <div className="p-4 rounded-xl border border-border bg-card space-y-4">
          <div className="flex items-center gap-2 text-foreground font-semibold text-xs border-b border-border pb-2">
            <Layers className="h-4 w-4 text-primary" />
            Cadre de l'épreuve & Type de tâche
          </div>

          <div>
            <Label className="text-xs font-semibold">Modalité de l'épreuve *</Label>
            <select
              value={currentModality}
              onChange={(e) => handleModalityChange(e.target.value)}
              disabled={disabled}
              className="w-full mt-1 rounded-md border border-border bg-background p-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
            >
              <option value="reading">Compréhension écrite (Reading)</option>
              <option value="listening">Compréhension orale (Listening)</option>
              <option value="writing">Expression écrite (Writing)</option>
              <option value="speaking">Expression orale (Speaking)</option>
            </select>
          </div>

          <div>
            <Label className="text-xs font-semibold">
              Type de tâche canonique (Taxonomy Task Type) *
            </Label>
            <select
              value={question.task_type_id || ""}
              onChange={(e) => handleTaskTypeSelect(e.target.value)}
              disabled={disabled || loadingTasks}
              className="w-full mt-1 rounded-md border border-border bg-background p-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
            >
              <option value="">-- Sélectionner un type de tâche --</option>
              {taskTypes.map((tt) => (
                <option key={tt.id} value={tt.id}>
                  {tt.name} ({tt.code})
                </option>
              ))}
            </select>
            <p className="text-2xs text-muted-foreground mt-1">
              Les compétences assignables sont alignées sur la modalité et le type de tâche choisi.
            </p>
          </div>

          <div>
            <Label className="text-xs font-semibold">Modèle de réponse (Response Type) *</Label>
            <select
              value={question.question_type || "single_choice"}
              onChange={(e) => onChange({ question_type: e.target.value as QuestionResponseType })}
              disabled={disabled}
              className="w-full mt-1 rounded-md border border-border bg-background p-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
            >
              {RESPONSE_TYPES.map((rt) => (
                <option key={rt.value} value={rt.value}>
                  {rt.label} — {rt.desc}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Psychometric Calibration */}
        <div className="p-4 rounded-xl border border-border bg-card space-y-4">
          <div className="flex items-center gap-2 text-foreground font-semibold text-xs border-b border-border pb-2">
            <Sliders className="h-4 w-4 text-primary" />
            Calibration psychométrique & Barème
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">Niveau CEFR cible *</Label>
              <select
                value={question.target_cefr || question.level || "B1"}
                onChange={(e) => onChange({ target_cefr: e.target.value, level: e.target.value })}
                disabled={disabled}
                className="w-full mt-1 rounded-md border border-border bg-background p-2 text-xs text-foreground font-bold focus:ring-1 focus:ring-primary"
              >
                <option value="A1">A1 — Débutant</option>
                <option value="A2">A2 — Élémentaire</option>
                <option value="B1">B1 — Intermédiaire</option>
                <option value="B2">B2 — Intermédiaire supérieur</option>
                <option value="C1">C1 — Avancé</option>
                <option value="C2">C2 — Maîtrise</option>
              </select>
            </div>

            <div>
              <Label className="text-xs font-semibold">
                Difficulté de l'item (1 à 5) *
              </Label>
              <select
                value={question.item_difficulty ?? question.difficulty ?? 3}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  onChange({ item_difficulty: val, difficulty: val });
                }}
                disabled={disabled}
                className="w-full mt-1 rounded-md border border-border bg-background p-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
              >
                <option value={1}>1 — Très accessible</option>
                <option value={2}>2 — Modéré / Standard</option>
                <option value={3}>3 — Intermédiaire calibré</option>
                <option value={4}>4 — Discriminant / Difficile</option>
                <option value={5}>5 — Très discriminant / Expert</option>
              </select>
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold">Complexité cognitive (Bloom)</Label>
            <select
              value={question.cognitive_complexity || "understand"}
              onChange={(e) =>
                onChange({ cognitive_complexity: e.target.value as CognitiveComplexityLevel })
              }
              disabled={disabled}
              className="w-full mt-1 rounded-md border border-border bg-background p-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
            >
              {COGNITIVE_COMPLEXITIES.map((cc) => (
                <option key={cc.value} value={cc.value}>
                  {cc.label} ({cc.desc})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border">
            <div>
              <Label className="text-xs font-semibold">Points attribués *</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={question.points ?? 1}
                onChange={(e) => onChange({ points: parseInt(e.target.value, 10) || 1 })}
                disabled={disabled}
                className="h-8 text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Points de pénalité</Label>
              <Input
                type="number"
                min={0}
                max={10}
                value={question.penalty_points ?? 0}
                onChange={(e) => onChange({ penalty_points: parseInt(e.target.value, 10) || 0 })}
                disabled={disabled}
                className="h-8 text-xs mt-1"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
