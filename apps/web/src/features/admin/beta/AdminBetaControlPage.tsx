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
  Sliders,
  RotateCcw,
  Edit3,
  Trash2,
  Search,
  Gauge,
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

interface BetaRateLimitItem {
  id: string;
  scope: string;
  action: string;
  action_name_fr: string;
  limit_value: number;
  window: string;
  cohort_id?: string | null;
  cohort_name?: string | null;
  user_id?: string | null;
  user_email?: string | null;
  notes?: string | null;
  updated_at: string;
}

interface ActionMeta {
  name_fr: string;
  default: number;
  window: string;
  current_global_limit: number;
  is_overridden: boolean;
}

interface BetaRatesConfig {
  actions: Record<string, ActionMeta>;
  global_limits: BetaRateLimitItem[];
  cohort_limits: BetaRateLimitItem[];
  student_overrides: BetaRateLimitItem[];
}

interface StudentQuotaItem {
  name: string;
  limit: number;
  consumed: number;
  remaining: number;
  window: string;
  is_custom: boolean;
}

interface BetaStudentRateStatus {
  user_id: string;
  email: string;
  cohort_id: string | null;
  cohort_name: string | null;
  quotas: Record<string, StudentQuotaItem>;
  has_overrides: boolean;
}

export const AdminBetaControlPage: React.FC = () => {
  const [overview, setOverview] = useState<BetaOverview | null>(null);
  const [cohorts, setCohorts] = useState<BetaCohort[]>([]);
  const [invitations, setInvitations] = useState<BetaInvitation[]>([]);
  const [ratesConfig, setRatesConfig] = useState<BetaRatesConfig | null>(null);
  const [studentsRates, setStudentsRates] = useState<BetaStudentRateStatus[]>([]);
  const [studentSearch, setStudentSearch] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [showCohortModal, setShowCohortModal] = useState<boolean>(false);
  const [showSuspendModal, setShowSuspendModal] = useState<boolean>(false);
  const [showAdjustRateModal, setShowAdjustRateModal] = useState<boolean>(false);
  const [showResetQuotaModal, setShowResetQuotaModal] = useState<boolean>(false);
  const [createdSecretToken, setCreatedSecretToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<boolean>(false);

  // Form states - Invites & Cohorts
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

  // Form states - Rates Adjustment Modal
  const [rateScope, setRateScope] = useState<"global" | "cohort" | "student">("student");
  const [targetStudentId, setTargetStudentId] = useState<string>("");
  const [targetStudentEmail, setTargetStudentEmail] = useState<string>("");
  const [targetCohortId, setTargetCohortId] = useState<string>("");
  const [rateAction, setRateAction] = useState<string>("ai_oral");
  const [rateLimitValue, setRateLimitValue] = useState<number>(5);
  const [rateNotes, setRateNotes] = useState<string>("");

  // Form states - Reset Quota Modal
  const [resetTargetUser, setResetTargetUser] = useState<{ id: string; email: string } | null>(null);
  const [resetAction, setResetAction] = useState<string>("");
  const [resetReason, setResetReason] = useState<string>("");

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem("auth_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();

      const [resOverview, resCohorts, resInvites, resRates, resStudents] = await Promise.all([
        fetch("/api/v1/admin/beta/overview", { headers }),
        fetch("/api/v1/admin/beta/cohorts", { headers }),
        fetch("/api/v1/admin/beta/invitations", { headers }),
        fetch("/api/v1/admin/beta/rates", { headers }),
        fetch("/api/v1/admin/beta/rates/students?limit=50", { headers }),
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
      if (resRates.ok) {
        setRatesConfig(await resRates.json());
      }
      if (resStudents.ok) {
        const studData = await resStudents.json();
        setStudentsRates(studData.students || []);
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
      const headers = { ...getAuthHeaders(), "Content-Type": "application/json" };
      const res = await fetch("/api/v1/admin/beta/controls/toggle-feature", {
        method: "POST",
        headers,
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
      const headers = { ...getAuthHeaders(), "Content-Type": "application/json" };
      const res = await fetch("/api/v1/admin/beta/cohorts", {
        method: "POST",
        headers,
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
      const headers = { ...getAuthHeaders(), "Content-Type": "application/json" };
      const res = await fetch("/api/v1/admin/beta/invitations", {
        method: "POST",
        headers,
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
      const headers = getAuthHeaders();
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
      const headers = { ...getAuthHeaders(), "Content-Type": "application/json" };
      const res = await fetch("/api/v1/admin/beta/controls/suspend-user", {
        method: "POST",
        headers,
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

  const handleSaveRateLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const headers = { ...getAuthHeaders(), "Content-Type": "application/json" };
      let url = "/api/v1/admin/beta/rates/global";
      let payload: any = { action: rateAction, limit_value: Number(rateLimitValue) };

      if (rateScope === "cohort") {
        if (!targetCohortId) throw new Error("Veuillez sélectionner une cohorte.");
        url = "/api/v1/admin/beta/rates/cohort";
        payload = { cohort_id: targetCohortId, action: rateAction, limit_value: Number(rateLimitValue) };
      } else if (rateScope === "student") {
        if (!targetStudentId) throw new Error("Identifiant étudiant requis.");
        url = "/api/v1/admin/beta/rates/student";
        payload = {
          user_id: targetStudentId.trim(),
          action: rateAction,
          limit_value: Number(rateLimitValue),
          notes: rateNotes.trim() || null,
        };
      }

      const res = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || err.message || "Erreur lors de la mise à jour du plafond");
      }

      setShowAdjustRateModal(false);
      setRateNotes("");
      await fetchOverview();
      alert("Plafond mis à jour avec succès.");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteOverride = async (scope: "global" | "cohort" | "student", id?: string, action?: string) => {
    if (!confirm("Voulez-vous rétablir le plafond par défaut ?")) return;
    try {
      const headers = getAuthHeaders();
      let url = "";
      if (scope === "global" && action) {
        url = `/api/v1/admin/beta/rates/global/${action}`;
      } else if (scope === "cohort" && id && action) {
        url = `/api/v1/admin/beta/rates/cohort/${id}/${action}`;
      } else if (scope === "student" && id && action) {
        url = `/api/v1/admin/beta/rates/student/${id}/${action}`;
      }

      const res = await fetch(url, { method: "DELETE", headers });
      if (!res.ok) throw new Error("Échec de la réinitialisation du plafond.");
      await fetchOverview();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleExecuteResetQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser) return;
    try {
      const headers = { ...getAuthHeaders(), "Content-Type": "application/json" };
      const res = await fetch(`/api/v1/admin/beta/rates/student/${resetTargetUser.id}/reset`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: resetAction || null,
          reason: resetReason.trim() || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || err.message || "Erreur lors de la réinitialisation");
      }

      setShowResetQuotaModal(false);
      setResetTargetUser(null);
      setResetReason("");
      await fetchOverview();
      alert("Quota de consommation réinitialisé avec succès.");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openStudentRateAdjustment = (student: BetaStudentRateStatus, initialAction = "ai_oral") => {
    setRateScope("student");
    setTargetStudentId(student.user_id);
    setTargetStudentEmail(student.email);
    setRateAction(initialAction);
    const currLimit = student.quotas?.[initialAction]?.limit ?? 5;
    setRateLimitValue(currLimit);
    setShowAdjustRateModal(true);
  };

  const openStudentQuotaReset = (student: BetaStudentRateStatus, initialAction = "") => {
    setResetTargetUser({ id: student.user_id, email: student.email });
    setResetAction(initialAction);
    setShowResetQuotaModal(true);
  };

  const copyTokenToClipboard = () => {
    if (createdSecretToken) {
      navigator.clipboard.writeText(createdSecretToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const filteredStudents = studentsRates.filter((s) =>
    studentSearch ? s.email.toLowerCase().includes(studentSearch.toLowerCase()) : true
  );

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
              <span className="text-xs text-slate-500">Contrôle des Taux & Quotas Étudiants</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight mt-1 flex items-center gap-3">
              <Flame className="h-6 w-6 text-amber-400" />
              Cockpit de Contrôle Bêta & Rate Limits
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
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
              onClick={() => {
                setRateScope("global");
                setShowAdjustRateModal(true);
              }}
              className="bg-indigo-600/30 border border-indigo-500/40 text-indigo-200 hover:bg-indigo-600/50 text-xs flex items-center gap-2"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Ajuster Plafonds</span>
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
                const activeColor = isMaintenance
                  ? "text-red-400 border-red-500/30 bg-red-950/30"
                  : "text-emerald-400 border-emerald-500/30 bg-emerald-950/30";
                const disabledColor = isMaintenance
                  ? "text-slate-400 border-slate-800 bg-slate-950"
                  : "text-red-400 border-red-500/30 bg-red-950/30";

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
                        {isMaintenance
                          ? isEnabled
                            ? "ACTIVÉ (BLOCAGE)"
                            : "OFFLINE (NORMAL)"
                          : isEnabled
                          ? "ACTIF"
                          : "DÉSACTIVÉ"}
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

        {/* ================================================================= */}
        {/* SECTION: GESTION & CONTRÔLE DES RATE LIMITS ÉTUDIANTS */}
        {/* ================================================================= */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-indigo-400" />
              <div>
                <h2 className="text-base font-bold text-white">
                  Contrôle & Ajustement des Plafonds Étudiants (Rate Limits)
                </h2>
                <p className="text-xs text-slate-400">
                  Ajustez les quotas d'usage globaux, par cohorte, ou sur-mesure pour un étudiant spécifique.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setRateScope("student");
                setTargetStudentId("");
                setTargetStudentEmail("");
                setShowAdjustRateModal(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Nouveau Plafond Étudiant</span>
            </Button>
          </div>

          {/* 1. Global Platform Quotas */}
          {ratesConfig && ratesConfig.actions && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-indigo-400" />
                    Plafonds Globaux de la Bêta
                  </h3>
                  <p className="text-xs text-slate-400">
                    S'appliquent par défaut à tous les étudiants de la version bêta.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                {Object.entries(ratesConfig.actions).map(([actKey, meta]) => (
                  <div
                    key={actKey}
                    className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2.5 flex flex-col justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono">
                          {meta.window === "daily" ? "Quotidien" : "Hebdo"}
                        </span>
                        {meta.is_overridden ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                            Ajusté
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium">
                            Défaut
                          </span>
                        )}
                      </div>
                      <div className="font-semibold text-xs text-white line-clamp-1" title={meta.name_fr}>
                        {meta.name_fr}
                      </div>
                      <div className="flex items-baseline gap-2 pt-1">
                        <span className="text-2xl font-bold text-white">{meta.current_global_limit}</span>
                        <span className="text-xs text-slate-500 font-mono">
                          / {meta.window === "daily" ? "jour" : "sem"} (défaut: {meta.default})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-slate-900">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRateScope("global");
                          setRateAction(actKey);
                          setRateLimitValue(meta.current_global_limit);
                          setShowAdjustRateModal(true);
                        }}
                        className="text-xs h-7 flex-1 border-slate-800 hover:bg-slate-800 text-slate-300 flex items-center justify-center gap-1"
                      >
                        <Edit3 className="h-3 w-3" />
                        <span>Ajuster</span>
                      </Button>
                      {meta.is_overridden && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteOverride("global", undefined, actKey)}
                          title="Rétablir le défaut"
                          className="text-xs h-7 px-2 text-slate-400 hover:text-red-400 hover:bg-red-950/20"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Cohort Overrides and Student Custom Rates */}
          {ratesConfig &&
            ((ratesConfig.cohort_limits && ratesConfig.cohort_limits.length > 0) ||
              (ratesConfig.student_overrides && ratesConfig.student_overrides.length > 0)) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cohort Overrides */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Layers className="h-4 w-4 text-indigo-400" />
                      Plafonds Personnalisés par Cohorte ({ratesConfig.cohort_limits?.length || 0})
                    </h4>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setRateScope("cohort");
                        setShowAdjustRateModal(true);
                      }}
                      className="text-xs h-6 text-indigo-400 hover:text-indigo-300"
                    >
                      + Ajouter
                    </Button>
                  </div>

                  {(!ratesConfig.cohort_limits || ratesConfig.cohort_limits.length === 0) ? (
                    <div className="text-xs text-slate-500 py-3 text-center">Aucun plafond spécifique configuré.</div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {ratesConfig.cohort_limits.map((cl) => (
                        <div
                          key={cl.id}
                          className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-semibold text-white">{cl.cohort_name || "Cohorte"}</div>
                            <div className="text-[11px] text-slate-400">
                              {cl.action_name_fr} :{" "}
                              <span className="font-bold text-indigo-400">{cl.limit_value}</span> / {cl.window}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteOverride("cohort", cl.cohort_id || undefined, cl.action)}
                            className="h-6 w-6 p-0 text-slate-500 hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Student Overrides */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Users className="h-4 w-4 text-amber-400" />
                      Plafonds Individuels Sur-Mesure ({ratesConfig.student_overrides?.length || 0})
                    </h4>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setRateScope("student");
                        setShowAdjustRateModal(true);
                      }}
                      className="text-xs h-6 text-amber-400 hover:text-amber-300"
                    >
                      + Ajouter
                    </Button>
                  </div>

                  {(!ratesConfig.student_overrides || ratesConfig.student_overrides.length === 0) ? (
                    <div className="text-xs text-slate-500 py-3 text-center">Aucun plafond individuel spécifique.</div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {ratesConfig.student_overrides.map((so) => (
                        <div
                          key={so.id}
                          className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-semibold text-white">{so.user_email}</div>
                            <div className="text-[11px] text-slate-400">
                              {so.action_name_fr} :{" "}
                              <span className="font-bold text-amber-400">{so.limit_value}</span> / {so.window}
                              {so.notes && <span className="italic text-slate-500 ml-1">({so.notes})</span>}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteOverride("student", so.user_id || undefined, so.action)}
                            className="h-6 w-6 p-0 text-slate-500 hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* 3. Live Student Rates & Quotas Monitor */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-emerald-400" />
                  Moniteur & Ajustement en Direct des Quotas Étudiants
                </h3>
                <p className="text-xs text-slate-400">
                  Consommation réelle, plafonds effectifs et réinitialisation immédiate des compteurs.
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filtrer par email..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500"
                />
              </div>
            </div>

            {filteredStudents.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                {studentSearch ? "Aucun étudiant ne correspond à cette recherche." : "Aucun étudiant enregistré."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                      <th className="pb-3 font-semibold">Étudiant</th>
                      <th className="pb-3 font-semibold">Cohorte</th>
                      <th className="pb-3 font-semibold">IA Oral</th>
                      <th className="pb-3 font-semibold">IA Rédaction</th>
                      <th className="pb-3 font-semibold">Practice Pool</th>
                      <th className="pb-3 font-semibold">Réservations</th>
                      <th className="pb-3 font-semibold text-right">Actions Rapides</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredStudents.map((st) => {
                      const oral = st.quotas?.ai_oral;
                      const writing = st.quotas?.ai_writing;
                      const practice = st.quotas?.practice_pool;
                      const bookings = st.quotas?.teacher_booking;

                      const renderQuotaBadge = (q?: StudentQuotaItem) => {
                        if (!q) return <span className="text-slate-600">-</span>;
                        const isExhausted = q.remaining === 0;
                        const isCustom = q.is_custom;
                        return (
                          <div className="inline-flex items-center gap-1.5">
                            <span
                              className={`font-mono text-xs font-semibold ${
                                isExhausted ? "text-red-400" : q.consumed > 0 ? "text-amber-300" : "text-slate-300"
                              }`}
                            >
                              {q.consumed}/{q.limit}
                            </span>
                            {isCustom && (
                              <span
                                className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"
                                title="Plafond sur-mesure"
                              />
                            )}
                          </div>
                        );
                      };

                      return (
                        <tr key={st.user_id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 pr-2">
                            <div className="font-medium text-white">{st.email}</div>
                            {st.has_overrides && (
                              <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                                Quotas personnalisés
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-slate-400">
                            {st.cohort_name ? (
                              <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px]">
                                {st.cohort_name}
                              </span>
                            ) : (
                              <span className="text-slate-600 text-[11px]">-</span>
                            )}
                          </td>
                          <td className="py-3">{renderQuotaBadge(oral)}</td>
                          <td className="py-3">{renderQuotaBadge(writing)}</td>
                          <td className="py-3">{renderQuotaBadge(practice)}</td>
                          <td className="py-3">{renderQuotaBadge(bookings)}</td>
                          <td className="py-3 text-right space-x-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openStudentRateAdjustment(st, "ai_writing")}
                              className="text-[11px] h-7 px-2 border-slate-800 hover:bg-slate-800 text-slate-300"
                            >
                              Ajuster
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openStudentQuotaReset(st)}
                              className="text-[11px] h-7 px-2 text-indigo-400 hover:bg-indigo-950/40 hover:text-indigo-300"
                            >
                              Réinitialiser
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

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
                      <span>
                        Étudiants : {c.students_count} / {c.max_students}
                      </span>
                      <span>
                        Tuteurs : {c.teachers_count} / {c.max_teachers}
                      </span>
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
                  <div
                    key={inv.id}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-indigo-400">{inv.token_prefix}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 uppercase font-semibold">
                          {inv.role}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-3">
                        <span>
                          Utilisations : {inv.used_count} / {inv.max_uses}
                        </span>
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

        {/* Modal: Adjust Rate Limit */}
        {showAdjustRateModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center gap-2 text-indigo-400">
                <Sliders className="h-5 w-5" />
                <h3 className="text-base font-bold text-white">Ajuster un Plafond d'Utilisation</h3>
              </div>
              <form onSubmit={handleSaveRateLimit} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Portée de l'Ajustement</label>
                  <select
                    value={rateScope}
                    onChange={(e) => setRateScope(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  >
                    <option value="student">Étudiant Spécifique (Sur-mesure)</option>
                    <option value="cohort">Cohorte Entière</option>
                    <option value="global">Global (Toute la plateforme bêta)</option>
                  </select>
                </div>

                {rateScope === "student" && (
                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium">
                      Identifiant ou Email Étudiant {targetStudentEmail && `(${targetStudentEmail})`}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="UUID de l'étudiant..."
                      value={targetStudentId}
                      onChange={(e) => setTargetStudentId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                    />
                  </div>
                )}

                {rateScope === "cohort" && (
                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium">Cohorte Ciblée</label>
                    <select
                      value={targetCohortId}
                      onChange={(e) => setTargetCohortId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                      required
                    >
                      <option value="">Sélectionner une cohorte...</option>
                      {cohorts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Action & Ressource</label>
                  <select
                    value={rateAction}
                    onChange={(e) => setRateAction(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  >
                    <option value="ai_oral">Sessions orales avec jury IA</option>
                    <option value="ai_writing">Corrections de rédaction par IA</option>
                    <option value="practice_pool">Sessions audio entre pairs (Practice Pool)</option>
                    <option value="teacher_booking">Réservations de tuteurs</option>
                    <option value="file_upload">Téléversements de fichiers / audio</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Nouveau Plafond Autorisé</label>
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    required
                    value={rateLimitValue}
                    onChange={(e) => setRateLimitValue(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                  />
                  <span className="text-[10px] text-slate-500">
                    Limite maximale d'exécutions accordées dans la fenêtre temporelle.
                  </span>
                </div>

                {rateScope === "student" && (
                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium">Justification administrative (Optionnel)</label>
                    <input
                      type="text"
                      placeholder="ex: Candidat en préparation accélérée..."
                      value={rateNotes}
                      onChange={(e) => setRateNotes(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowAdjustRateModal(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    Annuler
                  </Button>
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white">
                    Enregistrer le Plafond
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Reset Quota */}
        {showResetQuotaModal && resetTargetUser && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center gap-2 text-indigo-400">
                <RotateCcw className="h-5 w-5" />
                <h3 className="text-base font-bold text-white">Réinitialiser les Quotas de Consommation</h3>
              </div>
              <p className="text-xs text-slate-300">
                Remet à zéro le compteur de consommation pour{" "}
                <span className="font-semibold text-white">{resetTargetUser.email}</span>, lui permettant de
                continuer immédiatement.
              </p>
              <form onSubmit={handleExecuteResetQuota} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Ressource à Réinitialiser</label>
                  <select
                    value={resetAction}
                    onChange={(e) => setResetAction(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  >
                    <option value="">Toutes les ressources (Réinitialisation intégrale)</option>
                    <option value="ai_oral">Sessions orales avec jury IA</option>
                    <option value="ai_writing">Corrections de rédaction par IA</option>
                    <option value="practice_pool">Sessions audio entre pairs (Practice Pool)</option>
                    <option value="teacher_booking">Réservations de tuteurs</option>
                    <option value="file_upload">Téléversements de fichiers / audio</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Motif pour le Registre d'Audit</label>
                  <input
                    type="text"
                    placeholder="ex: Bug résolu lors de l'enregistrement..."
                    value={resetReason}
                    onChange={(e) => setResetReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowResetQuotaModal(false);
                      setResetTargetUser(null);
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    Annuler
                  </Button>
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white">
                    Confirmer la Réinitialisation
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

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
              <p className="text-xs text-slate-400">
                Cette action est immédiatement auditée dans le registre d'audit.
              </p>
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
