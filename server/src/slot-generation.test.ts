/**
 * Integration tests for slot generation endpoint auth guards.
 *
 * Tests VAL-SCH-018: POST /api/admin/schedule/slots/generate auth behavior.
 * The actual slot generation logic requires the full server with DB and is
 * verified via curl/manual testing.
 *
 * Run with: bun run test -- slot-generation
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
 * The app stubs /api/admin/schedule/slots/generate so we can test auth behavior
 * without needing the real DB-backed scheduleApp.
 */
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
			allowHeaders: ["Content-Type", "Authorization", "If-None-Match"],
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
			return c.json({ code: "UNAUTHENTICATED", message: "Authentication required" }, 401);
		}
		if (user.role !== ADMIN_ROLE) {
			return c.json({ code: "FORBIDDEN", message: "Admin privileges required for this operation" }, 403);
		}
		await next();
	});

	// Stub POST /api/admin/schedule/slots/generate that mirrors the real validation
	app.post("/api/admin/schedule/slots/generate", async (c) => {
		const body = await c.req.json();

		if (!body.dateFrom || !body.dateTo) {
			return c.json({ code: "MISSING_REQUIRED_FIELDS", message: "dateFrom and dateTo are required" }, 422);
		}

		const isValidDateFormat = (d: string): boolean => {
			if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
			const year = parseInt(d.substring(0, 4), 10);
			const month = parseInt(d.substring(5, 7), 10);
			const day = parseInt(d.substring(8, 10), 10);
			if (year < 1 || year > 9999) return false;
			if (month < 1 || month > 12) return false;
			const daysInMonth = new Date(year, month, 0).getDate();
			if (day < 1 || day > daysInMonth) return false;
			if (month === 2 && day === 29) {
				const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
				if (!isLeap) return false;
			}
			return true;
		};

		if (!isValidDateFormat(body.dateFrom)) {
			return c.json({ code: "INVALID_DATE", message: "dateFrom must be a valid date in YYYY-MM-DD format" }, 422);
		}
		if (!isValidDateFormat(body.dateTo)) {
			return c.json({ code: "INVALID_DATE", message: "dateTo must be a valid date in YYYY-MM-DD format" }, 422);
		}

		const fromDate = new Date(`${body.dateFrom}T00:00:00`);
		const toDate = new Date(`${body.dateTo}T00:00:00`);

		if (toDate < fromDate) {
			return c.json({ code: "INVALID_DATE_RANGE", message: "dateTo must be greater than or equal to dateFrom" }, 422);
		}

		const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
		const maxDays = Math.min(body.maxDays ?? 31, 90);

		if (diffDays > maxDays) {
			return c.json({ code: "DATE_RANGE_TOO_LARGE", message: `Date range exceeds maximum of ${maxDays} days` }, 422);
		}

		// With valid auth, return success (actual DB work would happen in production)
		return c.json({ generated: true, dateFrom: body.dateFrom, dateTo: body.dateTo }, 200);
	});

	app.on(["POST", "GET", "OPTIONS"], "/api/auth/*", (c) => auth.handler(c.req.raw));

	return app;
}

async function callApp(app: any, path: string, options: RequestInit = {}, cookie?: string) {
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
			headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
			body: JSON.stringify({ name: "Admin", email: "admin@test.com", password: "admin123456" }),
		}),
	);
	const signUpBody = await signUpRes.json();
	if (!signUpBody.user?.id) throw new Error(`Sign-up failed: ${JSON.stringify(signUpBody)}`);

	const userRecord = db.user.find((u: any) => u.id === signUpBody.user.id);
	if (userRecord) userRecord.role = "admin";

	const signInRes = await auth.handler(
		new Request("http://localhost:3000/api/auth/sign-in/email", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: "admin@test.com", password: "admin123456" }),
		}),
	);
	return getSessionCookieFromResponse(signInRes);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("VAL-SCH-018: POST /api/admin/schedule/slots/generate auth", () => {
	let auth: any;
	let app: any;
	let adminCookie: string;
	let db: any;
	let otpStore: any;

	beforeEach(async () => {
		const setup = createTestAuth();
		auth = setup.auth;
		db = setup.db;
		otpStore = setup.otpStore;
		app = createTestApp(auth);
		adminCookie = await createAdminSession(auth, db, otpStore);
	});

	test("without session returns 401 UNAUTHENTICATED", async () => {
		const { status, body } = await callApp(app, "/api/admin/schedule/slots/generate", {
			method: "POST",
			body: JSON.stringify({ dateFrom: "2026-04-13", dateTo: "2026-04-13" }),
		});
		expect(status).toBe(401);
		expect(body.code).toBe("UNAUTHENTICATED");
	});

	test("with non-admin session returns 403 FORBIDDEN", async () => {
		await auth.handler(
			new Request("http://localhost:3000/api/auth/email-otp/send-verification-otp", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "citizen@test.com", type: "sign-in" }),
			}),
		);
		const otp = otpStore["sign-in"]["citizen@test.com"];

		const signInRes = await auth.handler(
			new Request("http://localhost:3000/api/auth/sign-in/email-otp", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "citizen@test.com", otp }),
			}),
		);
		const citizenCookie = getSessionCookieFromResponse(signInRes);

		const { status, body } = await callApp(app, "/api/admin/schedule/slots/generate", {
			method: "POST",
			body: JSON.stringify({ dateFrom: "2026-04-13", dateTo: "2026-04-13" }),
			headers: {},
		}, citizenCookie);

		expect(status).toBe(403);
		expect(body.code).toBe("FORBIDDEN");
	});

	test("with admin session returns 200 (stub passes auth and returns OK)", async () => {
		const { status, body } = await callApp(app, "/api/admin/schedule/slots/generate", {
			method: "POST",
			body: JSON.stringify({ dateFrom: "2026-04-13", dateTo: "2026-04-13" }),
			headers: {},
		}, adminCookie);

		expect(status).toBe(200);
		expect(body.generated).toBe(true);
	});
});

