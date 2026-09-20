import React, { useMemo } from "react"
import { Globe, Calendar as CalendarIcon } from "lucide-react"

export interface BookingDateSelectorProps {
  selectedDate: string
  onSelectDate: (date: string) => void
  userTimezone: string
}

export const BookingDateSelector: React.FC<BookingDateSelectorProps> = ({
  selectedDate,
  onSelectDate,
  userTimezone,
}) => {
  // Generate next 14 bookable days
  const days = useMemo(() => {
    const list: { dateStr: string; weekday: string; dayNum: number; month: string; isToday: boolean }[] = []
    const now = new Date()

    for (let i = 0; i < 14; i++) {
      const d = new Date(now.getTime() + i * 86400000)
      const dateStr = d.toISOString().split("T")[0]
      const weekday = d.toLocaleDateString("fr-FR", { weekday: "short" })
      const dayNum = d.getDate()
      const month = d.toLocaleDateString("fr-FR", { month: "short" })
      list.push({
        dateStr,
        weekday: weekday.replace(".", ""),
        dayNum,
        month: month.replace(".", ""),
        isToday: i === 0,
      })
    }
    return list
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarIcon className="size-4 text-primary" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-foreground">
            Choisissez une date
          </h3>
        </div>

        {/* Explicit Timezone Indicator */}
        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-md border border-border/50">
          <Globe className="size-3 text-muted-foreground shrink-0" aria-hidden="true" />
          <span>
            Heures affichées sur votre fuseau : <strong className="text-foreground">{userTimezone}</strong>
          </span>
        </div>
      </div>

      {/* Horizontal Date Selector */}
      <div
        role="radiogroup"
        aria-label="Sélection de la date"
        className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar -mx-1 px-1"
      >
        {days.map((item) => {
          const isSelected = selectedDate === item.dateStr

          return (
            <button
              key={item.dateStr}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelectDate(item.dateStr)}
              className={`flex flex-col items-center justify-center min-w-[4.25rem] py-2.5 px-2 rounded-xl border text-center transition-all cursor-pointer shrink-0 ${
                isSelected
                  ? "border-primary bg-primary text-primary-foreground shadow-xs font-semibold ring-2 ring-primary/20"
                  : "border-border/80 bg-card hover:bg-muted/40 hover:border-primary/40 text-foreground"
              }`}
            >
              <span className={`text-[11px] uppercase font-medium ${isSelected ? "text-primary-foreground/90" : "text-muted-foreground"}`}>
                {item.isToday ? "Aujourd'hui" : item.weekday}
              </span>
              <span className="text-base font-bold font-mono my-0.5">
                {item.dayNum}
              </span>
              <span className={`text-[10px] capitalize ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {item.month}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
