import { randomUUID } from "node:crypto";
import { eq, inArray, like } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { db, schema } from "../../lib/db";
import {
	cancelStaffDeskCase,
	checkInStaffDeskCase,
	completeStaffDeskCase,
	getStaffDeskQueue,
	reviewStaffDeskCase,
} from "./staff-desk.service";

const createdIds = {
	users: [] as string[],
	procedures: [] as string[],
	requests: [] as string[],
	bookings: [] as string[],
	slots: [] as string[],
};
let slotSequence = 0;

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

function getTimeFromMinutes(totalMinutes: number) {
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

async function createUser(name: string, role: string) {
	const id = randomUUID();
	createdIds.users.push(id);
	await db.insert(schema.user).values({
		id,
		name,
		email: `${id}@example.com`,
		emailVerified: true,
		role,
	});
	return id;
}

async function createStaff(name: string) {
	const userId = await createUser(name, "staff");
	await db.insert(schema.staffProfile).values({
		userId,
		isActive: true,
		isAssignable: true,
		defaultDailyCapacity: 10,
	});
	return userId;
}

async function createDeskCase(input: {
	staffUserId: string;
	date?: string;
	requirements?: Array<{ id: string; name: string; isRequired?: boolean }>;
}) {
	const citizenId = await createUser("Ciudadana de prueba", "citizen");
	const procedureId = randomUUID();
	createdIds.procedures.push(procedureId);
	const requirements = input.requirements ?? [
		{ id: "identity", name: "Documento de identidad" },
	];
	await db.insert(schema.procedureType).values({
		id: procedureId,
		slug: `desk-${procedureId}`,
		name: "Trámite de ventanilla",
		isActive: true,
		documentSchema: { requirements },
	});

	const startMinutes = 540 + slotSequence * 10;
	slotSequence += 1;
	const slotId = randomUUID();
	createdIds.slots.push(slotId);
	await db.insert(schema.appointmentSlot).values({
		id: slotId,
		slotDate: input.date ?? getBogotaIsoDate(),
		startTime: getTimeFromMinutes(startMinutes),
		endTime: getTimeFromMinutes(startMinutes + 10),
		status: "open",
	});

	const requestId = randomUUID();
	createdIds.requests.push(requestId);
	await db.insert(schema.serviceRequest).values({
		id: requestId,
		procedureTypeId: procedureId,
		citizenUserId: citizenId,
		email: "ciudadana@example.com",
		documentType: "CC",
		documentNumber: "123456789",
		status: "confirmed",
		draftData: { applicantName: "Ciudadana de prueba" },
		procedureSnapshot: {
			name: "Trámite de ventanilla",
			instructions: "Presenta los documentos originales.",
		},
		requirementsSnapshot: { requirements },
		confirmedAt: new Date(),
	});

	const bookingId = randomUUID();
	createdIds.bookings.push(bookingId);
	await db.insert(schema.booking).values({
		id: bookingId,
		slotId,
		requestId,
		citizenUserId: citizenId,
		staffUserId: input.staffUserId,
		kind: "citizen",
		status: "confirmed",
		isActive: true,
		confirmedAt: new Date(),
	});
	await db
		.update(schema.serviceRequest)
		.set({ activeBookingId: bookingId })
		.where(eq(schema.serviceRequest.id, requestId));

	return { bookingId, requestId };
}

async function cleanupTrackedData() {
	if (createdIds.requests.length > 0) {
		await db
			.update(schema.serviceRequest)
			.set({ activeBookingId: null })
			.where(inArray(schema.serviceRequest.id, createdIds.requests));
	}
	if (createdIds.users.length > 0) {
		await db
			.delete(schema.auditEvent)
			.where(inArray(schema.auditEvent.actorUserId, createdIds.users));
	}
	if (createdIds.bookings.length > 0) {
		await db
			.delete(schema.booking)
			.where(inArray(schema.booking.id, createdIds.bookings));
	}
	if (createdIds.requests.length > 0) {
		await db
			.delete(schema.serviceRequest)
			.where(inArray(schema.serviceRequest.id, createdIds.requests));
	}
	if (createdIds.slots.length > 0) {
		await db
			.delete(schema.appointmentSlot)
			.where(inArray(schema.appointmentSlot.id, createdIds.slots));
	}
	if (createdIds.procedures.length > 0) {
		await db
			.delete(schema.procedureType)
			.where(inArray(schema.procedureType.id, createdIds.procedures));
	}
	if (createdIds.users.length > 0) {
		await db
			.delete(schema.staffProfile)
			.where(inArray(schema.staffProfile.userId, createdIds.users));
		await db
			.delete(schema.user)
			.where(inArray(schema.user.id, createdIds.users));
	}
	for (const ids of Object.values(createdIds)) ids.length = 0;
}

beforeEach(async () => {
	const staleProcedures = await db.query.procedureType.findMany({
		where: like(schema.procedureType.slug, "desk-%"),
	});
	if (staleProcedures.length > 0) {
		const procedureIds = staleProcedures.map((procedure) => procedure.id);
		const staleRequests = await db.query.serviceRequest.findMany({
			where: inArray(schema.serviceRequest.procedureTypeId, procedureIds),
		});
		const requestIds = staleRequests.map((request) => request.id);
		if (requestIds.length > 0) {
			const staleBookings = await db.query.booking.findMany({
				where: inArray(schema.booking.requestId, requestIds),
			});
			const staleSlotIds = staleBookings.map((booking) => booking.slotId);
			await db
				.update(schema.serviceRequest)
				.set({ activeBookingId: null })
				.where(inArray(schema.serviceRequest.id, requestIds));
			await db
				.delete(schema.booking)
				.where(inArray(schema.booking.requestId, requestIds));
			await db
				.delete(schema.serviceRequest)
				.where(inArray(schema.serviceRequest.id, requestIds));
			if (staleSlotIds.length > 0) {
				await db
					.delete(schema.appointmentSlot)
					.where(inArray(schema.appointmentSlot.id, staleSlotIds));
			}
		}
		await db
			.delete(schema.procedureType)
			.where(inArray(schema.procedureType.id, procedureIds));
	}
	await cleanupTrackedData();
});

afterEach(async () => {
	await cleanupTrackedData();
});

describe("staff desk workflow", () => {
	test("returns only the cases assigned to the current staff member", async () => {
		const assignedStaffId = await createStaff("Funcionaria asignada");
		const otherStaffId = await createStaff("Funcionario no asignado");
		const ownCase = await createDeskCase({ staffUserId: assignedStaffId });
		await createDeskCase({ staffUserId: otherStaffId });

		const queue = await getStaffDeskQueue({
			staffUserId: assignedStaffId,
			date: getBogotaIsoDate(),
		});

		expect(queue.cases).toHaveLength(1);
		expect(queue.cases[0]?.id).toBe(ownCase.bookingId);
		expect(queue.cases[0]?.request.requirements[0]?.name).toBe(
			"Documento de identidad",
		);
	});

	test("records check-in, physical review, and completion atomically", async () => {
		const staffUserId = await createStaff("Funcionaria de atención");
		const deskCase = await createDeskCase({ staffUserId });

		await checkInStaffDeskCase({ bookingId: deskCase.bookingId, staffUserId });
		let booking = await db.query.booking.findFirst({
			where: eq(schema.booking.id, deskCase.bookingId),
		});
		let request = await db.query.serviceRequest.findFirst({
			where: eq(schema.serviceRequest.id, deskCase.requestId),
		});
		expect(booking?.status).toBe("confirmed");
		expect(request).toMatchObject({
			status: "confirmed",
			eligibilityResult: {
				staffCheckIn: {
					checkedInByUserId: staffUserId,
				},
			},
		});

		await reviewStaffDeskCase({
			bookingId: deskCase.bookingId,
			staffUserId,
			identityConfirmed: true,
			requirements: [{ id: "identity", present: true }],
			observations: "Se presentó el original vigente.",
		});
		request = await db.query.serviceRequest.findFirst({
			where: eq(schema.serviceRequest.id, deskCase.requestId),
		});
		expect(request?.status).toBe("confirmed");
		expect(request?.eligibilityResult).toMatchObject({
			staffReview: { passed: true, identityConfirmed: true },
		});

		await completeStaffDeskCase({ bookingId: deskCase.bookingId, staffUserId });
		booking = await db.query.booking.findFirst({
			where: eq(schema.booking.id, deskCase.bookingId),
		});
		request = await db.query.serviceRequest.findFirst({
			where: eq(schema.serviceRequest.id, deskCase.requestId),
		});
		expect(booking).toMatchObject({ status: "attended", isActive: false });
		expect(request).toMatchObject({
			status: "confirmed",
			activeBookingId: null,
		});

		const auditEntries = await db.query.auditEvent.findMany({
			where: eq(schema.auditEvent.actorUserId, staffUserId),
		});
		expect(auditEntries.map((entry) => entry.action)).toEqual(
			expect.arrayContaining([
				"desk_check_in",
				"desk_requirements_reviewed",
				"desk_service_completed",
				"desk_attendance_completed",
			]),
		);
	});

	test("does not advance a case with a required physical document missing", async () => {
		const staffUserId = await createStaff("Funcionaria de revisión");
		const deskCase = await createDeskCase({
			staffUserId,
			requirements: [
				{ id: "identity", name: "Documento de identidad" },
				{ id: "form", name: "Formulario firmado" },
			],
		});
		await checkInStaffDeskCase({ bookingId: deskCase.bookingId, staffUserId });

		await expect(
			reviewStaffDeskCase({
				bookingId: deskCase.bookingId,
				staffUserId,
				identityConfirmed: true,
				requirements: [{ id: "identity", present: true }],
			}),
		).rejects.toThrow("Faltan requisitos obligatorios");

		const request = await db.query.serviceRequest.findFirst({
			where: eq(schema.serviceRequest.id, deskCase.requestId),
		});
		expect(request).toMatchObject({
			status: "confirmed",
			eligibilityResult: {
				staffCheckIn: {
					checkedInByUserId: staffUserId,
				},
			},
		});
	});

	test("cancels an assigned case without allowing a different staff member to operate it", async () => {
		const assignedStaffId = await createStaff("Funcionaria asignada");
		const otherStaffId = await createStaff("Funcionario no asignado");
		const deskCase = await createDeskCase({ staffUserId: assignedStaffId });

		await expect(
			cancelStaffDeskCase({
				bookingId: deskCase.bookingId,
				staffUserId: otherStaffId,
				reason: "El ciudadano no se presentó a la cita.",
			}),
		).rejects.toThrow("No se encontró una cita asignada");

		await cancelStaffDeskCase({
			bookingId: deskCase.bookingId,
			staffUserId: assignedStaffId,
			reason: "El ciudadano no se presentó a la cita.",
		});
		const booking = await db.query.booking.findFirst({
			where: eq(schema.booking.id, deskCase.bookingId),
		});
		const request = await db.query.serviceRequest.findFirst({
			where: eq(schema.serviceRequest.id, deskCase.requestId),
		});
		expect(booking).toMatchObject({ status: "cancelled", isActive: false });
		expect(request).toMatchObject({
			status: "cancelled",
			activeBookingId: null,
		});
	});

	test("does not complete a confirmed appointment before desk review", async () => {
		const staffUserId = await createStaff("Funcionaria de recepción");
		const deskCase = await createDeskCase({ staffUserId });

		await expect(
			completeStaffDeskCase({
				bookingId: deskCase.bookingId,
				staffUserId,
			}),
		).rejects.toThrow("No hay una validación aprobada");
	});

	test("keeps appointments outside the current day read-only", async () => {
		const staffUserId = await createStaff("Funcionaria de consulta");
		const deskCase = await createDeskCase({
			staffUserId,
			date: "2032-06-15",
		});

		const queue = await getStaffDeskQueue({
			staffUserId,
			date: "2032-06-15",
		});
		expect(queue.cases).toHaveLength(1);

		await expect(
			checkInStaffDeskCase({
				bookingId: deskCase.bookingId,
				staffUserId,
			}),
		).rejects.toThrow("solo puede modificarse el día de la cita");
	});
});
