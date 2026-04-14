import { eq } from "drizzle-orm";
import { db, schema } from "../../lib/db";
import { rpc } from "../context";
import { requireAdminAccess } from "../shared";

export function createProceduresRouter() {
	return {
		list: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				booking: ["read"],
			});
			const payload = (input ?? {}) as { isActive?: boolean | string };

			if (payload.isActive !== undefined) {
				const isActive =
					payload.isActive === true || payload.isActive === "true";

				return await db.query.procedureType.findMany({
					where: eq(schema.procedureType.isActive, isActive),
					orderBy: (procedureType, { asc }) => [asc(procedureType.name)],
				});
			}

			return await db.query.procedureType.findMany({
				orderBy: (procedureType, { asc }) => [asc(procedureType.name)],
			});
		}),
	};
}
