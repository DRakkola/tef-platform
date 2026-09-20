/**
 * Administrative Billing Console (/admin/billing).
 * Complete monetization control plane:
 * - Orders & Refund processing
 * - Platform Subscriptions
 * - Immutable Financial Ledger
 * - Webhook Events Audit
 * - Manual Admin Grants
 * - Daily Reconciliation Engine
 */

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ShieldAlert,
  ShoppingBag,
  CreditCard,
  History,
  Activity,
  Gift,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ArrowLeft,
  X,
} from "lucide-react";
import {
  getAdminOrders,
  getAdminSubscriptions,
  getAdminWebhooks,
  getAdminLedger,
  issueAdminRefund,
  createAdminGrant,
  runReconciliation,
} from "./api";
import type { Order } from "./types";

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

type AdminTab =
  | "orders"
  | "subscriptions"
  | "ledger"
  | "webhooks"
  | "grants"
  | "reconciliation";

export const AdminBillingPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AdminTab>("orders");

  // Refund Modal State
  const [refundOrder, setRefundOrder] = useState<Order | null>(null);
  const [refundAmountEur, setRefundAmountEur] = useState<string>("");
  const [refundReason, setRefundReason] = useState<string>("Demande client / geste commercial");
  const [refundError, setRefundError] = useState<string | null>(null);

  // Grant Modal / Form State
  const [grantUserId, setGrantUserId] = useState<string>("");
  const [grantType, setGrantType] = useState<string>("credits");
  const [grantAmountOrSku, setGrantAmountOrSku] = useState<string>("20");
  const [grantReason, setGrantReason] = useState<string>("Geste commercial support");
  const [grantExpiry, setGrantExpiry] = useState<string>("");
  const [grantSuccess, setGrantSuccess] = useState<string | null>(null);
  const [grantError, setGrantError] = useState<string | null>(null);

  // Queries
  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ["admin-billing-orders"],
    queryFn: () => getAdminOrders(100),
    enabled: activeTab === "orders",
  });

  const { data: subscriptions = [], isLoading: loadingSubs } = useQuery({
    queryKey: ["admin-billing-subscriptions"],
    queryFn: () => getAdminSubscriptions(100),
    enabled: activeTab === "subscriptions",
  });

  const { data: ledger = [], isLoading: loadingLedger } = useQuery({
    queryKey: ["admin-billing-ledger"],
    queryFn: () => getAdminLedger(100),
    enabled: activeTab === "ledger",
  });

  const { data: webhooks = [], isLoading: loadingWebhooks } = useQuery({
    queryKey: ["admin-billing-webhooks"],
    queryFn: () => getAdminWebhooks(100),
    enabled: activeTab === "webhooks",
  });

  // Reconciliation Query
  const {
    data: reconReport,
    isLoading: loadingRecon,
    refetch: refetchRecon,
    isRefetching: isRefetchingRecon,
  } = useQuery({
    queryKey: ["admin-billing-reconciliation"],
    queryFn: runReconciliation,
    enabled: activeTab === "reconciliation",
  });

  // Mutations
  const refundMutation = useMutation({
    mutationFn: issueAdminRefund,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-billing-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-billing-ledger"] });
      setRefundOrder(null);
      setRefundError(null);
      setRefundAmountEur("");
    },
    onError: (err: any) => {
      setRefundError(err?.message || "Échec du remboursement.");
    },
  });

  const grantMutation = useMutation({
    mutationFn: createAdminGrant,
    onSuccess: () => {
      setGrantSuccess("Attribution enregistrée avec succès !");
      setGrantError(null);
      setGrantUserId("");
      setGrantAmountOrSku("20");
    },
    onError: (err: any) => {
      setGrantError(err?.message || "Échec de l'attribution manuelle.");
      setGrantSuccess(null);
    },
  });

  const handleOpenRefund = (order: Order) => {
    setRefundOrder(order);
    setRefundAmountEur((order.total_cents / 100).toFixed(2));
    setRefundError(null);
  };

  const handleExecuteRefund = () => {
    if (!refundOrder) return;
    const amountFloat = parseFloat(refundAmountEur);
    const amountCents = !isNaN(amountFloat) && amountFloat > 0 ? Math.round(amountFloat * 100) : undefined;

    refundMutation.mutate({
      order_id: refundOrder.id,
      amount_cents: amountCents,
      reason: refundReason,
    });
  };

  const handleExecuteGrant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantUserId.trim()) {
      setGrantError("L'ID utilisateur est requis.");
      return;
    }
    grantMutation.mutate({
      user_id: grantUserId.trim(),
      grant_type: grantType,
      amount_or_sku: grantAmountOrSku.trim(),
      reason: grantReason.trim(),
      expires_at: grantExpiry ? new Date(grantExpiry).toISOString() : undefined,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à l'administration
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-full uppercase tracking-wider mb-2">
                <ShieldAlert className="w-3.5 h-3.5" />
                Console d'Intégrité Financière
              </div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                Gestion Administrative de la Facturation
              </h1>
              <p className="text-slate-600 mt-1">
                Supervision des commandes, abonnements, journal d'audit, webhooks et rapprochement.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 gap-6 text-sm font-medium text-slate-600 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab("orders")}
            className={`pb-3 border-b-2 whitespace-nowrap transition flex items-center gap-2 ${
              activeTab === "orders"
                ? "border-indigo-600 text-indigo-600 font-bold"
                : "border-transparent hover:text-slate-900"
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            Commandes & Remboursements
          </button>
          <button
            onClick={() => setActiveTab("subscriptions")}
            className={`pb-3 border-b-2 whitespace-nowrap transition flex items-center gap-2 ${
              activeTab === "subscriptions"
                ? "border-indigo-600 text-indigo-600 font-bold"
                : "border-transparent hover:text-slate-900"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Abonnements
          </button>
          <button
            onClick={() => setActiveTab("ledger")}
            className={`pb-3 border-b-2 whitespace-nowrap transition flex items-center gap-2 ${
              activeTab === "ledger"
                ? "border-indigo-600 text-indigo-600 font-bold"
                : "border-transparent hover:text-slate-900"
            }`}
          >
            <History className="w-4 h-4" />
            Grand Livre Financier
          </button>
          <button
            onClick={() => setActiveTab("webhooks")}
            className={`pb-3 border-b-2 whitespace-nowrap transition flex items-center gap-2 ${
              activeTab === "webhooks"
                ? "border-indigo-600 text-indigo-600 font-bold"
                : "border-transparent hover:text-slate-900"
            }`}
          >
            <Activity className="w-4 h-4" />
            Webhooks Stripe
          </button>
          <button
            onClick={() => setActiveTab("grants")}
            className={`pb-3 border-b-2 whitespace-nowrap transition flex items-center gap-2 ${
              activeTab === "grants"
                ? "border-indigo-600 text-indigo-600 font-bold"
                : "border-transparent hover:text-slate-900"
            }`}
          >
            <Gift className="w-4 h-4" />
            Attributions Manuelles
          </button>
          <button
            onClick={() => setActiveTab("reconciliation")}
            className={`pb-3 border-b-2 whitespace-nowrap transition flex items-center gap-2 ${
              activeTab === "reconciliation"
                ? "border-indigo-600 text-indigo-600 font-bold"
                : "border-transparent hover:text-slate-900"
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            Rapprochement & Audit
          </button>
        </div>

        {/* Tab 1: Orders */}
        {activeTab === "orders" && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Toutes les Commandes Plateforme</h2>
              <span className="text-xs text-slate-500">{orders.length} commandes</span>
            </div>

            {loadingOrders ? (
              <div className="p-10 text-center text-slate-500">Chargement des commandes...</div>
            ) : orders.length === 0 ? (
              <div className="p-10 text-center text-slate-500">Aucune commande trouvée.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-3.5 px-6">N° Commande</th>
                      <th className="py-3.5 px-6">Utilisateur ID</th>
                      <th className="py-3.5 px-6">Date</th>
                      <th className="py-3.5 px-6">Montant Total</th>
                      <th className="py-3.5 px-6">Statut</th>
                      <th className="py-3.5 px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {orders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50/50">
                        <td className="py-4 px-6 font-mono font-medium text-slate-900">
                          {o.order_number}
                        </td>
                        <td className="py-4 px-6 font-mono text-xs text-slate-500">
                          {o.user_id.slice(0, 8)}...
                        </td>
                        <td className="py-4 px-6 text-slate-500 whitespace-nowrap">
                          {formatDate(o.created_at)}
                        </td>
                        <td className="py-4 px-6 font-bold text-slate-900">
                          {formatCents(o.total_cents, o.currency)}
                          {o.refunded_amount_cents > 0 && (
                            <span className="block text-xs font-normal text-rose-600">
                              Remboursé: {formatCents(o.refunded_amount_cents, o.currency)}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              o.status === "paid"
                                ? "bg-emerald-100 text-emerald-800"
                                : o.status === "refunded"
                                ? "bg-purple-100 text-purple-800"
                                : o.status === "partially_refunded"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {o.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          {o.status === "paid" || o.status === "partially_refunded" ? (
                            <button
                              onClick={() => handleOpenRefund(o)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition"
                            >
                              Rembourser
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Subscriptions */}
        {activeTab === "subscriptions" && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Abonnements Récurrents Actifs</h2>
              <span className="text-xs text-slate-500">{subscriptions.length} abonnements</span>
            </div>

            {loadingSubs ? (
              <div className="p-10 text-center text-slate-500">Chargement des abonnements...</div>
            ) : subscriptions.length === 0 ? (
              <div className="p-10 text-center text-slate-500">Aucun abonnement trouvé.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-3.5 px-6">ID Utilisateur</th>
                      <th className="py-3.5 px-6">Formule</th>
                      <th className="py-3.5 px-6">Statut</th>
                      <th className="py-3.5 px-6">Échéance</th>
                      <th className="py-3.5 px-6">Résiliation programmée</th>
                      <th className="py-3.5 px-6">Fournisseur</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {subscriptions.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/50">
                        <td className="py-4 px-6 font-mono text-xs text-slate-600">
                          {s.user_id}
                        </td>
                        <td className="py-4 px-6 font-bold text-slate-900">
                          {s.plan_tier.toUpperCase()}
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              s.status === "active"
                                ? "bg-emerald-100 text-emerald-800"
                                : s.status === "past_due"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {s.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-slate-500 whitespace-nowrap">
                          {formatDate(s.current_period_end)}
                        </td>
                        <td className="py-4 px-6">
                          {s.cancel_at_period_end ? (
                            <span className="text-amber-600 font-semibold text-xs">Oui</span>
                          ) : (
                            <span className="text-slate-400 text-xs">Non</span>
                          )}
                        </td>
                        <td className="py-4 px-6 font-mono text-xs text-slate-500">
                          {s.provider}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Ledger */}
        {activeTab === "ledger" && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Grand Livre Financier (Immuable)</h2>
                <p className="text-xs text-slate-500">
                  Journal d'écritures en partie double de toutes les transactions financières.
                </p>
              </div>
              <span className="text-xs text-slate-500">{ledger.length} écritures</span>
            </div>

            {loadingLedger ? (
              <div className="p-10 text-center text-slate-500">Chargement du journal...</div>
            ) : ledger.length === 0 ? (
              <div className="p-10 text-center text-slate-500">Aucune écriture comptable.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-3.5 px-6">Date</th>
                      <th className="py-3.5 px-6">Type d'Écriture</th>
                      <th className="py-3.5 px-6">Montant</th>
                      <th className="py-3.5 px-6">Référence</th>
                      <th className="py-3.5 px-6">Fournisseur</th>
                      <th className="py-3.5 px-6">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {ledger.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50/50">
                        <td className="py-4 px-6 text-slate-500 whitespace-nowrap text-xs">
                          {formatDate(l.created_at)}
                        </td>
                        <td className="py-4 px-6 font-mono text-xs font-semibold text-indigo-700">
                          {l.entry_type}
                        </td>
                        <td className="py-4 px-6 font-bold text-slate-900">
                          {formatCents(l.amount_cents, l.currency)}
                        </td>
                        <td className="py-4 px-6 font-mono text-xs text-slate-500">
                          {l.reference_type}:{l.reference_id.slice(0, 8)}
                        </td>
                        <td className="py-4 px-6 font-mono text-xs text-slate-500">
                          {l.provider}
                        </td>
                        <td className="py-4 px-6 text-slate-600 text-xs truncate max-w-xs">
                          {l.description || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Webhooks */}
        {activeTab === "webhooks" && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Journal des Événements Webhook</h2>
                <p className="text-xs text-slate-500">
                  Événements cryptographiquement vérifiés et traités avec idempotence stricte.
                </p>
              </div>
              <span className="text-xs text-slate-500">{webhooks.length} événements</span>
            </div>

            {loadingWebhooks ? (
              <div className="p-10 text-center text-slate-500">Chargement des webhooks...</div>
            ) : webhooks.length === 0 ? (
              <div className="p-10 text-center text-slate-500">Aucun webhook enregistré.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-3.5 px-6">ID Événement Stripe</th>
                      <th className="py-3.5 px-6">Type d'Événement</th>
                      <th className="py-3.5 px-6">Reçu à</th>
                      <th className="py-3.5 px-6">Traité à</th>
                      <th className="py-3.5 px-6">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {webhooks.map((w) => (
                      <tr key={w.id} className="hover:bg-slate-50/50">
                        <td className="py-4 px-6 font-mono text-xs text-slate-900">
                          {w.provider_event_id}
                        </td>
                        <td className="py-4 px-6 font-mono text-xs font-semibold text-indigo-700">
                          {w.event_type}
                        </td>
                        <td className="py-4 px-6 text-slate-500 text-xs whitespace-nowrap">
                          {formatDate(w.received_at)}
                        </td>
                        <td className="py-4 px-6 text-slate-500 text-xs whitespace-nowrap">
                          {formatDate(w.processed_at)}
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              w.status === "processed"
                                ? "bg-emerald-100 text-emerald-800"
                                : w.status === "failed"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {w.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Grants */}
        {activeTab === "grants" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 max-w-2xl mx-auto shadow-sm space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Attribution Manuelle de Crédits / Droits</h2>
              <p className="text-sm text-slate-600 mt-1">
                Octroyez manuellement des crédits, débloquez une formule ou appliquez un geste commercial.
              </p>
            </div>

            {grantSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span>{grantSuccess}</span>
              </div>
            )}

            {grantError && (
              <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                <span>{grantError}</span>
              </div>
            )}

            <form onSubmit={handleExecuteGrant} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  ID Utilisateur (UUID) *
                </label>
                <input
                  type="text"
                  required
                  value={grantUserId}
                  onChange={(e) => setGrantUserId(e.target.value)}
                  placeholder="ex: 123e4567-e89b-12d3-a456-426614174000"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Type d'attribution *
                  </label>
                  <select
                    value={grantType}
                    onChange={(e) => setGrantType(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="credits">Crédits de pratique</option>
                    <option value="subscription_tier">Formule Abonnement</option>
                    <option value="feature_entitlement">Droit Spécifique</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Quantité ou SKU *
                  </label>
                  <input
                    type="text"
                    required
                    value={grantAmountOrSku}
                    onChange={(e) => setGrantAmountOrSku(e.target.value)}
                    placeholder="ex: 20 ou premium"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Motif d'attribution *
                </label>
                <input
                  type="text"
                  required
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                  placeholder="ex: Ticket support #402, geste commercial"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Date d'expiration (Optionnelle)
                </label>
                <input
                  type="date"
                  value={grantExpiry}
                  onChange={(e) => setGrantExpiry(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={grantMutation.isPending}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {grantMutation.isPending ? "Attribution en cours..." : "Effectuer l'attribution"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 6: Reconciliation */}
        {activeTab === "reconciliation" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Moteur de Rapprochement Quotidien</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Analyse l'intégrité de la base de données : détection des commandes bloquées, soldes
                  négatifs, réservations tuteurs orphelines et écarts de commissions.
                </p>
              </div>
              <button
                onClick={() => refetchRecon()}
                disabled={loadingRecon || isRefetchingRecon}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition inline-flex items-center gap-2 self-start flex-shrink-0"
              >
                <RefreshCw className={`w-4 h-4 ${isRefetchingRecon ? "animate-spin" : ""}`} />
                Exécuter l'audit maintenant
              </button>
            </div>

            {reconReport && (
              <div className="space-y-6">
                <div
                  className={`p-6 rounded-2xl border flex items-start gap-4 ${
                    reconReport.healthy
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : "bg-rose-50 border-rose-200 text-rose-900"
                  }`}
                >
                  {reconReport.healthy ? (
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-8 h-8 text-rose-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h3 className="text-lg font-bold">
                      {reconReport.healthy
                        ? "Intégrité Financière Parfaite"
                        : `${reconReport.total_findings} anomalie(s) détectée(s)`}
                    </h3>
                    <p className="text-sm mt-1 opacity-90">
                      Audit généré le {formatDate(reconReport.generated_at)}.{" "}
                      {reconReport.healthy
                        ? "Toutes les réservations, crédits, commandes et commissions sont cohérents."
                        : "Veuillez inspecter les anomalies ci-dessous."}
                    </p>
                  </div>
                </div>

                {/* Findings List */}
                {reconReport.findings.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-slate-100">
                      <h3 className="font-bold text-slate-900">Détail des Anomalies</h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {reconReport.findings.map((f, i) => (
                        <div key={i} className="p-4 sm:p-6 space-y-2 hover:bg-slate-50/50">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-semibold text-xs text-rose-700 bg-rose-50 px-2.5 py-1 rounded">
                              {f.category}
                            </span>
                            <span className="text-xs font-bold uppercase text-slate-500">
                              Sévérité : {f.severity}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-slate-900">{f.message}</p>
                          <p className="text-xs font-mono text-slate-500">Réf: {f.reference_id}</p>
                          {f.details && (
                            <pre className="text-xs bg-slate-100 p-2 rounded text-slate-700 overflow-x-auto">
                              {JSON.stringify(f.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Refund Modal */}
        {refundOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-100">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-rose-600">
                  <RotateCcw className="w-5 h-5" />
                  <h3 className="text-lg font-bold text-slate-900">Émettre un Remboursement</h3>
                </div>
                <button
                  onClick={() => setRefundOrder(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {refundError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                  <span>{refundError}</span>
                </div>
              )}

              <div className="text-xs bg-slate-50 p-3 rounded-lg space-y-1">
                <p>
                  <strong className="text-slate-700">Commande :</strong> #{refundOrder.order_number}
                </p>
                <p>
                  <strong className="text-slate-700">Montant total d'origine :</strong>{" "}
                  {formatCents(refundOrder.total_cents, refundOrder.currency)}
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Montant à rembourser (€) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={(refundOrder.total_cents - refundOrder.refunded_amount_cents) / 100}
                    value={refundAmountEur}
                    onChange={(e) => setRefundAmountEur(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Laissez le montant total pour un remboursement intégral.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Motif du remboursement *
                  </label>
                  <input
                    type="text"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRefundOrder(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium rounded-lg transition"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleExecuteRefund}
                  disabled={refundMutation.isPending}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {refundMutation.isPending ? "Traitement..." : "Confirmer le Remboursement"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
