import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { PageShell } from "@/components/layout/PageShell"
import { StudentLayout } from "@/features/dashboard/StudentLayout"
import {
  TeachersHeader,
  TeacherSearch,
  TeacherSort,
  TeacherFilterBar,
  TeacherFiltersSheet,
  TeacherGrid,
  TeacherEmptyState,
  TeacherSkeleton,
  TeacherPagination,
} from "./components"
import { useTeachers } from "./hooks/useTeachers"

export function TeachersDirectoryPage() {
  const navigate = useNavigate()
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false)

  const {
    teachers,
    total,
    page,
    totalPages,
    pageSize,
    isLoading,
    isError,
    entitlements,
    search,
    specialization,
    level,
    priceRange,
    availability,
    sort,
    activeFilterCount,
    setSearch,
    setSpecialization,
    setLevel,
    setPriceRange,
    setAvailability,
    setSort,
    setPage,
    resetFilters,
    refetch,
  } = useTeachers()

  const handleViewProfile = (teacherId: string) => {
    navigate(`/teachers/${teacherId}`)
  }

  const handleViewBookings = () => {
    navigate("/teachers/bookings")
  }

  return (
    <StudentLayout>
      <PageShell>
        <div className="space-y-6">
          {/* Header */}
          <TeachersHeader
            totalCount={total}
            onMyBookingsClick={handleViewBookings}
          />

          {/* Search & Sort Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="w-full sm:max-w-md">
              <TeacherSearch value={search} onChange={setSearch} />
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2">
              <TeacherSort value={sort} onChange={setSort} />
            </div>
          </div>

          {/* Filter Bar */}
          <TeacherFilterBar
            specialization={specialization}
            onSpecializationChange={setSpecialization}
            level={level}
            onLevelChange={setLevel}
            priceRange={priceRange}
            onPriceRangeChange={setPriceRange}
            availability={availability}
            onAvailabilityChange={setAvailability}
            activeFiltersCount={activeFilterCount}
            onReset={resetFilters}
            onOpenMobileFilters={() => setIsMobileFiltersOpen(true)}
          />

          {/* Mobile Filter Sheet */}
          <TeacherFiltersSheet
            isOpen={isMobileFiltersOpen}
            onClose={() => setIsMobileFiltersOpen(false)}
            specialization={specialization}
            onSpecializationChange={setSpecialization}
            level={level}
            onLevelChange={setLevel}
            priceRange={priceRange}
            onPriceRangeChange={setPriceRange}
            availability={availability}
            onAvailabilityChange={setAvailability}
            onReset={resetFilters}
          />

          {/* Directory Content */}
          {isLoading ? (
            <TeacherSkeleton count={6} />
          ) : isError ? (
            <div className="p-8 text-center rounded-2xl border border-destructive/20 bg-destructive/5 space-y-3">
              <p className="text-sm font-medium text-destructive">
                Une erreur est survenue lors de la récupération des enseignants.
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="text-xs font-semibold underline text-destructive cursor-pointer"
              >
                Réessayer
              </button>
            </div>
          ) : teachers.length === 0 ? (
            <TeacherEmptyState
              onReset={resetFilters}
              hasActiveFilters={activeFilterCount > 0}
            />
          ) : (
            <div className="space-y-6">
              <TeacherGrid
                teachers={teachers}
                entitlements={entitlements}
                onViewProfile={handleViewProfile}
              />

              <TeacherPagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={total}
                pageSize={pageSize}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      </PageShell>
    </StudentLayout>
  )
}
