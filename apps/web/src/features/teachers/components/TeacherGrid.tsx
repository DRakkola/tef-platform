import { TeacherCard } from "./TeacherCard"
import type { StudentEntitlements, TeacherSummary } from "../types"

export interface TeacherGridProps {
  teachers: TeacherSummary[]
  entitlements?: StudentEntitlements
  onViewProfile: (teacherId: string) => void
  className?: string
}

export function TeacherGrid({
  teachers,
  entitlements,
  onViewProfile,
  className,
}: TeacherGridProps) {
  return (
    <div
      role="list"
      aria-label="Liste des professeurs"
      className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 ${className || ""}`}
    >
      {teachers.map((teacher) => (
        <div key={teacher.id} role="listitem">
          <TeacherCard
            teacher={teacher}
            entitlements={entitlements}
            onViewProfile={onViewProfile}
          />
        </div>
      ))}
    </div>
  )
}
