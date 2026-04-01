import { ClientResponseError } from "pocketbase"
import { config, hasSuperuserCredentials } from "../../config"
import { ApiError, isUniqueConstraintError } from "../../lib/errors"
import {
  authenticateUser,
  createPublicClient,
  ensureAdminClient,
} from "../../lib/pocketbase"
import type {
  AvailabilityQueryInput,
  ConfirmAppointmentInput,
  HoldAppointmentInput,
  RequestOtpInput,
  VerifyOtpInput,
} from "./schemas"
import type {
  AppointmentRecord,
  AuthUserRecord,
  BookingSettingsRecord,
  DeliveryMode,
  ManagerSlotOverrideRecord,
  ManagerSlotTemplateRecord,
  OfficeHourOverrideRecord,
  OfficeHourTemplateRecord,
  ServiceTypeRecord,
  StaffCapacityOverrideRecord,
  StaffMemberRecord,
} from "./types"

const USERS_COLLECTION = "users"
const BOOKING_SETTINGS_COLLECTION = "booking_settings"
const SERVICE_TYPES_COLLECTION = "service_types"
const STAFF_MEMBERS_COLLECTION = "staff_members"
const OFFICE_HOUR_TEMPLATES_COLLECTION = "office_hour_templates"
const OFFICE_HOUR_OVERRIDES_COLLECTION = "office_hour_overrides"
const STAFF_CAPACITY_OVERRIDES_COLLECTION = "staff_capacity_overrides"
const MANAGER_SLOT_TEMPLATES_COLLECTION = "manager_slot_templates"
const MANAGER_SLOT_OVERRIDES_COLLECTION = "manager_slot_overrides"
const APPOINTMENTS_COLLECTION = "appointments"
const PUBLIC_SOURCE = "public_portal"
const ACTIVE_APPOINTMENT_STATUSES = ["held", "confirmed"]
const REALTIME_COLLECTIONS = [
  APPOINTMENTS_COLLECTION,
  BOOKING_SETTINGS_COLLECTION,
  OFFICE_HOUR_OVERRIDES_COLLECTION,
  STAFF_CAPACITY_OVERRIDES_COLLECTION,
  MANAGER_SLOT_OVERRIDES_COLLECTION,
  STAFF_MEMBERS_COLLECTION,
]

const DEFAULT_SETTINGS = {
  officeName: "Servicios Integrados de Movilidad Urbana de Tuluá S.A.S.",
  timezoneLabel: "America/Bogota",
  utcOffsetMinutes: -300,
  bookingHorizonDays: 30,
  minimumNoticeMinutes: 30,
  holdDurationMinutes: 10,
  slotIntervalMinutes: 15,
  defaultAppointmentDurationMinutes: 15,
  defaultDailyCapacity: 25,
  managerReservedSlotsPerAssistant: 2,
  locale: "es-CO",
}

type OfficeWindow = {
  label: string
  startMinutes: number
  endMinutes: number
}

type AssistantAvailability = {
  id: string
  record: StaffMemberRecord
  code: string
  name: string
  capacity: number
  displayOrder: number
}

type ManagerBlock = {
  staffId: string
  label: string
  startMinutes: number
  endMinutes: number
}

type BookingSettings = {
  officeName: string
  timezoneLabel: string
  utcOffsetMinutes: number
  bookingHorizonDays: number
  minimumNoticeMinutes: number
  holdDurationMinutes: number
  slotIntervalMinutes: number
  defaultAppointmentDurationMinutes: number
  defaultDailyCapacity: number
  managerReservedSlotsPerAssistant: number
  locale: string
}

type AvailabilityContext = {
  settings: BookingSettings
  weekday: string
  procedure: ServiceTypeRecord | null
  dateKey: string
  officeWindows: OfficeWindow[]
  assistants: AssistantAvailability[]
  blocksByStaffId: Record<string, ManagerBlock[]>
  appointments: AppointmentRecord[]
  serviceDurationMinutes: number
}

function toTrimmedString(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeEmail(value: string) {
  return toTrimmedString(value).toLowerCase()
}

function normalizeDateKey(value: string) {
  const dateKey = toTrimmedString(value)
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dateKey)) {
    throw new ApiError(400, "La fecha seleccionada no es valida.", "invalid_date")
  }

  return dateKey
}

function parseBooleanish(value: unknown) {
  if (typeof value === "boolean") {
    return value
  }

  const normalized = toTrimmedString(value).toLowerCase()
  if (["true", "1", "yes", "si"].includes(normalized)) {
    return true
  }

  if (["false", "0", "no", "null", ""].includes(normalized)) {
    return false
  }

  return false
}

function parseOptionalJson(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value)
    } catch {
      throw new ApiError(400, "Se recibio un campo JSON con formato invalido.", "invalid_json")
    }
  }

  return value
}

