import React from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, Play, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { QuestionItem, QuestionValidationResult, QuestionValidationIssue } from "../types";

interface QualityTabProps {
  question: Partial<QuestionItem>;
  validationResult: QuestionValidationResult | null;
  isValidating: boolean;
  onValidate: () => void;
  onNavigateTab: (tab: string) => void;
  disabled?: boolean;
}

export const QualityTab: React.FC<QualityTabProps> = ({
  question,
  validationResult,
  isValidating,
  onValidate,
  onNavigateTab,
  disabled = false,
}) => {
  const issues = validationResult?.issues || question.validation_issues || [];
  const status = validationResult?.status || question.validation_status || "warning";

  const blockingIssues = issues.filter((i) => i.severity === "blocking");
  const warningIssues = issues.filter((i) => i.severity === "warning");
  const infoIssues = issues.filter((i) => i.severity === "info");

  const getTargetTabForField = (field?: string | null): string => {
    if (!field) return "content";
    if (field.includes("prompt") || field.includes("option") || field.includes("stimulus") || field.includes("media") || field.includes("audio")) {
      return "content";
    }
    if (field.includes("task_type") || field.includes("cefr") || field.includes("level") || field.includes("difficulty") || field.includes("points")) {
      return "profile";
    }
    if (field.includes("skill") || field.includes("dimension") || field.includes("weight") || field.includes("role")) {
      return "skills";
    }
    if (field.includes("provenance") || field.includes("author")) {
      return "provenance";
    }
    return "content";
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Status */}
      <div
        className={`p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
          status === "valid"
            ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-950 dark:text-emerald-100"
            : status === "warning"
            ? "border-amber-500/40 bg-amber-500/5 text-amber-950 dark:text-amber-100"
            : "border-rose-500/40 bg-rose-500/5 text-rose-950 dark:text-rose-100"
        }`}
      >
        <div className="flex items-start gap-3">
          {status === "valid" ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : status === "warning" ? (
            <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-6 w-6 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <h3 className="text-sm font-bold">
              {status === "valid"
                ? "Item 100% conforme aux règles éditoriales et psychométriques"
                : status === "warning"
                ? "Conformité acceptable avec avertissements pédagogiques"
                : "Non conforme — Problèmes bloquants détectés"}
            </h3>
            <p className="text-xs opacity-90">
              {blockingIssues.length} bloquant(s) • {warningIssues.length} avertissement(s) • {infoIssues.length} recommandation(s).
              {validationResult?.checked_at && (
                <span className="ml-1 opacity-75 font-mono text-2xs">
                  (Dernier contrôle : {new Date(validationResult.checked_at).toLocaleTimeString()})
                </span>
              )}
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={onValidate}
          disabled={disabled || isValidating}
          className="gap-1.5 shrink-0 text-xs font-semibold shadow-xs"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          {isValidating ? "Contrôle en cours..." : "Lancer le contrôle de conformité"}
        </Button>
      </div>

      {/* Rules Engine Notice */}
      <div className="p-3.5 rounded-lg border border-border bg-card text-2xs text-muted-foreground flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
        <span>
          Le moteur <code>QuestionValidationEngine</code> vérifie en temps réel les contraintes d'unicité des clés,
          la présence d'une réponse exacte, la validité des distracteurs, l'équilibre des dimensions de compétences et l'intégrité du barème.
        </span>
      </div>

      {/* Issues Breakdown */}
      {issues.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-xl text-xs text-muted-foreground space-y-2">
          <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
          <div className="font-semibold text-foreground">Aucune anomalie détectée</div>
          <p className="text-2xs text-muted-foreground">
            Toutes les règles de validation sont respectées. Cet item est prêt pour soumission ou publication.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Blocking */}
          {blockingIssues.length > 0 && (
            <div className="rounded-xl border border-rose-500/30 bg-card p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-4 w-4" />
                Problèmes bloquants ({blockingIssues.length}) — Publication impossible
              </div>
              <div className="space-y-2">
                {blockingIssues.map((issue, idx) => (
                  <IssueRow
                    key={idx}
                    issue={issue}
                    onNavigate={() => onNavigateTab(getTargetTabForField(issue.field))}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {warningIssues.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-card p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                Avertissements pédagogiques ({warningIssues.length})
              </div>
              <div className="space-y-2">
                {warningIssues.map((issue, idx) => (
                  <IssueRow
                    key={idx}
                    issue={issue}
                    onNavigate={() => onNavigateTab(getTargetTabForField(issue.field))}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Info */}
          {infoIssues.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                <Info className="h-4 w-4 text-sky-500" />
                Recommandations & Métadonnées ({infoIssues.length})
              </div>
              <div className="space-y-2">
                {infoIssues.map((issue, idx) => (
                  <IssueRow
                    key={idx}
                    issue={issue}
                    onNavigate={() => onNavigateTab(getTargetTabForField(issue.field))}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface IssueRowProps {
  issue: QuestionValidationIssue;
  onNavigate: () => void;
}

const IssueRow: React.FC<IssueRowProps> = ({ issue, onNavigate }) => {
  return (
    <div className="p-2.5 rounded-lg border border-border/80 bg-background flex items-center justify-between gap-3 text-xs">
      <div className="space-y-0.5 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-2xs font-bold px-1.5 py-0.5 rounded bg-muted text-foreground">
            {issue.code}
          </span>
          {issue.field && (
            <span className="font-mono text-2xs text-muted-foreground">
              champ: <code>{issue.field}</code>
            </span>
          )}
        </div>
        <p className="text-foreground text-xs">{issue.message}</p>
      </div>

      <Button
        size="sm"
        variant="ghost"
        onClick={onNavigate}
        className="h-7 text-2xs gap-1 text-primary hover:text-primary shrink-0"
      >
        Corriger <ArrowRight className="h-3 w-3" />
      </Button>
    </div>
  );
};
