import React, { useState } from "react";
import { MessageSquare, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TicketDetailDialog, getStatusBadge, formatTicketDate } from "./TicketDetailDialog";
import type { SupportTicket } from "../types";

interface MyRequestsSectionProps {
  tickets: SupportTicket[];
  isLoading: boolean;
  onOpenTicket?: (ticketId: string) => void;
}

export const MyRequestsSection: React.FC<MyRequestsSectionProps> = ({
  tickets,
  isLoading,
  onOpenTicket,
}) => {
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  if (isLoading) {
    return (
      <Card className="border border-border/80 shadow-xs bg-card">
        <CardHeader className="border-b border-border/60 pb-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-1" />
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (tickets.length === 0) {
    return null;
  }

  const handleSelect = (t: SupportTicket) => {
    setSelectedTicket(t);
    if (onOpenTicket) {
      onOpenTicket(t.id);
    }
  };

  return (
    <Card className="border border-border/80 shadow-xs bg-card overflow-hidden">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
            <MessageSquare className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base sm:text-lg font-bold text-foreground">
              Mes demandes de support
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Consultez l'état et l'historique de vos échanges avec notre assistance.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Desktop Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Sujet</th>
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {tickets.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => handleSelect(t)}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4">
                    <p className="font-semibold text-foreground truncate max-w-xs md:max-w-md">
                      {t.subject}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground">
                      #{t.id.slice(0, 8)}
                    </p>
                  </td>
                  <td className="py-3 px-4">{getStatusBadge(t.status)}</td>
                  <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                    {formatTicketDate(t.created_at)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                      <span>Détails</span>
                      <ArrowRight className="size-3 ml-1" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="sm:hidden divide-y divide-border/60">
          {tickets.map((t) => (
            <div
              key={t.id}
              onClick={() => handleSelect(t)}
              className="p-4 space-y-2 hover:bg-muted/30 active:bg-muted/40 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-mono text-muted-foreground">
                  #{t.id.slice(0, 8)}
                </span>
                {getStatusBadge(t.status)}
              </div>
              <h4 className="font-semibold text-xs text-foreground leading-snug">
                {t.subject}
              </h4>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                <span>{formatTicketDate(t.created_at)}</span>
                <span className="text-primary font-medium flex items-center gap-1">
                  Voir <ArrowRight className="size-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      {/* Ticket Detail Dialog */}
      <TicketDetailDialog
        ticket={selectedTicket}
        open={Boolean(selectedTicket)}
        onOpenChange={(open) => !open && setSelectedTicket(null)}
      />
    </Card>
  );
};
