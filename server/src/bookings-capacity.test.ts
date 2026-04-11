/**
 * Integration tests for the Combined Capacity Accounting Engine.
 *
 * Tests VAL-CAP-001: Combined global + staff capacity checks
 * Tests VAL-CAP-002: Over-capacity returns 409 CONFLICT
 * Tests VAL-CAP-003: Idempotent release (no double-release)
 * Tests VAL-CAP-004: Reassign booking to different staff
 *
 * Run with: cd server && bun test src/bookings-capacity.test.ts
 *
 * These tests import and test the actual capacity.ts functions.
 * They use the production database (sqlite.db) with unique test data.
 * Each test uses unique identifiers to avoid conflicts.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from "node:crypto";
import { memoryAdapter } from "@better-auth/memory-adapter";
import { betterAuth } from "better-auth";
import { admin, emailOTP } from "better-auth/plugins";
import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
	checkCapacity,
	consumeCapacity,
	reassignBooking,
	releaseCapacity,
} from "./capacity";
import { db, schema } from "./db";

// ---------------------------------------------------------------------------
// Test Auth Setup (uses memory adapter for auth testing)
// ---------------------------------------------------------------------------

function createEmptyDb(): Record<string, any[]> {
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

function getSessionCookieFromResponse(res: Response): string {
	const setCookie = res.headers.get("set-cookie");
	if (!setCookie) return "";
	const match = setCookie.match(/better-auth\.session_token=([^;]+)/);
	return match ? `better-auth.session_token=${match[1]}` : "";
}

// ---------------------------------------------------------------------------
// Hono App Setup (delegates to real capacity functions)
// ---------------------------------------------------------------------------

function createTestApp(auth: any) {
	const ADMIN_ROLE = "admin";

	type AppVariables = {
		user: typeof auth.$Infer.Session.user | null;
		session: typeof auth.$Infer.Session.session | null;
	};

	const app = new Hono<{ Variables: AppVariables }>();

	app.use(
		"/api/admin/*",
		cors({
			origin: "http://localhost:3000",
			allowHeaders: ["Content-Type", "Authorization"],
			allowMethods: ["POST", "GET", "PATCH", "DELETE", "OPTIONS"],
			exposeHeaders: ["Content-Length"],
			maxAge: 600,
			credentials: true,
		}),
	);

	app.use("*", async (c, next) => {
		const session = await auth.api.getSession({ headers: c.req.raw.headers });
		if (!session) {
			c.set("user", null);
			c.set("session", null);
			await next();
			return;
		}
		c.set("user", session.user);
		c.set("session", session.session);
		await next();
	});

	app.use("/api/admin/*", async (c, next) => {
		const user = c.get("user");
		if (!user) {
			return c.json(
				{ code: "UNAUTHENTICATED", message: "Authentication required" },
				401,
			);
		}
		if (user.role !== ADMIN_ROLE) {
			return c.json(
				{ code: "FORBIDDEN", message: "Admin privileges required" },
				403,
			);
		}
		await next();
	});

	// Admin check availability endpoint - delegates to real checkCapacity
	app.get("/api/admin/bookings/availability/check", async (c) => {
		const slotId = c.req.query("slotId");
		const staffUserId = c.req.query("staffUserId");

		if (!slotId || !staffUserId) {
			return c.json(
				{
					code: "MISSING_REQUIRED_FIELDS",
					message: "slotId and staffUserId required",
				},
				422,
			);
		}

		const result = await checkCapacity(slotId, staffUserId);
		return c.json(result);
	});

	// Admin create booking endpoint - delegates to real consumeCapacity
	app.post("/api/admin/bookings", async (c) => {
		const body = await c.req.json();

		if (!body.slotId || !body.staffUserId || !body.kind) {
			return c.json(
				{
					code: "MISSING_REQUIRED_FIELDS",
					message: "slotId, staffUserId, kind required",
				},
				422,
			);
		}

		const result = await consumeCapacity(
			body.slotId,
			body.staffUserId,
			body.kind,
			body.requestId ?? null,
			body.citizenUserId ?? null,
			body.createdByUserId ?? null,
			body.holdToken ?? null,
			body.holdExpiresAt ? new Date(body.holdExpiresAt) : null,
		);

		if (!result.success) {
			return c.json(
				{
					code: "CAPACITY_CONFLICT",
					message: "Insufficient capacity for this operation",
					conflicts: result.conflicts,
				},
				409,
			);
		}

		return c.json({ id: result.bookingId }, 201);
	});

	// Admin release booking endpoint - delegates to real releaseCapacity
	app.post("/api/admin/bookings/:id/release", async (c) => {
		const { id } = c.req.param();
		const body = await c.req.json();

		if (
			!body.reason ||
			!["cancelled", "expired", "attended"].includes(body.reason)
		) {
			return c.json(
				{
					code: "INVALID_REASON",
					message: "reason must be cancelled, expired, or attended",
				},
				422,
			);
		}

		const result = await releaseCapacity(id, body.reason);

		if (!result.success && result.error === "Booking not found") {
			return c.json({ code: "NOT_FOUND", message: "Booking not found" }, 404);
		}

		return c.json({
			booking: { id },
			alreadyReleased: result.alreadyReleased,
		});
	});

	app.on(["POST", "GET", "OPTIONS"], "/api/auth/*", (c) =>
		auth.handler(c.req.raw),
	);

	return app;
}

async function callApp(
	app: any,
	path: string,
	options: RequestInit = {},
	cookie?: string,
) {
	const url = `http://localhost:3001${path}`;
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		...(options.headers as Record<string, string>),
	};
	if (cookie) headers.Cookie = cookie;

	const res = await app.fetch(new Request(url, { ...options, headers }));
	let body: any;
	try {
		body = await res.json();
	} catch {
		body = null;
	}
	return { response: res, body, status: res.status };
}

async function createAdminSession(auth: any, memDb: any, _otpStore: any) {
	const signUpRes = await auth.handler(
		new Request("http://localhost:3000/api/auth/sign-up/email", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Origin: "http://localhost:3000",
			},
			body: JSON.stringify({
				name: "Admin",
				email: "admin@test.com",
				password: "admin123456",
			}),
		}),
	);
	const signUpBody = await signUpRes.json();
	if (!signUpBody.user?.id)
		throw new Error(`Sign-up failed: ${JSON.stringify(signUpBody)}`);

	const userRecord = memDb.user.find((u: any) => u.id === signUpBody.user.id);
	if (userRecord) userRecord.role = "admin";

	const signInRes = await auth.handler(
		new Request("http://localhost:3000/api/auth/sign-in/email", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				email: "admin@test.com",
				password: "admin123456",
			}),
		}),
	);
	return getSessionCookieFromResponse(signInRes);
}

// ---------------------------------------------------------------------------
// Test Data Setup Helpers - use unique IDs per test
// ---------------------------------------------------------------------------

// Use a date far in the future to avoid conflicts with existing data
const TEST_SLOT_DATE = "2030-12-31";

async function cleanupTestData(
	staffUserId: string,
	_slotId: string,
	bookingIds: string[],
) {
	// Clean up bookings first (depends on slot_id and staff_user_id)
	for (const id of bookingIds) {
		try {
			await db.delete(schema.booking).where(eq(schema.booking.id, id));
		} catch {
			// Ignore cleanup errors
		}
	}

	// Best-effort cleanup for bookings created during failed assertions
	// that were not recorded in bookingIds.
	try {
		await db
			.delete(schema.booking)
			.where(
				sql`${schema.booking.slotId} IN (SELECT id FROM appointment_slot WHERE slot_date = ${TEST_SLOT_DATE})`,
			);
	} catch {
		// Ignore
	}

	// Clean up all slots matching the test date (UNIQUE constraint is on slot_date + start_time)
	// This ensures cleanup works regardless of how many slots were created at different times
	try {
		await db
			.delete(schema.appointmentSlot)
			.where(eq(schema.appointmentSlot.slotDate, TEST_SLOT_DATE));
	} catch {
		// Ignore
	}

	// Clean up staff profile
	try {
		await db
			.delete(schema.staffProfile)
			.where(eq(schema.staffProfile.userId, staffUserId));
	} catch {
		// Ignore
	}

	// Clean up user
	try {
		await db.delete(schema.user).where(eq(schema.user.id, staffUserId));
	} catch {
		// Ignore
	}
}

// Guard against stale data from interrupted previous runs.
beforeEach(async () => {
	try {
		await db
			.delete(schema.booking)
			.where(
				sql`${schema.booking.slotId} IN (SELECT id FROM appointment_slot WHERE slot_date = ${TEST_SLOT_DATE})`,
			);
	} catch {
		// Ignore
	}

	try {
		await db
			.delete(schema.appointmentSlot)
			.where(eq(schema.appointmentSlot.slotDate, TEST_SLOT_DATE));
	} catch {
		// Ignore
	}
});

// ---------------------------------------------------------------------------
// Test suite: VAL-CAP-001 - Combined capacity check
// ---------------------------------------------------------------------------

describe("VAL-CAP-001: Combined global + staff capacity checks", () => {
	const testPrefix = randomUUID().slice(0, 8);
	const staffUserId = `staff-${testPrefix}`;
	const slotId = `slot-${testPrefix}`;
	const bookingIds: string[] = [];

	beforeEach(async () => {
		const now = new Date();

		// Create staff user
		await db.insert(schema.user).values({
			id: staffUserId,
			name: "Test Staff",
			email: `staff-${testPrefix}@test.com`,
			role: "staff",
			createdAt: now,
			updatedAt: now,
		});

		// Create staff profile with capacity 5
		await db.insert(schema.staffProfile).values({
			userId: staffUserId,
			isActive: true,
			isAssignable: true,
			defaultDailyCapacity: 5,
			createdAt: now,
			updatedAt: now,
		});

		// Create slot with global capacity 2
		await db.insert(schema.appointmentSlot).values({
			id: slotId,
			slotDate: TEST_SLOT_DATE,
			startTime: "09:00",
			endTime: "10:00",
			status: "open",
			capacityLimit: 2,
			generatedFrom: "base",
			createdAt: now,
			updatedAt: now,
		});

		const authSetup = createTestAuth();
		const app = createTestApp(authSetup.auth);
		const adminCookie = await createAdminSession(
			authSetup.auth,
			authSetup.memDb,
			authSetup.otpStore,
		);
		return { app, adminCookie };
	});

	afterEach(async () => {
		await cleanupTestData(staffUserId, slotId, bookingIds);
	});

	test("checkCapacity returns available=true when both capacities have room", async () => {
		const result = await checkCapacity(slotId, staffUserId);

		expect(result.available).toBe(true);
		expect(result.globalCapacity).toBe(2);
		expect(result.globalUsed).toBe(0);
		expect(result.globalRemaining).toBe(2);
		expect(result.staffCapacity).toBe(5);
		expect(result.staffUsed).toBe(0);
		expect(result.staffRemaining).toBe(5);
		expect(result.conflicts).toHaveLength(0);
	});

	test("checkCapacity returns staff capacity info with staff bookings", async () => {
		// Create a booking using consumeCapacity
		const result = await consumeCapacity(
			slotId,
			staffUserId,
			"citizen",
			null,
			null,
			null,
			null,
			null,
		);
		expect(result.success).toBe(true);
		if (result.bookingId) bookingIds.push(result.bookingId);

		// Now check capacity
		const capacityResult = await checkCapacity(slotId, staffUserId);

		expect(capacityResult.available).toBe(true);
		expect(capacityResult.globalUsed).toBe(1);
		expect(capacityResult.globalRemaining).toBe(1);
		expect(capacityResult.staffUsed).toBe(1);
		expect(capacityResult.staffRemaining).toBe(4);
	});
});

// ---------------------------------------------------------------------------
// Test suite: VAL-CAP-002 - Over-capacity returns 409 CONFLICT
// ---------------------------------------------------------------------------

describe("VAL-CAP-002: Over-capacity returns 409 CONFLICT", () => {
	const testPrefix = randomUUID().slice(0, 8);
	const staffUserId = `staff-${testPrefix}`;
	const slotId = `slot-${testPrefix}`;
	const bookingIds: string[] = [];

	beforeEach(async () => {
		const now = new Date();

		// Create staff user
		await db.insert(schema.user).values({
			id: staffUserId,
			name: "Test Staff",
			email: `staff-${testPrefix}@test.com`,
			role: "staff",
			createdAt: now,
			updatedAt: now,
		});

		// Create staff profile with capacity 5
		await db.insert(schema.staffProfile).values({
			userId: staffUserId,
			isActive: true,
			isAssignable: true,
			defaultDailyCapacity: 5,
			createdAt: now,
			updatedAt: now,
		});

		// Create slot with global capacity 2
		await db.insert(schema.appointmentSlot).values({
			id: slotId,
			slotDate: TEST_SLOT_DATE,
			startTime: "09:00",
			endTime: "10:00",
			status: "open",
			capacityLimit: 2,
			generatedFrom: "base",
			createdAt: now,
			updatedAt: now,
		});
	});

	afterEach(async () => {
		await cleanupTestData(staffUserId, slotId, bookingIds);
	});

	test("consumeCapacity returns conflict when global slot capacity is reached", async () => {
		// Fill up the slot to capacity (2 bookings)
		const result1 = await consumeCapacity(
			slotId,
			staffUserId,
			"citizen",
			null,
			null,
			null,
			null,
			null,
		);
		expect(result1.success).toBe(true);
		if (result1.bookingId) bookingIds.push(result1.bookingId);

		const result2 = await consumeCapacity(
			slotId,
			staffUserId,
			"citizen",
			null,
			null,
			null,
			null,
			null,
		);
		expect(result2.success).toBe(true);
		if (result2.bookingId) bookingIds.push(result2.bookingId);

		// Third booking should fail
		const result3 = await consumeCapacity(
			slotId,
			staffUserId,
			"citizen",
			null,
			null,
			null,
			null,
			null,
		);

		expect(result3.success).toBe(false);
		expect(result3.conflicts).toContainEqual(
			expect.objectContaining({ type: "GLOBAL_OVER_CAPACITY" }),
		);
	});

	test("consumeCapacity returns conflict when staff daily capacity is reached", async () => {
		// Create multiple slots on the same date
		for (let i = 2; i <= 6; i++) {
			await db.insert(schema.appointmentSlot).values({
				id: `${slotId}-daily-${i}`,
				slotDate: TEST_SLOT_DATE,
				startTime: `${9 + i}:00`,
				endTime: `${10 + i}:00`,
				status: "open",
				capacityLimit: 10,
				generatedFrom: "base",
				createdAt: new Date(),
				updatedAt: new Date(),
			});
		}

		// Fill up staff daily capacity (5 bookings)
		for (let i = 2; i <= 6; i++) {
			const result = await consumeCapacity(
				`${slotId}-daily-${i}`,
				staffUserId,
				"citizen",
				null,
				null,
				null,
				null,
				null,
			);
			expect(result.success).toBe(true);
			if (result.bookingId) bookingIds.push(result.bookingId);
		}

		// 6th booking should fail (staff at capacity)
		const result6 = await consumeCapacity(
			slotId,
			staffUserId,
			"citizen",
			null,
			null,
			null,
			null,
			null,
		);

		expect(result6.success).toBe(false);
		expect(result6.conflicts).toContainEqual(
			expect.objectContaining({ type: "STAFF_OVER_CAPACITY" }),
		);
	});

	test("consumeCapacity returns conflict when staff is unavailable on date", async () => {
		// Set staff as unavailable on the date
		await db.insert(schema.staffDateOverride).values({
			id: `override-${testPrefix}`,
			staffUserId: staffUserId,
			overrideDate: TEST_SLOT_DATE,
			isAvailable: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		const result = await consumeCapacity(
			slotId,
			staffUserId,
			"citizen",
			null,
			null,
			null,
			null,
			null,
		);

		expect(result.success).toBe(false);
		expect(result.conflicts).toContainEqual(
			expect.objectContaining({ type: "STAFF_UNAVAILABLE" }),
		);
	});

	test("consumeCapacity respects staff date capacity override", async () => {
		// Set staff capacity override to 1
		await db.insert(schema.staffDateOverride).values({
			id: `override-${testPrefix}`,
			staffUserId: staffUserId,
			overrideDate: TEST_SLOT_DATE,
			isAvailable: true,
			capacityOverride: 1,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		// First booking should succeed
		const result1 = await consumeCapacity(
			slotId,
			staffUserId,
			"citizen",
			null,
			null,
			null,
			null,
			null,
		);
		expect(result1.success).toBe(true);
		if (result1.bookingId) bookingIds.push(result1.bookingId);

		// Second booking should fail (capacity is now 1)
		const result2 = await consumeCapacity(
			slotId,
			staffUserId,
			"citizen",
			null,
			null,
			null,
			null,
			null,
		);
		expect(result2.success).toBe(false);
		expect(result2.conflicts).toContainEqual(
			expect.objectContaining({ type: "STAFF_OVER_CAPACITY" }),
		);
	});
});

// ---------------------------------------------------------------------------
// Test suite: VAL-CAP-003 - Idempotent release (no double-release)
// ---------------------------------------------------------------------------

describe("VAL-CAP-003: Idempotent release (no double-release)", () => {
	const testPrefix = randomUUID().slice(0, 8);
	const staffUserId = `staff-${testPrefix}`;
	const slotId = `slot-${testPrefix}`;
	const bookingIds: string[] = [];

	beforeEach(async () => {
		const now = new Date();

		// Create staff user
		await db.insert(schema.user).values({
			id: staffUserId,
			name: "Test Staff",
			email: `staff-${testPrefix}@test.com`,
			role: "staff",
			createdAt: now,
			updatedAt: now,
		});

		// Create staff profile with capacity 5
		await db.insert(schema.staffProfile).values({
			userId: staffUserId,
			isActive: true,
			isAssignable: true,
			defaultDailyCapacity: 5,
			createdAt: now,
			updatedAt: now,
		});

		// Create slot with global capacity 2
		await db.insert(schema.appointmentSlot).values({
			id: slotId,
			slotDate: TEST_SLOT_DATE,
			startTime: "09:00",
			endTime: "10:00",
			status: "open",
			capacityLimit: 2,
			generatedFrom: "base",
			createdAt: now,
			updatedAt: now,
		});
	});

	afterEach(async () => {
		await cleanupTestData(staffUserId, slotId, bookingIds);
	});

	test("releaseCapacity marks active booking as inactive", async () => {
		// Create a booking
		const createResult = await consumeCapacity(
			slotId,
			staffUserId,
			"citizen",
			null,
			null,
			null,
			null,
			null,
		);
		expect(createResult.success).toBe(true);
		if (!createResult.bookingId) throw new Error("bookingId should exist");
		bookingIds.push(createResult.bookingId);

		// Release the booking
		const releaseResult = await releaseCapacity(
			createResult.bookingId,
			"cancelled",
		);

		expect(releaseResult.success).toBe(true);
		expect(releaseResult.alreadyReleased).toBe(false);
	});

	test("releaseCapacity is idempotent - releasing inactive booking returns success", async () => {
		// Create a booking
		const createResult = await consumeCapacity(
			slotId,
			staffUserId,
			"citizen",
			null,
			null,
			null,
			null,
			null,
		);
		expect(createResult.success).toBe(true);
		if (!createResult.bookingId) throw new Error("bookingId should exist");
		const bookingId = createResult.bookingId;
		bookingIds.push(bookingId);

		// Release once
		const release1 = await releaseCapacity(bookingId, "cancelled");
		expect(release1.success).toBe(true);
		expect(release1.alreadyReleased).toBe(false);

		// Release again - should be idempotent
		const release2 = await releaseCapacity(bookingId, "cancelled");
		expect(release2.success).toBe(true);
		expect(release2.alreadyReleased).toBe(true);
	});

	test("releaseCapacity returns error for non-existent booking", async () => {
		const result = await releaseCapacity("non-existent-id", "cancelled");

		expect(result.success).toBe(false);
		expect(result.error).toBe("Booking not found");
	});
});

// ---------------------------------------------------------------------------
// Test suite: VAL-CAP-004 - Reassign booking
// ---------------------------------------------------------------------------

describe("VAL-CAP-004: Reassign booking to different staff", () => {
	const testPrefix = randomUUID().slice(0, 8);
	const staffUserId = `staff-${testPrefix}`;
	const staffUserId2 = `staff2-${testPrefix}`;
	const slotId = `slot-${testPrefix}`;
	const bookingIds: string[] = [];

	beforeEach(async () => {
		const now = new Date();

		// Create first staff user
		await db.insert(schema.user).values({
			id: staffUserId,
			name: "Test Staff",
			email: `staff-${testPrefix}@test.com`,
			role: "staff",
			createdAt: now,
			updatedAt: now,
		});

		await db.insert(schema.staffProfile).values({
			userId: staffUserId,
			isActive: true,
			isAssignable: true,
			defaultDailyCapacity: 5,
			createdAt: now,
			updatedAt: now,
		});

		// Create second staff user
		await db.insert(schema.user).values({
			id: staffUserId2,
			name: "Test Staff 2",
			email: `staff2-${testPrefix}@test.com`,
			role: "staff",
			createdAt: now,
			updatedAt: now,
		});

		await db.insert(schema.staffProfile).values({
			userId: staffUserId2,
			isActive: true,
			isAssignable: true,
			defaultDailyCapacity: 5,
			createdAt: now,
			updatedAt: now,
		});

		// Create slot with global capacity 2
		await db.insert(schema.appointmentSlot).values({
			id: slotId,
			slotDate: TEST_SLOT_DATE,
			startTime: "09:00",
			endTime: "10:00",
			status: "open",
			capacityLimit: 2,
			generatedFrom: "base",
			createdAt: now,
			updatedAt: now,
		});
	});

	afterEach(async () => {
		// Clean up both staff
		await cleanupTestData(staffUserId, slotId, bookingIds);
		// Clean up second staff
		try {
			await db
				.delete(schema.staffProfile)
				.where(eq(schema.staffProfile.userId, staffUserId2));
		} catch {
			/* ignore */
		}
		try {
			await db.delete(schema.user).where(eq(schema.user.id, staffUserId2));
		} catch {
			/* ignore */
		}
	});

	test("reassignBooking moves booking to new staff successfully", async () => {
		// Create a booking with first staff
		const createResult = await consumeCapacity(
			slotId,
			staffUserId,
			"citizen",
			null,
			null,
			null,
			null,
			null,
		);
		expect(createResult.success).toBe(true);
		if (!createResult.bookingId) throw new Error("bookingId should exist");
		bookingIds.push(createResult.bookingId);

		// Reassign to second staff
		const reassignResult = await reassignBooking(
			createResult.bookingId,
			staffUserId2,
		);

		expect(reassignResult.success).toBe(true);
		expect(reassignResult.conflicts).toHaveLength(0);
	});

	test("reassignBooking fails when target staff is at capacity", async () => {
		// Create a booking with first staff
		const createResult = await consumeCapacity(
			slotId,
			staffUserId,
			"citizen",
			null,
			null,
			null,
			null,
			null,
		);
		expect(createResult.success).toBe(true);
		if (!createResult.bookingId) throw new Error("bookingId should exist");
		const bookingId = createResult.bookingId;
		bookingIds.push(bookingId);

		// Fill up second staff's capacity to 5
		for (let i = 2; i <= 6; i++) {
			await db.insert(schema.appointmentSlot).values({
				id: `${slotId}-staff2-${i}`,
				slotDate: TEST_SLOT_DATE,
				startTime: `${9 + i}:00`,
				endTime: `${10 + i}:00`,
				status: "open",
				capacityLimit: 10,
				generatedFrom: "base",
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			const result = await consumeCapacity(
				`${slotId}-staff2-${i}`,
				staffUserId2,
				"citizen",
				null,
				null,
				null,
				null,
				null,
			);
			expect(result.success).toBe(true);
			if (result.bookingId) bookingIds.push(result.bookingId);
		}

		// Reassign should fail due to capacity
		const reassignResult = await reassignBooking(bookingId, staffUserId2);

		expect(reassignResult.success).toBe(false);
		expect(reassignResult.conflicts.length).toBeGreaterThan(0);
	});

	test("reassignBooking returns error for non-existent booking", async () => {
		const result = await reassignBooking("non-existent-id", staffUserId2);

		expect(result.success).toBe(false);
		expect(result.error).toBe("Booking not found");
	});

	test("reassignBooking is no-op when reassigning to same staff", async () => {
		// Create a booking with first staff
		const createResult = await consumeCapacity(
			slotId,
			staffUserId,
			"citizen",
			null,
			null,
			null,
			null,
			null,
		);
		expect(createResult.success).toBe(true);
		if (!createResult.bookingId) throw new Error("bookingId should exist");
		bookingIds.push(createResult.bookingId);

		// Reassign to same staff - should be no-op
		const reassignResult = await reassignBooking(
			createResult.bookingId,
			staffUserId,
		);

		expect(reassignResult.success).toBe(true);
		expect(reassignResult.conflicts).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Test suite: Authentication & Authorization
// ---------------------------------------------------------------------------

describe("Booking endpoints require admin authentication", () => {
	let auth: any;
	let app: any;

	beforeEach(async () => {
		const authSetup = createTestAuth();
		auth = authSetup.auth;
		app = createTestApp(auth);
	});

	test("without session returns 401 UNAUTHENTICATED", async () => {
		const { status, body } = await callApp(
			app,
			"/api/admin/bookings/availability/check?slotId=any&staffUserId=any",
			{ method: "GET" },
		);

		expect(status).toBe(401);
		expect(body.code).toBe("UNAUTHENTICATED");
	});

	test("with non-admin session returns 403 FORBIDDEN", async () => {
		// Create a non-admin user
		await auth.handler(
			new Request("http://localhost:3000/api/auth/sign-up/email", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Origin: "http://localhost:3000",
				},
				body: JSON.stringify({
					name: "Citizen",
					email: "citizen@test.com",
					password: "citizen123456",
				}),
			}),
		);

		const signInRes = await auth.handler(
			new Request("http://localhost:3000/api/auth/sign-in/email", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: "citizen@test.com",
					password: "citizen123456",
				}),
			}),
		);
		const citizenCookie = getSessionCookieFromResponse(signInRes);

		const { status, body } = await callApp(
			app,
			"/api/admin/bookings/availability/check?slotId=any&staffUserId=any",
			{ method: "GET" },
			citizenCookie,
		);

		expect(status).toBe(403);
		expect(body.code).toBe("FORBIDDEN");
	});
});
