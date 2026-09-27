/**
 * Centralized API client abstraction.
 */

import { getApiUrl } from "./config";

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
  const url = getApiUrl(endpoint);

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
    const csrfMatch = document.cookie ? document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/) : null;
    if (csrfMatch && !headers.has("X-CSRF-Token")) {
      headers.set("X-CSRF-Token", decodeURIComponent(csrfMatch[1]));
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

    if (response.status === 401 && typeof window !== "undefined") {
      try {
        localStorage.removeItem("auth_token");
      } catch {
        // Sandboxed storage error
      }
      window.dispatchEvent(
        new CustomEvent("tef:auth-expired", {
          detail: { status: 401, endpoint },
        })
      );
    }

    const defaultCode = response.status === 401 ? "AUTH_REQUIRED" : "HTTP_ERROR";
    const defaultMessage =
      response.status === 401
        ? "Votre session a expiré ou une authentification est requise."
        : `Request failed with status ${response.status}`;

    throw new ApiError(
      response.status,
      errorData?.error?.code || defaultCode,
      errorData?.error?.message || defaultMessage,
      errorData?.error?.request_id || response.headers.get("X-Request-ID") || undefined,
      errorData?.error?.details
    );
  }

  return response.json() as Promise<T>;
}
