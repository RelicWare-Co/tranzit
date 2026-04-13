import { Hono } from "hono";
import { auth } from "./auth";
import { bookingsApp } from "./bookings";
import { db, schema } from "./db";
import { requirePermissions, requireRole } from "./permission-guard";
import {
	reservationInstanceApp,
	reservationSeriesApp,
} from "./reservation-series";
import { scheduleApp } from "./schedule";
import { staffApp } from "./staff";
const { user } = schema;
import { sql } from "drizzle-orm";

type AppVariables = {
	user: typeof auth.$Infer.Session.user | null;
	session: typeof auth.$Infer.Session.session | null;
};

const app = new Hono<{ Variables: AppVariables }>();

/**
 * Per-email OTP send rate limiting.
 *
 * Tracks OTP send attempts by email address (not IP) to prevent abuse
 * where an attacker could exhaust the global IP-based rate limit by
 * varying email addresses.
 *
 * Limit: 3 OTP send requests per email per 60-second window.
 *
 * This is in addition to Better Auth's global IP-based rate limit.
 */

// In-memory store for per-email OTP rate limiting
// Structure: Map<email, { count: number, windowStart: number }>
const emailOtpRateLimitStore = new Map<
	string,
	{ count: number; windowStart: number }
>();

const EMAIL_OTP_RATE_LIMIT_MAX = 3;
const EMAIL_OTP_RATE_LIMIT_WINDOW_MS = 60_000; // 60 seconds

// Cleanup old entries periodically (every 5 minutes)
const cleanupInterval = setInterval(
	() => {
		const now = Date.now();
		for (const [email, entry] of emailOtpRateLimitStore.entries()) {
			if (now - entry.windowStart >= EMAIL_OTP_RATE_LIMIT_WINDOW_MS) {
				emailOtpRateLimitStore.delete(email);
			}
		}
	},
	5 * 60 * 1000,
);
cleanupInterval.unref?.();

/**
 * CORS configuration for auth endpoints.
 *
 * - origin: validates the incoming Origin header before setting credentials.
 *   Returns the validated origin string only for allowed origins, null otherwise.
 *   This prevents browsers from sending credentials to disallowed origins.
 * - Default is corrected to http://localhost:3000 (frontend port).
 */
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";

/**
 * Origin checker function for CORS with credentials.
 * Only allows the exact configured origin to receive Access-Control-Allow-Credentials.
 * Returns the origin string if allowed, null otherwise.
 */
const originChecker = (origin: string | null | undefined): string | null => {
	if (!origin) return null;
	// Only allow the exact configured origin (no wildcards, no partial matches)
	if (origin === corsOrigin) return origin;
	return null;
};

/**
 * Validate origin and apply CORS for /api/auth/* routes.
 */
// biome-ignore lint/suspicious/noExplicitAny: Hono middleware context types
app.use("/api/auth/*", async (c: any, next: any) => {
	const origin = c.req.raw.headers.get("Origin");
	const validatedOrigin = originChecker(origin);

	if (validatedOrigin) {
		c.header("Access-Control-Allow-Origin", validatedOrigin);
		c.header("Access-Control-Allow-Credentials", "true");
		c.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
		c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
		c.header("Access-Control-Expose-Headers", "Content-Length");
		c.header("Access-Control-Max-Age", "600");
	}

	// Handle preflight OPTIONS
	if (c.req.method === "OPTIONS") {
		return c.body(null, validatedOrigin ? 204 : 403);
	}

	await next();
});

/**
 * Validate origin and apply CORS for /api/admin/* routes.
 */
// biome-ignore lint/suspicious/noExplicitAny: Hono middleware context types
app.use("/api/admin/*", async (c: any, next: any) => {
	const origin = c.req.raw.headers.get("Origin");
	const validatedOrigin = originChecker(origin);

	if (validatedOrigin) {
		c.header("Access-Control-Allow-Origin", validatedOrigin);
		c.header("Access-Control-Allow-Credentials", "true");
		c.header(
			"Access-Control-Allow-Methods",
			"POST, GET, PATCH, DELETE, OPTIONS",
		);
		c.header(
			"Access-Control-Allow-Headers",
			"Content-Type, Authorization, Idempotency-Key, If-Match, If-None-Match",
		);
		c.header("Access-Control-Expose-Headers", "Content-Length");
		c.header("Access-Control-Max-Age", "600");
	}

	// Handle preflight OPTIONS
	if (c.req.method === "OPTIONS") {
		return c.body(null, validatedOrigin ? 204 : 403);
	}

	await next();
});

/** Resolve session for every request and store in context. */
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

/**
 * Admin authorization guard for Better Auth admin provider endpoints.
 *
 * - No session → 401 UNAUTHENTICATED
 * - No admin/staff/auditor role → 403 FORBIDDEN
 */
app.use("/api/auth/admin/*", requireRole("admin"));

app.post("/api/admin/onboard", async (c) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });

	if (!session) {
		return c.json(
			{ code: "UNAUTHENTICATED", message: "Debes iniciar sesion" },
			401,
		);
	}

	const existingAdmins = await db
		.select({ id: user.id })
		.from(user)
		.where(sql`${user.role} LIKE '%admin%'`);

	if (existingAdmins.length > 0) {
		return c.json(
			{
				code: "ADMIN_ALREADY_EXISTS",
				message: "El onboarding de admin ya fue completado",
			},
			403,
		);
	}

	await db
		.update(user)
		.set({ role: "admin" })
		.where(sql`${user.id} = ${session.user.id}`);

	return c.json({ success: true, role: "admin" });
});

