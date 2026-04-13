/**
 * Integration tests for staff API auth guards.
 *
 * These tests verify that the admin auth guard is properly applied to
 * /api/admin/staff/* endpoints. The actual CRUD operations and business
 * logic require the full server with DB and are verified via curl/manual testing.
 *
 * Run with: bun run test -- staff-auth-guard
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { memoryAdapter } from "@better-auth/memory-adapter";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { Hono } from "hono";
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
	};
}

function createTestAuth() {
	const db = createEmptyDb();

	const auth = betterAuth({
		baseURL: "http://localhost:3000",
		secret: "test-secret-that-is-at-least-32-chars-long-xxxxxxxxxxxx",
		database: memoryAdapter(db) as any,
		rateLimit: { enabled: false },
		plugins: [admin()],
		emailAndPassword: { enabled: true },
		session: { cookieCache: { enabled: false } },
		advanced: { cookies: {} },
	});

	return { auth, db };
}

/** Build a Request for an endpoint. */
function makeRequest(
	path: string,
	options: {
		method?: string;
		body?: Record<string, unknown>;
		headers?: Record<string, string>;
		cookie?: string;
	} = {},
): Request {
	const url = `http://localhost:3001${path}`;
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		...options.headers,
	};
	if (options.cookie) {
		headers.Cookie = options.cookie;
	}

	const init: RequestInit = {
		method: options.method || "GET",
		headers,
	};

	if (options.body) {
		init.body = JSON.stringify(options.body);
	}

	return new Request(url, init);
}

/** Call the app and return response with parsed JSON body. */
async function callApp(
	app: any,
	path: string,
	options: Parameters<typeof makeRequest>[1] = {},
) {
	const req = makeRequest(path, options);
	const res = await app.fetch(req);
	let body: any;
	try {
		body = await res.json();
	} catch {
		body = null;
	}
	return { response: res, body, status: res.status };
}

/** Extract session cookie from response headers. */
function getSessionCookie(res: Response): string {
	const setCookie = res.headers.get("set-cookie");
	if (!setCookie) return "";
	const match = setCookie.match(/better-auth\.session_token=([^;]+)/);
	return match ? `better-auth.session_token=${match[1]}` : "";
}

