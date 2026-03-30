const DEFAULT_POCKETBASE_URL = "http://127.0.0.1:8090"
const DEFAULT_PORT = 8787
const DEFAULT_CORS_ORIGINS = ["http://127.0.0.1:3000", "http://localhost:3000"]
const DEFAULT_HOLD_REAPER_INTERVAL_MS = 60_000

function readOptionalEnv(name: string): string | undefined {
  const rawValue = Bun.env[name]?.trim()
  return rawValue ? rawValue : undefined
}

function readNumberEnv(name: string, fallback: number): number {
  const rawValue = readOptionalEnv(name)
  if (!rawValue) {
    return fallback
  }

  const parsedValue = Number.parseInt(rawValue, 10)
  return Number.isNaN(parsedValue) ? fallback : parsedValue
}

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const rawValue = readOptionalEnv(name)
  if (!rawValue) {
    return fallback
  }

  return !["0", "false", "no"].includes(rawValue.toLowerCase())
}

function readCorsOrigins(): string[] {
  const rawValue = readOptionalEnv("TRANZIT_AUX_CORS_ORIGINS")
  if (!rawValue) {
    return DEFAULT_CORS_ORIGINS
  }

  return rawValue
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
}

export const config = {
  port: readNumberEnv("PORT", DEFAULT_PORT),
  pocketbaseUrl: readOptionalEnv("POCKETBASE_URL") ?? DEFAULT_POCKETBASE_URL,
  pocketbaseSuperuserEmail: readOptionalEnv("POCKETBASE_SUPERUSER_EMAIL"),
  pocketbaseSuperuserPassword: readOptionalEnv("POCKETBASE_SUPERUSER_PASSWORD"),
  pocketbaseSuperuserToken:
    readOptionalEnv("POCKETBASE_SUPERUSER_TOKEN") ??
    readOptionalEnv("POCKETBASE_SUPERUSER_API_KEY"),
  corsOrigins: readCorsOrigins(),
  holdReaperEnabled: readBooleanEnv("TRANZIT_AUX_HOLD_REAPER_ENABLED", true),
  holdReaperIntervalMs: readNumberEnv(
    "TRANZIT_AUX_HOLD_REAPER_INTERVAL_MS",
    DEFAULT_HOLD_REAPER_INTERVAL_MS,
  ),
}

export function hasSuperuserCredentials() {
  return Boolean(
    config.pocketbaseSuperuserToken ||
      (config.pocketbaseSuperuserEmail && config.pocketbaseSuperuserPassword),
  )
}
