import {
  Shield,
  GraduationCap,
  FileText,
  PenTool,
  Mic,
  Headphones,
  Users,
  CreditCard,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { HelpCategory } from "../types";

interface HelpCategoriesGridProps {
  categories: HelpCategory[];
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Shield,
  GraduationCap,
  FileText,
  PenTool,
  Mic,
  Headphones,
  Users,
  CreditCard,
  Lock,
};

export const HelpCategoriesGrid: React.FC<HelpCategoriesGridProps> = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
          Thématiques d'assistance
        </h2>
        {selectedCategoryId && (
          <button
            type="button"
            onClick={() => onSelectCategory(null)}
            className="text-xs font-medium text-primary hover:underline"
          >
            Afficher toutes les thématiques
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {categories.map((cat) => {
          const Icon = ICON_MAP[cat.icon] || FileText;
          const isSelected = selectedCategoryId === cat.id;

          return (
            <Card
              key={cat.id}
              onClick={() => onSelectCategory(isSelected ? null : cat.id)}
              className={`cursor-pointer transition-all duration-150 p-4 border rounded-xl flex flex-col justify-between gap-3 ${
                isSelected
                  ? "border-primary bg-primary/5 dark:bg-primary/10 ring-1 ring-primary/30 shadow-xs"
                  : "border-border/80 bg-card hover:border-primary/40 hover:shadow-xs"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  <Icon className="size-4" />
                </div>
                <Badge variant="secondary" className="text-[10px] font-normal shrink-0">
                  {cat.articleCount} article{cat.articleCount > 1 ? "s" : ""}
                </Badge>
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">
                  {cat.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {cat.description}
                </p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