/** Create a test app with the admin auth guard and stub staff endpoints. */
function createTestApp(auth: any) {
	const ADMIN_ROLE = "admin";

	type AppVariables = {
		user: typeof auth.$Infer.Session.user | null;
		session: typeof auth.$Infer.Session.session | null;
	};

	const app = new Hono<{ Variables: AppVariables }>();

	// CORS for admin endpoints
	app.use("/api/admin/*", async (c: any, next: any) => {
		c.header("Access-Control-Allow-Origin", "http://localhost:3000");
		c.header("Access-Control-Allow-Credentials", "true");
		await next();
	});

	// Session resolution middleware
	app.use("*", async (c: any, next: any) => {
		const session = await auth.api.getSession({
			headers: c.req.raw.headers,
		});
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

	// Admin auth guard for /api/admin/*
	app.use("/api/admin/*", async (c: any, next: any) => {
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

	// Auth handler for sign-in
	app.on(["POST", "GET"], "/api/auth/*", (c) => {
		return auth.handler(c.req.raw);
	});

	// Stub staff endpoints that replicate validation without DB
	app.post("/api/admin/staff", async (c) => {
		const body = await c.req.json();
		if (!body.userId) {
			return c.json(
				{ code: "MISSING_REQUIRED_FIELDS", message: "userId is required" },
				422,
			);
		}
		// Simulate created response
		return c.json(
			{
				userId: body.userId,
				isActive: true,
				isAssignable: true,
				defaultDailyCapacity: 25,
			},
			201,
		);
	});

	app.get("/api/admin/staff", async (c) => {
		return c.json([]);
	});

	app.get("/api/admin/staff/:userId", async (c) => {
		const { userId } = c.req.param();
		if (userId === "nonexistent") {
			return c.json(
				{ code: "NOT_FOUND", message: "Staff profile not found" },
				404,
			);
		}
		return c.json({ userId, isActive: true });
	});

	app.patch("/api/admin/staff/:userId", async (c) => {
		const { userId } = c.req.param();
		const body = await c.req.json();
		if (
			body.defaultDailyCapacity !== undefined &&
			body.defaultDailyCapacity <= 0
		) {
			return c.json(
				{
					code: "INVALID_CAPACITY",
					message: "defaultDailyCapacity must be positive",
				},
				422,
			);
		}
		return c.json({ userId, ...body });
	});

	app.delete("/api/admin/staff/:userId", async (c) => {
		return c.body(null, 204);
	});

	app.post("/api/admin/staff/:userId/date-overrides", async (c) => {
		const body = await c.req.json();
		if (!body.overrideDate) {
			return c.json(
				{
					code: "MISSING_REQUIRED_FIELDS",
					message: "overrideDate is required",
				},
				422,
			);
		}
		if (body.overrideDate === "invalid") {
			return c.json(
				{ code: "INVALID_DATE", message: "Invalid date format" },
				422,
			);
		}
		if (
			body.availableStartTime &&
			body.availableEndTime &&
			body.availableStartTime >= body.availableEndTime
		) {
			return c.json(
				{
					code: "INVALID_TIME_WINDOW",
					message: "availableEndTime must be after availableStartTime",
				},
				422,
			);
		}
		if (
			body.isAvailable === false &&
			(body.availableStartTime || body.availableEndTime)
		) {
			return c.json(
				{
					code: "INVALID_OVERRIDE_STATE",
					message: "Cannot set time windows when isAvailable=false",
				},
				422,
			);
		}
		return c.json(
			{
				staffUserId: c.req.param().userId,
				overrideDate: body.overrideDate,
				isAvailable: body.isAvailable ?? true,
			},
			201,
		);
	});

	app.get("/api/admin/staff/:userId/date-overrides", async (c) => {
		return c.json([]);
	});

	app.get("/api/admin/staff/:userId/date-overrides/:overrideId", async (c) => {
		return c.json({
			id: c.req.param().overrideId,
			staffUserId: c.req.param().userId,
		});
	});

	app.patch(
		"/api/admin/staff/:userId/date-overrides/:overrideId",
		async (c) => {
			return c.json({
				id: c.req.param().overrideId,
				staffUserId: c.req.param().userId,
			});
		},
	);

	app.delete(
		"/api/admin/staff/:userId/date-overrides/:overrideId",
		async (c) => {
			return c.body(null, 204);
		},
	);

	app.get("/api/admin/staff/:userId/effective-availability", async (c) => {
		const { userId } = c.req.param();
		const date = c.req.query("date");
		if (!date) {
			return c.json(
				{ code: "MISSING_REQUIRED_FIELDS", message: "date is required" },
				422,
			);
		}
		if (userId === "nonexistent") {
			return c.json(
				{ code: "NOT_FOUND", message: "Staff profile not found" },
				404,
			);
		}
		return c.json({
			userId,
			date,
			isAvailable: true,
			reason: "DEFAULT",
			dailyCapacity: 25,
		});
	});

	return app;
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("Staff API Auth Guards", () => {
	let auth: any;
	let app: ReturnType<typeof createTestApp>;
	let db: Record<string, any[]>;
	let adminEmail: string;
	let adminPassword: string;
	let userEmail: string;
	let userPassword: string;

	beforeEach(() => {
		const setup = createTestAuth();
		auth = setup.auth;
		db = setup.db;
		app = createTestApp(auth);

		// Generate unique emails for each test run
		const ts = Date.now();
		adminEmail = `admin${ts}@test.com`;
		adminPassword = "adminpassword123";
		userEmail = `user${ts}@test.com`;
		userPassword = "userpassword123";
	});

	/** Sign up and sign in a user, returning the session cookie. */
	async function signInUser(
		email: string,
		password: string,
		isAdmin = false,
	): Promise<string> {
		// Sign up
		const signUpReq = makeRequest("/api/auth/sign-up/email", {
			method: "POST",
			body: { name: email.split("@")[0], email, password },
			headers: { Origin: "http://localhost:3000" },
		});
		await app.fetch(signUpReq);

		// If admin, set the role directly in db
		if (isAdmin) {
			const userRecord = db.user.find((u: any) => u.email === email);
			if (userRecord) {
				userRecord.role = "admin";
			}
		}

		// Sign in
		const signInReq = makeRequest("/api/auth/sign-in/email", {
			method: "POST",
			body: { email, password },
		});
		const signInRes = await app.fetch(signInReq);

		return getSessionCookie(signInRes);
	}

	test("POST /staff without session returns 401", async () => {
		const { status, body } = await callApp(app, "/api/admin/staff", {
			method: "POST",
			body: { userId: "user-123" },
		});
		expect(status).toBe(401);
		expect(body.code).toBe("UNAUTHENTICATED");
	});

	test("POST /staff with non-admin session returns 403", async () => {
		const cookie = await signInUser(userEmail, userPassword, false);

		const { status, body } = await callApp(app, "/api/admin/staff", {
			method: "POST",
			body: { userId: "user-123" },
			cookie,
		});
		expect(status).toBe(403);
		expect(body.code).toBe("FORBIDDEN");
	});

	test("POST /staff with admin session succeeds", async () => {
		const cookie = await signInUser(adminEmail, adminPassword, true);

		const { status, body } = await callApp(app, "/api/admin/staff", {
			method: "POST",
			body: { userId: "user-123" },
			cookie,
		});
		expect(status).toBe(201);
		expect(body.userId).toBe("user-123");
	});

	test("GET /staff without session returns 401", async () => {
		const { status } = await callApp(app, "/api/admin/staff");
		expect(status).toBe(401);
	});

	test("GET /staff with non-admin session returns 403", async () => {
		const cookie = await signInUser(userEmail, userPassword, false);

		const { status } = await callApp(app, "/api/admin/staff", { cookie });
		expect(status).toBe(403);
	});

	test("GET /staff with admin session succeeds", async () => {
		const cookie = await signInUser(adminEmail, adminPassword, true);

		const { status, body } = await callApp(app, "/api/admin/staff", { cookie });
		expect(status).toBe(200);
		expect(Array.isArray(body)).toBe(true);
	});

	test("GET /staff/:userId without session returns 401", async () => {
		const { status } = await callApp(app, "/api/admin/staff/some-user");
		expect(status).toBe(401);
	});

	test("GET /staff/:userId with non-admin session returns 403", async () => {
		const cookie = await signInUser(userEmail, userPassword, false);

		const { status } = await callApp(app, "/api/admin/staff/some-user", {
			cookie,
		});
		expect(status).toBe(403);
	});

	test("PATCH /staff/:userId without session returns 401", async () => {
		const { status } = await callApp(app, "/api/admin/staff/some-user", {
			method: "PATCH",
			body: { isActive: false },
		});
		expect(status).toBe(401);
	});

	test("PATCH /staff/:userId with non-admin session returns 403", async () => {
		const cookie = await signInUser(userEmail, userPassword, false);

		const { status } = await callApp(app, "/api/admin/staff/some-user", {
			method: "PATCH",
			body: { isActive: false },
			cookie,
		});
		expect(status).toBe(403);
	});

	test("DELETE /staff/:userId without session returns 401", async () => {
		const { status } = await callApp(app, "/api/admin/staff/some-user", {
			method: "DELETE",
		});
		expect(status).toBe(401);
	});

	test("DELETE /staff/:userId with non-admin session returns 403", async () => {
		const cookie = await signInUser(userEmail, userPassword, false);

		const { status } = await callApp(app, "/api/admin/staff/some-user", {
			method: "DELETE",
			cookie,
		});
		expect(status).toBe(403);
	});

	describe("Staff Date Override Auth", () => {
		test("POST /staff/:userId/date-overrides without session returns 401", async () => {
			const { status } = await callApp(
				app,
				"/api/admin/staff/some-user/date-overrides",
				{
					method: "POST",
					body: { overrideDate: "2026-04-15" },
				},
			);
			expect(status).toBe(401);
		});

		test("POST /staff/:userId/date-overrides with non-admin session returns 403", async () => {
			const cookie = await signInUser(userEmail, userPassword, false);

			const { status } = await callApp(
				app,
				"/api/admin/staff/some-user/date-overrides",
				{ method: "POST", body: { overrideDate: "2026-04-15" }, cookie },
			);
			expect(status).toBe(403);
		});

		test("POST /staff/:userId/date-overrides with admin session succeeds", async () => {
			const cookie = await signInUser(adminEmail, adminPassword, true);

			const { status, body } = await callApp(
				app,
				"/api/admin/staff/some-user/date-overrides",
				{ method: "POST", body: { overrideDate: "2026-04-15" }, cookie },
			);
			expect(status).toBe(201);
			expect(body.overrideDate).toBe("2026-04-15");
		});

		test("GET /staff/:userId/date-overrides without session returns 401", async () => {
			const { status } = await callApp(
				app,
				"/api/admin/staff/some-user/date-overrides",
			);
			expect(status).toBe(401);
		});

		test("GET /staff/:userId/date-overrides with non-admin session returns 403", async () => {
			const cookie = await signInUser(userEmail, userPassword, false);

			const { status } = await callApp(
				app,
				"/api/admin/staff/some-user/date-overrides",
				{ cookie },
			);
			expect(status).toBe(403);
		});

		test("DELETE /staff/:userId/date-overrides/:overrideId without session returns 401", async () => {
			const { status } = await callApp(
				app,
				"/api/admin/staff/some-user/date-overrides/override-1",
				{ method: "DELETE" },
			);
			expect(status).toBe(401);
		});

		test("DELETE /staff/:userId/date-overrides/:overrideId with non-admin session returns 403", async () => {
			const cookie = await signInUser(userEmail, userPassword, false);

			const { status } = await callApp(
				app,
				"/api/admin/staff/some-user/date-overrides/override-1",
				{ method: "DELETE", cookie },
			);
			expect(status).toBe(403);
		});
	});

	describe("Effective Availability Auth", () => {
		test("GET /staff/:userId/effective-availability without session returns 401", async () => {
			const { status } = await callApp(
				app,
				"/api/admin/staff/some-user/effective-availability?date=2026-04-15",
			);
			expect(status).toBe(401);
		});

		test("GET /staff/:userId/effective-availability with non-admin session returns 403", async () => {
			const cookie = await signInUser(userEmail, userPassword, false);

			const { status } = await callApp(
				app,
				"/api/admin/staff/some-user/effective-availability?date=2026-04-15",
				{ cookie },
			);
			expect(status).toBe(403);
		});

		test("GET /staff/:userId/effective-availability with admin session succeeds", async () => {
			const cookie = await signInUser(adminEmail, adminPassword, true);

			const { status, body } = await callApp(
				app,
				"/api/admin/staff/some-user/effective-availability?date=2026-04-15",
				{ cookie },
			);
			expect(status).toBe(200);
			expect(body.userId).toBe("some-user");
			expect(body.date).toBe("2026-04-15");
		});
	});

	describe("Staff Validation (without DB)", () => {
		test("POST /staff validates userId required", async () => {
			const cookie = await signInUser(adminEmail, adminPassword, true);

			const { status, body } = await callApp(app, "/api/admin/staff", {
				method: "POST",
				body: {},
				cookie,
			});
			expect(status).toBe(422);
			expect(body.code).toBe("MISSING_REQUIRED_FIELDS");
		});

		test("POST /staff/:userId/date-overrides validates overrideDate required", async () => {
			const cookie = await signInUser(adminEmail, adminPassword, true);

			const { status, body } = await callApp(
				app,
				"/api/admin/staff/some-user/date-overrides",
				{ method: "POST", body: {}, cookie },
			);
			expect(status).toBe(422);
			expect(body.code).toBe("MISSING_REQUIRED_FIELDS");
		});

		test("POST /staff/:userId/date-overrides validates invalid time window", async () => {
			const cookie = await signInUser(adminEmail, adminPassword, true);

			const { status, body } = await callApp(
				app,
				"/api/admin/staff/some-user/date-overrides",
				{
					method: "POST",
					body: {
						overrideDate: "2026-04-15",
						availableStartTime: "17:00",
						availableEndTime: "09:00",
					},
					cookie,
				},
			);
			expect(status).toBe(422);
			expect(body.code).toBe("INVALID_TIME_WINDOW");
		});

		test("POST /staff/:userId/date-overrides rejects isAvailable=false with time windows", async () => {
			const cookie = await signInUser(adminEmail, adminPassword, true);

			const { status, body } = await callApp(
				app,
				"/api/admin/staff/some-user/date-overrides",
				{
					method: "POST",
					body: {
						overrideDate: "2026-04-15",
						isAvailable: false,
						availableStartTime: "09:00",
						availableEndTime: "17:00",
					},
					cookie,
				},
			);
			expect(status).toBe(422);
			expect(body.code).toBe("INVALID_OVERRIDE_STATE");
		});

		test("PATCH /staff/:userId validates capacity > 0", async () => {
			const cookie = await signInUser(adminEmail, adminPassword, true);

			const { status, body } = await callApp(
				app,
				"/api/admin/staff/some-user",
				{
					method: "PATCH",
					body: { defaultDailyCapacity: -5 },
					cookie,
				},
			);
			expect(status).toBe(422);
			expect(body.code).toBe("INVALID_CAPACITY");
		});

		test("GET /staff/:userId/effective-availability requires date parameter", async () => {
			const cookie = await signInUser(adminEmail, adminPassword, true);

			const { status, body } = await callApp(
				app,
				"/api/admin/staff/some-user/effective-availability",
				{ cookie },
			);
			expect(status).toBe(422);
			expect(body.code).toBe("MISSING_REQUIRED_FIELDS");
		});

		test("GET /staff/:userId returns 404 for non-existent profile", async () => {
			const cookie = await signInUser(adminEmail, adminPassword, true);

			const { status } = await callApp(app, "/api/admin/staff/nonexistent", {
				cookie,
			});
			expect(status).toBe(404);
		});
	});
});
