import { and, eq, inArray, lte } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../../lib/db";
import { logger } from "../../lib/logger";
import { throwCapacityConflict, throwRpcError } from "../../orpc/shared";
import { createAuditEvent, buildBookingSummary } from "../audit/audit.service";
import {
	confirmExistingBooking,
	createBooking,
} from "../bookings/bookings-mutations.service";
import { releaseCapacity } from "../bookings/capacity-consume.service";
import { checkCapacity } from "../bookings/capacity-check.service";
import {
	sendBookingCancellationEmail,
	sendBookingConfirmationEmail,
	sendHoldExpirationEmail,
} from "../notifications/notification.service";
import type { TemplateContext } from "../notifications/notification-templates";
import { isValidDateFormat } from "../schedule/schedule.schemas";
import { formatDateLocal } from "../schedule/schedule.service";
import { listScheduleSlotsByDate } from "../schedule/schedule-slots-admin.service";

// Zod schemas for input validation
const dateStringSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD")
	.refine((value) => isValidDateFormat(value), "must be a valid calendar date");

const listSlotsSchema = z.object({
	dateFrom: dateStringSchema.optional(),
	days: z.number().int().positive().max(21).optional().default(7),
});

const createHoldSchema = z.object({
	procedureTypeId: z.string().trim().min(1, "procedureTypeId is required"),
	slotId: z.string().trim().min(1, "slotId is required"),
	plate: z.string().optional(),
	applicantName: z.string().trim().min(1, "applicantName is required"),
	applicantDocument: z.string().trim().min(1, "applicantDocument is required"),
	documentType: z.string().optional(),
	phone: z.string().optional(),
	email: z.string().trim().email().optional(),
	notes: z.string().optional(),
});

const CITIZEN_HOLD_DURATION_MS = 5 * 60 * 1000;
const MAX_SLOTS_RANGE_DAYS = 21;

type SlotWithCapacity = Awaited<
	ReturnType<typeof listScheduleSlotsByDate>
>["slots"][number];

type UserSessionLike = {
	id: string;
	email: string;
	name: string;
	phone?: string | null;
};

export type ListCitizenSlotsRangeInput = {
	dateFrom?: string;
	days?: number;
};

export type CreateCitizenHoldInput = {
	procedureTypeId: string;
	slotId: string;
	plate?: string;
	applicantName: string;
	applicantDocument: string;
	documentType?: string;
	phone?: string;
	email?: string;
	notes?: string;
};

export type CitizenBookingSummary = {
	id: string;
	status: string;
	isActive: boolean;
	holdExpiresAt: string | Date | null;
	confirmedAt: string | Date | null;
	cancelledAt: string | Date | null;
	createdAt: string | Date;
	updatedAt: string | Date;
	slot: {
		id: string;
		slotDate: string;
		startTime: string;
		endTime: string;
		status: string;
	} | null;
	request: {
		id: string;
		status: string;
		plate: string | null;
		applicantName: string | null;
		applicantDocument: string | null;
		procedure: {
			id: string;
			slug: string;
			name: string;
			description: string | null;
		} | null;
	} | null;
};

const normalizeDateFrom = (value?: string): string => {
	if (!value) return formatDateLocal(new Date());
	const result = dateStringSchema.safeParse(value);
	if (!result.success) {
		throwRpcError(
			"INVALID_DATE",
			422,
			"dateFrom must be a valid YYYY-MM-DD calendar date",
		);
	}
	return result.data;
};

const normalizeRangeDays = (value?: number): number => {
	const result = z
		.number()
		.int()
		.positive()
		.max(MAX_SLOTS_RANGE_DAYS)
		.safeParse(value ?? 7);
	if (!result.success) {
		throwRpcError(
			"INVALID_RANGE",
			422,
			`days must be a positive integer <= ${MAX_SLOTS_RANGE_DAYS}`,
		);
	}
	return result.data;
};

const listDateRange = (dateFrom: string, days: number): string[] => {
	const fromDate = new Date(`${dateFrom}T00:00:00`);
	return Array.from({ length: days }, (_, index) => {
		const date = new Date(fromDate);
		date.setDate(fromDate.getDate() + index);
		return formatDateLocal(date);
	});
};

