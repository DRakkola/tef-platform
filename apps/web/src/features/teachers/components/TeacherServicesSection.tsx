import { CheckCircle2, Clock, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import type { TeacherServiceItem } from "../types"

export interface TeacherServicesSectionProps {
  services: TeacherServiceItem[]
  selectedServiceId: string
  onSelectService: (serviceId: string) => void
}

export function TeacherServicesSection({
  services,
  selectedServiceId,
  onSelectService,
}: TeacherServicesSectionProps) {
  if (services.length === 0) return null

  return (
    <Card className="rounded-2xl border-border/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-lg font-bold">
          Services proposés par l'enseignant
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Sélectionnez le type de session de 60 minutes que vous souhaitez effectuer.
        </p>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        <div
          role="radiogroup"
          aria-label="Services de formation proposés"
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          {services.map((service) => {
            const isSelected = selectedServiceId === service.id
            return (
              <button
                key={service.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onSelectService(service.id)}
                className={`p-3.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  isSelected
                    ? "bg-primary/5 border-primary shadow-2xs ring-1 ring-primary/30"
                    : "bg-card border-border/80 hover:border-primary/40 hover:bg-muted/30"
                }`}
              >
                <div className="space-y-1.5 w-full">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-sm text-foreground leading-tight">
                      {service.title}
                    </h4>
                    {isSelected ? (
                      <CheckCircle2 className="size-4 text-primary shrink-0" />
                    ) : (
                      <span className="size-4 rounded-full border border-muted-foreground/30 shrink-0" />
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {service.description}
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50 w-full">
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                    <Clock className="size-3" />
                    <span>{service.durationMinutes} min</span>
                  </span>

                  {service.isCoveredByPlan ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] font-medium gap-1 text-primary border-primary/30 bg-primary/5"
                    >
                      <Sparkles className="size-2.5 text-primary" />
                      <span>Inclus forfait</span>
                    </Badge>
                  ) : (
                    <span className="font-mono font-bold text-foreground">
                      {(service.priceCents / 100).toFixed(2)} CAD
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
