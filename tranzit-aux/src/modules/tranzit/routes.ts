import { Hono } from "hono"
import { ApiError } from "../../lib/errors"
import {
  availabilityQuerySchema,
  confirmAppointmentSchema,
  holdAppointmentSchema,
  requestOtpSchema,
  verifyOtpSchema,
} from "./schemas"
import {
  confirmAppointment,
  getAvailability,
  holdAppointment,
  listActiveServices,
  requestOtp,
  verifyOtp,
} from "./service"

const tranzitRoutes = new Hono()

function parseJsonString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return undefined
  }

  try {
    return JSON.parse(trimmedValue)
  } catch {
    throw new ApiError(400, "Se recibio un campo JSON con formato invalido.", "invalid_json")
  }
}

tranzitRoutes.get("/services", async (c) => {
  const services = await listActiveServices()
  return c.json({ items: services })
})

tranzitRoutes.get("/availability", async (c) => {
  const input = availabilityQuerySchema.parse({
    date: c.req.query("date"),
    serviceId: c.req.query("serviceId"),
  })

  return c.json(await getAvailability(input))
})

tranzitRoutes.post("/auth/request-otp", async (c) => {
  const input = requestOtpSchema.parse(await c.req.json())
  return c.json(await requestOtp(input))
})

tranzitRoutes.post("/auth/verify-otp", async (c) => {
  const input = verifyOtpSchema.parse(await c.req.json())
  return c.json(await verifyOtp(input))
})

tranzitRoutes.post("/appointments/hold", async (c) => {
  const input = holdAppointmentSchema.parse(await c.req.json())
  const authorizationHeader = c.req.header("authorization")
  return c.json(await holdAppointment(input, authorizationHeader), 201)
})

tranzitRoutes.post("/appointments/confirm", async (c) => {
  const authorizationHeader = c.req.header("authorization")
  const contentType = c.req.header("content-type") || ""

  let rawInput: Record<string, unknown>
  let attachments: File[] = []

  if (contentType.includes("multipart/form-data")) {
    const formData = await c.req.formData()

    rawInput = {
      appointmentId: formData.get("appointmentId"),
      applicantName: formData.get("applicantName"),
      applicantPhone: formData.get("applicantPhone"),
      documentType: formData.get("documentType"),
      documentNumber: formData.get("documentNumber"),
      vehiclePlate: formData.get("vehiclePlate"),
      vehicleRegisteredLocally: formData.get("vehicleRegisteredLocally"),
      deliveryMode: formData.get("deliveryMode"),
      initialChecks: parseJsonString(formData.get("initialChecks")),
      intakePayload: parseJsonString(formData.get("intakePayload")),
    }

    attachments = formData
      .getAll("attachments")
      .filter((value): value is File => value instanceof File && value.size > 0)
  } else {
    rawInput = await c.req.json()
  }

  const input = confirmAppointmentSchema.parse(rawInput)
  return c.json(await confirmAppointment(input, attachments, authorizationHeader))
})

export default tranzitRoutes
