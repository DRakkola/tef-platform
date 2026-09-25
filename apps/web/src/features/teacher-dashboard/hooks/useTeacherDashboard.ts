/**
 * React Query orchestration hook for Teacher Dashboard.
 * Fetches teacher profile, bookings, correction queue, availability, and earnings independently.
 * Enforces teacher's configured timezone for all date/time calculations.
 */

import { useMemo, useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  getMyTeacherProfile,
  getTeacherAvailabilityRules,
  getTeacherBookings,
  getTeacherWritingQueue,
  getTeacherWritingAssignments,
  getTeacherSpeakingSessions,
  getTeacherEarningsSummary,
} from "../api"
import type {
  TeacherBookingItem,
  TeacherWritingQueueItem,
  TeacherSpeakingSessionItem,
  TeacherRecentActivityItem,
} from "../types"

function getLocalDateString(isoDate: string | Date, timeZone: string): string {
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

export function formatSessionTime(isoDate: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(isoDate))
  } catch {
    return new Date(isoDate).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  }
}

export function formatSessionDate(isoDate: string, timeZone: string): string {
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

export function formatCurrentTeacherDate(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date())
  } catch {
    return new Date().toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }
}

export function useTeacherDashboard() {
  // Reactive current timestamp for session countdowns without impure render calls
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimestamp(Date.now())
    }, 30_000)
    return () => clearInterval(timer)
  }, [])

  // 1. Teacher Profile
  const {
    data: profile,
    isLoading: isProfileLoading,
    isError: isProfileError,
    error: profileError,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ["teacher-profile-me"],
    queryFn: getMyTeacherProfile,
    staleTime: 60_000,
    retry: 1,
  })

  const teacherTimezone = profile?.timezone || "UTC"

  // 2. Availability Rules
  const {
    data: availabilityRules = [],
    isLoading: isAvailabilityLoading,
    isError: isAvailabilityError,
    error: availabilityError,
    refetch: refetchAvailability,
  } = useQuery({
    queryKey: ["teacher-availability-rules", profile?.id],
    queryFn: () => getTeacherAvailabilityRules(profile!.id),
    enabled: !!profile?.id,
    staleTime: 60_000,
  })

  // 3. Bookings
  const {
    data: bookingsData,
    isLoading: isBookingsLoading,
    isError: isBookingsError,
    error: bookingsError,
    refetch: refetchBookings,
  } = useQuery({
    queryKey: ["teacher-bookings"],
    queryFn: getTeacherBookings,
    staleTime: 30_000,
  })

  // 4. Writing Queue & Assignments
  const {
    data: writingQueue = [],
    isLoading: isQueueLoading,
    isError: isQueueError,
    error: queueError,
    refetch: refetchQueue,
  } = useQuery({
    queryKey: ["teacher-writing-queue"],
    queryFn: getTeacherWritingQueue,
    staleTime: 30_000,
  })

  const {
    data: writingAssignments = [],
    isLoading: isAssignmentsLoading,
    isError: isAssignmentsError,
    error: assignmentsError,
    refetch: refetchAssignments,
  } = useQuery({
    queryKey: ["teacher-writing-assignments"],
    queryFn: getTeacherWritingAssignments,
    staleTime: 30_000,
  })

  // 5. Speaking Sessions
  const {
    data: speakingData,
    isLoading: isSpeakingLoading,
    isError: isSpeakingError,
    error: speakingError,
    refetch: refetchSpeaking,
  } = useQuery({
    queryKey: ["teacher-speaking-sessions"],
    queryFn: getTeacherSpeakingSessions,
    staleTime: 30_000,
  })

  // 6. Earnings Summary
  const {
    data: earningsSummary,
    isLoading: isEarningsLoading,
    isError: isEarningsError,
    error: earningsError,
    refetch: refetchEarnings,
  } = useQuery({
    queryKey: ["teacher-earnings-summary"],
    queryFn: getTeacherEarningsSummary,
    staleTime: 60_000,
  })

  // Process and normalize schedule
  const { todaySessions, upcomingSessions, recentActivity } = useMemo(() => {
    const rawBookings = bookingsData?.items || []
    const now = new Date()
    const todayStr = getLocalDateString(now, teacherTimezone)

    const normalized: TeacherBookingItem[] = rawBookings.map((b: any) => {
      const start = new Date(b.start_time)
      const end = new Date(b.end_time)
      const duration = Math.max(15, Math.round((end.getTime() - start.getTime()) / (60 * 1000)))
      const sessionDateStr = getLocalDateString(start, teacherTimezone)
      const isToday = sessionDateStr === todayStr

      // Can join if confirmed and within window: 10 mins before start until 15 mins after end
      const nowMs = now.getTime()
      const canJoin =
        b.status === "confirmed" &&
        nowMs >= start.getTime() - 10 * 60 * 1000 &&
        nowMs <= end.getTime() + 15 * 60 * 1000

      // Anonymized student identifier (never expose email)
      const studentIdentifier = b.student_display_name
        ? b.student_display_name
        : `Élève #${b.student_id ? b.student_id.slice(0, 8) : "TEF"}`

      // Title
      let serviceTitle = duration <= 30 ? "Expression orale — 25 min" : "Cours particulier TEF"
      if (b.notes && b.notes.toLowerCase().includes("écrit")) {
        serviceTitle = "Correction écrite en direct"
      }

      return {
        id: b.id,
        teacher_id: b.teacher_id,
        student_id: b.student_id,
        teacher_display_name: b.teacher_display_name,
        student_identifier: studentIdentifier,
        service_title: serviceTitle,
        duration_minutes: duration,
        start_time: b.start_time,
        end_time: b.end_time,
        status: b.status,
        notes: b.notes,
        meeting_link: b.meeting_link,
        is_today: isToday,
        can_join: canJoin,
      }
    })

    // Filter today's sessions (chronological order)
    const today = normalized
      .filter((s) => s.is_today && s.status !== "cancelled")
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

    // Upcoming sessions (future days, chronological order)
    const upcoming = normalized
      .filter((s) => {
        const sessionDateStr = getLocalDateString(s.start_time, teacherTimezone)
        return sessionDateStr > todayStr && s.status !== "cancelled"
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

    // Operational recent activity (completed bookings or recently updated)
    const completedOrRecent: TeacherRecentActivityItem[] = normalized
      .filter((s) => s.status === "completed" || s.status === "confirmed")
      .slice(0, 5)
      .map((s) => ({
        id: s.id,
        type: (s.status === "completed" ? "session_completed" : "new_booking") as any,
        title: s.status === "completed" ? "Séance terminée" : "Réservation confirmée",
        description: `${s.service_title} avec ${s.student_identifier}`,
        timestamp: s.start_time,
      }))

    return {
      todaySessions: today,
      upcomingSessions: upcoming,
      recentActivity: completedOrRecent,
    }
  }, [bookingsData, teacherTimezone])

  // Process writing corrections
  const pendingCorrections = useMemo(() => {
    const all = [...(writingAssignments || []), ...(writingQueue || [])]
    // Deduplicate by id
    const seen = new Set<string>()
    const unique: TeacherWritingQueueItem[] = []

    for (const item of all) {
      if (!seen.has(item.id)) {
        seen.add(item.id)
        const isAssigned = !!item.assigned_teacher_id
        unique.push({
          id: item.id,
          attempt_id: item.attempt_id,
          task_id: item.task_id,
          task_title: item.task_title || "Expression écrite TEF",
          student_identifier: `Élève #${item.user_id ? item.user_id.slice(0, 8) : "TEF"}`,
          word_count: item.word_count || 0,
          status: isAssigned ? "ASSIGNED" : (item.status || "QUEUED"),
          submitted_at: item.submitted_at || new Date().toISOString(),
          priority: item.word_count > 200 ? "urgent" : "normal",
        })
      }
    }

    return unique.sort(
      (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
    )
  }, [writingQueue, writingAssignments])

  // Process speaking sessions
  const speakingSessions = useMemo(() => {
    const rawSessions = speakingData?.items || []

    return rawSessions.map((s: any): TeacherSpeakingSessionItem => {
      const startsAt = s.starts_at ? new Date(s.starts_at).getTime() : 0
      const canJoin =
        s.status === "ACTIVE" ||
        (s.status === "SCHEDULED" && startsAt > 0 && Math.abs(currentTimestamp - startsAt) < 15 * 60 * 1000)

      return {
        id: s.id,
        topic: s.topic || "Expression orale TEF",
        level: s.level || "B2",
        duration_minutes: s.duration_minutes || 25,
        status: s.status,
        starts_at: s.starts_at,
        expires_at: s.expires_at,
        room_id: s.room_id,
        student_identifier: `Candidat #${s.id.slice(0, 6)}`,
        can_join: canJoin,
      }
    })
  }, [speakingData, currentTimestamp])

  // Counts & Status
  const hasAvailability = availabilityRules.length > 0
  const isNewTeacher =
    !isProfileLoading &&
    !isBookingsLoading &&
    !isQueueLoading &&
    availabilityRules.length === 0 &&
    (bookingsData?.items?.length || 0) === 0 &&
    pendingCorrections.length === 0

  const todaySessionsCount = todaySessions.length
  const pendingCorrectionsCount = pendingCorrections.length
  const newBookingsCount = (bookingsData?.items || []).filter(
    (b: any) => b.status === "requested" || b.status === "confirmed"
  ).length

  return {
    profile,
    teacherTimezone,
    availabilityRules,
    hasAvailability,
    todaySessions,
    upcomingSessions,
    pendingCorrections,
    speakingSessions,
    earningsSummary,
    recentActivity,
    todaySessionsCount,
    pendingCorrectionsCount,
    newBookingsCount,
    isNewTeacher,

    // Loading & Error States
    isProfileLoading,
    isProfileError,
    profileError,
    refetchProfile,

    isAvailabilityLoading,
    isAvailabilityError,
    availabilityError,
    refetchAvailability,

    isBookingsLoading,
    isBookingsError,
    bookingsError,
    refetchBookings,

    isCorrectionsLoading: isQueueLoading || isAssignmentsLoading,
    isCorrectionsError: isQueueError || isAssignmentsError,
    correctionsError: queueError || assignmentsError,
    refetchCorrections: () => {
      refetchQueue()
      refetchAssignments()
    },

    isSpeakingLoading,
    isSpeakingError,
    speakingError,
    refetchSpeaking,

    isEarningsLoading,
    isEarningsError,
    earningsError,
    refetchEarnings,
  }
}
