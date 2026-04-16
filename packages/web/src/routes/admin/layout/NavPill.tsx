import { Link } from "@tanstack/react-router";

export function NavPill({
	label,
	to,
	isActive,
}: {
	label: string;
	to: string;
	isActive: boolean;
}) {
	return (
		<Link
			to={to}
			className={
				isActive
					? "inline-block rounded-full bg-zinc-200/90 px-4 py-2 text-sm font-semibold tracking-tight text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition-[transform,background-color,color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] no-underline"
					: "inline-block rounded-full px-4 py-2 text-sm font-semibold tracking-tight text-zinc-500 transition-[transform,background-color,color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.98] no-underline"
			}
		>
			{label}
		</Link>
	);
}