app.get("/api/admin/onboard/status", async (c) => {
	const existingAdmins = await db
		.select({ id: user.id })
		.from(user)
		.where(sql`${user.role} LIKE '%admin%'`);

	return c.json({ adminExists: existingAdmins.length > 0 });
});

/**
 * Domain admin endpoints guard.
 *
 * Requires at least one of the platform roles (admin, staff, auditor).
 * Individual route groups apply finer-grained permission guards.
 */
app.use("/api/admin/*", requireRole("admin", "staff", "auditor"));

/**
 * Permission guards for each domain module.
 * These are applied BEFORE the route handlers mount.
 */
app.use("/api/admin/schedule/*", requirePermissions({ schedule: ["read"] }));
app.use("/api/admin/staff/*", requirePermissions({ staff: ["read"] }));
app.use("/api/admin/bookings/*", requirePermissions({ booking: ["read"] }));
app.use(
	"/api/admin/reservation-series/*",
	requirePermissions({ "reservation-series": ["read"] }),
);
app.use(
	"/api/admin/reservations/*",
	requirePermissions({ "reservation-series": ["read"] }),
);

/**
 * Application-level session endpoint.
 *
 * Contract: returns 401 with null body when no session is present,
 * and 200 with { user, session } when authenticated.
 *
 * This differs from the auth provider's /api/auth/get-session which
 * returns 200 with null body when no session is present. The app-level
 * endpoint uses 401 to make the unauthenticated state explicit for
 * frontend route guards.
 */
app.get("/session", (c) => {
	const user = c.get("user");
	const session = c.get("session");

	if (!user) return c.json(null, 401);

	return c.json({ user, session });
});

app.get("/", (c) => {
	return c.text("Hello Hono + Better Auth");
});

/**
 * Per-email OTP rate limit handler for send-verification-otp.
 *
 * This is registered BEFORE the generic /api/auth/* handler to intercept
 * the specific send-verification-otp endpoint. It:
 * 1. Reads and parses the request body to extract email
 * 2. Checks rate limit for that email
 * 3. Either returns 429 OR creates a new Request with the body and passes to auth.handler
 *
 * We can't use app.use() with body modification because Request.body is readonly,
 * so we use a specific route registration instead.
 */
app.post("/api/auth/email-otp/send-verification-otp", async (c) => {
	// Read the body
	let bodyText: string;
	try {
		bodyText = await c.req.raw.text();
	} catch {
		// If we can't read the body, delegate to auth handler
		return auth.handler(c.req.raw);
	}

	let email: string | null = null;
	try {
		const body = JSON.parse(bodyText);
		email = body?.email?.toLowerCase() ?? null;
	} catch {
		// If we can't parse the body, delegate to auth handler
		return auth.handler(c.req.raw);
	}

	if (!email) {
		// No email in body - delegate to auth handler for validation
		return auth.handler(c.req.raw);
	}

	// Check rate limit for this email
	const now = Date.now();
	const entry = emailOtpRateLimitStore.get(email);

	if (!entry) {
		// First request from this email in the window - create new request and proceed
		emailOtpRateLimitStore.set(email, { count: 1, windowStart: now });
		const newRequest = new Request(c.req.raw, {
			body: bodyText,
			headers: c.req.raw.headers,
		});
		return auth.handler(newRequest);
	}

	// Check if the window has expired
	const windowElapsed = now - entry.windowStart;

	if (windowElapsed >= EMAIL_OTP_RATE_LIMIT_WINDOW_MS) {
		// Window expired - reset and proceed
		emailOtpRateLimitStore.set(email, { count: 1, windowStart: now });
		const newRequest = new Request(c.req.raw, {
			body: bodyText,
			headers: c.req.raw.headers,
		});
		return auth.handler(newRequest);
	}

	// Window still active - check count
	if (entry.count >= EMAIL_OTP_RATE_LIMIT_MAX) {
		// Rate limit exceeded
		const retryAfter = Math.ceil(
			(EMAIL_OTP_RATE_LIMIT_WINDOW_MS - windowElapsed) / 1000,
		);
		c.header("Retry-After", String(retryAfter));
		c.header("X-RateLimit-Limit", String(EMAIL_OTP_RATE_LIMIT_MAX));
		c.header("X-RateLimit-Remaining", String(0));
		c.header(
			"X-RateLimit-Reset",
			String(
				Math.ceil((entry.windowStart + EMAIL_OTP_RATE_LIMIT_WINDOW_MS) / 1000),
			),
		);
		return c.json(
			{
				code: "RATE_LIMIT_EXCEEDED",
				message: `Too many OTP requests for this email. Please try again in ${retryAfter} seconds.`,
			},
			429,
		);
	}

	// Increment count and proceed
	entry.count += 1;
	emailOtpRateLimitStore.set(email, entry);

	const newRequest = new Request(c.req.raw, {
		body: bodyText,
		headers: c.req.raw.headers,
	});
	return auth.handler(newRequest);
});

app.on(["POST", "GET", "OPTIONS"], "/api/auth/*", (c) => {
	return auth.handler(c.req.raw);
});

/**
 * Mount schedule CRUD routes under /api/admin/schedule/*
 */
app.route("/api/admin/schedule", scheduleApp);

/**
 * Mount staff profile and date override routes under /api/admin/staff/*
 */
app.route("/api/admin/staff", staffApp);

/**
 * Mount booking routes under /api/admin/bookings/*
 */
app.route("/api/admin/bookings", bookingsApp);

/**
 * Mount reservation series routes under /api/admin/reservation-series/*
 */
app.route("/api/admin/reservation-series", reservationSeriesApp);

/**
 * Mount single reservation instance routes under /api/admin/reservations/*
 */
app.route("/api/admin/reservations", reservationInstanceApp);

export default {
	port: 3001,
	fetch: app.fetch,
};
