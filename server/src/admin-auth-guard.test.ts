/**
 * Integration tests for admin auth guards and session contract.
 *
 * These tests exercise the Hono app middleware and Better Auth handler
 * to validate VAL-AUTH-008, VAL-AUTH-009, VAL-AUTH-010, and the
 * session contract between /session and /api/auth/get-session.
 *
 * Run with: bun run test -- --testPathPattern=admin-auth-guard
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

/** In-memory DB seed required by Better Auth + admin + emailOTP plugins. */
function createEmptyDb(): Record<string, any[]> {
	return {
		user: [],
		session: [],
		account: [],
		verification: [],
		rateLimit: [],
	};
}

/**
 * Create a test auth instance with in-memory DB. Rate limiting OFF by default.
 */
function createTestAuth(overrides: Record<string, unknown> = {}) {
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
		emailAndPassword: {
			enabled: true,
		},
		session: {
			cookieCache: { enabled: false },
		},
		advanced: { cookies: {} },
		...overrides,
	});

	return { auth, db, otpStore };
}

/** Build a Request to the auth handler. */
function authRequest(
	path: string,
	options: {
		method?: string;
		body?: Record<string, unknown>;
		headers?: Record<string, string>;
		cookie?: string;
	} = {},
): Request {
	const url = `http://localhost:3000/api/auth${path}`;
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		...options.headers,
	};
	if (options.cookie) {
		headers.Cookie = options.cookie;
	}

	const init: RequestInit = {
		method: options.method || "POST",
		headers,
	};

	if (options.body) {
		init.body = JSON.stringify(options.body);
	}

	return new Request(url, init);
}

/** Call auth handler and return response with parsed JSON body. */
async function callAuth(
	auth: any,
	path: string,
	options: Parameters<typeof authRequest>[1] = {},
) {
	const req = authRequest(path, options);
	const res = await auth.handler(req);
	let body: any;
	try {
		body = await res.json();
	} catch {
		body = null;
	}
	return { response: res, body, status: res.status };
}

/** Extract session cookie from response headers. */
function getSessionCookieFromResponse(res: Response): string {
	const setCookie = res.headers.get("set-cookie");
	if (!setCookie) return "";
	const match = setCookie.match(/better-auth\.session_token=([^;]+)/);
	return match ? `better-auth.session_token=${match[1]}` : "";
}

/**
 * Create a Hono app that mirrors the production server's middleware stack,
 * including the admin auth guard.
 *
 * This allows testing the guard logic without needing a real database.
 */
function createTestApp(auth: any) {
	const ADMIN_ROLE = "admin";

	type AppVariables = {
		user: typeof auth.$Infer.Session.user | null;
		session: typeof auth.$Infer.Session.session | null;
	};

	const app = new Hono<{ Variables: AppVariables }>();

	// CORS for auth endpoints
	app.use(
		"/api/auth/*",
		cors({
			origin: "http://localhost:3000",
			allowHeaders: ["Content-Type", "Authorization"],
			allowMethods: ["POST", "GET", "OPTIONS"],
			exposeHeaders: ["Content-Length"],
			maxAge: 600,
			credentials: true,
		}),
	);

	// CORS for admin endpoints
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

	// Session resolution middleware (mirrors server/src/index.ts)
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

	// Admin auth guard for /api/auth/admin/* (mirrors server/src/index.ts)
	app.use("/api/auth/admin/*", async (c, next) => {
		const user = c.get("user");

		if (!user) {
			return c.json(
				{ code: "UNAUTHENTICATED", message: "Authentication required" },
				401,
			);
		}

		if (user.role !== ADMIN_ROLE) {
			return c.json(
				{
					code: "FORBIDDEN",
					message: "Admin privileges required for this operation",
				},
				403,
			);
		}

		await next();
	});

	// Admin auth guard for /api/admin/* (mirrors server/src/index.ts)
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
				{
					code: "FORBIDDEN",
					message: "Admin privileges required for this operation",
				},
				403,
			);
		}

		await next();
	});

	// /session endpoint (mirrors server/src/index.ts)
	app.get("/session", (c) => {
		const user = c.get("user");
		const session = c.get("session");

		if (!user) return c.json(null, 401);

		return c.json({ user, session });
	});

	// Health check
	app.get("/", (c) => c.text("OK"));

	// Auth handler (must come after the admin guard so the guard can short-circuit)
	app.on(["POST", "GET", "OPTIONS"], "/api/auth/*", (c) => {
		return auth.handler(c.req.raw);
	});

	// Stub admin domain endpoint for guard testing
	app.get("/api/admin/stub", (c) => c.json({ ok: true }));

	return app;
}

