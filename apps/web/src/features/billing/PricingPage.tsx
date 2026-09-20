/**
 * Pricing Catalog Page (/pricing).
 * Displays subscription tiers, credit packs, feature comparison, and checkout triggers.
 */

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Sparkles,
  Zap,
  GraduationCap,
  FileCheck,
  ShieldCheck,
  HelpCircle,
} from "lucide-react";
import { getProducts } from "./api";
import type { Product, ProductPrice } from "./types";

export const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["billing-products"],
    queryFn: getProducts,
  });

  const subscriptionProducts = products.filter((p) => p.product_type === "subscription");
  const creditPacks = products.filter((p) => p.product_type === "credit_pack");
  const teacherLesson = products.find((p) => p.product_type === "teacher_lesson");
  const writingCorrection = products.find((p) => p.product_type === "writing_correction");

  const handleSelectPrice = (priceId: string) => {
    navigate(`/checkout?price_id=${priceId}`);
  };

  const getActivePrice = (product: Product): ProductPrice | undefined => {
    return product.prices.find((pr) => pr.billing_interval === billingInterval) || product.prices[0];
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-full text-indigo-700 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Tarifs & Abonnements TEF Canada & IRN
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl">
            Passez votre TEF avec une confiance absolue
          </h1>
          <p className="max-w-2xl mx-auto text-lg text-slate-600">
            Choisissez la formule adaptée à votre objectif d'immigration et votre calendrier d'examen.
          </p>

          {/* Billing Interval Toggle */}
          <div className="flex items-center justify-center gap-4 pt-4">
            <span
              className={`text-sm font-medium ${
                billingInterval === "monthly" ? "text-slate-900" : "text-slate-500"
              }`}
            >
              Facturation mensuelle
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={billingInterval === "annual"}
              onClick={() =>
                setBillingInterval((prev) => (prev === "monthly" ? "annual" : "monthly"))
              }
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                billingInterval === "annual" ? "bg-indigo-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  billingInterval === "annual" ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <span
              className={`text-sm font-medium flex items-center gap-1.5 ${
                billingInterval === "annual" ? "text-slate-900" : "text-slate-500"
              }`}
            >
              Facturation annuelle
              <span className="px-2 py-0.5 text-xs font-bold text-emerald-700 bg-emerald-100 rounded-full">
                -17% d'économie
              </span>
            </span>
          </div>
        </div>

        {/* Subscription Tier Cards */}
        {isLoading ? (
          <div className="py-20 text-center text-slate-500">Chargement des formules...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {subscriptionProducts.map((prod) => {
              const activePrice = getActivePrice(prod);
              const isPremium = prod.sku === "tef-premium";
              const amount = activePrice ? activePrice.amount_cents / 100 : 0;

              return (
                <div
                  key={prod.id}
                  className={`relative rounded-2xl bg-white p-8 shadow-sm transition-all duration-200 flex flex-col justify-between ${
                    isPremium
                      ? "ring-2 ring-indigo-600 shadow-indigo-100 shadow-xl"
                      : "border border-slate-200"
                  }`}
                >
                  {isPremium && (
                    <div className="absolute -top-3.5 right-6 px-3 py-0.5 bg-indigo-600 text-white rounded-full text-xs font-semibold uppercase tracking-wide">
                      Recommandé
                    </div>
                  )}

                  <div className="space-y-4">
                    <h3 className="text-2xl font-bold text-slate-900">{prod.name}</h3>
                    <p className="text-sm text-slate-600 min-h-[40px]">{prod.description}</p>

                    <div className="pt-2 flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold text-slate-900">
                        {amount === 0 ? "0 €" : `${amount.toFixed(0)} €`}
                      </span>
                      <span className="text-sm font-medium text-slate-500">
                        {amount === 0
                          ? "/ mois"
                          : billingInterval === "annual"
                          ? "/ an"
                          : "/ mois"}
                      </span>
                    </div>

                    <div className="border-t border-slate-100 pt-6 space-y-3">
                      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Inclus dans l'accès :
                      </p>
                      {prod.entitlements.map((ent) => (
                        <div key={ent.id} className="flex items-center gap-3 text-sm text-slate-700">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          <span>
                            {ent.is_unlimited
                              ? `Accès illimité : ${ent.feature_key.replace(/_/g, " ")}`
                              : `${ent.limit_units} unités : ${ent.feature_key.replace(/_/g, " ")}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-8">
                    {isPremium && activePrice ? (
                      <button
                        onClick={() => handleSelectPrice(activePrice.id)}
                        className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition shadow-sm hover:shadow"
                      >
                        Passer à Réussite Pro
                      </button>
                    ) : (
                      <button
                        disabled
                        className="w-full py-3 px-4 rounded-xl bg-slate-100 text-slate-600 font-semibold text-sm cursor-default"
                      >
                        Formule Active par Défaut
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Credit Packs Section */}
        <div className="pt-8 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center justify-center gap-2">
              <Zap className="w-6 h-6 text-amber-500" />
              Recharges de Crédits d'Entraînement
            </h2>
            <p className="text-slate-600 text-sm max-w-xl mx-auto">
              Utilisez vos crédits à la demande pour l'évaluation IA, les corrections écrites ou
              les simulations orales. Les crédits n'expirent jamais.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {creditPacks.map((pack) => {
              const price = pack.prices[0];
              const cost = price ? price.amount_cents / 100 : 0;
              const isMedium = pack.sku === "credit-pack-medium";

              return (
                <div
                  key={pack.id}
                  className={`rounded-xl bg-white p-6 border transition flex flex-col justify-between ${
                    isMedium ? "border-amber-400 shadow-md ring-1 ring-amber-400" : "border-slate-200"
                  }`}
                >
                  <div className="space-y-3">
                    <h4 className="font-bold text-slate-900 text-lg">{pack.name}</h4>
                    <p className="text-xs text-slate-500">{pack.description}</p>
                    <div className="pt-2 text-3xl font-extrabold text-slate-900">
                      {cost.toFixed(0)} €
                    </div>
                  </div>

                  <div className="pt-6">
                    <button
                      onClick={() => price && handleSelectPrice(price.id)}
                      className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs transition"
                    >
                      Acheter ce pack
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 1-on-1 Services Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto pt-4">
          {teacherLesson && teacherLesson.prices[0] && (
            <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-white p-6 border border-indigo-200 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-indigo-700 text-xs font-semibold uppercase">
                  <GraduationCap className="w-4 h-4" />
                  Professeurs Certifiés
                </div>
                <h3 className="text-xl font-bold text-slate-900">{teacherLesson.name}</h3>
                <p className="text-sm text-slate-600">{teacherLesson.description}</p>
                <div className="text-3xl font-extrabold text-slate-900 pt-2">
                  {(teacherLesson.prices[0].amount_cents / 100).toFixed(0)} €
                  <span className="text-xs font-normal text-slate-500"> / heure</span>
                </div>
              </div>
              <div className="pt-6">
                <button
                  onClick={() => handleSelectPrice(teacherLesson.prices[0].id)}
                  className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition"
                >
                  Réserver un cours particulier
                </button>
              </div>
            </div>
          )}

          {writingCorrection && writingCorrection.prices[0] && (
            <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-white p-6 border border-emerald-200 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold uppercase">
                  <FileCheck className="w-4 h-4" />
                  Correction Humaine
                </div>
                <h3 className="text-xl font-bold text-slate-900">{writingCorrection.name}</h3>
                <p className="text-sm text-slate-600">{writingCorrection.description}</p>
                <div className="text-3xl font-extrabold text-slate-900 pt-2">
                  {(writingCorrection.prices[0].amount_cents / 100).toFixed(0)} €
                  <span className="text-xs font-normal text-slate-500"> / épreuve</span>
                </div>
              </div>
              <div className="pt-6">
                <button
                  onClick={() => handleSelectPrice(writingCorrection.prices[0].id)}
                  className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition"
                >
                  Commander une correction
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Security and Trust Banner */}
        <div className="max-w-4xl mx-auto rounded-xl bg-white border border-slate-200 p-6 flex items-center gap-4">
          <ShieldCheck className="w-10 h-10 text-indigo-600 flex-shrink-0" />
          <div className="text-sm text-slate-600">
            <p className="font-semibold text-slate-900">
              Paiements 100% sécurisés par Stripe & cryptage bancaire TLS 256 bits
            </p>
            <p>
              Aucune coordonnée bancaire n'est stockée sur nos serveurs. Annulation en 1 clic
              depuis votre espace personnel.
            </p>
          </div>
        </div>

        {/* FAQs */}
        <div className="max-w-3xl mx-auto space-y-4 pt-6">
          <h3 className="text-xl font-bold text-slate-900 text-center flex items-center justify-center gap-2">
            <HelpCircle className="w-5 h-5 text-indigo-600" />
            Foire Aux Questions
          </h3>
          <div className="divide-y divide-slate-200 rounded-xl bg-white border border-slate-200 p-6 space-y-4">
            <div>
              <h4 className="font-semibold text-slate-900 text-sm">
                Puis-je annuler mon abonnement à tout moment ?
              </h4>
              <p className="text-xs text-slate-600 mt-1">
                Oui. L'annulation prend effet à la date d'échéance de la période en cours. Vous
                conservez l'intégralité de vos accès jusqu'au dernier jour de votre période payée.
              </p>
            </div>
            <div className="pt-4">
              <h4 className="font-semibold text-slate-900 text-sm">
                Les crédits achetés ont-ils une date d'expiration ?
              </h4>
              <p className="text-xs text-slate-600 mt-1">
                Les crédits achetés via nos packs n'expirent jamais. Seuls certains crédits
                promotionnels peuvent avoir une date de fin de validité spécifiée lors de l'octroi.
              </p>
            </div>
            <div className="pt-4">
              <h4 className="font-semibold text-slate-900 text-sm">
                Comment se déroule le paiement d'une session avec un professeur ?
              </h4>
              <p className="text-xs text-slate-600 mt-1">
                Le créneau horaire est temporairement bloqué pendant 15 minutes. Dès validation du
                règlement, la session est confirmée et le professeur en est immédiatement notifié.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
