import { sql } from "drizzle-orm";
import { auth } from "../../features/auth/auth.config";
import { db, schema } from "../../lib/db";
import { rpc } from "../../shared/orpc/context";
import { throwRpcError } from "../../shared/orpc";

const { user } = schema;

export function createOnboardingRouter() {
	return {
		status: rpc.handler(async () => {
			const existingAdmins = await db
				.select({ id: user.id })
				.from(user)
				.where(sql`${user.role} LIKE '%admin%'`);

			return { adminExists: existingAdmins.length > 0 };
		}),
		bootstrap: rpc.handler(async ({ context }) => {
			const session = await auth.api.getSession({
				headers: context.headers,
			});

			if (!session) {
				throwRpcError("UNAUTHENTICATED", 401, "Debes iniciar sesion");
			}

			const existingAdmins = await db
				.select({ id: user.id })
				.from(user)
				.where(sql`${user.role} LIKE '%admin%'`);

			if (existingAdmins.length > 0) {
				throwRpcError(
					"ADMIN_ALREADY_EXISTS",
					403,
					"El onboarding de admin ya fue completado",
				);
			}

			await db
				.update(user)
				.set({ role: "admin" })
				.where(sql`${user.id} = ${session.user.id}`);

			return { success: true, role: "admin" };
		}),
	};
}
