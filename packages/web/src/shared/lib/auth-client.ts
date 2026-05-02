import { adminClient, emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { ac, admin, auditor, staff } from "#/shared/lib/permissions";

export const authClient = createAuthClient({
	plugins: [
		adminClient({
			ac,
			roles: {
				admin,
				staff,
				auditor,
			},
		}),
		emailOTPClient(),
	],
});

export type AuthUser = {
	id: string;
	name: string;
	email: string;
	image?: string | null;
	emailVerified?: boolean;
	role?: string | null;
	banned?: boolean | null;
	banReason?: string | null;
	banExpires?: string | Date | null;
	phone?: string | null;
};
