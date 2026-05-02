import type { MiddlewareHandler } from "hono";
import { CORS_ORIGIN, TRUSTED_ORIGINS } from "../lib/env";

const ALLOWED_ORIGINS = new Set([CORS_ORIGIN, ...TRUSTED_ORIGINS]);

const originChecker = (origin: string | null | undefined): string | null => {
	if (!origin) return null;
	if (ALLOWED_ORIGINS.has(origin)) return origin;
	return null;
};

function applyCorsHeaders(
	c: Parameters<MiddlewareHandler>[0],
	validatedOrigin: string,
	methods: string,
	allowHeaders: string,
) {
	c.header("Access-Control-Allow-Origin", validatedOrigin);
	c.header("Access-Control-Allow-Credentials", "true");
	c.header("Access-Control-Allow-Methods", methods);
	c.header("Access-Control-Allow-Headers", allowHeaders);
	c.header("Access-Control-Expose-Headers", "Content-Length");
	c.header("Access-Control-Max-Age", "600");
}

export const authCorsMiddleware: MiddlewareHandler = async (c, next) => {
	const origin = c.req.raw.headers.get("Origin");
	const validatedOrigin = originChecker(origin);

	if (validatedOrigin) {
		applyCorsHeaders(
			c,
			validatedOrigin,
			"POST, GET, OPTIONS",
			"Content-Type, Authorization",
		);
	}

	if (c.req.method === "OPTIONS") {
		return c.body(null, 204);
	}

	await next();
};

export const adminCorsMiddleware: MiddlewareHandler = async (c, next) => {
	const origin = c.req.raw.headers.get("Origin");
	const validatedOrigin = originChecker(origin);

	if (validatedOrigin) {
		applyCorsHeaders(
			c,
			validatedOrigin,
			"POST, GET, PATCH, DELETE, OPTIONS",
			"Content-Type, Authorization, Idempotency-Key, If-Match, If-None-Match",
		);
	}

	if (c.req.method === "OPTIONS") {
		return c.body(null, 204);
	}

	await next();
};