function dateKeyForOffset(offsetMinutes: number) {
  const now = new Date(Date.now() + offsetMinutes * 60 * 1000)
  const year = now.getUTCFullYear()
  const month = `${now.getUTCMonth() + 1}`.padStart(2, "0")
  const day = `${now.getUTCDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

function weekdayFromDateKey(dateKey: string) {
  const weekdayMap = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
  const date = new Date(`${dateKey}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, "La fecha seleccionada no es valida.", "invalid_date")
  }

  return weekdayMap[date.getUTCDay()]
}

function minutesOfDayForOffset(offsetMinutes: number) {
  const now = new Date(Date.now() + offsetMinutes * 60 * 1000)
  return now.getUTCHours() * 60 + now.getUTCMinutes()
}

function addMinutesToIso(isoString: string, minutes: number) {
  return new Date(new Date(isoString).getTime() + minutes * 60 * 1000).toISOString()
}

function parseDateTimeValue(value: string) {
  const trimmedValue = toTrimmedString(value)
  if (!trimmedValue) {
    return null
  }

  const normalizedValue = trimmedValue.includes("T")
    ? trimmedValue
    : trimmedValue.replace(" ", "T")
  const parsedDate = new Date(normalizedValue)

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

function minutesToLabel(minutes: number) {
  const hours = `${Math.floor(minutes / 60)}`.padStart(2, "0")
  const mins = `${minutes % 60}`.padStart(2, "0")
  return `${hours}:${mins}`
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd
}

function firstFileName(value?: string | string[]) {
  if (!value) {
    return ""
  }

  return Array.isArray(value) ? value[0] || "" : value
}

function normalizeClientError(error: unknown, fallbackMessage: string) {
  if (error instanceof ClientResponseError && error.status === 404) {
    return new ApiError(400, fallbackMessage, "invalid_reference")
  }

  return error
}

async function findUserByEmail(email: string) {
  const admin = await ensureAdminClient()

  try {
    return await admin.collection(USERS_COLLECTION).getFirstListItem<AuthUserRecord>(
      admin.filter("email = {:email}", { email }),
    )
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      return null
    }

    throw error
  }
}

function buildUserProfilePatch(input: {
  name?: string
  phone?: string
  documentType?: string
  documentNumber?: string
  vehiclePlate?: string
}) {
  const patch: Record<string, unknown> = {}

  if (input.name) {
    patch.name = input.name
  }

  if (input.phone) {
    patch.phone = input.phone
  }

  if (input.documentType) {
    patch.document_type = input.documentType
  }

  if (input.documentNumber) {
    patch.document_number = input.documentNumber
  }

  if (input.vehiclePlate) {
    patch.last_vehicle_plate = input.vehiclePlate
  }

  return patch
}

async function ensureUserForOtp(input: RequestOtpInput) {
  const admin = await ensureAdminClient()
  const email = normalizeEmail(input.email)
  const patch = buildUserProfilePatch(input)
  const existingUser = await findUserByEmail(email)

  if (existingUser) {
    if (Object.keys(patch).length === 0) {
      return existingUser
    }

    return admin.collection(USERS_COLLECTION).update<AuthUserRecord>(existingUser.id, patch)
  }

  const randomPassword = crypto.randomUUID().replaceAll("-", "")
  return admin.collection(USERS_COLLECTION).create<AuthUserRecord>({
    email,
    emailVisibility: false,
    password: randomPassword,
    passwordConfirm: randomPassword,
    ...patch,
  })
}

async function getBookingSettings(): Promise<BookingSettings> {
  const admin = await ensureAdminClient()

  try {
    const record = await admin.collection(BOOKING_SETTINGS_COLLECTION).getFirstListItem<BookingSettingsRecord>(
      admin.filter("key = {:key}", { key: "main" }),
    )

    return {
      officeName: record.office_name || DEFAULT_SETTINGS.officeName,
      timezoneLabel: record.timezone_label || DEFAULT_SETTINGS.timezoneLabel,
      utcOffsetMinutes: record.utc_offset_minutes || DEFAULT_SETTINGS.utcOffsetMinutes,
      bookingHorizonDays: record.booking_horizon_days || DEFAULT_SETTINGS.bookingHorizonDays,
      minimumNoticeMinutes: record.minimum_notice_minutes || DEFAULT_SETTINGS.minimumNoticeMinutes,
      holdDurationMinutes: record.hold_duration_minutes || DEFAULT_SETTINGS.holdDurationMinutes,
      slotIntervalMinutes: record.slot_interval_minutes || DEFAULT_SETTINGS.slotIntervalMinutes,
      defaultAppointmentDurationMinutes:
        record.default_appointment_duration_minutes || DEFAULT_SETTINGS.defaultAppointmentDurationMinutes,
      defaultDailyCapacity: record.default_daily_capacity || DEFAULT_SETTINGS.defaultDailyCapacity,
      managerReservedSlotsPerAssistant:
        record.manager_reserved_slots_per_assistant || DEFAULT_SETTINGS.managerReservedSlotsPerAssistant,
      locale: record.locale || DEFAULT_SETTINGS.locale,
    }
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      return { ...DEFAULT_SETTINGS }
    }

    throw error
  }
}

