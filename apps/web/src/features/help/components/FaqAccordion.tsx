import React from "react";
import { Link } from "react-router-dom";
import { HelpCircle, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import type { FaqItem } from "../types";

interface FaqAccordionProps {
  faqs: FaqItem[];
  onOpenFaq?: (faqId: string) => void;
}

export const FaqAccordion: React.FC<FaqAccordionProps> = ({
  faqs,
  onOpenFaq,
}) => {
  return (
    <Card className="border border-border/80 shadow-xs bg-card overflow-hidden">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
            <HelpCircle className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base sm:text-lg font-bold text-foreground">
              Questions fréquentes
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Réponses directes et vérifiées aux interrogations les plus courantes.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        {faqs.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Aucune question fréquente ne correspond à ce filtre.
          </div>
        ) : (
          <Accordion
            type="single"
            collapsible
            className="w-full"
            onValueChange={(val) => {
              if (val && onOpenFaq) {
                onOpenFaq(val);
              }
            }}
          >
            {faqs.map((faq) => (
              <AccordionItem key={faq.id} value={faq.id}>
                <AccordionTrigger className="text-sm font-semibold text-foreground hover:text-primary">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </p>
                  {faq.articleSlug && (
                    <div className="mt-3">
                      <Link
                        to={`/help/${faq.articleSlug}`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                      >
                        <span>Consulter le guide complet</span>
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
};