export async function expireStaleCitizenHolds() {
	const now = new Date();
	const staleHolds = await db.query.booking.findMany({
		where: and(
			eq(schema.booking.kind, "citizen"),
			eq(schema.booking.status, "held"),
			eq(schema.booking.isActive, true),
			lte(schema.booking.holdExpiresAt, now),
		),
	});

	if (staleHolds.length === 0) {
		return 0;
	}

	// Send expiration emails and release capacity for each stale hold
	await Promise.all(
		staleHolds.map(async (booking) => {
			// Send hold expiration email (non-blocking, errors logged but not thrown)
			try {
				const citizenUser = booking.citizenUserId
					? await db.query.user.findFirst({
							where: eq(schema.user.id, booking.citizenUserId),
						})
					: null;

				if (citizenUser?.email) {
					const context = await buildNotificationContext(booking);
					await sendHoldExpirationEmail({
						bookingId: booking.id,
						recipient: citizenUser.email,
						context,
					});
				}
			} catch (error) {
				logger.error(
					{ err: error, bookingId: booking.id },
					"Failed to send hold expiration email",
				);
				// Do not throw - release should still proceed
			}

			// Release the capacity
			await releaseCapacity(booking.id, "expired");
		}),
	);

	return staleHolds.length;
}

const listActiveAssignableStaff = async () => {
	const staffRows = await db
		.select({
			userId: schema.staffProfile.userId,
		})
		.from(schema.staffProfile)
		.innerJoin(schema.user, eq(schema.staffProfile.userId, schema.user.id))
		.where(
			and(
				eq(schema.staffProfile.isActive, true),
				eq(schema.staffProfile.isAssignable, true),
			),
		);

	return staffRows;
};

const pickStaffForSlot = async (slotId: string) => {
	const staffProfiles = await listActiveAssignableStaff();
	if (staffProfiles.length === 0) {
		throwRpcError(
			"NO_STAFF_AVAILABLE",
			409,
			"No hay funcionarios asignables disponibles",
		);
	}

	const capacityChecks = await Promise.all(
		staffProfiles.map(async (staffProfile) => {
			return {
				staffUserId: staffProfile.userId,
				capacity: await checkCapacity(slotId, staffProfile.userId),
			};
		}),
	);

	const availableCandidates = capacityChecks
		.filter((candidate) => candidate.capacity.available)
		.toSorted((a, b) => {
			const byStaffRemaining =
				b.capacity.staffRemaining - a.capacity.staffRemaining;
			if (byStaffRemaining !== 0) return byStaffRemaining;

			const aGlobal =
				a.capacity.globalRemaining === null
					? Number.MAX_SAFE_INTEGER
					: a.capacity.globalRemaining;
			const bGlobal =
				b.capacity.globalRemaining === null
					? Number.MAX_SAFE_INTEGER
					: b.capacity.globalRemaining;
			return bGlobal - aGlobal;
		});

	if (availableCandidates.length === 0) {
		const sampleConflicts =
			capacityChecks.find(
				(candidate) => candidate.capacity.conflicts.length > 0,
			)?.capacity.conflicts ?? [];
		throwCapacityConflict(
			sampleConflicts,
			"No encontramos disponibilidad operativa para este horario",
		);
	}

	return availableCandidates[0].staffUserId;
};

const mapBookingSummaries = async (
	bookings: Array<typeof schema.booking.$inferSelect>,
): Promise<CitizenBookingSummary[]> => {
	if (bookings.length === 0) {
		return [];
	}

	const slotIds = [...new Set(bookings.map((booking) => booking.slotId))];
	const requestIds = [
		...new Set(
			bookings
				.map((booking) => booking.requestId)
				.filter((requestId): requestId is string => Boolean(requestId)),
		),
	];

	const slots =
		slotIds.length > 0
			? await db.query.appointmentSlot.findMany({
					where: inArray(schema.appointmentSlot.id, slotIds),
				})
			: [];
	const requests =
		requestIds.length > 0
			? await db.query.serviceRequest.findMany({
					where: inArray(schema.serviceRequest.id, requestIds),
				})
			: [];
	const procedureTypeIds = [
		...new Set(requests.map((request) => request.procedureTypeId)),
	];
	const procedures =
		procedureTypeIds.length > 0
			? await db.query.procedureType.findMany({
					where: inArray(schema.procedureType.id, procedureTypeIds),
				})
			: [];

	const slotById = new Map(slots.map((slot) => [slot.id, slot]));
	const requestById = new Map(requests.map((request) => [request.id, request]));
	const procedureById = new Map(
		procedures.map((procedure) => [procedure.id, procedure]),
	);

	return bookings.map((booking) => {
		const slot = slotById.get(booking.slotId) ?? null;
		const request = booking.requestId
			? (requestById.get(booking.requestId) ?? null)
			: null;
		const procedure = request?.procedureTypeId
			? (procedureById.get(request.procedureTypeId) ?? null)
			: null;
		const draftData =
			request?.draftData && typeof request.draftData === "object"
				? (request.draftData as Record<string, unknown>)
				: null;

		return {
			id: booking.id,
			status: booking.status,
			isActive: booking.isActive,
			holdExpiresAt: booking.holdExpiresAt,
			confirmedAt: booking.confirmedAt,
			cancelledAt: booking.cancelledAt,
			createdAt: booking.createdAt,
			updatedAt: booking.updatedAt,
			slot: slot
				? {
						id: slot.id,
						slotDate: slot.slotDate,
						startTime: slot.startTime,
						endTime: slot.endTime,
						status: slot.status,
					}
				: null,
			request: request
				? {
						id: request.id,
						status: request.status,
						plate:
							typeof draftData?.plate === "string" ? draftData.plate : null,
						applicantName:
							typeof draftData?.applicantName === "string"
								? draftData.applicantName
								: null,
						applicantDocument:
							typeof draftData?.applicantDocument === "string"
								? draftData.applicantDocument
								: null,
						procedure: procedure
							? {
									id: procedure.id,
									slug: procedure.slug,
									name: procedure.name,
									description: procedure.description,
								}
							: null,
					}
				: null,
		};
	});
};

