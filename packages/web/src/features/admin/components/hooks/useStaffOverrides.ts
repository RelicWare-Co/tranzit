import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { orpcClient } from "#/shared/lib/orpc-client";

async function fetchStaffOverrides(userId: string) {
	return await orpcClient.admin.staff.dateOverrides.list({ userId });
}

export type StaffDateOverride = Awaited<
	ReturnType<typeof fetchStaffOverrides>
>[number];

export function useStaffOverrides(userId: string | null) {
	const queryClient = useQueryClient();

	const query = useQuery({
		queryKey: [
			"admin",
			"configuracion",
			"staff-overrides",
			userId,
		],
		enabled: Boolean(userId),
		queryFn: async () => await fetchStaffOverrides(userId ?? ""),
	});

	const refresh = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: ["admin", "configuracion", "staff-overrides", userId],
		});
	}, [queryClient, userId]);

	return { ...query, refresh };
}
