import React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface HelpSearchHeaderProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}

export const HelpSearchHeader: React.FC<HelpSearchHeaderProps> = ({
  value,
  onChange,
  onClear,
}) => {
  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="relative flex items-center">
        <Search className="absolute left-3.5 size-4 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Rechercher dans l'aide (ex. annulation, NCLC, chronomètre)..."
          className="pl-10 pr-10 h-11 text-sm bg-card border-border/80 shadow-2xs rounded-xl focus-visible:ring-primary/20"
          aria-label="Rechercher dans l'aide"
        />
        {value && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
            aria-label="Effacer la recherche"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
};
