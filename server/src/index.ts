import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth";

type AppVariables = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
};

const app = new Hono<{ Variables: AppVariables }>();

app.use(
  "/api/auth/*",
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3001",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "OPTIONS"],
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

app.get("/session", (c) => {
  const user = c.get("user");
  const session = c.get("session");

  if (!user) return c.json(null, 401);

  return c.json({ user, session });
});

app.get("/", (c) => {
  return c.text("Hello Hono + Better Auth");
});

app.on(["POST", "GET", "OPTIONS"], "/api/auth/*", (c) => {
  return auth.handler(c.req.raw);
});

export default {
  port: 3001,
  fetch: app.fetch,
};
