/**
 * Runtime environment configuration for the Web frontend.
 */

export interface AppConfig {
  apiUrl: string;
  wsUrl: string;
  environment: string;
  isProduction: boolean;
}

const defaultApiUrl = import.meta.env.VITE_API_URL || "/api/v1";

const resolveWsUrl = (): string => {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  if (defaultApiUrl.startsWith("http://") || defaultApiUrl.startsWith("https://")) {
    return defaultApiUrl.replace(/^http/, "ws");
  }
  return "";
};

export const config: AppConfig = {
  apiUrl: defaultApiUrl,
  wsUrl: resolveWsUrl(),
  environment: import.meta.env.MODE || "development",
  isProduction: import.meta.env.PROD,
};
