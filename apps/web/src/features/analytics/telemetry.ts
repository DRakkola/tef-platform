/**
 * Client-side Telemetry and Event Tracking Service.
 *
 * Guaranteed fail-safe: telemetric dispatch never disrupts UI rendering,
 * student assessment taking, checkout, or network retries.
 */

export interface TelemetryEventPayload {
  eventType: string;
  actorId?: string;
  sessionId?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
  schemaVersion?: string;
}

class TelemetryClient {
  private sessionId: string;
  private apiEndpoint = "/api/v1/analytics/events";

  constructor() {
    this.sessionId = this.getOrCreateSessionId();
  }

  private getOrCreateSessionId(): string {
    if (typeof window === "undefined") return "server-session";
    try {
      let sid = sessionStorage.getItem("tef_telemetry_session_id");
      if (!sid) {
        sid = "sess_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
        sessionStorage.setItem("tef_telemetry_session_id", sid);
      }
      return sid;
    } catch {
      return "ephemeral_session";
    }
  }

  /**
   * Tracks an immutable telemetry event. Fail-safe by design.
   */
  public track(
    eventType: string,
    metadata: Record<string, any> = {},
    entityType?: string,
    entityId?: string
  ): void {
    if (typeof window === "undefined") return;

    try {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const payload = {
        event_id: crypto.randomUUID ? crypto.randomUUID() : undefined,
        event_type: eventType,
        session_id: this.sessionId,
        entity_type: entityType,
        entity_id: entityId,
        metadata,
        schema_version: "v1.0.0",
        occurred_at: new Date().toISOString(),
      };

      const url =
        typeof window !== "undefined" && window.location?.origin && window.location.origin !== "null"
          ? `${window.location.origin}${this.apiEndpoint}`
          : this.apiEndpoint;

      // Fire and forget via fetch
      fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch((err) => {
        if (import.meta.env?.DEV) {
          console.debug("[Telemetry] Failed to dispatch event:", eventType, err);
        }
      });
    } catch {
      // Fail-safe isolation: swallow errors completely
    }
  }
}

export const telemetry = new TelemetryClient();
