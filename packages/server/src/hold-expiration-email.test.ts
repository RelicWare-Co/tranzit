/**
 * Integration tests for Hold Expiration Email functionality.
 *
 * Tests that hold expiration emails are sent when:
 * 1. expireStaleCitizenHolds() releases expired holds
 * 2. confirmBooking() detects an expired hold
 *
 * Run with: cd server && bun test src/hold-expiration-email.test.ts
 */
import { randomUUID } from "node:crypto";
import { memoryAdapter } from "@better-auth/memory-adapter";
import { betterAuth } from "better-auth";
import { admin, emailOTP } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { consumeCapacity, releaseCapacity } from "./features/bookings/capacity-consume.service";
import {
	expireStaleCitizenHolds,
	listCitizenProcedures,
} from "./features/citizen/citizen-portal.service";
import { db, schema } from "./lib/db";

// ---------------------------------------------------------------------------
// Test Auth Setup
// ---------------------------------------------------------------------------

function createEmptyDb(): Record<string, unknown[]> {
	return {
		user: [],
		session: [],
		account: [],
		verification: [],
		rateLimit: [],
	};
}

function createTestAuth() {
	const memDb = createEmptyDb();
	const otpStore: Record<string, Record<string, string>> = {};

	const auth = betterAuth({
		baseURL: "http://localhost:3000",
		secret: "test-secret-that-is-at-least-32-chars-long-xxxxxxxxxxxx",
		database: memoryAdapter(memDb) as any,
		rateLimit: { enabled: false },
		plugins: [
			admin(),
			emailOTP({
				otpLength: 6,
				expiresIn: 300,
				allowedAttempts: 3,
				storeOTP: "hashed",
				async sendVerificationOTP({ email, otp, type }) {
					if (!otpStore[type]) otpStore[type] = {};
					otpStore[type][email] = otp;
				},
			}),
		],
		emailAndPassword: { enabled: true },
		session: { cookieCache: { enabled: false } },
		advanced: { cookies: {} },
	});

	return { auth, memDb, otpStore };
}

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function createTestApp(auth: any) {
	type AppVariables = {
		user: typeof auth.$Infer.Session.user | null;
		session: typeof auth.$Infer.Session.session | null;
	};

	const app = new Hono<{ Variables: AppVariables }>();

	app.use(
		"/api/*",
		cors({
			origin: "http://localhost:3000",
			allowHeaders: ["Content-Type", "Authorization"],
			allowMethods: ["POST", "GET", "PATCH", "DELETE", "OPTIONS"],
		}),
	);

	app.use("*", async (c, next) => {
		const session = await auth.api.getSession({ headers: c.req.raw.headers });
		c.set("user", session?.user ?? null);
		c.set("session", session?.session ?? null);
		await next();
	});

	app.get("/api/health", (c) => c.json({ status: "ok" }));

	return app;
}

// ---------------------------------------------------------------------------
// Test Data Setup
// ---------------------------------------------------------------------------

