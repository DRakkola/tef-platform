/**
 * React Query hooks for Settings and Student Profile.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSettingsUser,
  getOnboardingState,
  getBillingSummary,
  updateOnboardingState,
  changePassword,
  exportStudentData,
  deleteStudentAccount,
} from "./api";
import { apiClient } from "@/core/api";
import type {
  ChangePasswordPayload,
  DeleteAccountPayload,
  NotificationSettingsState,
} from "./types";

export const SETTINGS_QUERY_KEY = ["settings", "user_profile"];
export const ONBOARDING_QUERY_KEY = ["settings", "onboarding"];
export const BILLING_SUMMARY_QUERY_KEY = ["settings", "billing_summary"];
export const READINESS_SUMMARY_QUERY_KEY = ["settings", "readiness_summary"];

export function useSettingsData() {
  const userQuery = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: getSettingsUser,
    staleTime: 60 * 1000,
  });

  const onboardingQuery = useQuery({
    queryKey: ONBOARDING_QUERY_KEY,
    queryFn: getOnboardingState,
    staleTime: 60 * 1000,
  });

  const billingQuery = useQuery({
    queryKey: BILLING_SUMMARY_QUERY_KEY,
    queryFn: getBillingSummary,
    staleTime: 60 * 1000,
  });

  const readinessQuery = useQuery({
    queryKey: READINESS_SUMMARY_QUERY_KEY,
    queryFn: async () => {
      try {
        const res = await apiClient<{
          overall_readiness?: string;
          estimated_level?: string;
          target_gap?: { current_estimated_level?: string };
        }>("/students/me/dashboard");
        return res.estimated_level || res.target_gap?.current_estimated_level || "B1";
      } catch {
        return "B1";
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = userQuery.isLoading || onboardingQuery.isLoading || billingQuery.isLoading;
  const isError = userQuery.isError || onboardingQuery.isError;
  const error = userQuery.error || onboardingQuery.error;

  return {
    user: userQuery.data,
    onboarding: onboardingQuery.data,
    billing: billingQuery.data,
    estimatedLevel: readinessQuery.data || "B1",
    isLoading,
    isError,
    error,
    refetch: () => {
      userQuery.refetch();
      onboardingQuery.refetch();
      billingQuery.refetch();
      readinessQuery.refetch();
    },
  };
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      displayName: string;
      timezone: string;
      language: string;
    }) => {
      return updateOnboardingState({
        timezone: payload.timezone,
        native_language: payload.language,
        learning_preferences: {
          display_name: payload.displayName,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ONBOARDING_QUERY_KEY });
    },
  });
}

export function useUpdateTefPreferencesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      targetExam: string;
      targetLevel: string;
      targetDate?: string;
      dailyMinutes: number;
      focusAreas: string[];
    }) => {
      return updateOnboardingState({
        target_exam: payload.targetExam,
        target_level: payload.targetLevel,
        target_date: payload.targetDate || undefined,
        daily_minutes_available: payload.dailyMinutes,
        learning_preferences: {
          focus_areas: payload.focusAreas,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ONBOARDING_QUERY_KEY });
    },
  });
}

export function useUpdateNotificationPreferencesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (preferences: NotificationSettingsState) => {
      return updateOnboardingState({
        learning_preferences: {
          notification_preferences: preferences,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ONBOARDING_QUERY_KEY });
    },
  });
}

export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: (payload: ChangePasswordPayload) => changePassword(payload),
  });
}

export function useExportDataMutation() {
  return useMutation({
    mutationFn: exportStudentData,
  });
}

export function useDeleteAccountMutation() {
  return useMutation({
    mutationFn: (payload: DeleteAccountPayload) => deleteStudentAccount(payload),
  });
}
