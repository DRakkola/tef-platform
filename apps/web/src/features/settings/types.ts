/**
 * Type definitions for Student Profile & Settings (/settings).
 */

export type SettingsSection =
  | "profile"
  | "tef"
  | "notifications"
  | "security"
  | "privacy"
  | "billing";

export interface ProfileFormState {
  displayName: string;
  email: string;
  isVerified: boolean;
  timezone: string;
  language: string;
}

export interface TefPreferencesFormState {
  targetExam: string;
  targetLevel: string;
  targetDate: string;
  dailyMinutes: number;
  focusAreas: string[];
  estimatedLevel?: string;
}

export interface NotificationCategoryPreferences {
  email: boolean;
  in_app: boolean;
}

export interface NotificationSettingsState {
  learning: NotificationCategoryPreferences;
  teacher: NotificationCategoryPreferences;
  practice: NotificationCategoryPreferences;
  billing: NotificationCategoryPreferences;
  system: NotificationCategoryPreferences; // Mandatory: email=true, in_app=true
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

export interface StudentDataExportResponse {
  user_id: string;
  email: string;
  exported_at: string;
  profile: Record<string, any>;
  assessments_history: any[];
  writing_submissions: any[];
  speaking_sessions: any[];
  practice_pool_matches: any[];
  activity_logs: any[];
  gdpr_notice: string;
}

export interface DeleteAccountPayload {
  password: string;
  reason?: string;
}

export interface BillingSummaryData {
  planTier: string;
  status: string;
  creditsBalance: number;
  renewalDate: string | null;
}
