import { Search, X } from "lucide-react"

export interface TeacherSearchProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  className?: string
}

export function TeacherSearch({
  value,
  onChange,
  placeholder = "Rechercher par nom ou spécialité...",
  className,
}: TeacherSearchProps) {
  return (
    <div className={`relative flex items-center w-full ${className || ""}`}>
      <Search className="absolute left-3.5 size-4 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        role="searchbox"
        aria-label="Recherche de professeurs"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 pl-9 pr-9 text-xs sm:text-sm bg-card border border-border/80 rounded-xl placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors shadow-2xs"
      />
      {value && (
        <button
          type="button"
          aria-label="Effacer la recherche"
          onClick={() => onChange("")}
          className="absolute right-3 size-4 text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-center rounded-sm"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
