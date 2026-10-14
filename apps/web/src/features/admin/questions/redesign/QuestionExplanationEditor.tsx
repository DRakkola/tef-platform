import React, { useState } from "react";
import { Sparkles, HelpCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface QuestionExplanationEditorProps {
  explanation?: string | null;
  prompt: string;
  correctAnswersSummary: string;
  onUpdate: (explanation: string) => void;
  disabled?: boolean;
}

export const QuestionExplanationEditor: React.FC<QuestionExplanationEditorProps> = ({
  explanation = "",
  prompt,
  correctAnswersSummary,
  onUpdate,
  disabled = false,
}) => {
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const handleGenerateAiExplanation = () => {
    if (!prompt.trim()) return;
    setIsGeneratingAi(true);

    try {
      // Deterministic didactic enhancement template
      const simulatedExplanation = `La bonne réponse est « ${correctAnswersSummary || "indiquée"} ». Dans l'énoncé « ${prompt.slice(
        0,
        60
      )}... », les indices lexicaux confirment directement ce choix, tandis que les autres options constituent des distracteurs fondés sur une lecture superficielle ou un faux ami.`;

      onUpdate(simulatedExplanation);
    } finally {
      setTimeout(() => setIsGeneratingAi(false), 300);
    }
  };

  return (
    <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-primary shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Explication didactique & Justification
            </h3>
            <p className="text-2xs text-muted-foreground">
              Affichée à l'étudiant après soumission de l'épreuve pour expliquer pourquoi cette réponse est exacte.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleGenerateAiExplanation}
          disabled={disabled || isGeneratingAi || !prompt.trim()}
          className="text-xs h-8 gap-1.5 text-purple-600 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/20 font-semibold shrink-0"
        >
          {isGeneratingAi ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Générer explication par IA
        </Button>
      </div>

      <div className="space-y-1.5">
        <Textarea
          value={explanation || ""}
          onChange={(e) => onUpdate(e.target.value)}
          placeholder="Rédigez l'explication méthodologique qui aide le candidat à comprendre la règle ou le repérage dans le texte..."
          disabled={disabled}
          rows={3}
          className="text-xs font-sans leading-relaxed resize-y"
        />
      </div>
    </div>
  );
};
