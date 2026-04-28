import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { orpcClient } from "#/shared/lib/orpc-client";

export const CONFIG_SNAPSHOT_QUERY_KEY = [
	"admin",
	"configuracion",
	"snapshot",
] as const;

async function fetchConfigurationSnapshot() {
	const [templates, overrides, staff] = await Promise.all([
		orpcClient.admin.schedule.templates.list(),
		orpcClient.admin.schedule.overrides.list({}),
		orpcClient.admin.staff.list({}),
	]);

	return { templates, overrides, staff };
}

export type ConfigSnapshot = Awaited<
	ReturnType<typeof fetchConfigurationSnapshot>
>;
export type ScheduleTemplate = ConfigSnapshot["templates"][number];
export type CalendarOverride = ConfigSnapshot["overrides"][number];

export function useConfigSnapshot() {
	const queryClient = useQueryClient();

	const query = useQuery({
		queryKey: CONFIG_SNAPSHOT_QUERY_KEY,
		queryFn: fetchConfigurationSnapshot,
	});

	const refresh = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: CONFIG_SNAPSHOT_QUERY_KEY,
		});
	}, [queryClient]);

	return { ...query, refresh };
}
