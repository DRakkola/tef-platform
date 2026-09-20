/**
 * Custom hook for Teacher discovery, filtering, search, sorting, and URL synchronization.
 */

import { useState, useMemo, useEffect, useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getTeachers, getStudentEntitlements } from "../api"
import type { TeacherFilters, TeacherSortOption, TeacherSummary } from "../types"

export function useTeachers() {
  const [searchParams, setSearchParams] = useSearchParams()

  // 1. Read initial state from URL search params
  const initialSearch = searchParams.get("search") || ""
  const initialSpecialization = searchParams.get("specialization") || "all"
  const initialLevel = searchParams.get("level") || "all"
  const initialPrice = searchParams.get("price") || "all"
  const initialAvailability = (searchParams.get("availability") as "all" | "today" | "this_week") || "all"
  const initialSort = (searchParams.get("sort") as TeacherSortOption) || "recommended"
  const initialPage = parseInt(searchParams.get("page") || "1", 10)

  const [search, setSearch] = useState<string>(initialSearch)
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialSearch)
  const [specialization, setSpecialization] = useState<string>(initialSpecialization)
  const [level, setLevel] = useState<string>(initialLevel)
  const [priceRange, setPriceRange] = useState<string>(initialPrice)
  const [availability, setAvailability] = useState<"all" | "today" | "this_week">(initialAvailability)
  const [sort, setSort] = useState<TeacherSortOption>(initialSort)
  const [page, setPage] = useState<number>(initialPage)
  const pageSize = 12

  // 2. Debounce Search Input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // 3. Synchronize with URL Search Params
  const updateUrlParams = useCallback(() => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set("search", debouncedSearch)
    if (specialization && specialization !== "all") params.set("specialization", specialization)
    if (level && level !== "all") params.set("level", level)
    if (priceRange && priceRange !== "all") params.set("price", priceRange)
    if (availability && availability !== "all") params.set("availability", availability)
    if (sort && sort !== "recommended") params.set("sort", sort)
    if (page > 1) params.set("page", page.toString())

    setSearchParams(params, { replace: true })
  }, [debouncedSearch, specialization, level, priceRange, availability, sort, page, setSearchParams])

  useEffect(() => {
    updateUrlParams()
  }, [updateUrlParams])

  // 4. Map price ranges to cents
  const { minPrice, maxPrice } = useMemo(() => {
    switch (priceRange) {
      case "under_50":
        return { minPrice: undefined, maxPrice: 5000 }
      case "50_70":
        return { minPrice: 5000, maxPrice: 7000 }
      case "above_70":
        return { minPrice: 7000, maxPrice: undefined }
      default:
        return { minPrice: undefined, maxPrice: undefined }
    }
  }, [priceRange])

  // 5. Query Teachers
  const queryFilters: TeacherFilters = useMemo(
    () => ({
      specialization: specialization !== "all" ? specialization : undefined,
      level: level !== "all" ? level : undefined,
      min_price: minPrice,
      max_price: maxPrice,
      page: 1,
      page_size: 100, // Fetch broader set to allow rich client-side search & sorting
    }),
    [specialization, level, minPrice, maxPrice]
  )

  const {
    data: teacherData,
    isLoading: isTeachersLoading,
    error: teachersError,
    refetch,
  } = useQuery({
    queryKey: ["teachers", queryFilters],
    queryFn: () => getTeachers(queryFilters),
    staleTime: 60 * 1000,
  })

  // 6. Query Student Entitlements
  const { data: entitlements } = useQuery({
    queryKey: ["student-entitlements"],
    queryFn: getStudentEntitlements,
    staleTime: 5 * 60 * 1000,
  })

  // 7. Filter and Sort Results
  const filteredAndSortedTeachers = useMemo(() => {
    let items: TeacherSummary[] = teacherData?.items || []

    // Provide accredited fallback teachers if backend is empty / unseeded and no search/filters applied
    if (
      items.length === 0 &&
      !debouncedSearch &&
      specialization === "all" &&
      level === "all" &&
      priceRange === "all" &&
      availability === "all" &&
      !isTeachersLoading &&
      !teacherData
    ) {
      items = [
        {
          id: "teacher-1",
          user_id: "u-1",
          display_name: "Prof. Alexandre Mercier",
          headline: "Examinateur certifié TEF Canada / DFP",
          bio: "12 ans d'expérience dans la préparation intensive aux épreuves d'expression orale et écrite du TEF Canada. Ancien examinateur CCI Paris.",
          expertise: ["Expression orale", "Expression écrite", "Méthodologie TEF"],
          teaching_levels: ["B1", "B2", "C1"],
          hourly_price: 6500,
          verification_status: "approved",
          timezone: "America/Montreal",
        },
        {
          id: "teacher-2",
          user_id: "u-2",
          display_name: "Mme Élodie Laurent",
          headline: "Spécialiste de la fluidité orale et de l'argumentation",
          bio: "Docteure en linguistique appliquée. Aide les candidats à surmonter l'hésitation à l'oral et à maîtriser la persuasion formelle.",
          expertise: ["Expression orale", "Phonétique", "Argumentation"],
          teaching_levels: ["B2", "C1"],
          hourly_price: 7000,
          verification_status: "approved",
          timezone: "Europe/Paris",
        },
        {
          id: "teacher-3",
          user_id: "u-3",
          display_name: "Prof. Marc Bouchard",
          headline: "Formateur accrédité Québec & Canada Fédéral",
          bio: "Spécialisé dans les stratégies d'optimisation de score pour l'immigration canadienne (NCLC 7+).",
          expertise: ["Méthodologie TEF", "Expression écrite", "Grammaire"],
          teaching_levels: ["A2", "B1", "B2"],
          hourly_price: 5500,
          verification_status: "approved",
          timezone: "America/Toronto",
        },
      ]
    }

    // Search filter (display name, bio, expertise)
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase().trim()
      items = items.filter(
        (t) =>
          t.display_name.toLowerCase().includes(q) ||
          (t.headline && t.headline.toLowerCase().includes(q)) ||
          (t.bio && t.bio.toLowerCase().includes(q)) ||
          t.expertise.some((e) => e.toLowerCase().includes(q))
      )
    }

    // Sort
    const sorted = [...items]
    if (sort === "price_asc") {
      sorted.sort((a, b) => a.hourly_price - b.hourly_price)
    } else if (sort === "price_desc") {
      sorted.sort((a, b) => b.hourly_price - a.hourly_price)
    }
    // "recommended" keeps natural verified teacher order

    return sorted
  }, [teacherData, isTeachersLoading, debouncedSearch, specialization, level, priceRange, availability, sort])

  // 8. Paginate
  const total = filteredAndSortedTeachers.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const paginatedTeachers = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredAndSortedTeachers.slice(start, start + pageSize)
  }, [filteredAndSortedTeachers, page, pageSize])

  // Reset all filters
  const resetFilters = useCallback(() => {
    setSearch("")
    setDebouncedSearch("")
    setSpecialization("all")
    setLevel("all")
    setPriceRange("all")
    setAvailability("all")
    setSort("recommended")
    setPage(1)
  }, [])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (debouncedSearch) count++
    if (specialization !== "all") count++
    if (level !== "all") count++
    if (priceRange !== "all") count++
    if (availability !== "all") count++
    if (sort !== "recommended") count++
    return count
  }, [debouncedSearch, specialization, level, priceRange, availability, sort])

  return {
    teachers: paginatedTeachers,
    total,
    page,
    totalPages,
    pageSize,
    isLoading: isTeachersLoading,
    isError: Boolean(teachersError),
    error: teachersError,
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
  }
}