async function getProcedure(serviceId?: string) {
  if (!serviceId) {
    return null
  }

  const admin = await ensureAdminClient()

  try {
    return await admin.collection(SERVICE_TYPES_COLLECTION).getOne<ServiceTypeRecord>(serviceId)
  } catch (error) {
    throw normalizeClientError(error, "Debes indicar un tramite valido.")
  }
}

async function listOfficeHourOverrides(dateKey: string) {
  const admin = await ensureAdminClient()
  return admin.collection(OFFICE_HOUR_OVERRIDES_COLLECTION).getFullList<OfficeHourOverrideRecord>({
    filter: admin.filter("office_date = {:officeDate}", { officeDate: dateKey }),
    sort: "+sort_order,+start_minutes",
  })
}

async function listOfficeHourTemplates(weekday: string) {
  const admin = await ensureAdminClient()
  return admin.collection(OFFICE_HOUR_TEMPLATES_COLLECTION).getFullList<OfficeHourTemplateRecord>({
    filter: admin.filter("weekday = {:weekday} && is_active = true", { weekday }),
    sort: "+sort_order,+start_minutes",
  })
}

async function getEffectiveOfficeWindows(dateKey: string, weekday: string) {
  const overrideRecords = await listOfficeHourOverrides(dateKey)

  if (overrideRecords.length > 0) {
    if (overrideRecords.some((record) => Boolean(record.is_closed))) {
      return []
    }

    return overrideRecords
      .filter((record) => Boolean(record.is_active))
      .map<OfficeWindow>((record) => ({
        label: record.label || "Horario especial",
        startMinutes: record.start_minutes,
        endMinutes: record.end_minutes,
      }))
      .filter((window) => window.endMinutes > window.startMinutes)
  }

  const templateRecords = await listOfficeHourTemplates(weekday)
  return templateRecords
    .map<OfficeWindow>((record) => ({
      label: record.label || "Horario",
      startMinutes: record.start_minutes,
      endMinutes: record.end_minutes,
    }))
    .filter((window) => window.endMinutes > window.startMinutes)
}

async function getEffectiveAssistants(dateKey: string, settings: BookingSettings) {
  const admin = await ensureAdminClient()
  const [assistants, overrides] = await Promise.all([
    admin.collection(STAFF_MEMBERS_COLLECTION).getFullList<StaffMemberRecord>({
      filter: admin.filter("role = {:role} && is_active = true", { role: "assistant" }),
      sort: "+display_order,+full_name",
    }),
    admin.collection(STAFF_CAPACITY_OVERRIDES_COLLECTION).getFullList<StaffCapacityOverrideRecord>({
      filter: admin.filter("office_date = {:officeDate}", { officeDate: dateKey }),
    }),
  ])

  const overridesByStaffId = new Map(overrides.map((record) => [record.staff, record]))

  return assistants.flatMap<AssistantAvailability>((assistant) => {
    const override = overridesByStaffId.get(assistant.id)
    if (override && !override.is_active) {
      return []
    }

    const baseCapacity = assistant.daily_capacity || settings.defaultDailyCapacity
    const overrideCapacity = override?.daily_capacity ?? 0

    return [{
      id: assistant.id,
      record: assistant,
      code: assistant.code,
      name: assistant.full_name,
      capacity: overrideCapacity > 0 ? overrideCapacity : baseCapacity,
      displayOrder: assistant.display_order,
    }]
  })
}

async function getEffectiveManagerBlocks(dateKey: string, weekday: string) {
  const admin = await ensureAdminClient()
  const [templates, overrides] = await Promise.all([
    admin.collection(MANAGER_SLOT_TEMPLATES_COLLECTION).getFullList<ManagerSlotTemplateRecord>({
      filter: admin.filter("weekday = {:weekday} && is_active = true", { weekday }),
      sort: "+sort_order,+start_minutes",
    }),
    admin.collection(MANAGER_SLOT_OVERRIDES_COLLECTION).getFullList<ManagerSlotOverrideRecord>({
      filter: admin.filter("office_date = {:officeDate}", { officeDate: dateKey }),
      sort: "+sort_order,+start_minutes",
    }),
  ])

  const templatesByStaffId = new Map<string, ManagerSlotTemplateRecord[]>()
  const overridesByStaffId = new Map<string, ManagerSlotOverrideRecord[]>()

  for (const template of templates) {
    const collection = templatesByStaffId.get(template.staff) ?? []
    collection.push(template)
    templatesByStaffId.set(template.staff, collection)
  }

  for (const override of overrides) {
    const collection = overridesByStaffId.get(override.staff) ?? []
    collection.push(override)
    overridesByStaffId.set(override.staff, collection)
  }

  const staffIds = new Set<string>([
    ...templatesByStaffId.keys(),
    ...overridesByStaffId.keys(),
  ])

  const blocksByStaffId: Record<string, ManagerBlock[]> = {}

  for (const staffId of staffIds) {
    const records = overridesByStaffId.get(staffId)?.length
      ? overridesByStaffId.get(staffId)!
      : (templatesByStaffId.get(staffId) ?? [])

    blocksByStaffId[staffId] = records
      .filter((record) => Boolean(record.is_active))
      .map<ManagerBlock>((record) => ({
        staffId,
        label: record.label || "Reserva gerencia",
        startMinutes: record.start_minutes,
        endMinutes: record.start_minutes + record.duration_minutes,
      }))
      .filter((block) => block.endMinutes > block.startMinutes)
  }

  return blocksByStaffId
}

