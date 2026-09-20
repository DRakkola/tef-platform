/**
 * Order History Page (/billing/orders).
 * Lists all orders placed by the user with status badges, line items,
 * and a modal for inspecting receipt and invoice details.
 */

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ShoppingBag,
  ArrowLeft,
  FileText,
  X,
  Printer,
} from "lucide-react";
import { getOrders } from "./api";
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

export const OrderHistoryPage: React.FC = () => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["billing-orders"],
    queryFn: getOrders,
  });

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
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
                Historique des Commandes
              </h1>
              <p className="text-slate-600 mt-1">
                Consultez le détail de tous vos achats, abonnements et crédits commandés.
              </p>
            </div>
            <Link
              to="/pricing"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition inline-flex items-center gap-2 self-start"
            >
              <ShoppingBag className="w-4 h-4" />
              Nouvelle commande
            </Link>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500">
              Chargement de vos commandes...
            </div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <ShoppingBag className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="text-lg font-semibold text-slate-900">Aucune commande trouvée</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                Vous n'avez pas encore effectué d'achat sur la plateforme.
              </p>
              <Link
                to="/pricing"
                className="inline-block mt-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Découvrir nos offres &rarr;
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-4 px-6">N° Commande</th>
                    <th className="py-4 px-6">Date</th>
                    <th className="py-4 px-6">Articles</th>
                    <th className="py-4 px-6">Montant TTC</th>
                    <th className="py-4 px-6">Statut</th>
                    <th className="py-4 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-4 px-6 font-mono font-medium text-slate-900">
                        {order.order_number}
                      </td>
                      <td className="py-4 px-6 text-slate-500 whitespace-nowrap">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="py-4 px-6 max-w-xs truncate">
                        {order.items.map((it) => it.product_name || "Article").join(", ")}
                      </td>
                      <td className="py-4 px-6 font-semibold text-slate-900 whitespace-nowrap">
                        {formatCents(order.total_cents, order.currency)}
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            order.status === "paid"
                              ? "bg-emerald-100 text-emerald-800"
                              : order.status === "refunded"
                              ? "bg-purple-100 text-purple-800"
                              : order.status === "partially_refunded"
                              ? "bg-amber-100 text-amber-800"
                              : order.status === "pending"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {order.status === "paid" && "PAYÉ"}
                          {order.status === "refunded" && "REMBOURSÉ"}
                          {order.status === "partially_refunded" && "PARTIELLEMENT REMBOURSÉ"}
                          {order.status === "pending" && "EN ATTENTE"}
                          {order.status === "failed" && "ÉCHOUÉ"}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Voir Reçu
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Receipt Modal */}
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Reçu d'Achat</h3>
                    <p className="text-xs text-slate-500 font-mono">
                      Commande #{selectedOrder.order_number}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Order Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs bg-slate-50 p-4 rounded-xl">
                <div>
                  <span className="text-slate-500 block">Date d'émission</span>
                  <span className="font-semibold text-slate-800">
                    {formatDate(selectedOrder.created_at)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Moyen de paiement</span>
                  <span className="font-semibold text-slate-800">
                    {selectedOrder.provider.toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Statut</span>
                  <span className="font-semibold text-emerald-700">
                    {selectedOrder.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Articles commandés
                </h4>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {selectedOrder.items.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 flex items-center justify-between text-sm hover:bg-slate-50/50"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">
                          {item.product_name || "Article"}
                        </p>
                        <p className="text-xs text-slate-500">Quantité : {item.quantity}</p>
                      </div>
                      <span className="font-semibold text-slate-900">
                        {formatCents(item.total_price_cents, selectedOrder.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Calculation */}
              <div className="space-y-2 pt-2 border-t border-slate-100 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Sous-total HT</span>
                  <span>{formatCents(selectedOrder.subtotal_cents, selectedOrder.currency)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>TVA / Taxes applicables</span>
                  <span>{formatCents(selectedOrder.tax_cents, selectedOrder.currency)}</span>
                </div>
                {selectedOrder.refunded_amount_cents > 0 && (
                  <div className="flex justify-between text-rose-600 font-medium">
                    <span>Montant remboursé</span>
                    <span>
                      -{formatCents(selectedOrder.refunded_amount_cents, selectedOrder.currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total Payé TTC</span>
                  <span>{formatCents(selectedOrder.total_cents, selectedOrder.currency)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold rounded-lg transition inline-flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  Imprimer
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
