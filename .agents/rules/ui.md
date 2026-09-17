# UI Rules — TEF Platform

## Component Library

Always use **shadcn/ui** as the primary component library.

- Never create custom primitives that duplicate what shadcn already provides:
  `Button`, `Input`, `Select`, `Dialog`, `Sheet`, `Card`, `Badge`,
  `Tabs`, `DropdownMenu`, `Tooltip`, `Popover`, `ScrollArea`, `Separator`,
  `Avatar`, `Switch`, `Checkbox`, `RadioGroup`, `Slider`, `Progress`,
  `Skeleton`, `Alert`, `Table`, `Form`, `Label`, `Textarea`, `Command`.
- Extend shadcn components via `className` and `cva` variants — do not fork them.
- When a required component is not in shadcn, build it from Radix UI primitives
  following the same composition pattern shadcn uses.
- Import components from `@/components/ui/*`, never inline raw HTML equivalents.

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

- Over-designed custom components when shadcn already covers the use case.
- Trendy UI gimmicks (neumorphism, glassmorphism outside overlays, 3-D cards).
- Heavy gradients or neon/electric accent colors.
- Harsh visible borders where spacing can do the job.
- Dense, information-cluttered layouts.
- Non-standard navigation patterns that iOS users would find unfamiliar.
- Inline raw HTML (`<button>`, `<input>`, `<select>`) instead of shadcn
  equivalents.
- Arbitrary Tailwind magic numbers — use the design-token scale consistently.

---

## Decision Checklist

Before shipping any UI change, verify:

1. Every interactive element uses the appropriate shadcn component.
2. No custom primitive duplicates an existing shadcn component.
3. Color palette remains neutral; accent used at most once per surface.
4. Typography hierarchy uses size/weight, not color alone.
5. Touch targets are >= 44 px.
6. Spacing feels generous — nothing looks dense or cluttered.
7. Motion is calm and purposeful — no gratuitous animations.
8. Modals on mobile use Sheet (bottom-up), not centered Dialog.
9. Screen would feel at home in a first-party Apple app.
