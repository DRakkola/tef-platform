import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface TeacherPaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  className?: string
}

export function TeacherPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  className,
}: TeacherPaginationProps) {
  if (totalPages <= 1) return null

  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  return (
    <nav
      role="navigation"
      aria-label="Pagination des enseignants"
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-border/60 ${
        className || ""
      }`}
    >
      <p className="text-xs text-muted-foreground">
        Affichage de <span className="font-semibold text-foreground">{startItem}</span> à{" "}
        <span className="font-semibold text-foreground">{endItem}</span> sur{" "}
        <span className="font-semibold text-foreground">{totalItems}</span> enseignant
        {totalItems > 1 ? "s" : ""}
      </p>

      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Page précédente"
          className="h-8 px-2.5 text-xs cursor-pointer disabled:cursor-not-allowed"
        >
          <ChevronLeft className="size-3.5 mr-1" />
          <span className="hidden sm:inline">Précédent</span>
        </Button>

        <div className="flex items-center gap-1">
          {pages.map((p) => {
            // If many pages, keep first, last, and window around current
            if (
              p === 1 ||
              p === totalPages ||
              (p >= currentPage - 1 && p <= currentPage + 1)
            ) {
              return (
                <Button
                  key={p}
                  variant={p === currentPage ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPageChange(p)}
                  aria-label={`Page ${p}`}
                  aria-current={p === currentPage ? "page" : undefined}
                  className={`size-8 p-0 text-xs font-mono cursor-pointer ${
                    p === currentPage ? "font-bold" : "text-muted-foreground"
                  }`}
                >
                  {p}
                </Button>
              )
            }
            if (p === currentPage - 2 || p === currentPage + 2) {
              return (
                <span key={p} className="px-1 text-muted-foreground text-xs select-none">
                  ...
                </span>
              )
            }
            return null
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Page suivante"
          className="h-8 px-2.5 text-xs cursor-pointer disabled:cursor-not-allowed"
        >
          <span className="hidden sm:inline">Suivant</span>
          <ChevronRight className="size-3.5 ml-1" />
        </Button>
      </div>
    </nav>
  )
}
