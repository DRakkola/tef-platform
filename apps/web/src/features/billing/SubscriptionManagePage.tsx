/**
 * Subscription Management Page (/billing/subscription).
 * Allows users to view details of their subscription, cancel at period end,
 * resume cancellation, or upgrade/downgrade to another plan.
 */

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  RefreshCw,
  Zap,
  Clock,
  Shield,
  XCircle,
} from "lucide-react";
import { getSubscription, cancelSubscription, resumeSubscription } from "./api";

function formatDate(isoString?: string | null): string {
  if (!isoString) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "full",
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

export const SubscriptionManagePage: React.FC = () => {
  const queryClient = useQueryClient();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: subscription, isLoading } = useQuery({
    queryKey: ["billing-subscription"],
    queryFn: getSubscription,
  });

  const cancelMutation = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-subscription"] });
      setShowCancelModal(false);
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err?.message || "Échec de l'annulation de l'abonnement.");
    },
  });

  const resumeMutation = useMutation({
    mutationFn: resumeSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-subscription"] });
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err?.message || "Échec de la reprise de l'abonnement.");
    },
  });

  const isCancelling = subscription?.cancel_at_period_end;
  const isActive = subscription?.status === "active";

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Back Link & Header */}
        <div className="space-y-2">
          <Link
            to="/billing"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à la facturation
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Gestion de votre Abonnement
            </h1>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                isActive
                  ? "bg-emerald-100 text-emerald-800"
                  : subscription?.status === "trialing"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {subscription?.status ? subscription.status.toUpperCase() : "INACTIF"}
            </span>
          </div>
        </div>

        {actionError && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Cancellation Warning Banner */}
        {isCancelling && (
          <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-base text-amber-900">
                  Résiliation programmée
                </h4>
                <p className="text-sm text-amber-800 mt-1">
                  Votre formule reste active et utilisable jusqu'au{" "}
                  <strong>{formatDate(subscription?.current_period_end)}</strong>. Vous ne
                  serez plus prélevé après cette date.
                </p>
              </div>
            </div>
            <div className="pt-2">
              <button
                onClick={() => resumeMutation.mutate()}
                disabled={resumeMutation.isPending}
                className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold rounded-lg shadow-sm transition inline-flex items-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${resumeMutation.isPending ? "animate-spin" : ""}`} />
                Conserver mon abonnement (Annuler la résiliation)
              </button>
            </div>
          </div>
        )}

        {/* Subscription Plan Card */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-indigo-600">
                  <Shield className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-wider">Formule en cours</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {isLoading
                    ? "Chargement..."
                    : subscription?.product_name ||
                      (subscription?.plan_tier
                        ? `Abonnement TEF ${subscription.plan_tier.toUpperCase()}`
                        : "Plan Gratuit Découverte")}
                </h2>
                <p className="text-sm text-slate-500">
                  Fournisseur de paiement : {subscription?.provider || "Stripe"}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  to="/pricing"
                  className="px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-sm font-semibold rounded-lg transition inline-flex items-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  Changer de formule
                </Link>
              </div>
            </div>

            {/* Cycle Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
              <div className="flex items-start gap-3.5 p-4 rounded-xl bg-slate-50 border border-slate-100">
                <Calendar className="w-5 h-5 text-indigo-600 mt-0.5" />
                <div>
                  <span className="text-xs font-medium text-slate-500 block">
                    Début de la période actuelle
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {formatDate(subscription?.current_period_start)}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-4 rounded-xl bg-slate-50 border border-slate-100">
                <Clock className="w-5 h-5 text-indigo-600 mt-0.5" />
                <div>
                  <span className="text-xs font-medium text-slate-500 block">
                    {isCancelling ? "Date de fin définitive" : "Prochaine échéance de renouvellement"}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {formatDate(subscription?.current_period_end)}
                  </span>
                </div>
              </div>
            </div>

            {/* Features Included */}
            <div className="pt-4 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-xs">
                Inclus dans votre formule
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-700">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Examens blancs TEF chronométrés</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Pool de pratique orale audio 1-à-1</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Corrections d'écriture TEF par IA certifiée</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Analyses phonétiques & fluidité du Speaking</span>
                </div>
              </div>
            </div>

            {/* Cancel Action Footer */}
            {isActive && !isCancelling && (
              <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">Souhaitez-vous résilier ?</p>
                  <p className="text-xs text-slate-500">
                    Votre accès continuera jusqu'à la fin de la période déjà payée.
                  </p>
                </div>
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="px-4 py-2 border border-rose-200 text-rose-700 hover:bg-rose-50 text-sm font-medium rounded-lg transition inline-flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4 text-rose-500" />
                  Résilier l'abonnement
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Modal Confirmation */}
        {showCancelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-100">
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900">
                  Confirmer la résiliation
                </h3>
                <p className="text-sm text-slate-600">
                  Êtes-vous sûr de vouloir annuler votre abonnement ? Vous conserverez vos
                  avantages et votre accès complet jusqu'au{" "}
                  <strong>{formatDate(subscription?.current_period_end)}</strong>.
                </p>
                <p className="text-xs text-slate-500">
                  Aucun nouveau prélèvement ne sera effectué. Vos crédits achetés séparément restent valables.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium rounded-lg transition"
                >
                  Garder mon abonnement
                </button>
                <button
                  type="button"
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg shadow-sm transition inline-flex items-center gap-2"
                >
                  {cancelMutation.isPending ? "Annulation en cours..." : "Confirmer la résiliation"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
