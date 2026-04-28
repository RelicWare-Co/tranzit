import { eq } from "drizzle-orm";
import {
	buildProcedureSummary,
	createAuditEvent,
} from "../../features/audit/audit.service";
import { db, schema } from "../../lib/db";
import { rpc } from "../../shared/orpc/context";
import {
	extractClientInfo,
	requireAdminAccess,
	throwRpcError,
} from "../../shared/orpc";

// Input validation helpers
function generateId(): string {
	return crypto.randomUUID();
}

function sanitizeSlug(slug: string): string {
	return slug
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-");
}

function parseName(name: string | undefined): string {
	const trimmed = name?.trim() ?? "";
	if (!trimmed) {
		throwRpcError("MISSING_REQUIRED_FIELDS", 422, "name is required");
	}
	return trimmed;
}

function parseSlug(slug: string | undefined): string {
	const sanitized = sanitizeSlug(slug ?? "");
	if (!sanitized) {
		throwRpcError("INVALID_SLUG", 422, "slug is required");
	}
	return sanitized;
}

function enforceNoDigitalDocuments(value: boolean | undefined) {
	if (value === true) {
		throwRpcError(
			"POLICY_RESTRICTION",
			422,
			"La carga digital de documentos esta deshabilitada por requisito operativo.",
		);
	}
}