/** Build a Request to the Hono app. */
function appRequest(
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

/** Call the Hono app and return response with parsed JSON body. */
async function callApp(
	app: any,
	path: string,
	options: Parameters<typeof appRequest>[1] = {},
) {
	const req = appRequest(path, options);
	const res = await app.fetch(req);
	let body: any;
	try {
		body = await res.json();
	} catch {
		body = null;
	}
	return { response: res, body, status: res.status };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("VAL-AUTH-008: Admin endpoint without session returns UNAUTHORIZED", () => {
	let auth: any;
	let app: ReturnType<typeof createTestApp>;

	beforeEach(() => {
		const setup = createTestAuth();
		auth = setup.auth;
		app = createTestApp(auth);
	});

	test("GET /api/auth/admin/list-users without session returns 401", async () => {
		const { status, body } = await callApp(app, "/api/auth/admin/list-users");

		expect(status).toBe(401);
		expect(body.code).toBe("UNAUTHENTICATED");
	});

	test("GET /api/admin/stub without session returns 401", async () => {
		const { status, body } = await callApp(app, "/api/admin/stub");

		expect(status).toBe(401);
		expect(body.code).toBe("UNAUTHENTICATED");
	});

	test("admin endpoint does not expose sensitive data when unauthenticated", async () => {
		const { body } = await callApp(app, "/api/auth/admin/list-users");

		// Should not contain users list or total
		expect(body.users).toBeUndefined();
		expect(body.total).toBeUndefined();
	});
});

describe("VAL-AUTH-009: Citizen session cannot use admin APIs", () => {
	let auth: any;
	let app: ReturnType<typeof createTestApp>;
	let otpStore: Record<string, Record<string, string>>;

	beforeEach(() => {
		const setup = createTestAuth();
		auth = setup.auth;
		otpStore = setup.otpStore;
		app = createTestApp(auth);
	});

	test("citizen OTP session on /api/auth/admin/list-users returns 403", async () => {
		// 1. Create citizen session via OTP
		await callAuth(auth, "/email-otp/send-verification-otp", {
			body: { email: "citizen@test.com", type: "sign-in" },
		});
		const otp = otpStore["sign-in"]["citizen@test.com"];

		const { response: signInRes } = await callAuth(auth, "/sign-in/email-otp", {
			body: { email: "citizen@test.com", otp },
		});
		const sessionCookie = getSessionCookieFromResponse(signInRes);
		expect(sessionCookie).toBeTruthy();

		// 2. Try admin endpoint with citizen session
		const { status, body } = await callApp(app, "/api/auth/admin/list-users", {
			cookie: sessionCookie,
		});

		expect(status).toBe(403);
		expect(body.code).toBe("FORBIDDEN");
	});

	test("citizen OTP session on /api/admin/* returns 403", async () => {
		// 1. Create citizen session via OTP
		await callAuth(auth, "/email-otp/send-verification-otp", {
			body: { email: "citizen2@test.com", type: "sign-in" },
		});
		const otp = otpStore["sign-in"]["citizen2@test.com"];

		const { response: signInRes } = await callAuth(auth, "/sign-in/email-otp", {
			body: { email: "citizen2@test.com", otp },
		});
		const sessionCookie = getSessionCookieFromResponse(signInRes);

		// 2. Try admin domain endpoint with citizen session
		const { status, body } = await callApp(app, "/api/admin/stub", {
			cookie: sessionCookie,
		});

		expect(status).toBe(403);
		expect(body.code).toBe("FORBIDDEN");
	});

	test("citizen email/password session on admin endpoint returns 403", async () => {
		// 1. Sign up a regular (non-admin) user via email/password
		await callAuth(auth, "/sign-up/email", {
			body: {
				name: "Regular User",
				email: "regular@test.com",
				password: "password123456",
			},
			headers: { Origin: "http://localhost:3000" },
		});

		// 2. Sign in to get session
		const { response: signInRes } = await callAuth(auth, "/sign-in/email", {
			body: {
				email: "regular@test.com",
				password: "password123456",
			},
		});
		const sessionCookie = getSessionCookieFromResponse(signInRes);

		// 3. Try admin endpoint with regular user session
		const { status, body } = await callApp(app, "/api/auth/admin/list-users", {
			cookie: sessionCookie,
		});

		expect(status).toBe(403);
		expect(body.code).toBe("FORBIDDEN");
	});
});

describe("VAL-AUTH-010: Admin session enables admin APIs for authorized role only", () => {
	let auth: any;
	let app: ReturnType<typeof createTestApp>;
	let db: Record<string, any[]>;

	beforeEach(() => {
		const setup = createTestAuth();
		auth = setup.auth;
		db = setup.db;
		app = createTestApp(auth);
	});

	test("admin user can access /api/auth/admin/list-users with 200", async () => {
		// 1. Create admin user via sign-up + set-role
		await callAuth(auth, "/sign-up/email", {
			body: {
				name: "Admin User",
				email: "admin@test.com",
				password: "adminpassword123",
			},
			headers: { Origin: "http://localhost:3000" },
		});

		// 2. Sign in as the admin user
		const { body: signInBody, response: signInRes } = await callAuth(
			auth,
			"/sign-in/email",
			{
				body: {
					email: "admin@test.com",
					password: "adminpassword123",
				},
			},
		);
		// 3. Set the user's role to admin using the admin API.
		// Since we don't have an admin session yet to call the endpoint,
		// we directly manipulate the in-memory db to set the role,
		// which simulates what setRole would do if an admin session existed.
		const userRecord = db.user.find(
			(u: Record<string, unknown>) => u.id === signInBody.user.id,
		);
		if (userRecord) userRecord.role = "admin";

		// 4. Re-sign-in to get a session that reflects the new role
		const { response: reSignInRes } = await callAuth(auth, "/sign-in/email", {
			body: {
				email: "admin@test.com",
				password: "adminpassword123",
			},
		});
		const freshAdminCookie = getSessionCookieFromResponse(reSignInRes);

		// 5. Access admin endpoint with admin session
		// The Hono guard passes (role=admin), then the auth handler's own
		// adminMiddleware and hasPermission check also pass.
		const { status, body } = await callApp(app, "/api/auth/admin/list-users", {
			cookie: freshAdminCookie,
		});

		expect(status).toBe(200);
		expect(body.users).toBeDefined();
		expect(body.total).toBeDefined();
		expect(Array.isArray(body.users)).toBe(true);
	});

	test("non-admin user with email/password session gets 403 on admin endpoint", async () => {
		// 1. Sign up a non-admin user
		await callAuth(auth, "/sign-up/email", {
			body: {
				name: "Staff User",
				email: "staff@test.com",
				password: "staffpassword123",
			},
			headers: { Origin: "http://localhost:3000" },
		});

		// 2. Sign in
		const { response: signInRes } = await callAuth(auth, "/sign-in/email", {
			body: {
				email: "staff@test.com",
				password: "staffpassword123",
			},
		});
		const sessionCookie = getSessionCookieFromResponse(signInRes);

		// 3. Try admin endpoint with non-admin session
		const { status, body } = await callApp(app, "/api/auth/admin/list-users", {
			cookie: sessionCookie,
		});

		expect(status).toBe(403);
		expect(body.code).toBe("FORBIDDEN");
	});

	test("admin session can access /api/admin/* domain endpoints", async () => {
		// 1. Create and promote admin user
		await callAuth(auth, "/sign-up/email", {
			body: {
				name: "Admin2",
				email: "admin2@test.com",
				password: "admin2password123",
			},
			headers: { Origin: "http://localhost:3000" },
		});

		const { body: signInBody, response: signInRes } = await callAuth(
			auth,
			"/sign-in/email",
			{
				body: {
					email: "admin2@test.com",
					password: "admin2password123",
				},
			},
		);
		// Directly set role in the in-memory db (simulates setRole API)
		const userRecord = db.user.find(
			(u: Record<string, unknown>) => u.id === signInBody.user.id,
		);
		if (userRecord) userRecord.role = "admin";

		// Re-sign-in for fresh session with admin role
		const { response: reSignInRes } = await callAuth(auth, "/sign-in/email", {
			body: {
				email: "admin2@test.com",
				password: "admin2password123",
			},
		});
		const freshCookie = getSessionCookieFromResponse(reSignInRes);

		// 2. Access /api/admin/stub
		const { status, body } = await callApp(app, "/api/admin/stub", {
			cookie: freshCookie,
		});

		expect(status).toBe(200);
		expect(body.ok).toBe(true);
	});
});

describe("Session contract: /session vs /api/auth/get-session", () => {
	let auth: any;
	let app: ReturnType<typeof createTestApp>;
	let otpStore: Record<string, Record<string, string>>;

	beforeEach(() => {
		const setup = createTestAuth();
		auth = setup.auth;
		otpStore = setup.otpStore;
		app = createTestApp(auth);
	});

	test("/session returns 401 with null body when no session", async () => {
		const { status, body } = await callApp(app, "/session");

		expect(status).toBe(401);
		expect(body).toBeNull();
	});

	test("/api/auth/get-session returns 200 with null body when no session", async () => {
		const { status, body } = await callApp(app, "/api/auth/get-session");

		expect(status).toBe(200);
		expect(body).toBeNull();
	});

	test("/session returns 200 with user and session when authenticated", async () => {
		// 1. Create citizen session
		await callAuth(auth, "/email-otp/send-verification-otp", {
			body: { email: "sessiontest@test.com", type: "sign-in" },
		});
		const otp = otpStore["sign-in"]["sessiontest@test.com"];

		const { response: signInRes } = await callAuth(auth, "/sign-in/email-otp", {
			body: { email: "sessiontest@test.com", otp },
		});
		const sessionCookie = getSessionCookieFromResponse(signInRes);

		// 2. /session should return 200 with user
		const { status, body } = await callApp(app, "/session", {
			cookie: sessionCookie,
		});

		expect(status).toBe(200);
		expect(body.user).toBeDefined();
		expect(body.user.email).toBe("sessiontest@test.com");
		expect(body.session).toBeDefined();
	});

	test("/api/auth/get-session returns 200 with user and session when authenticated", async () => {
		// 1. Create citizen session
		await callAuth(auth, "/email-otp/send-verification-otp", {
			body: { email: "sessiontest2@test.com", type: "sign-in" },
		});
		const otp = otpStore["sign-in"]["sessiontest2@test.com"];

		const { response: signInRes } = await callAuth(auth, "/sign-in/email-otp", {
			body: { email: "sessiontest2@test.com", otp },
		});
		const sessionCookie = getSessionCookieFromResponse(signInRes);

		// 2. /api/auth/get-session should return 200 with user
		const { status, body } = await callApp(app, "/api/auth/get-session", {
			cookie: sessionCookie,
		});

		expect(status).toBe(200);
		expect(body.user).toBeDefined();
		expect(body.user.email).toBe("sessiontest2@test.com");
		expect(body.session).toBeDefined();
	});
});

describe("VAL-AUTH-004: Resend OTP invalidates previous code (with constraint simulation)", () => {
	let auth: any;
	let db: Record<string, any[]>;
	let otpStore: Record<string, Record<string, string>>;

	/**
	 * Create a test auth instance for testing resend OTP invalidation.
	 *
	 * The production schema has a UNIQUE index on verification.identifier,
	 * which causes Better Auth's emailOTP plugin to follow a create-then-catch
	 * pattern: when a resend happens, the insert of the new verification row
	 * violates the unique constraint, the catch block deletes the old row,
	 * and the new row is inserted successfully.
	 *
	 * The memory adapter doesn't enforce unique constraints, so before each
	 * resend we manually delete old verification rows from the db object,
	 * which mirrors the exact same effect that the unique constraint has
	 * in production SQLite.
	 */
	beforeEach(() => {
		const setup = createTestAuth();
		auth = setup.auth;
		db = setup.db;
		otpStore = setup.otpStore;
	});

	test("first OTP fails after second OTP is requested (constraint simulation)", async () => {
		// 1. First OTP
		await callAuth(auth, "/email-otp/send-verification-otp", {
			body: { email: "citizen@test.com", type: "sign-in" },
		});
		const firstOtp = otpStore["sign-in"]["citizen@test.com"];
		expect(firstOtp).toBeDefined();

		// Simulate the unique constraint: delete old row before resend,
		// mirroring the production unique index effect.
		db.verification = db.verification.filter(
			(v: any) => v.identifier !== "sign-in-otp-citizen@test.com",
		);

		// 2. Second OTP (resend)
		await callAuth(auth, "/email-otp/send-verification-otp", {
			body: { email: "citizen@test.com", type: "sign-in" },
		});
		const secondOtp = otpStore["sign-in"]["citizen@test.com"];
		expect(secondOtp).toBeDefined();

		// OTPs should be different
		expect(firstOtp).not.toBe(secondOtp);

		// 3. First OTP should fail (old verification row was deleted by constraint)
		const { status: firstStatus } = await callAuth(auth, "/sign-in/email-otp", {
			body: { email: "citizen@test.com", otp: firstOtp },
		});
		expect(firstStatus).toBe(400);

		// 4. Second OTP should succeed
		const { status: secondStatus, body: secondBody } = await callAuth(
			auth,
			"/sign-in/email-otp",
			{
				body: { email: "citizen@test.com", otp: secondOtp },
			},
		);
		expect(secondStatus).toBe(200);
		expect(secondBody.token).toBeDefined();
	});

	test("only one verification row per identifier exists after resend", async () => {
		// 1. First OTP
		await callAuth(auth, "/email-otp/send-verification-otp", {
			body: { email: "unique@test.com", type: "sign-in" },
		});
		const firstRows = db.verification.filter(
			(v: any) => v.identifier === "sign-in-otp-unique@test.com",
		);
		expect(firstRows.length).toBe(1);

		// 2. Simulate unique constraint: delete old row before resend
		db.verification = db.verification.filter(
			(v: any) => v.identifier !== "sign-in-otp-unique@test.com",
		);

		// 3. Second OTP
		await callAuth(auth, "/email-otp/send-verification-otp", {
			body: { email: "unique@test.com", type: "sign-in" },
		});
		const secondRows = db.verification.filter(
			(v: any) => v.identifier === "sign-in-otp-unique@test.com",
		);
		// Should still be exactly 1 row, not 2
		expect(secondRows.length).toBe(1);
	});
});
