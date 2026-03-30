import { Hono } from "hono"
import { cors } from "hono/cors"
import { config, hasSuperuserCredentials } from "./config"
import { normalizeError } from "./lib/errors"
import tranzitRoutes from "./modules/tranzit/routes"
import { startHoldReaper } from "./modules/tranzit/service"

const app = new Hono()

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) {
        return config.corsOrigins[0] ?? "*"
      }

      if (config.corsOrigins.includes("*") || config.corsOrigins.includes(origin)) {
        return origin
      }

      return config.corsOrigins[0] ?? "*"
    },
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 86400,
  }),
)

app.get("/", (c) => {
  return c.json({
    service: "tranzit-aux",
    status: "ok",
    pocketbaseUrl: config.pocketbaseUrl,
    superuserConfigured: hasSuperuserCredentials(),
  })
})

app.route("/api/tranzit", tranzitRoutes)

app.notFound((c) => {
  return c.json({ message: "Ruta no encontrada." }, 404)
})

app.onError((error, c) => {
  const normalizedError = normalizeError(error)
  return new Response(
    JSON.stringify({
      message: normalizedError.message,
      code: normalizedError.code,
      data: normalizedError.details ?? {},
    }),
    {
      status: normalizedError.status,
      headers: {
        "content-type": "application/json; charset=UTF-8",
      },
    },
  )
})

startHoldReaper()

const server = Bun.serve({
  port: config.port,
  fetch: app.fetch,
})

console.info(
  `[tranzit-aux] listening on http://127.0.0.1:${server.port} -> PocketBase ${config.pocketbaseUrl}`,
)

export default app
