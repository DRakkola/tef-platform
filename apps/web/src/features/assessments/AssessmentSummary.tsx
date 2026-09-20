import React from "react"
import { Award, Clock, Layers, HelpCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { AssessmentDetail } from "./types"

export interface AssessmentSummaryProps {
  assessment: AssessmentDetail
  totalQuestions: number
}

export const AssessmentSummary: React.FC<AssessmentSummaryProps> = ({
  assessment,
  totalQuestions,
}) => {
  const durationMins =
    assessment.estimated_completion_time_minutes ||
    Math.round(assessment.duration_seconds / 60)

  const sectionCount = assessment.sections ? assessment.sections.length : 0

  return (
    <Card
      data-testid="assessment-summary-card"
      className="border-border/80 bg-card/60 backdrop-blur-xs shadow-2xs"
    >
      <CardContent className="p-4 sm:p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-border/60">
          {/* Level */}
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Award className="size-3.5 text-primary" />
              <span>Niveau visé</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl font-bold font-mono text-foreground">
                {assessment.level || "B2"}
              </span>
              <Badge variant="outline" size="sm" className="text-[10px] font-mono">
                TEF Canada
              </Badge>
            </div>
          </div>

          {/* Duration */}
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left space-y-1 pt-3 sm:pt-0 sm:pl-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Clock className="size-3.5 text-primary" />
              <span>Temps imparti</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold font-mono text-foreground">
                {durationMins}
              </span>
              <span className="text-xs text-muted-foreground font-medium">minutes</span>
            </div>
          </div>

          {/* Question Count */}
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left space-y-1 pt-3 sm:pt-0 sm:pl-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <HelpCircle className="size-3.5 text-primary" />
              <span>Questions</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold font-mono text-foreground">
                {totalQuestions}
              </span>
              <span className="text-xs text-muted-foreground font-medium">items</span>
            </div>
          </div>

          {/* Section Count */}
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left space-y-1 pt-3 sm:pt-0 sm:pl-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Layers className="size-3.5 text-primary" />
              <span>Sections</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold font-mono text-foreground">
                {sectionCount}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                partie{sectionCount > 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
