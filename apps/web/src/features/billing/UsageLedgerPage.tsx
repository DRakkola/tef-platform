/**
 * Usage and Credit Ledger Page (/billing/usage).
 * Details active credit grants, expiration dates, consumption journal,
 * and explanation of the FIFO soonest-expiring consumption rule.
 */

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Zap,
  ArrowLeft,
  Calendar,
  History,
  Info,
} from "lucide-react";
import { getCredits, getUsage } from "./api";

function formatDate(isoString?: string | null): string {
  if (!isoString) return "Sans expiration";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

export const UsageLedgerPage: React.FC = () => {
  const { data: credits, isLoading: loadingCredits } = useQuery({
    queryKey: ["billing-credits"],
    queryFn: getCredits,
  });

  const { data: usage, isLoading: loadingUsage } = useQuery({
    queryKey: ["billing-usage"],
    queryFn: getUsage,
  });

  const grants = usage?.grants || credits?.active_grants || [];
  const consumptions = usage?.consumptions || [];

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <Link
            to="/billing"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à la facturation
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                Consommation & Journal des Crédits
              </h1>
              <p className="text-slate-600 mt-1">
                Suivi transparent de chaque crédit attribué, consommé ou expiré.
              </p>
            </div>
            <Link
              to="/pricing"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm transition inline-flex items-center gap-2 self-start"
            >
              <Zap className="w-4 h-4" />
              Recharger des crédits
            </Link>
          </div>
        </div>

        {/* Balance KPI Banner */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 text-center sm:text-left">
            <div className="sm:border-r border-slate-100 sm:pr-6">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Solde Total
              </span>
              <span className="text-4xl font-extrabold text-emerald-600 mt-1 block">
                {loadingCredits ? "..." : credits?.balance ?? 0}
              </span>
              <span className="text-xs text-slate-400 mt-1 block">crédits polyvalents</span>
            </div>

            <div className="sm:border-r border-slate-100 sm:pr-6">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Pratique Orale
              </span>
              <span className="text-3xl font-bold text-slate-900 mt-1 block">
                {loadingCredits ? "..." : credits?.speaking_credits ?? 0}
              </span>
              <span className="text-xs text-slate-400 mt-1 block">sessions évaluées</span>
            </div>

            <div className="sm:border-r border-slate-100 sm:pr-6">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Pratique Écrite
              </span>
              <span className="text-3xl font-bold text-slate-900 mt-1 block">
                {loadingCredits ? "..." : credits?.writing_credits ?? 0}
              </span>
              <span className="text-xs text-slate-400 mt-1 block">rédactions corrigées</span>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Tutorat Humain
              </span>
              <span className="text-3xl font-bold text-slate-900 mt-1 block">
                {loadingCredits ? "..." : credits?.tutoring_hours ?? 0}h
              </span>
              <span className="text-xs text-slate-400 mt-1 block">avec professeur certifié</span>
            </div>
          </div>

          {/* FIFO Policy Callout */}
          <div className="mt-6 pt-6 border-t border-slate-100 flex items-start gap-3 bg-emerald-50/60 p-4 rounded-xl text-emerald-900 text-xs sm:text-sm">
            <Info className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Priorité de consommation automatique (FIFO) :</span>{" "}
              Vos crédits sont automatiquement consommés en priorisant ceux dont la date
              d'expiration est la plus proche, afin de maximiser la durée de validité de votre solde.
            </div>
          </div>
        </div>

        {/* Active Grants Tranches */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-slate-900">Lots & Tranches de Crédits</h2>
            </div>
            <span className="text-xs text-slate-500">
              {grants.length} lot{grants.length > 1 ? "s" : ""} enregistré{grants.length > 1 ? "s" : ""}
            </span>
          </div>

          {loadingCredits || loadingUsage ? (
            <div className="p-8 text-center text-slate-500">Chargement des lots...</div>
          ) : grants.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Aucun lot de crédit actif.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-6">Date d'octroi</th>
                    <th className="py-3.5 px-6">Origine / Motif</th>
                    <th className="py-3.5 px-6">Octroyés</th>
                    <th className="py-3.5 px-6">Restants</th>
                    <th className="py-3.5 px-6">Date d'expiration</th>
                    <th className="py-3.5 px-6">État</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {grants.map((g) => {
                    const isExpired = g.expires_at && new Date(g.expires_at) < new Date();
                    const isDepleted = g.remaining_credits === 0;
                    return (
                      <tr key={g.id} className="hover:bg-slate-50/50">
                        <td className="py-4 px-6 text-slate-500">{formatDate(g.created_at)}</td>
                        <td className="py-4 px-6 font-medium text-slate-900">
                          {g.reason || (g.grant_type === "purchased" ? "Achat de pack" : g.grant_type)}
                        </td>
                        <td className="py-4 px-6 font-semibold text-slate-700">
                          {g.initial_credits}
                        </td>
                        <td className="py-4 px-6 font-bold text-emerald-700">
                          {g.remaining_credits}
                        </td>
                        <td className="py-4 px-6 text-slate-500">
                          {g.expires_at ? formatDate(g.expires_at) : "Illimité"}
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              isExpired
                                ? "bg-rose-100 text-rose-800"
                                : isDepleted
                                ? "bg-slate-100 text-slate-700"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {isExpired ? "EXPIRÉ" : isDepleted ? "ÉPUISÉ" : "ACTIF"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Consumptions History */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-slate-900">Historique des Consommations</h2>
            </div>
          </div>

          {loadingUsage ? (
            <div className="p-8 text-center text-slate-500">Chargement de l'historique...</div>
          ) : consumptions.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              Aucune consommation enregistrée à ce jour.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-6">Date</th>
                    <th className="py-3.5 px-6">Fonctionnalité</th>
                    <th className="py-3.5 px-6">Crédits débités</th>
                    <th className="py-3.5 px-6">Référence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {consumptions.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/50">
                      <td className="py-4 px-6 text-slate-500">{formatDate(c.created_at)}</td>
                      <td className="py-4 px-6 font-medium text-slate-900">
                        {c.feature_key}
                      </td>
                      <td className="py-4 px-6 font-bold text-rose-600">
                        -{c.credits_consumed}
                      </td>
                      <td className="py-4 px-6 font-mono text-xs text-slate-400">
                        {c.reference_id || "—"}
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
