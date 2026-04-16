import { Box, Group } from "@mantine/core";
import type { ReactNode } from "react";
import { adminUi } from "./admin-ui";

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
		<Group justify="space-between" align="flex-start" wrap="wrap" gap="lg">
			<Box className="min-w-0 max-w-3xl flex-1">
				<h1 className={adminUi.title}>{title}</h1>
				{description ? <p className={adminUi.subtitle}>{description}</p> : null}
			</Box>
			{actions ? (
				<Group gap="sm" wrap="wrap" justify="flex-end">
					{actions}
				</Group>
			) : null}
		</Group>
	);
}