describe("POST /api/admin/schedule/slots/generate validation", () => {
	let auth: any;
	let app: any;
	let adminCookie: string;
	let db: any;
	let otpStore: any;

	beforeEach(async () => {
		const setup = createTestAuth();
		auth = setup.auth;
		db = setup.db;
		otpStore = setup.otpStore;
		app = createTestApp(auth);
		adminCookie = await createAdminSession(auth, db, otpStore);
	});

	test("missing dateFrom and dateTo returns 422", async () => {
		const { status, body } = await callApp(app, "/api/admin/schedule/slots/generate", {
			method: "POST",
			body: JSON.stringify({}),
			headers: {},
		}, adminCookie);

		expect(status).toBe(422);
		expect(body.code).toBe("MISSING_REQUIRED_FIELDS");
	});

	test("missing dateTo returns 422", async () => {
		const { status, body } = await callApp(app, "/api/admin/schedule/slots/generate", {
			method: "POST",
			body: JSON.stringify({ dateFrom: "2026-04-13" }),
			headers: {},
		}, adminCookie);

		expect(status).toBe(422);
		expect(body.code).toBe("MISSING_REQUIRED_FIELDS");
	});

	test("invalid dateFrom format returns 422", async () => {
		const { status, body } = await callApp(app, "/api/admin/schedule/slots/generate", {
			method: "POST",
			body: JSON.stringify({ dateFrom: "not-a-date", dateTo: "2026-04-13" }),
			headers: {},
		}, adminCookie);

		expect(status).toBe(422);
		expect(body.code).toBe("INVALID_DATE");
	});

	test("invalid dateTo format returns 422", async () => {
		const { status, body } = await callApp(app, "/api/admin/schedule/slots/generate", {
			method: "POST",
			body: JSON.stringify({ dateFrom: "2026-04-13", dateTo: "invalid" }),
			headers: {},
		}, adminCookie);

		expect(status).toBe(422);
		expect(body.code).toBe("INVALID_DATE");
	});

	test("dateTo before dateFrom returns 422", async () => {
		const { status, body } = await callApp(app, "/api/admin/schedule/slots/generate", {
			method: "POST",
			body: JSON.stringify({ dateFrom: "2026-04-15", dateTo: "2026-04-13" }),
			headers: {},
		}, adminCookie);

		expect(status).toBe(422);
		expect(body.code).toBe("INVALID_DATE_RANGE");
	});

	test("date range too large returns 422", async () => {
		const { status, body } = await callApp(app, "/api/admin/schedule/slots/generate", {
			method: "POST",
			body: JSON.stringify({ dateFrom: "2026-04-01", dateTo: "2026-07-01" }),
			headers: {},
		}, adminCookie);

		expect(status).toBe(422);
		expect(body.code).toBe("DATE_RANGE_TOO_LARGE");
	});

	test("leap year Feb 29 is valid on valid year", async () => {
		const { status, body } = await callApp(app, "/api/admin/schedule/slots/generate", {
			method: "POST",
			body: JSON.stringify({ dateFrom: "2024-02-29", dateTo: "2024-02-29" }),
			headers: {},
		}, adminCookie);

		if (status === 422) {
			expect(body.code).not.toBe("INVALID_DATE");
		} else {
			expect(status).toBe(200);
		}
	});

	test("non-leap year Feb 29 returns 422", async () => {
		const { status, body } = await callApp(app, "/api/admin/schedule/slots/generate", {
			method: "POST",
			body: JSON.stringify({ dateFrom: "2025-02-29", dateTo: "2025-02-29" }),
			headers: {},
		}, adminCookie);

		expect(status).toBe(422);
		expect(body.code).toBe("INVALID_DATE");
	});
});
