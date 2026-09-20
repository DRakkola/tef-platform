import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  Users,
  Key,
  Flame,
  AlertTriangle,
  RefreshCw,
  Plus,
  Power,
  UserX,
  Copy,
  Check,
  CheckCircle2,
  Layers,
} from "lucide-react";
import { AdminLayout } from "@/features/admin/AdminLayout";
import { Button } from "@/components/ui/button";

interface BetaOverview {
  total_beta_users: number;
  active_users_7d: number;
  recent_registrations_24h: number;
  assessment_completions: number;
  writing_submissions: number;
  speaking_sessions: number;
  practice_sessions: number;
  teacher_bookings: number;
  total_revenue_cents: number;
  ai_total_cost_usd: number;
  open_support_tickets: number;
  unresolved_incidents_count: number;
  feature_flags: Record<string, boolean>;
  server_timestamp: string;
}

interface BetaCohort {
  id: string;
  name: string;
  description: string | null;
  max_students: number;
  max_teachers: number;
  is_active: boolean;
  students_count: number;
  teachers_count: number;
  created_at: string;
}

interface BetaInvitation {
  id: string;
  token_prefix: string;
  cohort_id: string | null;
  cohort_name: string | null;
  role: string;
  max_uses: number;
  used_count: number;
  expires_at: string;
  environment: string;
  is_revoked: boolean;
  created_at: string;
  plaintext_token?: string;
}

