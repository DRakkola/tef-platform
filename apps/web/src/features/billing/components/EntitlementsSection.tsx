import React from "react";
import { ShieldCheck, CheckCircle2, Zap } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface EntitlementsSectionProps {
  entitlements: Record<string, any>;
  creditsBalance?: number;
}

interface EntitlementItem {
  key: string;
  name: string;
  description: string;
  isUnlocked: boolean;
  creditRequired?: boolean;
}

export const EntitlementsSection: React.FC<EntitlementsSectionProps> = ({
  entitlements,
  creditsBalance = 0,
}) => {
  const items: EntitlementItem[] = [
    {
      key: "unlimited_mock_tests",
      name: "Simulations TEF officielles",
      description: "Sessions complètes d'examen blanc en conditions réelles avec chronomètre officiel.",
      isUnlocked: Boolean(entitlements.unlimited_mock_tests),
    },
    {
      key: "premium_exercises",
      name: "Entraînement ciblé & exercices",
      description: "Accès illimité au catalogue complet d'exercices avec corrections détaillées.",
      isUnlocked: Boolean(entitlements.premium_exercises),
    },
    {
      key: "progress_dashboard",
      name: "Diagnostic & progression NCLC",
      description: "Calcul continu des niveaux NCLC/CECR et analyse prédictive d'admissibilité.",
      isUnlocked: Boolean(entitlements.progress_dashboard ?? true),
    },
    {
      key: "ai_writing",
      name: "Correction IA d'expression écrite",
      description: "Analyse stylistique, syntaxique et suggestions de vocabulaire avancé.",
      isUnlocked: Boolean(entitlements.ai_writing),
      creditRequired: !entitlements.has_subscription,
    },
    {
      key: "ai_speaking",
      name: "Évaluation IA d'expression orale",
      description: "Score de prononciation, fluidité et détection d'erreurs phonétiques.",
      isUnlocked: Boolean(entitlements.ai_speaking),
      creditRequired: !entitlements.has_subscription,
    },
    {
      key: "speaking_practice",
      name: "Practice Pool 1-à-1",
      description: "Sessions d'entraînement oral anonymes et audio avec d'autres candidats TEF.",
      isUnlocked: Boolean(entitlements.speaking_practice),
    },
  ];

  return (
    <Card className="border border-border/80 shadow-xs bg-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">Accès inclus</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {creditsBalance > 0
                ? `Fonctionnalités débloquées par votre formule actuelle et vos ${creditsBalance} crédits actifs.`
                : "Fonctionnalités débloquées par votre formule actuelle et vos crédits actifs."}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((item) => (
            <div
              key={item.key}
              className={`p-3.5 rounded-lg border flex items-start justify-between gap-3 transition-colors ${
                item.isUnlocked
                  ? "bg-card border-border/80"
                  : "bg-muted/30 border-dashed border-border text-muted-foreground"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground">
                    {item.name}
                  </span>
                  {item.isUnlocked ? (
                    <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                      <CheckCircle2 className="size-3 mr-1" />
                      Disponible
                    </Badge>
                  ) : item.creditRequired ? (
                    <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10">
                      <Zap className="size-3 mr-1" />
                      Crédits requis
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">
                      Non inclus
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
