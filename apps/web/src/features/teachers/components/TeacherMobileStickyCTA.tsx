import { Calendar, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { TeacherSummary, TeacherServiceItem } from "../types"

export interface TeacherMobileStickyCTAProps {
  teacher: TeacherSummary
  selectedService?: TeacherServiceItem
  onBookClick: () => void
  disabled?: boolean
}

export function TeacherMobileStickyCTA({
  teacher,
  selectedService,
  onBookClick,
  disabled,
}: TeacherMobileStickyCTAProps) {
  const isCovered = selectedService?.isCoveredByPlan
  const price = ((selectedService?.priceCents || teacher.hourly_price) / 100).toFixed(2)

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border p-3 px-4 flex items-center justify-between gap-4 shadow-lg animate-in slide-in-from-bottom duration-200">
      <div className="space-y-0.5">
        <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block">
          Tarif par session
        </span>
        {isCovered ? (
          <div className="flex items-center gap-1 text-xs font-bold text-primary">
            <Sparkles className="size-3 text-primary" />
            <span>Inclus dans votre forfait</span>
          </div>
        ) : (
          <div className="font-mono font-bold text-foreground text-sm">
            {price} CAD <span className="text-xs font-normal text-muted-foreground">/ 60 min</span>
          </div>
        )}
      </div>

      <Button
        onClick={onBookClick}
        disabled={disabled}
        className="cursor-pointer gap-2 font-semibold text-xs h-10 px-5 shadow-xs shrink-0"
      >
        <Calendar className="size-4" />
        <span>Réserver une session</span>
      </Button>
    </div>
  )
}