const getOwnedCitizenBooking = async (userId: string, bookingId: string) => {
	const booking = await db.query.booking.findFirst({
		where: and(
			eq(schema.booking.id, bookingId),
			eq(schema.booking.kind, "citizen"),
			eq(schema.booking.citizenUserId, userId),
		),
	});

	if (!booking) {
		throwRpcError("NOT_FOUND", 404, "Reserva ciudadana no encontrada");
	}

	return booking;
};

const getBookingSummaryById = async (bookingId: string) => {
	const booking = await db.query.booking.findFirst({
		where: eq(schema.booking.id, bookingId),
	});

	if (!booking) {
		throwRpcError("NOT_FOUND", 404, "Reserva no encontrada");
	}

	const summaries = await mapBookingSummaries([booking]);
	return summaries[0];
};

/**
 * Build the notification template context from a booking.
 * Used for sending confirmation and cancellation emails.
 */
const buildNotificationContext = async (
	booking: typeof schema.booking.$inferSelect,
): Promise<TemplateContext> => {
	const slot = await db.query.appointmentSlot.findFirst({
		where: eq(schema.appointmentSlot.id, booking.slotId),
	});

	const procedure = booking.requestId
		? await db.query.serviceRequest.findFirst({
				where: eq(schema.serviceRequest.id, booking.requestId),
				with: {
					procedureType: true,
				},
			})
		: null;

	const staffUser = booking.staffUserId
		? await db.query.user.findFirst({
				where: eq(schema.user.id, booking.staffUserId),
			})
		: null;

	const citizenUser = booking.citizenUserId
		? await db.query.user.findFirst({
				where: eq(schema.user.id, booking.citizenUserId),
			})
		: null;

	const draftData =
		procedure?.draftData && typeof procedure.draftData === "object"
			? (procedure.draftData as Record<string, unknown>)
			: null;

	return {
		procedureName: procedure?.procedureType?.name ?? "Trámite",
		appointmentDate: slot?.slotDate ?? "",
		appointmentTime: slot?.startTime ?? "",
		appointmentEndTime: slot?.endTime,
		staffName: staffUser?.name ?? null,
		citizenName: citizenUser?.name ?? null,
		bookingId: booking.id,
		serviceRequest: {
			applicantName:
				typeof draftData?.applicantName === "string"
					? draftData.applicantName
					: null,
			applicantDocument:
				typeof draftData?.applicantDocument === "string"
					? draftData.applicantDocument
					: null,
			plate: typeof draftData?.plate === "string" ? draftData.plate : null,
		},
	};
};

export async function listCitizenProcedures() {
	const procedures = await db.query.procedureType.findMany({
		where: eq(schema.procedureType.isActive, true),
		orderBy: (procedureType, { asc }) => [asc(procedureType.name)],
	});

	return procedures.map((procedure) => ({
		...procedure,
		allowsDigitalDocuments: false,
	}));
}

