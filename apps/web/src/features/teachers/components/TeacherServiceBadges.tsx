import { Badge } from "@/components/ui/badge"

export interface TeacherServiceBadgesProps {
  expertise: string[]
  maxVisible?: number
  className?: string
}

export function TeacherServiceBadges({
  expertise,
  maxVisible = 3,
  className,
}: TeacherServiceBadgesProps) {
  if (!expertise || expertise.length === 0) {
    return null
  }

  const visible = expertise.slice(0, maxVisible)
  const remaining = expertise.length - maxVisible

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className || ""}`}>
      {visible.map((exp) => (
        <Badge
          key={exp}
          variant="secondary"
          className="text-[10px] font-medium px-2 py-0.5 bg-muted/60 text-muted-foreground border-border/60 hover:bg-muted"
        >
          {exp}
        </Badge>
      ))}

      {remaining > 0 && (
        <Badge
          variant="outline"
          className="text-[10px] font-medium px-1.5 py-0.5 text-muted-foreground border-border/60"
        >
          +{remaining}
        </Badge>
      )}
    </div>
  )
}
