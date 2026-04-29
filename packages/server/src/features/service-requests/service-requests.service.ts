import {
	and,
	type SQL,
	desc as drizzleDesc,
	eq,
	inArray,
	sql,
} from "drizzle-orm";
import { log } from "evlog";
import { db, schema } from "../../lib/db";
import { throwRpcError } from "../../shared/orpc";

/**
 * Valid status values for service requests.
 */
export type ServiceRequestStatus =
	| "draft"
	| "booking_held"
	| "verified"
	| "pending_confirmation"
	| "confirmed"
	| "cancelled";

/**
 * Input for listing service requests with pagination and filters.
 */
export interface ListServiceRequestsInput {
	status?: string[];
	procedureTypeId?: string;
	citizenUserId?: string;
	email?: string;
	limit?: number;
	offset?: number;
	orderBy?: "createdAt" | "updatedAt" | "status";
	orderDir?: "asc" | "desc";
}

/**
 * Result of listing service requests with pagination metadata.
 */
export interface ListServiceRequestsResult {
	requests: ServiceRequestWithDetails[];
	total: number;
	limit: number;
	offset: number;
	hasMore: boolean;
}

/**
 * Service request with enriched related data.
 */
export interface ServiceRequestWithDetails {
	id: string;
	procedureTypeId: string;
	citizenUserId: string | null;
	email: string;
	phone: string | null;
	documentType: string | null;
	documentNumber: string | null;
	status: string;
	procedureConfigVersion: number;
	draftData: Record<string, unknown>;
	procedureSnapshot: Record<string, unknown>;
	eligibilityResult: Record<string, unknown>;
	requirementsSnapshot: Record<string, unknown>;
	submittedSnapshot: Record<string, unknown>;
	activeBookingId: string | null;
	verifiedAt: Date | null;
	confirmedAt: Date | null;
	cancelledAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	procedureType?: {
		id: string;
		slug: string;
		name: string;
		isActive: boolean;
	} | null;
	citizen?: {
		id: string;
		name: string;
		email: string;
	} | null;
	activeBooking?: {
		id: string;
		status: string;
		slotId: string;
		staffUserId: string | null;
		confirmedAt: Date | null;
		holdExpiresAt: Date | null;
		slot?: {
			id: string;
			slotDate: string;
			startTime: string;
			endTime: string;
		} | null;
		staff?: {
			id: string;
			name: string;
			email: string;
		} | null;
	} | null;
}

/**
 * Lists service requests with pagination and optional filters.
 */
