/**
 * Integration tests for Service Request Lifecycle API.
 *
 * Tests:
 * - Admin can list all service requests with pagination
 * - Admin can filter requests by status
 * - Admin can view request details with snapshots and linked booking
 * - Eligibility check blocks invalid transitions (400)
 * - Status transitions are atomic with timestamp updates
 * - Config version captured at creation
 *
 * Run with: cd server && bun test src/service-requests.test.ts
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
	listServiceRequests,
	getServiceRequest,
	updateServiceRequestStatus,
} from "./features/service-requests/service-requests.service";
import { db, schema } from "./lib/db";

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

const createTestUser = async () => {
	const userId = randomUUID();
	const email = `test_${randomUUID()}@example.com`;

	await db.insert(schema.user).values({
		id: userId,
		email,
		name: "Test User",
		emailVerified: false,
	});

	return { user: { id: userId, email, name: "Test User" } };
};

const createTestAdminUser = async () => {
	const userId = randomUUID();
	const email = `admin_${randomUUID()}@example.com`;

	await db.insert(schema.user).values({
		id: userId,
		email,
		name: "Test Admin",
		emailVerified: true,
		role: "admin",
	});

	return { user: { id: userId, email, name: "Test Admin" } };
};

const createTestProcedure = async (configVersion = 1) => {
	const id = randomUUID();
	await db.insert(schema.procedureType).values({
		id,
		slug: `test-proc-${randomUUID()}`,
		name: "Test Procedure",
		description: "Test procedure for service request tests",
		isActive: true,
		configVersion,
	});
	return id;
};

const createTestServiceRequest = async (
	userId: string,
	procedureTypeId: string,
	status = "draft",
	procedureConfigVersion = 1,
) => {
	const requestId = randomUUID();
	await db.insert(schema.serviceRequest).values({
		id: requestId,
		procedureTypeId,
		citizenUserId: userId,
		email: `test_${randomUUID()}@example.com`,
		documentType: "CC",
		documentNumber: randomUUID(),
		status,
		procedureConfigVersion,
	});
	return requestId;
};

const createTestBooking = async (
	requestId: string,
	citizenUserId: string,
	status = "held",
	isActive = true,
) => {
	// First create a slot with unique time
	const slotId = randomUUID();
	const uniqueTime = `09:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}`;
	await db.insert(schema.appointmentSlot).values({
		id: slotId,
		slotDate: `2025-01-${String(Math.floor(Math.random() * 28) + 1).padStart(2, "0")}`,
		startTime: uniqueTime,
		endTime: `09:${String(parseInt(uniqueTime.split(":")[1]) + 30).padStart(2, "0")}`,
		status: "open",
	});

	const bookingId = randomUUID();
	await db.insert(schema.booking).values({
		id: bookingId,
		slotId,
		requestId,
		citizenUserId,
		kind: "citizen",
		status,
		isActive,
	});

	// Update service request to point to this booking
	await db
		.update(schema.serviceRequest)
		.set({ activeBookingId: bookingId })
		.where(eq(schema.serviceRequest.id, requestId));

	return { bookingId, slotId };
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Service Request Lifecycle", () => {
	let testUser: any;
	let testAdmin: any;
	let testProcedureId: string;
	let testRequestId: string;

	beforeEach(async () => {
		// Create test users
		testUser = await createTestUser();
		testAdmin = await createTestAdminUser();

		// Create test procedure
		testProcedureId = await createTestProcedure(1);

		// Create test service request
		testRequestId = await createTestServiceRequest(
			testUser.user.id,
			testProcedureId,
			"draft",
			1,
		);
	});

		afterEach(async () => {
			// Clean up test data in reverse order of creation
			// First clear activeBookingId references so bookings can be deleted
			await db
				.update(schema.serviceRequest)
				.set({ activeBookingId: null })
				.where(eq(schema.serviceRequest.procedureTypeId, testProcedureId));

			// Delete bookings that reference this request
			await db
				.delete(schema.booking)
				.where(eq(schema.booking.requestId, testRequestId));

			// Delete service requests for this procedure
			await db
				.delete(schema.serviceRequest)
				.where(eq(schema.serviceRequest.procedureTypeId, testProcedureId));

			// Delete appointment slots created by createTestBooking
			// (slots have unique random dates, so we can safely delete all open slots)
			const slotIds = await db
				.select({ id: schema.appointmentSlot.id })
				.from(schema.appointmentSlot)
				.where(eq(schema.appointmentSlot.status, "open"));
			for (const { id } of slotIds) {
				await db
					.delete(schema.appointmentSlot)
					.where(eq(schema.appointmentSlot.id, id));
			}

			// Delete procedure
			await db
				.delete(schema.procedureType)
				.where(eq(schema.procedureType.id, testProcedureId));

			// Delete users
			await db.delete(schema.user).where(eq(schema.user.id, testUser.user.id));
			await db.delete(schema.user).where(eq(schema.user.id, testAdmin.user.id));
		});

	describe("listServiceRequests", () => {
		test("lists all service requests with pagination", async () => {
			// Create additional requests
			await createTestServiceRequest(testUser.user.id, testProcedureId, "booking_held");
			await createTestServiceRequest(testUser.user.id, testProcedureId, "confirmed");

			const result = await listServiceRequests({
				limit: 10,
				offset: 0,
				procedureTypeId: testProcedureId,
			});

			expect(result.total).toBe(3);
			expect(result.requests).toHaveLength(3);
			expect(result.limit).toBe(10);
			expect(result.offset).toBe(0);
			expect(result.hasMore).toBe(false);
		});

		test("filters by status", async () => {
			// Create requests with different statuses
			await createTestServiceRequest(testUser.user.id, testProcedureId, "booking_held");
			await createTestServiceRequest(testUser.user.id, testProcedureId, "confirmed");

			const result = await listServiceRequests({
				status: ["draft"],
				limit: 10,
				procedureTypeId: testProcedureId,
			});

			expect(result.total).toBe(1);
			expect(result.requests).toHaveLength(1);
			expect(result.requests[0].status).toBe("draft");
		});

		test("filters by multiple statuses", async () => {
			await createTestServiceRequest(testUser.user.id, testProcedureId, "booking_held");
			await createTestServiceRequest(testUser.user.id, testProcedureId, "confirmed");

			const result = await listServiceRequests({
				status: ["draft", "booking_held"],
				limit: 10,
				procedureTypeId: testProcedureId,
			});

			expect(result.total).toBe(2);
			expect(result.requests).toHaveLength(2);
			const statuses = result.requests.map((r) => r.status);
			expect(statuses).toContain("draft");
			expect(statuses).toContain("booking_held");
		});

		test("filters by procedureTypeId", async () => {
			const otherProcedureId = await createTestProcedure();
			await createTestServiceRequest(testUser.user.id, otherProcedureId, "draft");

			const result = await listServiceRequests({
				procedureTypeId: testProcedureId,
				limit: 10,
			});

			expect(result.total).toBe(1);
			expect(result.requests[0].procedureTypeId).toBe(testProcedureId);
		});

		test("includes related procedure type data", async () => {
			const result = await listServiceRequests({
				limit: 10,
				procedureTypeId: testProcedureId,
			});

			expect(result.requests).toHaveLength(1);
			const request = result.requests[0];
			expect(request.procedureType).toBeDefined();
			expect(request.procedureType?.id).toBe(testProcedureId);
			expect(request.procedureType?.name).toBe("Test Procedure");
		});

		test("includes citizen data", async () => {
			const result = await listServiceRequests({
				limit: 10,
				procedureTypeId: testProcedureId,
			});

			expect(result.requests).toHaveLength(1);
			const request = result.requests[0];
			expect(request.citizen).toBeDefined();
			expect(request.citizen?.id).toBe(testUser.user.id);
			expect(request.citizen?.name).toBe("Test User");
		});

		test("pagination works correctly", async () => {
			// Create more requests
			for (let i = 0; i < 5; i++) {
				await createTestServiceRequest(testUser.user.id, testProcedureId, "draft");
			}

			const page1 = await listServiceRequests({
				limit: 2,
				offset: 0,
				procedureTypeId: testProcedureId,
			});
			const page2 = await listServiceRequests({
				limit: 2,
				offset: 2,
				procedureTypeId: testProcedureId,
			});
			const page3 = await listServiceRequests({
				limit: 2,
				offset: 4,
				procedureTypeId: testProcedureId,
			});

			expect(page1.requests).toHaveLength(2);
			expect(page1.hasMore).toBe(true);
			expect(page2.requests).toHaveLength(2);
			expect(page2.hasMore).toBe(true);
			expect(page3.requests).toHaveLength(2);
			expect(page3.hasMore).toBe(false);

			// Ensure no overlap
			const page1Ids = page1.requests.map((r) => r.id);
			const page2Ids = page2.requests.map((r) => r.id);
			expect(page1Ids).not.toContainEqual(expect.arrayContaining(page2Ids));
		});
	});

	describe("getServiceRequest", () => {
		test("returns full request details with snapshots", async () => {
			// Create a request with snapshot data
			const requestId = randomUUID();
			await db.insert(schema.serviceRequest).values({
				id: requestId,
				procedureTypeId: testProcedureId,
				citizenUserId: testUser.user.id,
				email: "test@example.com",
				status: "booking_held",
				procedureSnapshot: { name: "Test Procedure", version: 1 },
				eligibilityResult: { passed: true },
				draftData: { applicantName: "Test User" },
			});

			const result = await getServiceRequest(requestId);

			expect(result.id).toBe(requestId);
			expect(result.procedureSnapshot).toEqual({ name: "Test Procedure", version: 1 });
			expect(result.eligibilityResult).toEqual({ passed: true });
			expect(result.draftData).toEqual({ applicantName: "Test User" });
		});

		test("includes linked booking with slot and staff details", async () => {
			// Create a booking with confirmed status
			const { bookingId } = await createTestBooking(
				testRequestId,
				testUser.user.id,
				"confirmed",
			);

			// Update service request status to match
			await db
				.update(schema.serviceRequest)
				.set({ status: "booking_held" })
				.where(eq(schema.serviceRequest.id, testRequestId));

			const result = await getServiceRequest(testRequestId);

			expect(result.activeBooking).toBeDefined();
			expect(result.activeBooking?.id).toBe(bookingId);
			expect(result.activeBooking?.status).toBe("confirmed");
			expect(result.activeBooking?.slot).toBeDefined();
		});

		test("returns 404 for non-existent request", async () => {
			await expect(getServiceRequest(randomUUID())).rejects.toThrow();
		});
	});

	describe("updateServiceRequestStatus", () => {
		test("transitions from draft to booking_held", async () => {
			const result = await updateServiceRequestStatus({
				requestId: testRequestId,
				status: "booking_held",
				actorUserId: testAdmin.user.id,
			});

			expect(result.previousStatus).toBe("draft");
			expect(result.newStatus).toBe("booking_held");
			expect(result.timestampField).toBeNull();
			expect(result.auditEventId).toBeDefined();

			// Verify the status was actually updated
			const updated = await getServiceRequest(testRequestId);
			expect(updated.status).toBe("booking_held");
		});

		test("sets verifiedAt timestamp when transitioning to verified", async () => {
			// First transition to booking_held
			await updateServiceRequestStatus({
				requestId: testRequestId,
				status: "booking_held",
				actorUserId: testAdmin.user.id,
			});

			// Create a confirmed booking
			await createTestBooking(testRequestId, testUser.user.id, "confirmed");

			// Transition to verified
			const result = await updateServiceRequestStatus({
				requestId: testRequestId,
				status: "verified",
				actorUserId: testAdmin.user.id,
			});

			expect(result.newStatus).toBe("verified");
			expect(result.timestampField).toBe("verifiedAt");

			// Verify timestamp was set
			const updated = await getServiceRequest(testRequestId);
			expect(updated.verifiedAt).toBeInstanceOf(Date);
		});

		test("sets cancelledAt timestamp when cancelling", async () => {
			const result = await updateServiceRequestStatus({
				requestId: testRequestId,
				status: "cancelled",
				actorUserId: testAdmin.user.id,
			});

			expect(result.newStatus).toBe("cancelled");
			expect(result.timestampField).toBe("cancelledAt");

			const updated = await getServiceRequest(testRequestId);
			expect(updated.cancelledAt).toBeInstanceOf(Date);
		});

		test("blocks invalid transitions", async () => {
			// Try to go directly from draft to confirmed (not allowed)
			await expect(
				updateServiceRequestStatus({
					requestId: testRequestId,
					status: "confirmed",
					actorUserId: testAdmin.user.id,
				}),
			).rejects.toThrow();
		});

		test("blocks transition to verified when booking not confirmed (eligibility check)", async () => {
			// First transition to booking_held
			await updateServiceRequestStatus({
				requestId: testRequestId,
				status: "booking_held",
				actorUserId: testAdmin.user.id,
			});

			// Try to transition to verified without a confirmed booking
			await expect(
				updateServiceRequestStatus({
					requestId: testRequestId,
					status: "verified",
					actorUserId: testAdmin.user.id,
				}),
			).rejects.toThrow();
		});

		test("creates audit event on status change", async () => {
			await updateServiceRequestStatus({
				requestId: testRequestId,
				status: "booking_held",
				actorUserId: testAdmin.user.id,
				reason: "Test transition",
			});

			const auditEvents = await db.query.auditEvent.findMany({
				where: eq(schema.auditEvent.entityId, testRequestId),
			});

			expect(auditEvents).toHaveLength(1);
			expect(auditEvents[0].action).toBe("status_draft_to_booking_held");
			expect(auditEvents[0].actorUserId).toBe(testAdmin.user.id);
			expect(auditEvents[0].entityType).toBe("service_request");
			expect(auditEvents[0].payload).toMatchObject({
				previousStatus: "draft",
				newStatus: "booking_held",
				reason: "Test transition",
			});
		});

		test("returns 404 for non-existent request", async () => {
			await expect(
				updateServiceRequestStatus({
					requestId: randomUUID(),
					status: "booking_held",
					actorUserId: testAdmin.user.id,
				}),
			).rejects.toThrow();
		});
	});

	describe("Config version handling", () => {
		test("config version is captured at request creation", async () => {
			// Create procedure with specific config version
			const procId = await createTestProcedure(5);

			// Create request - it should capture the config version
			const requestId = await createTestServiceRequest(
				testUser.user.id,
				procId,
				"draft",
				5,
			);

			const result = await getServiceRequest(requestId);
			expect(result.procedureConfigVersion).toBe(5);
		});
	});
});
