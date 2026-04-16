import type { Logger } from "pino";

export type AppVariables = {
	user: {
		id: string;
		role?: string | null | undefined;
		[key: string]: unknown;
	} | null;
	session: { id: string; [key: string]: unknown } | null;
	logger: Logger;
};
