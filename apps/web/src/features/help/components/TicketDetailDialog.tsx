import React from "react";
import { Clock, Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SupportTicket } from "../types";

interface TicketDetailDialogProps {
  ticket: SupportTicket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function formatTicketDate(isoString?: string | null): string {
  if (!isoString) return "—";
  try {
    return new Intl.DateTimeFormat("fr-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

export const getStatusBadge = (status: string) => {
  switch (status) {
    case "open":
      return (
        <Badge variant="outline" className="text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-500/10 text-xs">
          Ouverte
        </Badge>
      );
    case "in_progress":
      return (
        <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 text-xs">
          En cours
        </Badge>
      );
    case "waiting_user":
      return (
        <Badge variant="outline" className="text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/10 text-xs">
          En attente de votre réponse
        </Badge>
      );
    case "resolved":
      return (
        <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 text-xs">
          Résolue
        </Badge>
      );
    case "closed":
      return (
        <Badge variant="secondary" className="text-xs">
          Fermée
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="text-xs">
          {status}
        </Badge>
      );
  }
};

export const TicketDetailDialog: React.FC<TicketDetailDialogProps> = ({
  ticket,
  open,
  onOpenChange,
}) => {
  if (!ticket) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-mono text-muted-foreground">
              Réf : {ticket.id}
            </span>
            {getStatusBadge(ticket.status)}
          </div>
          <DialogTitle className="text-base sm:text-lg font-bold text-foreground leading-snug">
            {ticket.subject}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Calendar className="size-3.5" />
              <span>Créée le {formatTicketDate(ticket.created_at)}</span>
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Ticket Message */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Votre message
            </span>
            <div className="p-3.5 rounded-lg bg-muted/30 border border-border/80 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
              {ticket.description}
            </div>
          </div>

          {/* Status Context Info */}
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-foreground space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <Clock className="size-3.5 text-primary" />
              <span>Dernière mise à jour</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {formatTicketDate(ticket.updated_at || ticket.created_at)} — Les réponses de nos conseillers vous sont directement transmises par e-mail.
            </p>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs w-full sm:w-auto"
          >
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
