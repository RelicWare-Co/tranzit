import { eq } from "drizzle-orm";
import { db, schema } from "../../lib/db";
import { rpc } from "../context";
import { requireAdminAccess } from "../shared";

// Input validation helpers
function generateId(): string {
	return `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 11)}`;
}

function sanitizeSlug(slug: string): string {
	return slug
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-");
}

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

		get: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				booking: ["read"],
			});
			const payload = input as { id: string };

			if (!payload?.id) {
				throw new Error("Procedure ID is required");
			}

			const procedure = await db.query.procedureType.findFirst({
				where: eq(schema.procedureType.id, payload.id),
			});

			if (!procedure) {
				throw new Error("Procedure not found");
			}

			return procedure;
		}),

		create: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				booking: ["write"],
			});
			const payload = input as {
				name: string;
				slug: string;
				description?: string;
				requiresVehicle?: boolean;
				allowsPhysicalDocuments?: boolean;
				allowsDigitalDocuments?: boolean;
				instructions?: string;
				eligibilitySchema?: Record<string, unknown>;
				formSchema?: Record<string, unknown>;
				documentSchema?: Record<string, unknown>;
				policySchema?: Record<string, unknown>;
			};

			if (!payload?.name || !payload?.slug) {
				throw new Error("Name and slug are required");
			}

			const sanitizedSlug = sanitizeSlug(payload.slug);

			// Check for duplicate slug
			const existing = await db.query.procedureType.findFirst({
				where: eq(schema.procedureType.slug, sanitizedSlug),
			});

			if (existing) {
				throw new Error(
					`A procedure with slug "${sanitizedSlug}" already exists`,
				);
			}

			const now = new Date();
			const newProcedure = {
				id: generateId(),
				name: payload.name,
				slug: sanitizedSlug,
				description: payload.description ?? null,
				isActive: true,
				configVersion: 1,
				requiresVehicle: payload.requiresVehicle ?? false,
				allowsPhysicalDocuments: payload.allowsPhysicalDocuments ?? true,
				allowsDigitalDocuments: payload.allowsDigitalDocuments ?? true,
				instructions: payload.instructions ?? null,
				eligibilitySchema: payload.eligibilitySchema ?? {},
				formSchema: payload.formSchema ?? {},
				documentSchema: payload.documentSchema ?? {},
				policySchema: payload.policySchema ?? {},
				createdAt: now,
				updatedAt: now,
			};

			await db.insert(schema.procedureType).values(newProcedure);

			return newProcedure;
		}),

		update: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				booking: ["write"],
			});
			const payload = input as {
				id: string;
				name?: string;
				description?: string;
				isActive?: boolean;
				requiresVehicle?: boolean;
				allowsPhysicalDocuments?: boolean;
				allowsDigitalDocuments?: boolean;
				instructions?: string;
				eligibilitySchema?: Record<string, unknown>;
				formSchema?: Record<string, unknown>;
				documentSchema?: Record<string, unknown>;
				policySchema?: Record<string, unknown>;
			};

			if (!payload?.id) {
				throw new Error("Procedure ID is required");
			}

			const existing = await db.query.procedureType.findFirst({
				where: eq(schema.procedureType.id, payload.id),
			});

			if (!existing) {
				throw new Error("Procedure not found");
			}

			const updates: Record<string, unknown> = {
				updatedAt: new Date(),
			};

			if (payload.name !== undefined) updates.name = payload.name;
			if (payload.description !== undefined)
				updates.description = payload.description;
			if (payload.isActive !== undefined) updates.isActive = payload.isActive;
			if (payload.requiresVehicle !== undefined)
				updates.requiresVehicle = payload.requiresVehicle;
			if (payload.allowsPhysicalDocuments !== undefined)
				updates.allowsPhysicalDocuments = payload.allowsPhysicalDocuments;
			if (payload.allowsDigitalDocuments !== undefined)
				updates.allowsDigitalDocuments = payload.allowsDigitalDocuments;
			if (payload.instructions !== undefined)
				updates.instructions = payload.instructions;
			if (payload.eligibilitySchema !== undefined)
				updates.eligibilitySchema = payload.eligibilitySchema;
			if (payload.formSchema !== undefined) {
				updates.formSchema = payload.formSchema;
				// Increment config version when form schema changes
				updates.configVersion = (existing.configVersion || 0) + 1;
			}
			if (payload.documentSchema !== undefined)
				updates.documentSchema = payload.documentSchema;
			if (payload.policySchema !== undefined)
				updates.policySchema = payload.policySchema;

			await db
				.update(schema.procedureType)
				.set(updates)
				.where(eq(schema.procedureType.id, payload.id));

			return await db.query.procedureType.findFirst({
				where: eq(schema.procedureType.id, payload.id),
			});
		}),

		remove: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				booking: ["write"],
			});
			const payload = input as { id: string };

			if (!payload?.id) {
				throw new Error("Procedure ID is required");
			}

			const existing = await db.query.procedureType.findFirst({
				where: eq(schema.procedureType.id, payload.id),
			});

			if (!existing) {
				throw new Error("Procedure not found");
			}

			// Check for active service requests
			const hasRequests = await db.query.serviceRequest.findFirst({
				where: eq(schema.serviceRequest.procedureTypeId, payload.id),
			});

			if (hasRequests) {
				// Soft delete: mark as inactive
				await db
					.update(schema.procedureType)
					.set({ isActive: false, updatedAt: new Date() })
					.where(eq(schema.procedureType.id, payload.id));

				return {
					success: true,
					message: "Procedure marked as inactive due to existing requests",
				};
			}

			// Hard delete if no requests
			await db
				.delete(schema.procedureType)
				.where(eq(schema.procedureType.id, payload.id));

			return { success: true, message: "Procedure deleted successfully" };
		}),
	};
}