export async function listServiceRequests(
	input: ListServiceRequestsInput = {},
): Promise<ListServiceRequestsResult> {
	const {
		status,
		procedureTypeId,
		citizenUserId,
		email,
		limit = 50,
		offset = 0,
		orderBy = "createdAt",
		orderDir = "desc",
	} = input;

	// Build WHERE conditions
	const conditions: SQL[] = [];

	if (status && status.length > 0) {
		conditions.push(inArray(schema.serviceRequest.status, status));
	}
	if (procedureTypeId) {
		conditions.push(
			eq(schema.serviceRequest.procedureTypeId, procedureTypeId),
		);
	}
	if (citizenUserId) {
		conditions.push(eq(schema.serviceRequest.citizenUserId, citizenUserId));
	}
	if (email) {
		conditions.push(eq(schema.serviceRequest.email, email));
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Get total count
	const countResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(schema.serviceRequest)
		.where(whereClause);
	const total = Number(countResult[0]?.count ?? 0);

	// Determine order direction for drizzle
	const orderDirSql =
		orderDir === "asc"
			? (col: SQL) => sql`${col} ASC`
			: (col: SQL) => sql`${col} DESC`;

	// Fetch requests (base columns only, we'll enrich separately)
	const requests = await db.query.serviceRequest.findMany({
		where: whereClause,
		limit,
		offset,
		orderBy: [
			orderDirSql(
				orderBy === "updatedAt"
					? sql`${schema.serviceRequest.updatedAt}`
					: orderBy === "status"
						? sql`${schema.serviceRequest.status}`
						: sql`${schema.serviceRequest.createdAt}`,
			),
		],
	});

	// Enrich with related data in a second pass
	const formattedRequests = await Promise.all(
		requests.map(async (req) => {
			const procedureType = req.procedureTypeId
				? await db.query.procedureType.findFirst({
						where: eq(schema.procedureType.id, req.procedureTypeId),
					})
				: null;
			const citizen = req.citizenUserId
				? await db.query.user.findFirst({
						where: eq(schema.user.id, req.citizenUserId),
					})
				: null;
			const activeBooking = req.activeBookingId
				? await db.query.booking.findFirst({
						where: eq(schema.booking.id, req.activeBookingId),
					})
				: null;

			return {
				id: req.id,
				procedureTypeId: req.procedureTypeId,
				citizenUserId: req.citizenUserId,
				email: req.email,
				phone: req.phone,
				documentType: req.documentType,
				documentNumber: req.documentNumber,
				status: req.status,
				procedureConfigVersion: req.procedureConfigVersion,
				draftData: req.draftData as Record<string, unknown>,
				procedureSnapshot: req.procedureSnapshot as Record<string, unknown>,
				eligibilityResult: req.eligibilityResult as Record<string, unknown>,
				requirementsSnapshot: req.requirementsSnapshot as Record<string, unknown>,
				submittedSnapshot: req.submittedSnapshot as Record<string, unknown>,
				activeBookingId: req.activeBookingId,
				verifiedAt: req.verifiedAt,
				confirmedAt: req.confirmedAt,
				cancelledAt: req.cancelledAt,
				createdAt: req.createdAt,
				updatedAt: req.updatedAt,
				procedureType: procedureType
					? {
							id: procedureType.id,
							slug: procedureType.slug,
							name: procedureType.name,
							isActive: procedureType.isActive,
						}
					: null,
				citizen: citizen
					? {
							id: citizen.id,
							name: citizen.name,
							email: citizen.email,
						}
					: null,
				activeBooking: activeBooking
					? {
							id: activeBooking.id,
							status: activeBooking.status,
							slotId: activeBooking.slotId,
							staffUserId: activeBooking.staffUserId,
							confirmedAt: activeBooking.confirmedAt,
							holdExpiresAt: activeBooking.holdExpiresAt,
						}
					: null,
			};
		}),
	);

	return {
		requests: formattedRequests,
		total,
		limit,
		offset,
		hasMore: offset + formattedRequests.length < total,
	};
}

/**
 * Gets a single service request with full details including snapshots and linked booking.
 */
export async function getServiceRequest(
	requestId: string,
): Promise<ServiceRequestWithDetails> {
	const request = await db.query.serviceRequest.findFirst({
		where: eq(schema.serviceRequest.id, requestId),
	});

	if (!request) {
		throwRpcError("NOT_FOUND", 404, "Solicitud de servicio no encontrada");
	}

	// Fetch related data
	const procedureType = request.procedureTypeId
		? await db.query.procedureType.findFirst({
				where: eq(schema.procedureType.id, request.procedureTypeId),
			})
		: null;
	const citizen = request.citizenUserId
		? await db.query.user.findFirst({
				where: eq(schema.user.id, request.citizenUserId),
			})
		: null;

	// Format active booking with nested slot and staff details
	let activeBooking = null;
	if (request.activeBookingId) {
		const booking = await db.query.booking.findFirst({
			where: eq(schema.booking.id, request.activeBookingId),
			with: {
				slot: true,
				staff: true,
			},
		});
		if (booking) {
			activeBooking = {
				id: booking.id,
				status: booking.status,
				slotId: booking.slotId,
				staffUserId: booking.staffUserId,
				confirmedAt: booking.confirmedAt,
				holdExpiresAt: booking.holdExpiresAt,
				slot: booking.slot
					? {
							id: booking.slot.id,
							slotDate: booking.slot.slotDate,
							startTime: booking.slot.startTime,
							endTime: booking.slot.endTime,
						}
					: null,
				staff: booking.staff
					? {
							id: booking.staff.id,
							name: booking.staff.name,
							email: booking.staff.email,
						}
					: null,
			};
		}
	}

	return {
		id: request.id,
		procedureTypeId: request.procedureTypeId,
		citizenUserId: request.citizenUserId,
		email: request.email,
		phone: request.phone,
		documentType: request.documentType,
		documentNumber: request.documentNumber,
		status: request.status,
		procedureConfigVersion: request.procedureConfigVersion,
		draftData: request.draftData as Record<string, unknown>,
		procedureSnapshot: request.procedureSnapshot as Record<string, unknown>,
		eligibilityResult: request.eligibilityResult as Record<string, unknown>,
		requirementsSnapshot: request.requirementsSnapshot as Record<string, unknown>,
		submittedSnapshot: request.submittedSnapshot as Record<string, unknown>,
		activeBookingId: request.activeBookingId,
		verifiedAt: request.verifiedAt,
		confirmedAt: request.confirmedAt,
		cancelledAt: request.cancelledAt,
		createdAt: request.createdAt,
		updatedAt: request.updatedAt,
		procedureType,
		citizen,
		activeBooking,
	};
}

/**
 * Input for updating service request status.
 */
export interface UpdateServiceRequestStatusInput {
	requestId: string;
	status: ServiceRequestStatus;
	actorUserId: string;
	reason?: string;
	eligibilityData?: Record<string, unknown>;
}

/**
 * Valid status transitions map.
 * Key is current status, value is array of allowed target statuses.
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
	draft: ["booking_held", "cancelled"],
	booking_held: ["verified", "cancelled"],
	verified: ["pending_confirmation", "cancelled"],
	pending_confirmation: ["confirmed", "cancelled"],
	confirmed: [],
	cancelled: [],
};

/**
 * Eligibility checks that must pass before certain transitions.
 */
const ELIGIBILITY_CHECKS: Record<string, string[]> = {
	// verified requires that the booking is confirmed
	verified: ["booking_confirmed"],
	// pending_confirmation requires eligibility check passed
	pending_confirmation: ["eligibility_passed"],
};

/**
 * Result of status update operation.
 */
export interface UpdateServiceRequestStatusResult {
	id: string;
	previousStatus: string;
	newStatus: string;
	updatedAt: Date;
	timestampField: string | null;
	auditEventId: string;
}

/**
 * Updates the status of a service request with eligibility checks and atomic updates.
 */
export async function updateServiceRequestStatus(
	input: UpdateServiceRequestStatusInput,
): Promise<UpdateServiceRequestStatusResult> {
	const { requestId, status: newStatus, actorUserId, reason, eligibilityData } = input;

	// Get the current service request
	const request = await db.query.serviceRequest.findFirst({
		where: eq(schema.serviceRequest.id, requestId),
	});

	if (!request) {
		throwRpcError("NOT_FOUND", 404, "Solicitud de servicio no encontrada");
	}

	const currentStatus = request.status;

	// Validate transition
	const allowedTransitions = VALID_TRANSITIONS[currentStatus];
	if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
		throwRpcError(
			"INVALID_TRANSITION",
			400,
			`No se puede transicionar de '${currentStatus}' a '${newStatus}'. Transiciones permitidas: ${allowedTransitions.join(", ")}`,
		);
	}

	// Run eligibility checks for the target status
	const requiredChecks = ELIGIBILITY_CHECKS[newStatus] || [];
	if (requiredChecks.length > 0) {
		const eligibilityResult = await runEligibilityChecks(
			requestId,
			requiredChecks,
			eligibilityData,
		);
		if (!eligibilityResult.passed) {
			throwRpcError(
				"ELIGIBILITY_FAILED",
				400,
				`No se puede transicionar a '${newStatus}': ${eligibilityResult.reasons.join("; ")}`,
			);
		}
	}

	// Determine which timestamp field to update
	let timestampField: string | null = null;
	switch (newStatus) {
		case "verified":
			timestampField = "verifiedAt";
			break;
		case "confirmed":
			timestampField = "confirmedAt";
			break;
		case "cancelled":
			timestampField = "cancelledAt";
			break;
	}

	// Perform atomic update
	const now = new Date();
	const updateData: Record<string, unknown> = {
		status: newStatus,
		updatedAt: now,
	};
	if (timestampField) {
		updateData[timestampField] = now;
	}

	const updated = await db
		.update(schema.serviceRequest)
		.set(updateData)
		.where(eq(schema.serviceRequest.id, requestId))
		.returning();

	if (!updated || updated.length === 0) {
		throwRpcError(
			"INTERNAL_ERROR",
			500,
			"No se pudo actualizar el estado de la solicitud",
		);
	}

	// Create audit event
	const auditEventId = crypto.randomUUID();
	await db.insert(schema.auditEvent).values({
		id: auditEventId,
		actorType: "admin",
		actorUserId: actorUserId,
		entityType: "service_request",
		entityId: requestId,
		action: `status_${currentStatus}_to_${newStatus}`,
		summary: `Solicitud transicionada de ${currentStatus} a ${newStatus}`,
		payload: {
			previousStatus: currentStatus,
			newStatus,
			reason: reason || null,
			timestampField,
			eligibilityData: eligibilityData || null,
		},
	});

	log.info({
		tag: "service-request",
		message: "Service request status updated",
		requestId,
		previousStatus: currentStatus,
		newStatus,
		actorUserId,
		reason,
	});

	return {
		id: requestId,
		previousStatus: currentStatus,
		newStatus,
		updatedAt: now,
		timestampField,
		auditEventId,
	};
}

/**
 * Runs eligibility checks for a service request transition.
 */
async function runEligibilityChecks(
	requestId: string,
	checks: string[],
	eligibilityData?: Record<string, unknown>,
): Promise<{ passed: boolean; reasons: string[] }> {
	const reasons: string[] = [];

	for (const check of checks) {
		switch (check) {
			case "booking_confirmed": {
				// Fetch the active booking for this request
				const booking = await db.query.booking.findFirst({
					where: eq(schema.booking.requestId, requestId),
				});
				if (!booking) {
					reasons.push("No hay reserva activa asociada");
					continue;
				}
				if (booking.status !== "confirmed") {
					reasons.push(
						`La reserva activa tiene estado '${booking.status}', se requiere 'confirmed'`,
					);
				}
				break;
			}
			case "eligibility_passed": {
				// Check if eligibilityData indicates the eligibility check passed
				if (!eligibilityData?.passed) {
					reasons.push("El chequeo de elegibilidad no ha sido aprobado");
				}
				break;
			}
		}
	}

	return {
		passed: reasons.length === 0,
		reasons,
	};
}
