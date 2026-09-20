import React from "react"
import { useNavigate } from "react-router-dom"
import { Sparkles, Compass, ArrowRight, BookOpen } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PracticeRecommendationCard } from "./PracticeRecommendationCard"
import type { PracticeRecommendationItem } from "./types"

export interface RecommendedPracticeSectionProps {
  recommendations: PracticeRecommendationItem[]
  isLoading?: boolean
  onTakeDiagnostic?: () => void
  onExploreClick?: () => void
  onStartAction?: (rec: PracticeRecommendationItem) => void
}

export const RecommendedPracticeSection: React.FC<RecommendedPracticeSectionProps> = ({
  recommendations,
  isLoading = false,
  onTakeDiagnostic,
  onExploreClick,
  onStartAction,
}) => {
  const navigate = useNavigate()

  const handleTakeDiagnostic = () => {
    if (onTakeDiagnostic) {
      onTakeDiagnostic()
    } else {
      navigate("/assessment")
    }
  }

  const handleExplore = () => {
    if (onExploreClick) {
      onExploreClick()
    } else {
      const el = document.getElementById("explore-catalog")
      if (el) {
        el.scrollIntoView({ behavior: "smooth" })
      }
    }
  }

  const primaryRecommendation = recommendations[0]
  const secondaryRecommendations = recommendations.slice(1, 3)

  return (
    <section className="space-y-4" data-testid="recommended-practice-section">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-md bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles className="size-3.5" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
              Recommandé pour vous
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Basé sur vos résultats récents et vos priorités d'apprentissage.
          </p>
        </div>
      </div>

      {/* Empty / Insufficient Data State */}
      {recommendations.length === 0 && !isLoading ? (
        <Card
          data-testid="insufficient-data-card"
          className="border-dashed border-border/80 bg-muted/20"
        >
          <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-1">
                <Compass className="size-5" />
              </div>
              <div className="space-y-1 text-center sm:text-left">
                <h3 className="text-sm sm:text-base font-semibold text-foreground">
                  Personnalisation en cours
                </h3>
                <p className="text-xs text-muted-foreground max-w-lg leading-relaxed">
                  Nous avons besoin de quelques résultats supplémentaires pour personnaliser vos exercices. Complétez votre test diagnostic initial ou explorez librement le catalogue d'exercices.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 shrink-0 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExplore}
                className="w-full sm:w-auto cursor-pointer text-xs"
              >
                <BookOpen className="size-3.5 mr-1.5" />
                <span>Explorer les exercices</span>
              </Button>
              <Button
                size="sm"
                onClick={handleTakeDiagnostic}
                className="w-full sm:w-auto cursor-pointer text-xs font-semibold"
              >
                <span>Passer un diagnostic</span>
                <ArrowRight className="size-3.5 ml-1.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Recommendations Stack: 1 Primary Hero + 2 Secondary Cards */
        <div className="space-y-4">
          {primaryRecommendation && (
            <PracticeRecommendationCard
              recommendation={primaryRecommendation}
              variant="primary"
              onStart={onStartAction}
            />
          )}

          {secondaryRecommendations.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {secondaryRecommendations.map((rec) => (
                <PracticeRecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  variant="secondary"
                  onStart={onStartAction}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
