/**
 * React Query orchestration hook for Teacher Bookings & Schedule workspace.
 * Handles timezone-aware date calculations, filtering, view modes, and session lifecycle mutations.
 */

import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getMyTeacherProfile,
  getTeacherBookings,
  confirmBooking,
  cancelBooking,
  rescheduleBooking,
  completeBooking,
  markNoShow,
} from "../api"
import type {
  TeacherBooking,
  BookingStatusFilter,
  TimeRangeFilter,
  CalendarViewMode,
  BookingsSummaryMetrics,
  WeekDaySlot,
  RescheduleBookingPayload,
} from "../types"

export function getLocalDateKey(isoDate: string | Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(isoDate))
  } catch {
    return new Date(isoDate).toISOString().split("T")[0]
  }
}

export function formatTimeInTz(isoDate: string | Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(isoDate))
  } catch {
    return new Date(isoDate).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }
}

export function formatDateInTz(isoDate: string | Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone,
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(new Date(isoDate))
  } catch {
    return new Date(isoDate).toLocaleDateString("fr-FR")
  }
}

export function formatFullDateInTz(isoDate: string | Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(isoDate))
  } catch {
    return new Date(isoDate).toLocaleDateString("fr-FR")
  }
}

export function isSessionJoinable(booking: TeacherBooking): boolean {
  if (booking.status !== "confirmed") return false
  const now = new Date().getTime()
  const start = new Date(booking.start_time).getTime()
  const end = new Date(booking.end_time).getTime()
  // Joinable 10 minutes prior to start until end of session
  return now >= start - 10 * 60 * 1000 && now <= end
}

export function getStudentDisplayName(booking: TeacherBooking): string {
  if (booking.student_display_name && booking.student_display_name.trim()) {
    return booking.student_display_name
  }
  return `Élève #${booking.student_id.slice(0, 6)}`
}

