import React from "react"
import { CheckCircle2, Clock, Sparkles, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { TeacherServiceItem } from "../types"

export interface BookingServiceSelectionProps {
  services: TeacherServiceItem[]
  selectedServiceId: string
  onSelectService: (serviceId: string) => void
  onContinue: () => void
}

export const BookingServiceSelection: React.FC<BookingServiceSelectionProps> = ({
  services,
  selectedServiceId,
  onSelectService,
  onContinue,
}) => {
  const formatPrice = (cents: number) => {
    return `${(cents / 100).toFixed(2)} CAD`
  }

  return (
    <section aria-labelledby="service-selection-heading" className="space-y-4">
      <div className="space-y-1">
        <h2 id="service-selection-heading" className="text-base sm:text-lg font-bold text-foreground">
          1. Choisissez votre service
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Sélectionnez le type d'accompagnement adapté à vos besoins d'entraînement pour le TEF Canada.
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label="Services d'accompagnement proposés"
        className="space-y-3"
      >
        {services.map((service) => {
          const isSelected = selectedServiceId === service.id
          const isCovered = service.isCoveredByPlan

          return (
            <div
              key={service.id}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onClick={() => onSelectService(service.id)}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault()
                  onSelectService(service.id)
                }
              }}
              className={`p-4 rounded-xl border transition-all cursor-pointer relative ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-xs ring-2 ring-primary/20"
                  : "border-border/80 bg-card hover:border-primary/40 hover:bg-muted/30"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm sm:text-base font-semibold text-foreground">
                      {service.title}
                    </h3>
                    {isCovered ? (
                      <Badge variant="secondary" size="sm" className="gap-1 text-primary bg-primary/10 border border-primary/20">
                        <Sparkles className="size-3 text-primary" aria-hidden="true" />
                        <span>Inclus dans votre forfait</span>
                      </Badge>
                    ) : (
                      <span className="font-mono text-xs font-bold text-foreground">
                        {formatPrice(service.priceCents)}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {service.description}
                  </p>

                  <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" aria-hidden="true" />
                      {service.durationMinutes} minutes
                    </span>
                    <span>·</span>
                    <span>Session individuelle en direct</span>
                  </div>
                </div>

                <div className="shrink-0 flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 pt-2 sm:pt-0">
                  <div
                    className={`size-5 rounded-full border flex items-center justify-center transition-colors ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card"
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="size-4" aria-hidden="true" />}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="pt-3 flex justify-end">
        <Button
          size="default"
          onClick={onContinue}
          disabled={!selectedServiceId}
          className="w-full sm:w-auto cursor-pointer shadow-xs gap-2 font-medium"
        >
          <span>Continuer vers la date & heure</span>
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </section>
  )
}
