import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const baseURL = import.meta.env.VITE_BETTER_AUTH_URL;

export const authClient = createAuthClient({
	...(baseURL ? { baseURL } : {}),
	plugins: [adminClient()],
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
