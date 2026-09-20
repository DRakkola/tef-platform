import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Tag, MessageSquare, ArrowRight, HelpCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ContactSupportDialog } from "./components/ContactSupportDialog";
import { HELP_ARTICLES, HELP_CATEGORIES } from "./content";
import { formatBillingDate } from "@/features/billing/components/CurrentPlanHero";
import { telemetry } from "@/features/analytics/telemetry";

export const ArticleDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [isContactDialogOpen, setIsContactDialogOpen] = useState<boolean>(false);

  const article = HELP_ARTICLES.find((a) => a.slug === slug);

  const category = article
    ? HELP_CATEGORIES.find((c) => c.id === article.categoryId)
    : null;

  const relatedArticles = article
    ? HELP_ARTICLES.filter((a) => article.relatedSlugs.includes(a.slug))
    : [];

  useEffect(() => {
    if (article) {
      telemetry.track("article_opened", {
        slug: article.slug,
        categoryId: article.categoryId,
      });
    }
  }, [article]);

  if (!article) {
    return (
      <AppShell>
        <PageShell>
          <div className="py-16 text-center space-y-4 max-w-md mx-auto">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <HelpCircle className="size-6" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-foreground">Article introuvable</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                L'article ou le guide que vous recherchez n'existe pas ou a été déplacé.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate("/help")}
              className="text-xs"
            >
              <ArrowLeft className="size-3.5 mr-1.5" />
              Retour au centre d'aide
            </Button>
          </div>
        </PageShell>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageShell>
        {/* Breadcrumb & Navigation */}
        <div className="space-y-4">
          <Breadcrumb>
            <BreadcrumbList className="text-xs">
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/help">Centre d'aide</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              {category && (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to={`/help?category=${category.id}`}>{category.title}</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </>
              )}
              <BreadcrumbItem>
                <BreadcrumbPage className="truncate max-w-[200px] sm:max-w-md">
                  {article.title}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate("/help")}
            className="text-xs text-muted-foreground hover:text-foreground -ml-2 h-8"
          >
            <ArrowLeft className="size-3.5 mr-1.5" />
            Retour aux questions
          </Button>
        </div>

        {/* Article Container */}
        <div className="max-w-3xl mx-auto space-y-8 pt-2">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {category && (
                <Badge variant="outline" className="text-xs">
                  {category.title}
                </Badge>
              )}
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Calendar className="size-3" />
                <span>Mis à jour le {formatBillingDate(article.lastUpdated)}</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
              {article.title}
            </h1>

            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              {article.excerpt}
            </p>
          </div>

          {/* Article Body Content */}
          <Card className="border border-border/80 shadow-xs bg-card overflow-hidden">
            <CardContent className="p-6 sm:p-8">
              <div className="prose dark:prose-invert max-w-none text-xs sm:text-sm text-foreground/90 space-y-4 leading-relaxed">
                {article.content.split("\n\n").map((paragraph, idx) => {
                  const trimmed = paragraph.trim();
                  if (trimmed.startsWith("### ")) {
                    return (
                      <h2 key={idx} className="text-lg sm:text-xl font-bold text-foreground pt-3 border-b border-border/60 pb-2">
                        {trimmed.replace("### ", "")}
                      </h2>
                    );
                  }
                  if (trimmed.startsWith("#### ")) {
                    return (
                      <h3 key={idx} className="text-sm sm:text-base font-semibold text-foreground pt-2">
                        {trimmed.replace("#### ", "")}
                      </h3>
                    );
                  }
                  if (trimmed.startsWith("- ")) {
                    const lines = trimmed.split("\n").map((l) => l.replace(/^- /, ""));
                    return (
                      <ul key={idx} className="list-disc pl-5 space-y-1.5 text-muted-foreground">
                        {lines.map((l, lIdx) => (
                          <li key={lIdx}>{l}</li>
                        ))}
                      </ul>
                    );
                  }
                  if (/^\d+\. /.test(trimmed)) {
                    const lines = trimmed.split("\n").map((l) => l.replace(/^\d+\. /, ""));
                    return (
                      <ol key={idx} className="list-decimal pl-5 space-y-1.5 text-muted-foreground">
                        {lines.map((l, lIdx) => (
                          <li key={lIdx}>{l}</li>
                        ))}
                      </ol>
                    );
                  }
                  return (
                    <p key={idx} className="text-muted-foreground leading-relaxed">
                      {trimmed}
                    </p>
                  );
                })}
              </div>

              {/* Tags */}
              {article.tags.length > 0 && (
                <div className="pt-6 mt-6 border-t border-border/60 flex flex-wrap items-center gap-1.5">
                  <Tag className="size-3.5 text-muted-foreground mr-1" />
                  {article.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px] font-normal">
                      #{t}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Related Articles */}
          {relatedArticles.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-bold text-foreground">Articles associés</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {relatedArticles.map((rel) => (
                  <Card
                    key={rel.slug}
                    className="border border-border/80 bg-card hover:border-primary/40 hover:shadow-xs transition-all p-4 flex flex-col justify-between gap-2"
                  >
                    <div>
                      <Link
                        to={`/help/${rel.slug}`}
                        className="text-xs sm:text-sm font-semibold text-foreground hover:text-primary transition-colors block"
                      >
                        {rel.title}
                      </Link>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">
                        {rel.excerpt}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="text-xs text-primary self-start -ml-2 h-7"
                    >
                      <Link to={`/help/${rel.slug}`}>
                        <span>Consulter</span>
                        <ArrowRight className="size-3 ml-1" />
                      </Link>
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Help CTA */}
          <Card className="border border-border/80 bg-muted/20 p-6 rounded-xl text-center space-y-3">
            <h3 className="text-sm font-bold text-foreground">
              Vous n'avez pas trouvé la réponse à votre question ?
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Notre équipe d'assistance est disponible pour examiner votre situation personnelle.
            </p>
            <div>
              <Button
                type="button"
                onClick={() => setIsContactDialogOpen(true)}
                size="sm"
                className="text-xs"
              >
                <MessageSquare className="size-3.5 mr-1.5" />
                Contacter le support
              </Button>
            </div>
          </Card>
        </div>

        {/* Contact Support Dialog */}
        <ContactSupportDialog
          open={isContactDialogOpen}
          onOpenChange={setIsContactDialogOpen}
          defaultCategory={article.categoryId}
          defaultSubject={`Question sur : ${article.title}`}
        />
      </PageShell>
    </AppShell>
  );
};
