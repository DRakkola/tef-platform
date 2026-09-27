import React, { useState, useEffect } from "react";
import {
  LifeBuoy,
  CheckCircle2,
  Save,
  ShieldCheck,
} from "lucide-react";
import { AdminLayout } from "@/features/admin/AdminLayout";
import { Button } from "@/components/ui/button";

interface SupportTicket {
  id: string;
  user_id: string | null;
  category: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

export const AdminSupportPage: React.FC = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  // Edit triage state
  const [editStatus, setEditStatus] = useState<string>("open");
  const [editPriority, setEditPriority] = useState<string>("medium");
  const [editNotes, setEditNotes] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/v1/admin/support/tickets", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
        if (data.length > 0 && !selectedTicket) {
          setSelectedTicket(data[0]);
          setEditStatus(data[0].status);
          setEditPriority(data[0].priority);
          setEditNotes(data[0].internal_notes || "");
        }
      }
    } catch (err) {
      console.warn("Failed to fetch support tickets:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleSelectTicket = (t: SupportTicket) => {
    setSelectedTicket(t);
    setEditStatus(t.status);
    setEditPriority(t.priority);
    setEditNotes(t.internal_notes || "");
    setSaveSuccess(false);
  };

  const handleSaveTriage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;

    setSaving(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/v1/admin/support/tickets/${selectedTicket.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          status: editStatus,
          priority: editPriority,
          internal_notes: editNotes,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setSelectedTicket(updated);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
        fetchTickets();
      }
    } catch (err) {
      console.warn("Update failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <span className="bg-destructive/10 text-destructive border border-destructive/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Urgent</span>;
      case "high":
        return <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Haut</span>;
      case "medium":
        return <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Moyen</span>;
      default:
        return <span className="bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded text-[10px] uppercase">Bas</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase">Ouvert</span>;
      case "in_progress":
        return <span className="text-amber-600 dark:text-amber-400 font-bold text-xs uppercase">En cours</span>;
      case "resolved":
        return <span className="text-primary font-bold text-xs uppercase">Résolu</span>;
      case "closed":
        return <span className="text-muted-foreground font-bold text-xs uppercase">Fermé</span>;
      default:
        return <span className="text-muted-foreground text-xs uppercase">{status}</span>;
    }
  };

  return (
    <AdminLayout activeTab="support">
      <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
        {/* Header */}
        <div className="border-b border-border pb-5">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase mb-1">
            <LifeBuoy className="h-4 w-4" />
            <span>Support Client & Triage Opérationnel</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            File de Support et Incidents Beta
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Traitement des signalements d'utilisateurs, escalades et notes techniques internes.
          </p>
        </div>

        {/* Master-Detail layout */}
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : tickets.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center space-y-3 shadow-xs">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <div className="font-bold text-base text-foreground">Aucun ticket en attente</div>
            <p className="text-xs text-muted-foreground">Tous les tickets de support ont été traités.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Ticket List */}
            <div className="lg:col-span-5 bg-card border border-border rounded-xl p-4 space-y-3 h-[700px] overflow-y-auto shadow-xs">
              <div className="text-xs font-semibold text-muted-foreground px-2 pb-1 border-b border-border">
                {tickets.length} tickets enregistrés
              </div>

              {tickets.map((t) => {
                const isSelected = selectedTicket?.id === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectTicket(t)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-primary/10 border-primary shadow-xs"
                        : "bg-muted/30 border-border hover:bg-muted/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-sm text-foreground line-clamp-1">{t.subject}</div>
                      {getPriorityBadge(t.priority)}
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="text-muted-foreground capitalize">{t.category}</span>
                      {getStatusBadge(t.status)}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-2 font-mono">
                      {new Date(t.created_at).toLocaleDateString()} à {new Date(t.created_at).toLocaleTimeString()}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right Ticket Detail & Triage */}
            <div className="lg:col-span-7 bg-card border border-border rounded-xl p-6 space-y-6 shadow-xs">
              {selectedTicket ? (
                <>
                  <div className="border-b border-border pb-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-mono text-muted-foreground">ID: {selectedTicket.id}</div>
                      {getPriorityBadge(selectedTicket.priority)}
                    </div>
                    <h2 className="text-xl font-bold text-foreground">{selectedTicket.subject}</h2>
                    <div className="text-xs text-muted-foreground">
                      Catégorie : <span className="text-foreground font-medium capitalize">{selectedTicket.category}</span>
                    </div>
                  </div>

                  {/* Description Box */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-foreground">Description du problème :</div>
                    <div className="bg-muted/40 p-4 rounded-xl border border-border text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                      {selectedTicket.description}
                    </div>
                  </div>

                  {/* Triage Form */}
                  <form onSubmit={handleSaveTriage} className="space-y-4 pt-4 border-t border-border">
                    <div className="text-sm font-bold text-foreground flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <span>Mise à jour du Triage & Notes d'Ingénierie</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1">Statut</label>
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                          className="w-full bg-background border border-border rounded-lg p-2.5 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                        >
                          <option value="open">Ouvert (Open)</option>
                          <option value="in_progress">En cours (In Progress)</option>
                          <option value="waiting_user">En attente utilisateur</option>
                          <option value="resolved">Résolu (Resolved)</option>
                          <option value="closed">Fermé (Closed)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1">Priorité</label>
                        <select
                          value={editPriority}
                          onChange={(e) => setEditPriority(e.target.value)}
                          className="w-full bg-background border border-border rounded-lg p-2.5 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                        >
                          <option value="low">Basse (Low)</option>
                          <option value="medium">Moyenne (Medium)</option>
                          <option value="high">Haute (High)</option>
                          <option value="urgent">Urgente (Urgent)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Notes internes d'ingénierie (non visibles par l'utilisateur)
                      </label>
                      <textarea
                        rows={4}
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Raison de la résolution, commits associés, correctif..."
                        className="w-full bg-background border border-border rounded-lg p-3 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none resize-none"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      {saveSuccess ? (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Triage enregistré avec succès !</span>
                        </div>
                      ) : (
                        <div />
                      )}

                      <Button
                        type="submit"
                        disabled={saving}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs flex items-center gap-1.5"
                      >
                        <Save className="h-3.5 w-3.5" />
                        <span>Enregistrer les modifications</span>
                      </Button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="text-center py-20 text-xs text-muted-foreground">
                  Sélectionnez un ticket dans la liste pour afficher les détails.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
