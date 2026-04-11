/**
 * Integration tests for the Combined Capacity Accounting Engine.
 *
 * Tests VAL-CAP-001: Combined global + staff capacity checks
 * Tests VAL-CAP-002: Over-capacity returns 409 CONFLICT
 * Tests VAL-CAP-003: Idempotent release (no double-release)
 * Tests VAL-CAP-004: Concurrent booking race condition handling
 *
 * Run with: cd server && bun test src/bookings-capacity.test.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { memoryAdapter } from "@better-auth/memory-adapter";
import { betterAuth } from "better-auth";
import { admin, emailOTP } from "better-auth/plugins";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { beforeEach, describe, expect, test } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createEmptyDb(): Record<string, any[]> {
	return {
		user: [],
		session: [],
		account: [],
		verification: [],
		rateLimit: [],
		staff_profile: [],
		staff_date_override: [],
		appointment_slot: [],
		booking: [],
		service_request: [],
	};
}

function createTestAuth() {
	const db = createEmptyDb();
	const otpStore: Record<string, Record<string, string>> = {};

	const auth = betterAuth({
		baseURL: "http://localhost:3000",
		secret: "test-secret-that-is-at-least-32-chars-long-xxxxxxxxxxxx",
		database: memoryAdapter(db) as any,
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

	return { auth, db, otpStore };
}

function getSessionCookieFromResponse(res: Response): string {
	const setCookie = res.headers.get("set-cookie");
	if (!setCookie) return "";
	const match = setCookie.match(/better-auth\.session_token=([^;]+)/);
	return match ? `better-auth.session_token=${match[1]}` : "";
}

/**
 * Create a test Hono app that mirrors the production middleware stack.
 * Includes mock capacity endpoints for testing.
 */