export function useTeacherBookings() {
  const queryClient = useQueryClient()

  // 1. View & Filter States
  const [viewMode, setViewMode] = useState<CalendarViewMode>("day")
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [statusFilter, setStatusFilter] = useState<BookingStatusFilter>("all")
  const [timeRangeFilter, setTimeRangeFilter] = useState<TimeRangeFilter>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")

  // 2. Modals & Action States
  const [selectedBooking, setSelectedBooking] = useState<TeacherBooking | null>(null)
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState<boolean>(false)
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState<boolean>(false)
  const [bookingToAction, setBookingToAction] = useState<TeacherBooking | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // 3. Teacher Profile & Timezone
  const {
    data: profile,
    isLoading: isProfileLoading,
    isError: isProfileError,
    error: profileError,
  } = useQuery({
    queryKey: ["teacher-profile-me"],
    queryFn: getMyTeacherProfile,
    staleTime: 5 * 60 * 1000,
  })

  const teacherTimezone = profile?.timezone || "UTC"

  // 4. Bookings Query
  const {
    data: bookingsData,
    isLoading: isBookingsLoading,
    isError: isBookingsError,
    error: bookingsError,
    refetch: refetchBookings,
  } = useQuery({
    queryKey: ["teacher-bookings"],
    queryFn: () => getTeacherBookings(),
    staleTime: 30 * 1000,
  })

  const allBookings: TeacherBooking[] = useMemo(
    () => bookingsData?.items || [],
    [bookingsData]
  )

  // 5. Summary Metrics (calculated from all bookings in teacher's timezone)
  const summaryMetrics: BookingsSummaryMetrics = useMemo(() => {
    const todayKey = getLocalDateKey(new Date(), teacherTimezone)
    const now = new Date().getTime()
    const currentMonth = new Date().getMonth()
    const currentYear = new Date().getFullYear()

    let todayCount = 0
    let upcomingCount = 0
    let pendingCount = 0
    let completedMonthCount = 0

    allBookings.forEach((b) => {
      const bDateKey = getLocalDateKey(b.start_time, teacherTimezone)
      const bStartTime = new Date(b.start_time).getTime()
      const bStartDate = new Date(b.start_time)

      if (bDateKey === todayKey && b.status !== "cancelled") {
        todayCount += 1
      }
      if (
        bStartTime >= now &&
        (b.status === "confirmed" || b.status === "requested")
      ) {
        upcomingCount += 1
      }
      if (b.status === "requested") {
        pendingCount += 1
      }
      if (
        b.status === "completed" &&
        bStartDate.getMonth() === currentMonth &&
        bStartDate.getFullYear() === currentYear
      ) {
        completedMonthCount += 1
      }
    })

    return {
      todayCount,
      upcomingCount,
      pendingCount,
      completedMonthCount,
    }
  }, [allBookings, teacherTimezone])

  // 6. Filtered Bookings for the current view
  const filteredBookings = useMemo(() => {
    const now = new Date().getTime()
    const todayKey = getLocalDateKey(new Date(), teacherTimezone)

    return allBookings.filter((b) => {
      // Status Filter
      if (statusFilter !== "all" && b.status !== statusFilter) {
        return false
      }

      // Time Range Filter
      if (timeRangeFilter === "today") {
        if (getLocalDateKey(b.start_time, teacherTimezone) !== todayKey) {
          return false
        }
      } else if (timeRangeFilter === "upcoming") {
        if (new Date(b.start_time).getTime() < now) {
          return false
        }
      } else if (timeRangeFilter === "past") {
        if (new Date(b.end_time).getTime() >= now) {
          return false
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const studentName = getStudentDisplayName(b).toLowerCase()
        const notes = (b.notes || "").toLowerCase()
        if (!studentName.includes(query) && !notes.includes(query)) {
          return false
        }
      }

      return true
    })
  }, [allBookings, statusFilter, timeRangeFilter, searchQuery, teacherTimezone])

  // 7. Day View Data
  const dayViewBookings = useMemo(() => {
    const selectedKey = getLocalDateKey(selectedDate, teacherTimezone)
    return filteredBookings
      .filter((b) => getLocalDateKey(b.start_time, teacherTimezone) === selectedKey)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  }, [filteredBookings, selectedDate, teacherTimezone])

  // 8. Week View Data (7 days starting Monday)
  const weekDays: WeekDaySlot[] = useMemo(() => {
    const curr = new Date(selectedDate)
    const day = curr.getDay()
    // In JS: 0 is Sunday, 1 is Monday ... 6 is Saturday
    const diffToMonday = curr.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(curr.setDate(diffToMonday))
    monday.setHours(0, 0, 0, 0)

    const todayKey = getLocalDateKey(new Date(), teacherTimezone)

    const days: WeekDaySlot[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const dateKey = getLocalDateKey(d, teacherTimezone)

      const dayBookings = filteredBookings
        .filter((b) => getLocalDateKey(b.start_time, teacherTimezone) === dateKey)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

      let dayLabel = ""
      let fullDayLabel = ""
      try {
        dayLabel = new Intl.DateTimeFormat("fr-FR", {
          timeZone: teacherTimezone,
          weekday: "short",
          day: "numeric",
        }).format(d)
        fullDayLabel = new Intl.DateTimeFormat("fr-FR", {
          timeZone: teacherTimezone,
          weekday: "long",
          day: "numeric",
          month: "short",
        }).format(d)
      } catch {
        dayLabel = `${d.getDate()}`
        fullDayLabel = `${d.getDate()}`
      }

      days.push({
        date: d,
        dateKey,
        dayLabel,
        fullDayLabel,
        isToday: dateKey === todayKey,
        bookings: dayBookings,
      })
    }

    return days
  }, [selectedDate, filteredBookings, teacherTimezone])

  // 9. Date Navigation Helpers
  const goToToday = () => {
    setSelectedDate(new Date())
  }

  const goToPrev = () => {
    setSelectedDate((prev) => {
      const d = new Date(prev)
      if (viewMode === "day") {
        d.setDate(d.getDate() - 1)
      } else if (viewMode === "week") {
        d.setDate(d.getDate() - 7)
      } else {
        d.setMonth(d.getMonth() - 1)
      }
      return d
    })
  }

  const goToNext = () => {
    setSelectedDate((prev) => {
      const d = new Date(prev)
      if (viewMode === "day") {
        d.setDate(d.getDate() + 1)
      } else if (viewMode === "week") {
        d.setDate(d.getDate() + 7)
      } else {
        d.setMonth(d.getMonth() + 1)
      }
      return d
    })
  }

  const resetFilters = () => {
    setStatusFilter("all")
    setTimeRangeFilter("all")
    setSearchQuery("")
  }

  const hasActiveFilters =
    statusFilter !== "all" || timeRangeFilter !== "all" || searchQuery.trim() !== ""

  // 10. Mutations
  const confirmMutation = useMutation({
    mutationFn: (id: string) => confirmBooking(id),
    onSuccess: (updated) => {
      setActionError(null)
      queryClient.invalidateQueries({ queryKey: ["teacher-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["teacher-dashboard-summary"] })
      if (selectedBooking?.id === updated.id) {
        setSelectedBooking(updated)
      }
    },
    onError: (err: any) => {
      setActionError(err?.message || "Impossible de confirmer la séance.")
    },
  })

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      cancelBooking(id, { reason }),
    onSuccess: (updated) => {
      setActionError(null)
      setIsCancelDialogOpen(false)
      setBookingToAction(null)
      queryClient.invalidateQueries({ queryKey: ["teacher-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["teacher-dashboard-summary"] })
      if (selectedBooking?.id === updated.id) {
        setSelectedBooking(updated)
      }
    },
    onError: (err: any) => {
      setActionError(err?.message || "Impossible d'annuler la séance.")
    },
  })

  const rescheduleMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: RescheduleBookingPayload
    }) => rescheduleBooking(id, payload),
    onSuccess: (updated) => {
      setActionError(null)
      setIsRescheduleModalOpen(false)
      setBookingToAction(null)
      queryClient.invalidateQueries({ queryKey: ["teacher-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["teacher-dashboard-summary"] })
      if (selectedBooking?.id === updated.id) {
        setSelectedBooking(updated)
      }
    },
    onError: (err: any) => {
      if (
        err?.status === 409 ||
        err?.message?.includes("409") ||
        err?.message?.includes("SLOT_ALREADY_BOOKED") ||
        err?.message?.includes("conflict")
      ) {
        setActionError(
          "Ce créneau n'est plus disponible ou entre en conflit avec une autre séance."
        )
      } else {
        setActionError(err?.message || "Impossible de reprogrammer la séance.")
      }
    },
  })

  const completeMutation = useMutation({
    mutationFn: (id: string) => completeBooking(id),
    onSuccess: (updated) => {
      setActionError(null)
      queryClient.invalidateQueries({ queryKey: ["teacher-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["teacher-dashboard-summary"] })
      if (selectedBooking?.id === updated.id) {
        setSelectedBooking(updated)
      }
    },
    onError: (err: any) => {
      setActionError(err?.message || "Impossible de marquer la séance comme terminée.")
    },
  })

  const noShowMutation = useMutation({
    mutationFn: (id: string) => markNoShow(id),
    onSuccess: (updated) => {
      setActionError(null)
      queryClient.invalidateQueries({ queryKey: ["teacher-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["teacher-dashboard-summary"] })
      if (selectedBooking?.id === updated.id) {
        setSelectedBooking(updated)
      }
    },
    onError: (err: any) => {
      setActionError(err?.message || "Impossible de signaler l'absence de l'élève.")
    },
  })

  // Action helpers
  const openCancelDialog = (booking: TeacherBooking) => {
    setActionError(null)
    setBookingToAction(booking)
    setIsCancelDialogOpen(true)
  }

  const openRescheduleModal = (booking: TeacherBooking) => {
    setActionError(null)
    setBookingToAction(booking)
    setIsRescheduleModalOpen(true)
  }

  return {
    profile,
    teacherTimezone,
    isProfileLoading,
    isProfileError,
    profileError,

    allBookings,
    filteredBookings,
    dayViewBookings,
    weekDays,
    summaryMetrics,

    isBookingsLoading,
    isBookingsError,
    bookingsError,
    refetchBookings,

    viewMode,
    setViewMode,
    selectedDate,
    setSelectedDate,
    statusFilter,
    setStatusFilter,
    timeRangeFilter,
    setTimeRangeFilter,
    searchQuery,
    setSearchQuery,
    hasActiveFilters,

    goToToday,
    goToPrev,
    goToNext,
    resetFilters,

    selectedBooking,
    setSelectedBooking,
    bookingToAction,
    setBookingToAction,
    isCancelDialogOpen,
    setIsCancelDialogOpen,
    isRescheduleModalOpen,
    setIsRescheduleModalOpen,
    actionError,
    setActionError,
    openCancelDialog,
    openRescheduleModal,

    confirmMutation,
    cancelMutation,
    rescheduleMutation,
    completeMutation,
    noShowMutation,
  }
}
