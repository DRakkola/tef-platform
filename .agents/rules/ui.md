# UI Rules — TEF Platform

## Component Library

Always use **shadcn/ui** as the primary component library.

- Never create custom primitives that duplicate what shadcn already provides.
- Extend shadcn components via `className` and `cva` variants — do not fork them.
- When a required component is not in shadcn, build it from Radix UI primitives
  following the same composition pattern shadcn uses.
- Import components from `@/components/ui/*`, never inline raw HTML equivalents.

---

## shadcn Sub-Primitives — Mandatory Usage

**Every shadcn component that exposes sub-primitives must be composed using
those sub-primitives.** Never recreate their structure with raw `<div>`,
`<h*>`, `<p>`, `<span>`, `<hr>`, `<button>`, or `<ul>/<li>` elements.
Customize appearance via `className`, not by replacing the primitive.

### Installed components and their required sub-primitives

| Component | Sub-primitives (use ALL that apply) |
|---|---|
| **Alert** | `Alert`, `AlertTitle`, `AlertDescription` |
| **Avatar** | `Avatar`, `AvatarImage`, `AvatarFallback`, `AvatarGroup`, `AvatarGroupCount`, `AvatarBadge` |
| **Badge** | `Badge` (with `badgeVariants`) |
| **Breadcrumb** | `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink`, `BreadcrumbPage`, `BreadcrumbSeparator`, `BreadcrumbEllipsis` |
| **Button** | `Button` (with `buttonVariants`) |
| **Card** | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` |
| **Collapsible** | `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` |
| **Dialog** | `Dialog`, `DialogTrigger`, `DialogPortal`, `DialogOverlay`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`, `DialogClose` |
| **DropdownMenu** | `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuGroup`, `DropdownMenuLabel`, `DropdownMenuItem`, `DropdownMenuCheckboxItem`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`, `DropdownMenuSeparator`, `DropdownMenuShortcut`, `DropdownMenuSub`, `DropdownMenuSubTrigger`, `DropdownMenuSubContent` |
| **Input** | `Input` — never use raw `<input>` |
| **Progress** | `Progress` — never use raw `<progress>` |
| **Separator** | `Separator` — never use raw `<hr>` |
| **Sheet** | `Sheet`, `SheetTrigger`, `SheetClose`, `SheetContent`, `SheetHeader`, `SheetFooter`, `SheetTitle`, `SheetDescription` |
| **Sidebar** | `SidebarProvider`, `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarFooter`, `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupAction`, `SidebarGroupContent`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarMenuAction`, `SidebarMenuBadge`, `SidebarMenuSkeleton`, `SidebarMenuSub`, `SidebarMenuSubItem`, `SidebarMenuSubButton`, `SidebarInput`, `SidebarInset`, `SidebarRail`, `SidebarSeparator`, `SidebarTrigger` |
| **Skeleton** | `Skeleton` — never use a styled empty `<div>` as a loading placeholder |
| **Tabs** | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` |
| **Textarea** | `Textarea` — never use raw `<textarea>` |
| **Tooltip** | `TooltipProvider`, `Tooltip`, `TooltipTrigger`, `TooltipContent` |

### Composition rules

1. **Use every applicable sub-primitive.** For example, a Card with a title
   and body must use `Card` > `CardHeader` > `CardTitle` + `CardContent`,
   never `Card` > `<div>` > `<h3>` + `<div>`.
2. **Do not wrap content directly in the root component** when sub-primitives
   exist. Slot content into the correct child (`*Header` for titles,
   `*Content` for body, `*Footer` for actions, `*Title`/`*Description` for
   semantic text).
3. **Semantic mapping**: if there is a shadcn sub-primitive whose name matches
   the semantic role (title, description, header, footer, trigger, close,
   separator, label, item), use it — even if the raw HTML "works fine."
4. **Styling**: customize via `className` on the sub-primitive. Do not replace
   a sub-primitive with a raw element + custom classes.

### HTML → shadcn mapping (never use the left column)

| ❌ Raw HTML | ✅ Use instead |
|---|---|
| `<button>` | `Button` |
| `<input>` | `Input` |
| `<textarea>` | `Textarea` |
| `<hr>` | `Separator` |
| `<progress>` | `Progress` |
| `<img>` inside an avatar | `AvatarImage` + `AvatarFallback` |
| `<div>` as card header | `CardHeader` |
| `<h2>`/`<h3>` as card title | `CardTitle` |
| `<p>` as card description | `CardDescription` |
| `<div>` as card body | `CardContent` |
| `<div>` as card footer | `CardFooter` |
| `<div>` as dialog header/footer | `DialogHeader` / `DialogFooter` |
| `<h2>` as dialog title | `DialogTitle` |
| `<p>` as dialog description | `DialogDescription` |
| `<div>` as sheet header/footer | `SheetHeader` / `SheetFooter` |
| `<h2>` as sheet title | `SheetTitle` |
| `<p>` as sheet description | `SheetDescription` |
| `<div>` as tab panel | `TabsContent` |
| `<button>` as tab trigger | `TabsTrigger` |
| `<div>` as tooltip text | `TooltipContent` |
| `<span>` as badge | `Badge` |
| `<div className="animate-pulse ...">` | `Skeleton` |
| `<nav>` breadcrumb list | `BreadcrumbList` |
| `<li>` breadcrumb item | `BreadcrumbItem` |
| `<a>` breadcrumb link | `BreadcrumbLink` |
| Custom menu item `<div>` | `DropdownMenuItem` |
| Custom menu label `<span>` | `DropdownMenuLabel` |
| Custom menu separator `<hr>` | `DropdownMenuSeparator` |

---

## Design Language — Apple-Style (iOS-Forward)

Apply the **apple-ui-designer** skill for all UI work.
Every screen must feel like it belongs in a first-party Apple app —
calm, confident, native, and inevitable.

### Philosophy
- Native over custom.
- Subtle over expressive.
- Calm, confident, and human.
- "Feels obvious" rather than "looks fancy".
- When in doubt, remove rather than add.

### Color & Surfaces
- Use **neutral, system-like palettes**: white/off-white backgrounds, system
  grays, with accent colors used sparingly and purposefully.
- No harsh borders — rely on whitespace and subtle grouping (translucency or
  a very light shadow) to separate surfaces.
- No heavy gradients or neon colors.
- Glassmorphism (backdrop-blur + semi-transparent surface) is acceptable
  only for overlays and sheets, not for body content.

### Typography
- Use a **system-first font stack**: `Inter`, `SF Pro` fallback, then
  `system-ui, -apple-system, sans-serif`.
- Establish hierarchy through **size and weight**, not color.
- No decorative or novelty typefaces.

### Spacing & Layout
- Generous whitespace — avoid dense, cluttered layouts.
- Comfortable touch targets (min 44 × 44 px / `min-h-11`).
- Vertical scroll is the primary navigation axis.
- Cards must feel light and system-like: no thick borders, use `rounded-xl`
  or `rounded-2xl`, minimal shadow.

### Components
- **Buttons**: clear primary vs. secondary hierarchy; no over-styled gradients.
- **Lists**: iOS-style rhythm — clear separators OR spacing, never both.
- **Navigation**: standard nav bars; large titles (`text-2xl font-semibold`)
  where appropriate.
- **Modals/Dialogs**: prefer `Sheet` (bottom-sheet pattern) over centered
  `Dialog` on mobile viewports.
- **Alerts/Toasts**: calm, non-intrusive; use shadcn `Alert` / `sonner`.

### Motion & Interaction
- Smooth, natural easing (`ease-out`, `ease-in-out`) — no aggressive bounce.
- Use fade, slide, and subtle scale transitions.
- Motion must explain hierarchy, not decorate.
- All transitions should feel calm and intentional.

---

## Absolute Avoid List

- Raw HTML elements (`<button>`, `<input>`, `<textarea>`, `<select>`, `<hr>`,
  `<progress>`) when a shadcn primitive exists.
- Raw `<div>`, `<h*>`, `<p>`, `<span>` to recreate a shadcn sub-primitive
  (header, footer, title, description, content, trigger, separator, label, item).
- Over-designed custom components when shadcn already covers the use case.
- Trendy UI gimmicks (neumorphism, glassmorphism outside overlays, 3-D cards).
- Heavy gradients or neon/electric accent colors.
- Harsh visible borders where spacing can do the job.
- Dense, information-cluttered layouts.
- Non-standard navigation patterns that iOS users would find unfamiliar.
- Arbitrary Tailwind magic numbers — use the design-token scale consistently.

---

## Decision Checklist

Before shipping any UI change, verify:

1. Every interactive element uses the appropriate shadcn component.
2. No custom primitive duplicates an existing shadcn component.
3. Every shadcn component is composed using **all applicable sub-primitives**
   — zero raw HTML stand-ins for headers, titles, descriptions, footers,
   triggers, content areas, separators, or labels.
4. The HTML → shadcn mapping table has no violations.
5. Color palette remains neutral; accent used at most once per surface.
6. Typography hierarchy uses size/weight, not color alone.
7. Touch targets are >= 44 px.
8. Spacing feels generous — nothing looks dense or cluttered.
9. Motion is calm and purposeful — no gratuitous animations.
10. Modals on mobile use Sheet (bottom-up), not centered Dialog.
11. Screen would feel at home in a first-party Apple app.