export async function listCitizenSlotsRange(
	input?: ListCitizenSlotsRangeInput,
) {
	await expireStaleCitizenHolds();

	const dateFrom = normalizeDateFrom(input?.dateFrom);
	const days = normalizeRangeDays(input?.days);
	const dates = listDateRange(dateFrom, days);
	const dailyResponses = await Promise.all(
		dates.map(async (date) => {
			const day = await listScheduleSlotsByDate(date);
			const slots = day.slots.filter(
				(slot: SlotWithCapacity) =>
					slot.status === "open" &&
					(slot.remainingCapacity === null || slot.remainingCapacity > 0),
			);

			return {
				date: day.date,
				isClosed: day.isClosed,
				generatedFrom: day.generatedFrom,
				count: slots.length,
				slots,
			};
		}),
	);

	return {
		dateFrom,
		dateTo: dates[dates.length - 1] ?? dateFrom,
		days,
		daily: dailyResponses,
	};
}

export async function createCitizenBookingHold(
	user: UserSessionLike,
	input: CreateCitizenHoldInput,
) {
	await expireStaleCitizenHolds();

	const parsedInput = createHoldSchema.safeParse(input);
	if (!parsedInput.success) {
		const issue = parsedInput.error.issues[0];
		throwRpcError(
			"MISSING_REQUIRED_FIELDS",
			422,
			`${issue.path.join(".")}: ${issue.message}`,
		);
	}
	const validatedInput = parsedInput.data;

	const procedure = await db.query.procedureType.findFirst({
		where: and(
			eq(schema.procedureType.id, validatedInput.procedureTypeId),
			eq(schema.procedureType.isActive, true),
		),
	});

	if (!procedure) {
		throwRpcError("NOT_FOUND", 404, "Trámite no disponible");
	}

	if (procedure.requiresVehicle && !validatedInput.plate?.trim()) {
		throwRpcError(
			"MISSING_REQUIRED_FIELDS",
			422,
			"plate is required for this procedure",
		);
	}

	const slot = await db.query.appointmentSlot.findFirst({
		where: eq(schema.appointmentSlot.id, validatedInput.slotId),
	});

	if (!slot || slot.status !== "open") {
		throwRpcError("NOT_FOUND", 404, "Horario no disponible");
	}

	const staffUserId = await pickStaffForSlot(validatedInput.slotId);
	const now = new Date();
	const holdExpiresAt = new Date(now.getTime() + CITIZEN_HOLD_DURATION_MS);
	const requestId = crypto.randomUUID();

	await db.insert(schema.serviceRequest).values({
		id: requestId,
		procedureTypeId: procedure.id,
		citizenUserId: user.id,
		email: (validatedInput.email ?? user.email).trim().toLowerCase(),
		phone: validatedInput.phone?.trim() || user.phone || null,
		documentType: validatedInput.documentType?.trim() || "CC",
		documentNumber: validatedInput.applicantDocument.trim(),
		documentMode: "physical_only",
		status: "booking_held",
		procedureConfigVersion: procedure.configVersion,
		draftData: {
			plate: validatedInput.plate?.trim().toUpperCase() ?? null,
			applicantName: validatedInput.applicantName.trim(),
			applicantDocument: validatedInput.applicantDocument.trim(),
			notes: validatedInput.notes?.trim() ?? null,
		},
		procedureSnapshot: {
			id: procedure.id,
			slug: procedure.slug,
			name: procedure.name,
			description: procedure.description,
			configVersion: procedure.configVersion,
			requiresVehicle: procedure.requiresVehicle,
			instructions: procedure.instructions,
			documentSchema: procedure.documentSchema,
			formSchema: procedure.formSchema,
			eligibilitySchema: procedure.eligibilitySchema,
			policySchema: procedure.policySchema,
		},
		requirementsSnapshot: procedure.documentSchema ?? {},
		verifiedAt: now,
		createdAt: now,
		updatedAt: now,
	});

	let booking: Awaited<ReturnType<typeof createBooking>>;
	try {
		booking = await createBooking({
			input: {
				slotId: validatedInput.slotId,
				staffUserId,
				kind: "citizen",
				requestId,
				citizenUserId: user.id,
				holdExpiresAt: holdExpiresAt.toISOString(),
			},
			createdByUserId: user.id,
		});
	} catch (error) {
		await db
			.delete(schema.serviceRequest)
			.where(eq(schema.serviceRequest.id, requestId));

		const message = error instanceof Error ? error.message : String(error);
		logger.error(
			{
				err: error,
				userId: user.id,
				slotId: validatedInput.slotId,
				procedureTypeId: validatedInput.procedureTypeId,
				staffUserId,
				requestId,
			},
			"Citizen hold creation failed",
		);

		if (message.includes("FOREIGN KEY constraint failed")) {
			throwRpcError(
				"NO_STAFF_AVAILABLE",
				409,
				"No encontramos disponibilidad operativa para este horario",
			);
		}

		throw error;
	}

	if (!booking) {
		throwRpcError(
			"INTERNAL_ERROR",
			500,
			"No se pudo materializar la reserva temporal",
		);
	}

	return {
		requestId,
		booking: await getBookingSummaryById(booking.id),
	};
}

