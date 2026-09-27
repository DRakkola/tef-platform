import React from "react";

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  allowedTypes?: "all" | "text" | "live";
  className?: string;
  label?: string;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  value,
  onChange,
  allowedTypes = "all",
  className = "",
  label = "Modèle LLM Gemini",
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && <label className="block text-xs font-semibold text-foreground">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-xs bg-background border border-border rounded-xl p-2.5 font-medium text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
      >
        {(allowedTypes === "all" || allowedTypes === "live") && (
          <option value="models/gemini-3.8-live">
            Gemini 3.8 Live (Audio bidirectionnel faible latence)
          </option>
        )}
        {(allowedTypes === "all" || allowedTypes === "text") && (
          <>
            <option value="models/gemini-3.5-flash">
              Gemini 3.5 Flash (Rapide, économique, recommandé évaluation)
            </option>
            <option value="models/gemini-3.5-pro">
              Gemini 3.5 Pro (Raisonnement avancé, analyse nuancée)
            </option>
          </>
        )}
      </select>
    </div>
  );
};
