import { Hono } from "hono";
import type { AppVariables } from "../../shared/types/app-context";
import { auth } from "./auth.config";

export const authApp = new Hono<{ Variables: AppVariables }>();

const emailOtpRateLimitStore = new Map<
	string,
	{ count: number; windowStart: number }
>();

const EMAIL_OTP_RATE_LIMIT_MAX = 3;
const EMAIL_OTP_RATE_LIMIT_WINDOW_MS = 60_000;

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

authApp.post("/email-otp/send-verification-otp", async (c) => {
	let bodyText: string;
	try {
		bodyText = await c.req.raw.text();
	} catch {
		return auth.handler(c.req.raw);
	}

	let email: string | null = null;
	try {
		const body = JSON.parse(bodyText);
		email = body?.email?.toLowerCase() ?? null;
	} catch {
		return auth.handler(c.req.raw);
	}

	if (!email) {
		return auth.handler(c.req.raw);
	}

	const now = Date.now();
	const entry = emailOtpRateLimitStore.get(email);

	if (!entry) {
		emailOtpRateLimitStore.set(email, { count: 1, windowStart: now });
		const newRequest = new Request(c.req.raw, {
			body: bodyText,
			headers: c.req.raw.headers,
		});
		return auth.handler(newRequest);
	}

	const windowElapsed = now - entry.windowStart;

	if (windowElapsed >= EMAIL_OTP_RATE_LIMIT_WINDOW_MS) {
		emailOtpRateLimitStore.set(email, { count: 1, windowStart: now });
		const newRequest = new Request(c.req.raw, {
			body: bodyText,
			headers: c.req.raw.headers,
		});
		return auth.handler(newRequest);
	}

	if (entry.count >= EMAIL_OTP_RATE_LIMIT_MAX) {
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

	entry.count += 1;
	emailOtpRateLimitStore.set(email, entry);

	const newRequest = new Request(c.req.raw, {
		body: bodyText,
		headers: c.req.raw.headers,
	});
	return auth.handler(newRequest);
});

authApp.on(["POST", "GET", "OPTIONS"], "/*", (c) => {
	return auth.handler(c.req.raw);
});
