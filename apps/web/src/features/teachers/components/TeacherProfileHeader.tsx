import { ShieldCheck, Globe, Calendar, ArrowLeft, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { StudentEntitlements, TeacherSummary } from "../types"

export interface TeacherProfileHeaderProps {
  teacher: TeacherSummary
  entitlements?: StudentEntitlements
  onBackClick: () => void
  onBookClick: () => void
}

export function TeacherProfileHeader({
  teacher,
  entitlements,
  onBackClick,
  onBookClick,
}: TeacherProfileHeaderProps) {
  const initials = teacher.display_name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  const formatPrice = (cents: number) => {
    return `${(cents / 100).toFixed(2)} CAD`
  }

  const hasEntitlement = entitlements?.has_subscription || (entitlements?.credits_balance || 0) >= 2

  return (
    <div className="space-y-4 pb-6 border-b border-border/60">
      {/* Back link */}
      <button
        type="button"
        onClick={onBackClick}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        <span>Tous les professeurs</span>
      </button>

      {/* Main Profile Info Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="flex size-16 sm:size-20 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold text-xl sm:text-2xl border border-primary/20 select-none shadow-2xs">
            {initials || "TE"}
          </div>

          {/* Name & Headline */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {teacher.display_name}
              </h1>

              {teacher.verification_status === "approved" && (
                <Badge
                  variant="outline"
                  className="text-xs font-medium gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                >
                  <ShieldCheck className="size-3.5 text-emerald-500 shrink-0" />
                  <span>Profil vérifié</span>
                </Badge>
              )}
            </div>

            <p className="text-sm text-muted-foreground leading-snug">
              {teacher.headline || "Examinateur certifié TEF Canada"}
            </p>

            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 flex-wrap">
              <span className="flex items-center gap-1">
                <Globe className="size-3.5 text-muted-foreground/80" />
                <span>Fuseau : {teacher.timezone}</span>
              </span>

              <span className="text-border">|</span>

              <span className="font-mono">
                Tarif : <strong className="text-foreground">{formatPrice(teacher.hourly_price)}</strong> / heure
              </span>

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
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3 shrink-0">
          <Button
            onClick={onBookClick}
            size="lg"
            className="cursor-pointer gap-2 font-semibold text-xs sm:text-sm h-10 px-5 shadow-xs"
          >
            <Calendar className="size-4" />
            <span>Réserver une session</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
