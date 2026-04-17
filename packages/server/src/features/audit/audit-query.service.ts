import {
	and,
	type SQL,
	desc as drizzleDesc,
	eq,
	gte,
	lte,
	sql,
} from "drizzle-orm";
import { db, schema } from "../../lib/db";
import { throwRpcError } from "../../orpc/shared";

/**
 * Input for listing audit events with pagination and filters.
 */
export interface ListAuditEventsInput {
	entityType?: string;
	entityId?: string;
	actorUserId?: string;
	action?: string;
	dateFrom?: string;
	dateTo?: string;
	limit?: number;
	offset?: number;
	orderBy?: "createdAt" | "action" | "entityType";
	orderDir?: "asc" | "desc";
}

/**
 * Audit event entry with all fields.
 */
export interface AuditEventEntry {
	id: string;
	actorType: string;
	actorUserId: string | null;
	entityType: string;
	entityId: string;
	action: string;
	summary: string;
	payload: Record<string, unknown>;
	ipAddress: string | null;
	userAgent: string | null;
	createdAt: Date;
}

/**
 * Result of listing audit events with pagination metadata.
 */
export interface ListAuditEventsResult {
	entries: AuditEventEntry[];
	total: number;
	limit: number;
	offset: number;
	hasMore: boolean;
}

const VALID_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(date: string): boolean {
	return VALID_DATE_REGEX.test(date);
}

/**
 * Lists audit events with pagination and optional filters.
 * Uses audit_event_entity_idx for entityType+entityId queries.
 * Uses audit_event_actor_idx for actorUserId queries.
 */
export async function listAuditEvents(
	input: ListAuditEventsInput = {},
): Promise<ListAuditEventsResult> {
	const {
		entityType,
		entityId,
		actorUserId,
		action,
		dateFrom,
		dateTo,
		limit = 50,
		offset = 0,
		orderBy = "createdAt",
		orderDir = "desc",
	} = input;

	// Validate date formats
	if (dateFrom && !isValidDate(dateFrom)) {
		throwRpcError("INVALID_DATE", 422, "dateFrom must be YYYY-MM-DD");
	}
	if (dateTo && !isValidDate(dateTo)) {
		throwRpcError("INVALID_DATE", 422, "dateTo must be YYYY-MM-DD");
	}

	// Validate date range
	if (dateFrom && dateTo && dateTo < dateFrom) {
		throwRpcError(
			"INVALID_DATE_RANGE",
			422,
			"dateTo must be greater than or equal to dateFrom",
		);
	}

	// Validate pagination
	if (limit < 1 || limit > 200) {
		throwRpcError(
			"INVALID_PAGINATION",
			422,
			"limit must be between 1 and 200",
		);
	}

	if (offset < 0) {
		throwRpcError("INVALID_PAGINATION", 422, "offset must be non-negative");
	}

	// Build WHERE conditions
	const conditions: SQL[] = [];

	if (entityType) {
		conditions.push(eq(schema.auditEvent.entityType, entityType));
	}
	if (entityId) {
		conditions.push(eq(schema.auditEvent.entityId, entityId));
	}
	if (actorUserId) {
		conditions.push(eq(schema.auditEvent.actorUserId, actorUserId));
	}
	if (action) {
		conditions.push(eq(schema.auditEvent.action, action));
	}

	// Date range filter on createdAt
	if (dateFrom) {
		// dateFrom is inclusive: start of that day (00:00:00)
		const fromDate = new Date(`${dateFrom}T00:00:00.000Z`);
		conditions.push(gte(schema.auditEvent.createdAt, fromDate));
	}
	if (dateTo) {
		// dateTo is inclusive: end of that day (23:59:59.999)
		const toDate = new Date(`${dateTo}T23:59:59.999Z`);
		conditions.push(lte(schema.auditEvent.createdAt, toDate));
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Get total count
	const countResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(schema.auditEvent)
		.where(whereClause);
	const total = Number(countResult[0]?.count ?? 0);

	// Determine order direction for drizzle
	const orderDirSql =
		orderDir === "asc"
			? (col: SQL) => sql`${col} ASC`
			: (col: SQL) => sql`${col} DESC`;

	// Fetch entries
	const entries = await db.query.auditEvent.findMany({
		where: whereClause,
		limit,
		offset,
		orderBy: [
			orderDirSql(
				orderBy === "action"
					? sql`${schema.auditEvent.action}`
					: orderBy === "entityType"
						? sql`${schema.auditEvent.entityType}`
						: sql`${schema.auditEvent.createdAt}`,
			),
		],
	});

	// Format entries
	const formattedEntries: AuditEventEntry[] = entries.map((entry) => ({
		id: entry.id,
		actorType: entry.actorType,
		actorUserId: entry.actorUserId,
		entityType: entry.entityType,
		entityId: entry.entityId,
		action: entry.action,
		summary: entry.summary ?? "",
		payload: entry.payload as Record<string, unknown>,
		ipAddress: entry.ipAddress,
		userAgent: entry.userAgent,
		createdAt: entry.createdAt,
	}));

	return {
		entries: formattedEntries,
		total,
		limit,
		offset,
		hasMore: offset + formattedEntries.length < total,
	};
}

/**
 * Gets a single audit event by ID.
 */
export async function getAuditEvent(id: string): Promise<AuditEventEntry> {
	const entry = await db.query.auditEvent.findFirst({
		where: eq(schema.auditEvent.id, id),
	});

	if (!entry) {
		throwRpcError("NOT_FOUND", 404, "Audit event not found");
	}

	return {
		id: entry.id,
		actorType: entry.actorType,
		actorUserId: entry.actorUserId,
		entityType: entry.entityType,
		entityId: entry.entityId,
		action: entry.action,
		summary: entry.summary ?? "",
		payload: entry.payload as Record<string, unknown>,
		ipAddress: entry.ipAddress,
		userAgent: entry.userAgent,
		createdAt: entry.createdAt,
	};
}
