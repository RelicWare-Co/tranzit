/**
 * Extract client information from request headers for audit logging.
 * Returns the client IP (from x-forwarded-for or direct) and user agent.
 */
export function extractClientInfo(headers: Headers) {
	// Get the forwarded-for header and take the first IP (original client)
	const forwardedFor = headers.get("x-forwarded-for");
	const ipAddress = forwardedFor
		? forwardedFor.split(",")[0]?.trim() ?? null
		: null;

	const userAgent = headers.get("user-agent") ?? null;

	return { ipAddress, userAgent };
}
