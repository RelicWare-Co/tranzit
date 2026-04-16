import { UnstyledButton } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import type { ComponentType } from "react";

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
			className={
				isActive
					? "flex w-full items-center gap-3 rounded-r-2xl rounded-l-lg bg-red-50 py-3 pl-3 pr-3 text-[0.9375rem] font-semibold text-zinc-900 no-underline transition-colors duration-200 ease-out active:bg-red-100/80"
					: "flex w-full items-center gap-3 rounded-lg border border-transparent py-3 pl-3 pr-3 text-[0.9375rem] font-medium text-zinc-600 no-underline transition-colors duration-200 ease-out hover:bg-zinc-50 hover:text-zinc-900 active:bg-zinc-100/80"
			}
		>
			<Icon
				size={20}
				strokeWidth={1.75}
				className={
					isActive ? "shrink-0 text-red-700" : "shrink-0 text-zinc-400"
				}
			/>
			<span className="truncate">{label}</span>
		</UnstyledButton>
	);
}
