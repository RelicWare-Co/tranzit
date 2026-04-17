import { auth } from "../../features/auth/auth.config";
import { throwRpcError } from "./errors";

export type PermissionMap = Record<string, string[]>;

export async function requireAuthenticatedSession(headers: Headers) {
	const session = await auth.api.getSession({ headers });

	if (!session) {
		throwRpcError("UNAUTHENTICATED", 401, "Debes iniciar sesion");
	}

	return session;
}

export async function requireAdminAccess(
	headers: Headers,
	permissions?: PermissionMap,
) {
	const session = await requireAuthenticatedSession(headers);

	const userRoles = (session.user.role ?? "")
		.split(",")
		.map((role) => role.trim())
		.filter(Boolean);
	const hasAdminAccess = userRoles.some((role) =>
		["admin", "staff", "auditor"].includes(role),
	);

	if (!hasAdminAccess) {
		throwRpcError(
			"FORBIDDEN",
			403,
			"One of the following roles is required: admin, staff, auditor",
		);
	}

	if (permissions) {
		const permissionResult = await auth.api.userHasPermission({
			body: {
				userId: session.user.id,
				permissions,
			},
		});

		if (!permissionResult.success) {
			throwRpcError(
				"FORBIDDEN",
				403,
				"Insufficient permissions for this operation",
			);
		}
	}

	return session;
}
