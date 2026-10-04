import React, { useState } from "react";
import { BookOpen, FileText, Music, Link2, X, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StimulusDialog } from "./StimulusDialog";
import { OptionEditor } from "./OptionEditor";
import { MatchingEditor } from "./MatchingEditor";
import { OrderingEditor } from "./OrderingEditor";
import { GapFillEditor } from "./GapFillEditor";
import { ShortTextEditor } from "./ShortTextEditor";
import { StimulusRenderer } from "./components/StimulusRenderer";
import type { QuestionItem, QuestionOption, AdminStimulus } from "../types";

interface ContentTabProps {
  question: Partial<QuestionItem>;
  onChange: (patch: Partial<QuestionItem>) => void;
  disabled?: boolean;
}

export const ContentTab: React.FC<ContentTabProps> = ({
  question,
  onChange,
  disabled = false,
}) => {
  const [isStimulusDialogOpen, setIsStimulusDialogOpen] = useState(false);
  const [showStimulusPreview, setShowStimulusPreview] = useState(true);

  const handleStimulusSelect = (stim: AdminStimulus) => {
    onChange({
      stimulus_id: stim.id,
      stimulus: stim,
      stimulus_text: stim.content,
    });
  };

  const handleDetachStimulus = () => {
    onChange({
      stimulus_id: null,
      stimulus: null,
      stimulus_text: null,
    });
  };

  const qType = question.question_type || "single_choice";

  return (
    <div className="space-y-6">
      {/* Stimulus Panel */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-semibold text-foreground">
              Document support (Stimulus textuel ou sonore)
            </h3>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setIsStimulusDialogOpen(true)}
            disabled={disabled}
            className="h-7 text-xs gap-1.5"
          >
            <Link2 className="h-3.5 w-3.5" />
            {question.stimulus_id ? "Changer de stimulus" : "Associer un stimulus"}
          </Button>
        </div>

        {question.stimulus_id && question.stimulus ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs bg-muted/30 p-2.5 rounded-lg border border-border">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-foreground truncate">{question.stimulus.title}</span>
                {question.stimulus.cefr_level && (
                  <span className="text-2xs uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-bold shrink-0">
                    {question.stimulus.cefr_level}
                  </span>
                )}
                {question.stimulus.source_attribution && (
                  <span className="text-2xs text-muted-foreground hidden md:inline truncate">
                    — {question.stimulus.source_attribution}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowStimulusPreview((prev) => !prev)}
                  className="h-6 px-2 text-2xs gap-1 text-muted-foreground"
                >
                  {showStimulusPreview ? (
                    <>
                      <EyeOff className="h-3 w-3" /> Masquer
                    </>
                  ) : (
                    <>
                      <Eye className="h-3 w-3" /> Aperçu
                    </>
                  )}
                </Button>
                <button
                  type="button"
                  onClick={handleDetachStimulus}
                  disabled={disabled}
                  className="p-1 text-muted-foreground hover:text-rose-500 transition rounded"
                  title="Détacher le stimulus"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {showStimulusPreview && (
              <StimulusRenderer
                title={question.stimulus.title}
                content={question.stimulus.content}
                modality={question.stimulus.modality || question.task_type?.modality || "reading"}
                textFormat={question.stimulus.text_format}
                sourceCitation={question.stimulus.source_attribution}
                cefrLevel={question.stimulus.cefr_level}
                wordCount={question.stimulus.word_count}
                viewMode="compact"
                enableExpandModal={true}
              />
            )}
          </div>
        ) : (
          <div className="text-2xs text-muted-foreground border border-dashed border-border rounded-lg p-3 text-center">
            Aucun stimulus associé. Les questions d'épreuve TEF de lecture ou écoute s'appuient généralement sur un texte ou enregistrement partagé.
          </div>
        )}
      </div>

      {/* Main Prompt & Audio Panel */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-4">
        <div>
          <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
            <FileText className="h-4 w-4 text-primary" />
            Énoncé de la question (Prompt) *
          </Label>
          <Textarea
            rows={3}
            required
            value={question.prompt || ""}
            onChange={(e) => onChange({ prompt: e.target.value })}
            placeholder="Écrivez ici la question posée au candidat (ex. Quel est l'objectif principal de ce message ?)..."
            disabled={disabled}
            className="text-xs"
          />
        </div>

        <div>
          <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
            <Music className="h-4 w-4 text-primary" />
            URL de la ressource audio ou média (Optionnel)
          </Label>
          <div className="flex gap-2">
            <Input
              value={question.audio_url || question.media_url || ""}
              onChange={(e) => onChange({ audio_url: e.target.value, media_url: e.target.value })}
              placeholder="https://storage.tef.com/audio/exam-b2-item-42.mp3"
              disabled={disabled}
              className="h-8 text-xs flex-1"
            />
          </div>
          {(question.audio_url || question.media_url) && (
            <div className="mt-2 pt-2 border-t border-border">
              <audio
                controls
                src={question.audio_url || question.media_url || ""}
                className="w-full h-8"
              >
                Votre navigateur ne supporte pas l'élément audio.
              </audio>
            </div>
          )}
        </div>

        <div>
          <Label className="text-xs font-semibold text-foreground mb-1.5 block">
            Explication didactique globale
          </Label>
          <Textarea
            rows={2}
            value={question.explanation || ""}
            onChange={(e) => onChange({ explanation: e.target.value })}
            placeholder="Explication globale de la résolution de l'item..."
            disabled={disabled}
            className="text-xs"
          />
        </div>
      </div>

      {/* Dynamic Response-Type Editor */}
      <div className="p-4 rounded-xl border border-border bg-card">
        {qType === "single_choice" || qType === "multiple_choice" ? (
          <OptionEditor
            options={question.options || []}
            onChange={(nextOptions: QuestionOption[]) => onChange({ options: nextOptions })}
            responseType={qType}
            disabled={disabled}
          />
        ) : qType === "matching" ? (
          <MatchingEditor
            metadata={question.response_metadata || {}}
            onChange={(meta) => onChange({ response_metadata: meta })}
            disabled={disabled}
          />
        ) : qType === "ordering" ? (
          <OrderingEditor
            metadata={question.response_metadata || {}}
            onChange={(meta) => onChange({ response_metadata: meta })}
            disabled={disabled}
          />
        ) : qType === "gap_fill" || qType === "cloze" ? (
          <GapFillEditor
            metadata={question.response_metadata || {}}
            onChange={(meta) => onChange({ response_metadata: meta })}
            disabled={disabled}
          />
        ) : qType === "short_text" || qType === "text_input" ? (
          <ShortTextEditor
            metadata={question.response_metadata || {}}
            onChange={(meta) => onChange({ response_metadata: meta })}
            disabled={disabled}
          />
        ) : (
          <div className="p-4 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground space-y-2">
            <h4 className="font-semibold text-foreground">Évaluation ouverte ({qType})</h4>
            <p>
              Ce type de question implique une production libre (écrite ou orale) évaluée par grille critériée ou enseignant.
              Configurez les consignes ci-dessus et associez les compétences cibles dans l'onglet "Compétences".
            </p>
          </div>
        )}
      </div>

      <StimulusDialog
        open={isStimulusDialogOpen}
        onOpenChange={setIsStimulusDialogOpen}
        onSelectStimulus={handleStimulusSelect}
        currentStimulusId={question.stimulus_id}
        defaultModality={(question.task_type?.modality as any) || "reading"}
      />
    </div>
  );
};
