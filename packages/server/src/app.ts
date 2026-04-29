import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { initLogger, parseError } from "evlog";
import { evlog } from "evlog/hono";
import { authApp } from "./features/auth/auth.routes";
import { requireRole } from "./middleware/authorization";
import { adminCorsMiddleware, authCorsMiddleware } from "./middleware/cors";
import { sessionMiddleware } from "./middleware/session";
import { createTranzitRpcRouter } from "./shared/orpc/router";
import type { AppVariables } from "./shared/types/app-context";

initLogger({
	env: { service: "tranzit-api" },
});

export const app = new Hono<AppVariables>();
const rpcRouter = createTranzitRpcRouter();
const rpcHandler = new RPCHandler(rpcRouter, {
	strictGetMethodPluginEnabled: false,
});

app.use(evlog());
app.use("/api/auth/*", authCorsMiddleware);
app.use("/api/rpc/*", adminCorsMiddleware);

app.use("/api/rpc/*", async (c, next) => {
	const { matched, response } = await rpcHandler.handle(c.req.raw, {
		prefix: "/api/rpc",
		context: {
			headers: c.req.raw.headers,
		},
	});

	if (matched && response) {
		return await response;
	}

	await next();
});

app.use("/api/auth/admin/*", sessionMiddleware);
app.use("/api/auth/admin/*", requireRole("admin"));

app.route("/api/auth", authApp);

app.onError((error, c) => {
	c.get("log")?.error(error);
	const parsed = parseError(error);

	return c.json(
		{
			code: "INTERNAL_SERVER_ERROR",
			message: parsed?.message || "Internal server error",
			why: parsed?.why,
			fix: parsed?.fix,
			link: parsed?.link,
		},
		(parsed?.status || 500) as ContentfulStatusCode,
	);
});

app.get("/", (c) => {
	return c.text("Hello Hono + Better Auth");
});
