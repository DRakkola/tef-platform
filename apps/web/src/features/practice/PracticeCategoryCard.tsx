import React from "react"
import { ArrowRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { PracticeCategoryItem } from "./types"

export interface PracticeCategoryCardProps {
  category: PracticeCategoryItem
  isActive?: boolean
  onSelect: (categoryId: string) => void
}

export const PracticeCategoryCard: React.FC<PracticeCategoryCardProps> = ({
  category,
  isActive = false,
  onSelect,
}) => {
  const Icon = category.icon

  return (
    <Card
      data-testid={`category-card-${category.id}`}
      onClick={() => onSelect(category.id)}
      className={`group cursor-pointer transition-all duration-200 border text-left ${
        isActive
          ? "border-primary bg-primary/5 shadow-xs"
          : "border-border/70 bg-card hover:border-primary/40 hover:shadow-2xs"
      }`}
    >
      <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div
            className={`size-9 rounded-xl flex items-center justify-center transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
            }`}
          >
            <Icon className="size-4.5" />
          </div>

          <span
            className={`text-xs font-semibold flex items-center gap-1 transition-colors ${
              isActive
                ? "text-primary font-bold"
                : "text-muted-foreground group-hover:text-primary"
            }`}
          >
            <span>Explorer</span>
            <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
              {category.label}
            </h4>
            {category.count !== undefined && (
              <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                {category.count}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {category.description}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