function isHoldExpiredRecord(record: AppointmentRecord, nowIso: string) {
  if (record.status !== "held") {
    return false
  }

  const holdExpiresAt = parseDateTimeValue(record.hold_expires_at || "")
  const now = parseDateTimeValue(nowIso)

  if (!holdExpiresAt || !now) {
    return false
  }

  return holdExpiresAt.getTime() < now.getTime()
}

function isActiveAppointment(record: AppointmentRecord, nowIso: string) {
  if (record.status === "confirmed") {
    return true
  }

  if (record.status === "held" && !isHoldExpiredRecord(record, nowIso)) {
    return true
  }

  return false
}

async function getActiveAppointmentsForDate(dateKey: string) {
  const admin = await ensureAdminClient()
  const nowIso = new Date().toISOString()
  const records = await admin.collection(APPOINTMENTS_COLLECTION).getFullList<AppointmentRecord>({
    filter: admin.filter("office_date = {:officeDate}", { officeDate: dateKey }),
    sort: "+slot_start_minutes",
  })

  return records.filter((record) => isActiveAppointment(record, nowIso))
}

function countReservedBlocksNotBackedByAppointments(blocks: ManagerBlock[], appointments: AppointmentRecord[]) {
  let count = 0

  for (const block of blocks) {
    const hasAppointment = appointments.some((appointment) =>
      rangesOverlap(
        block.startMinutes,
        block.endMinutes,
        appointment.slot_start_minutes,
        appointment.slot_end_minutes,
      ),
    )

    if (!hasAppointment) {
      count += 1
    }
  }

  return count
}

async function buildAvailabilityContext(dateKey: string, serviceId?: string): Promise<AvailabilityContext> {
  const settings = await getBookingSettings()
  const weekday = weekdayFromDateKey(dateKey)
  const procedure = await getProcedure(serviceId)
  const serviceDurationMinutes = procedure?.appointment_duration_minutes || settings.defaultAppointmentDurationMinutes

  const [officeWindows, assistants, blocksByStaffId, appointments] = await Promise.all([
    getEffectiveOfficeWindows(dateKey, weekday),
    getEffectiveAssistants(dateKey, settings),
    getEffectiveManagerBlocks(dateKey, weekday),
    getActiveAppointmentsForDate(dateKey),
  ])

  return {
    settings,
    weekday,
    procedure,
    dateKey,
    officeWindows,
    assistants,
    blocksByStaffId,
    appointments,
    serviceDurationMinutes,
  }
}

function assistantCanTakeSlot(
  context: AvailabilityContext,
  assistant: AssistantAvailability,
  slotStartMinutes: number,
  slotEndMinutes: number,
  ignoreAppointmentId: string,
  allowReservedBlock: boolean,
) {
  const appointmentsForAssistant = context.appointments.filter((appointment) =>
    appointment.assistant === assistant.id && appointment.id !== ignoreAppointmentId,
  )

  const overlappingAppointment = appointmentsForAssistant.find((appointment) =>
    rangesOverlap(
      slotStartMinutes,
      slotEndMinutes,
      appointment.slot_start_minutes,
      appointment.slot_end_minutes,
    ),
  )

  if (overlappingAppointment) {
    return false
  }

  const managerBlocks = context.blocksByStaffId[assistant.id] || []
  const overlappingBlocks = managerBlocks.filter((block) =>
    rangesOverlap(slotStartMinutes, slotEndMinutes, block.startMinutes, block.endMinutes),
  )
  const hasReservedBlockConflict = overlappingBlocks.length > 0

  if (hasReservedBlockConflict && !allowReservedBlock) {
    return false
  }

  const reservedLoad = countReservedBlocksNotBackedByAppointments(managerBlocks, appointmentsForAssistant)
  const overlappingReservedLoad = countReservedBlocksNotBackedByAppointments(overlappingBlocks, appointmentsForAssistant)
  const appointmentLoad = appointmentsForAssistant.length

  return appointmentLoad + reservedLoad - overlappingReservedLoad < assistant.capacity
}