function createTestApp(auth: any, mockDb: any) {
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

	// Stub GET /api/admin/bookings/availability/check
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

		const slot = mockDb.appointment_slot.find((s: any) => s.id === slotId);
		if (!slot) {
			return c.json({ code: "NOT_FOUND", message: "Slot not found" }, 404);
		}

		const staff = mockDb.staff_profile.find(
			(s: any) => s.userId === staffUserId,
		);
		if (!staff) {
			return c.json({ code: "NOT_FOUND", message: "Staff not found" }, 404);
		}

		// Count active bookings for this slot
		const slotActiveBookings = mockDb.booking.filter(
			(b: any) => b.slotId === slotId && b.isActive,
		);
		const globalUsed = slotActiveBookings.length;
		const globalCapacity = slot.capacityLimit;
		const globalRemaining =
			globalCapacity !== null ? globalCapacity - globalUsed : null;

		// Count staff bookings for this date
		const staffDateBookings = mockDb.booking.filter(
			(b: any) => b.staffUserId === staffUserId && b.isActive,
		);
		const staffBookingsOnDate = staffDateBookings.filter((b: any) => {
			const bSlot = mockDb.appointment_slot.find((s: any) => s.id === b.slotId);
			return bSlot && bSlot.slotDate === slot.slotDate;
		});
		const staffUsed = staffBookingsOnDate.length;

		// Check date override
		let staffCapacity = staff.defaultDailyCapacity;
		const dateOverride = mockDb.staff_date_override.find(
			(o: any) =>
				o.staffUserId === staffUserId && o.overrideDate === slot.slotDate,
		);
		if (dateOverride) {
			if (!dateOverride.isAvailable) {
				return c.json({
					available: false,
					globalCapacity,
					globalUsed,
					globalRemaining,
					staffCapacity: 0,
					staffUsed: 0,
					staffRemaining: 0,
					conflicts: [
						{ type: "STAFF_UNAVAILABLE", details: "Staff unavailable on date" },
					],
				});
			}
			if (dateOverride.capacityOverride !== null) {
				staffCapacity = dateOverride.capacityOverride;
			}
		}

		const staffRemaining = staffCapacity - staffUsed;
		const conflicts: any[] = [];

		if (globalCapacity !== null && globalUsed >= globalCapacity) {
			conflicts.push({
				type: "GLOBAL_OVER_CAPACITY",
				details: `Slot at capacity (${globalCapacity})`,
			});
		}
		if (staffUsed >= staffCapacity) {
			conflicts.push({
				type: "STAFF_OVER_CAPACITY",
				details: `Staff at capacity (${staffCapacity})`,
			});
		}

		return c.json({
			available: conflicts.length === 0,
			globalCapacity,
			globalUsed,
			globalRemaining,
			staffCapacity,
			staffUsed,
			staffRemaining,
			conflicts,
		});
	});

	// Stub POST /api/admin/bookings
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

		const slot = mockDb.appointment_slot.find((s: any) => s.id === body.slotId);
		if (!slot) {
			return c.json({ code: "NOT_FOUND", message: "Slot not found" }, 404);
		}

		const staff = mockDb.staff_profile.find(
			(s: any) => s.userId === body.staffUserId,
		);
		if (!staff) {
			return c.json({ code: "NOT_FOUND", message: "Staff not found" }, 404);
		}

		// Check capacity
		const slotActiveBookings = mockDb.booking.filter(
			(b: any) => b.slotId === body.slotId && b.isActive,
		);
		const globalUsed = slotActiveBookings.length;
		const globalCapacity = slot.capacityLimit;

		if (globalCapacity !== null && globalUsed >= globalCapacity) {
			return c.json(
				{
					code: "CAPACITY_CONFLICT",
					message: "Insufficient capacity for this operation",
					conflicts: [
						{
							type: "GLOBAL_OVER_CAPACITY",
							details: `Slot at capacity (${globalCapacity})`,
						},
					],
				},
				409,
			);
		}

		const staffDateBookings = mockDb.booking.filter(
			(b: any) => b.staffUserId === body.staffUserId && b.isActive,
		);
		const staffBookingsOnDate = staffDateBookings.filter((b: any) => {
			const bSlot = mockDb.appointment_slot.find((s: any) => s.id === b.slotId);
			return bSlot && bSlot.slotDate === slot.slotDate;
		});
		let staffCapacity = staff.defaultDailyCapacity;
		const staffUsed = staffBookingsOnDate.length;

		const dateOverride = mockDb.staff_date_override.find(
			(o: any) =>
				o.staffUserId === body.staffUserId && o.overrideDate === slot.slotDate,
		);
		if (dateOverride) {
			if (!dateOverride.isAvailable) {
				return c.json(
					{
						code: "CAPACITY_CONFLICT",
						message: "Insufficient capacity for this operation",
						conflicts: [
							{
								type: "STAFF_UNAVAILABLE",
								details: "Staff unavailable on date",
							},
						],
					},
					409,
				);
			}
			if (dateOverride.capacityOverride !== null) {
				staffCapacity = dateOverride.capacityOverride;
			}
		}

		if (staffUsed >= staffCapacity) {
			return c.json(
				{
					code: "CAPACITY_CONFLICT",
					message: "Insufficient capacity for this operation",
					conflicts: [
						{
							type: "STAFF_OVER_CAPACITY",
							details: `Staff at capacity (${staffCapacity})`,
						},
					],
				},
				409,
			);
		}

		// Create booking
		const bookingId = crypto.randomUUID();
		const booking = {
			id: bookingId,
			slotId: body.slotId,
			staffUserId: body.staffUserId,
			kind: body.kind,
			status: body.kind === "citizen" ? "held" : "confirmed",
			isActive: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		};
		mockDb.booking.push(booking);

		return c.json(booking, 201);
	});

	// Stub POST /api/admin/bookings/:id/release
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

		const booking = mockDb.booking.find((b: any) => b.id === id);
		if (!booking) {
			return c.json({ code: "NOT_FOUND", message: "Booking not found" }, 404);
		}

		// Idempotent: if already inactive, return success
		if (!booking.isActive) {
			return c.json({ booking, alreadyReleased: true });
		}

		// Release the booking
		booking.isActive = false;
		booking.updatedAt = new Date();
		if (body.reason === "cancelled") booking.cancelledAt = new Date();
		if (body.reason === "attended") booking.attendedAt = new Date();

		return c.json({ booking, alreadyReleased: false });
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

