/**
 * DesignSystemPage: Internal design system & token showcase for developers and QA.
 * Demonstrates the live tokens, color swatches, typography scale, and core UI primitives.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ThemeSwitcher } from "@/components/common/ThemeSwitcher";
import { PageHeader } from "@/components/common/PageHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";

export const DesignSystemPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background text-foreground py-8">
      <PageShell maxWidth="wide">
        <PageHeader
          title="Système de Design & Fondations Visuelles"
          description="Référence visuelle et documentation vivante des jetons de design, de la typographie éditoriale, des palettes de couleurs et des primitives UI."
          backHref="/dashboard"
          backLabel="Tableau de bord"
          actions={<ThemeSwitcher variant="segmented" />}
        />

        {/* 1. Color Palette Tokens */}
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-h2 font-bold tracking-tight text-foreground">
              Palette de Couleurs & Surfaces
            </h2>
            <p className="text-body-small text-muted-foreground">
              Fond crème chaud, surfaces blanches pures, typographie anthracite profond, accent vert lime dynamique et sarcelle profond.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <ColorSwatch
              name="Background"
              token="--background"
              bgClass="bg-background border border-border"
              textClass="text-foreground"
              desc="Canvas crème chaud"
            />
            <ColorSwatch
              name="Surface / Card"
              token="--surface"
              bgClass="bg-card border border-border/80 shadow-2xs"
              textClass="text-card-foreground"
              desc="Panneaux blancs purs"
            />
            <ColorSwatch
              name="Primary Accent"
              token="--primary"
              bgClass="bg-primary"
              textClass="text-primary-foreground font-bold"
              desc="Vert Lime / Chartreuse"
            />
            <ColorSwatch
              name="Secondary Accent"
              token="--teal"
              bgClass="bg-teal"
              textClass="text-teal-foreground font-semibold"
              desc="Sarcelle Profond (Teal)"
            />
            <ColorSwatch
              name="Foreground"
              token="--foreground"
              bgClass="bg-foreground"
              textClass="text-background"
              desc="Texte anthracite sombre"
            />
            <ColorSwatch
              name="Muted"
              token="--muted"
              bgClass="bg-muted border border-border"
              textClass="text-muted-foreground"
              desc="Surfaces secondaires"
            />
          </div>
        </section>

        {/* 2. Typography Scale */}
        <section className="space-y-4 pt-6 border-t border-border/60">
          <div className="space-y-1">
            <h2 className="text-h2 font-bold tracking-tight text-foreground">
              Échelle Typographique Éditoriale
            </h2>
            <p className="text-body-small text-muted-foreground">
              Typographie moderne et structurée basée sur Geist Variable avec des hiérarchies claires.
            </p>
          </div>

          <Card className="divide-y divide-border/60">
            <div className="p-5 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
              <span className="text-xs font-mono text-muted-foreground w-36 shrink-0">.text-display</span>
              <span className="text-display text-foreground">Préparation TEF Canada</span>
            </div>
            <div className="p-5 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
              <span className="text-xs font-mono text-muted-foreground w-36 shrink-0">.text-h1</span>
              <span className="text-h1 text-foreground">Expression Écrite — Section B</span>
            </div>
            <div className="p-5 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
              <span className="text-xs font-mono text-muted-foreground w-36 shrink-0">.text-h2</span>
              <span className="text-h2 text-foreground">Simulations Officielles & Entraînement</span>
            </div>
            <div className="p-5 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
              <span className="text-xs font-mono text-muted-foreground w-36 shrink-0">.text-h3</span>
              <span className="text-h3 text-foreground">Diagnostic d'Admissibilité NCLC</span>
            </div>
            <div className="p-5 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
              <span className="text-xs font-mono text-muted-foreground w-36 shrink-0">.text-body-large</span>
              <span className="text-body-large text-foreground max-w-xl">
                Un accompagnement structuré pour maîtriser chaque compétence du test avec rigueur et clarté.
              </span>
            </div>
            <div className="p-5 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
              <span className="text-xs font-mono text-muted-foreground w-36 shrink-0">.text-body</span>
              <span className="text-body text-foreground max-w-xl">
                Chaque épreuve est notée selon les grilles officielles du TEF Canada et du CLB.
              </span>
            </div>
            <div className="p-5 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
              <span className="text-xs font-mono text-muted-foreground w-36 shrink-0">.text-overline</span>
              <span className="text-overline">COMPÉTENCE PRIORITAIRE · CLB 7 REQUIS</span>
            </div>
          </Card>
        </section>

        {/* 3. Buttons Showcase */}
        <section className="space-y-4 pt-6 border-t border-border/60">
          <div className="space-y-1">
            <h2 className="text-h2 font-bold tracking-tight text-foreground">
              Boutons & Actions
            </h2>
            <p className="text-body-small text-muted-foreground">
              Le bouton primaire utilise l'accent vert lime vif avec texte sombre contrasté.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="default" size="lg">
              <Sparkles className="size-4 mr-2" />
              Bouton Primaire (Lime)
            </Button>
            <Button variant="teal" size="lg">
              Bouton Sarcelle (Teal)
            </Button>
            <Button variant="secondary" size="lg">
              Bouton Secondaire
            </Button>
            <Button variant="outline" size="lg">
              Bouton Contour
            </Button>
            <Button variant="ghost" size="lg">
              Bouton Fantôme
            </Button>
            <Button variant="destructive" size="lg">
              Action Destructive
            </Button>
          </div>
        </section>

        {/* 4. Cards Showcase */}
        <section className="space-y-4 pt-6 border-t border-border/60">
          <div className="space-y-1">
            <h2 className="text-h2 font-bold tracking-tight text-foreground">
              Cartes & Surfaces (Card Variants)
            </h2>
            <p className="text-body-small text-muted-foreground">
              Coins arrondis 2xl, bordures subtiles et ombres minimales.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card variant="default">
              <CardHeader>
                <Badge variant="secondary" className="w-fit mb-1">Standard</Badge>
                <CardTitle>Carte Contenu Blanche</CardTitle>
                <CardDescription>Surface épurée avec bordure douce et ombre 2xs.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-body-small text-muted-foreground">
                  Parfaite pour les exercices, listes de questions et modules généraux.
                </p>
              </CardContent>
            </Card>

            <Card variant="accent">
              <CardHeader>
                <Badge variant="outline" className="w-fit mb-1 border-primary-foreground/30 text-primary-foreground">
                  Highlight
                </Badge>
                <CardTitle className="text-primary-foreground text-xl">4.8 / 5.0</CardTitle>
                <CardDescription className="text-primary-foreground/80">
                  Niveau moyen validé sur 42 épreuves
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-body-small text-primary-foreground/90 font-medium">
                  Bloc d'accentuation haute visibilité pour scores et réussites.
                </p>
              </CardContent>
            </Card>

            <Card variant="teal">
              <CardHeader>
                <Badge variant="outline" className="w-fit mb-1 border-white/30 text-white">
                  Objectif NCLC
                </Badge>
                <CardTitle className="text-white text-xl">Niveau Cible B2</CardTitle>
                <CardDescription className="text-white/80">
                  Éligibilité Express Entry Canada
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-body-small text-white/90">
                  Deuxième niveau d'accentuation pour les métriques de progression.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* 5. Badges & Indicators */}
        <section className="space-y-4 pt-6 border-t border-border/60">
          <div className="space-y-1">
            <h2 className="text-h2 font-bold tracking-tight text-foreground">
              Badges & Indicateurs de Statut
            </h2>
            <p className="text-body-small text-muted-foreground">
              Badges en pilule à haut contraste conformes aux normes WCAG AAA sur surfaces claires et sombres.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Badge variant="default">Lime Primaire</Badge>
            <Badge variant="accent">Accent Subtil (Teal/Lime)</Badge>
            <Badge variant="teal">Sarcelle TEF</Badge>
            <Badge variant="secondary">Neutre B2</Badge>
            <Badge variant="outline">Contour</Badge>
            <Badge variant="success">
              <CheckCircle2 className="size-3 mr-1" />
              Réussi (CLB 7)
            </Badge>
            <Badge variant="warning">
              <AlertTriangle className="size-3 mr-1" />
              À consolider
            </Badge>
            <Badge variant="destructive">Session expirée</Badge>
            <Badge variant="info">Recommandation IA</Badge>
          </div>
        </section>

        {/* 6. Icon Boxes Showcase */}
        <section className="space-y-4 pt-6 border-t border-border/60">
          <div className="space-y-1">
            <h2 className="text-h2 font-bold tracking-tight text-foreground">
              Boîtes d'Icônes Standardisées (.icon-box)
            </h2>
            <p className="text-body-small text-muted-foreground">
              Conteneurs d'icônes cohérents garantissant un contraste WCAG AAA sur toutes les surfaces.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="icon-box icon-box-sm icon-box-accent">
                <Sparkles className="size-4" />
              </div>
              <span className="text-xs font-mono text-muted-foreground">.icon-box-accent (sm)</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="icon-box icon-box-md icon-box-accent">
                <Sparkles className="size-5" />
              </div>
              <span className="text-xs font-mono text-muted-foreground">.icon-box-accent (md)</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="icon-box icon-box-md icon-box-teal">
                <Sparkles className="size-5" />
              </div>
              <span className="text-xs font-mono text-muted-foreground">.icon-box-teal (md)</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="icon-box icon-box-md icon-box-muted">
                <Sparkles className="size-5" />
              </div>
              <span className="text-xs font-mono text-muted-foreground">.icon-box-muted (md)</span>
            </div>
          </div>
        </section>

        {/* 6. Form Controls */}
        <section className="space-y-4 pt-6 border-t border-border/60">
          <div className="space-y-1">
            <h2 className="text-h2 font-bold tracking-tight text-foreground">
              Formulaires & Champs de Saisie
            </h2>
            <p className="text-body-small text-muted-foreground">
              Champs de saisie spacieux sur fond blanc avec anneau de focus net.
            </p>
          </div>

          <div className="max-w-md space-y-3">
            <Input placeholder="Rechercher une simulation ou un exercice..." />
            <Input type="email" defaultValue="candidat@tef-prep.ca" />
          </div>
        </section>
      </PageShell>
    </div>
  );
};

const ColorSwatch: React.FC<{
  name: string;
  token: string;
  bgClass: string;
  textClass: string;
  desc: string;
}> = ({ name, token, bgClass, textClass, desc }) => {
  return (
    <div className="flex flex-col rounded-xl overflow-hidden border border-border/70 bg-card p-2.5 space-y-2">
      <div className={`h-16 rounded-lg flex items-center justify-center p-2 text-center ${bgClass}`}>
        <span className={`text-xs ${textClass}`}>{name}</span>
      </div>
      <div className="space-y-0.5">
        <span className="text-[11px] font-mono text-foreground font-semibold block truncate">
          {token}
        </span>
        <span className="text-[10px] text-muted-foreground block truncate">
          {desc}
        </span>
      </div>
    </div>
  );
};
