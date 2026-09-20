import React from "react"
import { BookOpen, Headphones, Layers, Clock, HelpCircle } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { AssessmentSectionStudent, AssessmentType } from "./types"

export interface AssessmentSectionsProps {
  sections: AssessmentSectionStudent[]
  assessmentType: AssessmentType
}

export const AssessmentSections: React.FC<AssessmentSectionsProps> = ({
  sections,
  assessmentType,
}) => {
  if (!sections || sections.length === 0) return null

  return (
    <Card className="border-border/80 bg-card shadow-2xs">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base sm:text-lg font-bold text-foreground">
            Structure de l'épreuve
          </CardTitle>
          <Badge variant="outline" size="sm" className="font-mono text-xs">
            {sections.length} section{sections.length > 1 ? "s" : ""}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {sections.map((section, idx) => {
          const isListening =
            assessmentType === "listening" ||
            section.title.toLowerCase().includes("orale") ||
            section.title.toLowerCase().includes("audio")
          const isReading =
            assessmentType === "reading" ||
            section.title.toLowerCase().includes("écrite") ||
            section.title.toLowerCase().includes("lecture")

          const SectionIcon = isListening ? Headphones : isReading ? BookOpen : Layers
          const qCount = section.questions ? section.questions.length : 0
          const durationMins = section.duration_seconds
            ? Math.round(section.duration_seconds / 60)
            : null

          return (
            <div
              key={section.id || idx}
              data-testid={`assessment-section-${idx}`}
              className="p-4 rounded-xl bg-muted/20 border border-border/60 hover:border-primary/30 transition-colors space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-lg bg-background border border-border/80 text-foreground flex items-center justify-center shrink-0">
                    <SectionIcon className="size-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      {section.title}
                    </h4>
                    {section.instructions && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {section.instructions}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {qCount > 0 && (
                    <Badge variant="secondary" size="sm" className="font-mono text-[11px] gap-1">
                      <HelpCircle className="size-3" />
                      <span>{qCount} question{qCount > 1 ? "s" : ""}</span>
                    </Badge>
                  )}
                  {durationMins && (
                    <Badge variant="outline" size="sm" className="font-mono text-[11px] gap-1">
                      <Clock className="size-3" />
                      <span>{durationMins} min</span>
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
