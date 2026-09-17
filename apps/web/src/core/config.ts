/**
 * Runtime environment configuration for the Web frontend.
 */

export interface AppConfig {
  apiUrl: string;
  environment: string;
  isProduction: boolean;
}

export const config: AppConfig = {
  apiUrl: import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1",
  environment: import.meta.env.MODE || "development",
  isProduction: import.meta.env.PROD,
};
