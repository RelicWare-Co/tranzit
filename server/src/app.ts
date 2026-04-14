import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono";
import { authApp } from "./features/auth/auth.routes";
import { requireRole } from "./middlewares/authorization";
import { adminCorsMiddleware, authCorsMiddleware } from "./middlewares/cors";
import { sessionMiddleware } from "./middlewares/session";
import { createTranzitRpcRouter } from "./orpc/router";
import type { AppVariables } from "./shared/types/app-context";

export const app = new Hono<{ Variables: AppVariables }>();
const rpcRouter = createTranzitRpcRouter();
const rpcHandler = new RPCHandler(rpcRouter);

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

app.get("/", (c) => {
	return c.text("Hello Hono + Better Auth");
});
