import React from "react";

interface ScepticismSliderProps {
  value: number;
  onChange: (value: number) => void;
  section: string;
}

export const ScepticismSlider: React.FC<ScepticismSliderProps> = ({ value, onChange, section }) => {
  return (
    <div className="space-y-2 p-3.5 bg-muted/40 rounded-xl border border-border">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">
          Niveau de Scepticisme & Contradiction
        </span>
        <span className="text-xs font-mono font-bold text-primary">
          {Math.round(value * 100)}%
        </span>
      </div>
      <input
        type="range"
        min="0.0"
        max="1.0"
        step="0.05"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-primary cursor-pointer"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
        <span>0% Bienveillant</span>
        <span>50% Équilibré</span>
        <span>100% Réfractaire</span>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {section === "section_a"
          ? "En Section A, un scepticisme modéré (20-30%) garantit des réponses formelles précises sans blocage."
          : "En Section B, un scepticisme élevé (60-75%) simule un ami réticent et force le candidat à déployer ses arguments."}
      </p>
    </div>
  );
};
