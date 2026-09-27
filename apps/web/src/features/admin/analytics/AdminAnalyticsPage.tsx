import React, { useState, useEffect } from "react";
import {
  BarChart3,
  Users,
  Layers,
  GraduationCap,
  BookOpen,
  DollarSign,
  Bot,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { AdminLayout } from "@/features/admin/AdminLayout";
import { Button } from "@/components/ui/button";

export const AdminAnalyticsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Aggregated data states
  const [overview, setOverview] = useState<any>(null);
  const [funnel, setFunnel] = useState<any>(null);
  const [retention, setRetention] = useState<any>(null);
  const [learning, setLearning] = useState<any>(null);
  const [content, setContent] = useState<any>(null);
  const [teachers, setTeachers] = useState<any>(null);
  const [ai, setAi] = useState<any>(null);
  const [billing, setBilling] = useState<any>(null);
  const [practice, setPractice] = useState<any>(null);

  const fetchTabMetrics = async (tab: string) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const endpointMap: Record<string, string> = {
        overview: "/api/v1/admin/analytics/overview",
        funnel: "/api/v1/admin/analytics/funnel",
        retention: "/api/v1/admin/analytics/retention",
        learning: "/api/v1/admin/analytics/learning",
        content: "/api/v1/admin/analytics/content",
        teachers: "/api/v1/admin/analytics/teachers",
        ai: "/api/v1/admin/analytics/ai",
        billing: "/api/v1/admin/analytics/billing",
        practice: "/api/v1/admin/analytics/practice-pool",
      };

      const res = await fetch(endpointMap[tab], { headers });
      if (!res.ok) {
        throw new Error(`Failed to load ${tab} analytics (HTTP ${res.status})`);
      }
      const data = await res.json();

      if (tab === "overview") setOverview(data);
      if (tab === "funnel") setFunnel(data);
      if (tab === "retention") setRetention(data);
      if (tab === "learning") setLearning(data);
      if (tab === "content") setContent(data);
      if (tab === "teachers") setTeachers(data);
      if (tab === "ai") setAi(data);
      if (tab === "billing") setBilling(data);
      if (tab === "practice") setPractice(data);
    } catch (err: any) {
      setError(err.message || "An error occurred fetching metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTabMetrics(activeTab);
  }, [activeTab]);

  const tabs = [
    { id: "overview", label: "Vue d'ensemble", icon: BarChart3 },
    { id: "funnel", label: "Entonnoir (11 étapes)", icon: Layers },
    { id: "retention", label: "Rétention Cohortes", icon: Users },
    { id: "learning", label: "Apprentissage & Trajectoires", icon: GraduationCap },
    { id: "content", label: "Contenu & Diagnostics", icon: BookOpen },
    { id: "teachers", label: "Marketplace Professeurs", icon: Users },
    { id: "ai", label: "Usage IA & Coûts", icon: Bot },
    { id: "billing", label: "Monétisation & Revenus", icon: DollarSign },
    { id: "practice", label: "Practice Pool", icon: Sparkles },
  ];

  return (
    <AdminLayout activeTab="analytics">
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
          <div>
            <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase mb-1">
              <ShieldCheck className="h-4 w-4" />
              <span>Cockpit Décisionnel Produit</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              Product Analytics & Beta Operations
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Métriques empiriques du tunnel d'activation, de rétention, d'efficacité pédagogique et de coûts.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchTabMetrics(activeTab)}
            disabled={loading}
            className="border-border hover:bg-muted text-foreground text-xs flex items-center gap-2 self-start md:self-auto"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Actualiser</span>
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 overflow-x-auto pb-2 border-b border-border scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isCurrent = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs whitespace-nowrap transition-all ${
                  isCurrent
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                    : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted border border-border"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div className="flex justify-center items-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        )}

        {error && !loading && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-6 text-destructive flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <div className="font-bold text-sm">Erreur lors de la récupération des données</div>
              <div className="text-xs opacity-90 mt-0.5">{error}</div>
            </div>
          </div>
        )}

        {/* 1. Overview */}
        {!loading && !error && activeTab === "overview" && overview && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
                <div className="text-xs text-muted-foreground uppercase font-semibold">Étudiants Inscrits</div>
                <div className="text-3xl font-black text-foreground mt-2">{overview.total_registered_users}</div>
                <div className="text-xs text-muted-foreground mt-1">Actifs 30j : {overview.active_users}</div>
              </div>

              <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
                <div className="text-xs text-muted-foreground uppercase font-semibold">Taux d'Activation</div>
                <div className="text-3xl font-black text-primary mt-2">
                  {(overview.activation_rate * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {overview.activated_users} étudiants activés
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
                <div className="text-xs text-muted-foreground uppercase font-semibold">Chiffre d'Affaires</div>
                <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                  {overview.total_revenue.toFixed(2)} €
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {overview.active_subscriptions} abonnements actifs
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
                <div className="text-xs text-muted-foreground uppercase font-semibold">Coût IA Estimé</div>
                <div className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-2">
                  ${overview.ai_estimated_cost.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Évaluations écrites & orales</div>
              </div>
            </div>

            {/* Sub-activity grid */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-xs">
              <h2 className="text-base font-bold text-foreground mb-4">Volume d'Activité Pédagogique (30 derniers jours)</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                <div className="bg-muted/40 p-4 rounded-xl border border-border">
                  <div className="text-2xl font-bold text-foreground">{overview.assessments_completed}</div>
                  <div className="text-xs text-muted-foreground mt-1">Tests Complétés</div>
                </div>
                <div className="bg-muted/40 p-4 rounded-xl border border-border">
                  <div className="text-2xl font-bold text-foreground">{overview.exercises_completed}</div>
                  <div className="text-xs text-muted-foreground mt-1">Exercices Validés</div>
                </div>
                <div className="bg-muted/40 p-4 rounded-xl border border-border">
                  <div className="text-2xl font-bold text-foreground">{overview.writing_submissions}</div>
                  <div className="text-xs text-muted-foreground mt-1">Rédactions Écrites</div>
                </div>
                <div className="bg-muted/40 p-4 rounded-xl border border-border">
                  <div className="text-2xl font-bold text-foreground">{overview.speaking_sessions}</div>
                  <div className="text-xs text-muted-foreground mt-1">Sessions Orales</div>
                </div>
                <div className="bg-muted/40 p-4 rounded-xl border border-border">
                  <div className="text-2xl font-bold text-foreground">{overview.teacher_bookings}</div>
                  <div className="text-xs text-muted-foreground mt-1">Cours Enseignants</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. Funnel */}
        {!loading && !error && activeTab === "funnel" && funnel && (
          <div className="bg-card border border-border rounded-xl p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">Tunnel de Conversion de la Beta</h2>
                <p className="text-xs text-muted-foreground">
                  Conversion étape par étape depuis le premier contact jusqu'à la monétisation.
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Taux global de conversion</div>
                <div className="text-xl font-black text-primary">
                  {(funnel.overall_conversion_rate * 100).toFixed(2)}%
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              {funnel.stages.map((stage: any, index: number) => (
                <div
                  key={stage.stage}
                  className="bg-muted/40 border border-border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-[240px]">
                    <span className="w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                      {index + 1}
                    </span>
                    <div>
                      <div className="text-sm font-bold text-foreground">{stage.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{stage.stage}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-sm font-black text-foreground">{stage.count}</div>
                      <div className="text-xs text-muted-foreground">étudiants</div>
                    </div>

                    <div className="text-right min-w-[100px]">
                      <div className="text-xs font-bold text-primary">
                        {(stage.conversion_from_previous * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground">étape préc.</div>
                    </div>

                    <div className="text-right min-w-[100px]">
                      <div className="text-xs font-bold text-foreground">
                        {(stage.conversion_from_start * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground">depuis début</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Retention */}
        {!loading && !error && activeTab === "retention" && retention && (
          <div className="bg-card border border-border rounded-xl p-6 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-bold text-foreground">Rétention des Cohortes</h2>
              <p className="text-xs text-muted-foreground">
                Définition : {retention.definition}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-3 px-4">Cohorte</th>
                    <th className="py-3 px-4">Taille</th>
                    <th className="py-3 px-4">Jour 1 (D1)</th>
                    <th className="py-3 px-4">Jour 7 (D7)</th>
                    <th className="py-3 px-4">Jour 14 (D14)</th>
                    <th className="py-3 px-4">Jour 30 (D30)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-mono">
                  {retention.cohorts.map((c: any) => (
                    <tr key={c.cohort_date} className="hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-foreground">{c.cohort_date}</td>
                      <td className="py-3 px-4 text-muted-foreground">{c.cohort_size}</td>
                      <td className="py-3 px-4 font-bold text-primary">{(c.d1_rate * 100).toFixed(0)}%</td>
                      <td className="py-3 px-4 text-primary/80">{(c.d7_rate * 100).toFixed(0)}%</td>
                      <td className="py-3 px-4 text-muted-foreground">{(c.d14_rate * 100).toFixed(0)}%</td>
                      <td className="py-3 px-4 text-muted-foreground/80">{(c.d30_rate * 100).toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. Learning Analytics */}
        {!loading && !error && activeTab === "learning" && learning && (
          <div className="space-y-6">
            {learning.insufficient_data && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <span>
                  Données empiriques encore insuffisantes (&lt; 5 profils complets).
                  Ne pas affirmer de causalité statistique sur ce faible échantillon.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-xl p-6 shadow-xs">
                <h2 className="text-base font-bold text-foreground mb-2">Compétences Bloquantes Fréquentes</h2>
                <p className="text-xs text-muted-foreground mb-4">
                  Sous-compétences avec les scores les plus faibles nécessitant un ciblage prioritaire.
                </p>
                <div className="space-y-3">
                  {learning.common_blocking_skills.length === 0 ? (
                    <div className="text-xs text-muted-foreground py-6 text-center">Aucune compétence bloquante identifiée.</div>
                  ) : (
                    learning.common_blocking_skills.map((s: any) => (
                      <div key={s.skill_id} className="bg-muted/40 p-3 rounded-xl border border-border flex justify-between items-center text-xs">
                        <span className="font-mono text-foreground">{s.skill_id}</span>
                        <div className="text-right">
                          <span className="text-destructive font-bold">{s.average_score}/100</span>
                          <span className="text-muted-foreground ml-2">({s.students_affected} étudiants)</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-6 shadow-xs">
                <h2 className="text-base font-bold text-foreground mb-2">Progression Moyenne Observée</h2>
                <p className="text-xs text-muted-foreground mb-4">
                  Évolution positive entre le score diagnostique initial et la dernière évaluation.
                </p>
                <div className="flex items-center justify-center py-10">
                  <div className="text-center">
                    <div className="text-5xl font-black text-emerald-600 dark:text-emerald-400">
                      +{learning.average_observed_improvement} pts
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      Sur {learning.total_skills_tracked} compétences suivies
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5. Content Analytics */}
        {!loading && !error && activeTab === "content" && content && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
                <div className="text-xs text-muted-foreground uppercase font-semibold">Taux de Complétion des Tests</div>
                <div className="text-3xl font-black text-foreground mt-2">
                  {(content.average_completion_rate * 100).toFixed(1)}%
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
                <div className="text-xs text-muted-foreground uppercase font-semibold">Taux d'Expiration / Abandon</div>
                <div className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-2">
                  {(content.average_expiration_rate * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 shadow-xs">
              <h2 className="text-base font-bold text-foreground mb-2">Questions Signalées pour Révision</h2>
              <p className="text-xs text-muted-foreground mb-4">
                Questions présentant un taux d'échec anormalement élevé ou une formulation ambiguë.
              </p>
              <div className="space-y-3">
                {content.flagged_questions_for_review.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-6 text-center">Aucune question signalée pour anomalie.</div>
                ) : (
                  content.flagged_questions_for_review.map((q: any) => (
                    <div key={q.question_id} className="bg-muted/40 p-4 rounded-xl border border-border flex justify-between items-center text-xs">
                      <div>
                        <div className="text-foreground font-medium">{q.preview || "Question sans texte"}</div>
                        <div className="text-muted-foreground font-mono mt-1">ID: {q.question_id}</div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <div className="text-destructive font-bold">{(q.error_rate * 100).toFixed(0)}% d'erreurs</div>
                        <div className="text-muted-foreground">{q.attempts} tentatives</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* 6. Teacher Analytics */}
        {!loading && !error && activeTab === "teachers" && teachers && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
              <div className="text-xs text-muted-foreground uppercase font-semibold">Créneaux Disponibles</div>
              <div className="text-3xl font-black text-foreground mt-2">{teachers.available_slots}</div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
              <div className="text-xs text-muted-foreground uppercase font-semibold">Taux d'Utilisation des Créneaux</div>
              <div className="text-3xl font-black text-primary mt-2">
                {(teachers.slot_utilization_rate * 100).toFixed(1)}%
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
              <div className="text-xs text-muted-foreground uppercase font-semibold">Taux d'Annulation</div>
              <div className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-2">
                {(teachers.cancellation_rate * 100).toFixed(1)}%
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
              <div className="text-xs text-muted-foreground uppercase font-semibold">Délai Moyen de Correction</div>
              <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                {teachers.average_correction_turnaround_hours}h
              </div>
            </div>
          </div>
        )}

        {/* 7. AI Analytics */}
        {!loading && !error && activeTab === "ai" && ai && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
              <div className="text-xs text-muted-foreground uppercase font-semibold">Coût Total IA</div>
              <div className="text-3xl font-black text-foreground mt-2">${ai.total_ai_cost_usd.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground mt-1">${ai.cost_per_active_student_usd.toFixed(2)} / étudiant actif</div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
              <div className="text-xs text-muted-foreground uppercase font-semibold">Temps de Réponse Moyen</div>
              <div className="text-3xl font-black text-primary mt-2">{ai.average_latency_seconds}s</div>
              <div className="text-xs text-muted-foreground mt-1">Inférieur au SLO de 10s</div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
              <div className="text-xs text-muted-foreground uppercase font-semibold">Taux d'Échec IA</div>
              <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                {(ai.ai_failure_rate * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">Reprises automatiques actives</div>
            </div>
          </div>
        )}

        {/* 8. Billing Analytics */}
        {!loading && !error && activeTab === "billing" && billing && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
              <div className="text-xs text-muted-foreground uppercase font-semibold">Volume d'Affaires Brut (GMV)</div>
              <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">{billing.total_gmv.toFixed(2)} €</div>
              <div className="text-xs text-muted-foreground mt-1">Commission : {billing.platform_commission.toFixed(2)} €</div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
              <div className="text-xs text-muted-foreground uppercase font-semibold">Conversion Checkout</div>
              <div className="text-3xl font-black text-primary mt-2">
                {(billing.checkout_conversion_rate * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">{billing.successful_payments} paiements réussis</div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
              <div className="text-xs text-muted-foreground uppercase font-semibold">Crédits Vendus / Consommés</div>
              <div className="text-3xl font-black text-foreground mt-2">
                {billing.credits_consumed} <span className="text-sm font-normal text-muted-foreground">/ {billing.credits_sold}</span>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
              <div className="text-xs text-muted-foreground uppercase font-semibold">Abonnements Actifs</div>
              <div className="text-3xl font-black text-foreground mt-2">{billing.active_subscriptions}</div>
            </div>
          </div>
        )}

        {/* 9. Practice Pool Analytics */}
        {!loading && !error && activeTab === "practice" && practice && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
              <div className="text-xs text-muted-foreground uppercase font-semibold">Statut de Liquidité</div>
              <div className="mt-2">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    practice.liquidity_status === "optimal"
                      ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                      : practice.liquidity_status === "moderate"
                      ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                      : "bg-destructive/20 text-destructive border border-destructive/30"
                  }`}
                >
                  {practice.liquidity_status}
                </span>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
              <div className="text-xs text-muted-foreground uppercase font-semibold">Taux de Match Reussi</div>
              <div className="text-3xl font-black text-primary mt-2">
                {(practice.match_success_rate * 100).toFixed(1)}%
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
              <div className="text-xs text-muted-foreground uppercase font-semibold">Attente Médiane</div>
              <div className="text-3xl font-black text-foreground mt-2">
                {practice.median_time_to_match_seconds}s
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
              <div className="text-xs text-muted-foreground uppercase font-semibold">Taux de Sessions Terminées</div>
              <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                {(practice.session_completion_rate * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
