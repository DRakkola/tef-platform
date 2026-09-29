/**
 * Runtime environment configuration for the Web frontend.
 */

export interface AppConfig {
  apiUrl: string;
  wsUrl: string;
  environment: string;
  isProduction: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

const resolveApiUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL?.trim();
  if (!envUrl) {
    return "/api/v1";
  }
  const clean = envUrl.replace(/\/+$/, "");
  if (!clean.endsWith("/api/v1")) {
    return `${clean}/api/v1`;
  }
  return clean;
};

const defaultApiUrl = resolveApiUrl();

const resolveWsUrl = (): string => {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL.trim().replace(/\/+$/, "");
  }
  if (defaultApiUrl.startsWith("http://") || defaultApiUrl.startsWith("https://")) {
    const base = defaultApiUrl.replace(/\/api\/v1$/, "");
    return base.replace(/^http/, "ws");
  }
  return "";
};

export const config: AppConfig = {
  apiUrl: defaultApiUrl,
  wsUrl: resolveWsUrl(),
  environment: import.meta.env.MODE || "development",
  isProduction: import.meta.env.PROD,
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || "https://lisekikckvvjshculasd.supabase.co",
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
};

/**
 * Returns full API URL for a given path.
 * Handles both relative paths (e.g. "/auth/login" or "/api/v1/auth/login")
 * and ensures config.apiUrl is prepended when it points to an external origin.
 */
export const getApiUrl = (path: string): string => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (config.apiUrl.endsWith("/api/v1") && cleanPath.startsWith("/api/v1")) {
    return `${config.apiUrl}${cleanPath.replace(/^\/api\/v1/, "")}`;
  }
  return `${config.apiUrl}${cleanPath}`;
};
