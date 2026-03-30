import { z } from "zod"

const dateKeySchema = z.string().trim().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
const nonEmptyStringSchema = z.string().trim().min(1)
const optionalTrimmedStringSchema = z.string().trim().optional().transform((value) => value || undefined)
const booleanishSchema = z.union([z.boolean(), z.string(), z.number()])

export const documentTypeSchema = z.enum([
  "cedula_ciudadania",
  "cedula_extranjeria",
  "tarjeta_identidad",
  "pasaporte",
  "nit",
  "otro",
])

export const deliveryModeSchema = z.enum(["digital_upload", "physical_delivery"])

export const availabilityQuerySchema = z.object({
  date: dateKeySchema,
  serviceId: optionalTrimmedStringSchema,
})

export const requestOtpSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  name: optionalTrimmedStringSchema,
  phone: optionalTrimmedStringSchema,
  documentType: documentTypeSchema.optional(),
  documentNumber: optionalTrimmedStringSchema,
  vehiclePlate: optionalTrimmedStringSchema,
})

export const verifyOtpSchema = z.object({
  otpId: nonEmptyStringSchema,
  password: nonEmptyStringSchema,
})

export const holdAppointmentSchema = z.object({
  serviceId: nonEmptyStringSchema,
  date: dateKeySchema,
  startMinutes: z.coerce.number().int().min(0).max(1439),
  applicantName: optionalTrimmedStringSchema,
  applicantPhone: optionalTrimmedStringSchema,
  documentType: documentTypeSchema.optional(),
  documentNumber: optionalTrimmedStringSchema,
  vehiclePlate: optionalTrimmedStringSchema,
  vehicleRegisteredLocally: booleanishSchema.optional(),
  deliveryMode: deliveryModeSchema.optional(),
  initialChecks: z.unknown().optional(),
  intakePayload: z.unknown().optional(),
})

export const confirmAppointmentSchema = z.object({
  appointmentId: nonEmptyStringSchema,
  applicantName: optionalTrimmedStringSchema,
  applicantPhone: optionalTrimmedStringSchema,
  documentType: documentTypeSchema.optional(),
  documentNumber: optionalTrimmedStringSchema,
  vehiclePlate: optionalTrimmedStringSchema,
  vehicleRegisteredLocally: booleanishSchema.optional(),
  deliveryMode: deliveryModeSchema.optional(),
  initialChecks: z.unknown().optional(),
  intakePayload: z.unknown().optional(),
})

export type AvailabilityQueryInput = z.infer<typeof availabilityQuerySchema>
export type RequestOtpInput = z.infer<typeof requestOtpSchema>
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>
export type HoldAppointmentInput = z.infer<typeof holdAppointmentSchema>
export type ConfirmAppointmentInput = z.infer<typeof confirmAppointmentSchema>
