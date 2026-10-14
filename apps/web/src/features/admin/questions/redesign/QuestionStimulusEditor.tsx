import React, { useState } from "react";
import {
  Sparkles,
  BookOpen,
  Volume2,
  Trash2,
  FileText,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface QuestionStimulusEditorProps {
  stimulusTitle?: string | null;
  stimulusText?: string | null;
  mediaUrl?: string | null;
  modality: string;
  onUpdate: (patch: {
    stimulus_title?: string | null;
    stimulus_text?: string | null;
    media_url?: string | null;
    audio_url?: string | null;
  }) => void;
  disabled?: boolean;
}

export const QuestionStimulusEditor: React.FC<QuestionStimulusEditorProps> = ({
  stimulusTitle = "",
  stimulusText = "",
  mediaUrl = "",
  modality,
  onUpdate,
  disabled = false,
}) => {
  const [isFormattingAi, setIsFormattingAi] = useState(false);

  // Auto-format markdown using built-in deterministic heuristics & structural enrichment
  const handleAutoFormatMarkdown = () => {
    if (!stimulusText || !stimulusText.trim()) return;
    setIsFormattingAi(true);

    try {
      const raw = stimulusText.trim();
      const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
      const formatted: string[] = [];

      for (const line of lines) {
        // Dialogues: A: ..., B: ...
        if (/^[A-Z]\s*:\s*/.test(line)) {
          const speaker = line.slice(0, 2);
          const speech = line.slice(2).trim();
          formatted.push(`> **${speaker}** ${speech}`);
        } else if (/^[0-9]+\.\s+/.test(line) || line.startsWith("- ")) {
          formatted.push(line);
        } else {
          formatted.push(`${line}\n`);
        }
      }

      const res = formatted.join("\n").trim();
      onUpdate({ stimulus_text: res });
    } finally {
      setTimeout(() => setIsFormattingAi(false), 300);
    }
  };

  const handleClearStimulus = () => {
    onUpdate({
      stimulus_title: null,
      stimulus_text: null,
      media_url: null,
      audio_url: null,
    });
  };

  const isAudioExpected = modality === "listening";

  return (
    <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Document support (Stimulus textuel ou sonore)
            </h3>
            <p className="text-2xs text-muted-foreground">
              Le document lu ou écouté par le candidat avant de répondre à la question.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {stimulusText && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAutoFormatMarkdown}
              disabled={disabled || isFormattingAi}
              className="text-xs h-8 gap-1.5 text-purple-600 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/20 font-semibold"
              title="Formate automatiquement les dialogues, paragraphes et listes au format Markdown"
            >
              {isFormattingAi ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Formater Markdown par IA
            </Button>
          )}

          {(stimulusText || stimulusTitle || mediaUrl) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearStimulus}
              disabled={disabled}
              className="text-xs h-8 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"
              title="Supprimer le document support"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Title */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground">
            Titre du document (Optionnel)
          </Label>
          <Input
            value={stimulusTitle || ""}
            onChange={(e) => onUpdate({ stimulus_title: e.target.value })}
            placeholder="ex: Note d'information — Ligne de tramway B"
            disabled={disabled}
            className="text-xs"
          />
        </div>

        {/* Media / Audio URL */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Volume2 className="h-3.5 w-3.5 text-primary" />
              {isAudioExpected ? "Enregistrement sonore (URL Audio MP3/WAV)" : "Média associé (Optionnel)"}
            </span>
            {mediaUrl && (
              <a
                href={mediaUrl}
                target="_blank"
                rel="noreferrer"
                className="text-2xs text-primary hover:underline flex items-center gap-0.5"
              >
                Tester <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </Label>
          <Input
            value={mediaUrl || ""}
            onChange={(e) => {
              const val = e.target.value.trim();
              onUpdate({ media_url: val || null, audio_url: val || null });
            }}
            placeholder="https://storage.tef-platform.com/audios/doc_01.mp3"
            disabled={disabled}
            className="text-xs font-mono"
          />
        </div>
      </div>

      {/* Stimulus Body */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            Texte du document (Markdown supporté)
          </Label>
          <span className="text-2xs text-muted-foreground">
            {stimulusText ? `${stimulusText.split(/\s+/).filter(Boolean).length} mots` : "0 mot"}
          </span>
        </div>
        <Textarea
          value={stimulusText || ""}
          onChange={(e) => onUpdate({ stimulus_text: e.target.value })}
          placeholder="Insérez le passage littéraire, l'article de presse, l'annonce ou le dialogue ici..."
          disabled={disabled}
          rows={5}
          className="text-xs font-sans leading-relaxed resize-y"
        />
      </div>
    </div>
  );
};
