import React from "react";
import { X, CheckCircle2, BookOpen, Music, Tag, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { QuestionItem } from "../types";

interface QuestionQuickPreviewModalProps {
  question: QuestionItem | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (q: QuestionItem) => void;
}

export const QuestionQuickPreviewModal: React.FC<QuestionQuickPreviewModalProps> = ({
  question,
  isOpen,
  onClose,
  onEdit,
}) => {
  if (!isOpen || !question) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-mono text-2xs px-2 py-0.5 rounded bg-muted font-bold text-foreground">
              v{question.version}
            </span>
            <span className="text-2xs font-bold uppercase px-2 py-0.5 rounded bg-primary/10 text-primary">
              {question.target_cefr || question.level}
            </span>
            <span className="text-2xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
              Diff: {question.difficulty}/5
            </span>
            <span className="text-2xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
              {question.points} pt{question.points > 1 ? "s" : ""}
            </span>
            <span className="text-2xs font-mono text-muted-foreground">
              #{question.id.slice(0, 8)}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* Linked Stimulus / Document */}
          {question.stimulus && (
            <div className="p-4 rounded-xl border border-border/80 bg-muted/10 space-y-2.5">
              <div className="flex items-center gap-2 text-primary font-semibold text-2xs uppercase tracking-wider">
                <BookOpen className="h-3.5 w-3.5" />
                Document support — {question.stimulus.title}
              </div>

              {question.stimulus.content && (
                <div className="text-foreground/90 leading-relaxed font-sans text-xs whitespace-pre-wrap bg-card p-3 rounded-lg border border-border/60">
                  {question.stimulus.content}
                </div>
              )}

              {question.stimulus.media_url && (
                <div className="pt-2">
                  <audio controls src={question.stimulus.media_url} className="h-8 w-full max-w-md" />
                </div>
              )}
            </div>
          )}

          {/* Question Media */}
          {question.media_url && !question.stimulus?.media_url && (
            <div className="p-3 rounded-xl border border-border bg-muted/10 space-y-2">
              <div className="flex items-center gap-1.5 text-2xs font-semibold text-primary">
                <Music className="h-3.5 w-3.5" /> Audio de la question
              </div>
              <audio controls src={question.media_url} className="h-8 w-full max-w-md" />
            </div>
          )}

          {/* Question Prompt */}
          <div className="space-y-1.5">
            <div className="text-2xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5" /> Énoncé
            </div>
            <div className="text-sm font-semibold text-foreground leading-snug">
              {question.prompt}
            </div>
          </div>

          {/* Options */}
          {question.options && question.options.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                Options de réponse ({question.options.length})
              </div>
              <div className="grid grid-cols-1 gap-2">
                {question.options.map((opt, i) => (
                  <div
                    key={opt.id || i}
                    className={`p-3 rounded-xl border flex items-start justify-between gap-3 transition ${
                      opt.is_correct
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100"
                        : "bg-card border-border text-foreground"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="font-mono text-2xs font-bold px-1.5 py-0.5 rounded bg-muted/80 text-muted-foreground">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <div>
                        <div className="font-medium">{opt.content}</div>
                        {opt.explanation && (
                          <div className="text-2xs text-muted-foreground mt-1 italic">
                            {opt.explanation}
                          </div>
                        )}
                      </div>
                    </div>

                    {opt.is_correct && (
                      <span className="flex items-center gap-1 text-2xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                        <CheckCircle2 className="h-4 w-4" /> Correcte
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Explanation */}
          {question.explanation && (
            <div className="p-3 rounded-xl border border-border bg-muted/15 space-y-1">
              <span className="font-semibold text-2xs text-foreground block">
                Explication pédagogique :
              </span>
              <p className="text-muted-foreground leading-relaxed">
                {question.explanation}
              </p>
            </div>
          )}

          {/* Skill Tags */}
          {question.skill_tags && question.skill_tags.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="text-2xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Tag className="h-3 w-3" /> Compétences associées
              </div>
              <div className="flex flex-wrap gap-1.5">
                {question.skill_tags.map((tag, i) => (
                  <span
                    key={tag.id || i}
                    className="px-2 py-1 rounded-md bg-muted text-muted-foreground text-2xs border border-border flex items-center gap-1.5"
                  >
                    <span className="font-mono font-bold text-foreground">
                      {tag.skill_code || tag.skill_id?.slice(0, 8) || "Skill"}
                    </span>
                    <span>({Math.round((tag.weight || 0) * 100)}%)</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-muted/10 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={onClose}>
            Fermer
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onClose();
              onEdit(question);
            }}
            className="gap-1.5"
          >
            Ouvrir dans l'atelier complet
          </Button>
        </div>
      </div>
    </div>
  );
};
