---
name: mantine-tranzit
description: Build, modify, or review React UI in tranzit with Mantine. Use for any task that introduces or changes visual components, forms, inputs, overlays, menus, tables, theming, styling, responsive layouts, or Mantine accessibility behavior in this project.
---

# Mantine for Tranzit

Use Mantine as Tranzit's component system and theme layer. Keep project rules in `AGENTS.md` authoritative; use Mantine's official LLM documentation to verify current component APIs and behavior.

**Mantine version**: 9.4.x — always verify APIs against the installed version, not older docs.

## Key Files

| Concern | File |
|---|---|
| Provider + theme | `packages/web/src/app/main.tsx` |
| Design tokens (CSS) | `packages/web/src/shared/styles/design-tokens.css` |
| Admin UI helpers | `packages/web/src/features/admin/components/admin-ui.ts` |
| Test render helper | `packages/web/src/test/render.tsx` |
| Design context | `.impeccable.md` |

## Workflow

1. Inspect the related feature and the existing UI before changing it. Check the key files above for shared visual behavior.
2. Select an existing Mantine component before creating custom UI. Reuse the local `shared` primitives only when they already fit the cross-cutting use case.
3. When Mantine API details, Styles API selectors, accessibility behavior, or composition are relevant, open `https://mantine.dev/llms.txt` and follow only the linked page for the component or concern. Do not copy `llms-full.txt` into the repository.
4. Keep shared tokens in `design-tokens.css`; keep one-off layout and visual adjustments local to the feature.
5. Verify keyboard access, labels and accessible names, focus behavior for overlays, and mobile/desktop layouts. Run the narrowest relevant check after changing code.

## Theming

### Provider

- Keep the sole `MantineProvider` in `packages/web/src/app/main.tsx`. It must be rendered only once, at the root.
- `forceColorScheme="light"` is set — preserve this unless the task explicitly adds dark mode support.
- The theme is defined inline with `createTheme({ ... })`. Extend it there for global changes.

### Theme object

Use `createTheme` properties to integrate with Mantine's system rather than only using external CSS:

- **`theme.colors`**: Define custom color scales (10 shades each) to get `--mantine-color-{name}-{0-9}` CSS variables. Consider mapping the brand OKLCH palette into a Mantine color scale so components can use `color="brand"` natively.
- **`theme.spacing`**: Map to the project's 4pt scale so `p="md"`, `m="xl"` etc. align with `design-tokens.css`.
- **`theme.radius`** and **`theme.defaultRadius`**: Map to `--radius-*` tokens.
- **`theme.shadows`**: Map to `--shadow-*` tokens.
- **`theme.fontFamily`** and **`theme.headings.fontFamily`**: Already set to Geist; keep in sync with `.impeccable.md`.

### Component defaults

Use `Component.extend()` in `theme.components` for global defaults — this is the canonical Mantine way:

```tsx
const theme = createTheme({
  components: {
    Button: Button.extend({
      defaultProps: { variant: 'filled', radius: 'md' },
      classNames: { root: 'my-root-class' },
      vars: (theme, props) => ({ root: { '--button-height': '40px' } }),
    }),
  },
});
```

- **`defaultProps`**: Set default `variant`, `size`, `radius`, `color` for all instances of a component.
- **`classNames`**: Apply CSS module classes globally to component inner elements via Styles API selectors.
- **`vars`**: Override component-level CSS variables (e.g. `--button-height`, `--input-height`) based on props.
- For compound components (Menu.Item, Tabs.List), use the name without the dot: `MenuItem`, `TabsList`.

### CSS variables resolver

Use `cssVariablesResolver` on `MantineProvider` to add custom CSS variables that integrate with Mantine's runtime variable system:

```tsx
const resolver: CSSVariablesResolver = (theme) => ({
  variables: { '--tranzit-brand-hue': '25' },
  light: { '--tranzit-accent': theme.other?.accentLight },
  dark: { '--tranzit-accent': theme.other?.accentDark },
});
```

This is preferable to only using `:root` in `design-tokens.css` when the variables need to respond to color scheme or reference theme values.

## Styling: Priority Order

Follow this priority when styling Mantine components (from most preferred to least):

### 1. Component props (preferred)

Use component-specific props (`color`, `variant`, `size`, `radius`) — they control multiple CSS properties optimally:

```tsx
<Button variant="filled" color="red" size="md" radius="md" />
```

### 2. CSS modules (most performant)

CSS modules are the **recommended** way to apply custom styles. They generate static CSS, never re-evaluated, and are the most performant:

