import { db, schema } from "../../lib/db";

export type ActorType = "admin" | "citizen" | "system";

export interface CreateAuditEventInput {
	actorType: ActorType;
	actorUserId?: string | null;
	entityType: string;
	entityId: string;
	action: string;
	summary: string;
	payload?: Record<string, unknown>;
	ipAddress?: string | null;
	userAgent?: string | null;
}

/**
 * Create an audit event entry for tracking mutations.
 * This function is designed to be fire-and-forget - it does not throw
 * to avoid disrupting the primary mutation flow.
 */
export async function createAuditEvent(
	input: CreateAuditEventInput,
): Promise<void> {
	try {
		const id = crypto.randomUUID();
		await db.insert(schema.auditEvent).values({
			id,
			actorType: input.actorType,
			actorUserId: input.actorUserId ?? null,
			entityType: input.entityType,
			entityId: input.entityId,
			action: input.action,
			summary: input.summary,
			payload: input.payload ?? {},
			ipAddress: input.ipAddress ?? null,
			userAgent: input.userAgent ?? null,
			createdAt: new Date(),
		});
	} catch (error) {
		// Log error but don't throw - audit should not break primary operations
		console.error("[Audit] Failed to create audit event:", error);
	}
}

/**
 * Build a summary string for booking operations.
 */
export function buildBookingSummary(
	action: string,
	bookingId: string,
	bookingDetails?: {
		kind?: string;
		status?: string;
		slotDate?: string;
		startTime?: string;
		staffName?: string | null;
		citizenName?: string | null;
		reason?: string | null;
		targetStaffName?: string | null;
	},
): string {
	const parts = [`Booking ${action}`];

	if (bookingDetails?.kind) {
		parts.push(`(${bookingDetails.kind})`);
	}

	if (bookingDetails?.status) {
		parts.push(`→ status: ${bookingDetails.status}`);
	}

	if (bookingDetails?.slotDate && bookingDetails?.startTime) {
		parts.push(`for ${bookingDetails.slotDate} ${bookingDetails.startTime}`);
	}

	if (bookingDetails?.staffName) {
		parts.push(`with ${bookingDetails.staffName}`);
	}

	if (bookingDetails?.citizenName) {
		parts.push(`for ${bookingDetails.citizenName}`);
	}

	if (bookingDetails?.reason) {
		parts.push(`reason: ${bookingDetails.reason}`);
	}

	if (bookingDetails?.targetStaffName) {
		parts.push(`reassigned to ${bookingDetails.targetStaffName}`);
	}

	return parts.join(" ");
}

/**
 * Build a summary string for schedule operations.
 */
export function buildScheduleSummary(
	entityType: "template" | "override",
	action: string,
	details: {
		weekday?: number;
		date?: string;
		isClosed?: boolean;
		isEnabled?: boolean;
	},
): string {
	const parts = [`Schedule ${entityType} ${action}`];

	if (entityType === "template" && details.weekday !== undefined) {
		const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
		parts.push(`for ${dayNames[details.weekday] || `day ${details.weekday}`}`);
	}

	if (entityType === "override" && details.date) {
		parts.push(`for ${details.date}`);
	}

	if (details.isClosed !== undefined) {
		parts.push(details.isClosed ? "(closed)" : "(open)");
	}

	if (details.isEnabled !== undefined) {
		parts.push(details.isEnabled ? "(enabled)" : "(disabled)");
	}

	return parts.join(" ");
}

/**
 * Build a summary string for staff operations.
 */
export function buildStaffSummary(
	action: string,
	details: {
		staffName?: string | null;
		date?: string;
		isAvailable?: boolean;
		capacity?: number;
	},
): string {
	const parts = [`Staff ${action}`];

	if (details.staffName) {
		parts.push(`for ${details.staffName}`);
	}

	if (details.date) {
		parts.push(`on ${details.date}`);
	}

	if (details.isAvailable !== undefined) {
		parts.push(details.isAvailable ? "available" : "unavailable");
	}

	if (details.capacity !== undefined) {
		parts.push(`capacity: ${details.capacity}`);
	}

	return parts.join(" ");
}

/**
 * Build a summary string for procedure operations.
 */
export function buildProcedureSummary(
	action: string,
	details: {
		procedureName?: string | null;
		slug?: string;
		isActive?: boolean;
		configVersion?: number;
	},
): string {
	const parts = [`Procedure ${action}`];

	if (details.procedureName) {
		parts.push(`"${details.procedureName}"`);
	}

	if (details.slug) {
		parts.push(`(${details.slug})`);
	}

	if (details.isActive !== undefined) {
		parts.push(details.isActive ? "activated" : "deactivated");
	}

	if (details.configVersion !== undefined) {
		parts.push(`v${details.configVersion}`);
	}

	return parts.join(" ");
}

/**
 * Build a summary string for reservation series operations.
 */
export function buildSeriesSummary(
	action: string,
	details: {
		seriesId?: string;
		instanceCount?: number;
		kind?: string;
		fromDate?: string;
		toDate?: string;
		recurrenceRule?: unknown;
		releasedCount?: number;
		reason?: string | null;
		movedCount?: number;
		targetSlotId?: string | null;
		targetStaffUserId?: string | null;
		updatedCount?: number;
		staffUserId?: string;
		notes?: string | null;
		effectiveFrom?: string;
	},
): string {
	const parts = [`Reservation series ${action}`];

	if (details.kind) {
		parts.push(`(${details.kind})`);
	}

	if (details.instanceCount !== undefined) {
		parts.push(`${details.instanceCount} instances`);
	}

	if (details.recurrenceRule) {
		parts.push("with recurrence rule");
	}

	if (details.releasedCount !== undefined) {
		parts.push(`${details.releasedCount} released`);
	}

	if (details.reason) {
		parts.push(`reason: ${details.reason}`);
	}

	if (details.movedCount !== undefined) {
		parts.push(`${details.movedCount} moved`);
	}

	if (details.updatedCount !== undefined) {
		parts.push(`${details.updatedCount} updated`);
	}

	if (details.targetSlotId) {
		parts.push(`to slot ${details.targetSlotId}`);
	}

	if (details.targetStaffUserId) {
		parts.push(`to staff ${details.targetStaffUserId}`);
	}

	if (details.effectiveFrom) {
		parts.push(`from ${details.effectiveFrom}`);
	}

	if (details.fromDate && details.toDate) {
		parts.push(`from ${details.fromDate} to ${details.toDate}`);
	}

	return parts.join(" ");
}
