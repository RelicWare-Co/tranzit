import PocketBase, { ClientResponseError } from "pocketbase"
import { config, hasSuperuserCredentials } from "../config"
import type { AuthUserRecord } from "../modules/tranzit/types"
import { ApiError } from "./errors"

const USERS_COLLECTION = "users"
const SUPERUSERS_COLLECTION = "_superusers"
const USERS_COLLECTION_ID = "_pb_users_auth_"

const adminClient = new PocketBase(config.pocketbaseUrl)
adminClient.autoCancellation(false)

let adminAuthPromise: Promise<void> | null = null

function createClient(token?: string) {
  const client = new PocketBase(config.pocketbaseUrl)
  client.autoCancellation(false)

  if (token) {
    client.authStore.save(token)
  }

  return client
}

function parseBearerToken(headerValue?: string) {
  const trimmedValue = headerValue?.trim()
  if (!trimmedValue) {
    throw new ApiError(401, "Debes iniciar sesion para continuar.", "missing_auth_token")
  }

  const [scheme, token] = trimmedValue.split(/\s+/)
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    throw new ApiError(401, "El encabezado Authorization no es valido.", "invalid_auth_header")
  }

  return token
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".")
  if (parts.length !== 3) {
    throw new ApiError(401, "El token de autenticacion no es valido.", "invalid_auth_token")
  }

  try {
    const normalizedBase64 = parts[1]
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=")
    const decoded = atob(normalizedBase64)
    return JSON.parse(decoded) as Record<string, unknown>
  } catch {
    throw new ApiError(401, "No fue posible interpretar el token de autenticacion.", "invalid_auth_token")
  }
}

export async function ensureAdminClient() {
  if (config.pocketbaseSuperuserToken) {
    if (adminClient.authStore.token !== config.pocketbaseSuperuserToken) {
      adminClient.authStore.save(config.pocketbaseSuperuserToken)
    }

    return adminClient
  }

  if (!hasSuperuserCredentials()) {
    throw new ApiError(
      500,
      "Faltan las credenciales de superuser para tranzit-aux. Configura POCKETBASE_SUPERUSER_TOKEN o POCKETBASE_SUPERUSER_EMAIL y POCKETBASE_SUPERUSER_PASSWORD.",
      "missing_superuser_credentials",
    )
  }

  if (adminClient.authStore.isValid) {
    return adminClient
  }

  if (!adminAuthPromise) {
    adminAuthPromise = adminClient
      .collection(SUPERUSERS_COLLECTION)
      .authWithPassword(
        config.pocketbaseSuperuserEmail!,
        config.pocketbaseSuperuserPassword!,
        { autoRefreshThreshold: 30 * 60 },
      )
      .then(() => undefined)
      .finally(() => {
        adminAuthPromise = null
      })
  }

  await adminAuthPromise
  return adminClient
}

export function createPublicClient() {
  return createClient()
}

export async function authenticateUser(authorizationHeader?: string) {
  const token = parseBearerToken(authorizationHeader)
  const payload = decodeJwtPayload(token)
  const userId = typeof payload.id === "string" ? payload.id : ""
  const collectionId = typeof payload.collectionId === "string" ? payload.collectionId : ""

  if (!userId || collectionId !== USERS_COLLECTION_ID) {
    throw new ApiError(401, "El token de autenticacion no corresponde a un usuario valido.", "invalid_auth_token")
  }

  const userClient = createClient(token)

  try {
    const user = await userClient.collection(USERS_COLLECTION).getOne<AuthUserRecord>(userId)
    return {
      token,
      user,
      userClient,
    }
  } catch (error) {
    if (error instanceof ClientResponseError && [401, 403, 404].includes(error.status)) {
      throw new ApiError(401, "La sesion ya no es valida. Inicia sesion nuevamente.", "invalid_auth_token")
    }

    throw error
  }
}