function computeAvailabilitySlots(context: AvailabilityContext) {
  const slots = []
  const interval = context.settings.slotIntervalMinutes

  for (const window of context.officeWindows) {
    for (
      let startMinutes = window.startMinutes;
      startMinutes + context.serviceDurationMinutes <= window.endMinutes;
      startMinutes += interval
    ) {
      const endMinutes = startMinutes + context.serviceDurationMinutes
      const availableAssistants = context.assistants.filter((assistant) =>
        assistantCanTakeSlot(context, assistant, startMinutes, endMinutes, "", false),
      )

      slots.push({
        label: `${minutesToLabel(startMinutes)} - ${minutesToLabel(endMinutes)}`,
        startMinutes,
        endMinutes,
        availableAssistants: availableAssistants.length,
        isAvailable: availableAssistants.length > 0,
      })
    }
  }

  return slots
}

function chooseAssistantForSlot(context: AvailabilityContext, slotStartMinutes: number, slotEndMinutes: number) {
  const candidates = context.assistants
    .filter((assistant) =>
      assistantCanTakeSlot(context, assistant, slotStartMinutes, slotEndMinutes, "", false),
    )
    .map((assistant) => {
      const appointmentsForAssistant = context.appointments.filter(
        (appointment) => appointment.assistant === assistant.id,
      )
      const reservedLoad = countReservedBlocksNotBackedByAppointments(
        context.blocksByStaffId[assistant.id] || [],
        appointmentsForAssistant,
      )

      return {
        assistant,
        totalLoad: appointmentsForAssistant.length + reservedLoad,
        confirmedLoad: appointmentsForAssistant.filter(
          (appointment) => appointment.status === "confirmed",
        ).length,
      }
    })
    .sort((left, right) => {
      if (left.totalLoad !== right.totalLoad) {
        return left.totalLoad - right.totalLoad
      }

      if (left.confirmedLoad !== right.confirmedLoad) {
        return left.confirmedLoad - right.confirmedLoad
      }

      if (left.assistant.displayOrder !== right.assistant.displayOrder) {
        return left.assistant.displayOrder - right.assistant.displayOrder
      }

      return left.assistant.name.localeCompare(right.assistant.name)
    })

  return candidates[0]?.assistant ?? null
}

function assertDateWithinBookingWindow(dateKey: string, settings: BookingSettings, slotStartMinutes: number) {
  const today = dateKeyForOffset(settings.utcOffsetMinutes)

  if (dateKey < today) {
    throw new ApiError(400, "No es posible agendar citas en fechas pasadas.", "date_in_past")
  }

  const horizon = new Date(`${today}T00:00:00Z`)
  horizon.setUTCDate(horizon.getUTCDate() + settings.bookingHorizonDays)
  const latestDate = horizon.toISOString().slice(0, 10)

  if (dateKey > latestDate) {
    throw new ApiError(
      400,
      "La fecha seleccionada supera el horizonte de agendamiento configurado.",
      "date_outside_horizon",
    )
  }

  if (dateKey === today) {
    const currentMinutes = minutesOfDayForOffset(settings.utcOffsetMinutes)
    if (slotStartMinutes < currentMinutes + settings.minimumNoticeMinutes) {
      throw new ApiError(
        400,
        "La hora seleccionada ya no tiene el tiempo minimo de anticipacion requerido.",
        "date_outside_notice_window",
      )
    }
  }
}

function assertSlotInsideOfficeWindows(context: AvailabilityContext, slotStartMinutes: number, slotEndMinutes: number) {
  const fitsWindow = context.officeWindows.some((window) =>
    slotStartMinutes >= window.startMinutes && slotEndMinutes <= window.endMinutes,
  )

  if (!fitsWindow) {
    throw new ApiError(400, "La hora seleccionada no pertenece a un horario habilitado.", "invalid_slot")
  }
}

function applyAppointmentSnapshot(
  input: Partial<HoldAppointmentInput & ConfirmAppointmentInput>,
  user: AuthUserRecord,
) {
  const applicantName = input.applicantName || user.name
  const applicantPhone = input.applicantPhone || user.phone
  const documentType = input.documentType || user.document_type
  const documentNumber = input.documentNumber || user.document_number
  const vehiclePlate = input.vehiclePlate || user.last_vehicle_plate
  const patch: Record<string, unknown> = {
    applicant_name: applicantName,
    applicant_email: user.email,
    applicant_phone: applicantPhone,
    document_type: documentType,
    document_number: documentNumber,
    vehicle_plate: vehiclePlate,
  }

  if (input.vehicleRegisteredLocally !== undefined) {
    patch.vehicle_registered_locally = parseBooleanish(input.vehicleRegisteredLocally)
  }

  if (input.deliveryMode) {
    patch.delivery_mode = input.deliveryMode
  }

  if (input.initialChecks !== undefined) {
    patch.initial_checks = input.initialChecks
  }

  if (input.intakePayload !== undefined) {
    patch.intake_payload = input.intakePayload
  }

  return patch
}

