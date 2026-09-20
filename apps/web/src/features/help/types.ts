/**
 * Types and interfaces for the Student Help & Support Center (/help).
 */

export type SupportTicketStatus =
  | "open"
  | "in_progress"
  | "waiting_user"
  | "resolved"
  | "closed";

export type SupportTicketPriority = "low" | "medium" | "high" | "urgent";

export interface HelpCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
  articleCount: number;
}

export interface HelpArticle {
  slug: string;
  title: string;
  categoryId: string;
  excerpt: string;
  content: string;
  relatedSlugs: string[];
  lastUpdated: string;
  tags: string[];
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  categoryId: string;
  articleSlug?: string;
}

export interface SupportTicket {
  id: string;
  user_id?: string | null;
  category: string;
  subject: string;
  description: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority | string;
  created_at: string;
  updated_at: string;
}

export interface CreateSupportTicketPayload {
  category: string;
  subject: string;
  description: string;
  priority?: SupportTicketPriority | string;
  context?: Record<string, any>;
}

export interface CreateSupportTicketResponse {
  id: string;
  user_id?: string | null;
  category: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}
