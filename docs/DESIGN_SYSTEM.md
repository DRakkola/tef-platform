# TEF Platform — Design System & Visual Foundation

This document serves as the single source of truth for the TEF preparation platform visual language, design tokens, theming, and component standards.

---

## 1. Aesthetic Direction & Principles

The visual direction draws inspiration from modern, editorial, and calm digital products:
- **Calm & Spacious**: Generous whitespace around section groups, cards, and headers. Layouts breathe naturally rather than compressing into dense 8px dashboards.
- **Warm Canvas**: A warm off-white / cream background (`#fafaf7`) paired with crisp white card surfaces (`#ffffff`) creates soft, natural depth without heavy shadows.
- **Bold Editorial Typography**: High-contrast, near-black headings (`Geist Variable`) with confident weights and tight letter-spacing.
- **Intentional Accentuation**: Vibrant **chartreuse / lime** is the primary visual accent, reserved for high-priority CTAs, active indicators, and score highlights. Deep **teal** acts as a grounding secondary accent for data visualization and secondary tags.

---

## 2. Where to Change the Visual Identity

All core visual properties are centralized in **[`apps/web/src/index.css`](file:///C:/Users/MSI/Documents/tef-platform/apps/web/src/index.css)**. Changing the identity of the entire platform requires updating tokens in this single file.

### 2.1 Color Tokens

| Token | Light Value | Dark Value | Intended Usage |
| :--- | :--- | :--- | :--- |
| `--background` | `oklch(0.982 0.006 95)` | `oklch(0.13 0.01 90)` | Overall page canvas (warm cream in light, deep charcoal in dark) |
| `--surface` / `--card` | `oklch(1 0 0)` | `oklch(0.17 0.01 90)` | Clean white content cards and panels |
| `--foreground` | `oklch(0.14 0.01 90)` | `oklch(0.96 0.005 90)` | Primary editorial text (near-black / soft warm white) |
| `--muted-foreground` | `oklch(0.48 0.01 90)` | `oklch(0.68 0.01 90)` | Secondary supporting text and labels |
| `--primary` | `oklch(0.88 0.22 128)` | `oklch(0.88 0.22 128)` | Bright lime/chartreuse accent (solid buttons, active pills, highlights) |
| `--primary-foreground` | `oklch(0.14 0.01 90)` | `oklch(0.12 0.01 90)` | Near-black text on lime backgrounds (**never white on lime**) |
| `--primary-text` | `oklch(0.36 0.09 195)` | `oklch(0.88 0.22 128)` | High-contrast text accent (deep teal on light, vibrant lime on dark) |
| `--teal` | `oklch(0.38 0.09 195)` | `oklch(0.65 0.14 195)` | Deep editorial teal secondary accent |
| `--teal-foreground` | `oklch(0.985 0 0)` | `oklch(0.12 0.01 90)` | High-contrast text on teal backgrounds |
| `--border` | `oklch(0.92 0.004 85)` | `oklch(1 0 0 / 8%)` | Subtle low-contrast neutral card/section borders |
| `--border-subtle` | `oklch(0.95 0.003 85)` | `oklch(1 0 0 / 5%)` | Hairline dividers and inner borders |
| `--sidebar-background` | `oklch(0.15 0.01 90)` | `oklch(0.11 0.01 90)` | Dark charcoal application shell navigation chrome |

### 2.2 Typography Scale

Typography classes are defined in the `@layer utilities` block in `index.css`:

```html
<h1 className="text-display">Grande Titre Éditorial</h1>
<h1 className="text-h1">Titre de Page</h1>
<h2 className="text-h2">Sous-titre de Section</h2>
<h3 className="text-h3">Titre de Carte</h3>
<h4 className="text-h4">Titre d'Élément</h4>
<p className="text-body-large">Paragraphe d'introduction spacieux</p>
<p className="text-body">Texte courant haute lisibilité</p>
<span className="text-caption">Légende contextuelle</span>
<span className="text-overline">CATÉGORIE SURTITRE</span>
```

### 2.3 Radius System

- `--radius`: Base radius `0.875rem` (14px).
- `--radius-md`: `0.7rem` (inputs, small buttons).
- `--radius-xl`: `1.15rem` (buttons, dialogs).
- `--radius-2xl`: `1.5rem` (cards, major panels).
- `--radius-full`: `9999px` (status badges, pills, avatar containers).

---

## 3. Semantic Component Usage

### 3.1 Buttons (`Button`)

```tsx
import { Button } from "@/components/ui/button";

// 1. Primary CTA: Vibrant lime with near-black text
<Button variant="default">Commencer l'évaluation</Button>

// 2. Secondary: White/elevated surface with subtle border
<Button variant="secondary">Enregistrer le brouillon</Button>

// 3. Outline: Transparent with neutral border
<Button variant="outline">Voir l'historique</Button>

// 4. Teal: Deep editorial teal
<Button variant="teal">Consulter l'analyse NCLC</Button>

// 5. Link: Underline link with high-contrast primary text
<Button variant="link">Consulter le rapport</Button>

// 6. Ghost: Low-emphasis action
<Button variant="ghost">Passer</Button>

// 7. Destructive: Semantic red
<Button variant="destructive">Supprimer la tentative</Button>
```

### 3.2 Cards (`Card`)

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

// Standard Card: Crisp white, subtle border, rounded-2xl
<Card variant="default">
  <CardHeader>
    <CardTitle>Compréhension Écrite</CardTitle>
    <CardDescription>40 questions · 60 minutes</CardDescription>
  </CardHeader>
  <CardContent>...</CardContent>
</Card>

// Lime Accent Highlight Card (e.g. Score Hero block)
<Card variant="accent">
  <CardContent className="p-6">
    <span className="text-4xl font-extrabold font-mono">CLB 7</span>
    <p className="text-sm font-medium">Niveau cible atteint</p>
  </CardContent>
</Card>
```

### 3.3 Badges (`Badge`)

```tsx
import { Badge } from "@/components/ui/badge";

<Badge variant="default">Recommandé</Badge>            {/* Solid Lime fill + dark text */}
<Badge variant="accent">Étape 1 : Étalonnage</Badge>  {/* 15% Lime tint + deep teal text (light) / lime (dark) */}
<Badge variant="teal">TEF Canada</Badge>               {/* Deep Teal fill + white text */}
<Badge variant="secondary">B2 Intermédiaire</Badge>     {/* Neutral surface */}
<Badge variant="outline">Contour</Badge>               {/* Bordered */}
<Badge variant="success">Réussi</Badge>                {/* High-contrast Emerald */}
<Badge variant="warning">À consolider</Badge>          {/* High-contrast Amber */}
<Badge variant="destructive">Expiré</Badge>            {/* High-contrast Red */}
<Badge variant="info">Recommandation</Badge>           {/* High-contrast Blue */}
```

### 3.4 Standardized Icon Containers (`.icon-box`)

Use standardized `.icon-box` utilities to prevent washed-out icons in card headers and lists:

```tsx
// Accent icon box (15% lime background, high-contrast primary icon, subtle border)
<div className="icon-box icon-box-md icon-box-accent">
  <Sparkles className="size-5" />
</div>

// Deep Teal icon box
<div className="icon-box icon-box-md icon-box-teal">
  <Award className="size-5" />
</div>

// Neutral Muted icon box
<div className="icon-box icon-box-md icon-box-muted">
  <Clock className="size-5" />
</div>
```

---

## 4. Theming System (Light / Dark / System)

Theming is controlled via `ThemeProvider` (`@/providers/ThemeProvider`) and persisted in `localStorage` under `tef-theme`.

### 4.1 ThemeSwitcher Component

```tsx
import { ThemeSwitcher } from "@/components/common/ThemeSwitcher";

// In headers or navbars (dropdown / cycle button):
<ThemeSwitcher size="sm" variant="dropdown" />

// In Settings or design preferences (segmented control):
<ThemeSwitcher variant="segmented" />
```

---

## 5. Accessibility & Contrast Architecture

1. **Luminance Inversion & High-Contrast Text**:
   - Bright lime (`--primary`: `oklch(0.88 0.22 128)`) has ~85% luminance.
   - It is strictly forbidden for small text or icons on white/cream backgrounds (which only achieves an unreadable ~1.3:1 contrast ratio).
   - In light mode, `.text-primary` automatically maps to `--primary-text` (`oklch(0.36 0.09 195)` — Deep Editorial Teal), providing a stellar **10.2:1 contrast ratio** (exceeding WCAG AAA).
   - In dark mode, `.text-primary` maps back to `--primary` (Vibrant Lime), achieving **10.5:1 contrast** against dark charcoal cards.
2. **Solid Lime Fills**:
   - Solid lime fills (`bg-primary`) must **always** use `--primary-foreground` (`oklch(0.14 0.01 90)` / near-black text), achieving **13.2:1 contrast**. Never use white text on lime.
3. **Subtle Accent Badges**:
   - Use `<Badge variant="accent">` for badges on light surfaces: it applies `bg-primary/15` with `text-primary` (`var(--primary-text)`), providing clear visual branding without sacrificing readability.
4. **Focus Rings**:
   - All interactive controls must retain visible keyboard focus outlines (`focus-visible:ring-2 focus-visible:ring-ring`).
5. **Spacing Rule**:
   - Maintain minimum 24px-32px padding between major section groups on desktop (`space-y-8`).
