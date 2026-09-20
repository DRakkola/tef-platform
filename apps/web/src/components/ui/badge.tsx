import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 select-none",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground font-semibold shadow-2xs",
        secondary:
          "border-transparent bg-muted text-foreground hover:bg-muted/80 font-medium",
        teal:
          "border-transparent bg-teal text-teal-foreground font-medium shadow-2xs",
        accent:
          "border-primary/30 bg-primary/15 text-primary font-semibold",
        destructive:
          "border-destructive/25 bg-destructive/15 text-destructive font-medium",
        outline:
          "text-foreground border-border bg-card/60 font-medium",
        success:
          "border-emerald-500/25 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-medium",
        warning:
          "border-amber-500/25 bg-amber-500/15 text-amber-900 dark:text-amber-300 font-medium",
        info:
          "border-blue-500/25 bg-blue-500/15 text-blue-900 dark:text-blue-300 font-medium",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-2 py-0.25 text-[10px]",
        lg: "px-3.5 py-1 text-xs font-semibold",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
