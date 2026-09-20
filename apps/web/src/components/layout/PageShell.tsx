import * as React from "react"
import { cn } from "@/lib/utils"

export interface PageShellProps extends React.ComponentProps<"div"> {
  children: React.ReactNode
  maxWidth?: "default" | "compact" | "wide" | "full"
}

export function PageShell({
  children,
  maxWidth = "default",
  className,
  ...props
}: PageShellProps) {
  const maxWidthClass = {
    compact: "max-w-4xl",
    default: "max-w-6xl",
    wide: "max-w-7xl",
    full: "max-w-full",
  }[maxWidth]

  return (
    <div
      className={cn(
        "mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8 min-w-0",
        maxWidthClass,
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
