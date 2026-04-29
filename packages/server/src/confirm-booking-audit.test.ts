/**
 * Integration tests for VAL-AUDIT-002: Booking confirmation creates audit event.
 *
 * Tests that confirmBooking creates an audit_event with action=confirm,
 * including proper summary and payload with booking details.
 *
 * Run with: cd server && bun test src/confirm-booking-audit.test.ts
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { db, schema } from "./lib/db";
import { confirmBooking } from "./features/bookings/capacity-consume.service";
import { consumeCapacity } from "./features/bookings/capacity-consume.service";

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

const TEST_SLOT_DATE = "2030-06-15";

const createTestUser = async (role = "admin") => {
	const userId = randomUUID();
	const email = `test_${randomUUID()}@example.com`;

	await db.insert(schema.user).values({
		id: userId,
		email,
		name: "Test User",
		emailVerified: true,
		role,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	return { id: userId, email, name: "Test User" };
};

const createTestStaffUser = async () => {
	const userId = randomUUID();
	const email = `staff_${randomUUID()}@example.com`;

	await db.insert(schema.user).values({
		id: userId,
		email,
		name: "Test Staff",
		emailVerified: true,
		role: "staff",
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	await db.insert(schema.staffProfile).values({
		userId,
		isActive: true,
		isAssignable: true,
		defaultDailyCapacity: 10,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	return { id: userId, email, name: "Test Staff" };
};

const createTestSlot = async () => {
	const id = randomUUID();
	await db.insert(schema.appointmentSlot).values({
		id,
		slotDate: TEST_SLOT_DATE,
		startTime: "10:00",
		endTime: "11:00",
		status: "open",
		capacityLimit: 10,
		generatedFrom: "base",
		createdAt: new Date(),
		updatedAt: new Date(),
	});
	return id;
};

const createTestProcedure = async () => {
	const id = randomUUID();
	await db.insert(schema.procedureType).values({
		id,
		name: "Test Procedure",
		slug: `test-${randomUUID()}`,
		isActive: true,
		configVersion: 1,
		requiresVehicle: false,
		allowsPhysicalDocuments: true,
		allowsDigitalDocuments: true,
		eligibilitySchema: {},
		formSchema: {},
		documentSchema: {},
		policySchema: {},
		createdAt: new Date(),
		updatedAt: new Date(),
	});
	return id;
};

const createTestServiceRequest = async (citizenUserId: string, procedureTypeId: string) => {
	const id = randomUUID();
	await db.insert(schema.serviceRequest).values({
		id,
		procedureTypeId,
		citizenUserId,
		email: `citizen_${randomUUID()}@example.com`,
		status: "booking_held",
		draftData: {},
		procedureSnapshot: {},
		procedureConfigVersion: 1,
		createdAt: new Date(),
		updatedAt: new Date(),
	});
	return id;
};

const cleanupTestData = async (
	bookingIds: string[],
	slotIds: string[],
	userIds: string[],
) => {
	// Clean up in order of dependencies (children first)
	// First clear activeBookingId references
	try {
		await db
			.update(schema.serviceRequest)
			.set({ activeBookingId: null })
			.where(eq(schema.serviceRequest.activeBookingId, schema.serviceRequest.activeBookingId));
	} catch {
		// Ignore
	}

	// Delete service requests that reference these bookings
	for (const id of bookingIds) {
		try {
			await db
				.delete(schema.serviceRequest)
				.where(eq(schema.serviceRequest.activeBookingId, id));
		} catch {
			// Ignore
		}
	}

	for (const id of bookingIds) {
		try {
			await db.delete(schema.booking).where(eq(schema.booking.id, id));
		} catch {
			// Ignore cleanup errors
		}
	}

	for (const slotId of slotIds) {
		try {
			await db.delete(schema.appointmentSlot).where(eq(schema.appointmentSlot.id, slotId));
		} catch {
			// Ignore
		}
	}

	for (const userId of userIds) {
		try {
			await db.delete(schema.staffProfile).where(eq(schema.staffProfile.userId, userId));
		} catch {
			// Ignore
		}
		try {
			await db.delete(schema.user).where(eq(schema.user.id, userId));
		} catch {
			// Ignore
		}
	}
};

const cleanupAuditEvents = async () => {
	await db.delete(schema.auditEvent);
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("VAL-AUDIT-002: Booking confirmation creates audit event", () => {
	const bookingIds: string[] = [];
	const slotIds: string[] = [];
	const userIds: string[] = [];

	beforeEach(async () => {
		await cleanupAuditEvents();
	});

	afterEach(async () => {
		await cleanupTestData(bookingIds, slotIds, userIds);
		await cleanupAuditEvents();
		bookingIds.length = 0;
		slotIds.length = 0;
		userIds.length = 0;
	});

	describe("confirmBooking creates audit event with action=confirm", () => {
		test("creates audit event when confirming a held booking", async () => {
			// Setup: create a citizen user, staff, slot, and a held booking
			const citizenUser = await createTestUser("citizen");
			userIds.push(citizenUser.id);

			const staffUser = await createTestStaffUser();
			userIds.push(staffUser.id);

			const slotId = await createTestSlot();
			slotIds.push(slotId);

			const procedureId = await createTestProcedure();
			const serviceRequestId = await createTestServiceRequest(citizenUser.id, procedureId);

			// Create a held booking using consumeCapacity
			const consumeResult = await consumeCapacity(
				slotId,
				staffUser.id,
				"citizen",
				serviceRequestId,
				citizenUser.id,
				citizenUser.id,
				randomUUID(),
				new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
			);

			expect(consumeResult.success).toBe(true);
			if (!consumeResult.bookingId) {
				throw new Error("Expected bookingId to be returned");
			}
			bookingIds.push(consumeResult.bookingId);

			// Verify booking is in "held" status
			const bookingBefore = await db.query.booking.findFirst({
				where: eq(schema.booking.id, consumeResult.bookingId),
			});
			expect(bookingBefore?.status).toBe("held");

			// Execute: confirm the booking
			const confirmResult = await confirmBooking(consumeResult.bookingId);

			expect(confirmResult.success).toBe(true);

			// Verify: audit event was created with action=confirm
			const auditEvents = await db.query.auditEvent.findMany({
				where: eq(schema.auditEvent.entityId, consumeResult.bookingId),
			});

			expect(auditEvents).toHaveLength(1);
			const auditEvent = auditEvents[0];
			expect(auditEvent.entityType).toBe("booking");
			expect(auditEvent.action).toBe("confirm");
			expect(auditEvent.actorType).toBe("citizen");
			expect(auditEvent.actorUserId).toBe(citizenUser.id);
			expect(auditEvent.summary).toContain("confirmed");
			expect(auditEvent.summary).toContain("citizen"); // kind
			expect(auditEvent.payload).toHaveProperty("slotId", slotId);
			expect(auditEvent.payload).toHaveProperty("staffUserId", staffUser.id);
			expect(auditEvent.payload).toHaveProperty("kind", "citizen");
			expect(auditEvent.payload?.confirmedAt).toBeDefined();
		});

		test("audit event summary contains booking details", async () => {
			// Setup
			const citizenUser = await createTestUser("citizen");
			userIds.push(citizenUser.id);

			const staffUser = await createTestStaffUser();
			userIds.push(staffUser.id);

			const slotId = await createTestSlot();
			slotIds.push(slotId);

			const procedureId = await createTestProcedure();
			const serviceRequestId = await createTestServiceRequest(citizenUser.id, procedureId);

			const consumeResult = await consumeCapacity(
				slotId,
				staffUser.id,
				"citizen",
				serviceRequestId,
				citizenUser.id,
				citizenUser.id,
				randomUUID(),
				new Date(Date.now() + 5 * 60 * 1000),
			);

			expect(consumeResult.success).toBe(true);
			if (!consumeResult.bookingId) {
				throw new Error("Expected bookingId");
			}
			bookingIds.push(consumeResult.bookingId);

			// Confirm
			const confirmResult = await confirmBooking(consumeResult.bookingId);
			expect(confirmResult.success).toBe(true);

			// Verify summary contains meaningful details
			const auditEvents = await db.query.auditEvent.findMany({
				where: eq(schema.auditEvent.entityId, consumeResult.bookingId),
			});

			expect(auditEvents).toHaveLength(1);
			const summary = auditEvents[0].summary;

			// Summary should contain key booking information
			expect(summary).toContain("confirmed");
			expect(summary).toContain("citizen"); // kind
			expect(summary).toContain(TEST_SLOT_DATE); // slot date
			expect(summary).toContain("10:00"); // start time
		});

		test("audit event payload contains confirmedAt timestamp", async () => {
			// Setup
			const citizenUser = await createTestUser("citizen");
			userIds.push(citizenUser.id);

			const staffUser = await createTestStaffUser();
			userIds.push(staffUser.id);

			const slotId = await createTestSlot();
			slotIds.push(slotId);

			const procedureId = await createTestProcedure();
			const serviceRequestId = await createTestServiceRequest(citizenUser.id, procedureId);

			const consumeResult = await consumeCapacity(
				slotId,
				staffUser.id,
				"citizen",
				serviceRequestId,
				citizenUser.id,
				citizenUser.id,
				randomUUID(),
				new Date(Date.now() + 5 * 60 * 1000),
			);

			expect(consumeResult.success).toBe(true);
			if (!consumeResult.bookingId) {
				throw new Error("Expected bookingId");
			}
			bookingIds.push(consumeResult.bookingId);

			// Confirm
			const confirmResult = await confirmBooking(consumeResult.bookingId);
			expect(confirmResult.success).toBe(true);

			// Verify payload has confirmedAt
			const auditEvents = await db.query.auditEvent.findMany({
				where: eq(schema.auditEvent.entityId, consumeResult.bookingId),
			});

			expect(auditEvents).toHaveLength(1);
			const payload = auditEvents[0].payload;
			expect(payload?.confirmedAt).toBeDefined();
			// Should be a valid ISO timestamp string
			const confirmedAtDate = new Date(payload?.confirmedAt as string);
			expect(confirmedAtDate.getTime()).not.toBeNaN();
		});

		test("does not create duplicate audit events on second confirm attempt", async () => {
			// Setup
			const citizenUser = await createTestUser("citizen");
			userIds.push(citizenUser.id);

			const staffUser = await createTestStaffUser();
			userIds.push(staffUser.id);

			const slotId = await createTestSlot();
			slotIds.push(slotId);

			const procedureId = await createTestProcedure();
			const serviceRequestId = await createTestServiceRequest(citizenUser.id, procedureId);

			const consumeResult = await consumeCapacity(
				slotId,
				staffUser.id,
				"citizen",
				serviceRequestId,
				citizenUser.id,
				citizenUser.id,
				randomUUID(),
				new Date(Date.now() + 5 * 60 * 1000),
			);

			expect(consumeResult.success).toBe(true);
			if (!consumeResult.bookingId) {
				throw new Error("Expected bookingId");
			}
			bookingIds.push(consumeResult.bookingId);

			// First confirm - should succeed
			const confirmResult1 = await confirmBooking(consumeResult.bookingId);
			expect(confirmResult1.success).toBe(true);

			// Second confirm - should fail (booking is no longer in "held" status)
			const confirmResult2 = await confirmBooking(consumeResult.bookingId);
			expect(confirmResult2.success).toBe(false);

			// Verify only one audit event was created
			const auditEvents = await db.query.auditEvent.findMany({
				where: eq(schema.auditEvent.entityId, consumeResult.bookingId),
			});

			expect(auditEvents).toHaveLength(1);
		});
	});
});
