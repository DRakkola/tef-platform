/**
 * Centralized API client abstraction.
 */

import { config } from "./config";

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    request_id?: string;
    details?: Array<{ loc: string[]; msg: string; type: string }>;
  };
}

export class ApiError extends Error {
  status: number;
  code: string;
  requestId?: string;
  details?: Array<{ loc: string[]; msg: string; type: string }>;

  constructor(
    status: number,
    code: string,
    message: string,
    requestId?: string,
    details?: Array<{ loc: string[]; msg: string; type: string }>
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${config.apiUrl}${cleanEndpoint}`;

  const requestId = crypto.randomUUID();
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("X-Request-ID", requestId);

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("auth_token");
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData: ApiErrorPayload | null = null;
    try {
      errorData = (await response.json()) as ApiErrorPayload;
    } catch {
      // Body not JSON
    }

    throw new ApiError(
      response.status,
      errorData?.error?.code || "HTTP_ERROR",
      errorData?.error?.message || `Request failed with status ${response.status}`,
      errorData?.error?.request_id || response.headers.get("X-Request-ID") || undefined,
      errorData?.error?.details
    );
  }

  return response.json() as Promise<T>;
}
