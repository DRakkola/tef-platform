/**
 * Consolidated React Query hooks for Student Billing & Subscription (/billing).
 */

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSubscription,
  cancelSubscription,
  resumeSubscription,
  getCredits,
  getUsage,
  getOrders,
  getInvoices,
  getEntitlements,
  getProducts,
} from "../api";

export const BILLING_SUBSCRIPTION_KEY = ["billing", "subscription"];
export const BILLING_CREDITS_KEY = ["billing", "credits"];
export const BILLING_USAGE_KEY = ["billing", "usage"];
export const BILLING_ORDERS_KEY = ["billing", "orders"];
export const BILLING_INVOICES_KEY = ["billing", "invoices"];
export const BILLING_ENTITLEMENTS_KEY = ["billing", "entitlements"];
export const BILLING_PRODUCTS_KEY = ["billing", "products"];

export function useBillingData() {
  const queryClient = useQueryClient();

  const subscriptionQuery = useQuery({
    queryKey: BILLING_SUBSCRIPTION_KEY,
    queryFn: getSubscription,
    staleTime: 30 * 1000,
  });

  const creditsQuery = useQuery({
    queryKey: BILLING_CREDITS_KEY,
    queryFn: getCredits,
    staleTime: 30 * 1000,
  });

  const usageQuery = useQuery({
    queryKey: BILLING_USAGE_KEY,
    queryFn: getUsage,
    staleTime: 30 * 1000,
  });

  const ordersQuery = useQuery({
    queryKey: BILLING_ORDERS_KEY,
    queryFn: getOrders,
    staleTime: 30 * 1000,
  });

  const invoicesQuery = useQuery({
    queryKey: BILLING_INVOICES_KEY,
    queryFn: getInvoices,
    staleTime: 60 * 1000,
  });

  const entitlementsQuery = useQuery({
    queryKey: BILLING_ENTITLEMENTS_KEY,
    queryFn: getEntitlements,
    staleTime: 30 * 1000,
  });

  const productsQuery = useQuery({
    queryKey: BILLING_PRODUCTS_KEY,
    queryFn: getProducts,
    staleTime: 5 * 60 * 1000,
  });

  const cancelMutation = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BILLING_SUBSCRIPTION_KEY });
      queryClient.invalidateQueries({ queryKey: BILLING_ENTITLEMENTS_KEY });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: resumeSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BILLING_SUBSCRIPTION_KEY });
      queryClient.invalidateQueries({ queryKey: BILLING_ENTITLEMENTS_KEY });
    },
  });

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: BILLING_SUBSCRIPTION_KEY });
    queryClient.invalidateQueries({ queryKey: BILLING_CREDITS_KEY });
    queryClient.invalidateQueries({ queryKey: BILLING_USAGE_KEY });
    queryClient.invalidateQueries({ queryKey: BILLING_ORDERS_KEY });
    queryClient.invalidateQueries({ queryKey: BILLING_INVOICES_KEY });
    queryClient.invalidateQueries({ queryKey: BILLING_ENTITLEMENTS_KEY });
  }, [queryClient]);

  const isLoading =
    subscriptionQuery.isLoading ||
    creditsQuery.isLoading ||
    entitlementsQuery.isLoading;

  const isError =
    subscriptionQuery.isError &&
    creditsQuery.isError &&
    entitlementsQuery.isError;

  const refetchAll = useCallback(() => {
    subscriptionQuery.refetch();
    creditsQuery.refetch();
    usageQuery.refetch();
    ordersQuery.refetch();
    invoicesQuery.refetch();
    entitlementsQuery.refetch();
    productsQuery.refetch();
  }, [
    subscriptionQuery,
    creditsQuery,
    usageQuery,
    ordersQuery,
    invoicesQuery,
    entitlementsQuery,
    productsQuery,
  ]);

  return {
    subscription: subscriptionQuery.data,
    credits: creditsQuery.data,
    usage: usageQuery.data,
    orders: ordersQuery.data || [],
    invoices: invoicesQuery.data || [],
    entitlements: entitlementsQuery.data || {},
    products: productsQuery.data || [],
    isLoading,
    isError,
    cancelMutation,
    resumeMutation,
    invalidateAll,
    refetchAll,
  };
}
