/**
 * Custom hook for inspecting and previewing next available slot for a teacher.
 */

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { getTeacherSlots } from "../api"
import type { TimeSlot } from "../types"

export function useTeacherAvailabilityPreview(teacherId: string) {
  const { data, isLoading } = useQuery({
    queryKey: ["teacher-slots-preview", teacherId],
    queryFn: () => getTeacherSlots(teacherId),
    staleTime: 5 * 60 * 1000, // 5 min cache
  })

  const { earliestSlot, formattedNextSlot, hasSlots } = useMemo(() => {
    const slots: TimeSlot[] = data?.slots || []
    if (slots.length === 0) {
      return {
        earliestSlot: null,
        formattedNextSlot: "Aucun créneau cette semaine",
        hasSlots: false,
      }
    }

    // Slots are already sorted chronologically
    const nextSlot = slots[0]
    const slotDate = new Date(nextSlot.start_time)
    const now = new Date()

    const isToday =
      slotDate.getDate() === now.getDate() &&
      slotDate.getMonth() === now.getMonth() &&
      slotDate.getFullYear() === now.getFullYear()

    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const isTomorrow =
      slotDate.getDate() === tomorrow.getDate() &&
      slotDate.getMonth() === tomorrow.getMonth() &&
      slotDate.getFullYear() === tomorrow.getFullYear()

    const timeStr = nextSlot.start_time_local || slotDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })

    let label = ""
    if (isToday) {
      label = `Aujourd'hui, ${timeStr}`
    } else if (isTomorrow) {
      label = `Demain, ${timeStr}`
    } else {
      const dayName = slotDate.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })
      label = `${dayName}, ${timeStr}`
    }

    return {
      earliestSlot: nextSlot,
      formattedNextSlot: label,
      hasSlots: true,
    }
  }, [data])

  return {
    earliestSlot,
    formattedNextSlot,
    hasSlots,
    isLoading,
  }
}
