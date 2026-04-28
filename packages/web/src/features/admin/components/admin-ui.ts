/**
 * SIMUT admin shell: nuevo sistema de diseño con OKLCH.
 * Fuentes: Sora (display), Public Sans (body).
 * Brand accent: rojo con OKLCH.
 */

// Brand hue for OKLCH calculations
export const BRAND_HUE = 25;

// Design tokens usando CSS variables
export const adminTokens = {
	// Brand colors (OKLCH)
	brand100: "oklch(95% 0.02 var(--brand-hue))",
	brand200: "oklch(90% 0.04 var(--brand-hue))",
	brand300: "oklch(85% 0.08 var(--brand-hue))",
	brand400: "oklch(75% 0.12 var(--brand-hue))",
	brand500: "oklch(60% 0.15 var(--brand-hue))",
	brand600: "oklch(50% 0.18 var(--brand-hue))",
	brand700: "oklch(42% 0.16 var(--brand-hue))",

	// Semantic colors
	accent: "var(--brand-600)",
	bgPrimary: "var(--neutral-50)",
	bgSecondary: "var(--neutral-100)",
	bgElevated: "white",
	textPrimary: "var(--neutral-950)",
	textSecondary: "var(--neutral-600)",
	borderSubtle: "var(--neutral-200)",
	borderDefault: "var(--neutral-300)",
} as const;

// Legacy hex for compatibility during transition
export const ADMIN_ACCENT = "#c92a2a";

// UI classes using new design system
export const adminUi = {
	// Layout
	pageBg: "min-h-[100dvh] bg-[var(--bg-primary)] antialiased",
	contentMax: "mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8",

	// Surfaces (using design tokens)
	surface:
		"rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)]",
	surfaceElevated:
		"rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)]",
	surfaceGlass:
		"rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.1)]",
	surfaceInset:
		"rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]",
	surfaceMuted:
		"rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-primary)]",
	surfaceDark:
		"rounded-2xl border border-[var(--neutral-800)] bg-[var(--neutral-900)] text-white",
	callout:
		"rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]",

	// Typography
	title:
		"font-['Sora'] text-2xl font-semibold tracking-tight text-[var(--text-primary)] md:text-3xl leading-tight",
	subtitle:
		"font-['Public_Sans'] mt-2 text-base leading-relaxed text-[var(--text-secondary)] max-w-prose",
	monoStat: "font-mono tabular-nums tracking-tight",
	tableHeader:
		"font-['Sora'] text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]",
	tableCell: "font-['Public_Sans'] text-sm text-[var(--text-primary)]",

	// Interactive
	navItemActive:
		"bg-[var(--accent-subtle)] font-semibold text-[var(--accent-default)]",
	navItemInactive:
		"font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]",

	// Dividers
	divider: "border-[var(--border-subtle)]",
	headerShell: "border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]",
} as const;

/** Mantine Modal styles usando el nuevo sistema */
export const adminModalStyles = {
	content: {
		border: "1px solid var(--neutral-200)",
		boxShadow: "0 16px 48px -12px rgba(0, 0, 0, 0.18)",
		borderRadius: "16px",
	},
	header: {
		borderBottom: "1px solid var(--neutral-200)",
		paddingBottom: "14px",
		marginBottom: "4px",
	},
	body: { paddingTop: "12px" },
} as const;

// Form styles
export const formStyles = {
	label:
		"font-['Sora'] text-xs font-semibold uppercase tracking-wider text-[var(--neutral-700)]",
	input:
		"w-full rounded-xl border border-[var(--neutral-300)] bg-white px-4 py-3 font-['Public_Sans'] text-sm text-[var(--neutral-900)] placeholder:text-[var(--neutral-400)] transition-all duration-200 focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-100)]",
	error: "mt-1 font-['Public_Sans'] text-xs text-red-600",
} as const;
