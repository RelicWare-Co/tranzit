/**
 * SIMUT admin shell: zinc neutrals, single brand accent (red).
 * Keep numeric UI in tabular figures for alignment.
 */
export const ADMIN_ACCENT = "#c92a2a";

export const adminUi = {
	pageBg: "min-h-[100dvh] bg-zinc-50 antialiased",
	contentMax: "mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8",
	surface:
		"rounded-2xl border border-zinc-200/90 bg-white shadow-[0_22px_48px_-28px_rgba(9,9,11,0.22)] ring-1 ring-zinc-950/[0.04]",
	surfaceGlass:
		"rounded-2xl border border-white/20 bg-white/85 shadow-[0_22px_48px_-28px_rgba(9,9,11,0.18)] backdrop-blur-xl ring-1 ring-zinc-950/[0.05]",
	surfaceMuted:
		"rounded-2xl border border-zinc-200/80 bg-zinc-50/90 ring-1 ring-zinc-950/[0.03]",
	surfaceDark:
		"rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-50 shadow-[0_28px_56px_-32px_rgba(0,0,0,0.55)]",
	callout:
		"rounded-2xl border border-zinc-200/90 bg-zinc-100/90 ring-1 ring-zinc-950/[0.04]",
	divider: "border-zinc-200/90",
	title:
		"text-2xl font-semibold tracking-tight text-zinc-900 md:text-[1.75rem] leading-tight",
	subtitle: "mt-1.5 text-base leading-relaxed text-zinc-500 max-w-[65ch]",
	monoStat: "font-mono tabular-nums tracking-tight",
	headerShell:
		"border-b border-zinc-200/80 bg-white/90 shadow-[0_1px_0_rgba(9,9,11,0.04)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/75",
} as const;

/** Mantine Modal `styles` — diffusion shadow + crisp header rule */
export const adminModalStyles = {
	content: {
		border: "1px solid rgba(24, 24, 27, 0.1)",
		boxShadow:
			"0 28px 56px -28px rgba(9, 9, 11, 0.35), inset 0 1px 0 rgba(255,255,255,0.75)",
	},
	header: {
		borderBottom: "1px solid rgba(228, 228, 231, 0.95)",
		paddingBottom: 14,
		marginBottom: 4,
	},
	body: { paddingTop: 12 },
} as const;