export async function confirmCitizenBooking(userId: string, bookingId: string) {
	await expireStaleCitizenHolds();
	const booking = await getOwnedCitizenBooking(userId, bookingId);
	const confirmedBooking = await confirmExistingBooking(booking.id);

	if (!confirmedBooking) {
		throwRpcError("NOT_FOUND", 404, "Reserva no encontrada");
	}

	if (booking.requestId) {
		await db
			.update(schema.serviceRequest)
			.set({
				status: "confirmed",
				confirmedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(schema.serviceRequest.id, booking.requestId));
	}

	// Send confirmation email notification (non-blocking, errors logged but not thrown)
	try {
		const citizenUser = booking.citizenUserId
			? await db.query.user.findFirst({
					where: eq(schema.user.id, booking.citizenUserId),
				})
			: null;

		if (citizenUser?.email) {
			const context = await buildNotificationContext(booking);
			await sendBookingConfirmationEmail({
				bookingId: booking.id,
				recipient: citizenUser.email,
				context,
			});
		}
	} catch (error) {
		logger.error(
			{ err: error, bookingId, userId },
			"Failed to send booking confirmation email",
		);
		// Do not throw - confirmation succeeded, email is secondary
	}

	return await getBookingSummaryById(booking.id);
}

export async function cancelCitizenBooking(
	userId: string,
	bookingId: string,
	options?: { ipAddress?: string | null; userAgent?: string | null },
) {
	await expireStaleCitizenHolds();
	const booking = await getOwnedCitizenBooking(userId, bookingId);

	await releaseCapacity(booking.id, "cancelled");

	if (booking.requestId) {
		await db
			.update(schema.serviceRequest)
			.set({
				status: "cancelled",
				cancelledAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(schema.serviceRequest.id, booking.requestId));
	}

	// Create audit event for booking cancellation
	const staffUser = booking.staffUserId
		? await db.query.user.findFirst({
				where: eq(schema.user.id, booking.staffUserId),
			})
		: null;
	const citizenUser = booking.citizenUserId
		? await db.query.user.findFirst({
				where: eq(schema.user.id, booking.citizenUserId),
			})
		: null;
	const slot = await db.query.appointmentSlot.findFirst({
		where: eq(schema.appointmentSlot.id, booking.slotId),
	});

	await createAuditEvent({
		actorType: "citizen",
		actorUserId: userId,
		entityType: "booking",
		entityId: booking.id,
		action: "cancel",
		summary: buildBookingSummary("cancelled", booking.id, {
			kind: booking.kind,
			status: "cancelled",
			slotDate: slot?.slotDate,
			startTime: slot?.startTime,
			staffName: staffUser?.name,
			citizenName: citizenUser?.name,
			reason: "cancelled",
		}),
		payload: {
			slotId: booking.slotId,
			staffUserId: booking.staffUserId,
			kind: booking.kind,
			reason: "cancelled",
		},
		ipAddress: options?.ipAddress ?? null,
		userAgent: options?.userAgent ?? null,
	});

	// Send cancellation email notification (non-blocking, errors logged but not thrown)
	try {
		if (citizenUser?.email) {
			const context = await buildNotificationContext(booking);
			await sendBookingCancellationEmail({
				bookingId: booking.id,
				recipient: citizenUser.email,
				context,
			});
		}
	} catch (error) {
		logger.error(
			{ err: error, bookingId, userId },
			"Failed to send booking cancellation email",
		);
		// Do not throw - cancellation succeeded, email is secondary
	}

	return await getBookingSummaryById(booking.id);
}

export async function listCitizenBookings(
	userId: string,
	includeInactive = true,
) {
	await expireStaleCitizenHolds();

	const whereConditions = [
		eq(schema.booking.citizenUserId, userId),
		eq(schema.booking.kind, "citizen"),
	];
	if (!includeInactive) {
		whereConditions.push(eq(schema.booking.isActive, true));
	}

	const bookings = await db.query.booking.findMany({
		where: and(...whereConditions),
		orderBy: (booking, { desc: descOrder }) => [descOrder(booking.createdAt)],
	});

	return await mapBookingSummaries(bookings);
}
