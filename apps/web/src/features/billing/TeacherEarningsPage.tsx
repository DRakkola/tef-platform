/**
 * Teacher Earnings Page (/teacher/earnings).
 * Dashboard for teachers showing net revenue, platform commission (20%),
 * available and pending balances, and lesson-by-lesson payout details.
 */

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Clock,
  ShieldCheck,
  Calendar,
  Briefcase,
} from "lucide-react";
import { getTeacherEarnings, getTeacherEarningsSummary } from "./api";

function formatCents(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatDate(isoString?: string | null): string {
  if (!isoString) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

export const TeacherEarningsPage: React.FC = () => {
  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["teacher-earnings-summary"],
    queryFn: getTeacherEarningsSummary,
  });

  const { data: earnings = [], isLoading: loadingEarnings } = useQuery({
    queryKey: ["teacher-earnings"],
    queryFn: getTeacherEarnings,
  });

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold rounded-full uppercase tracking-wider mb-2">
              <Briefcase className="w-3.5 h-3.5" />
              Espace Professeur Certifié
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Revenus & Rémunérations
            </h1>
            <p className="text-slate-600 mt-1">
              Suivi de vos cours particuliers dispensés, commissions plateforme et versements.
            </p>
          </div>
        </div>

        {/* Informative Banner */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-start gap-3.5">
          <ShieldCheck className="w-6 h-6 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-700 space-y-1">
            <h4 className="font-bold text-slate-900">
              Modèle de rémunération transparent (80% / 20%)
            </h4>
            <p className="text-slate-600 text-xs sm:text-sm">
              Vous percevez 80% du prix payé par l'élève. Les 20% restants couvrent la TVA, la commission
              bancaire de traitement des cartes, les serveurs vocaux WebRTC chiffrés et le support technique.
              Les fonds passent au statut <strong>Disponible</strong> 24h après la fin du cours validé.
            </p>
          </div>
        </div>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Available to payout */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Disponible au versement
            </span>
            <span className="text-3xl font-extrabold text-emerald-600 mt-2 block">
              {loadingSummary ? "..." : formatCents(summary?.available_cents ?? 0, summary?.currency)}
            </span>
            <span className="text-xs text-slate-400 mt-1 block">Prêt pour virement bancaire</span>
          </div>

          {/* Pending clearance */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              En cours de validation
            </span>
            <span className="text-3xl font-extrabold text-amber-600 mt-2 block">
              {loadingSummary ? "..." : formatCents(summary?.pending_cents ?? 0, summary?.currency)}
            </span>
            <span className="text-xs text-slate-400 mt-1 block">Déblocage sous 24 heures</span>
          </div>

          {/* Total Net Earned */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Revenu Net Total (80%)
            </span>
            <span className="text-3xl font-extrabold text-slate-900 mt-2 block">
              {loadingSummary ? "..." : formatCents(summary?.total_net_cents ?? 0, summary?.currency)}
            </span>
            <span className="text-xs text-slate-400 mt-1 block">
              Sur {summary?.completed_lessons_count ?? 0} cours terminés
            </span>
          </div>

          {/* Platform fee */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Commission Plateforme (20%)
            </span>
            <span className="text-3xl font-extrabold text-slate-500 mt-2 block">
              {loadingSummary
                ? "..."
                : formatCents(summary?.total_platform_fee_cents ?? 0, summary?.currency)}
            </span>
            <span className="text-xs text-slate-400 mt-1 block">Frais d'infrastructure & gestion</span>
          </div>
        </div>

        {/* Completed Lessons Earnings Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-slate-900">Journal des Cours & Rémunérations</h2>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {earnings.length} leçon{earnings.length > 1 ? "s" : ""}
            </span>
          </div>

          {loadingEarnings ? (
            <div className="p-8 text-center text-slate-500">Chargement de vos revenus...</div>
          ) : earnings.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Clock className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="text-lg font-semibold text-slate-900">Aucun cours comptabilisé</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                Lorsque des élèves réservent et effectuent un cours particulier avec vous, vos gains
                apparaîtront ici.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-4 px-6">Date</th>
                    <th className="py-4 px-6">ID Réservation</th>
                    <th className="py-4 px-6">Prix Élève (Brut)</th>
                    <th className="py-4 px-6">Frais Plateforme</th>
                    <th className="py-4 px-6">Votre Gain Net</th>
                    <th className="py-4 px-6">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {earnings.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-4 px-6 text-slate-500 whitespace-nowrap">
                        {formatDate(e.created_at)}
                      </td>
                      <td className="py-4 px-6 font-mono text-xs text-slate-700">
                        {e.booking_id.slice(0, 12)}...
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-900">
                        {formatCents(e.gross_amount_cents, e.currency)}
                      </td>
                      <td className="py-4 px-6 text-slate-500">
                        -{formatCents(e.platform_fee_cents, e.currency)} (20%)
                      </td>
                      <td className="py-4 px-6 font-bold text-emerald-600">
                        {formatCents(e.net_amount_cents, e.currency)}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            e.status === "available"
                              ? "bg-emerald-100 text-emerald-800"
                              : e.status === "pending"
                              ? "bg-amber-100 text-amber-800"
                              : e.status === "paid"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {e.status === "available" && "DISPONIBLE"}
                          {e.status === "pending" && "EN ATTENTE"}
                          {e.status === "paid" && "VERSÉ"}
                          {e.status === "refunded" && "REMBOURSÉ"}
                          {e.status === "reversed" && "ANNULÉ"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
