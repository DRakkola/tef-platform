/**
 * React Query hooks and search utilities for Help & Support (/help).
 */

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMySupportTickets, submitSupportTicket } from "./api";
import { HELP_ARTICLES, FAQ_ITEMS } from "./content";
import type { CreateSupportTicketPayload, HelpArticle, FaqItem } from "./types";
import { telemetry } from "@/features/analytics/telemetry";

export const SUPPORT_TICKETS_KEY = ["support", "tickets", "me"];

export function useHelpSearch(query: string, selectedCategoryId: string | null) {
  const cleanQuery = query.trim().toLowerCase();

  const filteredArticles = useMemo<HelpArticle[]>(() => {
    return HELP_ARTICLES.filter((article) => {
      const matchesCategory =
        !selectedCategoryId || article.categoryId === selectedCategoryId;
      if (!matchesCategory) return false;

      if (!cleanQuery) return true;

      const inTitle = article.title.toLowerCase().includes(cleanQuery);
      const inExcerpt = article.excerpt.toLowerCase().includes(cleanQuery);
      const inContent = article.content.toLowerCase().includes(cleanQuery);
      const inTags = article.tags.some((tag) => tag.toLowerCase().includes(cleanQuery));

      return inTitle || inExcerpt || inContent || inTags;
    });
  }, [cleanQuery, selectedCategoryId]);

  const filteredFaqs = useMemo<FaqItem[]>(() => {
    return FAQ_ITEMS.filter((faq) => {
      const matchesCategory =
        !selectedCategoryId || faq.categoryId === selectedCategoryId;
      if (!matchesCategory) return false;

      if (!cleanQuery) return true;

      const inQuestion = faq.question.toLowerCase().includes(cleanQuery);
      const inAnswer = faq.answer.toLowerCase().includes(cleanQuery);

      return inQuestion || inAnswer;
    });
  }, [cleanQuery, selectedCategoryId]);

  const totalResults = filteredArticles.length + filteredFaqs.length;

  return {
    filteredArticles,
    filteredFaqs,
    totalResults,
    hasSearch: cleanQuery.length > 0,
  };
}

export function useMySupportTickets() {
  const hasToken =
    typeof window !== "undefined" && Boolean(localStorage.getItem("auth_token"));

  return useQuery({
    queryKey: SUPPORT_TICKETS_KEY,
    queryFn: getMySupportTickets,
    enabled: hasToken,
    staleTime: 30 * 1000,
  });
}

export function useSubmitSupportTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateSupportTicketPayload) => submitSupportTicket(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: SUPPORT_TICKETS_KEY });
      telemetry.track("support_request_submitted", {
        ticketId: data.id,
        category: data.category,
      });
    },
  });
}
