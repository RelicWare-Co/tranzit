import { ClientResponseError } from "pocketbase"
import { ZodError } from "zod"

export class ApiError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(status: number, message: string, code = "api_error", details?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.details = details
  }
}

function extractPocketBaseMessage(error: ClientResponseError): string {
  if (typeof error.response?.message === "string" && error.response.message.trim()) {
    return error.response.message
  }

  if (typeof error.data?.message === "string" && error.data.message.trim()) {
    return error.data.message
  }

  return error.message || "PocketBase request failed."
}

export function isUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof ClientResponseError)) {
    return false
  }

  const serialized = JSON.stringify(error.response?.data ?? error.data ?? {})
  const message = `${error.message} ${serialized}`.toLowerCase()
  return error.status === 400 && (
    message.includes("unique") ||
    message.includes("constraint") ||
    message.includes("duplicate")
  )
}

export function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error
  }

  if (error instanceof ZodError) {
    return new ApiError(400, "Payload invalido.", "validation_error", error.flatten())
  }

  if (error instanceof ClientResponseError) {
    const status = error.status || 500
    return new ApiError(status, extractPocketBaseMessage(error), "pocketbase_error", error.response?.data ?? error.data)
  }

  if (error instanceof Error) {
    return new ApiError(500, error.message || "Unexpected server error.", "unexpected_error")
  }

  return new ApiError(500, "Unexpected server error.", "unexpected_error")
}
