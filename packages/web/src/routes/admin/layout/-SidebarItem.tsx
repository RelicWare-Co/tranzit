import { UnstyledButton } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import type { ComponentType } from "react";

const ease = "cubic-bezier(0.4, 0, 0.2, 1)";

/**
 * Item de navegación para sidebar con icono + label.
 * - Desktop: muestra icono + label completo
 * - Mobile (<768px): muestra solo icono (tooltip en futuro)
 * - Activo: borde izquierdo de 3px + fondo sutil + icono brand
 */
export function SidebarItem({
	icon: Icon,
	label,
	isActive,
	to,
}: {
	icon: ComponentType<{
		size?: number;
		className?: string;
		strokeWidth?: number;
	}>;
	label: string;
	isActive: boolean;
	to: string;
}) {
	return (
		<UnstyledButton
			component={Link}
			to={to}
			className={[
				"group relative flex w-full items-center gap-2.5 rounded-lg py-2.5 pl-2.5 pr-2 text-left text-sm font-medium leading-tight no-underline transition-all duration-150",
				isActive
					? "bg-[var(--brand-100)] text-[var(--brand-700)] border-l-[3px] border-l-[var(--brand-600)] pl-[calc(0.625rem-3px)]"
					: "border-l-[3px] border-l-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]",
			].join(" ")}
			style={{
				transitionTimingFunction: ease,
			}}
		>
			<span
				className={[
					"inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors duration-150",
					isActive
						? "bg-[var(--brand-200)] text-[var(--brand-700)]"
						: "bg-transparent text-[var(--text-tertiary)] group-hover:bg-[var(--bg-quaternary)] group-hover:text-[var(--text-secondary)]",
				].join(" ")}
			>
				<Icon size={18} strokeWidth={1.75} aria-hidden />
			</span>
			{/* Label visible solo en desktop */}
			<span className="hidden min-w-0 flex-1 truncate text-sm font-['Public_Sans'] md:inline">
				{label}
			</span>
		</UnstyledButton>
	);
}
