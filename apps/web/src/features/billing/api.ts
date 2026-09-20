/**
 * API client methods for Billing, Subscriptions, Credits, Teacher Earnings, and Admin Billing.
 */

import { apiClient } from "@/core/api";
import type {
  BillingLedgerEntry,
  CheckoutResponse,
  CreditBalance,
  CreditUsageOverview,
  Invoice,
  Order,
  PaymentWebhookEvent,
  Product,
  ReservationResponse,
  Subscription,
  TeacherEarning,
  TeacherEarningsSummary,
} from "./types";

export async function getProducts(): Promise<Product[]> {
  return apiClient<Product[]>("/billing/products");
}

export async function getProduct(productId: string): Promise<Product> {
  return apiClient<Product>(`/billing/products/${productId}`);
}

export async function createCheckoutSession(payload: {
  price_id: string;
  success_url?: string;
  cancel_url?: string;
  coupon_code?: string;
  reservation_id?: string;
  metadata?: Record<string, string>;
}): Promise<CheckoutResponse> {
  return apiClient<CheckoutResponse>("/billing/checkout", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getCheckoutSessionStatus(
  sessionId: string
): Promise<{
  session_id: string;
  order_id: string;
  order_number: string;
  status: string;
  paid: boolean;
  total_cents: number;
  currency: string;
}> {
  return apiClient<{
    session_id: string;
    order_id: string;
    order_number: string;
    status: string;
    paid: boolean;
    total_cents: number;
    currency: string;
  }>(`/billing/checkout/${sessionId}`);
}

export async function getSubscription(): Promise<Subscription> {
  return apiClient<Subscription>("/billing/subscription");
}

export async function cancelSubscription(): Promise<Subscription> {
  return apiClient<Subscription>("/billing/subscription/cancel", {
    method: "POST",
  });
}

export async function resumeSubscription(): Promise<Subscription> {
  return apiClient<Subscription>("/billing/subscription/resume", {
    method: "POST",
  });
}

export async function getOrders(): Promise<Order[]> {
  return apiClient<Order[]>("/billing/orders");
}

export async function getOrder(orderId: string): Promise<Order> {
  return apiClient<Order>(`/billing/orders/${orderId}`);
}

export async function getCredits(): Promise<CreditBalance> {
  return apiClient<CreditBalance>("/billing/credits");
}

export async function getUsage(): Promise<CreditUsageOverview> {
  return apiClient<CreditUsageOverview>("/billing/usage");
}

export async function getInvoices(): Promise<Invoice[]> {
  return apiClient<Invoice[]>("/billing/invoices");
}

export async function getEntitlements(): Promise<Record<string, any>> {
  return apiClient<Record<string, any>>("/billing/entitlements");
}

export async function createReservation(payload: {
  teacher_id: string;
  start_time: string;
  end_time: string;
}): Promise<ReservationResponse> {
  return apiClient<ReservationResponse>("/billing/reservations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ----------------------------------------------------
// TEACHER EARNINGS
// ----------------------------------------------------

export async function getTeacherEarnings(): Promise<TeacherEarning[]> {
  return apiClient<TeacherEarning[]>("/teacher/earnings");
}

export async function getTeacherEarningsSummary(): Promise<TeacherEarningsSummary> {
  return apiClient<TeacherEarningsSummary>("/teacher/earnings/summary");
}

// ----------------------------------------------------
// ADMIN BILLING
// ----------------------------------------------------

export async function getAdminOrders(limit = 50, offset = 0): Promise<Order[]> {
  return apiClient<Order[]>(`/admin/billing/orders?limit=${limit}&offset=${offset}`);
}

export async function getAdminSubscriptions(limit = 50): Promise<Subscription[]> {
  return apiClient<Subscription[]>(`/admin/billing/subscriptions?limit=${limit}`);
}

export async function getAdminWebhooks(limit = 50): Promise<PaymentWebhookEvent[]> {
  return apiClient<PaymentWebhookEvent[]>(`/admin/billing/webhooks?limit=${limit}`);
}

export async function getAdminLedger(limit = 50, offset = 0): Promise<BillingLedgerEntry[]> {
  return apiClient<BillingLedgerEntry[]>(`/admin/billing/ledger?limit=${limit}&offset=${offset}`);
}

export async function issueAdminRefund(payload: {
  order_id: string;
  amount_cents?: number;
  reason?: string;
}): Promise<Order> {
  return apiClient<Order>("/admin/billing/refunds", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createAdminGrant(payload: {
  user_id: string;
  grant_type: string;
  amount_or_sku: string;
  reason: string;
  expires_at?: string;
}): Promise<Record<string, any>> {
  return apiClient<Record<string, any>>("/admin/billing/grants", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getAdminTeacherEarnings(limit = 50): Promise<TeacherEarning[]> {
  return apiClient<TeacherEarning[]>(`/admin/billing/teacher-earnings?limit=${limit}`);
}

export async function runReconciliation(): Promise<{
  generated_at: string;
  total_findings: number;
  healthy: boolean;
  findings: Array<{
    category: string;
    severity: string;
    reference_id: string;
    message: string;
    details: Record<string, any>;
  }>;
}> {
  return apiClient<{
    generated_at: string;
    total_findings: number;
    healthy: boolean;
    findings: Array<{
      category: string;
      severity: string;
      reference_id: string;
      message: string;
      details: Record<string, any>;
    }>;
  }>("/admin/billing/reconciliation");
}
