import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, HelpCircle, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { HelpArticle, FaqItem } from "../types";
import { HELP_CATEGORIES } from "../content";

interface SearchResultsViewProps {
  query: string;
  articles: HelpArticle[];
  faqs: FaqItem[];
  onOpenContactSupport: () => void;
  onSelectResult?: (slug: string) => void;
}

export const SearchResultsView: React.FC<SearchResultsViewProps> = ({
  query,
  articles,
  faqs,
  onOpenContactSupport,
  onSelectResult,
}) => {
  const totalCount = articles.length + faqs.length;

  const getCategoryTitle = (catId: string) => {
    return HELP_CATEGORIES.find((c) => c.id === catId)?.title || "Général";
  };

  if (totalCount === 0) {
    return (
      <Card className="border border-dashed border-border/80 p-8 sm:p-12 text-center bg-card/50">
        <div className="max-w-md mx-auto space-y-4">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <HelpCircle className="size-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground">
              Aucun résultat trouvé pour « {query} »
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Essayez une autre recherche ou contactez directement notre équipe pour une assistance personnalisée.
            </p>
          </div>
          <div className="pt-2">
            <Button
              type="button"
              onClick={onOpenContactSupport}
              className="font-medium text-xs sm:text-sm"
            >
              <MessageSquare className="size-4 mr-2" />
              Contacter le support
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
          Résultats pour « <span className="text-primary">{query}</span> » ({totalCount})
        </h2>
      </div>

      {/* Articles matches */}
      {articles.length > 0 && (
        <div className="space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Articles & Guides ({articles.length})
          </span>
          <div className="grid grid-cols-1 gap-3">
            {articles.map((art) => (
              <Card
                key={art.slug}
                className="border border-border/80 bg-card hover:border-primary/40 hover:shadow-xs transition-all"
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {getCategoryTitle(art.categoryId)}
                        </Badge>
                      </div>
                      <Link
                        to={`/help/${art.slug}`}
                        onClick={() => onSelectResult && onSelectResult(art.slug)}
                        className="text-sm sm:text-base font-semibold text-foreground hover:text-primary transition-colors block"
                      >
                        {art.title}
                      </Link>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {art.excerpt}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="text-xs text-primary hover:text-primary shrink-0 self-start sm:self-center"
                    >
                      <Link
                        to={`/help/${art.slug}`}
                        onClick={() => onSelectResult && onSelectResult(art.slug)}
                      >
                        <span>Lire</span>
                        <ArrowRight className="size-3.5 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* FAQs matches */}
      {faqs.length > 0 && (
        <div className="space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Questions fréquentes associées ({faqs.length})
          </span>
          <div className="grid grid-cols-1 gap-3">
            {faqs.map((faq) => (
              <Card key={faq.id} className="border border-border/80 bg-card p-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      {getCategoryTitle(faq.categoryId)}
                    </Badge>
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">
                    {faq.question}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