async function syncUserProfile(userId: string, appointmentRecord: AppointmentRecord) {
  const admin = await ensureAdminClient()
  const patch = buildUserProfilePatch({
    name: toTrimmedString(appointmentRecord.applicant_name),
    phone: toTrimmedString(appointmentRecord.applicant_phone),
    documentType: toTrimmedString(appointmentRecord.document_type),
    documentNumber: toTrimmedString(appointmentRecord.document_number),
    vehiclePlate: toTrimmedString(appointmentRecord.vehicle_plate),
  })

  if (Object.keys(patch).length === 0) {
    return
  }

  await admin.collection(USERS_COLLECTION).update(userId, patch)
}

function assertProcedureEligibility(procedure: ServiceTypeRecord | null, appointmentRecord: AppointmentRecord) {
  if (!procedure) {
    return
  }

  if (
    procedure.requires_vehicle_registered_locally &&
    !Boolean(appointmentRecord.vehicle_registered_locally)
  ) {
    throw new ApiError(
      400,
      "Este tramite exige que el vehiculo este registrado en la oficina de transito de Tuluá.",
      "vehicle_not_local",
    )
  }
}

function assertConfirmationRequirements(
  procedure: ServiceTypeRecord | null,
  appointmentRecord: AppointmentRecord,
  uploadedFilesCount: number,
) {
  if (!procedure) {
    throw new ApiError(400, "La cita debe estar asociada a un tramite valido.", "invalid_service")
  }

  const deliveryMode = appointmentRecord.delivery_mode
  if (!deliveryMode) {
    throw new ApiError(400, "Debes indicar como entregar los soportes del tramite.", "missing_delivery_mode")
  }

  if (deliveryMode === "physical_delivery" && !procedure.allows_physical_delivery) {
    throw new ApiError(
      400,
      "Este tramite requiere carga digital del formato diligenciado.",
      "physical_delivery_not_allowed",
    )
  }

  if (deliveryMode === "digital_upload" && uploadedFilesCount === 0) {
    throw new ApiError(
      400,
      "Debes adjuntar el formato diligenciado para confirmar la cita.",
      "missing_required_attachments",
    )
  }

  if (procedure.requires_digital_form_upload && deliveryMode !== "digital_upload") {
    throw new ApiError(
      400,
      "Este tramite requiere que el formato se cargue en linea.",
      "digital_upload_required",
    )
  }

  assertProcedureEligibility(procedure, appointmentRecord)
}

export async function pruneExpiredHeldAppointments(onlyDateKey?: string) {
  const admin = await ensureAdminClient()
  const nowIso = new Date().toISOString()
  const filter = onlyDateKey
    ? admin.filter("status = {:status} && office_date = {:officeDate}", {
        status: "held",
        officeDate: onlyDateKey,
      })
    : admin.filter("status = {:status}", { status: "held" })

  const heldAppointments = await admin.collection(APPOINTMENTS_COLLECTION).getFullList<AppointmentRecord>({
    filter,
    sort: "+hold_expires_at",
  })

  const affectedDates = new Set<string>()

  for (const appointment of heldAppointments) {
    if (!isHoldExpiredRecord(appointment, nowIso)) {
      continue
    }

    await admin.collection(APPOINTMENTS_COLLECTION).update(appointment.id, {
      status: "expired",
      hold_expires_at: "",
    })
    affectedDates.add(appointment.office_date)
  }

  return Array.from(affectedDates)
}

async function ensureAppointmentCanRemainActive(appointment: AppointmentRecord) {
  if (!ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status)) {
    return
  }

  if (!appointment.assistant || !appointment.service || !appointment.office_date) {
    throw new ApiError(400, "La cita no tiene una configuracion de horario valida.", "invalid_appointment")
  }

  if (appointment.slot_end_minutes <= appointment.slot_start_minutes) {
    throw new ApiError(400, "La cita no tiene una configuracion de horario valida.", "invalid_appointment")
  }

  const context = await buildAvailabilityContext(appointment.office_date, appointment.service)
  assertSlotInsideOfficeWindows(context, appointment.slot_start_minutes, appointment.slot_end_minutes)

  const assistant = context.assistants.find((item) => item.id === appointment.assistant)
  if (!assistant) {
    throw new ApiError(
      400,
      "El auxiliar asignado no esta disponible para la fecha seleccionada.",
      "assistant_unavailable",
    )
  }

  if (
    !assistantCanTakeSlot(
      context,
      assistant,
      appointment.slot_start_minutes,
      appointment.slot_end_minutes,
      appointment.id,
      appointment.source !== PUBLIC_SOURCE,
    )
  ) {
    throw new ApiError(
      409,
      "El horario ya no esta disponible para el auxiliar seleccionado.",
      "assistant_overbooked",
    )
  }

  if (appointment.source === PUBLIC_SOURCE && !appointment.user) {
    throw new ApiError(
      400,
      "Las citas publicas deben estar asociadas a un usuario autenticado.",
      "missing_public_user",
    )
  }
}

