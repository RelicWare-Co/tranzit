import type { EvlogVariables } from "evlog/hono";

export type AppVariables = {
	Variables: EvlogVariables["Variables"] & {
		user: {
			id: string;
			role?: string | null | undefined;
			[key: string]: unknown;
		} | null;
		session: { id: string; [key: string]: unknown } | null;
	};
};
