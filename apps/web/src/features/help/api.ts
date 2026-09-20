/**
 * API client methods for Help & Support tickets (/help).
 */

import { apiClient } from "@/core/api";
import type {
  CreateSupportTicketPayload,
  CreateSupportTicketResponse,
  SupportTicket,
} from "./types";

export async function submitSupportTicket(
  payload: CreateSupportTicketPayload
): Promise<CreateSupportTicketResponse> {
  return apiClient<CreateSupportTicketResponse>("/analytics/support/tickets", {
    method: "POST",
    body: JSON.stringify({
      category: payload.category,
      subject: payload.subject,
      description: payload.description,
      priority: payload.priority || "medium",
      context: payload.context || {},
    }),
  });
}

export async function getMySupportTickets(): Promise<SupportTicket[]> {
  return apiClient<SupportTicket[]>("/analytics/support/tickets/me");
}

export async function getMySupportTicket(ticketId: string): Promise<SupportTicket> {
  return apiClient<SupportTicket>(`/analytics/support/tickets/me/${ticketId}`);
}