function mapServiceRecord(service: ServiceTypeRecord, fileUrlBuilder: (service: ServiceTypeRecord, filename: string) => string) {
  const formTemplate = firstFileName(service.form_template)

  return {
    id: service.id,
    code: service.code,
    slug: service.slug,
    name: service.name,
    description: service.description ?? "",
    instructions: service.instructions ?? "",
    appointmentDurationMinutes: service.appointment_duration_minutes,
    requiresVehicleRegisteredLocally: Boolean(service.requires_vehicle_registered_locally),
    requiresDigitalFormUpload: Boolean(service.requires_digital_form_upload),
    allowsPhysicalDelivery: Boolean(service.allows_physical_delivery),
    eligibilitySchema: service.eligibility_schema ?? null,
    intakeSchema: service.intake_schema ?? null,
    formTemplateUrl: formTemplate ? fileUrlBuilder(service, formTemplate) : null,
  }
}

export async function listActiveServices() {
  const admin = await ensureAdminClient()
  const records = await admin.collection(SERVICE_TYPES_COLLECTION).getFullList<ServiceTypeRecord>({
    filter: "is_active = true",
    sort: "+sort_order,+name",
  })

  return records.map((record) =>
    mapServiceRecord(record, (service, filename) => admin.files.getURL(service, filename)),
  )
}

export async function getAvailability(input: AvailabilityQueryInput) {
  const dateKey = normalizeDateKey(input.date)
  await pruneExpiredHeldAppointments(dateKey)

  const context = await buildAvailabilityContext(dateKey, input.serviceId)

  return {
    date: context.dateKey,
    weekday: context.weekday,
    serviceId: context.procedure?.id ?? "",
    generatedAt: new Date().toISOString(),
    realtime: {
      strategy: "collection_subscriptions",
      collections: REALTIME_COLLECTIONS,
    },
    settings: {
      officeName: context.settings.officeName,
      timezoneLabel: context.settings.timezoneLabel,
      slotIntervalMinutes: context.settings.slotIntervalMinutes,
      holdDurationMinutes: context.settings.holdDurationMinutes,
      bookingHorizonDays: context.settings.bookingHorizonDays,
      minimumNoticeMinutes: context.settings.minimumNoticeMinutes,
    },
    service: context.procedure
      ? {
          id: context.procedure.id,
          code: context.procedure.code,
          name: context.procedure.name,
          durationMinutes: context.serviceDurationMinutes,
        }
      : null,
    officeWindows: context.officeWindows.map((window) => ({
      label: window.label,
      startMinutes: window.startMinutes,
      endMinutes: window.endMinutes,
      startLabel: minutesToLabel(window.startMinutes),
      endLabel: minutesToLabel(window.endMinutes),
    })),
    assistants: context.assistants.map((assistant) => ({
      id: assistant.id,
      code: assistant.code,
      name: assistant.name,
    })),
    slots: computeAvailabilitySlots(context),
  }
}

export async function requestOtp(input: RequestOtpInput) {
  await ensureUserForOtp(input)
  const publicClient = createPublicClient()
  return publicClient.collection(USERS_COLLECTION).requestOTP(input.email)
}

export async function verifyOtp(input: VerifyOtpInput) {
  const publicClient = createPublicClient()
  return publicClient.collection(USERS_COLLECTION).authWithOTP(input.otpId, input.password)
}