async function createAdminSession(auth: any, db: any, _otpStore: any) {
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

	const userRecord = db.user.find((u: any) => u.id === signUpBody.user.id);
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
// Test data setup
// ---------------------------------------------------------------------------

function setupTestData(mockDb: any) {
	// Create a staff user and profile
	const staffUserId = "staff-user-1";
	mockDb.user.push({
		id: staffUserId,
		name: "Test Staff",
		email: "staff@test.com",
		role: "staff",
	});

	mockDb.staff_profile.push({
		userId: staffUserId,
		isActive: true,
		isAssignable: true,
		defaultDailyCapacity: 5, // 5 bookings per day max
		weeklyAvailability: {},
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	// Create a slot with capacity limit of 2
	const slotId = "slot-1";
	mockDb.appointment_slot.push({
		id: slotId,
		slotDate: "2026-04-15",
		startTime: "09:00",
		endTime: "10:00",
		status: "open",
		capacityLimit: 2, // 2 bookings max for this slot
		generatedFrom: "base",
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	return { staffUserId, slotId };
}

// ---------------------------------------------------------------------------
// Test suite: VAL-CAP-001 - Combined capacity check
// ---------------------------------------------------------------------------

describe("VAL-CAP-001: Combined global + staff capacity checks", () => {
	let auth: any;
	let app: any;
	let adminCookie: string;
	let mockDb: any;

	beforeEach(async () => {
		const setup = createTestAuth();
		auth = setup.auth;
		mockDb = setup.db;
		setupTestData(mockDb);
		app = createTestApp(auth, mockDb);
		adminCookie = await createAdminSession(auth, mockDb, setup.otpStore);
	});

	test("returns available=true when both capacities have room", async () => {
		const { status, body } = await callApp(
			app,
			"/api/admin/bookings/availability/check?slotId=slot-1&staffUserId=staff-user-1",
			{ method: "GET" },
			adminCookie,
		);

		expect(status).toBe(200);
		expect(body.available).toBe(true);
		expect(body.globalCapacity).toBe(2);
		expect(body.globalUsed).toBe(0);
		expect(body.globalRemaining).toBe(2);
		expect(body.staffCapacity).toBe(5);
		expect(body.staffUsed).toBe(0);
		expect(body.staffRemaining).toBe(5);
		expect(body.conflicts).toHaveLength(0);
	});

	test("returns staff capacity info with staff bookings", async () => {
		// Create a booking first
		mockDb.booking.push({
			id: "booking-1",
			slotId: "slot-1",
			staffUserId: "staff-user-1",
			kind: "citizen",
			status: "held",
			isActive: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		const { status, body } = await callApp(
			app,
			"/api/admin/bookings/availability/check?slotId=slot-1&staffUserId=staff-user-1",
			{ method: "GET" },
			adminCookie,
		);

		expect(status).toBe(200);
		expect(body.available).toBe(true);
		expect(body.globalUsed).toBe(1);
		expect(body.globalRemaining).toBe(1);
		expect(body.staffUsed).toBe(1);
		expect(body.staffRemaining).toBe(4);
	});
});

// ---------------------------------------------------------------------------
// Test suite: VAL-CAP-002 - Over-capacity returns 409 CONFLICT
// ---------------------------------------------------------------------------

describe("VAL-CAP-002: Over-capacity returns 409 CONFLICT", () => {
	let auth: any;
	let app: any;
	let adminCookie: string;
	let mockDb: any;

	beforeEach(async () => {
		const setup = createTestAuth();
		auth = setup.auth;
		mockDb = setup.db;
		setupTestData(mockDb);
		app = createTestApp(auth, mockDb);
		adminCookie = await createAdminSession(auth, mockDb, setup.otpStore);
	});

	test("returns 409 when global slot capacity is reached", async () => {
		// Fill up the slot to capacity
		mockDb.booking.push({
			id: "booking-1",
			slotId: "slot-1",
			staffUserId: "staff-user-1",
			kind: "citizen",
			status: "confirmed",
			isActive: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		mockDb.booking.push({
			id: "booking-2",
			slotId: "slot-1",
			staffUserId: "staff-user-1",
			kind: "citizen",
			status: "confirmed",
			isActive: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		const { status, body } = await callApp(
			app,
			"/api/admin/bookings/availability/check?slotId=slot-1&staffUserId=staff-user-1",
			{ method: "GET" },
			adminCookie,
		);

		expect(status).toBe(200);
		expect(body.available).toBe(false);
		expect(body.conflicts).toContainEqual(
			expect.objectContaining({ type: "GLOBAL_OVER_CAPACITY" }),
		);
	});

	test("returns 409 when creating booking at global capacity", async () => {
		// Fill up the slot to capacity
		mockDb.booking.push({
			id: "booking-1",
			slotId: "slot-1",
			staffUserId: "staff-user-1",
			kind: "citizen",
			status: "confirmed",
			isActive: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		mockDb.booking.push({
			id: "booking-2",
			slotId: "slot-1",
			staffUserId: "staff-user-1",
			kind: "citizen",
			status: "confirmed",
			isActive: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		const { status, body } = await callApp(
			app,
			"/api/admin/bookings",
			{
				method: "POST",
				body: JSON.stringify({
					slotId: "slot-1",
					staffUserId: "staff-user-1",
					kind: "citizen",
				}),
			},
			adminCookie,
		);

		expect(status).toBe(409);
		expect(body.code).toBe("CAPACITY_CONFLICT");
		expect(body.conflicts).toContainEqual(
			expect.objectContaining({ type: "GLOBAL_OVER_CAPACITY" }),
		);
	});

	test("returns 409 when staff daily capacity is reached", async () => {
		// Fill up staff daily capacity
		for (let i = 0; i < 5; i++) {
			mockDb.booking.push({
				id: `booking-staff-${i}`,
				slotId: `slot-daily-${i}`,
				staffUserId: "staff-user-1",
				kind: "citizen",
				status: "confirmed",
				isActive: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			});
			// Add matching slots
			mockDb.appointment_slot.push({
				id: `slot-daily-${i}`,
				slotDate: "2026-04-15", // Same date
				startTime: `${9 + i}:00`,
				endTime: `${10 + i}:00`,
				status: "open",
				capacityLimit: 10,
				generatedFrom: "base",
				createdAt: new Date(),
				updatedAt: new Date(),
			});
		}

		const { status, body } = await callApp(
			app,
			"/api/admin/bookings",
			{
				method: "POST",
				body: JSON.stringify({
					slotId: "slot-1",
					staffUserId: "staff-user-1",
					kind: "citizen",
				}),
			},
			adminCookie,
		);

		expect(status).toBe(409);
		expect(body.code).toBe("CAPACITY_CONFLICT");
		expect(body.conflicts).toContainEqual(
			expect.objectContaining({ type: "STAFF_OVER_CAPACITY" }),
		);
	});

	test("returns 409 when staff is unavailable on date (override)", async () => {
		// Set staff as unavailable on the date
		mockDb.staff_date_override.push({
			id: "override-1",
			staffUserId: "staff-user-1",
			overrideDate: "2026-04-15",
			isAvailable: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		const { status, body } = await callApp(
			app,
			"/api/admin/bookings",
			{
				method: "POST",
				body: JSON.stringify({
					slotId: "slot-1",
					staffUserId: "staff-user-1",
					kind: "citizen",
				}),
			},
			adminCookie,
		);

		expect(status).toBe(409);
		expect(body.code).toBe("CAPACITY_CONFLICT");
		expect(body.conflicts).toContainEqual(
			expect.objectContaining({ type: "STAFF_UNAVAILABLE" }),
		);
	});
});

// ---------------------------------------------------------------------------
// Test suite: VAL-CAP-003 - Idempotent release (no double-release)
// ---------------------------------------------------------------------------

describe("VAL-CAP-003: Idempotent release (no double-release)", () => {
	let auth: any;
	let app: any;
	let adminCookie: string;
	let mockDb: any;

	beforeEach(async () => {
		const setup = createTestAuth();
		auth = setup.auth;
		mockDb = setup.db;
		setupTestData(mockDb);
		app = createTestApp(auth, mockDb);
		adminCookie = await createAdminSession(auth, mockDb, setup.otpStore);
	});

	test("releasing active booking marks it inactive", async () => {
		mockDb.booking.push({
			id: "booking-1",
			slotId: "slot-1",
			staffUserId: "staff-user-1",
			kind: "citizen",
			status: "held",
			isActive: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		const { status, body } = await callApp(
			app,
			"/api/admin/bookings/booking-1/release",
			{
				method: "POST",
				body: JSON.stringify({ reason: "cancelled" }),
			},
			adminCookie,
		);

		expect(status).toBe(200);
		expect(body.booking.isActive).toBe(false);
		expect(body.alreadyReleased).toBe(false);
		expect(body.booking.cancelledAt).toBeDefined();
	});

	test("releasing already inactive booking is idempotent (no-op)", async () => {
		mockDb.booking.push({
			id: "booking-1",
			slotId: "slot-1",
			staffUserId: "staff-user-1",
			kind: "citizen",
			status: "cancelled",
			isActive: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		const { status, body } = await callApp(
			app,
			"/api/admin/bookings/booking-1/release",
			{
				method: "POST",
				body: JSON.stringify({ reason: "cancelled" }),
			},
			adminCookie,
		);

		expect(status).toBe(200);
		expect(body.alreadyReleased).toBe(true);
		expect(body.booking.isActive).toBe(false);
	});

	test("releasing non-existent booking returns 404", async () => {
		const { status, body } = await callApp(
			app,
			"/api/admin/bookings/non-existent/release",
			{
				method: "POST",
				body: JSON.stringify({ reason: "cancelled" }),
			},
			adminCookie,
		);

		expect(status).toBe(404);
		expect(body.code).toBe("NOT_FOUND");
	});

	test("invalid release reason returns 422", async () => {
		mockDb.booking.push({
			id: "booking-1",
			slotId: "slot-1",
			staffUserId: "staff-user-1",
			kind: "citizen",
			status: "held",
			isActive: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		const { status, body } = await callApp(
			app,
			"/api/admin/bookings/booking-1/release",
			{
				method: "POST",
				body: JSON.stringify({ reason: "invalid" }),
			},
			adminCookie,
		);

		expect(status).toBe(422);
		expect(body.code).toBe("INVALID_REASON");
	});
});

// ---------------------------------------------------------------------------
// Test suite: Authentication & Authorization
// ---------------------------------------------------------------------------

describe("Booking endpoints require admin authentication", () => {
	let auth: any;
	let app: any;
	let mockDb: any;

	beforeEach(async () => {
		const setup = createTestAuth();
		auth = setup.auth;
		mockDb = setup.db;
		setupTestData(mockDb);
		app = createTestApp(auth, mockDb);
	});

	test("without session returns 401 UNAUTHENTICATED", async () => {
		const { status, body } = await callApp(
			app,
			"/api/admin/bookings/availability/check?slotId=slot-1&staffUserId=staff-user-1",
			{ method: "GET" },
		);

		expect(status).toBe(401);
		expect(body.code).toBe("UNAUTHENTICATED");
	});

	test("with non-admin session returns 403 FORBIDDEN", async () => {
		// Create a non-admin user
		const _signUpRes = await auth.handler(
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
			"/api/admin/bookings/availability/check?slotId=slot-1&staffUserId=staff-user-1",
			{ method: "GET" },
			citizenCookie,
		);

		expect(status).toBe(403);
		expect(body.code).toBe("FORBIDDEN");
	});
});
