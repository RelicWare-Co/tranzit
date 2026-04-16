import { UnstyledButton } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import type { ComponentType } from "react";
import { ADMIN_ACCENT } from "../_shared/-admin-ui";

const ease = "cubic-bezier(0.16, 1, 0.3, 1)";

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
				"group relative flex w-full items-center gap-4 rounded-xl border-l-[3px] py-3.5 pl-4 pr-4 text-left text-[0.9375rem] leading-snug no-underline transition-[background-color,color,box-shadow] duration-200",
				isActive
					? "bg-white font-semibold text-zinc-950 shadow-[0_1px_3px_rgba(9,9,11,0.08),0_0_0_1px_rgba(9,9,11,0.04)]"
					: "border-l-transparent font-medium text-zinc-600 hover:bg-zinc-200/55 hover:text-zinc-900",
			].join(" ")}
			style={{
				borderLeftColor: isActive ? ADMIN_ACCENT : "transparent",
				transitionTimingFunction: ease,
			}}
		>
			<span
				className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] ring-1 ring-zinc-200/70 transition-[box-shadow,background-color] duration-200 group-hover:bg-white group-hover:ring-zinc-300/80"
				style={{ color: isActive ? ADMIN_ACCENT : undefined }}
			>
				<Icon
					size={22}
					strokeWidth={1.65}
					aria-hidden
					className={isActive ? "" : "text-zinc-500"}
				/>
			</span>
			<span className="min-w-0 flex-1 truncate">{label}</span>
		</UnstyledButton>
	);
}
