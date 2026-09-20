import React from "react"
import { CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { BookingStatus } from "../types"

export interface BookingStatusBadgeProps {
  status: BookingStatus
  className?: string
}

export const BookingStatusBadge: React.FC<BookingStatusBadgeProps> = ({
  status,
  className,
}) => {
  switch (status) {
    case "confirmed":
      return (
        <Badge
          variant="success"
          size="sm"
          className={`gap-1 font-medium ${className || ""}`}
        >
          <CheckCircle2 className="size-3" aria-hidden="true" />
          <span>Confirmée</span>
        </Badge>
      )
    case "requested":
      return (
        <Badge
          variant="warning"
          size="sm"
          className={`gap-1 font-medium ${className || ""}`}
        >
          <Clock className="size-3" aria-hidden="true" />
          <span>En attente</span>
        </Badge>
      )
    case "completed":
      return (
        <Badge
          variant="secondary"
          size="sm"
          className={`gap-1 font-medium text-muted-foreground ${className || ""}`}
        >
          <CheckCircle2 className="size-3 text-muted-foreground" aria-hidden="true" />
          <span>Terminée</span>
        </Badge>
      )
    case "cancelled":
      return (
        <Badge
          variant="destructive"
          size="sm"
          className={`gap-1 font-medium ${className || ""}`}
        >
          <XCircle className="size-3" aria-hidden="true" />
          <span>Annulée</span>
        </Badge>
      )
    case "no_show":
      return (
        <Badge
          variant="destructive"
          size="sm"
          className={`gap-1 font-medium ${className || ""}`}
        >
          <AlertCircle className="size-3" aria-hidden="true" />
          <span>Absence</span>
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" size="sm" className={className}>
          <span>{status}</span>
        </Badge>
      )
  }
}
