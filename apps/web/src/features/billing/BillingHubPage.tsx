/**
 * Student Billing & Subscription Hub (/billing).
 * Integrates AppShell, PageShell, PageHeader, CurrentPlanHero, EntitlementsSection,
 * PlanCatalogSection, CreditBalanceSection, PaymentHistorySection, InvoicesSection,
 * CancelSubscriptionDialog, and CheckoutReturnBanner.
 */

import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, RotateCw } from "lucide-react";
import { useBillingData } from "./hooks/useBillingData";
import { CurrentPlanHero } from "./components/CurrentPlanHero";
import { EntitlementsSection } from "./components/EntitlementsSection";
import { PlanCatalogSection } from "./components/PlanCatalogSection";
import { CreditBalanceSection } from "./components/CreditBalanceSection";
import { PaymentHistorySection } from "./components/PaymentHistorySection";
import { InvoicesSection } from "./components/InvoicesSection";
import { CancelSubscriptionDialog } from "./components/CancelSubscriptionDialog";
import { CheckoutReturnBanner, type CheckoutReturnStatus } from "./components/CheckoutReturnBanner";
import { BillingSupportBlock } from "./components/BillingSupportBlock";
import { getCheckoutSessionStatus } from "./api";
import { telemetry } from "@/features/analytics/telemetry";

export const BillingHubPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const sessionId = searchParams.get("session_id");
  const returnStatusParam = searchParams.get("status");

  const [returnStatus, setReturnStatus] = useState<CheckoutReturnStatus>(null);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isResuming, setIsResuming] = useState(false);

  const {
    subscription,
    credits,
    usage,
    orders,
    invoices,
    entitlements,
    products,
    isLoading,
    isError,
    cancelMutation,
    resumeMutation,
    invalidateAll,
    refetchAll,
  } = useBillingData();

  // Track page view
  useEffect(() => {
    telemetry.track("billing_viewed", {
      hasSubscription: Boolean(subscription && subscription.status === "active"),
      planTier: subscription?.plan_tier || "free",
    });
  }, [subscription]);

  // Handle returning from hosted checkout redirect
  const checkedSessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionId || checkedSessionRef.current === sessionId) return;
    checkedSessionRef.current = sessionId;

    telemetry.track("checkout_returned", { sessionId, status: returnStatusParam });

    if (returnStatusParam === "cancelled") {
      setReturnStatus("cancelled");
      return;
    }

    setReturnStatus("pending");

    let attempts = 0;
    const maxAttempts = 10;
    let isCancelled = false;

    const pollStatus = async () => {
      try {
        const res = await getCheckoutSessionStatus(sessionId);
        if (res.paid) {
          if (!isCancelled) {
            setReturnStatus("success");
            invalidateAll();
            telemetry.track("payment_confirmed", { sessionId, orderId: res.order_id });
          }
          return;
        }

        attempts++;
        if (attempts < maxAttempts && !isCancelled) {
          setTimeout(pollStatus, 2000);
        } else if (!isCancelled) {
          setReturnStatus("pending");
        }
      } catch (err) {
        if (!isCancelled) {
          setReturnStatus("failed");
          telemetry.track("payment_failed", { sessionId });
        }
      }
    };

    pollStatus();

    return () => {
      isCancelled = true;
    };
  }, [sessionId, returnStatusParam, invalidateAll]);

  const handleDismissBanner = () => {
    setReturnStatus(null);
    // Clean up query params
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("session_id");
    newParams.delete("status");
    setSearchParams(newParams, { replace: true });
  };

  const handleSelectPrice = (priceId: string) => {
    telemetry.track("plan_selected", { priceId });
    navigate(`/checkout?price_id=${priceId}`);
  };

  const handleScrollToPlans = () => {
    const el = document.getElementById("plans-catalog-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleConfirmCancel = async () => {
    try {
      await cancelMutation.mutateAsync();
      setIsCancelDialogOpen(false);
      telemetry.track("subscription_cancelled");
    } catch {
      // Error handled by mutation state
    }
  };

  const handleResumeSubscription = async () => {
    setIsResuming(true);
    try {
      await resumeMutation.mutateAsync();
      telemetry.track("subscription_resumed");
    } finally {
      setIsResuming(false);
    }
  };

  // Status Badge for Header
  const getHeaderStatusBadge = () => {
    if (!subscription || subscription.status !== "active") {
      return (
        <Badge variant="secondary" className="text-xs">
          Formule Découverte
        </Badge>
      );
    }
    if (subscription.cancel_at_period_end) {
      return (
        <Badge variant="outline" className="text-xs text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10">
          Fin de période
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
        Actif
      </Badge>
    );
  };

  return (
    <AppShell>
      <PageShell>
        <PageHeader
          title="Abonnement et facturation"
          description="Gérez votre abonnement, vos crédits et vos paiements."
          badge={getHeaderStatusBadge()}
        />

        {/* Checkout Return Status Banner */}
        <CheckoutReturnBanner
          status={returnStatus}
          onDismiss={handleDismissBanner}
        />

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="space-y-6">
            <Skeleton className="h-44 w-full rounded-xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-56 rounded-xl" />
              <Skeleton className="h-56 rounded-xl" />
            </div>
            <Skeleton className="h-72 w-full rounded-xl" />
          </div>
        )}

        {/* Global Error Banner */}
        {!isLoading && isError && (
          <div className="p-6 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive space-y-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="size-5 shrink-0" />
              <div>
                <h3 className="font-semibold text-sm">
                  Impossible de charger vos informations de facturation
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Vérifiez votre connexion internet et réessayez.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refetchAll}
              className="border-destructive/30 hover:bg-destructive/10"
            >
              <RotateCw className="size-3.5 mr-2" />
              Réessayer
            </Button>
          </div>
        )}

        {/* Loaded Content */}
        {!isLoading && !isError && (
          <div className="space-y-8">
            {/* 1. Current Plan Hero */}
            <CurrentPlanHero
              subscription={subscription}
              credits={credits}
              onOpenCancelDialog={() => setIsCancelDialogOpen(true)}
              onResumeSubscription={handleResumeSubscription}
              isResuming={isResuming}
              onScrollToPlans={handleScrollToPlans}
            />

            {/* 2. Entitlements Section */}
            <EntitlementsSection
              entitlements={entitlements}
              creditsBalance={credits?.available_balance ?? credits?.balance}
            />

            {/* 3. Available Plans Catalog */}
            <PlanCatalogSection
              products={products}
              currentSubscription={subscription}
              onSelectPrice={handleSelectPrice}
            />

            {/* 4. Credit Balance & Recent Activity */}
            <CreditBalanceSection
              credits={credits}
              usage={usage}
              creditPackProducts={products.filter((p) => p.product_type === "credit_pack")}
              onBuyCredits={handleSelectPrice}
            />

            {/* 5. Payment / Order History */}
            <PaymentHistorySection orders={orders} />

            {/* 6. Invoices & Receipts */}
            <InvoicesSection invoices={invoices} />

            {/* 7. Support Block */}
            <BillingSupportBlock />

            {/* Cancellation Confirmation Dialog */}
            <CancelSubscriptionDialog
              open={isCancelDialogOpen}
              onOpenChange={setIsCancelDialogOpen}
              subscription={subscription}
              onConfirmCancel={handleConfirmCancel}
              isPending={cancelMutation.isPending}
            />
          </div>
        )}
      </PageShell>
    </AppShell>
  );
};