export const AdminBetaControlPage: React.FC = () => {
  const [overview, setOverview] = useState<BetaOverview | null>(null);
  const [cohorts, setCohorts] = useState<BetaCohort[]>([]);
  const [invitations, setInvitations] = useState<BetaInvitation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [showCohortModal, setShowCohortModal] = useState<boolean>(false);
  const [showSuspendModal, setShowSuspendModal] = useState<boolean>(false);
  const [createdSecretToken, setCreatedSecretToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<boolean>(false);

  // Form states
  const [inviteRole, setInviteRole] = useState<string>("student");
  const [inviteCohortId, setInviteCohortId] = useState<string>("");
  const [inviteMaxUses, setInviteMaxUses] = useState<number>(1);
  const [inviteDays, setInviteDays] = useState<number>(30);

  const [newCohortName, setNewCohortName] = useState<string>("");
  const [newCohortDesc, setNewCohortDesc] = useState<string>("");
  const [newCohortMaxStudents, setNewCohortMaxStudents] = useState<number>(50);
  const [newCohortMaxTeachers, setNewCohortMaxTeachers] = useState<number>(15);

  const [suspendUserId, setSuspendUserId] = useState<string>("");
  const [suspendAction, setSuspendAction] = useState<boolean>(true);
  const [suspendReason, setSuspendReason] = useState<string>("");

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const [resOverview, resCohorts, resInvites] = await Promise.all([
        fetch("/api/v1/admin/beta/overview", { headers }),
        fetch("/api/v1/admin/beta/cohorts", { headers }),
        fetch("/api/v1/admin/beta/invitations", { headers }),
      ]);

      if (!resOverview.ok) throw new Error("Impossible de charger la vue d'ensemble bêta.");
      const dataOverview = await resOverview.json();
      setOverview(dataOverview);

      if (resCohorts.ok) {
        setCohorts(await resCohorts.json());
      }
      if (resInvites.ok) {
        setInvitations(await resInvites.json());
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const handleToggleFeature = async (featureName: string, currentVal: boolean) => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/v1/admin/beta/controls/toggle-feature", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          feature_name: featureName,
          enabled: !currentVal,
        }),
      });
      if (!res.ok) throw new Error("Échec de la mise à jour du drapeau.");
      await fetchOverview();
    } catch (err: any) {
      alert("Erreur : " + err.message);
    }
  };

  const handleCreateCohort = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/v1/admin/beta/cohorts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: newCohortName,
          description: newCohortDesc || null,
          max_students: Number(newCohortMaxStudents),
          max_teachers: Number(newCohortMaxTeachers),
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Erreur de création de cohorte");
      }
      setShowCohortModal(false);
      setNewCohortName("");
      setNewCohortDesc("");
      await fetchOverview();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/v1/admin/beta/invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          role: inviteRole,
          cohort_id: inviteCohortId || null,
          max_uses: Number(inviteMaxUses),
          valid_days: Number(inviteDays),
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Erreur de génération d'invitation");
      }
      const data = await res.json();
      setCreatedSecretToken(data.plaintext_token);
      await fetchOverview();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!confirm("Voulez-vous vraiment révoquer ce jeton d'invitation ?")) return;
    try {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/v1/admin/beta/invitations/${invitationId}/revoke`, {
        method: "POST",
        headers,
      });
      if (!res.ok) throw new Error("Échec de la révocation.");
      await fetchOverview();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSuspendUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/v1/admin/beta/controls/suspend-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          user_id: suspendUserId.trim(),
          suspended: suspendAction,
          reason: suspendReason.trim() || null,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Erreur de modification du compte");
      }
      setShowSuspendModal(false);
      setSuspendUserId("");
      setSuspendReason("");
      alert(`Action effectuée avec succès.`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const copyTokenToClipboard = () => {
    if (createdSecretToken) {
      navigator.clipboard.writeText(createdSecretToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  return (
    <AdminLayout activeTab="Contrôle Bêta">
      <div className="space-y-8 p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-amber-500/10 text-amber-400 text-xs font-semibold px-2.5 py-1 rounded-full border border-amber-500/20">
                Bêta Privée Restreinte
              </span>
              <span className="text-xs text-slate-500">10-50 Étudiants · 5-15 Tuteurs</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight mt-1 flex items-center gap-3">
              <Flame className="h-6 w-6 text-amber-400" />
              Cockpit de Contrôle Bêta & Kill-Switches
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchOverview}
              disabled={loading}
              className="border-slate-800 hover:bg-slate-800 text-slate-300 text-xs flex items-center gap-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Actualiser</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setShowSuspendModal(true)}
              className="bg-red-950/40 border border-red-800 text-red-200 hover:bg-red-900/60 text-xs flex items-center gap-2"
            >
              <UserX className="h-3.5 w-3.5" />
              <span>Suspendre Utilisateur</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setShowInviteModal(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs flex items-center gap-2"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Générer Invitation</span>
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-950/40 border border-red-800 text-red-200 text-xs p-4 rounded-xl flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Emergency Kill-Switches Panel */}
        {overview && (
          <div className="bg-slate-900/90 border border-amber-900/40 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-center text-amber-400">
                  <Power className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Coupe-Circuits d'Urgence (Kill-Switches)</h2>
                  <p className="text-xs text-slate-400">Bascule dynamique immédiate via Redis sans redéploiement.</p>
                </div>
              </div>
              <span className="text-xs font-mono text-slate-500">Persisté & Audité</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { key: "ai_writing", label: "IA Rédaction" },
                { key: "ai_speaking", label: "IA Oral" },
                { key: "practice_pool", label: "Practice Pool" },
                { key: "teacher_bookings", label: "Réservations" },
                { key: "checkout", label: "Facturation" },
                { key: "maintenance_mode", label: "Maintenance" },
              ].map((sw) => {
                const isEnabled = overview.feature_flags[sw.key] ?? true;
                const isMaintenance = sw.key === "maintenance_mode";
                const activeColor = isMaintenance ? "text-red-400 border-red-500/30 bg-red-950/30" : "text-emerald-400 border-emerald-500/30 bg-emerald-950/30";
                const disabledColor = isMaintenance ? "text-slate-400 border-slate-800 bg-slate-950" : "text-red-400 border-red-500/30 bg-red-950/30";

                return (
                  <div
                    key={sw.key}
                    className={`border rounded-xl p-3 flex flex-col justify-between gap-3 ${
                      isEnabled ? activeColor : disabledColor
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-white">{sw.label}</div>
                      <div className="text-[10px] opacity-75 font-mono">
                        {isMaintenance ? (isEnabled ? "ACTIVÉ (BLOCAGE)" : "OFFLINE (NORMAL)") : (isEnabled ? "ACTIF" : "DÉSACTIVÉ")}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleFeature(sw.key, isEnabled)}
                      className="text-xs h-7 border-current hover:bg-white/10"
                    >
                      {isEnabled ? "Désactiver" : "Activer"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Overview Metric Cards */}
        {overview && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
              <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
                <span>Utilisateurs Bêta</span>
                <Users className="h-4 w-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-bold text-white">{overview.total_beta_users}</div>
              <div className="text-[11px] text-slate-500">{overview.active_users_7d} actifs (7j)</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
              <div className="text-xs text-slate-400 font-medium">Inscriptions 24h</div>
              <div className="text-2xl font-bold text-white">{overview.recent_registrations_24h}</div>
              <div className="text-[11px] text-emerald-400">+ Nouveaux inscrits</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
              <div className="text-xs text-slate-400 font-medium">Examens Réalisés</div>
              <div className="text-2xl font-bold text-white">{overview.assessment_completions}</div>
              <div className="text-[11px] text-slate-500">Diagnostics complets</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
              <div className="text-xs text-slate-400 font-medium">Rédactions & Oraux</div>
              <div className="text-2xl font-bold text-white">
                {overview.writing_submissions + overview.speaking_sessions}
              </div>
              <div className="text-[11px] text-slate-500">{overview.practice_sessions} audio pairs</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
              <div className="text-xs text-slate-400 font-medium">Consommation IA</div>
              <div className="text-2xl font-bold text-white">${overview.ai_total_cost_usd.toFixed(2)}</div>
              <div className="text-[11px] text-slate-500">Plafonds respectés</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
              <div className="text-xs text-slate-400 font-medium">Tickets Support</div>
              <div className="text-2xl font-bold text-white">{overview.open_support_tickets}</div>
              <div className="text-[11px] text-amber-400">{overview.unresolved_incidents_count} incidents</div>
            </div>
          </div>
        )}

        {/* Cohorts and Invitations Tabs/Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Cohorts Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Cohortes de Test</h3>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCohortModal(true)}
                className="text-xs border-slate-800 hover:bg-slate-800 text-slate-300 flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Créer Cohorte</span>
              </Button>
            </div>

            {cohorts.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">Aucune cohorte configurée.</div>
            ) : (
              <div className="space-y-3">
                {cohorts.map((c) => (
                  <div key={c.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-sm text-white">{c.name}</div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                        {c.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {c.description && <div className="text-xs text-slate-400">{c.description}</div>}
                    <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                      <span>Étudiants : {c.students_count} / {c.max_students}</span>
                      <span>Tuteurs : {c.teachers_count} / {c.max_teachers}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Invitations Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Jetons d'Invitation Bêta</h3>
              </div>
              <span className="text-xs text-slate-500 font-mono">{invitations.length} généré(s)</span>
            </div>

            {invitations.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">Aucune invitation active.</div>
            ) : (
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {invitations.map((inv) => (
                  <div key={inv.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-indigo-400">{inv.token_prefix}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 uppercase font-semibold">
                          {inv.role}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-3">
                        <span>Utilisations : {inv.used_count} / {inv.max_uses}</span>
                        <span>Expire le : {new Date(inv.expires_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div>
                      {inv.is_revoked ? (
                        <span className="text-xs text-red-400 font-medium">Révoqué</span>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRevokeInvitation(inv.id)}
                          className="text-xs text-red-400 hover:bg-red-950/40 hover:text-red-300 h-7"
                        >
                          Révoquer
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal: New Secret Token Display */}
        {createdSecretToken && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
              <div className="flex items-center gap-3 text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
                <h3 className="text-lg font-bold text-white">Jeton d'Invitation Généré</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Ce jeton d'invitation n'est affiché qu'une seule fois. Copiez-le et transmettez-le au candidat de la bêta :
              </p>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-sm text-emerald-300 break-all flex items-center justify-between gap-3">
                <span>{createdSecretToken}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyTokenToClipboard}
                  className="shrink-0 border-slate-800 hover:bg-slate-800 text-xs"
                >
                  {copiedToken ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    setCreatedSecretToken(null);
                    setShowInviteModal(false);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
                >
                  J'ai bien noté le jeton
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Generate Invitation */}
        {showInviteModal && !createdSecretToken && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-base font-bold text-white">Générer une Invitation Bêta</h3>
              <form onSubmit={handleCreateInvitation} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Rôle</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  >
                    <option value="student">Étudiant (Student)</option>
                    <option value="teacher">Tuteur (Teacher)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Cohorte Associée</label>
                  <select
                    value={inviteCohortId}
                    onChange={(e) => setInviteCohortId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  >
                    <option value="">Aucune cohorte spécifique</option>
                    {cohorts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium">Max Utilisations</label>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={inviteMaxUses}
                      onChange={(e) => setInviteMaxUses(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium">Validité (Jours)</label>
                    <input
                      type="number"
                      min={1}
                      max={180}
                      value={inviteDays}
                      onChange={(e) => setInviteDays(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowInviteModal(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    Annuler
                  </Button>
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white">
                    Créer le Jeton
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Create Cohort */}
        {showCohortModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-base font-bold text-white">Créer une Cohorte Bêta</h3>
              <form onSubmit={handleCreateCohort} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Nom de la Cohorte</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Cohorte Bêta Octobre"
                    value={newCohortName}
                    onChange={(e) => setNewCohortName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Description</label>
                  <textarea
                    rows={2}
                    placeholder="Objectif ou public ciblé..."
                    value={newCohortDesc}
                    onChange={(e) => setNewCohortDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium">Max Étudiants</label>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={newCohortMaxStudents}
                      onChange={(e) => setNewCohortMaxStudents(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium">Max Tuteurs</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={newCohortMaxTeachers}
                      onChange={(e) => setNewCohortMaxTeachers(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowCohortModal(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    Annuler
                  </Button>
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white">
                    Créer la Cohorte
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Suspend User */}
        {showSuspendModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-red-800/60 rounded-2xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center gap-2 text-red-400">
                <ShieldAlert className="h-5 w-5" />
                <h3 className="text-base font-bold text-white">Suspendre / Réactiver un Compte</h3>
              </div>
              <p className="text-xs text-slate-400">Cette action est immédiatement auditée dans le registre d'audit.</p>
              <form onSubmit={handleSuspendUser} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Identifiant Utilisateur (UUID)</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: 123e4567-e89b-12d3-a456-426614174000"
                    value={suspendUserId}
                    onChange={(e) => setSuspendUserId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Action</label>
                  <select
                    value={suspendAction ? "suspend" : "reactivate"}
                    onChange={(e) => setSuspendAction(e.target.value === "suspend")}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  >
                    <option value="suspend">Suspendre le compte (is_active = false)</option>
                    <option value="reactivate">Réactiver le compte (is_active = true)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Motif (Obligatoire pour audit)</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Violation des règles d'usage, abus de requêtes..."
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowSuspendModal(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    Annuler
                  </Button>
                  <Button type="submit" className="bg-red-600 hover:bg-red-500 text-white">
                    Appliquer la Sanction
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