export async function holdAppointment(input: HoldAppointmentInput, authorizationHeader?: string) {
  const admin = await ensureAdminClient()
  const { user } = await authenticateUser(authorizationHeader)
  const dateKey = normalizeDateKey(input.date)
  const slotStartMinutes = input.startMinutes

  await pruneExpiredHeldAppointments(dateKey)

  const existingHolds = await admin.collection(APPOINTMENTS_COLLECTION).getFullList<AppointmentRecord>({
    filter: admin.filter("user = {:userId} && status = {:status}", {
      userId: user.id,
      status: "held",
    }),
  })

  const nowIso = new Date().toISOString()

  for (const existingHold of existingHolds) {
    await admin.collection(APPOINTMENTS_COLLECTION).update(existingHold.id, {
      status: "cancelled",
      cancelled_at: nowIso,
      hold_expires_at: "",
    })
  }

  const context = await buildAvailabilityContext(dateKey, input.serviceId)
  const slotEndMinutes = slotStartMinutes + context.serviceDurationMinutes

  assertDateWithinBookingWindow(dateKey, context.settings, slotStartMinutes)
  assertSlotInsideOfficeWindows(context, slotStartMinutes, slotEndMinutes)

  const chosenAssistant = chooseAssistantForSlot(context, slotStartMinutes, slotEndMinutes)
  if (!chosenAssistant) {
    throw new ApiError(409, "La hora seleccionada ya no tiene cupos disponibles.", "slot_unavailable")
  }

  try {
    const createdAppointment = await admin.collection(APPOINTMENTS_COLLECTION).create<AppointmentRecord>({
      user: user.id,
      service: input.serviceId,
      assistant: chosenAssistant.id,
      status: "held",
      source: PUBLIC_SOURCE,
      office_date: dateKey,
      slot_start_minutes: slotStartMinutes,
      slot_end_minutes: slotEndMinutes,
      hold_expires_at: addMinutesToIso(nowIso, context.settings.holdDurationMinutes),
      ...applyAppointmentSnapshot(input, user),
    })

    assertProcedureEligibility(context.procedure, createdAppointment)
    await syncUserProfile(user.id, createdAppointment)

    return {
      realtime: {
        strategy: "collection_subscriptions",
        collections: REALTIME_COLLECTIONS,
      },
      record: createdAppointment,
    }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ApiError(409, "La hora seleccionada ya no tiene cupos disponibles.", "slot_unavailable")
    }

    throw error
  }
}

export async function confirmAppointment(
  input: ConfirmAppointmentInput,
  attachments: File[],
  authorizationHeader?: string,
) {
  const admin = await ensureAdminClient()
  const { user } = await authenticateUser(authorizationHeader)
  let appointmentRecord: AppointmentRecord

  try {
    appointmentRecord = await admin.collection(APPOINTMENTS_COLLECTION).getOne<AppointmentRecord>(input.appointmentId)
  } catch (error) {
    throw normalizeClientError(error, "La cita indicada no existe.")
  }

  if (appointmentRecord.user !== user.id) {
    throw new ApiError(403, "No puedes confirmar una cita que no te pertenece.", "forbidden_appointment")
  }

  await pruneExpiredHeldAppointments(appointmentRecord.office_date)

  appointmentRecord = await admin.collection(APPOINTMENTS_COLLECTION).getOne<AppointmentRecord>(input.appointmentId)

  const nowIso = new Date().toISOString()
  if (isHoldExpiredRecord(appointmentRecord, nowIso)) {
    throw new ApiError(409, "La reserva expiro. Debes elegir un nuevo horario.", "hold_expired")
  }

  if (appointmentRecord.status !== "held") {
    throw new ApiError(
      409,
      "La cita ya no se encuentra en estado de reserva temporal.",
      "appointment_not_held",
    )
  }

  const procedure = await getProcedure(appointmentRecord.service)
  const snapshotPatch = applyAppointmentSnapshot(input, user)
  const candidateAppointment: AppointmentRecord = {
    ...appointmentRecord,
    ...snapshotPatch,
    status: "confirmed",
    confirmed_at: nowIso,
    hold_expires_at: "",
  }

  assertConfirmationRequirements(procedure, candidateAppointment, attachments.length)
  await ensureAppointmentCanRemainActive(candidateAppointment)

  const formData = new FormData()
  for (const [key, value] of Object.entries(snapshotPatch)) {
    if (value === undefined || value === null) {
      continue
    }

    if (typeof value === "object") {
      formData.set(key, JSON.stringify(value))
      continue
    }

    formData.set(key, String(value))
  }

  formData.set("status", "confirmed")
  formData.set("confirmed_at", nowIso)
  formData.set("hold_expires_at", "")

  for (const attachment of attachments) {
    formData.append("attachments", attachment)
  }

  const updatedAppointment = await admin.collection(APPOINTMENTS_COLLECTION).update<AppointmentRecord>(
    appointmentRecord.id,
    formData,
  )

  await syncUserProfile(user.id, updatedAppointment)

  return {
    realtime: {
      strategy: "collection_subscriptions",
      collections: REALTIME_COLLECTIONS,
    },
    record: updatedAppointment,
  }
}

export function startHoldReaper() {
  if (!config.holdReaperEnabled) {
    console.info("[tranzit-aux] Hold reaper disabled by configuration.")
    return
  }

  if (!hasSuperuserCredentials()) {
    console.warn("[tranzit-aux] Hold reaper skipped: missing PocketBase superuser credentials.")
    return
  }

  const runReaper = async () => {
    try {
      await pruneExpiredHeldAppointments()
    } catch (error) {
      console.error("[tranzit-aux] Failed to prune expired held appointments.", error)
    }
  }

  void runReaper()
  setInterval(runReaper, config.holdReaperIntervalMs)
}
