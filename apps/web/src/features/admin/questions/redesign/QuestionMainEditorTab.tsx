import React from "react";
import { HelpCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QuestionStimulusEditor } from "./QuestionStimulusEditor";
import { QuestionResponseEditor } from "./QuestionResponseEditor";
import { QuestionExplanationEditor } from "./QuestionExplanationEditor";
import type { QuestionItem, QuestionOption, QuestionResponseType } from "../../types";

interface QuestionMainEditorTabProps {
  question: Partial<QuestionItem>;
  onPatch: (patch: Partial<QuestionItem>) => void;
  disabled?: boolean;
}

export const QuestionMainEditorTab: React.FC<QuestionMainEditorTabProps> = ({
  question,
  onPatch,
  disabled = false,
}) => {
  const effectiveType =
    question.response_type ||
    (Array.isArray(question.scoring_payload?.gaps) && question.scoring_payload.gaps.length > 0 ? "gap_fill" : null) ||
    (Array.isArray(question.options) && question.options.some((o) => /^\[\d+\]\s*/.test(o.content)) ? "gap_fill" : null) ||
    (question.question_type === "text_input" ? "gap_fill" : question.question_type) ||
    "single_choice";
  const options = question.options || [];

  const correctSummary = options
    .filter((o) => o.is_correct)
    .map((o) => o.content)
    .join(", ");

  const rawStimulus: any = question.stimulus || {};
  const stimTitle = (question as any).stimulus_title || rawStimulus.title;
  const stimText = question.stimulus_text || rawStimulus.content_text || rawStimulus.content || "";
  const modalityStr = (question as any).modality || rawStimulus.modality || "reading";

  return (
    <div className="space-y-6">
      {/* 1. Document support (Stimulus) */}
      <QuestionStimulusEditor
        stimulusTitle={stimTitle}
        stimulusText={stimText}
        mediaUrl={question.media_url || question.audio_url}
        modality={modalityStr}
        onUpdate={(patch) => {
          const nextText = patch.stimulus_text !== undefined ? patch.stimulus_text : stimText;
          const nextTitle = patch.stimulus_title !== undefined ? patch.stimulus_title : stimTitle;
          onPatch({
            ...patch,
            stimulus_text: nextText,
            stimulus: {
              ...(question.stimulus || {}),
              id: rawStimulus.id,
              title: nextTitle || "",
              content_text: nextText || "",
              content: nextText || "",
              modality: modalityStr,
            } as any,
          });
        }}
        disabled={disabled}
      />

      {/* 2. Prompt Stem & Question Type */}
      <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-border/50 pb-3">
          <HelpCircle className="h-4 w-4 text-primary shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Consigne & Énoncé de la question
            </h3>
            <p className="text-2xs text-muted-foreground">
              Formulez la question posée au candidat de manière claire, concise et sans ambiguïté.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Prompt text (3 cols) */}
          <div className="md:col-span-3 space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">
              Énoncé de la question *
            </Label>
            <Input
              value={question.prompt || ""}
              onChange={(e) => onPatch({ prompt: e.target.value })}
              placeholder="ex: Quel est l'objectif principal de ce message ?"
              disabled={disabled}
              className="text-xs font-medium"
            />
          </div>

          {/* Response Type (1 col) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">
              Format de réponse
            </Label>
            <select
              value={effectiveType}
              onChange={(e) => {
                const newType = e.target.value as QuestionResponseType;
                if (newType === "gap_fill" || newType === "cloze") {
                  const hasGaps = Array.isArray(question.scoring_payload?.gaps) && question.scoring_payload.gaps.length > 0;
                  const defaultGaps = [
                    {
                      gap_id: "1",
                      order_index: 0,
                      cue_text: "",
                      mode: "choices",
                      options: [
                        { content: "", is_correct: true, order_index: 0 },
                        { content: "", is_correct: false, order_index: 1, misconception_type: "contradiction" },
                        { content: "", is_correct: false, order_index: 2, misconception_type: "false_friend" },
                        { content: "", is_correct: false, order_index: 3, misconception_type: "morphosyntax" },
                      ],
                    },
                    {
                      gap_id: "2",
                      order_index: 1,
                      cue_text: "",
                      mode: "choices",
                      options: [
                        { content: "", is_correct: true, order_index: 0 },
                        { content: "", is_correct: false, order_index: 1, misconception_type: "contradiction" },
                        { content: "", is_correct: false, order_index: 2, misconception_type: "literal_interpretation" },
                        { content: "", is_correct: false, order_index: 3, misconception_type: "false_friend" },
                      ],
                    },
                  ];
                  onPatch({
                    response_type: "gap_fill",
                    question_type: "text_input",
                    scoring_payload: hasGaps ? question.scoring_payload : { gaps: defaultGaps },
                  });
                } else if (newType === "single_choice" || newType === "multiple_choice") {
                  onPatch({
                    response_type: newType,
                    question_type: newType,
                  });
                } else {
                  onPatch({
                    response_type: newType,
                    question_type: (newType === "matching" ? "matching" : "text_input") as any,
                  });
                }
              }}
              disabled={disabled}
              className="w-full rounded-md border border-border bg-background p-2 text-xs font-semibold text-foreground"
            >
              <option value="single_choice">Choix unique (QCM 1/4)</option>
              <option value="multiple_choice">Choix multiple</option>
              <option value="matching">Appariement (Paires)</option>
              <option value="ordering">Ordonnancement</option>
              <option value="gap_fill">Texte à trous (Gap fill)</option>
              <option value="short_text">Réponse courte</option>
              <option value="long_text">Production écrite</option>
              <option value="spoken_response">Production orale</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Response Configuration */}
      <QuestionResponseEditor
        questionId={question.id}
        questionPrompt={question.prompt}
        stimulusText={stimText}
        responseType={effectiveType}
        options={options}
        scoringPayload={question.scoring_payload}
        onOptionsChange={(newOptions: QuestionOption[]) => onPatch({ options: newOptions })}
        onScoringPayloadChange={(payload) => onPatch({ scoring_payload: payload })}
        disabled={disabled}
      />

      {/* 4. Didactic Explanation */}
      <QuestionExplanationEditor
        explanation={question.explanation}
        prompt={question.prompt || ""}
        correctAnswersSummary={correctSummary}
        onUpdate={(explanation) => onPatch({ explanation })}
        disabled={disabled}
      />
    </div>
  );
};
