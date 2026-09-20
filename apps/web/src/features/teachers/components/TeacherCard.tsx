import { ShieldCheck, ArrowRight, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { TeacherServiceBadges } from "./TeacherServiceBadges"
import { TeacherAvailabilityPreview } from "./TeacherAvailabilityPreview"
import type { StudentEntitlements, TeacherSummary } from "../types"

export interface TeacherCardProps {
  teacher: TeacherSummary
  entitlements?: StudentEntitlements
  onViewProfile: (teacherId: string) => void
  className?: string
}

export function TeacherCard({
  teacher,
  entitlements,
  onViewProfile,
  className,
}: TeacherCardProps) {
  const initials = teacher.display_name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  const formatPrice = (cents: number) => {
    const amount = (cents / 100).toFixed(2)
    return `${amount} CAD / heure`
  }

  // Check if student has entitlement covering 1-to-1 session
  const hasEntitlement = entitlements?.has_subscription || (entitlements?.credits_balance || 0) >= 2

  return (
    <Card
      className={`flex flex-col justify-between border-border/80 bg-card hover:border-primary/40 hover:shadow-sm transition-all duration-200 rounded-2xl overflow-hidden ${
        className || ""
      }`}
    >
      <CardHeader className="space-y-3 pb-3">
        {/* Top: Avatar + Identity + Verified Badge */}
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-base border border-primary/20 select-none">
            {initials || "TE"}
          </div>

          <div className="space-y-0.5 min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-base font-bold text-foreground truncate">
                {teacher.display_name}
              </CardTitle>
              {teacher.verification_status === "approved" && (
                <ShieldCheck
                  className="size-4 text-emerald-500 shrink-0"
                  aria-label="Enseignant certifié TEF"
                />
              )}
            </div>

            <p className="text-xs text-muted-foreground line-clamp-1">
              {teacher.headline || "Professeur examinateur certifié TEF"}
            </p>
          </div>
        </div>

        {/* Short Bio */}
        {teacher.bio && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {teacher.bio}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {/* Supported Services / Specialties */}
        <TeacherServiceBadges expertise={teacher.expertise} maxVisible={3} />

        {/* Availability Summary Preview */}
        <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60">
          <TeacherAvailabilityPreview teacherId={teacher.id} />
        </div>

        {/* Pricing / Entitlement Row */}
        <div className="flex items-center justify-between pt-1 text-xs">
          <div>
            <span className="text-[11px] text-muted-foreground block">Tarif indicatif</span>
            <span className="font-mono font-bold text-foreground text-sm">
              {formatPrice(teacher.hourly_price)}
            </span>
          </div>

          {hasEntitlement && (
            <Badge
              variant="outline"
              className="text-[10px] font-medium gap-1 text-primary border-primary/30 bg-primary/5"
            >
              <Sparkles className="size-3 text-primary" />
              <span>Inclus dans votre forfait</span>
            </Badge>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-2 border-t border-border/60">
        <Button
          onClick={() => onViewProfile(teacher.id)}
          className="w-full cursor-pointer justify-between text-xs font-semibold h-9"
        >
          <span>Voir le profil</span>
          <ArrowRight className="size-3.5" />
        </Button>
      </CardFooter>
    </Card>
  )
}
