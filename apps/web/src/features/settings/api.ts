/**
 * API client methods for Settings & Student Profile.
 */

import { apiClient } from "@/core/api";
import type {
  BillingSummaryData,
  ChangePasswordPayload,
  DeleteAccountPayload,
  StudentDataExportResponse,
} from "./types";

export interface OnboardingStateApi {
  onboarding_status: string;
  onboarding_step: number;
  target_exam: string;
  target_level: string;
  target_date: string | null;
  daily_minutes_available: number;
  timezone: string;
  native_language: string | null;
  learning_preferences: Record<string, any>;
}

export interface UserMeApi {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  is_beta_user: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  student_profile?: {
    id: string;
    user_id: string;
    target_exam: string;
    target_level: string;
    timezone: string;
    native_language: string | null;
    learning_preferences: Record<string, any>;
  } | null;
}

export async function getSettingsUser(): Promise<UserMeApi> {
  return apiClient<UserMeApi>("/auth/me");
}

export async function getOnboardingState(): Promise<OnboardingStateApi> {
  return apiClient<OnboardingStateApi>("/students/me/onboarding");
}

export async function updateOnboardingState(payload: {
  step?: number;
  target_exam?: string;
  target_level?: string;
  target_date?: string;
  daily_minutes_available?: number;
  timezone?: string;
  native_language?: string;
  learning_preferences?: Record<string, any>;
}): Promise<OnboardingStateApi> {
  return apiClient<OnboardingStateApi>("/students/me/onboarding", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function changePassword(
  payload: ChangePasswordPayload
): Promise<{ message: string }> {
  return apiClient<{ message: string }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function exportStudentData(): Promise<StudentDataExportResponse> {
  return apiClient<StudentDataExportResponse>("/students/me/export", {
    method: "POST",
  });
}

export async function deleteStudentAccount(
  payload: DeleteAccountPayload
): Promise<{ message: string; user_id: string; anonymized_at: string }> {
  return apiClient<{ message: string; user_id: string; anonymized_at: string }>(
    "/students/me",
    {
      method: "DELETE",
      body: JSON.stringify(payload),
    }
  );
}

export async function getBillingSummary(): Promise<BillingSummaryData> {
  try {
    const [subRes, creditsRes] = await Promise.allSettled([
      apiClient<{
        plan_tier: string;
        status: string;
        current_period_end: string | null;
      }>("/billing/subscription"),
      apiClient<{
        total_balance: number;
        available_balance: number;
      }>("/billing/credits"),
    ]);

    const planTier =
      subRes.status === "fulfilled" && subRes.value?.plan_tier
        ? subRes.value.plan_tier
        : "free";

    const status =
      subRes.status === "fulfilled" && subRes.value?.status
        ? subRes.value.status
        : "inactive";

    const renewalDate =
      subRes.status === "fulfilled" && subRes.value?.current_period_end
        ? subRes.value.current_period_end
        : null;

    const creditsBalance =
      creditsRes.status === "fulfilled" && typeof creditsRes.value?.available_balance === "number"
        ? creditsRes.value.available_balance
        : 0;

    return {
      planTier,
      status,
      creditsBalance,
      renewalDate,
    };
  } catch {
    return {
      planTier: "free",
      status: "inactive",
      creditsBalance: 0,
      renewalDate: null,
    };
  }
}
