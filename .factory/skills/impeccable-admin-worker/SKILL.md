---
name: impeccable-admin-worker
description: Redesign admin UI with impeccable design quality
---

# Impeccable Admin Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

This worker is used for features in the Admin UI Redesign mission. It applies impeccable design principles to admin pages while preserving all existing functionality.

## Required Skills

- **impeccable**: Use this skill to invoke the design system guide for frontend work. The `impeccable` skill provides the design reference for typography, color, spacing, and banned patterns.

## Work Procedure

### Before Starting

1. Read `.impeccable.md` from project root for design context
2. Read current admin page being redesigned to understand existing structure
3. Read `packages/web/src/routes/admin/_shared/-admin-ui.ts` to understand current design tokens
4. Read the feature description in `features.json` for specific requirements

### Implementation Steps

1. **Plan the redesign approach** based on the feature requirements
   - Identify which components need full rewrite vs. refinement
   - Plan consistent spacing, typography, and color usage
   - Ensure no "AI slop" patterns (gradient text, side-stripes, glassmorphism)

2. **Apply impeccable design principles**:
   - Use Sora for headings, Geist/Public Sans for body
   - Maintain 4pt spacing grid
   - Use red (#c92a2a) as accent, not dominant
   - Create clear visual hierarchy with contrasting sizes
   - Ensure interactive states (hover, active, focus) are visible

3. **Preserve existing functionality**:
   - All API calls must remain intact
   - Form validation must work the same way
   - Modals and actions must function identically
   - Only UI/styling changes, not behavioral changes

4. **Test manually** after implementation:
   - Navigate to the page
   - Interact with all controls
   - Verify no console errors
   - Take screenshots for handoff

### Design Direction for Admin

**Professional, Dense, Data-Rich (Notion/Linear inspired)**
- Light mode only
- Compact sidebar (200-220px) with icons + labels
- White surfaces with subtle shadows
- 8px border-radius
- Red accent for primary actions only

### Common Patterns to Avoid

- NO gradient text on headings or body
- NO border-left or border-right > 1px as colored accent stripe
- NO glassmorphism (blur backgrounds, translucent cards)
- NO bounce or elastic animations
- NO generic card grids with identical sizing
- NO centered everything - use asymmetric layouts

### File Structure

For each admin page, typically involves:
- Main page component: `packages/web/src/routes/admin/{section}/-Admin{section}Page.tsx`
- Supporting components: `packages/web/src/routes/admin/{section}/-*.tsx`
- Shared components: `packages/web/src/routes/admin/_shared/-*.tsx`
- Shared styles: `packages/web/src/routes/admin/_shared/-admin-ui.ts`

## Example Handoff

```json
{
  "salientSummary": "Rediseñé login page admin con layout de dos paneles. Panel izquierdo oscuro con branding SIMUT, panel derecho con formulario funcional. Validación inline funciona. Onboarding flow visible para nuevos usuarios.",
  "whatWasImplemented": "Login page con diseño profesional denso. Dos paneles: izquierda con branding oscuro (#1a1a2e), derecha con form email/password. Validación correcta. Onboarding visible para no-admins.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      {"command": "cd /Users/verzach3/Projects/tranzit && bun run dev", "exitCode": 0, "observation": "Dev server running"}
    ],
    "interactiveChecks": [
      {"action": "Navigate to /admin/login", "observed": "Two-panel layout visible with dark left side and form on right"},
      {"action": "Submit empty form", "observed": "Validation errors shown inline for email and password"},
      {"action": "Submit with valid credentials", "observed": "Redirect to /admin dashboard"}
    ]
  },
  "tests": {
    "added": []
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- If design direction is unclear and Impeccable context doesn't provide enough guidance
- If preserving functionality requires significant architectural changes not covered in the feature
- If you encounter missing API endpoints that are needed for the redesign