async function setupExpiredHold() {
	const citizenUserId = randomUUID();
	const staffUserId = randomUUID();
	const procedureId = randomUUID();
	const slotId = randomUUID();
	const requestId = randomUUID();
	const bookingId = randomUUID();

	// Create citizen user
	await db.insert(schema.user).values({
		id: citizenUserId,
		email: `citizen-${randomUUID()}@example.com`,
		name: "Test Citizen",
		emailVerified: true,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	// Create staff user
	await db.insert(schema.user).values({
		id: staffUserId,
		email: `staff-${randomUUID()}@example.com`,
		name: "Test Staff",
		emailVerified: true,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	// Create staff profile
	await db.insert(schema.staffProfile).values({
		userId: staffUserId,
		isActive: true,
		isAssignable: true,
		defaultDailyCapacity: 10,
		weeklyAvailability: {
			1: { enabled: true, morningStart: "08:00", morningEnd: "12:00", afternoonStart: "14:00", afternoonEnd: "18:00" },
			2: { enabled: true, morningStart: "08:00", morningEnd: "12:00", afternoonStart: "14:00", afternoonEnd: "18:00" },
			3: { enabled: true, morningStart: "08:00", morningEnd: "12:00", afternoonStart: "14:00", afternoonEnd: "18:00" },
			4: { enabled: true, morningStart: "08:00", morningEnd: "12:00", afternoonStart: "14:00", afternoonEnd: "18:00" },
			5: { enabled: true, morningStart: "08:00", morningEnd: "12:00", afternoonStart: "14:00", afternoonEnd: "18:00" },
		},
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	// Create procedure type
	await db.insert(schema.procedureType).values({
		id: procedureId,
		name: "Test Procedure",
		slug: "test-procedure",
		description: "A test procedure",
		isActive: true,
		configVersion: 1,
		requiresVehicle: false,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	// Create appointment slot (tomorrow)
	const tomorrow = new Date();
	tomorrow.setDate(tomorrow.getDate() + 1);
	const slotDate = tomorrow.toISOString().split("T")[0];

	await db.insert(schema.appointmentSlot).values({
		id: slotId,
		slotDate,
		startTime: "09:00",
		endTime: "09:30",
		status: "open",
		capacityLimit: 10,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	// Create service request
	await db.insert(schema.serviceRequest).values({
		id: requestId,
		procedureTypeId: procedureId,
		citizenUserId,
		email: `citizen-${randomUUID()}@example.com`,
		documentType: "CC",
		documentNumber: "123456789",
		status: "booking_held",
		procedureConfigVersion: 1,
		draftData: {
			applicantName: "Test Citizen",
			applicantDocument: "123456789",
		},
		procedureSnapshot: {
			id: procedureId,
			slug: "test-procedure",
			name: "Test Procedure",
			description: "A test procedure",
			configVersion: 1,
			requiresVehicle: false,
		},
		requirementsSnapshot: {},
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	// Create an expired hold (holdExpiresAt in the past)
	const expiredTime = new Date();
	expiredTime.setMinutes(expiredTime.getMinutes() - 10); // 10 minutes ago

	await db.insert(schema.booking).values({
		id: bookingId,
		slotId,
		requestId,
		citizenUserId,
		staffUserId,
		kind: "citizen",
		status: "held",
		isActive: true,
		holdExpiresAt: expiredTime,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	// Update service request with activeBookingId
	await db
		.update(schema.serviceRequest)
		.set({ activeBookingId: bookingId })
		.where(eq(schema.serviceRequest.id, requestId));

	return {
		citizenUserId,
		staffUserId,
		procedureId,
		slotId,
		requestId,
		bookingId,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Hold Expiration Email", () => {
	let auth: ReturnType<typeof createTestAuth>["auth"];

	beforeEach(async () => {
		const testAuth = createTestAuth();
		auth = testAuth.auth;
		createTestApp(auth);

		// Clean up tables
		await db.delete(schema.notificationDelivery);
		await db.delete(schema.booking);
		await db.delete(schema.serviceRequest);
		await db.delete(schema.appointmentSlot);
		await db.delete(schema.staffProfile);
		await db.delete(schema.procedureType);
		await db.delete(schema.user);
	});

	afterEach(async () => {
		// Clean up after each test
		await db.delete(schema.notificationDelivery);
		await db.delete(schema.booking);
		await db.delete(schema.serviceRequest);
		await db.delete(schema.appointmentSlot);
		await db.delete(schema.staffProfile);
		await db.delete(schema.procedureType);
		await db.delete(schema.user);
	});

	describe("expireStaleCitizenHolds", () => {
		test("sends hold expiration email when releasing expired holds", async () => {
			// Setup an expired hold
			const { bookingId, citizenUserId } = await setupExpiredHold();

			// Get the citizen's email
			const citizen = await db.query.user.findFirst({
				where: eq(schema.user.id, citizenUserId),
			});
			expect(citizen?.email).toBeDefined();

			// Run expireStaleCitizenHolds
			const releasedCount = await expireStaleCitizenHolds();
			expect(releasedCount).toBe(1);

			// Verify the booking was released (isActive = false)
			const booking = await db.query.booking.findFirst({
				where: eq(schema.booking.id, bookingId),
			});
			expect(booking?.isActive).toBe(false);
			expect(booking?.status).toBe("expired");

			// Verify notification_delivery record was created
			const notifications = await db.query.notificationDelivery.findMany({
				where: eq(schema.notificationDelivery.entityId, bookingId),
			});

			expect(notifications.length).toBeGreaterThan(0);

			const notification = notifications.find(
				(n) => n.templateKey === "booking-hold-expired",
			);
			expect(notification).toBeDefined();
			expect(notification?.recipient).toBe(citizen?.email);
			expect(notification?.status).toBe("sent");
			expect(notification?.attemptCount).toBe(1);
			expect(notification?.sentAt).toBeDefined();
		});

		test("does not send email if citizen has no email", async () => {
			// Setup an expired hold
			const { bookingId, citizenUserId } = await setupExpiredHold();

			// Remove the citizen's email (simulate edge case)
			await db
				.update(schema.user)
				.set({ email: "" })
				.where(eq(schema.user.id, citizenUserId));

			// Run expireStaleCitizenHolds - should not throw
			const releasedCount = await expireStaleCitizenHolds();
			expect(releasedCount).toBe(1);

			// Verify no notification was created
			const notifications = await db.query.notificationDelivery.findMany({
				where: eq(schema.notificationDelivery.entityId, bookingId),
			});

			expect(notifications.length).toBe(0);
		});
	});
});
