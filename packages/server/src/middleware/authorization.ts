import type { Context, Next } from "hono";
import { auth } from "../features/auth/auth.config";

type PermissionMap = Record<string, string[]>;

type AppVariables = {
	user: typeof auth.$Infer.Session.user | null;
	session: typeof auth.$Infer.Session.session | null;
};

export function requirePermissions(permissions: PermissionMap) {
	return async (c: Context<{ Variables: AppVariables }>, next: Next) => {
		const user = c.get("user");

		if (!user) {
			return c.json(
				{ code: "UNAUTHENTICATED", message: "Authentication required" },
				401,
			);
		}

		const result = await auth.api.userHasPermission({
			body: {
				userId: user.id,
				permissions,
			},
		});

		if (!result.success) {
			return c.json(
				{
					code: "FORBIDDEN",
					message: "Insufficient permissions for this operation",
				},
				403,
			);
		}

		await next();
	};
}

export function requireRole(...roles: string[]) {
	return async (c: Context<{ Variables: AppVariables }>, next: Next) => {
		const user = c.get("user");

		if (!user) {
			return c.json(
				{ code: "UNAUTHENTICATED", message: "Authentication required" },
				401,
			);
		}

		const userRoles = (user.role || "").split(",").map((r) => r.trim());

		const hasRole = roles.some((role) => userRoles.includes(role));

		if (!hasRole) {
			return c.json(
				{
					code: "FORBIDDEN",
					message: `One of the following roles is required: ${roles.join(", ")}`,
				},
				403,
			);
		}

		await next();
	};
}
