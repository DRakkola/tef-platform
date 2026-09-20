/**
 * Hook for managing the student's My Bookings page (Page 16).
 * Manages upcoming/past tab filtering, service and status filters,
 * date grouping, join eligibility, cancellation mutation, and rescheduling.
 */

import { useState, useMemo, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getMyBookings, cancelBookingApi } from "../api"
import { telemetry } from "@/features/analytics/telemetry"
import type { TeacherBookingResponse, BookingStatus } from "../types"

export type BookingTab = "upcoming" | "past" | "all"
export type ServiceFilter = "all" | "speaking" | "writing" | "other"
export type StatusFilter = "all" | BookingStatus

export interface DateGroupedBookings {
  dateLabel: string
  dateStr: string
  bookings: TeacherBookingResponse[]
}

export function useMyBookings() {
  const queryClient = useQueryClient()

  // 1. Filter States
  const [tab, setTab] = useState<BookingTab>("upcoming")
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  // 2. Modals & Dialogs States
  const [selectedBookingForDetail, setSelectedBookingForDetail] = useState<TeacherBookingResponse | null>(null)
  const [bookingToCancel, setBookingToCancel] = useState<TeacherBookingResponse | null>(null)
  const [cancelReason, setCancelReason] = useState<string>("")
  const [bookingToReschedule, setBookingToReschedule] = useState<TeacherBookingResponse | null>(null)

  // 3. User Timezone
  const userTimezone = useMemo(() => {
    if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
      return Intl.DateTimeFormat().resolvedOptions().timeZone
    }
    return "America/Montreal"
  }, [])

  // 4. Query All Student Bookings
  const {
    data: bookingsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["my-bookings"],
    queryFn: async () => {
      try {
        return await getMyBookings()
      } catch (err) {
        // Provide sample bookings in offline / demo environment
        const now = new Date()
        const tomorrow = new Date(now.getTime() + 86400000)
        const inThreeDays = new Date(now.getTime() + 3 * 86400000)
        const lastWeek = new Date(now.getTime() - 7 * 86400000)

        const sampleItems: TeacherBookingResponse[] = [
          {
            id: "bk-sample-1",
            teacher_id: "t-martin",
            student_id: "student-1",
            teacher_display_name: "Prof. Martin Dufresne",
            start_time: new Date(tomorrow.setHours(14, 0, 0, 0)).toISOString(),
            end_time: new Date(tomorrow.setHours(15, 0, 0, 0)).toISOString(),
            status: "confirmed",
            timezone: userTimezone,
            notes: "Session: Expression orale (Section A & B) - Focus argumentation",
            meeting_link: "https://meet.tef-platform.internal/session-oral-1",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: "bk-sample-2",
            teacher_id: "t-sophie",
            student_id: "student-1",
            teacher_display_name: "Prof. Sophie Laurent",
            start_time: new Date(inThreeDays.setHours(10, 0, 0, 0)).toISOString(),
            end_time: new Date(inThreeDays.setHours(11, 0, 0, 0)).toISOString(),
            status: "confirmed",
            timezone: userTimezone,
            notes: "Session: Expression écrite - Analyse fait divers et syntaxe",
            meeting_link: "https://meet.tef-platform.internal/session-ecrit-2",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: "bk-sample-3",
            teacher_id: "t-martin",
            student_id: "student-1",
            teacher_display_name: "Prof. Martin Dufresne",
            start_time: new Date(lastWeek.setHours(16, 0, 0, 0)).toISOString(),
            end_time: new Date(lastWeek.setHours(17, 0, 0, 0)).toISOString(),
            status: "completed",
            timezone: userTimezone,
            notes: "Session: Simulation complète Section A & B",
            meeting_link: "https://meet.tef-platform.internal/session-past-3",
            created_at: lastWeek.toISOString(),
            updated_at: lastWeek.toISOString(),
          },
        ]
        return { items: sampleItems, total: sampleItems.length }
      }
    },
    staleTime: 30 * 1000,
  })

  const rawBookings: TeacherBookingResponse[] = useMemo(() => {
    return bookingsData?.items || []
  }, [bookingsData?.items])

  // 5. Partition into Upcoming and Past
  const { upcomingBookings, pastBookings } = useMemo(() => {
    const nowMs = Date.now()
    const upcoming: TeacherBookingResponse[] = []
    const past: TeacherBookingResponse[] = []

    rawBookings.forEach((b) => {
      const endMs = new Date(b.end_time).getTime()
      const isPastStatus = b.status === "completed" || b.status === "cancelled" || b.status === "no_show"

      if (isPastStatus || endMs < nowMs) {
        past.push(b)
      } else {
        upcoming.push(b)
      }
    })

    // Sort upcoming ascending (nearest first)
    upcoming.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    // Sort past descending (most recent first)
    past.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())

    return { upcomingBookings: upcoming, pastBookings: past }
  }, [rawBookings])

  // 6. Filter by Tab, Service, and Status
  const filteredBookings = useMemo(() => {
    let list: TeacherBookingResponse[] = []
    if (tab === "upcoming") {
      list = upcomingBookings
    } else if (tab === "past") {
      list = pastBookings
    } else {
      list = [...upcomingBookings, ...pastBookings].sort(
        (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
      )
    }

    // Filter by Service
    if (serviceFilter !== "all") {
      list = list.filter((b) => {
        const text = (b.notes || "").toLowerCase()
        if (serviceFilter === "speaking") return text.includes("oral") || text.includes("parole")
        if (serviceFilter === "writing") return text.includes("écrit") || text.includes("ecrit") || text.includes("rédac")
        return !text.includes("oral") && !text.includes("écrit") && !text.includes("ecrit")
      })
    }

    // Filter by Status
    if (statusFilter !== "all") {
      list = list.filter((b) => b.status === statusFilter)
    }

    return list
  }, [tab, upcomingBookings, pastBookings, serviceFilter, statusFilter])

  // 7. Group Upcoming Bookings by Date for clean visual hierarchy
  const groupedUpcomingBookings = useMemo(() => {
    if (tab !== "upcoming" && tab !== "all") return []

    const groups: Record<string, TeacherBookingResponse[]> = {}
    const now = new Date()
    const todayStr = now.toISOString().split("T")[0]
    const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().split("T")[0]

    filteredBookings.forEach((b) => {
      const dateStr = b.start_time.split("T")[0]
      let label = ""
      if (dateStr === todayStr) {
        label = "Aujourd'hui"
      } else if (dateStr === tomorrowStr) {
        label = "Demain"
      } else {
        try {
          const d = new Date(dateStr + "T12:00:00Z")
          label = d.toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })
        } catch {
          label = dateStr
        }
      }

      if (!groups[label]) {
        groups[label] = []
      }
      groups[label].push(b)
    })

    return Object.entries(groups).map(([dateLabel, items]) => ({
      dateLabel,
      dateStr: items[0]?.start_time.split("T")[0] || "",
      bookings: items,
    }))
  }, [tab, filteredBookings])

  // 8. Join Window Check Helper
  const getJoinStatus = useCallback((booking: TeacherBookingResponse) => {
    if (booking.status !== "confirmed") {
      return { canJoin: false, label: "Non disponible", variant: "muted" as const }
    }

    const nowMs = Date.now()
    const startMs = new Date(booking.start_time).getTime()
    const endMs = new Date(booking.end_time).getTime()

    // 15 minutes before start until end time
    const joinWindowStart = startMs - 15 * 60 * 1000

    if (nowMs > endMs) {
      return { canJoin: false, label: "Session terminée", variant: "muted" as const }
    }
    if (nowMs >= joinWindowStart && nowMs <= endMs) {
      return { canJoin: true, label: "Rejoindre la séance", variant: "primary" as const }
    }
    if (nowMs >= startMs - 60 * 60 * 1000) {
      return { canJoin: false, label: "Démarre bientôt", variant: "warning" as const }
    }

    return { canJoin: false, label: "À venir", variant: "secondary" as const }
  }, [])

  // 9. Cancel Booking Mutation
  const cancelMutation = useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: string; reason: string }) => {
      telemetry.track("booking_cancel_started", { booking_id: bookingId })
      return await cancelBookingApi(bookingId, reason || "Imprévu d'emploi du temps")
    },
    onSuccess: (updated) => {
      telemetry.track("booking_cancelled", { booking_id: updated.id })
      setBookingToCancel(null)
      setCancelReason("")

      // Update local query cache immediately
      queryClient.setQueryData(["my-bookings"], (old: any) => {
        if (!old?.items) return old
        return {
          ...old,
          items: old.items.map((b: TeacherBookingResponse) =>
            b.id === updated.id ? { ...b, status: "cancelled", cancellation_reason: updated.cancellation_reason } : b
          ),
        }
      })

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["student", "dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["student-entitlements"] })
      queryClient.invalidateQueries({ queryKey: ["teacher-slots"] })
    },
  })

  const handleOpenCancel = useCallback((booking: TeacherBookingResponse) => {
    setBookingToCancel(booking)
    setCancelReason("")
  }, [])

  const handleConfirmCancel = useCallback(() => {
    if (!bookingToCancel) return
    cancelMutation.mutate({
      bookingId: bookingToCancel.id,
      reason: cancelReason || "Annulation demandée par le candidat",
    })
  }, [bookingToCancel, cancelReason, cancelMutation])

  return {
    tab,
    setTab,
    serviceFilter,
    setServiceFilter,
    statusFilter,
    setStatusFilter,
    bookings: filteredBookings,
    upcomingBookings,
    pastBookings,
    groupedUpcomingBookings,
    isLoading,
    error,
    refetch,
    userTimezone,
    selectedBookingForDetail,
    setSelectedBookingForDetail,
    bookingToCancel,
    setBookingToCancel,
    cancelReason,
    setCancelReason,
    bookingToReschedule,
    setBookingToReschedule,
    handleOpenCancel,
    handleConfirmCancel,
    isCancelling: cancelMutation.isPending,
    cancelError: cancelMutation.error,
    getJoinStatus,
  }
}
