/**
 * TypeScript definitions for billing, subscriptions, credits, and monetization.
 */

export type ProductType =
  | "subscription"
  | "one_time"
  | "credit_pack"
  | "teacher_lesson"
  | "writing_correction"
  | "ai_usage";

export type BillingInterval = "monthly" | "annual" | "one_time";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "paused"
  | "cancelled"
  | "expired"
  | "incomplete";

export type OrderStatus =
  | "pending"
  | "paid"
  | "partially_refunded"
  | "refunded"
  | "failed"
  | "cancelled";

export type TeacherEarningStatus =
  | "pending"
  | "available"
  | "paid"
  | "refunded"
  | "reversed";

export interface ProductEntitlement {
  id: string;
  feature_key: string;
  entitlement_type: string;
  limit_units: number;
  is_unlimited: boolean;
}

export interface ProductPrice {
  id: string;
  product_id: string;
  currency: string;
  amount_cents: number;
  billing_interval: BillingInterval;
  is_active: boolean;
  provider_price_id?: string | null;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  product_type: ProductType;
  is_active: boolean;
  metadata_?: Record<string, any>;
  prices: ProductPrice[];
  entitlements: ProductEntitlement[];
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_tier: string;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  product_id?: string | null;
  price_id?: string | null;
  provider: string;
  provider_subscription_id?: string | null;
  cancelled_at?: string | null;
  product_name?: string | null;
}

export interface OrderItem {
  id: string;
  product_id: string;
  price_id: string;
  quantity: number;
  unit_price_cents: number;
  total_price_cents: number;
  product_name?: string | null;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  status: OrderStatus;
  currency: string;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  refunded_amount_cents: number;
  provider: string;
  provider_order_reference?: string | null;
  paid_at?: string | null;
  refunded_at?: string | null;
  created_at: string;
  items: OrderItem[];
}

export interface Invoice {
  id: string;
  invoice_number?: string | null;
  order_id?: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  pdf_url?: string | null;
}

export interface CreditGrant {
  id: string;
  initial_credits?: number;
  remaining_credits?: number;
  amount?: number;
  source?: string | null;
  grant_type: string;
  reason?: string | null;
  expires_at?: string | null;
  created_at: string;
}

export interface CreditConsumption {
  id: string;
  credits_consumed?: number;
  amount?: number;
  feature?: string;
  feature_key?: string;
  reference_id?: string | null;
  reference_type?: string | null;
  created_at: string;
}

export interface CreditBalance {
  user_id?: string;
  balance?: number;
  available_balance?: number;
  total_balance?: number;
  expiring_soon?: number;
  next_expiration_date?: string | null;
  speaking_credits?: number;
  writing_credits?: number;
  tutoring_hours?: number;
  active_grants?: CreditGrant[];
}

export interface CreditUsageOverview {
  balance: number;
  consumptions: CreditConsumption[];
  grants: CreditGrant[];
}

export interface TeacherEarning {
  id: string;
  teacher_id: string;
  booking_id: string;
  order_id?: string | null;
  gross_amount_cents: number;
  platform_fee_cents: number;
  net_amount_cents: number;
  currency: string;
  commission_rate_bps: number;
  status: TeacherEarningStatus;
  created_at: string;
}

export interface TeacherEarningsSummary {
  total_gross_cents: number;
  total_platform_fee_cents: number;
  total_net_cents: number;
  available_cents: number;
  pending_cents: number;
  paid_cents: number;
  currency: string;
  completed_lessons_count: number;
}

export interface BillingLedgerEntry {
  id: string;
  user_id: string;
  entry_type: string;
  amount_cents: number;
  currency: string;
  reference_type: string;
  reference_id: string;
  provider: string;
  provider_reference?: string | null;
  description?: string | null;
  created_at: string;
}

export interface PaymentWebhookEvent {
  id: string;
  provider: string;
  provider_event_id: string;
  event_type: string;
  received_at: string;
  processed_at?: string | null;
  status: string;
  processing_error?: string | null;
}

export interface CheckoutResponse {
  session_id: string;
  checkout_url: string;
  order_id: string;
  order_number: string;
  amount_total: number;
  currency: string;
  provider: string;
  status: string;
}

export interface ReservationResponse {
  id: string;
  slot_identifier: string;
  student_id: string;
  teacher_id: string;
  start_time: string;
  end_time: string;
  expires_at: string;
  status: string;
  checkout_session_id?: string | null;
  booking_id?: string | null;
}