function toPhysicalOnlyProcedure<T extends { allowsDigitalDocuments: boolean }>(
	procedure: T,
): T {
	return {
		...procedure,
		allowsDigitalDocuments: false,
	};
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

				const procedures = await db.query.procedureType.findMany({
					where: eq(schema.procedureType.isActive, isActive),
					orderBy: (procedureType, { asc }) => [asc(procedureType.name)],
				});

				return procedures.map(toPhysicalOnlyProcedure);
			}

			const procedures = await db.query.procedureType.findMany({
				orderBy: (procedureType, { asc }) => [asc(procedureType.name)],
			});

			return procedures.map(toPhysicalOnlyProcedure);
		}),

		get: rpc.handler(async ({ context, input }) => {
			await requireAdminAccess(context.headers, {
				booking: ["read"],
			});
			const payload = input as { id: string };

			if (!payload?.id) {
				throwRpcError("MISSING_REQUIRED_FIELDS", 422, "id is required");
			}

			const procedure = await db.query.procedureType.findFirst({
				where: eq(schema.procedureType.id, payload.id),
			});

			if (!procedure) {
				throwRpcError("NOT_FOUND", 404, "Procedure not found");
			}

			return toPhysicalOnlyProcedure(procedure);
		}),

		create: rpc.handler(async ({ context, input }) => {
			const session = await requireAdminAccess(context.headers, {
				booking: ["create"],
			});
			const clientInfo = extractClientInfo(context.headers);
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

			const parsedName = parseName(payload?.name);
			const sanitizedSlug = parseSlug(payload?.slug);
			enforceNoDigitalDocuments(payload?.allowsDigitalDocuments);

			// Check for duplicate slug
			const existing = await db.query.procedureType.findFirst({
				where: eq(schema.procedureType.slug, sanitizedSlug),
			});

			if (existing) {
				throwRpcError(
					"PROCEDURE_SLUG_CONFLICT",
					409,
					`A procedure with slug "${sanitizedSlug}" already exists`,
				);
			}

			const now = new Date();
			const newProcedure = {
				id: generateId(),
				name: parsedName,
				slug: sanitizedSlug,
				description: payload.description ?? null,
				isActive: true,
				configVersion: 1,
				requiresVehicle: payload.requiresVehicle ?? false,
				allowsPhysicalDocuments: payload.allowsPhysicalDocuments ?? true,
				allowsDigitalDocuments: false,
				instructions: payload.instructions ?? null,
				eligibilitySchema: payload.eligibilitySchema ?? {},
				formSchema: payload.formSchema ?? {},
				documentSchema: payload.documentSchema ?? {},
				policySchema: payload.policySchema ?? {},
				createdAt: now,
				updatedAt: now,
			};

			await db.insert(schema.procedureType).values(newProcedure);

			// Create audit event for procedure creation
			await createAuditEvent({
				actorType: "admin",
				actorUserId: session.user.id,
				entityType: "procedure_type",
				entityId: newProcedure.id,
				action: "create",
				summary: buildProcedureSummary("created", {
					procedureName: parsedName,
					slug: sanitizedSlug,
					isActive: true,
					configVersion: 1,
				}),
				payload: {
					id: newProcedure.id,
					name: parsedName,
					slug: sanitizedSlug,
					description: payload.description ?? null,
					requiresVehicle: payload.requiresVehicle ?? false,
					allowsPhysicalDocuments: payload.allowsPhysicalDocuments ?? true,
					allowsDigitalDocuments: false,
				},
				ipAddress: clientInfo.ipAddress,
				userAgent: clientInfo.userAgent,
			});

			return toPhysicalOnlyProcedure(newProcedure);
		}),

		update: rpc.handler(async ({ context, input }) => {
			const session = await requireAdminAccess(context.headers, {
				booking: ["update"],
			});
			const clientInfo = extractClientInfo(context.headers);
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
				throwRpcError("MISSING_REQUIRED_FIELDS", 422, "id is required");
			}

			const existing = await db.query.procedureType.findFirst({
				where: eq(schema.procedureType.id, payload.id),
			});

			if (!existing) {
				throwRpcError("NOT_FOUND", 404, "Procedure not found");
			}
			enforceNoDigitalDocuments(payload.allowsDigitalDocuments);

			const updates: Record<string, unknown> = {
				updatedAt: new Date(),
				allowsDigitalDocuments: false,
			};

			let configChanged = false;

			if (payload.name !== undefined) {
				updates.name = parseName(payload.name);
			}
			if (payload.description !== undefined)
				updates.description = payload.description;
			if (payload.isActive !== undefined) updates.isActive = payload.isActive;
			if (payload.requiresVehicle !== undefined)
				updates.requiresVehicle = payload.requiresVehicle;
			if (payload.allowsPhysicalDocuments !== undefined)
				updates.allowsPhysicalDocuments = payload.allowsPhysicalDocuments;
			if (payload.instructions !== undefined)
				updates.instructions = payload.instructions;
			if (payload.eligibilitySchema !== undefined) {
				updates.eligibilitySchema = payload.eligibilitySchema;
				configChanged = true;
			}
			if (payload.formSchema !== undefined) {
				updates.formSchema = payload.formSchema;
				configChanged = true;
			}
			if (payload.documentSchema !== undefined) {
				updates.documentSchema = payload.documentSchema;
				configChanged = true;
			}
			if (payload.policySchema !== undefined) {
				updates.policySchema = payload.policySchema;
				configChanged = true;
			}

			if (configChanged) {
				updates.configVersion = (existing.configVersion || 0) + 1;
			}

			await db
				.update(schema.procedureType)
				.set(updates)
				.where(eq(schema.procedureType.id, payload.id));

			// Create audit event for procedure update
			await createAuditEvent({
				actorType: "admin",
				actorUserId: session.user.id,
				entityType: "procedure_type",
				entityId: payload.id,
				action: "update",
				summary: buildProcedureSummary("updated", {
					procedureName: (updates.name as string | undefined) ?? existing.name,
					slug: existing.slug,
					isActive:
						(updates.isActive as boolean | undefined) ?? existing.isActive,
					configVersion:
						(updates.configVersion as number | undefined) ??
						existing.configVersion,
				}),
				payload: {
					id: payload.id,
					changes: updates,
				},
				ipAddress: clientInfo.ipAddress,
				userAgent: clientInfo.userAgent,
			});

			const updated = await db.query.procedureType.findFirst({
				where: eq(schema.procedureType.id, payload.id),
			});
			if (!updated) {
				throwRpcError("NOT_FOUND", 404, "Procedure not found");
			}
			return toPhysicalOnlyProcedure(updated);
		}),

		remove: rpc.handler(async ({ context, input }) => {
			const session = await requireAdminAccess(context.headers, {
				booking: ["delete"],
			});
			const clientInfo = extractClientInfo(context.headers);
			const payload = input as { id: string };

			if (!payload?.id) {
				throwRpcError("MISSING_REQUIRED_FIELDS", 422, "id is required");
			}

			const existing = await db.query.procedureType.findFirst({
				where: eq(schema.procedureType.id, payload.id),
			});

			if (!existing) {
				throwRpcError("NOT_FOUND", 404, "Procedure not found");
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

				// Create audit event for soft delete
				await createAuditEvent({
					actorType: "admin",
					actorUserId: session.user.id,
					entityType: "procedure_type",
					entityId: payload.id,
					action: "delete",
					summary: buildProcedureSummary("deleted (soft)", {
						procedureName: existing.name,
						slug: existing.slug,
						isActive: false,
						configVersion: existing.configVersion,
					}),
					payload: {
						id: payload.id,
						name: existing.name,
						slug: existing.slug,
						mode: "soft",
						reason: "has_existing_requests",
					},
					ipAddress: clientInfo.ipAddress,
					userAgent: clientInfo.userAgent,
				});

				return {
					success: true,
					message: "Procedure marked as inactive due to existing requests",
					mode: "soft" as const,
				};
			}

			// Hard delete if no requests
			await db
				.delete(schema.procedureType)
				.where(eq(schema.procedureType.id, payload.id));

			// Create audit event for hard delete
			await createAuditEvent({
				actorType: "admin",
				actorUserId: session.user.id,
				entityType: "procedure_type",
				entityId: payload.id,
				action: "delete",
				summary: buildProcedureSummary("deleted (hard)", {
					procedureName: existing.name,
					slug: existing.slug,
					isActive: existing.isActive,
					configVersion: existing.configVersion,
				}),
				payload: {
					id: payload.id,
					name: existing.name,
					slug: existing.slug,
					mode: "hard",
					reason: "no_existing_requests",
				},
				ipAddress: clientInfo.ipAddress,
				userAgent: clientInfo.userAgent,
			});

			return {
				success: true,
				message: "Procedure deleted successfully",
				mode: "hard" as const,
			};
		}),
	};
}
