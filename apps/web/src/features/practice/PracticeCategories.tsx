import React from "react"
import {
  BookOpen,
  Headphones,
  PenTool,
  Mic,
  Dumbbell,
  Bookmark,
  GraduationCap,
  Layers,
} from "lucide-react"
import { PracticeCategoryCard } from "./PracticeCategoryCard"
import type { PracticeCategoryItem } from "./types"

export const CANONICAL_CATEGORIES: PracticeCategoryItem[] = [
  {
    id: "reading",
    label: "Compréhension écrite",
    description: "Lecture critique, repérage et inférences sur textes informatifs et éditoriaux.",
    icon: BookOpen,
  },
  {
    id: "listening",
    label: "Compréhension orale",
    description: "Dialogues de la vie courante, annonces publiques et chroniques radio.",
    icon: Headphones,
  },
  {
    id: "writing",
    label: "Expression écrite",
    description: "Fait divers journalistique et lettre formelle d'argumentation Section B.",
    icon: PenTool,
  },
  {
    id: "speaking",
    label: "Expression orale",
    description: "Présentation de document, négociation et argumentation persuasive.",
    icon: Mic,
  },
  {
    id: "grammar",
    label: "Grammaire",
    description: "Pronoms relatifs complexes, concordance des temps et structures avancées.",
    icon: Dumbbell,
  },
  {
    id: "vocabulary",
    label: "Vocabulaire",
    description: "Lexique soutenu, connecteurs logiques, nuances et collocations du TEF.",
    icon: Bookmark,
  },
  {
    id: "conjugation",
    label: "Conjugaison",
    description: "Modes subjonctif, conditionnel, participes et concordances formelles.",
    icon: GraduationCap,
  },
]

export interface PracticeCategoriesProps {
  activeCategory?: string
  onSelectCategory: (categoryId: string) => void
  exerciseCounts?: Record<string, number>
}

export const PracticeCategories: React.FC<PracticeCategoriesProps> = ({
  activeCategory = "all",
  onSelectCategory,
  exerciseCounts,
}) => {
  const handleSelect = (categoryId: string) => {
    onSelectCategory(categoryId)
    const el = document.getElementById("explore-catalog")
    if (el) {
      el.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <section className="space-y-3" data-testid="practice-categories-section">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-md bg-primary/10 flex items-center justify-center text-primary">
              <Layers className="size-3.5" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
              Catégories de pratique
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Accédez directement à une modalité pour travailler vos compétences fondamentales.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
        {CANONICAL_CATEGORIES.map((cat) => (
          <PracticeCategoryCard
            key={cat.id}
            category={{
              ...cat,
              count: exerciseCounts ? exerciseCounts[cat.id] : undefined,
            }}
            isActive={activeCategory === cat.id}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </section>
  )
}
