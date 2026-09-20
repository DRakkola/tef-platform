/**
 * Student Help & Support Center Hub (/help).
 * Combines searchable knowledge base, category filters, FAQ accordion,
 * contact support modal, and past support tickets.
 */

import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { MessageSquare, LifeBuoy } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HelpSearchHeader } from "./components/HelpSearchHeader";
import { HelpCategoriesGrid } from "./components/HelpCategoriesGrid";
import { FaqAccordion } from "./components/FaqAccordion";
import { SearchResultsView } from "./components/SearchResultsView";
import { ContactSupportDialog } from "./components/ContactSupportDialog";
import { MyRequestsSection } from "./components/MyRequestsSection";
import { useHelpSearch, useMySupportTickets } from "./useHelp";
import { HELP_CATEGORIES } from "./content";
import { telemetry } from "@/features/analytics/telemetry";

export const HelpPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get("category");
  const actionParam = searchParams.get("action");
  const queryParam = searchParams.get("q") || "";

  const [searchQuery, setSearchQuery] = useState<string>(queryParam);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(categoryParam);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState<boolean>(actionParam === "contact");

  const { filteredArticles, filteredFaqs, hasSearch } = useHelpSearch(
    searchQuery,
    selectedCategoryId
  );

  const { data: tickets = [], isLoading: isTicketsLoading } = useMySupportTickets();

  // Track page view
  useEffect(() => {
    telemetry.track("help_viewed", {
      hasCategoryFilter: Boolean(selectedCategoryId),
      category: selectedCategoryId,
    });
  }, [selectedCategoryId]);

  // Sync state with URL params
  useEffect(() => {
    if (categoryParam !== selectedCategoryId) {
      setSelectedCategoryId(categoryParam);
    }
  }, [categoryParam]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (val.trim().length === 1) {
      telemetry.track("help_search_started", { query: val });
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
  };

  const handleSelectCategory = (catId: string | null) => {
    setSelectedCategoryId(catId);
    const newParams = new URLSearchParams(searchParams);
    if (catId) {
      newParams.set("category", catId);
    } else {
      newParams.delete("category");
    }
    setSearchParams(newParams, { replace: true });
  };

  const handleOpenContactDialog = () => {
    telemetry.track("support_contact_started", {
      category: selectedCategoryId || "general",
    });
    setIsContactDialogOpen(true);
  };

  return (
    <AppShell>
      <PageShell>
        <PageHeader
          title="Centre d'aide"
          description="Retrouvez les réponses aux questions fréquentes ou contactez notre équipe."
        />

        {/* Search Header Bar */}
        <div className="pt-1 pb-2">
          <HelpSearchHeader
            value={searchQuery}
            onChange={handleSearchChange}
            onClear={handleClearSearch}
          />
        </div>

        {/* Main Content Area */}
        <div className="space-y-8 pt-2">
          {hasSearch ? (
            <SearchResultsView
              query={searchQuery}
              articles={filteredArticles}
              faqs={filteredFaqs}
              onOpenContactSupport={handleOpenContactDialog}
              onSelectResult={(slug) => {
                telemetry.track("help_search_result_clicked", {
                  query: searchQuery,
                  slug,
                });
              }}
            />
          ) : (
            <>
              {/* 1. Category Navigation Grid */}
              <HelpCategoriesGrid
                categories={HELP_CATEGORIES}
                selectedCategoryId={selectedCategoryId}
                onSelectCategory={handleSelectCategory}
              />

              {/* 2. FAQ Accordion */}
              <FaqAccordion
                faqs={filteredFaqs}
                onOpenFaq={(faqId) => {
                  telemetry.track("faq_opened", { faqId });
                }}
              />

              {/* 3. My Support Requests (If user has tickets) */}
              <MyRequestsSection
                tickets={tickets}
                isLoading={isTicketsLoading}
                onOpenTicket={(ticketId) => {
                  telemetry.track("support_request_opened", { ticketId });
                }}
              />

              {/* 4. Contact Support Block */}
              <Card className="border border-border/80 bg-gradient-to-r from-primary/5 via-card to-card p-6 sm:p-8 rounded-xl shadow-xs">
                <CardContent className="p-0 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="space-y-1.5 max-w-xl">
                    <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
                      <LifeBuoy className="size-4" />
                      <span>Assistance personnalisée</span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                      Vous ne trouvez pas la réponse ?
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      Notre équipe pédagogique et technique est à votre écoute pour vous accompagner dans votre préparation et résoudre vos difficultés.
                    </p>
                  </div>

                  <Button
                    type="button"
                    onClick={handleOpenContactDialog}
                    className="shrink-0 font-medium text-xs sm:text-sm self-start sm:self-center shadow-xs"
                  >
                    <MessageSquare className="size-4 mr-2" />
                    Contacter le support
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Contact Support Dialog */}
        <ContactSupportDialog
          open={isContactDialogOpen}
          onOpenChange={setIsContactDialogOpen}
          defaultCategory={selectedCategoryId || "general"}
        />
      </PageShell>
    </AppShell>
  );
};
