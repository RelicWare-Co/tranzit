import type { MiddlewareHandler } from "hono";
import { auth } from "../features/auth/auth.config";
import type { AppVariables } from "../shared/types/app-context";

export const sessionMiddleware: MiddlewareHandler<AppVariables> = async (c, next) => {
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
};