```css
/* Feature.module.css */
.root {
  padding: var(--mantine-spacing-xl);
  background: var(--mantine-color-red-1);

  &[data-active] {
    background: var(--mantine-color-red-filled);
  }

  @media (max-width: $mantine-breakpoint-sm) {
    padding: var(--mantine-spacing-md);
  }
}
```

```tsx
import classes from './Feature.module.css';
<Button classNames={{ root: classes.root }} />
```

- Use `classNames` with CSS modules to target inner elements via Styles API selectors.
- Reference Mantine CSS variables (`var(--mantine-color-*)`, `var(--mantine-spacing-*)`, `var(--mantine-radius-*)`) in CSS.
- Use `data-*` attributes for state-based styling instead of conditional inline styles.
- Use `@mixin hover` for hover states in CSS modules (handles touch devices).

### 3. Style props (limited use)

Style props (`p`, `m`, `mt`, `bg`, `c`, `fz`, etc.) are convenient but generate inline styles. Rules:

- **Limit to 3-4 style props per component.** If you need more, create a CSS module.
- Use them for quick one-off adjustments (margin between form fields, text color, font size).
- **Avoid responsive style props** (`mt={{ base: 10, md: 20 }}`) in lists or repeated components — each instance injects a `<style>` tag. Use `classNames` with CSS modules + media queries instead.

### 4. `styles` prop (avoid as primary)

The `styles` prop applies inline styles to inner elements. It has higher specificity than classes and cannot use pseudo-classes or media queries. Prefer `classNames` with CSS modules over `styles`.

### 5. `style` prop (single property only)

Use `style` for a single CSS property or setting a CSS variable on a component. Not as a primary styling method.

## What Not to Do

- **Never style against Mantine private CSS variables** (`--_*` prefix). Use public Mantine variables (`--mantine-*`) or project-owned variables (`--tranzit-*`, semantic tokens from `design-tokens.css`).
- **Do not introduce shadcn**, `components.json`, new `components/ui` primitives, or a parallel design system. Use Lucide for icons.
- **Do not add another `MantineProvider`** or alter the established import order (`@mantine/core/styles.css` must come before other stylesheets).
- **Do not use `styles` prop as primary styling** — use `classNames` with CSS modules.
- **Do not use more than 4 style props** on a single component — refactor to a CSS module.
- **Do not use responsive style props in lists** — use CSS modules with media queries.
- **Do not mix `theme.components` defaults with ad-hoc Tailwind overrides** for the same component — pick one approach per component type.

## Tailwind Coexistence

The project uses Tailwind alongside Mantine. Follow these rules for coexistence:

- Use Tailwind utility classes via `className` for **layout** (flex, grid, spacing, responsive containers) and **one-off visual adjustments** local to a feature.
- Use Mantine component props and CSS modules for **component customization** (variants, colors, inner element styling).
- Keep Mantine base styles imported before Tailwind. Do not reverse the order to fix local specificity issues.
- When a Tailwind class conflicts with Mantine's component styles, prefer Mantine's `classNames`/Styles API over `!important` Tailwind utilities.

## Accessibility

- Verify keyboard access for all interactive components (Tab, Enter, Escape, arrow keys for menus/comboboxes).
- Check that overlays (Modal, Drawer, Popover, Tooltip) manage focus correctly: trap focus inside, restore focus on close.
- Ensure all form inputs have associated labels (`label` prop or `aria-label`).
- Test with `prefers-reduced-motion` — Mantine respects this by default, but custom animations must too.
- Use Mantine's built-in ARIA roles and attributes; do not override them without reason.

## Performance

- Prefer CSS modules over inline styles for repeated components (lists, tables, cards).
- Consider `deduplicateInlineStyles` prop on `MantineProvider` (React 19 feature) to reduce `<style>` tag count when using style props extensively.
- Avoid creating new theme objects or `createTheme` calls inside components — define the theme once at module level.
- Use `staticClasses` (`.mantine-Button-root`) for global styling without `classNames` prop overhead.

## Project Constraints

- Preserve the light-only color scheme (`forceColorScheme="light"`) unless the task explicitly expands product support for color schemes.
- Treat authentication views as full-screen surfaces, outside the default app shell.
- Respect TanStack Router boundaries: do not pull browser-only APIs into a route component or shared utility merely for a Mantine interaction.
- If official Mantine guidance conflicts with `AGENTS.md` or existing Tranzit patterns, follow the project rule and adapt with supported Mantine APIs.
