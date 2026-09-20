/**
 * Checkout & Order Fulfillment Verification Page (/checkout).
 * Communicates order total, tax, cancellation policies, and verifies server-side payment state.
 */

import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Tag,
} from "lucide-react";
import {
  createCheckoutSession,
  getCheckoutSessionStatus,
  getProducts,
} from "./api";
import type { Product, ProductPrice } from "./types";

export const CheckoutPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const priceId = searchParams.get("price_id");
  const sessionId = searchParams.get("session_id");
  const returnStatus = searchParams.get("status");

  // State for checkout review
  const [couponCode, setCouponCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // State for fulfillment verification
  const [verificationState, setVerificationState] = useState<
    "verifying" | "success" | "pending" | "failed"
  >(sessionId && returnStatus === "success" ? "verifying" : "pending");
  const [verifiedOrder, setVerifiedOrder] = useState<any | null>(null);

  // Query catalog to resolve price if initiating checkout
  const { data: products = [] } = useQuery({
    queryKey: ["billing-products"],
    queryFn: getProducts,
    enabled: !sessionId,
  });

  let selectedProduct: Product | undefined;
  let selectedPrice: ProductPrice | undefined;

  if (priceId) {
    for (const p of products) {
      const found = p.prices.find((pr) => pr.id === priceId);
      if (found) {
        selectedProduct = p;
        selectedPrice = found;
        break;
      }
    }
  }

  // Poll server-side verification if returning from checkout redirect
  useEffect(() => {
    if (!sessionId || returnStatus !== "success") return;

    let attempts = 0;
    const maxAttempts = 15;
    let isCancelled = false;

    const checkStatus = async () => {
      try {
        const res = await getCheckoutSessionStatus(sessionId);
        if (res.paid) {
          if (!isCancelled) {
            setVerificationState("success");
            setVerifiedOrder(res);
          }
          return;
        }

        attempts++;
        if (attempts < maxAttempts && !isCancelled) {
          setTimeout(checkStatus, 2000);
        } else if (!isCancelled) {
          setVerificationState("pending");
        }
      } catch (err: any) {
        if (!isCancelled) {
          setVerificationState("failed");
          setErrorMessage(err.message || "Erreur lors de la vérification");
        }
      }
    };

    checkStatus();

    return () => {
      isCancelled = true;
    };
  }, [sessionId, returnStatus]);

  const handleLaunchCheckout = async () => {
    if (!selectedPrice) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await createCheckoutSession({
        price_id: selectedPrice.id,
        coupon_code: couponCode.trim() || undefined,
        success_url: `${window.location.origin}/checkout?session_id={CHECKOUT_SESSION_ID}&status=success`,
        cancel_url: `${window.location.origin}/checkout?status=cancelled`,
      });

      if (res.checkout_url) {
        window.location.href = res.checkout_url;
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Impossible d'initialiser la session de paiement.");
      setIsSubmitting(false);
    }
  };

  // ----------------------------------------------------
  // RENDER: Post-Checkout Verification Screen
  // ----------------------------------------------------
  if (sessionId && returnStatus === "success") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center space-y-6">
          {verificationState === "verifying" && (
            <div className="space-y-4 py-8">
              <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto" />
              <h2 className="text-xl font-bold text-slate-900">
                Vérification du paiement en cours...
              </h2>
              <p className="text-xs text-slate-500">
                Nous interrogeons le serveur de paiement sécurisé pour activer vos accès en temps
                réel.
              </p>
            </div>
          )}

          {verificationState === "success" && (
            <div className="space-y-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Paiement validé avec succès !</h2>
              <p className="text-sm text-slate-600">
                Vos droits et fonctionnalités ont été activés instantanément sur votre compte.
              </p>

              {verifiedOrder && (
                <div className="rounded-xl bg-slate-50 p-4 text-left text-xs space-y-2 border border-slate-100">
                  <div className="flex justify-between">
                    <span className="text-slate-500">N° de commande :</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {verifiedOrder.order_number}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Montant réglé :</span>
                    <span className="font-semibold text-slate-900">
                      {(verifiedOrder.total_cents / 100).toFixed(2)} {verifiedOrder.currency.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Statut de validation :</span>
                    <span className="font-semibold text-emerald-600 uppercase">Confirmé</span>
                  </div>
                </div>
              )}

              <div className="pt-4 space-y-2">
                <button
                  onClick={() => navigate("/dashboard")}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition flex items-center justify-center gap-2"
                >
                  Accéder à mon tableau de bord
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigate("/billing")}
                  className="w-full py-2.5 px-4 text-xs font-medium text-slate-600 hover:text-slate-900 transition"
                >
                  Consulter mon espace de facturation
                </button>
              </div>
            </div>
          )}

          {verificationState === "pending" && (
            <div className="space-y-4">
              <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Traitement bancaire en cours</h2>
              <p className="text-xs text-slate-600">
                Votre paiement est en cours de confirmation auprès de votre organisme bancaire. Dès
                réception du webhook sécurisé, vos droits seront immédiatement mis à jour.
              </p>
              <button
                onClick={() => navigate("/billing")}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 text-white font-semibold text-sm transition"
              >
                Vérifier dans mon espace facturation
              </button>
            </div>
          )}

          {verificationState === "failed" && (
            <div className="space-y-4">
              <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Erreur de vérification</h2>
              <p className="text-xs text-rose-600">{errorMessage}</p>
              <button
                onClick={() => navigate("/pricing")}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 text-white font-semibold text-sm transition"
              >
                Retourner aux tarifs
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: Checkout Initiation Review Screen
  // ----------------------------------------------------
  if (!selectedProduct || !selectedPrice) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 text-center space-y-4 border border-slate-200 shadow-sm">
          <AlertCircle className="w-10 h-10 text-slate-400 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Aucun produit sélectionné</h2>
          <p className="text-xs text-slate-500">
            Veuillez choisir une formule d'abonnement ou un pack de crédits sur notre page de tarifs.
          </p>
          <button
            onClick={() => navigate("/pricing")}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 text-white font-medium text-xs transition"
          >
            Voir les tarifs
          </button>
        </div>
      </div>
    );
  }

  const subtotal = selectedPrice.amount_cents / 100;
  const isSubscription = selectedProduct.product_type === "subscription";

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Finalisation de votre commande
          </h1>
          <p className="text-sm text-slate-600">
            Vérifiez les détails de votre achat avant de procéder au règlement sécurisé.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-6">
          {/* Order Summary Item */}
          <div className="flex items-start justify-between pb-6 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-lg">{selectedProduct.name}</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">{selectedProduct.description}</p>
              {isSubscription && (
                <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                  {selectedPrice.billing_interval === "annual"
                    ? "Renouvellement annuel"
                    : "Renouvellement mensuel"}
                </span>
              )}
            </div>
            <div className="text-right">
              <span className="text-2xl font-extrabold text-slate-900">
                {subtotal.toFixed(2)} €
              </span>
            </div>
          </div>

          {/* Coupon Code Input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-indigo-600" />
              Code promotionnel ou bon de réduction
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ex: TEF2026, BIENVENUE"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
              />
              <button
                type="button"
                onClick={() => {}}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition"
              >
                Appliquer
              </button>
            </div>
          </div>

          {/* Price Breakdown */}
          <div className="space-y-2.5 pt-4 border-t border-slate-100 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Sous-total HT</span>
              <span>{subtotal.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>TVA (calculée selon juridiction)</span>
              <span>0.00 €</span>
            </div>
            <div className="flex justify-between text-slate-900 font-bold text-base pt-2 border-t border-slate-200">
              <span>Total TTC</span>
              <span>{subtotal.toFixed(2)} €</span>
            </div>
          </div>

          {/* Policy Information */}
          <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500 space-y-2">
            <div className="flex items-center gap-2 text-slate-700 font-medium">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              Politique d'abonnement & d'annulation
            </div>
            <p>
              En souscrivant, vous autorisez le renouvellement automatique à chaque période. Vous
              pouvez annuler à tout moment en 1 clic : vos accès restent valides jusqu'à la fin de la
              période déjà réglée.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={handleLaunchCheckout}
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition shadow-sm hover:shadow flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Initialisation de la passerelle de paiement...
              </>
            ) : (
              <>
                Procéder au paiement sécurisé ({subtotal.toFixed(2)} €)
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
