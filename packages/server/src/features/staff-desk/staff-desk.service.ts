import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "../../lib/db";
import { throwRpcError } from "../../shared/orpc";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_OBSERVATIONS_LENGTH = 2_000;
const MAX_REQUIREMENT_NOTE_LENGTH = 500;
const MAX_CANCELLATION_REASON_LENGTH = 1_000;

type JsonRecord = Record<string, unknown>;

export type StaffDeskAction =
	| "checked_in"
	| "reviewed"
	| "completed"
	| "cancelled";

export interface StaffDeskRequirementReview {
	id: string;
	present: boolean;
	note?: string;
}

export interface ReviewStaffDeskCaseInput {
	bookingId: string;
	identityConfirmed: boolean;
	requirements: StaffDeskRequirementReview[];
	observations?: string;
}

interface DeskMutationContext {
	staffUserId: string;
	ipAddress?: string | null;
	userAgent?: string | null;
}

interface DeskRequirement {
	id: string;
	name: string;
	description: string | null;
	isRequired: boolean;
}

function isRecord(value: unknown): value is JsonRecord {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
	return typeof value === "string" && value.trim().length > 0
		? value.trim()
		: null;
}

function getBogotaIsoDate(value = new Date()) {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: "America/Bogota",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(value);
	const byType = new Map(parts.map((part) => [part.type, part.value]));
	return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

function getEligibilityRecord(
	eligibilityResult: unknown,
	key: "staffCheckIn" | "staffReview",
) {
	if (!isRecord(eligibilityResult)) return null;
	const value = eligibilityResult[key];
	return isRecord(value) ? value : null;
}

function assertOperationalDate(slotDate: string) {
	if (slotDate !== getBogotaIsoDate()) {
		throwRpcError(
			"OUTSIDE_OPERATIONAL_DATE",
			422,
			"Esta atención solo puede modificarse el día de la cita",
		);
	}
}

function normalizeOptionalText(
	value: unknown,
	field: string,
	maxLength: number,
): string | null {
	if (value === undefined || value === null) return null;
	if (typeof value !== "string") {
		throwRpcError("INVALID_INPUT", 422, `${field} debe ser texto`);
	}
	const normalized = value.trim();
	if (normalized.length > maxLength) {
		throwRpcError(
			"INVALID_INPUT",
			422,
			`${field} no puede superar ${maxLength} caracteres`,
		);
	}
	return normalized || null;
}

function getRequirements(snapshot: unknown): DeskRequirement[] {
	if (!isRecord(snapshot) || !Array.isArray(snapshot.requirements)) return [];

	return snapshot.requirements.flatMap((value) => {
		if (!isRecord(value)) return [];
		const id = nonEmptyString(value.id);
		const name = nonEmptyString(value.name);
		if (!id || !name) return [];

		return [
			{
				id,
				name,
				description: nonEmptyString(value.description),
				isRequired: value.isRequired !== false,
			},
		];
	});
}

function getProcedureSnapshot(
	request: typeof schema.serviceRequest.$inferSelect,
	procedure: typeof schema.procedureType.$inferSelect | null,
) {
	const snapshot = isRecord(request.procedureSnapshot)
		? request.procedureSnapshot
		: {};

	return {
		id: request.procedureTypeId,
		name:
			nonEmptyString(snapshot.name) ?? procedure?.name ?? "Trámite sin nombre",
		description:
			nonEmptyString(snapshot.description) ?? procedure?.description ?? null,
		instructions:
			nonEmptyString(snapshot.instructions) ?? procedure?.instructions ?? null,
		requiresVehicle:
			typeof snapshot.requiresVehicle === "boolean"
				? snapshot.requiresVehicle
				: (procedure?.requiresVehicle ?? false),
	};
}

function toDeskCase(
	booking: typeof schema.booking.$inferSelect & {
		slot: typeof schema.appointmentSlot.$inferSelect | null;
		request:
			| (typeof schema.serviceRequest.$inferSelect & {
					procedureType: typeof schema.procedureType.$inferSelect | null;
					citizen: typeof schema.user.$inferSelect | null;
			  })
			| null;
	},
) {
	if (!booking.slot || !booking.request) return null;

	const request = booking.request;
	const draftData = isRecord(request.draftData) ? request.draftData : {};
	const procedure = getProcedureSnapshot(request, request.procedureType);

	return {
		id: booking.id,
		status: booking.status,
		isActive: booking.isActive,
		confirmedAt: booking.confirmedAt,
		attendedAt: booking.attendedAt,
		cancelledAt: booking.cancelledAt,
		statusReason: booking.statusReason,
		notes: booking.notes,
		slot: {
			id: booking.slot.id,
			slotDate: booking.slot.slotDate,
			startTime: booking.slot.startTime,
			endTime: booking.slot.endTime,
		},
		request: {
			id: request.id,
			status: request.status,
			email: request.email,
			phone: request.phone,
			documentType: request.documentType,
			documentNumber: request.documentNumber,
			applicantName:
				nonEmptyString(draftData.applicantName) ??
				request.citizen?.name ??
				"Ciudadano sin nombre registrado",
			plate: nonEmptyString(draftData.plate),
			procedure,
			requirements: getRequirements(request.requirementsSnapshot),
			eligibilityResult: isRecord(request.eligibilityResult)
				? request.eligibilityResult
				: {},
			verifiedAt: request.verifiedAt,
			confirmedAt: request.confirmedAt,
			cancelledAt: request.cancelledAt,
		},
	};
}

function assertValidDate(date: string) {
	if (!ISO_DATE_PATTERN.test(date)) {
		throwRpcError("INVALID_DATE", 422, "date debe tener formato YYYY-MM-DD");
	}
}

function assertOwnedActiveCitizenBooking(
	booking: typeof schema.booking.$inferSelect | undefined,
	staffUserId: string,
): typeof schema.booking.$inferSelect & { requestId: string } {
	if (
		!booking ||
		booking.staffUserId !== staffUserId ||
		booking.kind !== "citizen"
	) {
		throwRpcError(
			"NOT_FOUND",
			404,
			"No se encontró una cita asignada al funcionario",
		);
	}
	const requestId = booking.requestId;
	if (!requestId) {
		throwRpcError(
			"INVALID_STATE",
			422,
			"La cita no está asociada a una solicitud de trámite",
		);
	}
	return { ...booking, requestId };
}

function assertCurrentBooking(
	booking: typeof schema.booking.$inferSelect,
	request: typeof schema.serviceRequest.$inferSelect,
) {
	if (request.activeBookingId !== booking.id) {
		throwRpcError(
			"STALE_BOOKING",
			409,
			"La cita seleccionada ya no es la reserva vigente de la solicitud",
		);
	}
}

function assertActiveBooking(booking: typeof schema.booking.$inferSelect) {
	if (!booking.isActive) {
		throwRpcError(
			"INVALID_STATE",
			422,
			"La cita ya no está activa y no puede recibir atención",
		);
	}
}

function createAuditValues(input: {
	actorUserId: string;
	entityType: string;
	entityId: string;
	action: string;
	summary: string;
	payload?: JsonRecord;
	ipAddress?: string | null;
	userAgent?: string | null;
	now: Date;
}) {
	return {
		id: crypto.randomUUID(),
		actorType: "staff",
		actorUserId: input.actorUserId,
		entityType: input.entityType,
		entityId: input.entityId,
		action: input.action,
		summary: input.summary,
		payload: input.payload ?? {},
		ipAddress: input.ipAddress ?? null,
		userAgent: input.userAgent ?? null,
		createdAt: input.now,
	};
}

async function getOwnedBookingForMutation(
	bookingId: string,
	staffUserId: string,
) {
	const booking = await db.query.booking.findFirst({
		where: eq(schema.booking.id, bookingId),
		with: { slot: true },
	});
	const safeBooking = assertOwnedActiveCitizenBooking(booking, staffUserId);
	if (!booking?.slot) {
		throwRpcError("INVALID_STATE", 422, "La cita no tiene un horario asociado");
	}
	return { ...safeBooking, slotDate: booking.slot.slotDate };
}

/**
 * Returns the work queue scoped to a single, currently authenticated staff
 * member. The queue intentionally includes completed/cancelled entries for
 * the selected day so a desk can answer operational questions without opening
 * the global scheduling backoffice.
 */
export async function getStaffDeskQueue(input: {
	staffUserId: string;
	date: string;
}) {
	assertValidDate(input.date);

	const slots = await db.query.appointmentSlot.findMany({
		where: eq(schema.appointmentSlot.slotDate, input.date),
	});
	if (slots.length === 0) return { date: input.date, cases: [] };

	const bookings = await db.query.booking.findMany({
		where: and(
			inArray(
				schema.booking.slotId,
				slots.map((slot) => slot.id),
			),
			eq(schema.booking.staffUserId, input.staffUserId),
			eq(schema.booking.kind, "citizen"),
			inArray(schema.booking.status, ["confirmed", "attended", "cancelled"]),
		),
		with: {
			slot: true,
			request: {
				with: {
					procedureType: true,
					citizen: true,
				},
			},
		},
	});

	const cases = bookings
		.flatMap((booking) => {
			const deskCase = toDeskCase(booking);
			return deskCase ? [deskCase] : [];
		})
		.toSorted((left, right) =>
			left.slot.startTime.localeCompare(right.slot.startTime),
		);

	return { date: input.date, cases };
}

/**
 * Records reception for a confirmed appointment. Temporary holds are excluded
 * from the desk because they are not appointments until the citizen confirms.
 */
export async function checkInStaffDeskCase(
	input: { bookingId: string } & DeskMutationContext,
) {
	if (!input.bookingId) {
		throwRpcError("MISSING_REQUIRED_FIELDS", 422, "bookingId es requerido");
	}

	const booking = await getOwnedBookingForMutation(
		input.bookingId,
		input.staffUserId,
	);

	return await db.transaction(async (tx) => {
		const currentBooking = await tx.query.booking.findFirst({
			where: eq(schema.booking.id, booking.id),
		});
		const safeBooking = assertOwnedActiveCitizenBooking(
			currentBooking,
			input.staffUserId,
		);
		const request = await tx.query.serviceRequest.findFirst({
			where: eq(schema.serviceRequest.id, safeBooking.requestId),
		});
		if (!request) {
			throwRpcError("NOT_FOUND", 404, "No se encontró la solicitud asociada");
		}
		assertCurrentBooking(safeBooking, request);
		const existingCheckIn = getEligibilityRecord(
			request.eligibilityResult,
			"staffCheckIn",
		);
		if (
			safeBooking.status === "confirmed" &&
			nonEmptyString(existingCheckIn?.checkedInAt)
		) {
			return {
				action: "checked_in" as const,
				alreadyProcessed: true,
				bookingId: safeBooking.id,
				requestId: request.id,
			};
		}
		assertOperationalDate(booking.slotDate);
		assertActiveBooking(safeBooking);
		if (safeBooking.status !== "confirmed" || request.status !== "confirmed") {
			throwRpcError(
				"INVALID_STATE",
				422,
				"La cita debe estar confirmada antes de registrar la recepción",
			);
		}

		const now = new Date();
		const existingEligibility = isRecord(request.eligibilityResult)
			? request.eligibilityResult
			: {};
		const updatedRequests = await tx
			.update(schema.serviceRequest)
			.set({
				eligibilityResult: {
					...existingEligibility,
					staffCheckIn: {
						version: 1,
						checkedInAt: now.toISOString(),
						checkedInByUserId: input.staffUserId,
					},
				},
				updatedAt: now,
			})
			.where(
				and(
					eq(schema.serviceRequest.id, request.id),
					eq(schema.serviceRequest.status, "confirmed"),
				),
			)
			.returning({ id: schema.serviceRequest.id });
		if (updatedRequests.length !== 1) {
			throwRpcError(
				"CONCURRENT_MODIFICATION",
				409,
				"La solicitud cambió mientras se registraba la recepción",
			);
		}

		await tx.insert(schema.auditEvent).values(
			createAuditValues({
				actorUserId: input.staffUserId,
				entityType: "service_request",
				entityId: request.id,
				action: "desk_check_in",
				summary:
					"Ciudadano recibido en ventanilla; inicia la revisión del trámite",
				payload: { bookingId: safeBooking.id },
				ipAddress: input.ipAddress,
				userAgent: input.userAgent,
				now,
			}),
		);

		return {
			action: "checked_in" as const,
			alreadyProcessed: false,
			bookingId: safeBooking.id,
			requestId: request.id,
		};
	});
}

/**
 * Persists the physical-document review against the immutable requirement
 * snapshot captured when the citizen requested the appointment.
 */
export async function reviewStaffDeskCase(
	input: ReviewStaffDeskCaseInput & DeskMutationContext,
) {
	if (!input.bookingId) {
		throwRpcError("MISSING_REQUIRED_FIELDS", 422, "bookingId es requerido");
	}
	if (!Array.isArray(input.requirements)) {
		throwRpcError("INVALID_INPUT", 422, "requirements debe ser una lista");
	}
	if (!input.identityConfirmed) {
		throwRpcError(
			"IDENTITY_NOT_CONFIRMED",
			422,
			"Confirma la identidad del ciudadano antes de continuar",
		);
	}

	const observations = normalizeOptionalText(
		input.observations,
		"observations",
		MAX_OBSERVATIONS_LENGTH,
	);
	const booking = await getOwnedBookingForMutation(
		input.bookingId,
		input.staffUserId,
	);

	return await db.transaction(async (tx) => {
		const currentBooking = await tx.query.booking.findFirst({
			where: eq(schema.booking.id, booking.id),
		});
		const safeBooking = assertOwnedActiveCitizenBooking(
			currentBooking,
			input.staffUserId,
		);
		assertActiveBooking(safeBooking);
		if (safeBooking.status !== "confirmed") {
			throwRpcError(
				"INVALID_STATE",
				422,
				"La cita debe estar confirmada antes de revisar requisitos",
			);
		}

		const request = await tx.query.serviceRequest.findFirst({
			where: eq(schema.serviceRequest.id, safeBooking.requestId),
		});
		if (!request) {
			throwRpcError("NOT_FOUND", 404, "No se encontró la solicitud asociada");
		}
		assertCurrentBooking(safeBooking, request);
		assertOperationalDate(booking.slotDate);
		const existingEligibility = isRecord(request.eligibilityResult)
			? request.eligibilityResult
			: {};
		const existingCheckIn = getEligibilityRecord(
			existingEligibility,
			"staffCheckIn",
		);
		if (!nonEmptyString(existingCheckIn?.checkedInAt)) {
			throwRpcError(
				"INVALID_STATE",
				422,
				"Primero registra la recepción del ciudadano",
			);
		}
		const existingStaffReview = getEligibilityRecord(
			existingEligibility,
			"staffReview",
		);
		if (existingStaffReview?.passed === true) {
			return {
				action: "reviewed" as const,
				alreadyProcessed: true,
				bookingId: safeBooking.id,
				requestId: request.id,
			};
		}
		if (request.status !== "confirmed") {
			throwRpcError(
				"INVALID_STATE",
				422,
				"La solicitud no está disponible para validar requisitos",
			);
		}

		const requirements = getRequirements(request.requirementsSnapshot);
		const expectedIds = new Set(
			requirements.map((requirement) => requirement.id),
		);
		const reviewedIds = new Set<string>();
		const reviews = input.requirements.map((review) => {
			if (!review || typeof review !== "object") {
				throwRpcError("INVALID_INPUT", 422, "Hay un requisito inválido");
			}
			const id = nonEmptyString(review.id);
			if (!id || !expectedIds.has(id) || reviewedIds.has(id)) {
				throwRpcError(
					"INVALID_INPUT",
					422,
					"La revisión contiene un requisito inexistente o repetido",
				);
			}
			if (typeof review.present !== "boolean") {
				throwRpcError(
					"INVALID_INPUT",
					422,
					"El estado del requisito es inválido",
				);
			}
			reviewedIds.add(id);
			return {
				id,
				present: review.present,
				note: normalizeOptionalText(
					review.note,
					"La nota de un requisito",
					MAX_REQUIREMENT_NOTE_LENGTH,
				),
			};
		});

		const missingRequired = requirements.filter(
			(requirement) =>
				requirement.isRequired &&
				!reviews.some(
					(review) => review.id === requirement.id && review.present,
				),
		);
		if (missingRequired.length > 0) {
			throwRpcError(
				"REQUIREMENTS_INCOMPLETE",
				422,
				`Faltan requisitos obligatorios: ${missingRequired.map((item) => item.name).join(", ")}`,
			);
		}

		const now = new Date();
		const updatedEligibility = {
			...existingEligibility,
			staffReview: {
				version: 1,
				reviewedAt: now.toISOString(),
				reviewedByUserId: input.staffUserId,
				identityConfirmed: true,
				requirements: reviews,
				passed: true,
				observations,
			},
		};

		const updatedRequests = await tx
			.update(schema.serviceRequest)
			.set({
				eligibilityResult: updatedEligibility,
				updatedAt: now,
			})
			.where(
				and(
					eq(schema.serviceRequest.id, request.id),
					eq(schema.serviceRequest.status, "confirmed"),
				),
			)
			.returning({ id: schema.serviceRequest.id });
		if (updatedRequests.length !== 1) {
			throwRpcError(
				"CONCURRENT_MODIFICATION",
				409,
				"La solicitud cambió mientras se validaban los requisitos",
			);
		}

		await tx.insert(schema.auditEvent).values(
			createAuditValues({
				actorUserId: input.staffUserId,
				entityType: "service_request",
				entityId: request.id,
				action: "desk_requirements_reviewed",
				summary: "Requisitos físicos e identidad validados en ventanilla",
				payload: {
					bookingId: safeBooking.id,
					identityConfirmed: true,
					requirements: reviews,
					observations,
				},
				ipAddress: input.ipAddress,
				userAgent: input.userAgent,
				now,
			}),
		);

		return {
			action: "reviewed" as const,
			alreadyProcessed: false,
			bookingId: safeBooking.id,
			requestId: request.id,
		};
	});
}

/**
 * Records service completion evidence and releases appointment capacity in the
 * same transaction. The request remains `confirmed` because that status means
 * the citizen confirmed the appointment; attendance lives on the booking.
 */
export async function completeStaffDeskCase(
	input: { bookingId: string } & DeskMutationContext,
) {
	if (!input.bookingId) {
		throwRpcError("MISSING_REQUIRED_FIELDS", 422, "bookingId es requerido");
	}
	const booking = await getOwnedBookingForMutation(
		input.bookingId,
		input.staffUserId,
	);

	return await db.transaction(async (tx) => {
		const currentBooking = await tx.query.booking.findFirst({
			where: eq(schema.booking.id, booking.id),
		});
		const safeBooking = assertOwnedActiveCitizenBooking(
			currentBooking,
			input.staffUserId,
		);
		const request = await tx.query.serviceRequest.findFirst({
			where: eq(schema.serviceRequest.id, safeBooking.requestId),
		});
		if (!request) {
			throwRpcError("NOT_FOUND", 404, "No se encontró la solicitud asociada");
		}

		if (
			request.status === "confirmed" &&
			safeBooking.status === "attended" &&
			!safeBooking.isActive
		) {
			return {
				action: "completed" as const,
				alreadyProcessed: true,
				bookingId: safeBooking.id,
				requestId: request.id,
			};
		}

		assertCurrentBooking(safeBooking, request);
		assertOperationalDate(booking.slotDate);
		assertActiveBooking(safeBooking);
		if (safeBooking.status !== "confirmed") {
			throwRpcError(
				"INVALID_STATE",
				422,
				"La cita debe estar confirmada antes de completar el trámite",
			);
		}
		if (request.status !== "confirmed") {
			throwRpcError(
				"INVALID_STATE",
				422,
				"Primero valida los requisitos físicos antes de completar el trámite",
			);
		}

		const staffReview = isRecord(request.eligibilityResult)
			? request.eligibilityResult.staffReview
			: null;
		if (
			!isRecord(staffReview) ||
			staffReview.passed !== true ||
			staffReview.identityConfirmed !== true
		) {
			throwRpcError(
				"ELIGIBILITY_FAILED",
				422,
				"No hay una validación aprobada de requisitos para esta solicitud",
			);
		}

		const now = new Date();
		const updatedBookings = await tx
			.update(schema.booking)
			.set({
				status: "attended",
				isActive: false,
				attendedAt: now,
				statusReason: "Service attended and completed at staff desk",
				updatedAt: now,
			})
			.where(
				and(
					eq(schema.booking.id, safeBooking.id),
					eq(schema.booking.isActive, true),
					eq(schema.booking.status, "confirmed"),
				),
			)
			.returning({ id: schema.booking.id });
		if (updatedBookings.length !== 1) {
			throwRpcError(
				"CONCURRENT_MODIFICATION",
				409,
				"La cita cambió mientras se completaba la atención",
			);
		}

		const clearedRequests = await tx
			.update(schema.serviceRequest)
			.set({ activeBookingId: null, updatedAt: now })
			.where(
				and(
					eq(schema.serviceRequest.id, request.id),
					eq(schema.serviceRequest.activeBookingId, safeBooking.id),
				),
			)
			.returning({ id: schema.serviceRequest.id });
		if (clearedRequests.length !== 1) {
			throwRpcError(
				"CONCURRENT_MODIFICATION",
				409,
				"No se pudo liberar la cita vigente de la solicitud",
			);
		}

		await tx.insert(schema.auditEvent).values([
			createAuditValues({
				actorUserId: input.staffUserId,
				entityType: "service_request",
				entityId: request.id,
				action: "desk_service_completed",
				summary: "Trámite completado por el funcionario de atención",
				payload: { bookingId: safeBooking.id },
				ipAddress: input.ipAddress,
				userAgent: input.userAgent,
				now,
			}),
			createAuditValues({
				actorUserId: input.staffUserId,
				entityType: "booking",
				entityId: safeBooking.id,
				action: "desk_attendance_completed",
				summary: "Atención finalizada; el cupo deja de consumir capacidad",
				payload: { requestId: request.id },
				ipAddress: input.ipAddress,
				userAgent: input.userAgent,
				now,
			}),
		]);

		return {
			action: "completed" as const,
			alreadyProcessed: false,
			bookingId: safeBooking.id,
			requestId: request.id,
		};
	});
}

/**
 * Closes a service request that cannot continue (for example, a no-show or
 * missing physical requirement) and releases the capacity atomically.
 */
export async function cancelStaffDeskCase(
	input: { bookingId: string; reason: string } & DeskMutationContext,
) {
	if (!input.bookingId) {
		throwRpcError("MISSING_REQUIRED_FIELDS", 422, "bookingId es requerido");
	}
	const reason = normalizeOptionalText(
		input.reason,
		"reason",
		MAX_CANCELLATION_REASON_LENGTH,
	);
	if (!reason || reason.length < 3) {
		throwRpcError(
			"INVALID_INPUT",
			422,
			"Indica una razón de al menos 3 caracteres para cerrar la atención",
		);
	}
	const booking = await getOwnedBookingForMutation(
		input.bookingId,
		input.staffUserId,
	);

	return await db.transaction(async (tx) => {
		const currentBooking = await tx.query.booking.findFirst({
			where: eq(schema.booking.id, booking.id),
		});
		const safeBooking = assertOwnedActiveCitizenBooking(
			currentBooking,
			input.staffUserId,
		);
		const request = await tx.query.serviceRequest.findFirst({
			where: eq(schema.serviceRequest.id, safeBooking.requestId),
		});
		if (!request) {
			throwRpcError("NOT_FOUND", 404, "No se encontró la solicitud asociada");
		}

		if (
			request.status === "cancelled" &&
			safeBooking.status === "cancelled" &&
			!safeBooking.isActive
		) {
			return {
				action: "cancelled" as const,
				alreadyProcessed: true,
				bookingId: safeBooking.id,
				requestId: request.id,
			};
		}

		assertCurrentBooking(safeBooking, request);
		assertOperationalDate(booking.slotDate);
		assertActiveBooking(safeBooking);
		if (safeBooking.status !== "confirmed" || request.status !== "confirmed") {
			throwRpcError(
				"INVALID_STATE",
				422,
				"La cita no está disponible para cerrar la atención",
			);
		}

		const now = new Date();
		const updatedRequests = await tx
			.update(schema.serviceRequest)
			.set({
				status: "cancelled",
				cancelledAt: now,
				activeBookingId: null,
				updatedAt: now,
			})
			.where(
				and(
					eq(schema.serviceRequest.id, request.id),
					eq(schema.serviceRequest.status, "confirmed"),
					eq(schema.serviceRequest.activeBookingId, safeBooking.id),
				),
			)
			.returning({ id: schema.serviceRequest.id });
		if (updatedRequests.length !== 1) {
			throwRpcError(
				"CONCURRENT_MODIFICATION",
				409,
				"La solicitud cambió mientras se cerraba la atención",
			);
		}
		const updatedBookings = await tx
			.update(schema.booking)
			.set({
				status: "cancelled",
				isActive: false,
				cancelledAt: now,
				statusReason: reason,
				updatedAt: now,
			})
			.where(
				and(
					eq(schema.booking.id, safeBooking.id),
					eq(schema.booking.status, "confirmed"),
					eq(schema.booking.isActive, true),
				),
			)
			.returning({ id: schema.booking.id });
		if (updatedBookings.length !== 1) {
			throwRpcError(
				"CONCURRENT_MODIFICATION",
				409,
				"La cita cambió mientras se cerraba la atención",
			);
		}
		await tx.insert(schema.auditEvent).values([
			createAuditValues({
				actorUserId: input.staffUserId,
				entityType: "service_request",
				entityId: request.id,
				action: "desk_service_cancelled",
				summary: "Atención cerrada sin completar el trámite",
				payload: { bookingId: safeBooking.id, reason },
				ipAddress: input.ipAddress,
				userAgent: input.userAgent,
				now,
			}),
			createAuditValues({
				actorUserId: input.staffUserId,
				entityType: "booking",
				entityId: safeBooking.id,
				action: "desk_booking_cancelled",
				summary: "Cita cancelada desde la mesa de atención",
				payload: { requestId: request.id, reason },
				ipAddress: input.ipAddress,
				userAgent: input.userAgent,
				now,
			}),
		]);

		return {
			action: "cancelled" as const,
			alreadyProcessed: false,
			bookingId: safeBooking.id,
			requestId: request.id,
		};
	});
}
