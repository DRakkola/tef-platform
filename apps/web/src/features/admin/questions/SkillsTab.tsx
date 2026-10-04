import React, { useState, useEffect } from "react";
import { Plus, Trash2, CheckCircle2, AlertTriangle, Scale, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fetchTaxonomySkills } from "../skills/api";
import type { TaxonomySkillItem } from "../skills/types";
import type { QuestionItem, QuestionSkillTag } from "../types";

interface SkillsTabProps {
  question: Partial<QuestionItem>;
  onChange: (patch: Partial<QuestionItem>) => void;
  disabled?: boolean;
}

export const SkillsTab: React.FC<SkillsTabProps> = ({
  question,
  onChange,
  disabled = false,
}) => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [availableSkills, setAvailableSkills] = useState<TaxonomySkillItem[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [skillSearch, setSkillSearch] = useState("");
  const [filterDimension, setFilterDimension] = useState<string>("all");

  const tags: QuestionSkillTag[] = question.skill_tags || [];

  useEffect(() => {
    if (isAddOpen) {
      loadTaxonomySkills();
    }
  }, [isAddOpen, skillSearch, filterDimension]);

  const loadTaxonomySkills = async () => {
    setLoadingSkills(true);
    try {
      const res = await fetchTaxonomySkills({
        q: skillSearch || undefined,
        dimension: filterDimension !== "all" ? filterDimension : undefined,
        page_size: 50,
      });
      setAvailableSkills(res.items || []);
    } catch {
      // fallback
    } finally {
      setLoadingSkills(false);
    }
  };

  const handleAddSkill = (skill: TaxonomySkillItem) => {
    if (tags.some((t) => t.skill_id === skill.id)) return;

    // Check if this is the first skill in its dimension to assign default PRIMARY
    const existingInDim = tags.filter((t) => (t.dimension || "reasoning") === skill.dimension);
    const defaultRole = existingInDim.length === 0 ? "primary" : "secondary";

    const newTag: QuestionSkillTag = {
      skill_id: skill.id,
      skill_code: skill.code,
      skill_name: skill.name,
      dimension: skill.dimension,
      domain: skill.domain,
      role: defaultRole,
      weight: 1.0,
    };

    const nextTags = [...tags, newTag];
    onChange({ skill_tags: nextTags });
    setIsAddOpen(false);
  };

  const handleRemoveTag = (index: number) => {
    const next = tags.filter((_, idx) => idx !== index);
    onChange({ skill_tags: next });
  };

  const handleUpdateTag = (index: number, patch: Partial<QuestionSkillTag>) => {
    const next = tags.map((t, idx) => (idx === index ? { ...t, ...patch } : t));
    onChange({ skill_tags: next });
  };

  // Auto-normalize weights within each dimension to sum to 1.00
  const handleAutoBalance = () => {
    const dimensions = Array.from(new Set(tags.map((t) => t.dimension || "reasoning")));
    let updated = [...tags];

    for (const dim of dimensions) {
      const dimIndices = updated
        .map((t, idx) => ((t.dimension || "reasoning") === dim ? idx : -1))
        .filter((idx) => idx !== -1);

      if (dimIndices.length === 0) continue;

      // Equal share rounded to 2 decimals
      const equalShare = Number((1.0 / dimIndices.length).toFixed(2));
      let runningSum = 0;

      for (let i = 0; i < dimIndices.length; i++) {
        const targetIdx = dimIndices[i];
        if (i === dimIndices.length - 1) {
          // Adjust last item so sum is exactly 1.00
          const remainder = Number((1.0 - runningSum).toFixed(2));
          updated[targetIdx] = { ...updated[targetIdx], weight: remainder };
        } else {
          updated[targetIdx] = { ...updated[targetIdx], weight: equalShare };
          runningSum += equalShare;
        }
      }
    }

    onChange({ skill_tags: updated });
  };

  // Group tags by dimension
  const reasoningTags = tags.filter((t) => (t.dimension || "reasoning") === "reasoning");
  const languageTags = tags.filter((t) => t.dimension === "language");
  const uncategorizedTags = tags.filter((t) => t.dimension !== "reasoning" && t.dimension !== "language");

  const calcSum = (items: QuestionSkillTag[]) =>
    items.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);

  const reasoningSum = calcSum(reasoningTags);
  const languageSum = calcSum(languageTags);

  const isReasoningValid = reasoningTags.length === 0 || Math.abs(reasoningSum - 1.0) <= 0.01;
  const isLanguageValid = languageTags.length === 0 || Math.abs(languageSum - 1.0) <= 0.01;

  const reasoningPrimaryCount = reasoningTags.filter((t) => t.role === "primary").length;
  const languagePrimaryCount = languageTags.filter((t) => t.role === "primary").length;

  return (
    <div className="space-y-6">
      {/* Dimension Weight Sum Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Reasoning Balance */}
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
            isReasoningValid
              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-200"
              : "border-amber-500/40 bg-amber-500/5 text-amber-900 dark:text-amber-200"
          }`}
        >
          <div className="space-y-0.5">
            <span className="font-semibold flex items-center gap-1.5">
              {isReasoningValid ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              )}
              Dimension Raisonnement ({reasoningTags.length})
            </span>
            <p className="text-2xs opacity-80">
              Poids total : <strong>{reasoningSum.toFixed(2)}</strong> / 1.00
              {reasoningPrimaryCount > 1 && " (⚠️ Plusieurs rôles PRIMAIRES)"}
            </p>
          </div>
          <span
            className={`px-2 py-0.5 rounded text-2xs font-mono font-bold ${
              isReasoningValid
                ? "bg-emerald-600/20 text-emerald-700 dark:text-emerald-300"
                : "bg-amber-600/20 text-amber-700 dark:text-amber-300"
            }`}
          >
            {isReasoningValid ? "Équilibré" : "À rééquilibrer"}
          </span>
        </div>

        {/* Language Balance */}
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
            isLanguageValid
              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-200"
              : "border-amber-500/40 bg-amber-500/5 text-amber-900 dark:text-amber-200"
          }`}
        >
          <div className="space-y-0.5">
            <span className="font-semibold flex items-center gap-1.5">
              {isLanguageValid ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              )}
              Dimension Langue ({languageTags.length})
            </span>
            <p className="text-2xs opacity-80">
              Poids total : <strong>{languageSum.toFixed(2)}</strong> / 1.00
              {languagePrimaryCount > 1 && " (⚠️ Plusieurs rôles PRIMAIRES)"}
            </p>
          </div>
          <span
            className={`px-2 py-0.5 rounded text-2xs font-mono font-bold ${
              isLanguageValid
                ? "bg-emerald-600/20 text-emerald-700 dark:text-emerald-300"
                : "bg-amber-600/20 text-amber-700 dark:text-amber-300"
            }`}
          >
            {isLanguageValid ? "Équilibré" : "À rééquilibrer"}
          </span>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-foreground">
            Compétences cibles associées ({tags.length})
          </h3>
          <p className="text-2xs text-muted-foreground">
            Chaque dimension requiert une somme des poids égale à 1.00 (±0.01) et un seul rôle primaire.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tags.length > 1 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAutoBalance}
              disabled={disabled}
              className="h-7 text-xs gap-1"
            >
              <Scale className="h-3.5 w-3.5" /> Équilibrer les poids
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={() => setIsAddOpen(true)}
            disabled={disabled}
            className="h-7 text-xs gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Associer une compétence
          </Button>
        </div>
      </div>

      {/* Skills Tables / Lists */}
      {tags.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-border rounded-xl text-xs text-muted-foreground">
          Aucune compétence de la taxonomie V2 n'est associée.
          <br />
          Cliquez sur "Associer une compétence" pour indexer cet item.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Reasoning Group */}
          {reasoningTags.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2 text-xs font-semibold">
                <span className="text-primary flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" /> Dimension Raisonnement & Compréhension cognitive
                </span>
                <span className="font-mono text-2xs text-muted-foreground">
                  Somme: {reasoningSum.toFixed(2)}
                </span>
              </div>
              <div className="space-y-2">
                {reasoningTags.map((tag) => {
                  const globalIdx = tags.findIndex((t) => t.skill_id === tag.skill_id);
                  return (
                    <SkillTagRow
                      key={tag.skill_id}
                      tag={tag}
                      disabled={disabled}
                      onUpdate={(patch) => handleUpdateTag(globalIdx, patch)}
                      onRemove={() => handleRemoveTag(globalIdx)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Language Group */}
          {languageTags.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2 text-xs font-semibold">
                <span className="text-indigo-500 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" /> Dimension Maîtrise de la langue & Composantes formelles
                </span>
                <span className="font-mono text-2xs text-muted-foreground">
                  Somme: {languageSum.toFixed(2)}
                </span>
              </div>
              <div className="space-y-2">
                {languageTags.map((tag) => {
                  const globalIdx = tags.findIndex((t) => t.skill_id === tag.skill_id);
                  return (
                    <SkillTagRow
                      key={tag.skill_id}
                      tag={tag}
                      disabled={disabled}
                      onUpdate={(patch) => handleUpdateTag(globalIdx, patch)}
                      onRemove={() => handleRemoveTag(globalIdx)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Uncategorized */}
          {uncategorizedTags.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="border-b border-border pb-2 text-xs font-semibold text-muted-foreground">
                Autres compétences
              </div>
              <div className="space-y-2">
                {uncategorizedTags.map((tag) => {
                  const globalIdx = tags.findIndex((t) => t.skill_id === tag.skill_id);
                  return (
                    <SkillTagRow
                      key={tag.skill_id}
                      tag={tag}
                      disabled={disabled}
                      onUpdate={(patch) => handleUpdateTag(globalIdx, patch)}
                      onRemove={() => handleRemoveTag(globalIdx)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Skill Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" />
              Sélectionner une compétence canonique (Taxonomie V2)
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-3 py-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Rechercher par code ou intitulé..."
                value={skillSearch}
                onChange={(e) => setSkillSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <select
              value={filterDimension}
              onChange={(e) => setFilterDimension(e.target.value)}
              className="rounded-md border border-border bg-background p-1.5 text-xs text-foreground"
            >
              <option value="all">Toutes dimensions</option>
              <option value="reasoning">Raisonnement</option>
              <option value="language">Langue</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[350px]">
            {loadingSkills ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                Chargement des compétences...
              </div>
            ) : availableSkills.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                Aucune compétence correspondante.
              </div>
            ) : (
              availableSkills.map((sk) => {
                const alreadyTagged = tags.some((t) => t.skill_id === sk.id);
                return (
                  <div
                    key={sk.id}
                    className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition ${
                      alreadyTagged
                        ? "border-border/50 bg-muted/40 opacity-60 cursor-not-allowed"
                        : "border-border bg-card hover:border-primary/60 cursor-pointer"
                    }`}
                    onClick={() => !alreadyTagged && handleAddSkill(sk)}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground">
                          {sk.code}
                        </span>
                        <span className="font-semibold text-foreground">
                          {sk.name}
                        </span>
                        <span className="text-2xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                          {sk.dimension}
                        </span>
                      </div>
                      {sk.description && (
                        <p className="text-2xs text-muted-foreground line-clamp-1">
                          {sk.description}
                        </p>
                      )}
                    </div>

                    <Button
                      size="sm"
                      variant={alreadyTagged ? "ghost" : "outline"}
                      disabled={alreadyTagged}
                      className="h-6 text-2xs"
                    >
                      {alreadyTagged ? "Déjà associée" : "Sélectionner"}
                    </Button>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setIsAddOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface SkillTagRowProps {
  tag: QuestionSkillTag;
  disabled?: boolean;
  onUpdate: (patch: Partial<QuestionSkillTag>) => void;
  onRemove: () => void;
}

const SkillTagRow: React.FC<SkillTagRowProps> = ({ tag, disabled, onUpdate, onRemove }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 rounded-lg border border-border/80 bg-background text-xs">
      <div className="flex-1 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-primary text-xs">
            {tag.skill_code || tag.skill_id.slice(0, 8)}
          </span>
          <span className="font-medium text-foreground">
            {tag.skill_name || tag.subskill || "Compétence"}
          </span>
          {tag.domain && (
            <span className="text-2xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">
              {tag.domain}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Role: primary / secondary */}
        <div className="flex items-center gap-1.5">
          <label className="text-2xs text-muted-foreground">Rôle :</label>
          <select
            value={tag.role || "primary"}
            onChange={(e) => onUpdate({ role: e.target.value as "primary" | "secondary" })}
            disabled={disabled}
            className="rounded border border-border bg-background p-1 text-2xs text-foreground font-semibold"
          >
            <option value="primary">Primaire (Dominant)</option>
            <option value="secondary">Secondaire (Support)</option>
          </select>
        </div>

        {/* Weight: 0.01 - 1.0 */}
        <div className="flex items-center gap-1.5">
          <label className="text-2xs text-muted-foreground">Poids :</label>
          <Input
            type="number"
            step="0.05"
            min="0.01"
            max="1.0"
            value={tag.weight ?? 1.0}
            onChange={(e) => onUpdate({ weight: parseFloat(e.target.value) || 0 })}
            disabled={disabled}
            className="h-7 w-20 text-xs font-mono"
          />
        </div>

        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="p-1 text-rose-500 hover:text-rose-700 disabled:opacity-30"
          title="Supprimer la compétence"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
