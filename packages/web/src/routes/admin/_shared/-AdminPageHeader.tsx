import { Group } from "@mantine/core";
import type { ReactNode } from "react";

export function AdminPageHeader({
	title,
	description,
	actions,
}: {
	title: string;
	description?: string;
	actions?: ReactNode;
}) {
	return (
		<div className="flex flex-wrap items-start justify-between gap-4 lg:gap-6 pb-4">
			<div className="min-w-0 flex-1">
				<h1 className="font-['Sora'] text-2xl font-semibold tracking-tight text-[var(--text-primary)] md:text-3xl leading-tight">
					{title}
				</h1>
				{description ? (
					<p className="font-['Public_Sans'] mt-2 text-base leading-relaxed text-[var(--text-secondary)] max-w-prose">
						{description}
					</p>
				) : null}
			</div>
			{actions ? (
				<Group gap="sm" wrap="wrap" justify="flex-end" className="shrink-0">
					{actions}
				</Group>
			) : null}
		</div>
	);
}
